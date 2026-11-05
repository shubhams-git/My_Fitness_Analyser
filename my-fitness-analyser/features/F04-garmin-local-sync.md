# F04a: Garmin Personal API sync, local alpha

Implemented 5 November 2026 following the owner's request to progress with actual
API data. This advances manual Garmin sync ahead of the remaining F03/cloud work.

Open the local app and choose **Sync Garmin**. The server reads project `.env`
(`GARMIN_PERSONAL_API_KEY` or `API_KEY`); bearer tokens remain in memory. No
credential is accepted from or returned to the browser. Fixed official HTTPS
endpoints supply activity pages, detail and original ZIP downloads. Archives are
decoded in memory; entry names are never used as filesystem paths.

Sync paginates by 20, bounded at 1,000 activities. Supported running/walking
types enter the library; other types are explicitly counted as unsupported.
Repeated IDs are ignored within one list. FIT hashes attach manual imports to
Garmin IDs. Changed FITs retain canonical identity/check-ins, preserve originals
and update provider metadata. Conflicting duplicate check-ins stop the merge.
Failed files remain retryable; successful imports remain available. A full retry
revisits history idempotently rather than pretending a partial run was complete.
Garmin deletions never delete local history automatically.

401 triggers one token renewal. Throttling/transient server errors get bounded
retries. Redirects are rejected; response size and request duration are bounded.
One sync runs at a time. Last successful sync is retained across failed attempts.
No provider error body, key or bearer token is logged or persisted.

Garmin summaries and FIT summaries are retained separately; provider-local time
and the FIT UTC start are explicit. Activity identity and start time are checked
before attachment. GPS gaps stay missing. Display pace is withheld below 10m
recorded distance and above 60min/km; low-distance blocks also withhold pace.
Raw measurements remain unchanged. Available HR becomes the initial chart for
an otherwise unusable distance recording.

Live evidence: eight activities found, seven supported activities saved (four
walks, two runs, one track run), one breathwork entry unsupported. First pull
added six and attached one existing manual import. Repeat verification added
zero, updated zero, left seven unchanged, with no failures. The new FR965
treadmill recording has HR and no GPS; it is not assigned a fabricated route.

Automated: 14 tests cover token renewal, throttling, bounded archive parsing,
provider updates/check-in retention, backup metadata restoration, pagination,
partial failure/retry and existing import/storage contracts. Browser checks cover
real-data selection, missing GPS/distance, available-series selection, empty
check-in answers, phone controls and the sync action. Real-data artifacts and
library remain ignored. No owner answers are generated during verification.

This is explicit local sync, not scheduled background sync or a private online
deployment. Hosted Vercel remains a synthetic preview. Physical Safari and
private hosting/authentication/database setup remain separate gates.

Official references:
- https://developer.garmin.com/gc-developer-program/personal/personal-faq/
- https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
- https://github.com/garmin/connect-personal-api-python
