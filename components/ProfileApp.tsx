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

  function toggleTeam(id: string) {
    setSelectedTeams((current) =>
      current.includes(id)
        ? current.filter((teamId) => teamId !== id)
        : [...current, id]
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
          <p className="eyebrow">YOUR PROFILE</p>
          <h1>Choose your hockey.</h1>
          <p className="profileIntro">
            Follow the teams you care about to bring their fixtures, results and
            table to the top. Choosing a team is optional.
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
              {busy ? "Saving…" : "Save profile"}
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
