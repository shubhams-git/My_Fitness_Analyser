# F08 — optional Gemini coaching briefings

7 November 2026. Owner explicitly authorises processing run-related data with
Gemini, requires zero cost, and requests a reversible choice for every member.
This supersedes the app's synthetic-only transmission policy for opted-in members.
It does not change Google's terms; the sharing disclosure links them and explains
free-service data use, human review and the personal/sensitive-data restriction.

## Delivered design

Training shows a non-blocking first-use choice, equally styled Allow / Keep AI off
actions and a progressive disclosure of what is shared. Nothing is preselected.
Declining preserves ordinary charts, imports and check-ins. Account → AI preferences
can enable/disable analysis later. Consent persists by Auth owner across devices;
the disclosure is versioned, with an immutable event history. A changed disclosure
requires a fresh choice. LocalStorage carries only a cross-tab change signal.

Enabling is separate from generating: there is no model call on login, GET, consent
save or ordinary navigation. Users explicitly Generate/Update a briefing. Turning
off stops new requests, cancels unpublished results and hides saved reports. It
does not undo data already sent or delete historical reports. Shared rows/storage
remain isolated; the owner's permission never authorises another member's data.

## Evidence and contract

coaching-evidence-v1 includes July-onward imported running totals, up to sixty
recent run summaries, relative timing, pace/time bases, full-kilometre opening vs
closing splits, available HR/cadence/elevation summaries and structured effort,
breathing/finish answers. Names, email, exact dates, route coordinates, source
images, raw streams, free-text notes, credentials and DB identifiers are excluded
from the provider payload. The local citation mapping is stored privately.

NRC has its own historical comparison cohort: same source, environment and pace/
duration basis, distance within twenty percent, at least two older sessions.
Garmin is separate; indoor unusable pace stays excluded. Effort/weather/terrain
are not silently assumed equal. Compared values are descriptive, not a fitness
diagnosis. Previous/recent seven-day imported distance and count remain explicit
about incomplete import coverage. Full-history totals and truncation are labelled.

The report has a thirty-word verdict, up to three findings (fourteen-word headline,
forty-five-word explanation, twenty-five-word action), evidence references,
measured/interpretation classification and up to two supported chart selections.
Numbers in prose use fact placeholders, resolved to exact source-backed units by
the UI. Schema is request-specific: unavailable finding kinds and missing sensor
chart references are excluded before generation. Ajv enforces the full contract;
further checks reject unbound values, unknown references and unsupported claims.
No arbitrary generated HTML, chart arrays, SQL, database tools or web research.
These controls reduce errors; they do not prove all language is entailed by facts.

## Runtime and recovery

cloud/intelligence.mjs uses the official Interactions REST JSON response_format,
Api-Revision 2026-05-20, store:false, high thinking and a 16,384-token cap including
reasoning. Fixed Google destination, bounded response, ninety-second timeout,
sanitised errors. No automatic retries, model fallback or billing changes.

The deployment uses configured gemini-3.6-flash: 3.8/3.7 returned 503 during live
synthetic probes, while 3.6 completed a validated response after schema tightening.
Only documented Flash models are accepted; GEMINI_FREE_TIER_CONFIRMED must be 1.
This flag records the operator's confirmation; it cannot independently detect a
later provider billing change. No claim of a universal dollar cap is made.

ai_preferences, ai_consent_events and analysis_reports have owner RLS. RPCs validate
membership, bind auth.uid(), serialize consent/claim/finish, enforce one active
review, a one-minute cooldown and three new attempts per UTC day. Reports are
cached by owner/evidence/model/prompt/schema fingerprint, independently revalidated
on read, and marked stale when the record/window changes. A consent revision change
prevents an in-flight result from publishing; an already transmitted request cannot
be recalled. Last valid reports survive errors. Export includes all three tables.

## Verification

56 automated tests include actual PostgreSQL migration/RLS, revocation during
generation, member isolation, no-consent/no-provider access, cache/persistence,
unsupported measurements and quota errors without fallback. Foundation and
whitespace checks pass. Browser fixture exercises decline, allow, generate,
evidence/chart disclosures and Account opt-out; its reports explicitly say fixture.
No live synthetic activities/check-ins are inserted into the database.

Live provider evidence: first 3.6 synthetic result was correctly rejected for
misclassified pacing and unavailable chart references. Dynamic schema tightening
then passed a complete 3.6 high-thinking synthetic review. Raw proof stays ignored
under private-data/ai-qa; source code contains no personal records or keys.
The additive migration is applied live. Production verification is recorded after
deployment; physical iPhone Safari and broad coaching-quality evaluation remain.

Official references: [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest),
[Interactions schema migration](https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026?hl=en),
[thinking](https://ai.google.dev/gemini-api/docs/thinking),
[pricing](https://ai.google.dev/gemini-api/docs/pricing),
[terms](https://ai.google.dev/gemini-api/terms).
