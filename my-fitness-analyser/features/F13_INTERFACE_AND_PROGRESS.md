# F13 — Interface refinement and recorded training progress

Status: implemented, 8 November 2026. Owner requested Impeccable installation,
an intensive interface pass and free, original subscription-style analytics.
Work remains on master. No schema, credential, provider scope or paid service
changes. No account records are written by the audit.

## Acceptance criteria

- Preserve the chosen carbon/orange/glacier athletic identity and real maps.
- Make Training / Progress / Journal / Account findable on phone and desktop.
- Correct misleading status copy, oversized introductions and scale/readability
  problems without changing source measurements or the body-weight trend.
- Deliver working monthly comparisons, calendar inspection, best-effort curve
  and pace/HR distributions from owned records. Empty/screenshot-only accounts
  must stay honest; no synthetic hosted fallback.
- Version calculations and test interpolation, pauses, gaps, months and nulls.
- Inspect actual renders/interactions and document remaining feature boundaries.

## Delivery

Impeccable 4.8.0 installed from the maintainer's official repository as a local
Codex skill. It was not available as a marketplace plugin under that name.
Applied its operate/audit/polish guidance to the existing Field Notes system.
The context launcher and one source detector run completed. No browser injection
or third-party overlay was used; all UI inspection used the CUA browser surface.

Training adds a Progress instrument with source-window monthly cumulative
distance/time, immediately previous calendar month comparison, daily data table,
sport filter and calendar. Roving keyboard focus supports day/week arrows and
Home/End; a selected date links to every actual session on that date.

Best efforts calculate elapsed windows at nine benchmark distances from GPS
distance/time streams. The curve shows fastest pace by distance and a selected
benchmark lists up to three different activities. No fabricated lifetime record,
race certification or screenshot-derived stream. The audited owned backup has
only one eligible GPS running recording, so historical comparisons remain sparse.
Newer production records are read fresh by the existing member API.

Activity analysis adds time-weighted HR/pace bands with covered/unclassified time.
These numerical bins are not personalised training zones. Focused pace scaling
prevents extreme tails from flattening ordinary pacing; omitted sample counts are
explicit and full range is one button away. Source values/cursor readouts remain
unchanged. Activity map cameras are not reset by chart scaling or series changes.

Shared refinement shortens intros, consolidates navigation/brand, removes
decorative section numbering, reduces repeated entrance choreography, raises
small account/sign-in text, adds HR overview scale labels and compacts Gemini
briefings. Activity data management points to Account. Saved check-ins now say
where they are actually saved, including the mobile dock after updates.

## Verification

82 automated tests pass, including six new analytical regressions. Foundation
checks pass (38 declared text contrast pairs) and diff whitespace is clean.
An initial full-suite run collided with the audit preview on port 4191; the
preview was moved to 4194 and the complete suite then passed. No product test
timeout was hidden or increased.

Phone emulation at 390 × 844 inspected Training, Progress, activity details,
Journal, Account and Sign-in. Tested month/metric switching, date selection,
password visibility, focused/full pace switching and distribution expansion.
Owned-data preview uses an ignored backup and a loopback-only read-only server;
all writes and provider generation return 405. Synthetic fixture is separately
labelled and never connected to an account. Actual production verification and
screenshots are recorded below after deployment.

See [the audit](../docs/UI_AUDIT_2026-11-08.md) and
[the subscription capability map](../docs/STRAVA_CAPABILITY_RESEARCH.md).
Physical iPhone Safari, performance profiling and a full assistive-technology
audit are not claimed by browser emulation or source checks.

## Remaining analytics work

Member-reviewed training-zone settings and goals; representative session-load
history before modelled load curves; conservative matched GPS runs and private
route-frequency maps; terrain adjustment only after elevation QA. Global
leaderboards, live device segments, offline navigation and third-party perks are
not present. No empty feature buttons imply that they are.

Additional QA: empty history at 320 px has no horizontal overflow, no NaN and
no literal template output. Native Chrome arrow-left moved calendar selection
and focus from day 8 to day 7. At 200% zoom the progress view reflowed without
horizontal overflow; the original 75% zoom was restored. Temporary viewport
settings were reset and local audit tabs closed before production verification.

## Production verification

Application release 89cf59a is pushed to origin/master; Vercel reports success.
Signed-in production renders 19 real activities and one eligible GPS running
recording. Selecting 20 October opens the NRC entry with its original figures.
The 2 km best-effort selector returns the actual run, with elapsed timing and
source link. Coaching remains the existing saved report, explicitly marked stale;
this verification made no new Gemini generation or account-data writes.
All four new static instruments/styles return 200 with expected content types;
anonymous /api/training still returns 401. No captured browser errors or horizontal
overflow. Live screenshots are private-data/interface-qa/f13-live-progress.png
and f13-live-best-efforts.png. Agent-created local tabs are closed; audit servers
on 4189 and 4194 are stopped. Production tab is retained as the deliverable.
