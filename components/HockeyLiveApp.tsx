"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Side = "home" | "away" | null;
type Confidence = "Community" | "Confirmed" | "Official";
type EventKind =
  | "goal"
  | "short_corner"
  | "green_card"
  | "yellow_card"
  | "red_card"
  | "period_end"
  | "comment";

type MatchEvent = {
  id: string;
  kind: EventKind;
  side: Side;
  minute: number;
  text: string;
  confidence: Confidence;
  reportCount: number;
  isLate: boolean;
};

type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  period: string;
  minute: number;
  trust: Confidence;
  status: "scheduled" | "live" | "finished";
  competition: string;
  controllerProfileId: string | null;
  controllerUsername: string | null;
  controllerLastSeenAt: string | null;
  lastControllerUsername: string | null;
  clockSeconds: number;
  clockRunning: boolean;
  clockUpdatedAt: string;
};

const EVENT_META: Record<EventKind, { label: string; icon: string }> = {
  goal: { label: "Goal", icon: "GOAL" },
  short_corner: { label: "Short corner", icon: "SC" },
  green_card: { label: "Green card", icon: "GC" },
  yellow_card: { label: "Yellow card", icon: "YC" },
  red_card: { label: "Red card", icon: "RC" },
  period_end: { label: "Period end", icon: "Q" },
  comment: { label: "Comment", icon: "LIVE" }
};

function trustClass(level: string) {
  return level.toLowerCase();
}

