# Gemini analysis: data, prompts and failure recovery

Checked 18 November 2026. This describes the hosted Training and General/Journal
weight paths. `analysis/gemini.mjs` is a separate synthetic-only local lab.

## Exact prompts and example payloads

These files are generated from the actual production request builders using
invented records. They are examples, not copies of a member's health history.

- [Training prompt](gemini-examples/training-prompt.txt)
- [Training evidence, decoded for reading](gemini-examples/training-evidence.json)
- [Complete Training HTTP body, including output schema](gemini-examples/training-request.json)
- [Weight prompt](gemini-examples/weight-prompt.txt)
- [Weight evidence, decoded for reading](gemini-examples/weight-evidence.json)
- [Complete weight HTTP body, including output schema](gemini-examples/weight-request.json)

Regenerate with `node scripts/export-gemini-examples.mjs`. In each request,
`systemInstruction.parts[0].text` is the prompt; `contents[0].parts[0].text`
is a JSON string containing the evidence. `generationConfig` requests JSON and
supplies the output schema. No search, browsing or database tool is enabled.
The server credential travels in the `x-goog-api-key` header, outside the body.

## Weight input

The server reads the member's journal and goal versions, then builds
`analysis/weight-evidence.mjs`. Only this derived evidence is transmitted:

- Up to the latest 90 calendar days ending on the last recorded weigh-in:
  daily scale kg, smoothed trend kg, individual reading count and days before
  the latest observation. Older history seeds the trend but is not sent as rows.
- Calculated facts: recorded days/readings, period length, last-reading age,
  latest scale/trend/difference, change and gap from the previous recorded day,
  period trend change, recent recorded range/deviation and robust weekly rate
  when enough observations exist.
- Weight goal context when present: kind, status, revision, relative start,
  deadline presence, target, current progress, remaining amount, baseline,
  direction and relative timing. Running goals are excluded.
- Evidence/schema versions, evidence hash, calculation method and rules for
  missing observations, direction and stale data.

For example, an observation can be
`{"daysBeforeLatest":3,"scaleKg":79.1,"trendKg":79.4,"readings":1}`.
There are no names, account IDs, email addresses, absolute weigh-in dates,
notes, original MASS exports, training history, GPS, sleep or nutrition records.
Scale values are still personal health data despite removing identity fields.

## Training input

The server reads owned activities, structured feedback, goals, zone versions
and recent strength entries. `analysis/coaching-evidence.mjs` transmits:

- Up to 12 recent eligible outdoor Garmin runs, referenced as `s01`, `s02`,
  etc.; relative days ago, source/environment, timing/pace bases, limitations,
  full kilometre split count, structured breathing, finish and discomfort.
- Measured facts when available: distance, duration, pace, average HR, cadence,
  elevation gain, running power, fastest elapsed 400/1000/2000/5000 m segments,
  reported effort, opening/closing/full kilometre paces and signed changes.
  At most 16 full kilometre split facts per selected run.
- Personal HR/pace zone boundaries and distribution metadata for up to eight
  selected runs; calculated zone times/shares and recent 28-day zone summaries.
- Comparable-run references, median baseline pace and signed/magnitude changes;
  history counts/distance/active days and recent versus previous 7/28-day totals.
- Explicit running goal context and calculated progress (weekly distance/time
  benchmark), revisions and relative timing. No weight readings are included.
- Recent 14-day non-running workout context grouped by relative day and kind:
  session counts, recorded duration, recognised strength focus, overlap count
  and aggregate counts/time. Example:
  `{"daysAgo":2,"kind":"strength","sessions":1,"durationS":2400,"focuses":["Legs"]}`.
- Evidence version, scope, history/truncation metadata, fact units and references.

The internal `mapping` from `s01` to a real activity ID stays on the server.
GPS coordinates, routes, raw sensor streams, FIT files, provider tokens, names,
email, account IDs, activity titles, notes and exact activity dates are excluded.
Structured discomfort is health information. Workout-limiting discomfort or
insufficient recent evidence can produce a recorded brief without calling Gemini.

## Recovery changes

Both hosted paths now share this sequential route, with default model thinking:

| Attempt | Model | Deadline |
| --- | --- | --- |
| 1 | `gemini-3.6-flash` | 70s |
| 2 | `gemini-3.6-flash` | 70s |
| 3 | `gemini-3-flash-preview` | 55s |
| 4 | `gemini-3.1-flash-lite` | 40s |

Each provider attempt reserves the next credential in the shared database pool.
At least two distinct Free-confirmed keys are required. Rotating keys does not
increase a project's quota. A quota response records shared model backoff;
blocked models are skipped. Training retains durable jobs, pacing and its daily
app budget. Weight remains a synchronous HTTP request with a maximum 235 seconds
of provider time plus database overhead, within the 300-second function limit;
a browser/network interruption can still prevent delivery of its response.
Training ultimately saves its labelled recorded-data brief if Gemini cannot
produce a valid result. Failed weight analysis preserves earlier reports.
Consent is checked at reservation and publication; weight evidence is rebuilt
before each attempt and before saving. Provider output still passes local checks.

Previously weight made one 220-second call. Its SQL permitted only one reservation
and only 3.6 Flash, and rejected Preview in saved attempt metadata. Training used
3.5 Flash-Lite as fallback; SQL stopped unsuccessful jobs at step two. Adding a
model name in JavaScript alone would not fix these database restrictions.

Apply `supabase/migrations/20261118120000_analysis_model_fallbacks.sql` with the
matching application deployment. It permits four bounded weight reservations,
the requested fallback IDs, matching per-model backoff, and Training's fourth step.
Existing grants and owner/consent checks are preserved. This local change does
not establish that production has been migrated or deployed.

Official model references checked: [3.6 Flash](https://aistudio.google.com/docs/models/gemini-3.6-flash),
[3 Flash Preview](https://aistudio.google.com/docs/models/gemini-3-flash-preview),
[3.1 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite).

## Verification, 18–19 November

`node scripts/check-coach-live.mjs --route` made four sequential real Gemini
requests with generated training records and rotating configured Free-confirmed
keys. It did not read or send the member's health library.

| Model | Result | Elapsed |
| --- | --- | ---: |
| 3.6 Flash, first key | Local request deadline | 70.01s |
| 3.6 Flash, next key | HTTP 503 | 5.75s |
| 3 Flash Preview, next key | HTTP 503 | 52.67s |
| 3.1 Flash-Lite, next key | Validated report, two findings | 4.06s |

Flash-Lite reported 11,846 input and 563 output tokens. This proves this prompt
can succeed through the final fallback; it does not establish a general provider
availability rate or the cause of Google's 503 responses. The diagnostic exits
nonzero if any probed model fails, even when the final model succeeds.

All 148 tests passed with `node --test --test-concurrency=1 tests/*.test.mjs`.
The parallel run encountered local PGlite initialization failures; serial execution
passed the same database tests. Foundation and cloud configuration checks passed.
SQL tests use local PostgreSQL/PGlite, not the production database. A readiness
request without a member JWT returned 401, as expected for this authenticated RPC;
no signed-in production analysis or migration was verified in this session.
