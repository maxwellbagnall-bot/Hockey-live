"use client";

import { useState } from "react";

const HOCKEY_LIVE_URL = "https://hockey-live-eight.vercel.app";
const SHARE_TEXT =
  "Try Hockey Live with me — fixtures, results, league tables and live match updates for the teams you follow.";

export default function ShareHockeyLive() {
  const [status, setStatus] = useState("");

  async function shareApp() {
    setStatus("");

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Hockey Live",
          text: SHARE_TEXT,
          url: HOCKEY_LIVE_URL
        });
        setStatus("Shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${HOCKEY_LIVE_URL}`);
      setStatus("Link copied — paste it into a message");
    } catch {
      window.prompt("Copy this Hockey Live link", HOCKEY_LIVE_URL);
    }
  }

  return (
    <div className="shareAppControl">
      <button
        className="secondaryButton shareAppButton"
        type="button"
        onClick={() => void shareApp()}
      >
        Share this app with someone
      </button>
      {status ? (
        <span className="shareAppStatus" role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </div>
  );
}
