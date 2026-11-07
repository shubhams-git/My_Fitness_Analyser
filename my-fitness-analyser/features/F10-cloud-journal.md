# F10 — private body journal and quick weigh-ins

Active, 7 November 2026. Continue the agreed daily-recording roadmap after maps.
Preserve MASS as a supported source; add deliberate manual entry alongside it.

Acceptance: authenticated per-member cloud history; preview/repeat-safe MASS
imports with verified immutable originals; dateKey/source timestamp/tombstones
retained; fast kg entry, date and optional note; edit/remove/restore with immutable
revisions, stale-save checks and request receipts; same-day readings stay distinct
and require acknowledgement; source-labelled chart/table and unchanged rolling
mean rules; export includes all journal revisions and verified originals.

Use additive body_measurements, journal_sessions, journal_imports, journal_heads
and journal_mutations tables. Reads use member RLS; narrow mutation functions
derive the owner from auth.uid(), check membership, pin an empty search_path,
and have explicit execute grants. Direct row mutation is unavailable. A per-member
head serialises writes and invalidates stale import previews. Client operation
UUIDs survive failed replies; reused IDs with different payloads are rejected.

Preview parses without saving. Commit resends the same original with its hash and
reviewed head revision: no server-memory token is assumed on Vercel. Upload/check
the private original before a transactional publication. An upload whose commit
fails may remain privately archived; no partial measurement rows are published.
The UI limit is 3.5 MB, below the hosted request limit. No new dependency or paid
service. Data from before July 2026 does not enter active history; newer source
corrections moving a known row outside scope can retire its previous projection.

The current Field Notes identity remains. Recording takes visual priority over
introductory copy. Decimal keyboard, explicit kg, visible labels/focus, saved/error
states, retained unsaved values and reduced-motion support matter more than
decorative motion. No weight-loss judgement, inferred body composition, invented
readings or automatic Gemini transmission. Manual strength capture remains next.

Verification: 67 automated tests pass, including owner/anonymous boundaries,
idempotent writes, same-day acknowledgement, source conflict rollback, tombstone
resurrection prevention, exact original bytes and independent database restore.
Live SQL confirms row security on all five tables and no anonymous execute on the
three journal functions. Mutation functions pin an empty search_path and validate
membership; read uses invoker security. The SQL editor initially duplicated the
migration buffer, causing rejection/rollback; the clean migration was then applied
and verified through the catalog. Existing training tables/data were not changed.

Rendered synthetic loopback PostgreSQL fixture checks: save/reload/edit/remove/
restore, same-day acknowledgement, repeated import, invalid input and stale saves
across two tabs. The losing tab retains its unsaved value. 375px portrait and
852px landscape show no horizontal overflow. Phone entry is compact; the chart
uses a smaller coordinate viewport with readable axis labels. This is Chromium
viewport testing, not physical iPhone Safari. Real owner weigh-ins were not
invented for testing. Code release 29bd2ea deployed to master/Vercel. The owner-signed-in production
journal imported the supplied MASS original: 29 weight rows, four active sessions,
one source tombstone, one import and zero manual test rows. SQL catalog and row
reconciliation agree. All-history UI shows 29 readings; a complete v2 export was
downloaded and every original's hash verified. All weight/session source fields,
including t/dateKey/update/deletion values, match the supplied file. Its original
6,604 bytes match exactly. Private reconciliation/backup evidence is under
private-data/journal-qa. No source health values, files or credentials enter Git.

The first full export took more than 45 seconds. Final polish bounds independent
reads to four, verifies the journal head before/after, and exposes preparation
feedback through a short-lived download link. A concurrent journal mutation now
rejects the archive rather than silently mixing revisions. Selected history
windows persist in the URL; historical mean/last-reading dates remain explicit.
Final polish deployment/re-import checks are pending. Actual owner manual entry
and physical iPhone Safari are still separate from synthetic SQL/UI verification.
