"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Stage = "welcome" | "signup" | "teams" | "login" | "check-email";

type Team = {
  id: string;
  name: string;
  age_group: string | null;
  gender: string | null;
  club?: { name?: string | null } | null;
};

export default function OnboardingApp() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase
      .from("teams")
      .select("id,name,age_group,gender,club:clubs(name)")
      .order("name")
      .then(({ data, error }) => {
        if (!error) setTeams((data ?? []) as Team[]);
      });
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

    const { data, error } = await supabase.rpc("begin_onboarding", {
      p_username: username.trim(),
      p_email: email.trim()
    });

    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.access_token) {
      setBusy(false);
      setMessage("We couldn't start your account. Please try again.");
      return;
    }

    setAccessToken(row.access_token);
    localStorage.setItem("hockey_live_username", username.trim());

    // Send a one-tap sign-in link for future access, but do not make
    // email verification a blocker for onboarding.
    void supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/live`
      }
    });

    setBusy(false);
    setStage("teams");
  }

  async function finishSignup() {
    if (!accessToken) return;
    setBusy(true);
    setMessage("");

    const { error } = await supabase.rpc("finish_onboarding", {
      p_access_token: accessToken,
      p_team_ids: selectedTeams
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    localStorage.setItem("hockey_live_onboarded", "1");
    localStorage.setItem("hockey_live_interests", JSON.stringify(selectedTeams));
    window.location.href = "/live";
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/live`
      }
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStage("check-email");
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
            <p className="eyebrow">FIELD HOCKEY • LIVE</p>
            <h1>Every match can be live.</h1>
            <p className="onboardingLead">
              Live scores, match updates and grassroots hockey — all in one place.
            </p>

            <div className="onboardingActions">
              <button className="primaryButton onboardingPrimary" onClick={() => setStage("signup")}>
                Get started
              </button>
              <button className="secondaryButton onboardingSecondary" onClick={() => setStage("login")}>
                Log in
              </button>
            </div>

            <p className="onboardingSmall">
              Free to join. It takes about 20 seconds.
            </p>
          </div>

          <div className="welcomeScoreCard">
            <div className="welcomeScoreTop">
              <span><span className="pulseDot" /> LIVE</span>
              <b>Q3 • 43&apos;</b>
            </div>
            <div className="welcomeTeamRow">
              <span>Beeston 2s</span><strong>2</strong>
            </div>
            <div className="welcomeTeamRow">
              <span>Nottingham 2s</span><strong>1</strong>
            </div>
            <div className="welcomeTimeline">
              <span>GOAL</span>
              <div><b>Beeston score</b><small>39&apos; • Confirmed</small></div>
            </div>
            <div className="welcomeTimeline">
              <span>SC</span>
              <div><b>Short corner Nottingham</b><small>36&apos; • Live update</small></div>
            </div>
          </div>
        </section>
      )}

      {stage === "signup" && (
        <section className="onboardingStage">
          <div className="onboardingCard">
            <div className="stepCount">1 of 2</div>
            <p className="eyebrow">JOIN HOCKEY LIVE</p>
            <h2>Create your profile</h2>
            <p className="onboardingCardCopy">
              Just a username and email to get started.
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

              {message && <div className="onboardingMessage">{message}</div>}

              <button className="primaryButton onboardingSubmit" disabled={busy}>
                {busy ? "Creating profile…" : "Continue"}
              </button>
            </form>

            <p className="privacyNote">
              We use your email for account access and Hockey Live service messages.
              Marketing preferences can be chosen separately later.
            </p>
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
              Select as many as you like. We&apos;ll use these to shape your Hockey Live feed.
            </p>

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
                  <button key={team.id} onClick={() => toggleTeam(team.id)} type="button">
                    {team.name} <span>×</span>
                  </button>
                ))}
              </div>
            )}

            {message && <div className="onboardingMessage">{message}</div>}

            <button
              className="primaryButton onboardingSubmit"
              onClick={finishSignup}
              disabled={busy || selectedTeams.length === 0}
            >
              {busy ? "Saving…" : "Take me to Hockey Live"}
            </button>

            {selectedTeams.length === 0 && (
              <p className="teamRequired">Select at least one team to continue.</p>
            )}

            <p className="privacyNote">
              We&apos;ve also sent a secure sign-in link to your email so you can access
              the same account on another device later.
            </p>
          </div>
        </section>
      )}

      {stage === "login" && (
        <section className="onboardingStage">
          <div className="onboardingCard">
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Log in</h2>
            <p className="onboardingCardCopy">
              Enter your email and we&apos;ll send you a secure one-tap sign-in link.
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

              {message && <div className="onboardingMessage">{message}</div>}

              <button className="primaryButton onboardingSubmit" disabled={busy}>
                {busy ? "Sending link…" : "Send login link"}
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
            <h2>Your login link is on its way.</h2>
            <p className="onboardingCardCopy">
              Tap the secure link we sent to <b>{loginEmail}</b> and you&apos;ll go straight
              into Hockey Live.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
