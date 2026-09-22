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

type FixtureRow = {
  id: number;
  date: string;
  time: string;
  side: "home" | "away";
  opponentId: string;
};

type ExistingFixture = {
  id: string;
  startsAt: string;
  side: "home" | "away";
  opponent: string;
  opponentId: string;
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
};

function blankRow(id: number, opponentId = ""): FixtureRow {
  return { id, date: "", time: "14:00", side: "home", opponentId };
}

export default function SeasonSetupApp() {
  const [ready, setReady] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [rows, setRows] = useState<FixtureRow[]>([]);
  const [nextId, setNextId] = useState(2);
  const [busy, setBusy] = useState(false);
  const [existingFixtures, setExistingFixtures] = useState<ExistingFixture[]>([]);
  const [manageableFixtureIds, setManageableFixtureIds] = useState<string[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("14:00");
  const [editSide, setEditSide] = useState<"home" | "away">("home");
  const [editOpponentId, setEditOpponentId] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [fixtureBusy, setFixtureBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<{
    created: number;
    existing: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    async function initialise() {
      const onboarded = localStorage.getItem("hockey_live_onboarded") === "1";
      const { data: authData } = await supabase.auth.getUser();

      if (!onboarded && !authData.user) {
        window.location.replace("/");
        return;
      }

      const accessToken =
        localStorage.getItem("hockey_live_access_token") || null;

      const [{ data: comps }, { data: memberships }, { data: interests }] =
        await Promise.all([
          supabase
            .from("competitions")
            .select("id,name,season")
            .order("name"),
          supabase
            .from("competition_teams")
            .select("competition_id,team:teams(id,name,is_demo)"),
          supabase.rpc("get_my_team_interests", {
            p_access_token: accessToken
          })
        ]);

      const compRows = (comps ?? []) as Competition[];
      const teamRows: Team[] = (memberships ?? [])
        .map((row: any) => ({
          competition_id: row.competition_id,
          id: row.team?.id ?? "",
          name: row.team?.name ?? ""
        }))
        .filter((row) => row.id && row.name);

      const interestedIds = (interests ?? [])
        .map((row: any) => row.team_id)
        .filter(Boolean);

      setCompetitions(compRows);
      setTeams(teamRows);

      const preferredTeam =
        teamRows.find((team) => interestedIds.includes(team.id)) ?? teamRows[0];

      const preferredCompetition =
        compRows.find((competition) =>
          preferredTeam
            ? teamRows.some(
                (team) =>
                  team.id === preferredTeam.id &&
                  team.competition_id === competition.id
              )
            : false
        ) ?? compRows[0];

      const compId = preferredCompetition?.id ?? "";
      const available = teamRows.filter(
        (team) => team.competition_id === compId
      );
      const selectedTeam =
        available.find((team) => team.id === preferredTeam?.id) ?? available[0];

      setCompetitionId(compId);
      setTeamId(selectedTeam?.id ?? "");

      const firstOpponent = available.find(
        (team) => team.id !== selectedTeam?.id
      )?.id;

      setRows([blankRow(1, firstOpponent ?? "")]);
      setReady(true);
    }

    void initialise();
  }, []);

  const availableTeams = useMemo(
    () => teams.filter((team) => team.competition_id === competitionId),
    [teams, competitionId]
  );

  const opponents = useMemo(
    () => availableTeams.filter((team) => team.id !== teamId),
    [availableTeams, teamId]
  );

  async function loadExistingFixtures() {
    if (!competitionId || !teamId) {
      setExistingFixtures([]);
      return;
    }

    setLoadingExisting(true);

    const accessToken =
      localStorage.getItem("hockey_live_access_token") || null;

    const [{ data, error }, { data: manageable }] = await Promise.all([
      supabase
        .from("matches")
        .select(
          "id,starts_at,status,venue,home_team_id,away_team_id,is_demo,cancelled_at,home_team:teams!matches_home_team_id_fkey(id,name),away_team:teams!matches_away_team_id_fkey(id,name)"
        )
        .eq("competition_id", competitionId)
        .eq("is_demo", false)
        .is("cancelled_at", null)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("starts_at", { ascending: true }),
      supabase.rpc("get_my_manageable_fixture_ids", {
        p_access_token: accessToken,
        p_competition_id: competitionId
      })
    ]);

    setLoadingExisting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setManageableFixtureIds(
      (manageable ?? []).map((row: any) => row.match_id).filter(Boolean)
    );

    const next: ExistingFixture[] = (data ?? []).map((match: any) => {
      const isHome = match.home_team_id === teamId;
      return {
        id: match.id,
        startsAt: match.starts_at,
        side: isHome ? "home" : "away",
        opponent: isHome
          ? match.away_team?.name ?? "Opponent"
          : match.home_team?.name ?? "Opponent",
        opponentId: isHome
          ? match.away_team_id
          : match.home_team_id,
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
        venue: match.venue ?? "",
        status: match.status
      };
    });

    setExistingFixtures(next);
  }

  useEffect(() => {
    if (!ready) return;
    void loadExistingFixtures();
  }, [ready, competitionId, teamId]);

  function changeCompetition(id: string) {
    setEditingFixtureId(null);
    const nextTeams = teams.filter((team) => team.competition_id === id);
    const nextTeam = nextTeams[0];

    setCompetitionId(id);
    setTeamId(nextTeam?.id ?? "");
    setRows((current) =>
      current.map((row) => ({
        ...row,
        opponentId:
          nextTeams.find((team) => team.id !== nextTeam?.id)?.id ?? ""
      }))
    );
    setSummary(null);
    setMessage("");
  }

  function changeTeam(id: string) {
    setEditingFixtureId(null);
    setTeamId(id);
    const fallback = availableTeams.find((team) => team.id !== id)?.id ?? "";

    setRows((current) =>
      current.map((row) => ({
        ...row,
        opponentId:
          row.opponentId && row.opponentId !== id ? row.opponentId : fallback
      }))
    );
    setSummary(null);
    setMessage("");
  }

  function updateRow(id: number, patch: Partial<FixtureRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
    setSummary(null);
    setMessage("");
  }

  function addRow() {
    const id = nextId;
    setNextId((value) => value + 1);
    setRows((current) => [
      ...current,
      blankRow(id, opponents[0]?.id ?? "")
    ]);
  }

  function removeRow(id: number) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id)
    );
  }

  function beginEditFixture(fixture: ExistingFixture) {
    const local = new Date(
      new Date(fixture.startsAt).getTime() -
        new Date(fixture.startsAt).getTimezoneOffset() * 60000
    );

    setEditingFixtureId(fixture.id);
    setEditDate(local.toISOString().slice(0, 10));
    setEditTime(local.toISOString().slice(11, 16));
    setEditSide(fixture.side);
    setEditOpponentId(fixture.opponentId);
    setEditVenue(fixture.venue);
    setMessage("");
  }

  async function saveFixtureEdit() {
    if (!editingFixtureId || !editDate || !editTime || !editOpponentId) return;

    const homeTeamId = editSide === "home" ? teamId : editOpponentId;
    const awayTeamId = editSide === "home" ? editOpponentId : teamId;
    const start = new Date(`${editDate}T${editTime}:00`);

    setFixtureBusy(true);
    const { error } = await supabase.rpc("update_hockey_fixture", {
      p_access_token:
        localStorage.getItem("hockey_live_access_token") || null,
      p_match_id: editingFixtureId,
      p_home_team_id: homeTeamId,
      p_away_team_id: awayTeamId,
      p_starts_at: start.toISOString(),
      p_venue: editVenue.trim()
    });
    setFixtureBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setEditingFixtureId(null);
    setMessage("Fixture updated.");
    await loadExistingFixtures();
  }

  async function cancelFixture(matchId: string) {
    if (!window.confirm("Cancel this fixture? It will disappear from the normal fixture list.")) {
      return;
    }

    setFixtureBusy(true);
    const { error } = await supabase.rpc("cancel_hockey_fixture", {
      p_access_token:
        localStorage.getItem("hockey_live_access_token") || null,
      p_match_id: matchId
    });
    setFixtureBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingFixtureId === matchId) setEditingFixtureId(null);
    setMessage("Fixture cancelled.");
    await loadExistingFixtures();
  }

  async function createSeason() {
    setMessage("");
    setSummary(null);

    const incomplete = rows.some(
      (row) => !row.date || !row.time || !row.opponentId
    );

    if (!competitionId || !teamId || incomplete) {
      setMessage("Complete each fixture before creating the season.");
      return;
    }

    setBusy(true);

    let created = 0;
    let existing = 0;
    let failed = 0;
    const accessToken = localStorage.getItem("hockey_live_access_token");

    for (const row of rows) {
      const start = new Date(`${row.date}T${row.time}:00`);
      const homeTeamId = row.side === "home" ? teamId : row.opponentId;
      const awayTeamId = row.side === "home" ? row.opponentId : teamId;

      const { data, error } = await supabase.rpc("create_hockey_match", {
        p_access_token: accessToken || null,
        p_competition_id: competitionId,
        p_home_team_id: homeTeamId,
        p_away_team_id: awayTeamId,
        p_starts_at: start.toISOString(),
        p_venue: ""
      });

      if (error) {
        failed += 1;
        continue;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.match_id) {
        failed += 1;
      } else if (result.scorer_pin == null) {
        existing += 1;
      } else {
        created += 1;
      }
    }

    setBusy(false);
    setSummary({ created, existing, failed });
    await loadExistingFixtures();

    if (failed === 0) {
      const fallbackOpponent = opponents[0]?.id ?? "";
      setRows([blankRow(nextId, fallbackOpponent)]);
      setNextId((value) => value + 1);
    }
  }

  if (!ready) {
    return (
      <main className="accessCheck">
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Preparing season setup…</p>
      </main>
    );
  }

  const selectedTeam = availableTeams.find((team) => team.id === teamId);

  return (
    <main className="createMatchShell">
      <header className="onboardingHeader">
        <a className="brand" href="/live">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
        <a className="welcomeBack" href="/create">← Create match</a>
      </header>

      <section className="createMatchStage seasonSetupStage">
        <div className="createMatchCard seasonSetupCard">
          <p className="eyebrow">SEASON SETUP</p>
          <h1>Add a whole season</h1>
          <p className="createMatchIntro">
            One person can add the fixtures once. Hockey Live automatically skips
            any fixture that already exists.
          </p>

          <div className="seasonSetupTop">
            <label>
              Competition
              <select
                value={competitionId}
                onChange={(event) => changeCompetition(event.target.value)}
              >
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name} • {competition.season}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Your team
              <select
                value={teamId}
                onChange={(event) => changeTeam(event.target.value)}
              >
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="existingSeasonBlock">
            <div className="existingSeasonHeader">
              <div>
                <p className="eyebrow">ALREADY ADDED</p>
                <h3>
                  {loadingExisting
                    ? "Checking fixtures…"
                    : `${existingFixtures.length} fixture${existingFixtures.length === 1 ? "" : "s"} in Hockey Live`}
                </h3>
              </div>
            </div>

            {!loadingExisting && existingFixtures.length === 0 && (
              <p className="existingSeasonEmpty">
                No fixtures have been added for this team yet.
              </p>
            )}

            {existingFixtures.length > 0 && (
              <div className="existingFixtureList">
                {existingFixtures.map((fixture) => {
                  const date = new Date(fixture.startsAt);
                  const canManage = manageableFixtureIds.includes(fixture.id);

                  return (
                    <div className="existingFixtureItem" key={fixture.id}>
                      <div className="existingFixtureRow">
                        <a
                          className="existingFixtureOpen"
                          href={`/live?match=${fixture.id}`}
                        >
                          <span className="existingFixtureDate">
                            {new Intl.DateTimeFormat("en-GB", {
                              day: "2-digit",
                              month: "short"
                            }).format(date)}
                          </span>
                          <span className="existingFixtureSide">
                            {fixture.side === "home" ? "H" : "A"}
                          </span>
                          <b>{fixture.opponent}</b>
                          <span className="existingFixtureTime">
                            {new Intl.DateTimeFormat("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit"
                            }).format(date)}
                          </span>
                          <span className="existingFixtureStatus">{fixture.status}</span>
                        </a>

                        {canManage && (
                          <button
                            className="fixtureEditButton"
                            onClick={() =>
                              editingFixtureId === fixture.id
                                ? setEditingFixtureId(null)
                                : beginEditFixture(fixture)
                            }
                          >
                            {editingFixtureId === fixture.id ? "Close" : "Edit"}
                          </button>
                        )}
                      </div>

                      {editingFixtureId === fixture.id && canManage && (
                        <div className="fixtureEditPanel">
                          <div className="fixtureEditGrid">
                            <label>
                              Date
                              <input
                                type="date"
                                value={editDate}
                                onChange={(event) => setEditDate(event.target.value)}
                              />
                            </label>
                            <label>
                              Time
                              <input
                                type="time"
                                value={editTime}
                                onChange={(event) => setEditTime(event.target.value)}
                              />
                            </label>
                            <label>
                              Home / Away
                              <select
                                value={editSide}
                                onChange={(event) =>
                                  setEditSide(event.target.value as "home" | "away")
                                }
                              >
                                <option value="home">Home</option>
                                <option value="away">Away</option>
                              </select>
                            </label>
                            <label>
                              Opponent
                              <select
                                value={editOpponentId}
                                onChange={(event) =>
                                  setEditOpponentId(event.target.value)
                                }
                              >
                                {opponents.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <label className="fixtureVenueEdit">
                            Venue <span>optional</span>
                            <input
                              value={editVenue}
                              onChange={(event) => setEditVenue(event.target.value)}
                              placeholder="Venue"
                            />
                          </label>

                          <div className="fixtureEditActions">
                            <button
                              className="primaryButton"
                              disabled={fixtureBusy}
                              onClick={() => void saveFixtureEdit()}
                            >
                              Save changes
                            </button>
                            <button
                              className="fixtureCancelButton"
                              disabled={fixtureBusy}
                              onClick={() => void cancelFixture(fixture.id)}
                            >
                              Cancel fixture
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="seasonAddMoreHeading">
            <p className="eyebrow">ADD MORE</p>
            <h3>Missing fixtures</h3>
          </div>

          <div className="seasonFixtureList">
            {rows.map((row, index) => (
              <div className="seasonFixtureRow" key={row.id}>
                <div className="seasonFixtureNumber">{index + 1}</div>

                <label>
                  Date
                  <input
                    type="date"
                    value={row.date}
                    onChange={(event) =>
                      updateRow(row.id, { date: event.target.value })
                    }
                  />
                </label>

                <label>
                  Time
                  <input
                    type="time"
                    value={row.time}
                    onChange={(event) =>
                      updateRow(row.id, { time: event.target.value })
                    }
                  />
                </label>

                <label>
                  H/A
                  <select
                    value={row.side}
                    onChange={(event) =>
                      updateRow(row.id, {
                        side: event.target.value as "home" | "away"
                      })
                    }
                  >
                    <option value="home">Home</option>
                    <option value="away">Away</option>
                  </select>
                </label>

                <label className="seasonOpponent">
                  Opponent
                  <select
                    value={row.opponentId}
                    onChange={(event) =>
                      updateRow(row.id, { opponentId: event.target.value })
                    }
                  >
                    {opponents.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  className="seasonRemoveButton"
                  type="button"
                  aria-label="Remove fixture"
                  disabled={rows.length === 1}
                  onClick={() => removeRow(row.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            className="secondaryButton seasonAddButton"
            type="button"
            onClick={addRow}
          >
            + Add fixture
          </button>

          {message && <div className="onboardingMessage">{message}</div>}

          {summary && (
            <div className="seasonSummary">
              <b>{selectedTeam?.name} fixtures processed</b>
              <span>{summary.created} new fixtures added</span>
              {summary.existing > 0 && (
                <span>{summary.existing} already existed and were skipped</span>
              )}
              {summary.failed > 0 && (
                <span>{summary.failed} could not be added</span>
              )}
            </div>
          )}

          <button
            className="primaryButton createMatchSubmit"
            disabled={busy}
            onClick={() => void createSeason()}
          >
            {busy
              ? "Creating season fixtures…"
              : `Create ${rows.length} season fixture${rows.length === 1 ? "" : "s"}`}
          </button>

          {summary && summary.failed === 0 && (
            <a className="secondaryButton seasonDoneButton" href="/live">
              Back to Your Teams
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
