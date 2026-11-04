# Foundation verification

Date: 4 November 2026
Environment: Node v24.22.1; Git 2.51.1; managed Linux.

Commands actually run:

```text
npm run tokens
npm run check
```

Result: PASS. Fourteen required documents were present; five local Markdown links resolved; two proposed palettes passed 38 text-contrast pairs; generated CSS matched token JSON; root agent instructions remained within the compact size budget.

No browser/device rendering, live Garmin account, real FIT decoding, database persistence, cloud deployment, backup restoration of personal data or external skill execution was tested. Those are later feature gates, not foundation failures.

The checks provide narrow structural enforcement. They do not certify WCAG compliance, premium aesthetics, complete documentation, future correctness or that an agent follows every instruction.

## Rename revision 1.0.1

Product identity, package name, repository folder, clone instructions and archive paths were updated to My Fitness Analyser. The same foundation checks were rerun successfully. Historical source document names and previous Git commits intentionally retain their original names. This revision adds no application functionality.

## Authenticated data feasibility, 4 November 2026

Environment: Windows PowerShell, Node v26.5.0, npm 12.2.0. Earlier Linux foundation results above remain historical.

Commands actually run:

```text
npm install --save-dev --save-exact --ignore-scripts @garmin/fitsdk@21.221.0
node scripts/fetch-garmin-sample.mjs
node scripts/inspect-fit.mjs <private-capture>/fits
node scripts/verify-garmin-capture.mjs <private-capture>
node --check scripts/fetch-garmin-sample.mjs
node --check scripts/inspect-fit.mjs
node --check scripts/verify-garmin-capture.mjs
npm run check
```

Result: seven live account activities captured through official authentication/list/detail/download endpoints. All seven original FIT files passed integrity and decoded without errors. Seven comparisons passed for UTC start, available distance, timer/elapsed duration, average/max HR; distance tolerance <0.02 m, duration tolerance <0.002 s, HR exact. Fourteen captured detail/archive hashes and seven extracted FIT hashes matched. An initial ZIP request received HTTP 406; matching Garmin's documented x-zip-compressed Accept type resolved it. This is not an authorization failure or an unverified claim of automatic retry behavior.

Six owner-supplied screenshots were preserved with hashes and visually transcribed into two grouped candidate records. Owner confirmed dates; source discrepancies, rounding and missing data remain explicit. MASS inventory found 29 weights, four active sessions plus one deleted session, and two sparse wellness records. There is no database import yet.

No credential or full raw health export was added to source control. Private artifacts are ignored local files, not durable application storage or an off-device backup. Application UI, browser/device verification, production sync reliability, database isolation and restore remain pending. See docs/DATA_FEASIBILITY.md for source references and reproduction limits.

Additional local negative/partial-data checks: encoded a small synthetic activity with the official SDK and verified inspection retains missing GPS as absence; truncated the same file and verified integrity rejection with nonzero exit. Synthetic fixture/results are under ignored private-data/verification-fixtures. These checks exercise the inspection tool, not a production import pipeline.

## Interactive prototypes, 5 November 2026

`npm run check` passes with provisional display fonts/focus/border tokens and regenerated CSS. `npm run test:prototypes` passes five cases covering control/focus contrast, irregular sample boundaries, missing/stationary values, coherent synthetic sample generation and local server source/host restrictions. Static browser code passes Node syntax checks.

Browser review used the connected in-app browser through computer-use tools. Two compositions were evaluated at five requested widths (360, 393, 440, 768, 1440) with no measured horizontal overflow or visible default-view buttons below 44px. Requested 393px reports 394px innerWidth due to browser rounding; evidence preserves both values. Twenty visible-state cases passed. Narrow phone larger-text/reduced-motion overrides produce 20px root/body, 17.5px secondary labels, zero transitions, automatic scrolling and no horizontal overflow.

Direct interaction checks covered unanswered defaults, required fields, conditional discomfort/location, stale-location clearing, optional note, Escape/close, draft recovery on reload, preview completion/edit, retained answers after failure, offline pending/retry, linked interval/chart/route selection, preserved route zoom/selection and keyboard chart inspection. Historical duration types and missing HR/GPS remain distinct; source screenshots load via explicit local allowlist.

Evidence and rendered screenshots are under ignored private-data/prototypes. The two designs are ready for owner comparison, not approved visual baselines or a production release. Actual iPhone Safari/safe-area/keyboard behavior, measured owner check-in timing and production persistence remain pending. See docs/PROTOTYPE_REVIEW.md.
