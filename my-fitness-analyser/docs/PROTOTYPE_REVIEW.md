# F01 prototype review

Delivered for owner review: 5 November 2026 (Australia/Sydney). Neither visual direction is selected or approved branding.

## Open locally

From the `my-fitness-analyser` project folder, with Node >=22:

```text
npm run prototype
```

Open `http://127.0.0.1:4173/`. The comparison page contains both interactive phone views, full-size links, viewport sizes, source samples, review states and accessibility options. Static changes appear on browser reload; Node watch reloads server/data-module changes. Stop the preview with Ctrl+C when the review is finished.

The prototype has no additional runtime dependencies. It reads the ignored local captures when present and otherwise falls back to explicitly labelled synthetic demonstration data. The local server never reads `.env` or calls Garmin. It serves only UI assets, a filtered preview-data response and six explicitly allowlisted source images. It is bound to loopback, rejects foreign hosts and denies arbitrary private/source-file paths.

## The two directions

| | Trackside | Field Notes |
| --- | --- | --- |
| First impression | Route and essential session numbers | Activity typography and a concise factual observation |
| Palette | Graphite / mineral blue | Deep ink / sea glass |
| Typography | Manrope figures and headings; system body | Newsreader display; Manrope figures and system body |
| Layout | Compact instrument panels; navigation sidebar on desktop | Continuous journal; open two-column composition on desktop |
| Check-in | Accessible modal sheet with keyboard/close alternatives | Inline four-question form, reached from the mobile action |

Both use the same source selection and shared data/interaction contract. These are different compositions and feedback flows, not independent applications or alternative production stacks.

## Try these interactions

1. Compare the same Garmin Run in both directions. Source facts remain separate from the session observation and check-in.
2. Select a sampled time block: the matching recorded route interval, chart interval and summary change together. Route zoom stays stable. Chart inspection also has a keyboard range control and text values.

Longer sessions initially show six blocks; the tested track sample expands to all 55 and collapses back to six. This keeps the first view concise without discarding recorded detail.
3. Open check-in. All four required answers initially remain unanswered. Discomfort branches to a required location; note/context is optional. Close and reopen, or reload: browser drafts are retained.
4. Finish a check-in on the synthetic sample. Completion explicitly says it is a preview; no source activity or production database is changed. Edit and retry are available.
5. Compare a historical screenshot run. Missing HR is unavailable, no route is reconstructed, displayed splits remain approximate where required, and source screenshots can be inspected.
6. Use the state selector for loading, empty, partial GPS/HR, failed load, check-in failure, offline pending, delayed sync, expired connection and example completion. Retry/recovery actions work within the simulation.
7. Compare nominal 360, 393, 440, 768 and desktop widths. Larger text sets a 20px root (125%); reduced motion exercises the same animation/scroll exclusions used by the OS media-query path.

## Verification performed

- `npm run check`: foundation/token/CSS checks passed.
- `npm run test:prototypes`: five meaningful tests passed: non-text focus/control contrast, irregular sample boundaries, missing/stationary measurements, coherent labelled synthetic data, and local-server source/host restrictions.
- Browser: both directions evaluated at five viewport classes, with no horizontal overflow or visible buttons below the 44px target in the measured default views. The browser reports a rounding difference at the requested 393px size (394px `innerWidth`); exact requested/observed values are retained in private evidence.
- Twenty visible-state checks passed across both directions. Recorded artifacts include partial, failure and connection-expired screens.
- Larger-text/reduced-motion at narrow phone width: no horizontal overflow; root/body 20px, secondary labels 17.5px, transitions zero and scrolling automatic.
- Check-in: required-answer validation, conditional location, clearing a stale location when selecting None, editable completion, close/Escape, reload recovery, failed completion retaining answers, offline pending and retry were exercised using synthetic data.
- Inspection: route/chart/block selection synchronization, preserved zoom/selection across the check-in sheet, and keyboard chart inspection were verified against rendered UI. Real activity answers were verified to start unanswered.
- Historical: source durations retain their original meanings; missing HR/GPS stays missing; all three NRC source images load through the allowlisted local evidence viewer.

Private browser evidence and screenshots are under `private-data/prototypes/`; personal source data and rendered GPS are not committed as visual baselines. Shared tokens remain proposed, with provisional display fonts, clearer control borders and a separate focus role. Reference screenshots will be adopted only after a direction is chosen.

## Still requires the owner / next increment

Choose a visual direction and record any requested combination or changes. Actual iPhone Safari behavior, safe-area/onscreen-keyboard testing and five timed owner check-ins (30s target, 45s usual ceiling) remain unverified. Browser actions performed by an agent are not owner timing evidence. Production persistence, authentication, importing and Garmin sync remain F02+ work.
