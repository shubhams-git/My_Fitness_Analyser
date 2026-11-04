# Architecture proposal

Status: proposed; no application runtime scaffold, cloud database or deployment exists. Read-only Node capture/inspection scripts now verify initial Garmin access; see docs/DATA_FEASIBILITY.md. They do not select the application framework or establish production synchronization.

## Small default

Recommend one TypeScript application, with React/Next.js as the initial candidate; server-side integration routes; Postgres/auth/private file storage (Supabase candidate); and a thin provider adapter for Garmin. Hosting and exact versions are selected after a real-file/API feasibility check and current free-tier review. Vercel remains a candidate, not a promised zero-cost deployment. If the user chooses Sites hosting, re-evaluate its runtime, database and identity capabilities rather than forcing a second hosting model.

No separate Python service by default. Garmin's official Python client is a useful authentication/reference implementation, not a reason to create a second production runtime. Use the official FIT JS SDK if its licence, format handling and runtime fit pass inspection.

## Boundaries

`UI → application service → validated domain records → repository/database`

Import adapters preserve raw originals and emit the same canonical representation. Analytics are pure, versioned functions over canonical data. Optional AI receives an allowlisted evidence bundle after the deterministic layer works. Credential/token handling lives server-side; the browser never receives provider secrets.

Use database ownership rules and server authorization even for one user. Store summaries and queryable metadata in Postgres; keep original FIT and bulky streams in private object storage, with hashes and references. Exact schemas come with the first feature migration, not a speculative 25-table model.

## Garmin integration reality

The official Personal API documents owner-only activity JSON/FIT and health JSON, delivered by pull. The athlete's existing Garmin-to-Strava sync does not connect this app. A Personal API key/token setup or a manual FIT export is still required. Keys have configurable expiry; access tokens last up to 24 hours with no refresh-token flow. Verify actual endpoint availability, ranges, pagination and rate limits against a real authenticated account before committing to automatic backfill.

Connector first uses explicit refresh with resumable pagination, stable activity IDs and retry/backoff. Scheduled pull is a later addition after a reliable deployment path exists. A page-open refresh is not described as background automation. Keep manual original-file import available.

## MASS integration reality

The existing export provides a validated starting interface. There is no demonstrated live API. First use periodic JSON import, stable source IDs, update timestamps and deletion markers. Automatic updates require an audited supported feed, shared backend or deliberate change to MASS. Do not scrape its visible screen or claim shared cloud storage because both apps are websites.

## Extensibility

Reserve athlete ownership, source references and schema versions now. Add new adapters and features when needed. One deployable application, one database and one clear source of truth are preferable to microservices, an event bus or an all-purpose plugin framework at this scale.

## Recovery and operation

Database migrations are tracked and tested on a disposable environment. Backups include original files and database records; Git does not back up health data. Keep credential rotation, sync status and import errors inspectable. Restore and re-import are tested before the first real-data release. Retention, account deletion and service costs are explicitly decided before production use.
