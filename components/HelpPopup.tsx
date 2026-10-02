"use client";

import { useState } from "react";

type HelpTopic = {
  title: string;
  steps: string[];
};

const TOPICS: HelpTopic[] = [
  {
    title: "Follow or add a team",
    steps: [
      "Search for the team first so Hockey Live can show any existing matches.",
      "If it is already there, select it and follow it.",
      "If it is missing, choose Add a team, enter the club and team name, and create it once for the whole community."
    ]
  },
  {
    title: "Create a game",
    steps: [
      "Open Create game and choose League game or Friendly.",
      "Pick the two teams and choose 4 quarters or 2 halves.",
      "Create the fixture. Hockey Live will warn you if a very similar fixture already exists."
    ]
  },
  {
    title: "Run Match Centre",
    steps: [
      "Open the match and claim Match Control.",
      "Start or pause the shared clock as the game is played.",
      "Use End quarter, Half time or Full time when the actual period ends."
    ]
  },
  {
    title: "Report what happens",
    steps: [
      "Use the quick buttons for goals, penalty corners and cards.",
      "Add a comment for anything supporters should know.",
      "Reports from multiple people help Hockey Live confirm what happened."
    ]
  },
  {
    title: "Comments",
    steps: [
      "Comments are public to people following the match.",
      "Common swear words are automatically starred out before the comment is stored.",
      "Keep comments about the hockey and the match."
    ]
  }
];

export default function HelpPopup() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="helpButton"
        aria-label="Open Hockey Live help"
        onClick={() => setOpen(true)}
      >
        ? Help
      </button>

      {open && (
        <div className="helpBackdrop" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="helpPanel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hockey-live-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="helpPanelHeader">
              <div>
                <p className="eyebrow">HOCKEY LIVE HELP</p>
                <h2 id="hockey-live-help-title">How do I…?</h2>
              </div>
              <button
                type="button"
                className="helpClose"
                aria-label="Close help"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="helpTopics">
              {TOPICS.map((topic) => (
                <details key={topic.title}>
                  <summary>{topic.title}</summary>
                  <ol>
                    {topic.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
