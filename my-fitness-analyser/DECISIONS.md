# Decision register

D28 — Owner-authorized screenshot population, 6 November 2026. Implement the
reviewed NRC evidence slice of the staged v2 design using additive relational
tables plus an owner-safe source/asset junction and private immutable originals.
Keep source rounding, unknown fields, minute/date precision and provider totals
distinct; resolve folder labels through visible evidence. Publish in one guarded
administrative transaction after object checksum checks, with stable import IDs,
immutable source revisions, replay safety and portable recovery. Reject direct
JSONB-library dumping, guessed streams/dates and automatic same-date merges.
Hosted v1 routes remain unchanged until a separate read/export cutover; this does
not complete Garmin/MASS cloud population. Verification: F06, synthetic PostgreSQL
tests and private live reconciliation/restore reports. No personal data in Git or
the free Gemini API.

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
| R07 | Confirmed, 5 November 2026 | Owner selects Prototype B / Field Notes for all future UI. Previous visual finish is still insufficient; pursue a substantially more expressive premium experience with coordinated motion, scroll flows, gradients and typography. |
| D16 | Owner-directed, 5 November 2026 | Work directly on master, pull GitHub master before new work and avoid new branches unless genuinely necessary. Master was fast-forwarded to 35f10d0 before this increment. |
| D17 | Selected direction, proposed finish, 5 November 2026 | Root becomes the Field Notes application; /studio keeps review states and accessibility/viewport tools. An illuminated route, Instrument Serif/Manrope typography, a narrative evidence chapter, linked detail, inline check-in and recap replace the flat comparison-first experience. Source and questionnaire contracts stay intact. |
| D18 | Adopted for prototype motion, 5 November 2026 | Pin GSAP 3.15.1 from the official npm package. Bundle only core and ScrollTrigger locally with copyright/licence notices; standard licence reviewed. Self-host Google Fonts Instrument Serif under OFL. Optional native View Transitions enhance activity switching with a feature-detected immediate fallback. No production framework migration or external map/data service. |

Current checkout reconciliation: master was pulled from origin/master to 35f10d0, including the merged prior refinement. Current work is on master by owner instruction. The Git root is the parent of the application folder. Remote visibility has not been verified. The included bundle is historical, not a continually updated backup.

## Reconciliation with prior documents

Reviewed `STRIDE_PRODUCT_BLUEPRINT_v0.9.md`, `CODEX_START_PROMPT.md` and `CODEX_STRAVA_INTELLIGENCE_HANDOVER_2026-10-31.md`. Keep their high quality bar, source provenance, no fabricated metrics, map/graph relationship, 30–45 second check-in and staged delivery. They are research/history, not parallel active instruction sets.

Supersede references to a future watch purchase, FR255 baseline and Strava-first ingestion. Detailed advanced feature catalogues remain backlog candidates. Prior model names, pricing, popularity counts and claims of full Garmin endpoint coverage are not adopted as implementation facts. The latest user request authorizes this foundation/research stage; it does not mean all prior proposed architecture or mockups were selected.

## Add a decision

D27 — Owner clarification, 6 November 2026. Interpret the July boundary as
1 July 2026 inclusive for v2 active history and backfill; source-local activity
date/measurement dateKey/health calendar date governs eligibility. Exclude older
records from migration/analysis without destructively purging existing backups.
Keep NRC/Strava screenshot candidates and source aliases in the proposed design.
MASS remains the initial weight recorder; app import/display exists and direct
quick weigh-in capture is a planned subsequent slice, not already shipped. These
clarifications refine D26 without replacing the agreed incremental plan.

D26 — Proposed database v2, 6 November 2026. Owner requests a thought-through
data/ingestion design before real population. Propose normalized owner-scoped
records, immutable private raw evidence/stream objects, revisioned source aliases,
durable ingestion/coverage ledger and deterministic derived projections. Current
single-library JSONB becomes a migration bridge, not the final data architecture.
Audit now finds 11 live Garmin activities and actual FR965 run/daily health data;
preserve cycling/breathwork and unknown fields rather than inherit the current
Run/Walk parser's filtering. Sixteen target tables and alternatives are documented
in docs/DATABASE_DESIGN_V2.md. This is not owner approval or a schema migration;
population and map development wait for the requested design discussion.

