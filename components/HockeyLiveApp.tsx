"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Side = "home" | "away" | null;
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
  trust: "Community" | "Confirmed" | "Official";
  status: "scheduled" | "live" | "finished";
  competition: string;
};

const EVENT_META: Record<EventKind, { label: string; icon: string }> = {
  goal: { label: "Goal", icon: "GOAL" },
  short_corner: { label: "Short corner", icon: "SC" },
  green_card: { label: "Green card", icon: "GC" },
  yellow_card: { label: "Yellow card", icon: "YC" },
  red_card: { label: "Red card", icon: "RC" },
  period_end: { label: "Period end", icon: "Q" },
  comment: { label: "Update", icon: "LIVE" }
};

function trustClass(level: string) {
  return level.toLowerCase();
}

function prettyTrust(value: string): Match["trust"] {
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

export default function HockeyLiveApp() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [comment, setComment] = useState("");
  const [scorerMode, setScorerMode] = useState(false);
  const [scorerPin, setScorerPin] = useState("");
  const [minuteDraft, setMinuteDraft] = useState(0);
  const [periodDraft, setPeriodDraft] = useState("Q1");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");

  const selected = matches.find((match) => match.id === selectedId) ?? matches[0];

  const feed = useMemo(
    () => events.map((event) => ({ ...event, ...EVENT_META[event.kind] })),
    [events]
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `id, home_score, away_score, period, minute, status, verification, competition,
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
      competition: row.competition ?? "Hockey match"
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
      .select("id,event_type,team_id,minute,note,created_at")
      .eq("match_id", matchId)
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
      text: row.note ?? EVENT_META[row.event_type as EventKind]?.label ?? "Match update"
    }));

    setEvents(next);
  }

  useEffect(() => {
    loadMatches();

    const channel = supabase
      .channel("hockey-live-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    loadEvents(selectedId);

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
        () => loadEvents(selectedId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, matches.length]);

  useEffect(() => {
    if (!selected) return;
    setMinuteDraft(selected.minute);
    setPeriodDraft(selected.period);

    const savedPin = localStorage.getItem(`hockey_live_scorer_pin_${selected.id}`);
    if (savedPin) {
      setScorerPin(savedPin);
      const requestedMatch = new URLSearchParams(window.location.search).get("match");
      if (requestedMatch === selected.id) setScorerMode(true);
    } else {
      setScorerPin("");
    }
  }, [selected?.id, selected?.minute, selected?.period]);

  async function saveClock(period = periodDraft, minute = minuteDraft) {
    if (!selected) return false;
    if (!scorerPin.trim()) {
      announce("Enter the scorer PIN first");
      return false;
    }

    const { error } = await supabase.rpc("update_match_clock", {
      p_match_id: selected.id,
      p_pin: scorerPin.trim(),
      p_period: period,
      p_minute: minute
    });

    if (error) {
      announce(error.message.includes("Invalid scorer PIN") ? "Incorrect scorer PIN" : error.message);
      return false;
    }

    await loadMatches();
    announce("Match clock saved");
    return true;
  }

  async function addEvent(kind: EventKind, side: Side, text?: string) {
    if (!selected) return;
    if (!scorerPin.trim()) {
      announce("Enter the scorer PIN first");
      return;
    }

    const teamId =
      side === "home"
        ? selected.homeTeamId
        : side === "away"
          ? selected.awayTeamId
          : null;

    let nextText = text?.trim() || `${EVENT_META[kind].label}: ${side === "home" ? selected.home : side === "away" ? selected.away : "Match"}`;

    if (kind === "goal") {
      const predictedHome = selected.homeScore + (side === "home" ? 1 : 0);
      const predictedAway = selected.awayScore + (side === "away" ? 1 : 0);
      nextText = `${side === "home" ? selected.home : selected.away} score. ${predictedHome}–${predictedAway}.`;
    }

    const { error } = await supabase.rpc("record_match_event", {
      p_match_id: selected.id,
      p_pin: scorerPin.trim(),
      p_event_type: kind,
      p_team_id: teamId,
      p_minute: minuteDraft,
      p_note: nextText
    });

    if (error) {
      announce(error.message.includes("Invalid scorer PIN") ? "Incorrect scorer PIN" : error.message);
      return;
    }

    setComment("");
    await Promise.all([loadMatches(), loadEvents(selected.id)]);
    announce(`${EVENT_META[kind].label} added live`);
  }

  async function advancePeriod() {
    if (!selected) return;
    const order = ["Q1", "Q2", "Q3", "Q4", "FT"];
    const index = Math.max(0, order.indexOf(periodDraft));
    const next = order[Math.min(index + 1, order.length - 1)];

    const saved = await saveClock(next, minuteDraft);
    if (!saved) return;

    await addEvent(
      "period_end",
      null,
      next === "FT" ? "Full time." : `${periodDraft} ended. ${next} begins.`
    );
    setPeriodDraft(next);
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
    ctx.fillText(selected.period === "FT" ? "FULL TIME" : "LIVE SCORE", 80, 180);

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
    ctx.fillText(`${selected.period} • ${selected.minute}'`, 80, 760);

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
    return <main><section className="hero"><div><p className="eyebrow">HOCKEY LIVE</p><h1>Loading live scores…</h1></div></section></main>;
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
        <a className="ghostButton" href="/create">
          Create match
        </a>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">FIELD HOCKEY • LIVE</p>
          <h1>Every match can be live.</h1>
          <p className="heroCopy">
            Community-powered scores and match updates for the hockey games that normally never get live coverage.
          </p>
          <div className="heroActions">
            <a className="primaryButton" href="#live">See live scores</a>
            <a className="secondaryButton" href="/create">Create a match</a>
          </div>
          {backendError && <p className="heroCopy">Backend warning: {backendError}</p>}
        </div>

        <div className="heroPanel">
          <span className="pulseDot" />
          <strong>LIVE NOW</strong>
          <p>{matches.filter((match) => match.status === "live").length} matches reporting from Supabase</p>
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
          <div><p className="eyebrow">LIVE FEED</p><h2>Matches happening now</h2></div>
          <span className="demoPill">Realtime backend</span>
        </div>

        <div className="matchGrid">
          {matches.map((match) => (
            <button
              key={match.id}
              className={`matchCard ${match.id === selectedId ? "selected" : ""}`}
              onClick={() => setSelectedId(match.id)}
            >
              <div className="matchMeta">
                <span>
                  {match.status === "scheduled"
                    ? "Scheduled"
                    : match.period === "FT"
                      ? "Finished"
                      : `${match.period} • ${match.minute}'`}
                </span>
                <span className={`trust ${trustClass(match.trust)}`}>{match.trust}</span>
              </div>
              <div className="teamRow"><span>{match.home}</span><b>{match.homeScore}</b></div>
              <div className="teamRow"><span>{match.away}</span><b>{match.awayScore}</b></div>
              <div className="cardFooter">Open match centre <span>→</span></div>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="section matchCentre" id="match">
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
              <span className={`trust ${trustClass(selected.trust)}`}>{selected.trust}</span>
            </div>
            <p className="competition">{selected.competition}</p>
            <div className="bigScore">
              <div><span className="teamBadge">{initials(selected.home)}</span><h3>{selected.home}</h3></div>
              <strong>{selected.homeScore}<i>–</i>{selected.awayScore}</strong>
              <div><span className="teamBadge alt">{initials(selected.away)}</span><h3>{selected.away}</h3></div>
            </div>
            <div className="clock"><b>{selected.period}</b><span>{selected.minute}'</span></div>
            <div className="scoreActions">
              <button className="primaryButton" onClick={downloadShareGraphic}>Create share graphic</button>
              <button className="secondaryButton" onClick={() => setScorerMode((value) => !value)}>
                {scorerMode ? "Close scorer" : "Update match"}
              </button>
            </div>
          </div>

          {scorerMode && (
            <div className="scorerPanel">
              <div className="scorerHeader">
                <div><p className="eyebrow">SCORER MODE</p><h3>Fast live updates</h3></div>
                <span className="demoPill">Writes to Supabase</span>
              </div>

              <div className="commentBox">
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="Scorer PIN"
                  value={scorerPin}
                  onChange={(event) => setScorerPin(event.target.value)}
                />
                <button onClick={() => announce(scorerPin ? "PIN entered" : "Enter your scorer PIN")}>Unlock</button>
              </div>

              <div className="timeControls">
                <label>
                  Minute
                  <input type="number" min="0" max="90" value={minuteDraft} onChange={(event) => setMinuteDraft(Number(event.target.value))} />
                </label>
                <label>
                  Period
                  <select value={periodDraft} onChange={(event) => setPeriodDraft(event.target.value)}>
                    <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>FT</option>
                  </select>
                </label>
              </div>

              <button className="periodButton" onClick={() => saveClock()}>Save clock</button>

              <div className="scorerTeams">
                {(["home", "away"] as const).map((side) => (
                  <div key={side}>
                    <b>{side === "home" ? selected.home : selected.away}</b>
                    <button onClick={() => addEvent("goal", side)}>+ Goal</button>
                    <button onClick={() => addEvent("short_corner", side)}>+ Short corner</button>
                    <button onClick={() => addEvent("green_card", side)}>+ Green card</button>
                    <button onClick={() => addEvent("yellow_card", side)}>+ Yellow card</button>
                    <button onClick={() => addEvent("red_card", side)}>+ Red card</button>
                  </div>
                ))}
              </div>

              <div className="commentBox">
                <input
                  placeholder="Add a free-text update…"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addEvent("comment", null, comment)}
                />
                <button onClick={() => addEvent("comment", null, comment)}>Post</button>
              </div>
              <button className="periodButton" onClick={advancePeriod}>End period / advance</button>
            </div>
          )}

          <div className="timelinePanel">
            <div className="sectionHeading compact">
              <div><p className="eyebrow">MATCH TIMELINE</p><h3>Latest updates</h3></div>
            </div>
            <div className="timeline">
              {feed.length === 0 && <p className="heroCopy">No timeline events yet.</p>}
              {feed.map((event) => (
                <article key={event.id} className="eventRow">
                  <span className={`eventIcon ${event.kind}`}>{event.icon}</span>
                  <div>
                    <div className="eventMeta"><b>{event.label}</b><span>{event.minute}'</span></div>
                    <p>{event.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section trustSection" id="how">
        <div className="sectionHeading">
          <div><p className="eyebrow">TRUST MODEL</p><h2>Simple confidence levels</h2></div>
        </div>
        <div className="trustGrid">
          <article><span className="trust community">Community</span><h3>One scorer</h3><p>A supporter or volunteer is reporting the match live.</p></article>
          <article><span className="trust confirmed">Confirmed</span><h3>Cross-checked</h3><p>Updates have been corroborated by another trusted source.</p></article>
          <article><span className="trust official">Official</span><h3>Club verified</h3><p>The reporting account is verified as the club or competition.</p></article>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="brandMark">HL</span><span>Hockey Live</span></div>
        <p>Built to make grassroots hockey visible.</p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
