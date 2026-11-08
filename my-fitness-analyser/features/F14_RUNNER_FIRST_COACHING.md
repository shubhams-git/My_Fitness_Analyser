# F14 — Runner-first experience and deeper coaching

Requested 9 November 2026: deeper independent Impeccable review, clearer hierarchy, confident personalized advice and more useful free training instruments. Master-only increment; no new dependencies, SQL migrations, billing or account permissions.

## Acceptance and delivered behavior

- Preserve the chosen premium athletic identity and real maps. Training prioritizes one current brief, latest run/check-in, seven-day summary and recent sessions. Dedicated Sessions and Progress views reduce home-page competition.
- Separate confident prose from exact measurement. Expanded run evidence and generated weight advice use high-thinking Gemini, bounded v3 run/v2 weight schemas, exact fact references, direction checks and post-generation evidence checks. Stale reports no longer lead as current advice.
- Keep fast paths: direct weigh-in, check-in hash entry, calendar keyboard controls, persisted Progress selection and human-readable labels. Profile timezone fixes the UTC/day mismatch.
- Add versioned personal GPS matched-route pace history and weekly session-RPE load. Rate coverage is visible, missing effort does not become zero effort, no fake proprietary score or screenshot-derived route. These are free original features.

## Verification

92 automated tests pass; `npm run check` passes foundation requirements and 38 declared contrast pairs. `git diff --check` passes. Test coverage includes owner/RLS isolation, consent/cache behavior, edit-during-generation races in both engines, signed claim language, midnight/DST, readable axes, route reversal/parallel street/gaps and rated/unrated load.

Independent baseline review: 23/40 Nielsen and provisional 13/20 technical; no invented post-change score. One final detector scan reports seven legacy linked-CSS warnings/advisories, manually contextualized. No mutable browser overlay was possible through read-only CUA. See [audit](../docs/UI_AUDIT_2026-11-09.md) and [engineering/probes](../docs/COACHING_ENGINEERING_2026-11-09.md).

Local read-only owned-data fixture and clearly labelled synthetic route/RPE fixture exercised desktop, narrow phone, landscape, calendar arrow selection and direct view navigation. These fixtures never write the member's records or call a provider. Physical Safari remains a separate device check.

App releases f458508 and 6bbfdfc are on origin/master; Vercel reports success.
New static modules return 200; anonymous training remains 401. Live Training
shows the actual latest 8 November Garmin run and last-seven-day totals. The
new weight report was generated for the owner, saved and restored after reload.
The first live v2 run report exposed a conclusion/explanation mismatch; v3 gives
the primary verdict its own explanation/action. Both v3 provider attempts returned explicit HTTP 503. No personal v3 run report
was published, no paid fallback or third retry was used. The new v3 contract
passes the application/provider-shape tests; its live personal completion remains
blocked by that provider response. The working weight report is current and
persisted. Local audit servers were stopped and responsive overrides reset.

## Next increment

Member-reviewed training zones with effective dates and source-aware distributions. Goals and quality-checked terrain/heatmap work follow; no premature fitness/freshness score. Full capability mapping remains in [Strava research](../docs/STRAVA_CAPABILITY_RESEARCH.md).
