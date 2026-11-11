# F20 — Goals and goal-aware coaching

11 November 2026. Member-entered weekly running distance, elapsed benchmark time
and weight goals. Training and Progress show running progress; Journal shows
weight progress and a goal marker without stretching its measured axis. Targets
are blank until entered. Date-effective revisions retain history; pauses start
on the date shown. Goal computations are independent of the displayed history
window. Existing imports remain canonical, and screenshot summaries never
become measured benchmark segments or sensor streams.

Running Gemini evidence includes matched personal zone time and shares for the
latest eight runs, a 28-day distribution, settings versions and explicit running
goals. Weight analysis gets only weight goals and trend facts. No GPS, names,
notes, absolute dates or cross-domain goals are sent. Strict schemas and citation
checks apply to every model. Existing reports remain available as previous
insights; effective goal/zone changes invalidate the current cache.

Intensive routing: 3.6 Flash high → 3.8 Flash with thinking omitted → 3.1 Flash-Lite.
Basic routing: 3.8 Flash low → 3.6 Flash low → 3.5 Flash-Lite low → 3.1 Flash-Lite.
Current run and weight coaching use the intensive route. Goal calculations do
not call AI. Requests are bounded and recheck consent and evidence before every
attempt. Successful models and sanitized attempt metadata are saved; failed
attempts do not overwrite prior valid reports.

Keys rotate per request in each warm server process; cold starts select a random
initial slot. GEMINI_API_KEY is the existing primary. Optional GEMINI_API_KEY_2
through GEMINI_API_KEY_5 are used only with GEMINI_KEY_POOL_FREE_CONFIRMED=1,
after confirming every additional project is Free. Existing
GEMINI_FREE_TIER_CONFIRMED=1 remains required. Local env changes do not update
Vercel. Google quotas apply per project, so multiple keys do not create a
guarantee or extra shared-project quota. No paid fallback.

References: https://ai.google.dev/gemini-api/docs/models
https://ai.google.dev/gemini-api/docs/pricing
https://ai.google.dev/gemini-api/docs/thinking
https://ai.google.dev/gemini-api/docs/rate-limits

126 tests and foundation checks passed. Additive migration ran successfully
against Supabase. Quick Impeccable source review led to dated pause actions,
explicit discard/reload with focus restoration and distinct goal link labels.
Source detector scanned goal files; its journal-chart scan reported an
operational error. No physical Safari test claimed.

Release b2ac951 deployed successfully on Vercel. Signed-in Account loaded the
blank weight editor and Cancel; Journal rendered the goal alongside real history.
Phone preview rendered the weekly target without horizontal overflow using a
test target. A real synthetic zone/goal briefing passed strict validation on
3.6 Flash high on its first attempt. Multi-key and failure paths were exercised
with simulated transport. No live personal goal was created during verification.
