# F12 — continuous weight trend and Gemini insight

8 November 2026. Owner supplies MASS reference and explicitly requests a continuous
curve across unrecorded days, sleek presentation and engineered Gemini analysis.
This supersedes F11's broken raw-value line as the primary weight visualization.

Design plan: retain Field Notes carbon canvas #080E16, surface #111C29, text
#F2F7FC, muted #B8C2CE and the existing blue heartRate token; no new palette.
Use Manrope for trend figures/copy; Barlow stays in app titles. Primary white
trend, subtle downward area fill, muted actual-reading dots with deviation stems.
One trend card followed immediately by a concise insight; entry remains beside it
on desktop and first on mobile. Avoid extra metric series, glows and detached
sliders. Use direct/keyboard/day-button inspection and accessible source entries.

Method: calendar-aware exponential average, seven-day half-life, initialized from
all available daily average readings before applying a viewport window. Smooth
joins connect daily interpolated trend values across missing days. After the last
weigh-in, hold its trend level without extrapolating a slope; dashed tail and
dated label identify the held estimate. Actual values/timestamps stay unchanged.
No stored rows are created for interpolated/held days. No observations at all
still yields an empty state. The screenshot is a visual reference, not a newly
authorized weigh-in import or proof of a particular smoothing formula.

Gemini design: separate versioned weight opt-in, explicit generation, a reversible
setting on the insight card and private per-member reports/audit. Existing run
sharing remains independent. Minimise the payload to daily-average weight,
relative day offsets and calculated facts; exclude identity, absolute dates,
notes, GPS, credentials and source files. No database or browser tool for the LLM.

The evidence covers up to 90 days ending at the last observation, includes its
age and uses recorded days only. Recent weekly rate is the median of observed
pair slopes at least seven days apart, requiring four days spanning two weeks.
Trend, rate, variation and coverage are deterministic; Gemini ranks/interprets
them. No goal, fat/muscle change, safe/ideal weight-loss rate or cause is inferred.
Stale history requires an age citation and a fresh-reading next step.

Request-specific JSON schema bounds one headline (16 words), explanation (55),
evidence references, supported focus and next-step enums, and 1–2 evidence chips.
All quantities use fact placeholders. Ajv plus semantic gates reject unbound
numbers, unknown facts, unsupported finding kinds and selected physiological
claims. This reduces risk; it does not prove every prose claim is entailed.

Use the deployment's supported Flash model, high thinking, store:false, bounded
output, 90-second timeout and confirmed Free-tier flag. No automatic retries,
paid fallback or billing changes. Cache by owner/evidence/model/prompt/schema;
show stale reports explicitly. Check data again before publication and consent
again before transmission and in the transactional finish function. Owner-only
RLS, scoped functions, per-member request claim, rate limits and cancelled pending
results on opt-out follow the existing run architecture. Add three weight-specific
tables to complete exports. New measurement/import activity invalidates evidence.

Reference: official [Interactions API](https://ai.google.dev/gemini-api/docs/interactions),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output) and
[pricing](https://ai.google.dev/gemini-api/docs/pricing), retrieved 8 November 2026.
Google documents a schema subset and unenforced constraints; application-side
validation remains required. Gemini 3.6 Flash currently lists free input/output
including thinking. The flag records operator confirmation, not a universal cost
cap if their project tier changes. Free-service terms and human-review/data-use
disclosure remain linked in the member sharing choice.

Verification in progress: 75 automated tests pass. Synthetic PostgreSQL UI tests
exercise opt-out/generation/reload and responsive chart inspection. Production
migration/deployment/model output and final evidence are recorded below when done.
