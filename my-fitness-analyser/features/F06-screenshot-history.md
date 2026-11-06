# F06: reviewed screenshot history

Active slice: NRC screenshot extraction, private evidence archive and relational
publication. Acceptance: every supplied image inventoried and preserved; all
distinct runs represented with source precision, nulls and field evidence;
same-date sessions remain separate; repeat publication creates no duplicates;
uploaded bytes verified before the transaction; owner isolation and recovery
checked. No personal screenshot, transcription, SQL seed or identifier in Git.

The evidence slice uses nine new tables: source_accounts, raw_assets,
ingestion_runs, ingestion_items, activities, activity_sources,
activity_source_assets, activity_segments and record_changes. The junction table
enforces owner-safe asset references instead of unvalidated JSON asset-ID arrays.
Other v2 domains remain staged. Existing fitness_libraries/check-ins are intact;
creating these tables does not switch hosted routes to the new model.

`imports/screenshot-evidence.mjs` compiles a visually reviewed candidate, not OCR
or an AI guess. Fields retain labels, units, precision and image SHA256 links;
full source values and review discrepancies live in immutable source revisions.
Canonical IDs use an owner-scoped UUIDv5 import key. Provider identity is not
guessed from dates/distances. Legacy prototype aliases are retained explicitly.
The first import refuses a different existing accepted source revision; editing
or merging requires a subsequent reviewed, version-checked operation.

The controlled administrative SQL transaction verifies private storage object
existence, byte lengths and server ETags against local MD5 before publication.
It accepts a direct MD5 or the checked one-part composite ETag used by this
dashboard's resumable uploads; it does not treat an arbitrary ETag as file MD5.
Unknown checksum formats fail closed. The verification.sql compares every typed
row and source/evidence JSON field to the portable publication after insertion.
SHA256 names independently identify archived bytes. Anonymous access is revoked;
authenticated users can read only their allowlisted owner rows. This increment
adds no client write grants or public import RPC. Credentials remain unchanged.

Offline commands, from app root:

```powershell
node scripts/prepare-screenshot-import.mjs private-data/review.json private-data/import-name
node scripts/verify-screenshot-archive.mjs private-data/import-name
node --test tests/screenshot-evidence.test.mjs
```

The review JSON is private: version, cutoff, reviewedAt, yearEvidence, files,
runs and monthlyAssertions. The compiler rejects unresolved images/counts,
duplicate logical keys, invalid units/times, unsupported measured HR and dates
before July 2026. Missing detailed screenshots remain overview-only, never
filled with inferred split times/GPS/HR. Monthly aggregates stay separate from
individual rounded figures. Partial-split distance is explicitly approximate.

The output directory contains hash-named original bytes, portable manifest,
complete publication rows, guarded replay SQL and recovery report. Upload the
contents of upload/ through Supabase Storage to fitness-private/<owner>/evidence.
Only then execute the private publication.sql with an authorized administrator.
Exact replay is safe. If any guard fails, the whole transaction rolls back;
already uploaded private objects remain available for retry.

Verification uses real PostgreSQL via existing pinned PGlite with synthetic
Supabase schemas: missing/corrupt upload rollback, repeat imports, correction
rejection, quoted source text, owner read isolation, anonymous denial and
cross-owner foreign keys. The archive verifier independently hashes every local
object, reconstructs all publication rows from the manifest, restores into a
fresh isolated PostgreSQL instance and repeats publication. Local restore is
not described as a cloud object restore.

Live completion and any remaining upload/UI limitations are recorded in STATE.md;
private reports hold personal run totals, identities and verification evidence.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [private storage access](https://supabase.com/docs/guides/storage/security/access-control).
