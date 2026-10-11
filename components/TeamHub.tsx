"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type TeamInfo = {
  id: string;
  name: string;
  competitionId: string;
  competitionName: string;
  season: string;
};

type TeamMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: "scheduled" | "live" | "finished";
  startsAt: string;
};

type Tab = "overview" | "fixtures" | "results";

function effectiveMatchStatus(
  status: TeamMatch["status"],
  startsAt: string,
  controllerProfileId: string | null,
  controllerLastSeenAt: string | null,
  nowMs = Date.now()
): TeamMatch["status"] {
  if (status !== "live") return status;

  const startedAtMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startedAtMs)) return status;

  const controllerSeenAtMs = controllerLastSeenAt
    ? new Date(controllerLastSeenAt).getTime()
    : Number.NaN;
  const controllerIsActive =
    Boolean(controllerProfileId) &&
    Number.isFinite(controllerSeenAtMs) &&
    nowMs - controllerSeenAtMs <= 120000;

  return nowMs - startedAtMs >= 8 * 60 * 60 * 1000 && !controllerIsActive
    ? "finished"
    : status;
}

function isToday(value: string, now = new Date()) {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function TeamHub({
  teamIds,
  onOpenMatch
}: {
  teamIds: string[];
  onOpenMatch: (matchId: string) => void;
}) {
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      if (!teamIds.length) {
        setTeams([]);
        setSelectedTeamId("");
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("competition_teams")
        .select(
          "competition_id,team:teams(id,name,is_demo),competition:competitions(id,name,season)"
        );

      const next: TeamInfo[] = (data ?? [])
        .map((row: any) => ({
          id: row.team?.id ?? "",
          name: row.team?.name ?? "",
          competitionId: row.competition?.id ?? row.competition_id ?? "",
          competitionName: row.competition?.name ?? "Competition",
          season: row.competition?.season ?? ""
        }))
        .filter(
          (team) =>
            team.id &&
            team.competitionId &&
            teamIds.includes(team.id)
        );

      setTeams(next);
      setSelectedTeamId((current) =>
        next.some((team) => team.id === current)
          ? current
          : next[0]?.id ?? ""
      );
      setLoading(false);
    }

    void loadTeams();
  }, [teamIds.join(",")]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  useEffect(() => {
    async function loadTeamData() {
      if (!selectedTeam) {
        setMatches([]);
        return;
      }

      const { data: matchRows } = await
        supabase
          .from("matches")
          .select(
            "id,home_team_id,away_team_id,home_score,away_score,status,starts_at,is_demo,cancelled_at,controller_profile_id,controller_last_seen_at,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)"
          )
          .eq("competition_id", selectedTeam.competitionId)
          .eq("is_demo", false)
          .is("cancelled_at", null)
          .or(
            `home_team_id.eq.${selectedTeam.id},away_team_id.eq.${selectedTeam.id}`
          )
          .order("starts_at", { ascending: true }),
;

      setMatches(
        (matchRows ?? []).map((row: any) => ({
          id: row.id,
          homeTeamId: row.home_team_id,
          awayTeamId: row.away_team_id,
          home: row.home_team?.name ?? "Home",
          away: row.away_team?.name ?? "Away",
          homeScore: row.home_score ?? 0,
          awayScore: row.away_score ?? 0,
          status: effectiveMatchStatus(
            row.status,
            row.starts_at,
            row.controller_profile_id ?? null,
            row.controller_last_seen_at ?? null
          ),
          startsAt: row.starts_at
        }))
      );
    }

    void loadTeamData();
  }, [selectedTeam?.id, selectedTeam?.competitionId]);

  const upcoming = useMemo(
    () =>
      matches.filter(
        (match) => match.status === "scheduled" || match.status === "live"
      ),
    [matches]
  );

  const results = useMemo(
    () =>
      matches
        .filter((match) => match.status === "finished")
        .sort(
          (a, b) =>
            new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
        ),
    [matches]
  );

  const todayMatches = matches.filter((match) => isToday(match.startsAt));
  const nextMatch = upcoming.find((match) => match.status === "live") ?? upcoming[0];
  const latestResult = results[0];

  if (loading) {
    return (
      <section className="section teamHub">
        <p className="eyebrow">YOUR TEAMS</p>
        <h2>Loading your hockey…</h2>
      </section>
    );
  }

  if (!selectedTeam || teams.length === 0) {
    return (
      <section className="section teamHub">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">YOUR TEAMS</p>
            <h2>Your hockey starts here</h2>
          </div>
        </div>
        <div className="teamHubEmpty">
          <b>No followed team yet.</b>
          <span>
            Follow a team for a personalised home screen, or carry on without
            choosing one.
          </span>
          <div className="teamHubEmptyActions">
            <a className="primaryButton" href="/profile">
              Manage my teams
            </a>
            <a className="secondaryButton" href="#live">
              See live now
            </a>
            <a className="ghostButton" href="/create">
              Create a game
            </a>
          </div>
        </div>
      </section>
    );
  }

  function renderMatch(match: TeamMatch, result = false) {
    const teamIsHome = match.homeTeamId === selectedTeamId;
    const opponent = teamIsHome ? match.away : match.home;
    const ourScore = teamIsHome ? match.homeScore : match.awayScore;
    const theirScore = teamIsHome ? match.awayScore : match.homeScore;

    return (
      <button
        key={match.id}
        className="teamHubMatch"
        onClick={() => onOpenMatch(match.id)}
      >
        <span className="teamHubMatchDate">
          {shortDate(match.startsAt)}
          <small>{shortTime(match.startsAt)}</small>
        </span>

        <span className="teamHubHA">{teamIsHome ? "H" : "A"}</span>

        <span className="teamHubOpponent">
          <small>{teamIsHome ? "vs" : "at"}</small>
          <b>{opponent}</b>
        </span>

        {match.status === "live" ? (
          <span className="teamHubLive">LIVE</span>
        ) : result ? (
          <strong className="teamHubResultScore">
            {ourScore}–{theirScore}
          </strong>
        ) : (
          <span className="teamHubChevron">›</span>
        )}
      </button>
    );
  }

  return (
    <section className="section teamHub" id="teams">
      <div className="teamHubHeader">
        <div>
          <p className="eyebrow">YOUR TEAMS</p>
          <h2>{selectedTeam.name}</h2>
          <span className="teamHubCompetition">
            {selectedTeam.competitionName}
            {selectedTeam.season ? ` • ${selectedTeam.season}` : ""}
          </span>
        </div>

        <div className="teamHubHeaderActions">
          {teams.length > 1 && (
            <select
              className="teamHubTeamSelect"
              value={selectedTeamId}
              onChange={(event) => {
                setSelectedTeamId(event.target.value);
                setTab("overview");
              }}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
          <a className="secondaryButton manageTeamsButton" href="/profile">
            Manage my teams
          </a>
        </div>
      </div>

      <div className="teamHubTabs" role="tablist" aria-label="Team pages">
        {(["overview", "fixtures", "results"] as const).map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="teamOverviewGrid">
          <div className="teamOverviewCard">
            <span>{todayMatches.length ? "Today’s matches" : "Next match"}</span>
            {todayMatches.length ? (
              <div className="teamHubMatchList">
                {todayMatches.map((match) =>
                  renderMatch(match, match.status === "finished")
                )}
              </div>
            ) : nextMatch ? (
              renderMatch(nextMatch)
            ) : (
              <p>No upcoming fixture yet.</p>
            )}
            <button className="teamHubTextButton" onClick={() => setTab("fixtures")}>
              All fixtures →
            </button>
          </div>

          <div className="teamOverviewCard">
            <span>Latest result</span>
            {latestResult ? (
              renderMatch(latestResult, true)
            ) : (
              <p>No results recorded yet.</p>
            )}
            <button className="teamHubTextButton" onClick={() => setTab("results")}>
              All results →
            </button>
          </div>

          <div className="teamOverviewCard">
            <span>League tables</span>
            <p>
              Coming soon — we’ll add standings when we can link them to
              accurate England Hockey results.
            </p>
          </div>
        </div>
      )}

      {tab === "fixtures" && (
        <div className="teamHubPanel">
          <div className="teamHubPanelHeading">
            <h3>Fixtures</h3>
            <a href="/create/season">Manage season</a>
          </div>
          <div className="teamHubMatchList">
            {upcoming.length ? (
              upcoming.map((match) => renderMatch(match))
            ) : (
              <p className="teamHubEmptyText">No upcoming fixtures.</p>
            )}
          </div>
        </div>
      )}

      {tab === "results" && (
        <div className="teamHubPanel">
          <div className="teamHubPanelHeading">
            <h3>Results</h3>
          </div>
          <div className="teamHubMatchList">
            {results.length ? (
              results.map((match) => renderMatch(match, true))
            ) : (
              <p className="teamHubEmptyText">No results recorded yet.</p>
            )}
          </div>
        </div>
      )}

    </section>
  );
}
