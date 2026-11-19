---
target: Mobile account and sign-out
total_score: 28
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 2
target_identity: "file:D:\\Projects\\My_Fitness_Analyser\\my-fitness-analyser\\prototypes\\account.js"
target_fingerprint: "sha256:99965f03487f5b39a2a8b82ee6b66edd6da3f0bf2ed2213e47cf218bcb123090"
target_path: "D:\\Projects\\My_Fitness_Analyser\\my-fitness-analyser\\prototypes\\account.js"
timestamp: 2026-11-19T19-01-33Z
slug: prototypes-account-js
---
# Mobile account and sign-out review

20 November 2026. Two independent Impeccable assessments reviewed the Field Notes design and the rendered interface. The design critique scored 28/40 and the technical audit scored 15/20 before the changes.

| Design heuristic | Baseline |
| --- | --- |
| Status visibility | 3/4 |
| Familiar terminology | 3/4 |
| User control | 3/4 |
| Consistency | 3/4 |
| Error prevention | 3/4 |
| Recognition | 2/4 |
| Efficiency | 3/4 |
| Visual hierarchy | 2/4 |
| Recovery | 3/4 |
| Help | 3/4 |

The technical baseline was 2/4 for accessibility, 3/4 for performance, 4/4 for theming, 3/4 for responsiveness and 3/4 for implementation integrity.

## What each page needs to do on a phone

| Page | Review finding |
| --- | --- |
| Training | The latest run gives the athlete an immediate next action. The condensed headline, run metrics and check-in entry point establish the app’s athletic identity. |
| Sessions | Recent workouts are easy to scan by date and type. The archive keeps its filters and import link near the heading. |
| Activity | Distance, pace and the check-in action are visible before the map. The route and chart interactions carry the most expressive motion. |
| Progress | The monthly view supports comparison, but the month field clipped its value beside Activity type at phone widths. The fields now stack on narrow screens. |
| Journal | Weight and strength logging are easy to reach above the history. The Weight analysis provider label needed more legible type. Its panel now uses the same border treatment as adjacent surfaces. |
| Account | Loose shortcuts and fully expanded forms made settings harder to scan. The Account index now has distinct touch targets, Garmin sync leads the connection panel, and occasional imports, backup and password tasks open on demand. |
| Sign in and activation | The form remains the first task. Configured social providers appear when available. Invitation and recovery links open the Account password disclosure at its existing URL. |

## Priority findings and changes

- **P1 · Offscreen sign-out errors.** A forced server error appeared more than 2,500 CSS pixels above the viewport after scrolling to Backup & security. The visible header control and the Browser session action now open a shared dialog. It explains what happens to drafts, keeps retry beside the failed action, and restores focus on cancel. Successful sign-out shows a status message on Sign in.
- **P1 · Competing Garmin actions.** Replace API key appeared before Sync Garmin in the connected view. Sync now comes first, with key replacement secondary. Connect Garmin stays visible when setup is needed. FIT, screenshots and the review queue have separate disclosures.
- **P2 · Settings hierarchy and target size.** Account now has a compact identity and a structured section index. Settings headings sit beneath their groups, and Pace meets the app’s 44-pixel target. The shared header wraps at enlarged text sizes. Navigation and section rules use short motion cues, with a static treatment for reduced motion.
- **P2 · Narrow Progress controls.** Activity type and the month now have their own full-width controls on narrow screens. The shorter introduction gives the chart more room.

## Verification

Chromium rendered the main pages with populated synthetic records at a 402-pixel phone width. Account and Progress were checked at 320, 402, 834, 874 and 1440 CSS pixels, including landscape, enlarged text and reduced motion. Touch emulation and keyboard checks covered cancellation, focus return, pending and failed sign-out, retry, successful redirect, local draft cleanup, invitation password setup, Garmin connection and sync states, and provider availability. The foundation check and all 160 prototype tests passed.

The source detector also flags shared styling such as the Activity gradient, glow and grids. The review checked these against rendered usage. Account verification used a synthetic browser session because the signed-in Chrome profile was unavailable to browser automation. Physical iPhone Safari and the production member session remain unverified.
