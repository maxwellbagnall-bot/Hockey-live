"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import HelpPopup from "./HelpPopup";

type Competition = {
  id: string;
  name: string;
  season: string;
};

type TeamMembership = {
  id: string;
  name: string;
  competition_id: string;
};

type HockeyTeam = {
  id: string;
  name: string;
};

type MatchMode = "competition" | "friendly";
type PeriodFormat = "quarters" | "halves";

export default function CreateMatchApp() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<MatchMode>("competition");
  const [periodFormat, setPeriodFormat] = useState<PeriodFormat>("quarters");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [allTeams, setAllTeams] = useState<HockeyTeam[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [friendlyHome, setFriendlyHome] = useState("");
  const [friendlyAway, setFriendlyAway] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("14:00");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ id: string; existed: boolean } | null>(null);

  useEffect(() => {
    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.replace("/");
        return;
      }

      const [{ data: comps }, { data: memberships }, { data: teamRows }] =
        await Promise.all([
          supabase
            .from("competitions")
            .select("id,name,season")
            .order("name"),
          supabase
            .from("competition_teams")
            .select("competition_id,team:teams(id,name,is_demo)"),
          supabase
            .from("teams")
            .select("id,name")
            .eq("is_demo", false)
            .order("name")
        ]);

      const compRows = (comps ?? []) as Competition[];
      const membershipRows: TeamMembership[] = (memberships ?? [])
        .map((row: any) => ({
          competition_id: row.competition_id,
          id: row.team?.id ?? "",
          name: row.team?.name ?? ""
        }))
        .filter((row) => row.id && row.name);

      setCompetitions(compRows);
      setTeams(membershipRows);
      setAllTeams((teamRows ?? []) as HockeyTeam[]);

      const first = compRows[0]?.id ?? "";
      setCompetitionId(first);

      const firstTeams = membershipRows.filter(
        (team) => team.competition_id === first
      );
      setHomeTeamId(firstTeams[0]?.id ?? "");
      setAwayTeamId(firstTeams[1]?.id ?? "");

      const now = new Date();
      const localDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 10);
      setMatchDate(localDate);
      setReady(true);
    }

    void initialise();
  }, []);

  const availableTeams = useMemo(
    () => teams.filter((team) => team.competition_id === competitionId),
    [teams, competitionId]
  );

  const homeTeamOptions = useMemo(() => {
    const uniqueTeams = new Map<string, TeamMembership>();
    for (const team of teams) {
      if (!uniqueTeams.has(team.id)) uniqueTeams.set(team.id, team);
    }
    return Array.from(uniqueTeams.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [teams]);

  function changeCompetition(id: string) {
    setCompetitionId(id);
    const nextTeams = teams.filter((team) => team.competition_id === id);
    setHomeTeamId(nextTeams[0]?.id ?? "");
    setAwayTeamId(nextTeams[1]?.id ?? "");
  }

  function changeHomeTeam(id: string) {
    const memberships = teams.filter((team) => team.id === id);
    if (!memberships.length) return;

    const membership =
      memberships.find((team) => team.competition_id === competitionId) ??
      memberships[0];
    const nextTeams = teams.filter(
      (team) => team.competition_id === membership.competition_id
    );

    setCompetitionId(membership.competition_id);
    setHomeTeamId(id);
    setAwayTeamId((current) =>
      nextTeams.some((team) => team.id === current && team.id !== id)
        ? current
        : nextTeams.find((team) => team.id !== id)?.id ?? ""
    );
  }

  function changeMode(nextMode: MatchMode) {
    setMode(nextMode);
    setMessage("");
    setCreated(null);
  }

  async function createMatch(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setCreated(null);

    if (!matchDate || !matchTime) {
      setMessage("Please complete the match details.");
      return;
    }

    if (mode === "competition") {
      if (!homeTeamId || !awayTeamId || !competitionId) {
        setMessage("Please complete the match details.");
        return;
      }

      if (homeTeamId === awayTeamId) {
        setMessage("Choose two different teams.");
        return;
      }
    } else {
      if (friendlyHome.trim().length < 2 || friendlyAway.trim().length < 2) {
        setMessage("Enter both team names.");
        return;
      }

      if (
        friendlyHome.trim().toLowerCase() ===
        friendlyAway.trim().toLowerCase()
      ) {
        setMessage("Choose two different teams.");
        return;
      }
    }

    const start = new Date(`${matchDate}T${matchTime}:00`);
    setBusy(true);

    const request =
      mode === "competition"
        ? supabase.rpc("create_hockey_match_with_format", {
            p_access_token: null,
            p_competition_id: competitionId,
            p_home_team_id: homeTeamId,
            p_away_team_id: awayTeamId,
            p_starts_at: start.toISOString(),
            p_venue: venue.trim(),
            p_period_format: periodFormat
          })
        : supabase.rpc("create_friendly_hockey_match_with_format", {
            p_access_token: null,
            p_home_team_name: friendlyHome.trim(),
            p_away_team_name: friendlyAway.trim(),
            p_starts_at: start.toISOString(),
            p_venue: venue.trim(),
            p_period_format: periodFormat
          });

    const { data, error } = await request;
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.match_id) {
      setMessage("The match was created but we couldn't open it.");
      return;
    }

    setCreated({
      id: row.match_id,
      existed: row.scorer_pin == null
    });
  }

  if (!ready) {
    return (
      <main className="accessCheck">
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Preparing match creator…</p>
      </main>
    );
  }

  const homeName =
    mode === "friendly"
      ? friendlyHome.trim()
      : availableTeams.find((team) => team.id === homeTeamId)?.name;

  const awayName =
    mode === "friendly"
      ? friendlyAway.trim()
      : availableTeams.find((team) => team.id === awayTeamId)?.name;

  return (
    <main className="createMatchShell">
      <header className="onboardingHeader">
        <a className="brand" href="/live">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
        <div className="onboardingHeaderActions">
          <HelpPopup />
          <a className="welcomeBack" href="/live">← Hockey Live</a>
        </div>
      </header>

      <section className="createMatchStage">
        <div className="createMatchCard">
          {!created ? (
            <>
              <p className="eyebrow">SET UP A GAME</p>
              <h1>Create a match</h1>
              <p className="createMatchIntro">
                League game or one-off friendly — set it up now and anyone at
                the ground can contribute live updates at match time.
              </p>

              <div className="matchTypePicker" aria-label="Match type">
                <button
                  type="button"
                  className={mode === "competition" ? "active" : ""}
                  onClick={() => changeMode("competition")}
                >
                  <b>Competition match</b>
                  <span>Counts towards a league or competition</span>
                </button>
                <button
                  type="button"
                  className={mode === "friendly" ? "active" : ""}
                  onClick={() => changeMode("friendly")}
                >
                  <b>Friendly</b>
                  <span>Standalone game — no league needed</span>
                </button>
              </div>

              {mode === "competition" && (
                <a className="seasonSetupLink" href="/create/season">
                  <span>
                    <b>Setting up a whole team?</b>
                    Add the season’s fixtures in one go.
                  </span>
                  <strong>Season setup →</strong>
                </a>
              )}

              <form className="createMatchForm" onSubmit={createMatch}>
                {mode === "competition" ? (
                  <>
                    <div className="createTeamGrid">
                      <label>
                        Home team <span className="optionalText">sets league</span>
                        <select
                          value={homeTeamId}
                          onChange={(e) => changeHomeTeam(e.target.value)}
                        >
                          {homeTeamOptions.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Competition
                        <select
                          value={competitionId}
                          onChange={(e) => changeCompetition(e.target.value)}
                        >
                          {competitions.map((competition) => (
                            <option key={competition.id} value={competition.id}>
                              {competition.name} • {competition.season}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label>
                      Away team
                      <select
                        value={awayTeamId}
                        onChange={(e) => setAwayTeamId(e.target.value)}
                      >
                        {availableTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <div className="friendlyCallout">
                      <b>No league required.</b>
                      <span>
                        Start typing a team already in Hockey Live, or enter a
                        new team name and we’ll create it automatically.
                      </span>
                    </div>

                    <div className="createTeamGrid">
                      <label>
                        Home team
                        <input
                          list="hockey-live-teams"
                          value={friendlyHome}
                          onChange={(e) => setFriendlyHome(e.target.value)}
                          placeholder="e.g. Beeston U16 Boys"
                          autoComplete="off"
                          required
                        />
                      </label>

                      <label>
                        Away team
                        <input
                          list="hockey-live-teams"
                          value={friendlyAway}
                          onChange={(e) => setFriendlyAway(e.target.value)}
                          placeholder="e.g. Nottingham HC U16"
                          autoComplete="off"
                          required
                        />
                      </label>
                    </div>

                    <datalist id="hockey-live-teams">
                      {allTeams.map((team) => (
                        <option key={team.id} value={team.name} />
                      ))}
                    </datalist>
                  </>
                )}

                <div className="matchFormatField">
                  <span>Game format</span>
                  <div className="periodFormatPicker">
                    <button
                      type="button"
                      className={periodFormat === "quarters" ? "active" : ""}
                      onClick={() => setPeriodFormat("quarters")}
                    >
                      <b>4 quarters</b>
                    </button>
                    <button
                      type="button"
                      className={periodFormat === "halves" ? "active" : ""}
                      onClick={() => setPeriodFormat("halves")}
                    >
                      <b>2 halves</b>
                    </button>
                  </div>
                </div>

                <div className="createTeamGrid">
                  <label>
                    Date
                    <input
                      type="date"
                      value={matchDate}
                      onChange={(e) => setMatchDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Push back
                    <input
                      type="time"
                      value={matchTime}
                      onChange={(e) => setMatchTime(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <label>
                  Venue <span className="optionalText">optional</span>
                  <input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Nottingham Hockey Centre"
                  />
                </label>

                {message && (
                  <div className="onboardingMessage">{message}</div>
                )}

                <button
                  className="primaryButton createMatchSubmit"
                  disabled={busy}
                >
                  {busy
                    ? "Creating match…"
                    : mode === "friendly"
                      ? "Create friendly"
                      : "Create match"}
                </button>
              </form>
            </>
          ) : (
            <div className="createdMatch">
              <span className="checkEmailIcon">✓</span>
              <p className="eyebrow">
                {created.existed ? "MATCH ALREADY EXISTS" : "MATCH CREATED"}
              </p>
              <h1>{homeName} vs {awayName}</h1>
              <div className="createdMetaBadges">
                {mode === "friendly" && (
                  <div className="friendlyBadge">FRIENDLY • NO LEAGUE TABLE</div>
                )}
                <div className="friendlyBadge">
                  {periodFormat === "halves" ? "2 HALVES" : "4 QUARTERS"}
                </div>
              </div>
              <div className="controllerCreatedCallout">
                <b>
                  {created.existed
                    ? "We found this fixture already."
                    : "The Match Centre is ready."}
                </b>
                <p>
                  {created.existed
                    ? "Rather than creating a duplicate, Hockey Live will take you to the existing Match Centre."
                    : "At push back someone can claim Match Controller. Everyone else can still report goals, cards, corners and comments."}
                </p>
              </div>
              <div className="createdActions">
                <a
                  className="primaryButton"
                  href={`/live?match=${created.id}`}
                >
                  {created.existed
                    ? "Open existing match"
                    : "Open match centre"}
                </a>
                <button
                  className="secondaryButton"
                  onClick={() => {
                    setCreated(null);
                    setMessage("");
                  }}
                >
                  Create another
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
