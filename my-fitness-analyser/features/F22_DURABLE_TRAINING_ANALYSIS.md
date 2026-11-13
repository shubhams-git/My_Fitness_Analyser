# F22 — Durable training analysis

## What runs and when

Training Today calls the private Vercel handler. Loading Training or Account
only reads state. Consent and the explicit Analyse/Update action are separate.
Progress, activity detail, import, and Garmin sync calculate from saved records
without calling Gemini. Journal has its own opt-in and explicit weight insight.
The local lab sends synthetic data only and has a 90-second timeout.

The server builds a bounded evidence snapshot from eligible outdoor Garmin runs
and recent workout context: measured running metrics, structured check-ins,
optional running goals and zones, and strength types, duration and focus. The
provider gets relative timing and fact references, no account IDs, GPS routes,
original files or notes. Missing recent evidence or workout-limiting discomfort
can produce a recorded brief without any model call. A successful current primary
report is cached; a stale or fallback report can be refreshed explicitly.

Previously the Training browser awaited the same request that ran the full
sequence. The code allowed 50s for 3.8 Flash (high), 55s for 3.6 Flash (high),
and 40s for 3.1 Flash-Lite (medium), with up to seven attempts, a 210s routing
deadline and a 300s Vercel ceiling. Each provider request used a 16,384-token
output limit including reasoning. The old Journal path used up to four attempts:
3.6 high/75s, 3.8 default/65s and 3.1 Flash-Lite default/40s.

Now the browser receives HTTP 202 and polls job status only while Training is
visible. Supabase persists the signed evidence and dispatches a job to Vercel.
The database schedule re-delivers due jobs and recovers expired five-minute
leases. A worker runs one attempt at a time. A duplicate click returns the
existing job. The browser sends the initial POST with keepalive. Once queued,
the job can finish after navigation, closing the browser or signing out.
Consent revision is checked before transmission and when publishing. Revoking
permission clears pending evidence and prevents publication. Changes to the
training record make an earlier snapshot stale when the report is read. The
latest successful report remains owner-scoped in `analysis_reports`.

| Training attempt | Thinking | Request timeout |
| --- | --- | ---: |
| Gemini 3.6 Flash | Model default | 220s |
| Gemini 3.5 Flash-Lite | Model default | 220s |

Training sends no thinking configuration or output token override. It requires
two distinct configured Free-tier keys and reserves the next key for each
provider attempt using the shared Supabase budget.

Training uses Gemini's `generateContent` API for single requests with structured
JSON. The model writes the verdict and findings from the full evidence packet.
The app reconstructs citations and direction from fact references and validates
every claim before saving. If all models fail or the app reaches its daily
budget, the worker saves a labelled report calculated from recorded training.
It includes comparable pace, weekly distance, splits and check-ins when present.
An incomplete response, timeout, capacity error or invalid output can advance
the job to the next model. No fan-out or paid fallback. Training's Analysis
details shows the model, requested thinking level, elapsed request time,
outcome, HTTP error code and thinking tokens when Google returned them. Each
attempt is separately bounded by a 300s Vercel function and a 260s dispatch
request. Stuck jobs expire after 30 minutes or repeated worker interruptions.

Journal requests one 3.6 Flash attempt through Generate Content with default
thinking and the same 220-second timeout as Training. Both flows require two
distinct Free-tier keys and rotate through the same app-wide database
budget. Training enforces a 65-second interval and a 20-request Pacific-day
cap. Journal can retry as soon as its previous review ends, subject to Gemini
backoff. Optional
confirmed Free credentials rotate within the same budget. Google measures quota
by project and model; additional keys do not raise this app's budget. A 429
backs off the affected model for at least 65 seconds, or for Google's longer
retry delay where available. This app's cap cannot account for calls from other
apps using the same projects. The Free flags record configuration confirmation;
they cannot detect a future billing change on Google Cloud.

## Release and verification

Apply [the job migration](../supabase/migrations/20261113190000_durable_training_jobs.sql)
and [the dispatch migration](../supabase/migrations/20261113190100_training_job_dispatch.sql)
in order with the production database administrator. The new request budget
does not require the old key rotation migration. The core migration retires the
legacy training write RPCs, so coordinate migration and production deployment.
Set the production origin in
`public.training_worker_config` as administrator (no service-role key or extra
credential in Vercel):

```sql
insert into public.training_worker_config (origin)
values ('https://YOUR-PRODUCTION-APP.vercel.app')
on conflict (singleton) do update set origin=excluded.origin;
```

Confirm the job scheduler is active and the production worker responds 405 to
GET. On a consented member's Training page, submit one update, wait for the queued
acknowledgement, leave the page and return to check its status and saved result.
Check metadata without dumping personal inputs. Restore prior code only with a
matching database rollback plan; toggling the dispatcher alone stops processing.

PGlite executes the migrations, with stand-ins for `pg_net`/`pg_cron`; the worker
test covers duplicate enqueue, anonymous capability denial, cross-member read
denial, lease recovery, pacing shared with weight, fallback persistence and
revocation. The earlier 3.5 Flash-Lite route completed a validated two-finding synthetic
brief in 7.58s, with 1,758 thinking tokens. A repeat primary call returned HTTP
503 in 3.21s. Flash-Lite 3.1 on low returned a validated verdict in 30.45s,
with 96 thinking tokens. On medium its brief failed validation after 4.04s.
The older Interactions route returned HTTP 503 on 3.8 high (2.45s),
3.6 medium (38.00s), 3.1 Flash-Lite medium (3.83s), and 3.8 medium (1.72s).
These are failure latencies; no thought-token count was returned. The probe
uses synthetic data and waits at least 65 seconds between requests. To repeat:

```sh
node scripts/check-coach-live.mjs --route
node scripts/check-coach-live.mjs gemini-3.6-flash
```

A one-word 3.8 Flash/low request also received HTTP 503 on Interactions
(1.32s, provider message cited demand/capacity). A separate `generateContent`
control hit its 30s local deadline. Neither result supports attributing the
503s to high thinking or to the structured training prompt alone.

## Garmin follow-up

Garmin's [program overview](https://developer.garmin.com/gc-developer-program/overview/)
labels Personal API delivery pull-only. The [Business Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/)
supports push or ping/pull depending on access. This owner's Personal API key
does not receive an upload event from the Forerunner or Garmin Connect.

The next feasible increment is a scheduled, owner-bound poll (start at 10–15
minutes, verify the provider's project limits). Fetch the newest activity IDs,
reuse the existing FIT import and lease, and save an idempotent event after a
previously unseen outdoor run commits. Suppress events for treadmill, indoor,
virtual, other activity types, duplicates and initial history backfill. With
separate automatic analysis consent, that event can enqueue the same job;
manual Update analysis remains available. Implementing the poll needs a narrow
server identity for the bootstrap owner's import without a browser session.
Neither polling nor automatic Gemini sharing is enabled in this release.
