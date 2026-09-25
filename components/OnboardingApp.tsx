"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Stage =
  | "welcome"
  | "signup"
  | "teams"
  | "login"
  | "forgot"
  | "check-email";

type Team = {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  club?: { name?: string | null } | null;
};

type Profile = {
  profile_id: string;
  username: string;
  email: string;
  completed_at: string | null;
};

function clearLegacyIdentity() {
  localStorage.removeItem("hockey_live_access_token");
  localStorage.removeItem("hockey_live_onboarded");
  localStorage.removeItem("hockey_live_username");
  localStorage.removeItem("hockey_live_interests");
}

export default function OnboardingApp() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [restoringSession, setRestoringSession] = useState(true);

  async function ensureProfile(): Promise<Profile | null> {
    const { data, error } = await supabase.rpc("ensure_my_hockey_profile");
    if (error) {
      setMessage(error.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  }

  useEffect(() => {
    let mounted = true;

    async function restoreExistingUser() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!data.session) {
        setRestoringSession(false);
        return;
      }

      clearLegacyIdentity();
      const profile = await ensureProfile();

      if (!mounted) return;

      if (profile?.completed_at) {
        window.location.replace("/live");
        return;
      }

      if (profile?.username) setUsername(profile.username);
      setStage("teams");
      setRestoringSession(false);
    }

    void restoreExistingUser();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (restoringSession) return;

    supabase
      .from("teams")
      .select("id,name,age_group,gender,club:clubs(name)")
      .eq("is_demo", false)
      .order("name")
      .then(({ data, error }) => {
        if (!error) setTeams((data ?? []) as Team[]);
      });
  }, [restoringSession]);

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

  const chosen = teams.filter((team) => selectedTeams.includes(team.id));

  function toggleTeam(id: string) {
    setSelectedTeams((current) =>
      current.includes(id)
        ? current.filter((teamId) => teamId !== id)
        : [...current, id]
    );
  }

  async function startSignup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: window.location.origin
      }
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    clearLegacyIdentity();

    if (!data.session) {
      setStage("check-email");
      setMessage(
        "Check your email to confirm your account. Then return to Hockey Live and log in."
      );
      return;
    }

    const profile = await ensureProfile();
    if (profile?.username) setUsername(profile.username);
    setStage("teams");
  }

  async function finishSignup() {
    if (!username.trim() || selectedTeams.length === 0) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase.rpc("complete_my_hockey_profile", {
      p_username: username.trim(),
      p_team_ids: selectedTeams
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    clearLegacyIdentity();
    window.location.href = "/live";
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    clearLegacyIdentity();

    const profile = await ensureProfile();
    if (!profile) return;

    if (profile.completed_at) {
      window.location.href = "/live";
      return;
    }

    if (profile.username) setUsername(profile.username);
    setStage("teams");
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStage("check-email");
    setMessage(
      `We sent a password reset link to ${forgotEmail.trim()}.`
    );
  }

  if (restoringSession) {
    return (
      <main className="accessCheck">
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Opening Hockey Live…</p>
      </main>
    );
  }

  return (
    <main className="onboardingShell">
      <header className="onboardingHeader">
        <a className="brand" href="/">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>
        {stage !== "welcome" && (
          <button
            className="welcomeBack"
            onClick={() => {
              setMessage("");
              setStage("welcome");
            }}
          >
            ← Back
          </button>
        )}
      </header>

      {stage === "welcome" && (
        <section className="onboardingWelcome">
          <div className="onboardingPitch">
            <p className="eyebrow">YOUR HOCKEY • ONE PLACE</p>
            <h1>Follow your team, not just the score.</h1>
            <p className="onboardingLead">
              Fixtures, results, league tables and live match updates for the
              hockey teams you care about.
            </p>

            <div className="onboardingActions">
              <button
                className="primaryButton onboardingPrimary"
                onClick={() => setStage("signup")}
              >
                Create account
              </button>
              <button
                className="secondaryButton onboardingSecondary"
                onClick={() => setStage("login")}
              >
                Log in
              </button>
            </div>

            <p className="onboardingSmall">
              Free to join. Email and password login.
            </p>
          </div>

          <div className="welcomeScoreCard">
            <div className="welcomeScoreTop">
              <span><span className="pulseDot" /> LIVE</span>
              <b>Q3 • 43&apos;</b>
            </div>
            <div className="welcomeTeamRow">
              <span>Beeston 2</span><strong>2</strong>
            </div>
            <div className="welcomeTeamRow">
              <span>Stourport 1</span><strong>1</strong>
            </div>
            <div className="welcomeTimeline">
              <span>GOAL</span>
              <div><b>Beeston score</b><small>39&apos; • Confirmed</small></div>
            </div>
            <div className="welcomeTimeline">
              <span>PC</span>
              <div><b>Penalty corner</b><small>36&apos; • Live update</small></div>
            </div>
          </div>
        </section>
      )}

      {stage === "signup" && (
        <section className="onboardingStage">
          <div className="onboardingCard">
            <div className="stepCount">1 of 2</div>
            <p className="eyebrow">JOIN HOCKEY LIVE</p>
            <h2>Create your account</h2>
            <p className="onboardingCardCopy">
              Choose a username, then use your email and password whenever you log in.
            </p>

            <form className="onboardingForm" onSubmit={startSignup}>
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a username"
                  autoComplete="nickname"
                  minLength={2}
                  maxLength={40}
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              {message && <div className="onboardingMessage">{message}</div>}

              <button className="primaryButton onboardingSubmit" disabled={busy}>
                {busy ? "Creating account…" : "Continue"}
              </button>
            </form>
          </div>
        </section>
      )}

      {stage === "teams" && (
        <section className="onboardingStage">
          <div className="onboardingCard teamOnboardingCard">
            <div className="stepCount">2 of 2</div>
            <p className="eyebrow">PERSONALISE YOUR FEED</p>
            <h2>Which teams are you interested in?</h2>
            <p className="onboardingCardCopy">
              Select as many as you like. You can change these later.
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

            <div className="teamPicker">
              <button
                className="teamPickerButton"
                type="button"
                onClick={() => setPickerOpen((open) => !open)}
              >
                <span>
                  {selectedTeams.length === 0
                    ? "Choose teams"
                    : `${selectedTeams.length} team${selectedTeams.length === 1 ? "" : "s"} selected`}
                </span>
                <span>{pickerOpen ? "▲" : "▼"}</span>
              </button>

              {pickerOpen && (
                <div className="teamPickerMenu">
                  <input
                    className="teamSearch"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search teams…"
                    autoFocus
                  />

                  <div className="teamOptions">
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
                </div>
              )}
            </div>

            {chosen.length > 0 && (
              <div className="selectedTeamChips">
                {chosen.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => toggleTeam(team.id)}
                    type="button"
                  >
                    {team.name} <span>×</span>
                  </button>
                ))}
              </div>
            )}

            {message && <div className="onboardingMessage">{message}</div>}

            <button
              className="primaryButton onboardingSubmit"
              onClick={finishSignup}
              disabled={busy || selectedTeams.length === 0 || username.trim().length < 2}
            >
              {busy ? "Saving…" : "Take me to Hockey Live"}
            </button>

            {selectedTeams.length === 0 && (
              <p className="teamRequired">Select at least one team to continue.</p>
            )}
          </div>
        </section>
      )}

      {stage === "login" && (
        <section className="onboardingStage">
          <div className="onboardingCard">
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Log in</h2>
            <p className="onboardingCardCopy">
              Use the email address and password for your Hockey Live account.
            </p>

            <form className="onboardingForm" onSubmit={login}>
              <label>
                Email
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button
                type="button"
                className="forgotPasswordButton"
                onClick={() => {
                  setForgotEmail(loginEmail);
                  setMessage("");
                  setStage("forgot");
                }}
              >
                Forgot password?
              </button>

              {message && <div className="onboardingMessage">{message}</div>}

              <button className="primaryButton onboardingSubmit" disabled={busy}>
                {busy ? "Logging in…" : "Log in"}
              </button>
            </form>

            <p className="privacyNote">
              Used Hockey Live before but never created a password? Choose
              <b> Forgot password</b> to set your first one.
            </p>
          </div>
        </section>
      )}

      {stage === "forgot" && (
        <section className="onboardingStage">
          <div className="onboardingCard">
            <p className="eyebrow">PASSWORD RESET</p>
            <h2>Reset your password</h2>
            <p className="onboardingCardCopy">
              We’ll email you a secure link to choose a new password.
            </p>

            <form className="onboardingForm" onSubmit={sendReset}>
              <label>
                Email
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              {message && <div className="onboardingMessage">{message}</div>}

              <button className="primaryButton onboardingSubmit" disabled={busy}>
                {busy ? "Sending…" : "Send reset email"}
              </button>
            </form>
          </div>
        </section>
      )}

      {stage === "check-email" && (
        <section className="onboardingStage">
          <div className="onboardingCard checkEmail">
            <span className="checkEmailIcon">✓</span>
            <p className="eyebrow">CHECK YOUR EMAIL</p>
            <h2>Email sent.</h2>
            <p className="onboardingCardCopy">{message}</p>
            <button
              className="secondaryButton"
              onClick={() => {
                setMessage("");
                setStage("login");
              }}
            >
              Back to log in
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
