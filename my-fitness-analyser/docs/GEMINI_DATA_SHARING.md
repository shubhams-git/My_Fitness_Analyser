# Gemini data sharing and analysis

Updated 19 November 2026. The hosted Training request queues a Supabase job. The Vercel worker checks its capability, lease, evidence signature and current consent before sending evidence to Gemini. Journal weight analysis has its own consent and runs synchronously.

## Consent and provider configuration

Account → AI preferences asks members to allow training and recovery sharing under `gemini-training-v3`. Earlier approvals require a new choice. The client sends the disclosure version it displayed, and Supabase checks the current version and revision at enqueue, claim, provider reservation, token counting, generation and publication. Switching off cancels pending work and hides saved briefings. Completed reports remain in the private database. Previously transmitted requests cannot be recalled.

Google prohibits personal and sensitive submissions to its unpaid service. `GEMINI_API_KEY` and the optional Free pool are for generated data only. Hosted Training and weight require `GEMINI_PERSONAL_DATA_APPROVED=1` and at least two distinct `GEMINI_PERSONAL_API_KEY*` credentials from an approved project. This setting records operator verification of provider terms and project configuration. The application does not enable billing or use a paid fallback automatically. The production project currently has no approved personal-data credentials. [Google Gemini terms](https://aistudio.google.com/docs/terms#unpaid-services).

## Training evidence

- Up to 24 recent outdoor Garmin runs with relative days, source, environment and time basis. Evidence includes available distance, duration, pace, heart rate, cadence, elevation gain, running power, best elapsed segments, up to 16 full-kilometre splits, and structured effort, breathing, finish and discomfort. Per-run zone detail covers up to eight runs when usable personal zones exist.
- Same-source comparable-run baselines and signed pace differences, recorded history coverage, recent and previous seven- and 28-day running totals, personal-zone period summaries, explicit running goals and 14 days of workout context. Workout context includes treadmill sessions and strength summaries with source overlap handled by calendar day.
- Up to 28 calendar days of available Garmin Connect recovery summaries. Sleep includes estimated sleep and naps, deep/light/REM/awake durations, unmeasured duration, sleep score, and device and sleep-window confirmation flags. HRV includes overnight and Garmin rolling weekly averages. Daily wellness includes resting heart rate, average stress, and Body Battery low, high, charge and drain. Per-feed status, relative dates, days with measurements, per-field coverage and recorded means for comparison windows accompany the observations. Days or fields without measurements stay missing. The prompt treats all wearable metrics as imperfect estimates, and bars diagnoses, medical advice, causation and readiness conclusions.

An explicit Garmin sync fetches the three range summaries for the connected member, then stores only the numeric/boolean allowlist and the dates in the member’s private library. Activity sync can succeed even when recovery is unavailable. The adapter retains previous observations on a failed feed and marks that feed unavailable. Read-only checks of the actual Garmin endpoints found partial sleep, HRV and daily wellness coverage across a 28-day window. Sleep need and provider narrative, HRV chart samples and HRV status text, movement, calories, respiration, oxygen saturation and Body Battery events are omitted. Watch model, account and device IDs, credentials, activity titles, GPS, FIT files, raw sensor data, exact dates and free-text notes stay out of the Gemini request.

## Input limit and routing

Each attempt calls the exact model’s `models.get` and `countTokens` before `generateContent`. The count wraps the complete generation request, including system instructions, the JSON response schema embedded in those instructions, and evidence. The remaining generation setting selects JSON MIME output. No tools, cached content or extra generation input fields are accepted by this path. The generation body uses the same serialized data that passed counting. The ceiling is the lower of 500,000 and the model’s advertised input limit. Models must advertise both generation and counting. Missing, malformed or failed counts and bodies that still exceed the limit after reduction stop the attempt before inference. The worker can then use its next model or save a recorded-data brief. It validates returned citations against the exact evidence sent.

Full Training evidence is checked first, with deterministic reductions to 12, 6 and 3 detailed runs and 14, 7 and 3 days of recovery rows. Splits and individual-run zone detail shrink with those views. History, coverage, period totals, recovery averages and available recent measurements remain. The fourth Training attempt starts with the six-run, seven-day view to reduce latency after the earlier attempts. Weight already uses a short 90-day evidence window and skips inference if its count cannot be verified.

| Attempt | Model | Training generation timeout | Weight generation timeout |
| --- | --- | ---: | ---: |
| 1 | `gemini-3.6-flash` | 120 s | 120 s |
| 2 | `gemini-3.6-flash` | 70 s | 50 s |
| 3 | `gemini-3-flash-preview` | 55 s | 35 s |
| 4 | `gemini-3.1-flash-lite` | 40 s | 25 s |

Model metadata and token counting share a 12-second preflight per attempt. Training uses one generation attempt per worker invocation, a five-minute lease, cooldowns and shared model backoff. Weight uses a 260-second overall deadline, and saved insights survive failed refreshes. The application rotates approved credentials at database reservation. Credential rotation does not raise a Google Cloud project's quota. [Models API](https://aistudio.google.com/api-reference/models), [token counting API](https://aistudio.google.com/api-reference/tokens).

## Request examples and verification

Regenerate with `node scripts/export-gemini-examples.mjs`. All payloads use generated measurements.

- Training: [prompt](gemini-examples/training-prompt.txt), [evidence](gemini-examples/training-evidence.json), [complete request](gemini-examples/training-request.json).
- Weight: [prompt](gemini-examples/weight-prompt.txt), [evidence](gemini-examples/weight-evidence.json), [complete request](gemini-examples/weight-request.json).

Local confirmed Free keys advertised both methods and a 1,048,576-token input limit for all three models. Each counted the full synthetic evidence at 33,100 input tokens. Full-payload generation probes returned HTTP 503. Flash-Lite completed a compact synthetic recovery report with two validated findings. Both count and generation usage reported 15,069 input tokens. No personal data went to Gemini during verification.

Apply `20261118120000_analysis_model_fallbacks.sql` before `20261119120000_training_recovery_consent.sql`, then deploy the worker and application together. Earlier production migrations were applied through SQL and there was no standard Supabase CLI ledger. This release records both applied files and their checksums in the private `fitness_release.migrations` table. Use the ledger and live schema to distinguish pending changes from previously applied SQL before retrying.
