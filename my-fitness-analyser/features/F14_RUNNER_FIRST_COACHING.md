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

Production deployment and live report persistence verification: pending release.

## Next increment

Member-reviewed training zones with effective dates and source-aware distributions. Goals and quality-checked terrain/heatmap work follow; no premature fitness/freshness score. Full capability mapping remains in [Strava research](../docs/STRAVA_CAPABILITY_RESEARCH.md).
