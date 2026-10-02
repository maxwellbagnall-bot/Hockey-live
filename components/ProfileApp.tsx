"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Team = {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  club?: { name?: string | null } | null;
};

export default function ProfileApp() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [addTeamMessage, setAddTeamMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.replace("/");
        return;
      }

      const { data: profileData, error: profileError } = await supabase.rpc(
        "ensure_my_hockey_profile"
      );

      if (!mounted) return;

      if (profileError) {
        setHasError(true);
        setMessage(profileError.message);
        setReady(true);
        return;
      }

      const [{ data: teamData, error: teamError }, { data: interests, error: interestError }] =
        await Promise.all([
          supabase
            .from("teams")
            .select("id,name,age_group,gender,club:clubs(name)")
            .eq("is_demo", false)
            .order("name"),
          supabase.rpc("get_my_team_interests", { p_access_token: null })
        ]);

      if (!mounted) return;

      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      setUsername(profile?.username ?? "");
      setTeams((teamData ?? []) as Team[]);
      setSelectedTeams(
        (interests ?? []).map((interest: any) => interest.team_id).filter(Boolean)
      );

      const error = teamError ?? interestError;
      if (error) {
        setHasError(true);
        setMessage(error.message);
      }

      setReady(true);
    }

    void initialise();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredTeams = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return teams;

    return teams.filter((team) =>
      [team.name, team.club?.name, team.age_group, team.gender]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [search, teams]);

  const possibleTeams = useMemo(() => {
    const clubNeedle = newClubName.trim().toLowerCase();
    const teamNeedle = newTeamName.trim().toLowerCase();

    if (clubNeedle.length < 2 && teamNeedle.length < 2) return [];

    const terms = `${clubNeedle} ${teamNeedle}`
      .split(/\s+/)
      .filter((term) => term.length > 1);

    return teams
      .map((team) => {
        const haystack = `${team.club?.name ?? ""} ${team.name}`.toLowerCase();
        const matches = terms.filter((term) => haystack.includes(term)).length;
        return { team, matches };
      })
      .filter(({ matches }) => matches >= Math.max(1, Math.ceil(terms.length * 0.6)))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 4)
      .map(({ team }) => team);
  }, [newClubName, newTeamName, teams]);

  function toggleTeam(id: string) {
    setSelectedTeams((current) =>
      current.includes(id)
        ? current.filter((teamId) => teamId !== id)
        : [...current, id]
    );
  }

  function chooseExistingTeam(team: Team) {
    setSelectedTeams((current) =>
      current.includes(team.id) ? current : [...current, team.id]
    );
    setAddTeamOpen(false);
    setNewClubName("");
    setNewTeamName("");
    setAddTeamMessage("");
    setMessage(`${team.name} selected — we’ll use the team already in Hockey Live.`);
  }

  async function addCommunityTeam() {

    const clubName = newClubName.trim();
    const teamName = newTeamName.trim();

    if (clubName.length < 2 || teamName.length < 2) {
      setAddTeamMessage("Enter both the club and team name.");
      return;
    }

    setAddingTeam(true);
    setAddTeamMessage("");

    const { data, error } = await supabase.rpc("community_add_team", {
      p_club_name: clubName,
      p_team_name: teamName
    });

    setAddingTeam(false);

    if (error) {
      setAddTeamMessage(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.team_id) {
      setAddTeamMessage("We couldn’t add that team. Please try again.");
      return;
    }

    const addedTeam: Team = {
      id: row.team_id,
      name: row.team_name,
      age_group: null,
      gender: null,
      club: { name: row.club_name }
    };

    setTeams((current) => {
      const exists = current.some((team) => team.id === addedTeam.id);
      return exists
        ? current
        : [...current, addedTeam].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedTeams((current) =>
      current.includes(addedTeam.id) ? current : [...current, addedTeam.id]
    );
    setAddTeamOpen(false);
    setNewClubName("");
    setNewTeamName("");
    setSearch("");
    setMessage(
      row.already_existed
        ? `${addedTeam.name} already existed — we’ve selected it for you.`
        : `${addedTeam.name} added for the Hockey Live community and selected.`
    );
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setHasError(false);

    if (username.trim().length < 2) {
      setHasError(true);
      setMessage("Username must be at least 2 characters.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.rpc("complete_my_hockey_profile", {
      p_username: username.trim(),
      p_team_ids: selectedTeams
    });
    setBusy(false);

    if (error) {
      setHasError(true);
      setMessage(error.message);
      return;
    }

    setMessage("Profile and followed teams saved.");
  }

  if (!ready) {
    return (
      <main className="accessCheck">
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Loading your profile…</p>
      </main>
    );
  }

  return (
    <main className="profileShell">
      <header className="onboardingHeader">
        <a className="brand" href="/live">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
        <a className="welcomeBack" href="/live">
          ← Back to live
        </a>
      </header>

      <section className="profileStage">
        <form className="profileCard" onSubmit={saveProfile}>
          <p className="eyebrow">YOUR TEAMS</p>
          <h1>Manage my teams.</h1>
          <p className="profileIntro">
            Add or remove the teams you follow. Your choices personalise Hockey Live,
            and you can add a missing team for the whole community.
          </p>

          <label className="onboardingUsernameConfirm">
            Your username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={2}
              maxLength={40}
              required
            />
          </label>

          <div className="profileTeamHeading">
            <div>
              <b>Followed teams</b>
              <span>
                {selectedTeams.length === 0
                  ? "None selected"
                  : `${selectedTeams.length} selected`}
              </span>
            </div>
            {selectedTeams.length > 0 && (
              <button type="button" onClick={() => setSelectedTeams([])}>
                Clear all
              </button>
            )}
          </div>

          <input
            className="teamSearch profileTeamSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams or clubs…"
            aria-label="Search teams or clubs"
          />

          <div className="profileTeamList">
            {filteredTeams.map((team) => (
              <label className="teamOption" key={team.id}>
                <input
                  type="checkbox"
                  checked={selectedTeams.includes(team.id)}
                  onChange={() => toggleTeam(team.id)}
                />
                <span>
                  <b>{team.name}</b>
                  <small>
                    {[team.club?.name, team.age_group, team.gender]
                      .filter(Boolean)
                      .join(" • ")}
                  </small>
                </span>
              </label>
            ))}
            {filteredTeams.length === 0 && (
              <div className="noTeams">No teams found.</div>
            )}
          </div>

          <div className="communityAddTeam">
            <button
              type="button"
              className="communityAddTeamButton"
              onClick={() => {
                setAddTeamOpen((open) => !open);
                setAddTeamMessage("");
              }}
            >
              Can’t see your team? Add it
            </button>

            {addTeamOpen && (
              <div className="communityAddTeamForm">
                <p className="communityAddHint">
                  Add it once and it becomes the shared team everyone can use.
                  We’ll show similar teams first to help avoid duplicates.
                </p>

                <label>
                  Club
                  <input
                    value={newClubName}
                    onChange={(event) => setNewClubName(event.target.value)}
                    placeholder="e.g. Rugby & East Warwickshire"
                    autoComplete="off"
                  />
                </label>

                <label>
                  Team
                  <input
                    value={newTeamName}
                    onChange={(event) => setNewTeamName(event.target.value)}
                    placeholder="e.g. Rugby 3"
                    autoComplete="off"
                  />
                </label>

                {possibleTeams.length > 0 && (
                  <div className="possibleTeams">
                    <span className="communityAddHint">Is it one of these?</span>
                    {possibleTeams.map((team) => (
                      <button
                        type="button"
                        key={team.id}
                        onClick={() => chooseExistingTeam(team)}
                      >
                        <b>{team.name}</b>
                        {team.club?.name ? ` • ${team.club.name}` : ""}
                      </button>
                    ))}
                  </div>
                )}

                {addTeamMessage && (
                  <div className="communityAddMessage">{addTeamMessage}</div>
                )}

                <button
                  className="primaryButton"
                  type="button"
                  disabled={addingTeam}
                  onClick={() => void addCommunityTeam()}
                >
                  {addingTeam ? "Adding team…" : "Add this team"}
                </button>
              </div>
            )}
          </div>

          {message && (
            <div className={hasError ? "onboardingMessage" : "profileSuccess"}>
              {message}
            </div>
          )}

          <div className="profileActions">
            <button
              className="primaryButton"
              disabled={busy || username.trim().length < 2}
            >
              {busy ? "Saving…" : "Save my teams"}
            </button>
            <a className="secondaryButton" href="/create">
              Create a game
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