D25 — Free-only credentials and maps priority, 6 November 2026. Owner confirms
the Gemini key's project is on the Free plan; the earlier billing assumption
does not authorize paid requests. Configure 3.8 Flash/high thinking based on the
current official free-tier listing, require explicit free-plan attestation,
retain synthetic-only model input and no paid fallback. Model listing works;
one live synthetic Interactions request returned 503, so generation is not yet
verified. Supabase credentials authenticate but owner account and migration
remain missing. The next development priority is a real street-labelled map,
superseding the calendar as the immediate next slice. See credential status.

D24 — Owner-directed independent progress, 5 November 2026. Gemini, Vercel and
Supabase credentials are deferred. Advance the missing F03 MASS journal slice
locally: reviewable format 2 import, atomic source-ID/revision/tombstone merge,
original JSON preservation, weight chart and source-labelled session log, all
included in complete-library recovery. Treat Cardio separately from Strength;
unknown focus stays generic and no Garmin alias is inferred from a same-day
match. Use neutral descriptive weight statistics, not physiological claims.
No new dependency, external upload or model call. The next product slice is a
unified session/calendar and check-in queue; pending keys do not block it.

D23 — Owner-directed training UI and Gemini, 5 November 2026. Defer Supabase
provisioning; use the actual local Garmin library for a new training overview.
Keep Gemini on synthetic data only even after a key is added. Billing is
confirmed active, key pending. Use official Interactions REST documentation,
one forced review tool, request-specific schema plus local Ajv 8.20.0 validation,
bounded evidence and source-resolved chart values. Google currently deprecates
3.5 Flash in favor of 3.6, so default to configurable gemini-3.6-flash. Do not
claim live model verification or semantic certainty from schema validation.
This advances the bounded Gemini slice previously deferred in D08; it does not
enable personal-data AI or replace the existing activity UI. See F05 and
docs/GEMINI_ANALYSIS.md. D22 provisioning remains deferred, code retained.

D22 — Private-access candidate, 5 November 2026. Continue the owner's online/iPhone
plan with existing Vercel hosting and proposed Supabase Auth/Postgres/private
objects. Retain the existing app/runtime. Session identity is checked by Auth,
rows/files are owner-scoped, updates use revision checks and sync uses a lease.
Use PT409 for application conflicts. PGlite 0.5.15 is a pinned development-only
PostgreSQL verifier. Provider connections/deployment remain required; this is not
an online release or a completed production architecture. See docs/PRIVATE_DEPLOYMENT.md.

D21 — Owner-directed Garmin progression, 5 November 2026. Advance F04a explicit
local Personal API sync using the existing .env key and official endpoints.
Persist FIT originals/API summaries, stable provider aliases and sync status;
preserve check-ins and idempotent retries. Eight account records verified, seven
supported imported. No cloud data exposure or background automation is implied.
Display eligibility rules suppress pace on insufficient-distance recordings;
source values remain intact. See features/F04-garmin-local-sync.md.

D20 — Local alpha, 5 November 2026. Owner requests basic features and a
professional map. F02a uses existing Node runtime/pinned Garmin SDK for FIT
import, atomic private library, check-ins, export/merge restore and expanded GPS
exploration. Cloud architecture, basemap provider and private deployment remain
open. B's athletic direction is owner-accepted. No new runtime dependency/branch.

D19 — Owner-directed redesign, 5 November 2026. Keep selected B and premium
craft, replace the royal/hotel identity with an active fitness workspace.
Supersedes D17's serif/champagne visual treatment. Adopt proposed Barlow
Condensed/Manrope and carbon/orange/glacier styling, compact session hierarchy,
recorded pace trace and shared replay/inspection readouts. Four-answer check-in,
source provenance, missing-value and local-preview boundaries remain in force.
No new runtime dependency. Verification: docs/QA_ACTIVE_DESIGN.md. Exact visual
finish requires owner review; work remains directly on master.

For a material change record: ID, date, status, problem, chosen option, alternatives, consequence, verification and superseded ID. Small implementation choices belong in the feature record, not an unnecessary full architecture essay.
