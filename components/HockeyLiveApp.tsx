"use client";

import { useMemo, useState } from "react";

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
  id: number;
  kind: EventKind;
  side: Side;
  minute: number;
  text: string;
};

type Match = {
  id: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  period: string;
  minute: number;
  trust: "Community" | "Confirmed" | "Official";
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

const demoMatches: Match[] = [
  {
    id: 1,
    home: "Beeston 2s",
    away: "Nottingham 2s",
    homeScore: 2,
    awayScore: 1,
    period: "Q3",
    minute: 43,
    trust: "Confirmed"
  },
  {
    id: 2,
    home: "Leeds 1s",
    away: "Wakefield 1s",
    homeScore: 1,
    awayScore: 1,
    period: "Q4",
    minute: 58,
    trust: "Community"
  },
  {
    id: 3,
    home: "Repton U16",
    away: "Belper U16",
    homeScore: 3,
    awayScore: 2,
    period: "FT",
    minute: 70,
    trust: "Official"
  }
];

const initialEvents: MatchEvent[] = [
  { id: 1, kind: "goal", side: "home", minute: 39, text: "Beeston 2s score to make it 2–1." },
  { id: 2, kind: "short_corner", side: "away", minute: 36, text: "Short corner to Nottingham 2s." },
  { id: 3, kind: "period_end", side: null, minute: 35, text: "Half-time. The score is 1–1." },
  { id: 4, kind: "goal", side: "away", minute: 23, text: "Nottingham 2s equalise." },
  { id: 5, kind: "goal", side: "home", minute: 12, text: "Beeston 2s open the scoring." }
];

function trustClass(level: string) {
  return level.toLowerCase();
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
  const [selectedId, setSelectedId] = useState(1);
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [minute, setMinute] = useState(43);
  const [period, setPeriod] = useState("Q3");
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);
  const [comment, setComment] = useState("");
  const [scorerMode, setScorerMode] = useState(false);
  const [toast, setToast] = useState("");

  const selected = demoMatches.find((match) => match.id === selectedId) ?? demoMatches[0];
  const feed = useMemo(
    () => events.map((event) => ({ ...event, ...EVENT_META[event.kind] })),
    [events]
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function selectMatch(match: Match) {
    setSelectedId(match.id);
    setHomeScore(match.homeScore);
    setAwayScore(match.awayScore);
    setPeriod(match.period);
    setMinute(match.minute);
    if (match.id !== 1) {
      setEvents([
        {
          id: Date.now(),
          kind: "comment",
          side: null,
          minute: match.minute,
          text: "Demo timeline ready for live match updates."
        }
      ]);
    } else {
      setEvents(initialEvents);
    }
  }

  function addEvent(kind: EventKind, side: Side, text?: string) {
    const meta = EVENT_META[kind];
    const team = side === "home" ? selected.home : side === "away" ? selected.away : "Match";
    let nextText = text || `${meta.label}: ${team}`;

    if (kind === "goal") {
      if (side === "home") {
        const score = homeScore + 1;
        setHomeScore(score);
        nextText = `${selected.home} score. ${score}–${awayScore}.`;
      } else if (side === "away") {
        const score = awayScore + 1;
        setAwayScore(score);
        nextText = `${selected.away} score. ${homeScore}–${score}.`;
      }
    }

    setEvents((current) => [
      { id: Date.now(), kind, side, minute, text: nextText },
      ...current
    ]);
    announce(`${meta.label} added`);
  }

  function addComment() {
    const value = comment.trim();
    if (!value) return;
    addEvent("comment", null, value);
    setComment("");
  }

  function advancePeriod() {
    const order = ["Q1", "Q2", "Q3", "Q4", "FT"];
    const index = Math.max(0, order.indexOf(period));
    const next = order[Math.min(index + 1, order.length - 1)];
    setPeriod(next);
    addEvent("period_end", null, next === "FT" ? "Full time." : `${period} ended. ${next} begins.`);
  }

  function downloadShareGraphic() {
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
    ctx.fillText(period === "FT" ? "FULL TIME" : "LIVE SCORE", 80, 180);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 58px Arial";
    ctx.fillText(selected.home, 80, 360);
    ctx.fillText(selected.away, 80, 620);

    ctx.textAlign = "right";
    ctx.font = "800 150px Arial";
    ctx.fillText(String(homeScore), 990, 380);
    ctx.fillText(String(awayScore), 990, 640);

    ctx.textAlign = "left";
    ctx.fillStyle = "#18e28b";
    ctx.font = "700 32px Arial";
    ctx.fillText(`${period} • ${minute}'`, 80, 760);

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
        <button className="ghostButton" onClick={() => setScorerMode((value) => !value)}>
          {scorerMode ? "Exit scorer" : "Score a match"}
        </button>
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
            <button className="secondaryButton" onClick={() => setScorerMode(true)}>Start scoring</button>
          </div>
        </div>

        <div className="heroPanel">
          <span className="pulseDot" />
          <strong>LIVE NOW</strong>
          <p>{demoMatches.filter((match) => match.period !== "FT").length} demo matches reporting</p>
          <div className="miniScore">
            <span>{selected.home}</span><b>{homeScore}</b>
            <span>{selected.away}</span><b>{awayScore}</b>
          </div>
        </div>
      </section>

      <section className="section" id="live">
        <div className="sectionHeading">
          <div><p className="eyebrow">LIVE FEED</p><h2>Matches happening now</h2></div>
          <span className="demoPill">Demo data</span>
        </div>

        <div className="matchGrid">
          {demoMatches.map((match) => {
            const isSelected = match.id === selectedId;
            const h = isSelected ? homeScore : match.homeScore;
            const a = isSelected ? awayScore : match.awayScore;
            const p = isSelected ? period : match.period;
            const m = isSelected ? minute : match.minute;

            return (
              <button
                key={match.id}
                className={`matchCard ${isSelected ? "selected" : ""}`}
                onClick={() => selectMatch(match)}
              >
                <div className="matchMeta">
                  <span>{p === "FT" ? "Finished" : `${p} • ${m}'`}</span>
                  <span className={`trust ${trustClass(match.trust)}`}>{match.trust}</span>
                </div>
                <div className="teamRow"><span>{match.home}</span><b>{h}</b></div>
                <div className="teamRow"><span>{match.away}</span><b>{a}</b></div>
                <div className="cardFooter">Open match centre <span>→</span></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section matchCentre" id="match">
        <div className="scoreboard">
          <div className="scoreTopline">
            <span className="liveTag"><span className="pulseDot" /> {period === "FT" ? "FULL TIME" : "LIVE"}</span>
            <span className={`trust ${trustClass(selected.trust)}`}>{selected.trust}</span>
          </div>
          <p className="competition">Saturday League • Demo match centre</p>
          <div className="bigScore">
            <div><span className="teamBadge">{initials(selected.home)}</span><h3>{selected.home}</h3></div>
            <strong>{homeScore}<i>–</i>{awayScore}</strong>
            <div><span className="teamBadge alt">{initials(selected.away)}</span><h3>{selected.away}</h3></div>
          </div>
          <div className="clock"><b>{period}</b><span>{minute}'</span></div>
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
              <div><p className="eyebrow">SCORER MODE</p><h3>Fast match updates</h3></div>
              <span className="demoPill">Local demo</span>
            </div>

            <div className="timeControls">
              <label>
                Minute
                <input type="number" min="0" max="90" value={minute} onChange={(event) => setMinute(Number(event.target.value))} />
              </label>
              <label>
                Period
                <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option><option>FT</option>
                </select>
              </label>
            </div>

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
                onKeyDown={(event) => event.key === "Enter" && addComment()}
              />
              <button onClick={addComment}>Post</button>
            </div>
            <button className="periodButton" onClick={advancePeriod}>End period / advance</button>
          </div>
        )}

        <div className="timelinePanel">
          <div className="sectionHeading compact">
            <div><p className="eyebrow">MATCH TIMELINE</p><h3>Latest updates</h3></div>
          </div>
          <div className="timeline">
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
