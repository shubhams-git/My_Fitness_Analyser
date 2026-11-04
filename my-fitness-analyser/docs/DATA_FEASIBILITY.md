# Data feasibility, 4 November 2026

This is an authenticated, read-only account capture and offline file inspection. It is not a production sync service, database importer or application release. Owner confirmed that older account activities also belong to him and should be included.

## Evidence

- Official Personal API authentication, paginated activity listing, activity detail and original-file download succeeded against the owner's account.
- Seven activities were returned: four walks, one run, one track run and one breathwork activity. All seven originals passed FIT integrity and decoding checks with Garmin's official JavaScript SDK.
- FIT and API summaries agree on available distance, timer/elapsed duration, UTC start and average/maximum HR within the documented comparison tolerances. Captured detail/archive hashes are recorded and checked.
- Today's file identifies a Forerunner 965. Older files identify a Forerunner 255 Music. Older running samples establish actual field examples, not tested 965 running coverage.
- Six historical screenshots describe two activities. Owner supplied their calendar dates. Screenshots remain source evidence, with reviewable transcription and no reconstructed sensor stream.
- MASS format 2 contains 29 weight entries, five session rows (four active and one tombstone), two wellness entries, and empty measurements/nutrition collections. Source IDs, date keys and update/deletion markers remain intact.

Original responses, files, screenshots and transcribed personal measurements are in ignored `private-data/`. The detailed owner review is `private-data/DATA_REVIEW.md`. No key/token is included in those captures. These local files are not a durable database or off-device backup.

## Implications for the UI and importer

1. Summary, source evidence, user feedback and deterministic analysis are separate concerns. A historical record remains useful without a route or HR series.
2. Retain timer, elapsed and moving duration separately. They differ in the real samples. Clearly label the basis used for pace.
3. Laps can be manual, distance-triggered, final partial laps or activity-specific intervals. They are not automatically kilometre splits. Derived kilometre splits require a separately tested stream algorithm.
4. Timestamped records are not guaranteed to be one second apart. Preserve GPS gaps and per-field coverage rather than drawing fabricated continuous data.
5. Running samples contain GPS, HR, cadence, power and some dynamics fields, with differing coverage. Keep optional metrics conditional; validate against an eventual 965 Run file before promising identical availability.
6. API coordinates are decimal degrees; FIT position fields use the FIT profile's units. FIT cadence and fractional cadence cannot be copied directly into API steps/minute labels. Apply verified field/unit conversions at the adapter boundary.
7. API `startTimeGMT` is UTC despite lacking a Z; `startTimeLocal` is a local wall-clock string. Never parse both using the computer's default timezone. Preserve the provider timezone metadata.
8. Preserve screenshot rounding and conflicting displayed facts. One Strava fastest-split summary differs by a second from its split table; its last split distance has coarse precision. NRC's displayed zero HR is unavailable, not a valid measurement.
9. A screenshot medal is a provider assertion, not a calculated personal record. Do not interpret a displayed improvement as an effort completion time or infer event classification from the word "race" in a submission.
10. MASS session tombstones stay excluded, and a missing entry in a later partial export is not deletion. Wellness entries can have different fields; absent sleep stays absent.

## Reproduce locally

Node >=22; `npm ci --ignore-scripts` installs the pinned inspection dependency. `npm run check` remains the narrow foundation check.

```text
node scripts/fetch-garmin-sample.mjs
node scripts/inspect-fit.mjs <absolute-private-capture-directory>/fits
node scripts/verify-garmin-capture.mjs <absolute-private-capture-directory>
```

The fetcher reads project `.env` (`GARMIN_PERSONAL_API_KEY`, or existing `API_KEY`), uses fixed official HTTPS endpoints, keeps bearer tokens in memory, rejects redirects, limits response size/time, and stores each capture separately. It is deliberately bounded to 200 activities and fails rather than silently claiming a complete larger capture. It has no retry scheduler, durable sync cursor or database writes.

Before inspection, extract only FIT entries from the downloaded ZIPs into the capture's `fits/` directory, prefixing filenames with `activity-ID-`. Do not blindly extract archive paths. The current verifier expects one session/FIT per activity; multisport or other original formats need another strategy.

## SDK review

`@garmin/fitsdk` 21.221.0 is an exact pinned development dependency with a committed lockfile. Official publisher/repository: Garmin. Approximately 1.47 MB unpacked, no runtime dependencies or install scripts in the reviewed package; ECMAScript modules work in the current Node environment. The vendor FIT licence is retained in the package; this is not labelled MIT/Apache. SDK use here is local inspection, with production distribution still to be assessed when choosing runtime deployment.

## Primary references

- [Garmin Personal API FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/)
- [Garmin Personal API OpenAPI documentation](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/) (embedded OpenAPI 3.0.1 document, API version 1.0.0)
- [Official Personal API reference client](https://github.com/garmin/connect-personal-api-python)
- [Official FIT JavaScript SDK](https://github.com/garmin/fit-javascript-sdk)
- [FIT activity format](https://developer.garmin.com/fit/file-types/activity)

## Remaining gates

Real database import/idempotency, private storage authorization, re-import updates, recovery, automatic sync retry/expiry handling and device/browser UI verification are pending. The next bounded action is two populated Activity Detail/Quick Check-In prototypes using the now-inspected source capabilities.
