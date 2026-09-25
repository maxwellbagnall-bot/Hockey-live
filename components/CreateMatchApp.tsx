"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Competition = {
  id: string;
  name: string;
  season: string;
};

type Team = {
  id: string;
  name: string;
  competition_id: string;
};

export default function CreateMatchApp() {
  const [ready, setReady] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
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

      const [{ data: comps }, { data: memberships }] = await Promise.all([
        supabase
          .from("competitions")
          .select("id,name,season")
          .order("name"),
        supabase
          .from("competition_teams")
          .select("competition_id,team:teams(id,name,is_demo)")
      ]);

      const compRows = (comps ?? []) as Competition[];
      const teamRows: Team[] = (memberships ?? [])
        .map((row: any) => ({
          competition_id: row.competition_id,
          id: row.team?.id ?? "",
          name: row.team?.name ?? ""
        }))
        .filter((row) => row.id && row.name);

      setCompetitions(compRows);
      setTeams(teamRows);

      const first = compRows[0]?.id ?? "";
      setCompetitionId(first);

      const firstTeams = teamRows.filter((team) => team.competition_id === first);
      setHomeTeamId(firstTeams[0]?.id ?? "");
      setAwayTeamId(firstTeams[1]?.id ?? "");

      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
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

  function changeCompetition(id: string) {
    setCompetitionId(id);
    const nextTeams = teams.filter((team) => team.competition_id === id);
    setHomeTeamId(nextTeams[0]?.id ?? "");
    setAwayTeamId(nextTeams[1]?.id ?? "");
  }

  async function createMatch(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setCreated(null);

    if (!homeTeamId || !awayTeamId || !competitionId || !matchDate || !matchTime) {
      setMessage("Please complete the match details.");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setMessage("Choose two different teams.");
      return;
    }

    const start = new Date(`${matchDate}T${matchTime}:00`);

    setBusy(true);

    const { data, error } = await supabase.rpc("create_hockey_match", {
      p_access_token: null,
      p_competition_id: competitionId,
      p_home_team_id: homeTeamId,
      p_away_team_id: awayTeamId,
      p_starts_at: start.toISOString(),
      p_venue: venue.trim()
    });

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

  const homeName = availableTeams.find((team) => team.id === homeTeamId)?.name;
  const awayName = availableTeams.find((team) => team.id === awayTeamId)?.name;

  return (
    <main className="createMatchShell">
      <header className="onboardingHeader">
        <a className="brand" href="/live">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
        <a className="welcomeBack" href="/live">← Live scores</a>
      </header>

      <section className="createMatchStage">
        <div className="createMatchCard">
          {!created ? (
            <>
              <p className="eyebrow">REPORT A MATCH</p>
              <h1>Create a match</h1>
              <p className="createMatchIntro">
                Set up the fixture in advance. At match time, anyone at the ground
                can claim Match Controller and run the shared live clock.
              </p>

              <a className="seasonSetupLink" href="/create/season">
                <span>
                  <b>Setting up a whole team?</b>
                  Add the season’s fixtures in one go.
                </span>
                <strong>Season setup →</strong>
              </a>

              <form className="createMatchForm" onSubmit={createMatch}>
                <label>
                  Competition
                  <select value={competitionId} onChange={(e) => changeCompetition(e.target.value)}>
                    {competitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.name} • {competition.season}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="createTeamGrid">
                  <label>
                    Home team
                    <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)}>
                      {availableTeams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Away team
                    <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
                      {availableTeams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="createTeamGrid">
                  <label>
                    Date
                    <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
                  </label>
                  <label>
                    Push back
                    <input type="time" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} required />
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

                {message && <div className="onboardingMessage">{message}</div>}

                <button className="primaryButton createMatchSubmit" disabled={busy}>
                  {busy ? "Creating match…" : "Create match"}
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
              <div className="controllerCreatedCallout">
                <b>
                  {created.existed
                    ? "We found this fixture already."
                    : "No scorer needs to be assigned now."}
                </b>
                <p>
                  {created.existed
                    ? "Rather than creating a duplicate, Hockey Live will take you to the existing Match Centre."
                    : "When the game is about to start, someone at the ground can open this match and tap Claim Match Controller. Everyone else can still report goals, cards, corners and comments."}
                </p>
              </div>
              <div className="createdActions">
                <a className="primaryButton" href={`/live?match=${created.id}`}>
                  {created.existed ? "Open existing match" : "Open match centre"}
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