function prettyTrust(value: string): Confidence {
  if (value === "official") return "Official";
  if (value === "confirmed") return "Confirmed";
  return "Community";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function controllerIsStale(match: Match, nowMs: number) {
  if (!match.controllerProfileId) return false;
  if (!match.controllerLastSeenAt) return true;
  return nowMs - new Date(match.controllerLastSeenAt).getTime() > 120000;
}

function sharedClockSeconds(match: Match, nowMs: number) {
  let seconds = match.clockSeconds ?? 0;

  if (match.clockRunning && match.clockUpdatedAt) {
    const updatedAt = new Date(match.clockUpdatedAt).getTime();
    let effectiveNow = nowMs;

    if (match.controllerLastSeenAt) {
      const staleCutoff =
        new Date(match.controllerLastSeenAt).getTime() + 120000;
      effectiveNow = Math.min(effectiveNow, staleCutoff);
    }

    seconds += Math.max(0, Math.floor((effectiveNow - updatedAt) / 1000));
  }

  return Math.max(0, Math.min(seconds, 10800));
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default function HockeyLiveApp() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [comment, setComment] = useState("");
  const [contributeOpen, setContributeOpen] = useState(false);
  const [matchFocusOpen, setMatchFocusOpen] = useState(false);
  const [controllerControlsOpen, setControllerControlsOpen] = useState(false);
  const [minuteDraft, setMinuteDraft] = useState(0);
  const [minuteEdited, setMinuteEdited] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const selected =
    matches.find((match) => match.id === selectedId) ?? matches[0];

  const selectedClock = selected
    ? sharedClockSeconds(selected, nowTick)
    : 0;

  const selectedControllerStale = selected
    ? controllerIsStale(selected, nowTick)
    : false;

  const iAmController = Boolean(
    selected &&
      myProfileId &&
      selected.controllerProfileId === myProfileId
  );

  const feed = useMemo(
    () => events.map((event) => ({ ...event, ...EVENT_META[event.kind] })),
    [events]
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function getAccessToken() {
    return localStorage.getItem("hockey_live_access_token");
  }

  function openMatchCentre(matchId: string) {
    setSelectedId(matchId);
    setMatchFocusOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("match", matchId);
    url.hash = "match";
    window.history.replaceState({}, "", url.toString());

    window.setTimeout(() => {
      document.getElementById("match")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  async function loadMyProfile() {
    const { data, error } = await supabase.rpc("get_my_hockey_profile", {
      p_access_token: getAccessToken() || null
    });

    if (error) return;

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.profile_id) {
      setMyProfileId(row.profile_id);
      setMyUsername(row.username ?? "");
    }
  }

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `id, home_score, away_score, period, minute, status, verification, competition,
         controller_profile_id, controller_username, controller_last_seen_at,
         last_controller_username, clock_seconds, clock_running, clock_updated_at,
         home_team:teams!matches_home_team_id_fkey(id,name),
         away_team:teams!matches_away_team_id_fkey(id,name)`
      )
      .order("created_at", { ascending: true });

    if (error) {
      setBackendError(error.message);
      setLoading(false);
      return;
    }

    const next: Match[] = (data ?? []).map((row: any) => ({
      id: row.id,
      homeTeamId: row.home_team?.id ?? "",
      awayTeamId: row.away_team?.id ?? "",
      home: row.home_team?.name ?? "Home",
      away: row.away_team?.name ?? "Away",
      homeScore: row.home_score ?? 0,
      awayScore: row.away_score ?? 0,
      period: row.period ?? "Q1",
      minute: row.minute ?? 0,
      trust: prettyTrust(row.verification),
      status: row.status,
      competition: row.competition ?? "Hockey match",
      controllerProfileId: row.controller_profile_id ?? null,
      controllerUsername: row.controller_username ?? null,
      controllerLastSeenAt: row.controller_last_seen_at ?? null,
      lastControllerUsername: row.last_controller_username ?? null,
      clockSeconds: row.clock_seconds ?? 0,
      clockRunning: Boolean(row.clock_running),
      clockUpdatedAt: row.clock_updated_at ?? new Date().toISOString()
    }));

    setMatches(next);

    const requestedMatch =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("match")
        : null;

    setSelectedId((current) =>
      requestedMatch && next.some((match) => match.id === requestedMatch)
        ? requestedMatch
        : current || next[0]?.id || ""
    );

    setBackendError("");
    setLoading(false);
  }

  async function loadEvents(matchId: string) {
    if (!matchId) return;

    const { data, error } = await supabase
      .from("match_events")
      .select(
        "id,event_type,team_id,minute,note,confidence,report_count,is_late,created_at"
      )
      .eq("match_id", matchId)
      .order("minute", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setBackendError(error.message);
      return;
    }

    const match = matches.find((item) => item.id === matchId);

    const next: MatchEvent[] = (data ?? []).map((row: any) => ({
      id: row.id,
      kind: row.event_type as EventKind,
      side:
        row.team_id && row.team_id === match?.homeTeamId
          ? "home"
          : row.team_id && row.team_id === match?.awayTeamId
            ? "away"
            : null,
      minute: row.minute ?? match?.minute ?? 0,
      text:
        row.note ??
        `${EVENT_META[row.event_type as EventKind]?.label ?? "Update"} reported`,
      confidence: prettyTrust(row.confidence),
      reportCount: row.report_count ?? 1,
      isLate: Boolean(row.is_late)
    }));

    setEvents(next);
  }

  useEffect(() => {
    void loadMyProfile();
    void loadMatches();

    const ticker = window.setInterval(() => setNowTick(Date.now()), 1000);

    const channel = supabase
      .channel("hockey-live-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => void loadMatches()
      )
      .subscribe();

    return () => {
      window.clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    void loadEvents(selectedId);

    const channel = supabase
      .channel(`hockey-live-events-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${selectedId}`
        },
        () => void loadEvents(selectedId)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, matches.length]);

  useEffect(() => {
    if (!selected) return;

    setMinuteEdited(false);
    setMinuteDraft(Math.floor(sharedClockSeconds(selected, Date.now()) / 60));

    const requestedMatch = new URLSearchParams(window.location.search).get("match");
    if (requestedMatch === selected.id) {
      setMatchFocusOpen(true);
      window.setTimeout(() => {
        document.getElementById("match")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 120);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || minuteEdited) return;
    setMinuteDraft(Math.floor(selectedClock / 60));
  }, [selectedClock, selected?.id, minuteEdited]);

  useEffect(() => {
    if (!matchFocusOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [matchFocusOpen]);

  useEffect(() => {
    if (!selected || !myProfileId) return;
    if (selected.controllerProfileId !== myProfileId) return;

    async function heartbeat() {
      await supabase.rpc("heartbeat_match_control", {
        p_access_token: getAccessToken() || null,
        p_match_id: selected.id
      });
    }

    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 45000);

    return () => window.clearInterval(timer);
  }, [selected?.id, selected?.controllerProfileId, myProfileId]);

  async function claimControl() {
    if (!selected) return;

    const wasStale = selectedControllerStale;
    const { error } = await supabase.rpc("claim_match_control", {
      p_access_token: getAccessToken() || null,
      p_match_id: selected.id
    });

    if (error) {
      announce(error.message);
      return;
    }

    await loadMatches();
    announce(
      wasStale
        ? "You’ve taken over the shared match clock"
        : "You’re now the Match Controller"
    );
  }

  async function releaseControl() {
    if (!selected) return;

    const { error } = await supabase.rpc("release_match_control", {
      p_access_token: getAccessToken() || null,
      p_match_id: selected.id
    });

    if (error) {
      announce(error.message);
      return;
    }

    await loadMatches();
    announce("Match control released");
  }

  async function controlClock(
    action: "start" | "resume" | "pause" | "next_period" | "set",
    seconds?: number
  ) {
    if (!selected) return;

    const { error } = await supabase.rpc("control_match_clock", {
      p_access_token: getAccessToken() || null,
      p_match_id: selected.id,
      p_action: action,
      p_period: null,
      p_seconds: seconds ?? null
    });

    if (error) {
      announce(error.message);
      return;
    }

    await loadMatches();

    if (action === "next_period") {
      announce(selected.period === "Q4" ? "Match finished" : "Period advanced");
    } else if (action === "pause") {
      announce("Shared clock paused");
    } else if (action === "set") {
      announce("Shared clock corrected");
    } else {
      announce("Shared clock running");
    }
  }

  async function submitReport(kind: EventKind, side: Side, text?: string) {
    if (!selected) return;

    const teamId =
      side === "home"
        ? selected.homeTeamId
        : side === "away"
          ? selected.awayTeamId
          : null;

    let note = text?.trim() || null;

    if (!note && kind !== "comment") {
      const teamName =
        side === "home"
          ? selected.home
          : side === "away"
            ? selected.away
            : "Match";
      note = `${EVENT_META[kind].label} reported: ${teamName}`;
    }

    const { data, error } = await supabase.rpc("submit_match_report", {
      p_access_token: getAccessToken() || null,
      p_match_id: selected.id,
      p_event_type: kind,
      p_team_id: teamId,
      p_minute: minuteDraft,
      p_note: note,
      p_pin: null
    });

    if (error) {
      announce(error.message);
      return;
    }

    setComment("");
    setMinuteEdited(false);

    await Promise.all([loadMatches(), loadEvents(selected.id)]);

    const returned = Array.isArray(data) ? data[0] : data;
    const count = returned?.report_count ?? 1;
    const confidence = returned?.confidence ?? "community";

    if (kind === "comment") {
      announce("Comment added");
    } else if (confidence === "confirmed" || count >= 2) {
      announce("Report Confirmed");
    } else {
      announce("Community report added");
    }
  }

  function downloadShareGraphic() {
    if (!selected) return;

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
    gradient.addColorStop(0, "#07131f");
    gradient.addColorStop(1, "#0a2540");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    ctx.fillStyle = "#18e28b";
    ctx.font = "700 46px Arial";
    ctx.fillText("HOCKEY LIVE", 80, 110);

    ctx.fillStyle = "#94a9bc";
    ctx.font = "600 32px Arial";
    ctx.fillText(
      selected.period === "FT" ? "FULL TIME" : "LIVE SCORE",
      80,
      180
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 58px Arial";
    ctx.fillText(selected.home, 80, 360);
    ctx.fillText(selected.away, 80, 620);

    ctx.textAlign = "right";
    ctx.font = "800 150px Arial";
    ctx.fillText(String(selected.homeScore), 990, 380);
    ctx.fillText(String(selected.awayScore), 990, 640);

    ctx.textAlign = "left";
    ctx.fillStyle = "#18e28b";
    ctx.font = "700 32px Arial";
    ctx.fillText(
      `${selected.period} • ${formatClock(selectedClock)}`,
      80,
      760
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 28px Arial";
    ctx.fillText("Powered by Hockey Live", 80, 965);

    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, 980, 980);

    const link = document.createElement("a");
    link.download = "hockey-live-score.png";
    link.href = canvas.toDataURL("image/png");
    link.click();

    announce("Share graphic created");
  }

  if (loading) {
    return (
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">HOCKEY LIVE</p>
            <h1>Loading live scores…</h1>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Hockey Live home">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </a>

        <nav>
          <a href="#live">Live</a>
          <a href="#match">Scores</a>
          <a href="#how">How it works</a>
        </nav>

        <a className="ghostButton" href="/create">Create match</a>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">FIELD HOCKEY • LIVE</p>
          <h1>Every match can be live.</h1>
          <p className="heroCopy">
            Community-powered scores and match updates. One Match Controller keeps
            the shared clock moving while everyone at the game can report what they see.
          </p>

          <div className="heroActions">
            <a className="primaryButton" href="#live">See live scores</a>
            <a className="secondaryButton" href="/create">Create a match</a>
          </div>

          {backendError && (
            <p className="heroCopy">Backend warning: {backendError}</p>
          )}
        </div>

        <div className="heroPanel">
          <span className="pulseDot" />
          <strong>LIVE NOW</strong>
          <p>
            {matches.filter((match) => match.status === "live").length} matches
            reporting live
          </p>

          {selected && (
            <div className="miniScore">
              <span>{selected.home}</span><b>{selected.homeScore}</b>
              <span>{selected.away}</span><b>{selected.awayScore}</b>
            </div>
          )}
        </div>
      </section>

      <section className="section" id="live">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">LIVE FEED</p>
            <h2>Matches happening now</h2>
          </div>
          <span className="demoPill">Community powered</span>
        </div>

        <div className="matchGrid">
          {matches.map((match) => {
            const clock = sharedClockSeconds(match, nowTick);
            return (
              <button
                key={match.id}
                className={`matchCard ${match.id === selectedId ? "selected" : ""}`}
                onClick={() => openMatchCentre(match.id)}
              >
                <div className="matchMeta">
                  <span>
                    {match.status === "scheduled"
                      ? "Scheduled"
                      : match.period === "FT"
                        ? "Finished"
                        : `${match.period} • ${formatClock(clock)}`}
                  </span>
                  <span className={`trust ${trustClass(match.trust)}`}>
                    {match.trust}
                  </span>
                </div>

                <div className="teamRow">
                  <span>{match.home}</span><b>{match.homeScore}</b>
                </div>
                <div className="teamRow">
                  <span>{match.away}</span><b>{match.awayScore}</b>
                </div>

                <div className="cardFooter">
                  {match.controllerUsername
                    ? `Controlled by @${match.controllerUsername}`
                    : "Open match centre"}{" "}
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <section
          className={`section matchCentre ${matchFocusOpen ? "matchFocusOpen" : ""}`}
          id="match"
        >
          <button
            className="matchFocusClose"
            onClick={() => {
              setMatchFocusOpen(false);
              setContributeOpen(false);
              setControllerControlsOpen(false);
            }}
          >
            ‹ Scores
          </button>

          <div className="scoreboard">
            <div className="scoreTopline">
              <span className="liveTag">
                <span className="pulseDot" />
                {selected.status === "scheduled"
                  ? "SCHEDULED"
                  : selected.period === "FT"
                    ? "FULL TIME"
                    : "LIVE"}
              </span>

              <span className={`trust ${trustClass(selected.trust)}`}>
                {selected.trust}
              </span>
            </div>

            <p className="competition">{selected.competition}</p>

            <div className="bigScore">
              <div>
                <span className="teamBadge">{initials(selected.home)}</span>
                <h3>{selected.home}</h3>
              </div>

              <strong>
                {selected.homeScore}<i>–</i>{selected.awayScore}
              </strong>

              <div>
                <span className="teamBadge alt">{initials(selected.away)}</span>
                <h3>{selected.away}</h3>
              </div>
            </div>

            <div className="sharedClock">
              <span>{selected.period}</span>
              <strong>{formatClock(selectedClock)}</strong>
              <small>
                {selected.clockRunning && !selectedControllerStale
                  ? "Shared live clock"
                  : selectedControllerStale
                    ? "Clock frozen — controller inactive"
                    : selected.status === "finished"
                      ? "Final match time"
                      : "Clock paused"}
              </small>
            </div>

            <div className="controllerStrip">
              {selected.status === "finished" ? (
                <div>
                  <span className="controllerBadge">MATCH CONTROLLER</span>
                  <b>
                    {selected.lastControllerUsername
                      ? `@${selected.lastControllerUsername}`
                      : "No controller recorded"}
                  </b>
                </div>
              ) : iAmController ? (
                <div className="controllerIdentity">
                  <span className="controllerBadge active">YOU’RE CONTROLLING</span>
                  <b>@{myUsername || selected.controllerUsername}</b>
                  <button
                    className="controllerMiniButton"
                    onClick={() => setControllerControlsOpen(true)}
                  >
                    Clock controls
                  </button>
                </div>
              ) : selected.controllerProfileId && !selectedControllerStale ? (
                <div>
                  <span className="controllerBadge">MATCH CONTROLLER</span>
                  <b>@{selected.controllerUsername}</b>
                </div>
              ) : (
                <div>
                  <span className="controllerBadge available">
                    {selectedControllerStale ? "CONTROLLER INACTIVE" : "NO CONTROLLER"}
                  </span>
                  <b>
                    {selectedControllerStale
                      ? `@${selected.controllerUsername} stopped responding`
                      : "Be the person who keeps everyone live"}
                  </b>
                </div>
              )}

              {selected.status !== "finished" &&
                !iAmController &&
                (!selected.controllerProfileId || selectedControllerStale) && (
                  <button className="controllerClaimButton" onClick={claimControl}>
                    {selectedControllerStale
                      ? "Take over Match Control"
                      : "Claim Match Controller"}
                  </button>
                )}
            </div>

            {iAmController &&
              selected.status !== "finished" &&
              (!matchFocusOpen || controllerControlsOpen) && (
              <div className={`controllerPanel ${matchFocusOpen ? "controllerOverlay" : ""}`}>
                {matchFocusOpen && (
                  <button
                    className="overlayClose"
                    onClick={() => setControllerControlsOpen(false)}
                  >
                    Done
                  </button>
                )}
                <div className="controllerPanelHeader">
                  <div>
                    <p className="eyebrow">MATCH CONTROLLER</p>
                    <h3>Keep the shared clock accurate</h3>
                  </div>
                  <span className="controllerLiveDot">● Active</span>
                </div>

                <div className="controllerClockActions">
                  <button
                    className="primaryButton"
                    onClick={() =>
                      controlClock(selected.clockRunning ? "pause" : "start")
                    }
                  >
                    {selected.clockRunning
                      ? "Pause clock"
                      : selected.status === "scheduled"
                        ? "Start match"
                        : "Resume clock"}
                  </button>

                  <button
                    className="secondaryButton"
                    onClick={() => controlClock("next_period")}
                  >
                    {selected.period === "Q4" ? "Full time" : "End quarter"}
                  </button>
                </div>

                <div className="clockCorrection">
                  <span>Quick correction</span>
                  <button
                    onClick={() =>
                      controlClock("set", Math.max(0, selectedClock - 10))
                    }
                  >
                    −10 sec
                  </button>
                  <button
                    onClick={() =>
                      controlClock("set", Math.min(10800, selectedClock + 10))
                    }
                  >
                    +10 sec
                  </button>
                </div>

                <button className="releaseControlButton" onClick={releaseControl}>
                  Hand back Match Control
                </button>
              </div>
            )}

            {selected.status !== "finished" && (
              <div className="matchQuickActions">
                <div className="quickActionHeading">
                  <div>
                    <p className="eyebrow">QUICK ACTIONS</p>
                    <h3>What just happened?</h3>
                  </div>
                  <span>{minuteDraft}&apos;</span>
                </div>

                <div className="quickGoalGrid">
                  <button
                    className="quickGoalButton"
                    onClick={() => submitReport("goal", "home")}
                  >
                    <span>+ GOAL</span>
                    <b>{selected.home}</b>
                  </button>

                  <button
                    className="quickGoalButton"
                    onClick={() => submitReport("goal", "away")}
                  >
                    <span>+ GOAL</span>
                    <b>{selected.away}</b>
                  </button>
                </div>

                <div className="quickSecondaryGrid">
                  <button
                    className="quickEventButton"
                    onClick={() => setContributeOpen((value) => !value)}
                  >
                    {contributeOpen ? "Close event panel" : "Report card / corner / event"}
                  </button>

                  <button
                    className="quickShareButton"
                    onClick={downloadShareGraphic}
                  >
                    Share score
                  </button>
                </div>

                <div className="quickCommentBox">
                  <input
                    placeholder="Comment on the match…"
                    value={comment}
                    maxLength={500}
                    onChange={(event) => setComment(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && comment.trim()) {
                        void submitReport("comment", null, comment);
                      }
                    }}
                  />
                  <button
                    disabled={!comment.trim()}
                    onClick={() => submitReport("comment", null, comment)}
                  >
                    Comment
                  </button>
                </div>

                <small className="quickActionNote">
                  Goal reports update the score and timeline together.
                </small>
              </div>
            )}

            {selected.status === "finished" && (
              <div className="scoreActions">
                <button className="secondaryButton" onClick={downloadShareGraphic}>
                  Create share graphic
                </button>
              </div>
            )}
          </div>

          {contributeOpen && (
            <div className={`scorerPanel communityPanel ${matchFocusOpen ? "eventOverlay" : ""}`}>
              {matchFocusOpen && (
                <button
                  className="overlayClose"
                  onClick={() => setContributeOpen(false)}
                >
                  Done
                </button>
              )}
              <div className="scorerHeader">
                <div>
                  <p className="eyebrow">COMMUNITY REPORTING</p>
                  <h3>What just happened?</h3>
                </div>
                <span className="demoPill">Waze-style reports</span>
              </div>

              <p className="communityExplainer">
                Anyone signed up to Hockey Live can report an event. Matching reports
                are merged, not counted twice. Reports from the active Match Controller
                are automatically Confirmed.
              </p>

              <div className="communityMinute">
                <label>
                  Match minute
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={minuteDraft}
                    onChange={(event) => {
                      setMinuteEdited(true);
                      setMinuteDraft(Number(event.target.value));
                    }}
                  />
                </label>
                <small>
                  This follows the shared clock automatically. Change it only if you’re
                  reporting something that happened earlier.
                </small>
              </div>

              <div className="scorerTeams">
                {(["home", "away"] as const).map((side) => (
                  <div key={side}>
                    <b>{side === "home" ? selected.home : selected.away}</b>
                    <button onClick={() => submitReport("goal", side)}>Goal</button>
                    <button onClick={() => submitReport("short_corner", side)}>Short corner</button>
                    <button onClick={() => submitReport("green_card", side)}>Green card</button>
                    <button onClick={() => submitReport("yellow_card", side)}>Yellow card</button>
                    <button onClick={() => submitReport("red_card", side)}>Red card</button>
                  </div>
                ))}
              </div>

              <button
                className="periodButton"
                onClick={() =>
                  submitReport("period_end", null, "Period end reported")
                }
              >
                Report end of period
              </button>

              <div className="commentBox communityComment">
                <input
                  placeholder="Comment on the match…"
                  value={comment}
                  maxLength={500}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && comment.trim()) {
                      void submitReport("comment", null, comment);
                    }
                  }}
                />
                <button
                  disabled={!comment.trim()}
                  onClick={() => submitReport("comment", null, comment)}
                >
                  Post
                </button>
              </div>
            </div>
          )}

          <div className="timelinePanel">
            <div className="sectionHeading compact">
              <div>
                <p className="eyebrow">MATCH TIMELINE</p>
                <h3>What the crowd is reporting</h3>
              </div>
            </div>

            <div className="timeline">
              {feed.length === 0 && (
                <p className="heroCopy">No timeline events yet.</p>
              )}

              {feed.map((event) => (
                <article key={event.id} className="eventRow">
                  <span className={`eventIcon ${event.kind}`}>{event.icon}</span>

                  <div>
                    <div className="eventMeta">
                      <b>{event.label}</b>
                      <span>{event.minute}'</span>
                    </div>

                    <p>{event.text}</p>

                    <div className="eventConfidenceRow">
                      <span className={`trust ${trustClass(event.confidence)}`}>
                        {event.confidence}
                      </span>

                      {event.kind !== "comment" && event.reportCount > 1 && (
                        <span className="reportCount">
                          {event.reportCount} independent reports
                        </span>
                      )}

                      {event.isLate && (
                        <span className="lateReport">Reported late</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section trustSection" id="how">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">WAZE FOR HOCKEY</p>
            <h2>One shared clock. A crowd of witnesses.</h2>
          </div>
        </div>

        <div className="trustGrid">
          <article>
            <span className="trust community">Community</span>
            <h3>Anyone can report</h3>
            <p>
              Signed-up supporters report goals, cards, corners and comments from
              the sideline.
            </p>
          </article>

          <article>
            <span className="trust confirmed">Confirmed</span>
            <h3>Cross-checked</h3>
            <p>
              A second independent report matches the first, or the active Match
              Controller reports it.
            </p>
          </article>

          <article>
            <span className="controllerBadge active">Match Controller</span>
            <h3>Keep everyone in time</h3>
            <p>
              One volunteer at the ground runs the shared clock. If they disappear,
              another attendee can take over.
            </p>
          </article>
        </div>
      </section>

      <footer>
        <div className="brand">
          <span className="brandMark">HL</span>
          <span>Hockey Live</span>
        </div>
        <p>Built to make grassroots hockey visible.</p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
