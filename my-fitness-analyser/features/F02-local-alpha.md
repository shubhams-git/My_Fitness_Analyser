# F02a: local activity alpha

Implemented locally after owner approval of the athletic direction. Run
`npm install`, `npm run dev`, then open http://127.0.0.1:4173/.

Import one running/walking `.fit` session (extract ZIP first; 10 MB limit).
Summary, nullable measurements and device laps come from the original FIT using
the pinned official SDK. UTC dates/times are explicit. Multisport and strength
files are rejected. Required check-in answers start blank. Imported activities
support save/edit/reload on disk; reference samples remain previews until imported.

The atomic JSON library is under ignored private-data/library, with originals,
activities and feedback. Repeat hashes create no duplicate. Export downloads a
versioned JSON backup. Restore (50 MB limit) verifies FIT hashes and decoding,
then merges while preserving existing local entries/answers. Keep exports private.

Map: expanded north-up GPS explorer, zoom-adjusted scale, start/finish, recorded
kilometre crossings, nearest-point/time inspection, zoom/pan/fit buttons. GPS gaps
remain gaps. Street/terrain basemap provider and private hosting are still open.

Verification: 10 tests pass, covering FIT originals, duplicate import, null HR,
invalid inputs, new-instance feedback reload, backup restoration and preservation
of newer answers. Inspected Garmin walk decoded; browser import/reload/re-import,
expanded map, zoom and keyboard time inspection checked. No test answers were
written to an owner's real activity. Synthetic screenshots remain private.

This is a one-computer alpha, not the complete F03 MVP. No cloud authentication,
production online release, MASS weight UI or automatic Garmin sync. No physical
iPhone Safari or device performance claim. Writes serialize in one Node process.
