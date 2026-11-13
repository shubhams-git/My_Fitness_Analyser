# F23 — Task-first Field Notes

Four reviewers independently audited the 14 November 2026 baseline: sign-in,
navigation, Training, Sessions, Progress, recorded and summary-only activities,
non-run workouts, check-ins, maps and replay, Journal, Account and Studio. They
used source and synthetic Chromium views. They did not use live member records.

| Review | Main findings |
| --- | --- |
| [Impeccable](https://impeccable.style/) | Technical audit and supplemental design critique: 12/20 (accessibility 2, performance 2, theming 3, responsive 3, implementation integrity 2). Training hid the runner's next action; Account and Journal misplaced their main tasks. Account overflowed a 402px viewport by 48px at the largest text setting. The reviewer reproduced the blocked weigh-in. This was the technical audit, separate from Impeccable's formal two-reviewer critique. |
| [Hallmark](https://github.com/Nutlope/hallmark/tree/main/skills/hallmark) | The dated Sessions ledger and recorded route, pace and split instruments were the most distinctive surfaces. Repeated slogans, arrows, cards and check-in actions diluted them. At 393px the original Training check-in started at y722, the populated Progress chart at y1016, and Garmin at y1281 on Account. The reviewer traced the non-run check-in crash. |
| [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Valid weigh-ins and goals sent zero POSTs because of an undefined variable in shared cache invalidation. Account's source select was 26px high and password inputs 30px. Back lost focus, goal type changes discarded edits, and coaching polling replaced focused content. Other findings included malformed weight-goal labels, zero pace with a missing timer, and unbatched chart pointer work. |
| [UX Heuristics Review](https://claudeskills.page/skills/design/ux-heuristics-review/) | Walked sign-in, importing and reviewing a run, history and progress, logging weight and strength, and managing settings and backups. Rated the shared write failure 4/4 and the misleading check-in, duplicate pending submission, and hard-to-find primary actions 3/4. Reproduced goal draft loss and a confirmed weigh-in with a disabled refresh action. Flagged local-only screenshot links on hosted activities. |

Anthropic Frontend Design guided the visual direction. UI/UX Pro Max supplied
guidance on touch targets, focus behind sticky navigation, error recovery and
navigation state. Its sports lookup supported condensed type and simple surfaces;
the suggested marketing layout and alternate palette did not suit the brief.
Keep the Field Notes carbon, Barlow and Manrope identity. Use orange for decisions
and data that need attention, and let dated runs and measurements define the page.

- Training leads with the latest run and a direct check-in, or Garmin and imports
  on an empty record. Sessions is a main destination with URL-backed filters and
  pagination. Activity links back to the filtered archive. Browser Back restores
  scroll and focus. Progress groups month and activity controls above the chart
  and calendar, with jump links for comparisons, best efforts and zones.
- Activity has one inline run check-in, with no floating duplicate. Non-run and
  unavailable states do not offer it. Missing answers receive focused feedback;
  pending saves guard against duplicate sends. Missing timer values do not create
  zero pace. Summary imports bring splits forward and link hosted evidence to the
  private backup instead of exposing local-only screenshot links.
- Journal exposes both logging tasks beside the title. Confirmed writes remain
  confirmed if the subsequent read fails; retry only the read. Account groups
  connections, training settings, privacy, and security. Both analysis consent
  scopes have a named entry point. Goal type changes retain in-session edits.
- Sign-in leads with the form, preserves the destination and offers error
  recovery. Studio controls fit narrow phones and offer fixture-load recovery.

Verification used 60 Chromium route and viewport combinations: 320px, 402px,
landscape, tablet, desktop and the app's largest text setting. Browser flows
covered archive state and focus, check-in validation and retry, recovery after
a confirmed weigh-in, strength saving, goal drafts and sign-in deep links.
Journal used the loopback PGlite fixture; check-in, goal and sign-in used mocked
responses. Axe reported no matching violations on six exercised fixture pages.
`npm run test:prototypes` passed 142 tests, including the write regression;
`npm run check` and `npm run check:cloud` also passed.
No live provider, actual iPhone Safari or hosted backup was tested in this pass.

Follow-up: measure first load and a timed check-in on iPhone Safari, then profile
maps and calendar interaction on the device. A hosted per-activity evidence
viewer remains separate work.
