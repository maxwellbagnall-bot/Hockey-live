"use client";

import { useEffect, useMemo, useState } from "react";
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

type ParsedRow = {
  line: number;
  date: string;
  time: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  venue: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  startsAt: string | null;
  error: string | null;
};

function parseDateTime(dateText: string, timeText: string) {
  const match = dateText.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  const time = timeText.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match || !time) return null;

  const [, dd, mm, yyyy] = match;
  const [, hh, min] = time;

  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    0,
    0
  );

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function DataAdminApp() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: adminStatus } = await supabase.rpc(
        "get_my_data_admin_status",
        { p_access_token: null }
      );

      const isAllowed = Boolean(adminStatus);
      setAllowed(isAllowed);

      if (!isAllowed) {
        setReady(true);
        return;
      }

      const [{ data: compRows }, { data: teamRows }] = await Promise.all([
        supabase
          .from("competitions")
          .select("id,name,season")
          .order("season", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("competition_teams")
          .select(
            "competition_id,team:teams(id,name,is_demo)"
          )
      ]);

      const nextCompetitions: Competition[] = (compRows ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        season: row.season ?? ""
      }));

      const nextTeams: Team[] = (teamRows ?? [])
        .map((row: any) => ({
          id: row.team?.id ?? "",
          name: row.team?.name ?? "",
          competition_id: row.competition_id
        }))
        .filter((row: Team) => row.id && row.name);

      setCompetitions(nextCompetitions);
      setTeams(nextTeams);
      setCompetitionId(nextCompetitions[0]?.id ?? "");
      setReady(true);
    }

    void load();
  }, []);

  const competitionTeams = useMemo(
    () => teams.filter((team) => team.competition_id === competitionId),
    [teams, competitionId]
  );

  const parsedRows = useMemo<ParsedRow[]>(() => {
    if (!raw.trim()) return [];

    const teamByName = new Map(
      competitionTeams.map((team) => [normalise(team.name), team])
    );

    return raw
      .split(/\r?\n/)
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.trim())
      .map(({ line, index }) => {
        const parts = line.split("|").map((part) => part.trim());

        if (parts.length < 6) {
          return {
            line: index + 1,
            date: parts[0] ?? "",
            time: parts[1] ?? "",
            homeName: parts[2] ?? "",
            awayName: parts[3] ?? "",
            homeScore: null,
            awayScore: null,
            venue: parts[6] ?? "",
            homeTeamId: null,
            awayTeamId: null,
            startsAt: null,
            error: "Use: date | time | home | away | home score | away score | venue"
          };
        }

        const [date, time, homeName, awayName, homeScoreText, awayScoreText, venue = ""] =
          parts;

        const home = teamByName.get(normalise(homeName));
        const away = teamByName.get(normalise(awayName));
        const homeScore = Number(homeScoreText);
        const awayScore = Number(awayScoreText);
        const startsAt = parseDateTime(date, time);

        let error: string | null = null;

        if (!home) error = `Unknown home team: ${homeName}`;
        else if (!away) error = `Unknown away team: ${awayName}`;
        else if (home.id === away.id) error = "Home and away teams are the same";
        else if (!Number.isInteger(homeScore) || homeScore < 0 || homeScore > 99)
          error = "Invalid home score";
        else if (!Number.isInteger(awayScore) || awayScore < 0 || awayScore > 99)
          error = "Invalid away score";
        else if (!startsAt) error = "Invalid date or time";

        return {
          line: index + 1,
          date,
          time,
          homeName,
          awayName,
          homeScore: Number.isFinite(homeScore) ? homeScore : null,
          awayScore: Number.isFinite(awayScore) ? awayScore : null,
          venue,
          homeTeamId: home?.id ?? null,
          awayTeamId: away?.id ?? null,
          startsAt,
          error
        };
      });
  }, [raw, competitionTeams]);

  const validRows = parsedRows.filter((row) => !row.error);
  const errorRows = parsedRows.filter((row) => row.error);

  async function importResults() {
    if (!competitionId || !validRows.length || errorRows.length) return;

    if (!sourceUrl.trim()) {
      setMessage("Add the source URL before importing.");
      return;
    }

    setImporting(true);
    setMessage("");

    const payload = validRows.map((row) => ({
      home_team_id: row.homeTeamId,
      away_team_id: row.awayTeamId,
      starts_at: row.startsAt,
      home_score: row.homeScore,
      away_score: row.awayScore,
      venue: row.venue
    }));

    const { data, error } = await supabase.rpc("import_hockey_results", {
      p_access_token: null,
      p_competition_id: competitionId,
      p_rows: payload,
      p_source_url: sourceUrl.trim(),
      p_source_label: sourceLabel.trim() || "Imported result"
    });

    setImporting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    setMessage(
      `Import complete: ${result?.created_count ?? 0} created, ` +
        `${result?.updated_count ?? 0} updated, ` +
        `${result?.skipped_count ?? 0} unchanged, ` +
        `${result?.error_count ?? 0} errors.`
    );

    if ((result?.error_count ?? 0) === 0) {
      setRaw("");
    }
  }

  if (!ready) {
    return (
      <main className="dataAdminShell">
        <section className="dataAdminCard">
          <p className="eyebrow">HOCKEY LIVE DATA</p>
          <h1>Checking access…</h1>
        </section>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="dataAdminShell">
        <section className="dataAdminCard">
          <p className="eyebrow">HOCKEY LIVE DATA</p>
          <h1>Admin access required</h1>
          <p className="dataAdminIntro">
            This area is restricted to Hockey Live data administrators.
          </p>
          <a className="secondaryButton" href="/live">
            Back to Hockey Live
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="dataAdminShell">
      <section className="dataAdminCard">
        <div className="dataAdminTopbar">
          <div>
            <p className="eyebrow">HOCKEY LIVE DATA</p>
            <h1>Import results</h1>
            <p className="dataAdminIntro">
              Paste a full round of results, preview it, then import once.
              Existing fixtures will be updated automatically.
            </p>
          </div>
          <a className="ghostButton" href="/live">
            Back to app
          </a>
        </div>

        <div className="dataAdminFields">
          <label>
            Competition
            <select
              value={competitionId}
              onChange={(event) => {
                setCompetitionId(event.target.value);
                setRaw("");
                setMessage("");
              }}
            >
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                  {competition.season ? ` • ${competition.season}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source name
            <input
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              placeholder="e.g. England Hockey"
            />
          </label>

          <label className="dataAdminSourceUrl">
            Source URL
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="dataAdminPasteBlock">
          <div className="dataAdminPasteHeading">
            <div>
              <b>Paste results</b>
              <span>
                One match per line. Venue is optional.
              </span>
            </div>
            <button
              className="dataAdminExampleButton"
              onClick={() =>
                setRaw(
                  "19/09/2026 | 14:00 | Stourport 1 | Harborne 2 | 2 | 4 | Stourport Sports Club\n" +
                  "19/09/2026 | 13:15 | Lichfield 1 | Telford & Wrekin 1 | 0 | 5 | Lichfield Sports Club"
                )
              }
            >
              Load example
            </button>
          </div>

          <code className="dataAdminFormat">
            DD/MM/YYYY | HH:MM | Home team | Away team | H | A | Venue
          </code>

          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="19/09/2026 | 14:00 | Stourport 1 | Harborne 2 | 2 | 4 | Stourport Sports Club"
            rows={8}
          />
        </div>

        {parsedRows.length > 0 && (
          <div className="dataAdminPreview">
            <div className="dataAdminPreviewHeading">
              <div>
                <p className="eyebrow">PREVIEW</p>
                <h2>
                  {validRows.length} ready
                  {errorRows.length ? ` • ${errorRows.length} need fixing` : ""}
                </h2>
              </div>
            </div>

            <div className="dataAdminPreviewList">
              {parsedRows.map((row) => (
                <div
                  key={row.line}
                  className={`dataAdminPreviewRow ${row.error ? "hasError" : ""}`}
                >
                  <span className="dataAdminLineNo">{row.line}</span>
                  <span className="dataAdminPreviewDate">
                    {row.date} {row.time}
                  </span>
                  <span className="dataAdminPreviewTeams">
                    <b>{row.homeName}</b>
                    <strong>
                      {row.homeScore ?? "–"}–{row.awayScore ?? "–"}
                    </strong>
                    <b>{row.awayName}</b>
                  </span>
                  <span className="dataAdminPreviewStatus">
                    {row.error ? row.error : "Ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {message && <div className="dataAdminMessage">{message}</div>}

        <div className="dataAdminActions">
          <button
            className="primaryButton"
            disabled={
              importing ||
              !validRows.length ||
              errorRows.length > 0 ||
              !sourceUrl.trim()
            }
            onClick={() => void importResults()}
          >
            {importing
              ? "Importing…"
              : `Import ${validRows.length || ""} result${validRows.length === 1 ? "" : "s"}`}
          </button>

          <span>
            The league table recalculates automatically after import.
          </span>
        </div>
      </section>
    </main>
  );
}
