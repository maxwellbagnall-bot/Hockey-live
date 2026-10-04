# iOS Live Activity: game-scoped opt-in

## Delivery timing

This is a post-launch enhancement. It must not delay the web app launch. Revisit the native iOS work after the web app is launched and its initial match-day tests are complete.

## Goal

Let a person follow one hockey match on the iPhone Lock Screen, and let an authorized controller use quick match actions there. The Live Activity must be started by an explicit choice for that match and must end when that match ends.

The current product is a web app/PWA. A real iPhone Lock Screen Live Activity requires an iOS app target using ActivityKit and a WidgetKit extension; a web page or service worker cannot create one. This document defines the behavior for that native work.

## Consent and lifecycle

1. Show a per-match action such as **Show this game on my Lock Screen until full time** on the match screen.
2. Do not start an activity just because someone opens, watches, or controls a game. Only the explicit per-match action starts it.
3. Before starting, check `ActivityAuthorizationInfo().areActivitiesEnabled`. If disabled, explain that Live Activities need to be enabled for the app in iPhone Settings and leave the match screen usable.
4. On success, show an in-app state that this match is on the Lock Screen and provide **Stop Lock Screen updates**. Stopping only ends this person's Live Activity; it does not end or alter the match.
5. End the activity when the match becomes finished/full time or cancelled. The app must also reconcile active activities against match status on launch and foregrounding, so an activity does not persist after a missed update.
6. A viewer's activity is read-only. A controller can get control actions only after the backend confirms they still hold match control. If control is lost, remove or disable those actions without affecting the viewer's activity.
7. Starting an activity for another match requires a separate tap. Do not silently carry consent between matches.

Apple does not provide a separate system permission prompt for each individual Live Activity. The per-match button is the product-level consent; iOS Settings remains the platform-level switch. Observe authorization changes and respond if the person disables Live Activities.

## Activity content

- Match and team names
- Current score, period, and clock state
- Clear LIVE / finished state
- For controllers only: large pause/resume and period actions, plus quick home/away goal actions
- No comments, PINs, or private profile details in the Lock Screen payload

Live Activity buttons should use App Intents. Any action that changes the match must call the existing authenticated match-control/report endpoints, then reconcile the visible state with the server response. Do not treat a local optimistic change as confirmed scoring.

## Authentication and updates

The current web app uses Supabase Auth and database RPCs. The iOS app and App Intents need a secure way to use the signed-in user's Supabase session; never put an anon key alone or a controller PIN in the activity attributes. Store credentials in Keychain and enforce controller authorization on the server for every write.

The native app should start the activity in the foreground after the user's tap. While the app is not open, timely score changes require ActivityKit push updates: register the activity push token with an authenticated backend endpoint and send updates from trusted server code. If push updates are not configured, the activity can only be refreshed when the app is able to update it, which is not sufficient for a reliable spectator experience.

## Acceptance checks

- No activity appears when merely viewing or controlling a match.
- A tap starts only the selected match, and a disabled iOS setting produces a helpful explanation.
- The person can stop their own activity at any time without changing the match.
- Full time and cancellation end the activity; relaunch/foreground reconciliation cleans up stale activities.
- A spectator can never score or control the clock from the activity.
- Every controller action is authorized by the backend and the displayed score is reconciled with its response.
- Match data reaches the Lock Screen while the app is backgrounded through the configured push path.

## Apple references

- [ActivityAuthorizationInfo](https://developer.apple.com/documentation/activitykit/activityauthorizationinfo)
- [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [ActivityKit](https://developer.apple.com/documentation/activitykit)
