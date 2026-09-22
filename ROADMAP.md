# Hockey Live Roadmap

_Last updated: 22 September 2026_

This file captures product ideas we want to keep for future versions.

## Active cards / players off pitch

- Show active card suspensions beside each team at the top of Match Centre so viewers can immediately see when a team is temporarily down a player.
- Green card: start a 2-minute suspension timer automatically when the card is reported, show the countdown beside the team, then remove the active-card indicator automatically when the timer expires.
- Yellow card: when reporting the card, ask for the suspension length (for example 5 minutes, 10 minutes, or custom) and show a live countdown beside the team.
- Red card: keep the player-off indicator active for the rest of the match.
- Support multiple simultaneous card suspensions for the same team.
- Card events remain permanently in the timeline even after the active suspension indicator disappears.
- Community reports can still be corroborated/confirmed using the existing Waze-style confidence model.

## Goal scorers and assists

- Keep the initial goal report fast: one tap should still update the score immediately.
- After a goal is recorded, optionally ask: "Do you know the scorer?" and "Do you know the assist?"
- Allow scorer/assist details to be added later if they were not known at the time.
- Treat player attribution separately from the goal itself so an uncertain scorer does not hold up the live score.
- Build season tallies for:
  - Goals
  - Assists
  - Goal contributions
  - Team and competition leaderboards
- Allow corrected player attribution later without changing the original goal time or score event.
- Longer term: verified team/club accounts could confirm player attribution.

## Match Controller recognition

- Track matches controlled on user profiles.
- Reliability / successful-match-control history.
- Badges such as First Whistle, 10 Matches Controlled, Home Regular, Trusted Controller.
- At full time, show the controller how many people followed the match live.

## Live Match Centre principle

The mobile Match Centre should stay usable without scrolling around:
- score + clock always visible;
- timeline visible and scrollable;
- goal, PC, cards and comments available inline;
- extra detail should be optional and never slow down the basic live report.
