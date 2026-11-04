# Decision register

Date: 4 November 2026. “Confirmed” means stated by the user; “proposed” means a recommendation, not consent. This register is a curated present record with supersession notes; Git preserves its history.

| ID | Status | Decision and reason |
| --- | --- | --- |
| R01 | Confirmed | Garmin Forerunner 965 is owned and paired. Earlier 55/165/255/265 purchase planning is obsolete. |
| R02 | Confirmed | New activities come from Garmin; Strava is for social sharing; NRC is historical only. |
| R03 | Confirmed | MASS supplies weight history. The initial available interface is JSON export; live-fetch capability is unverified. |
| R04 | Confirmed | Premium, smooth, mobile-first personal app; short check-ins; meaningful analysis and minimal clutter. |
| R05 | Confirmed | Work incrementally and preserve written standards/context across iterations. |
| R06 | Confirmed | Product name: My Fitness Analyser; slug: `my-fitness-analyser`. Supersedes the working name STRIDE. |
| D01 | Adopted for foundation | Repository documents, executable tokens, feature acceptance criteria and Git form project memory. Conversation summaries are secondary. |
| D02 | Proposed | Select one visual system from two populated prototypes before broad UI implementation. Concrete colours/fonts remain provisional. |
| D03 | Proposed | Single TypeScript application; React/Next.js and Supabase candidates. Runtime/hosting/package versions remain undecided. |
| D04 | Proposed | First vertical slice: real FIT import, correct activity detail, persisted editable check-in and data export; add MASS weight history within the first usable release. |
| D05 | Proposed | Prove Garmin Personal API access early; retain manual FIT fallback. Do not block basic use on full automatic sync. |
| D06 | Adopted for foundation | No new Strava API dependency. Historical user-supplied evidence remains importable; source/API policy restrictions are not bypassed with an intermediary. |
| D07 | Proposed | Use one design-generation skill at a time and a separate review checklist. Inspect and pin any installed skills/dependencies. None installed by this pack. |
| D08 | Deferred | Gemini explanations, sleep dashboard, best-effort medals, personal segments, heatmaps and advanced comparisons. Preserve their value in the roadmap without building them now. |
| D09 | Open | Private Git remote, hosting and chosen visual direction. Local foundation commit is portable in the included Git bundle. |
| D10 | Owner-directed, 4 November 2026 | Inspect real data before the UI comparison. Use the key already in local .env for official read-only Garmin access; inspect supplied historical screenshots and MASS backup. Older returned Garmin activities are confirmed as the owner's and included. This verifies initial access without claiming production sync. |
| D11 | Adopted for feasibility, 4 November 2026 | Pin official @garmin/fitsdk 21.221.0 as a development-only file-inspection dependency with lockfile. Keep captures, screenshots, decoded streams and extracted health measurements under ignored private-data. Application runtime and storage remain undecided. |
| D12 | Owner-authorized, 5 November 2026 | Deliver both populated Activity Detail/Quick Check-In prototypes for visual comparison. Use the available frontend-design skill and Sites local-preview workflow within F01's existing local-only scope. Static HTML/CSS/JS prototypes preserve the undecided production runtime. Real captures stay local; no Site registration, external health-data hosting or production save is implied. |
| D13 | Proposed visual refinement, 5 November 2026 | Compare Manrope display/figures and Newsreader editorial headings, with locally bundled OFL licences. Add a separate focus role and increase proposed control-border contrast. Preserve both candidate palettes and null selectedTheme until owner review. |
| D14 | Owner-authorized hosting preparation, 5 November 2026 | Push the two prototypes and synthetic Vercel adapter on codex/prototype-vercel. GitHub contains no private fixtures or credentials; online visual review uses the synthetic activity. This is prototype hosting, not production application hosting. |
| D15 | Owner-authorized refinement, 5 November 2026 | Apply UI/UX Pro Max to both existing prototypes, using the supplied Sonnet prompt as optional reference. Integrate Trackside's route and metric hierarchy; compare ink/champagne Field Notes with existing licensed typography. Retain data/check-in contracts and state controls. Defer the reference's broad application/framework rewrite. Both themes remain proposed; selectedTheme stays null. See docs/DESIGN_RATIONALE.md and docs/QA_REPORT.md. |

Current checkout reconciliation: origin is configured; codex/prototype-vercel was pushed, and the current refinement branch is codex/f01-design-refinement. The Git root is the parent of the project folder. Remote visibility has not been verified. D09's remote-selection wording describes the earlier foundation pack, not the present local configuration. The included bundle is historical, not a continually updated backup.

## Reconciliation with prior documents

Reviewed `STRIDE_PRODUCT_BLUEPRINT_v0.9.md`, `CODEX_START_PROMPT.md` and `CODEX_STRAVA_INTELLIGENCE_HANDOVER_2026-10-31.md`. Keep their high quality bar, source provenance, no fabricated metrics, map/graph relationship, 30–45 second check-in and staged delivery. They are research/history, not parallel active instruction sets.

Supersede references to a future watch purchase, FR255 baseline and Strava-first ingestion. Detailed advanced feature catalogues remain backlog candidates. Prior model names, pricing, popularity counts and claims of full Garmin endpoint coverage are not adopted as implementation facts. The latest user request authorizes this foundation/research stage; it does not mean all prior proposed architecture or mockups were selected.

## Add a decision

For a material change record: ID, date, status, problem, chosen option, alternatives, consequence, verification and superseded ID. Small implementation choices belong in the feature record, not an unnecessary full architecture essay.
