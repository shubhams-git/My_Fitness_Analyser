# Athletic Field Notes review — 5 November 2026

This report supersedes the visual treatment in QA_REPORT.md; prior functional
evidence remains historical. Current iteration has not been pushed or deployed.

Automated: foundation check (38 text contrast pairs), seven prototype tests,
JavaScript syntax and Git whitespace checks pass. The added pace-trace test
verifies gaps for missing/stationary speed and elapsed discontinuities; no
interpolated samples. Existing source/privacy and elapsed replay checks pass.

Browser: nine layouts requested (360×800, 393×852, 440×900, 768×1024,
1024×768, 1440×1000, 1920×1080, 2560×1440, 852×393 landscape). No document
horizontal overflow or measured visible action/range height below 44px.
Browser rounds 393 to 394 in reported viewport dimensions.

All ten preview states checked at phone width without horizontal overflow.
200% text with reduced motion and missing GPS/HR checked without overflow;
replay disabled and required answers blank. Fixed the unavailable-route panel
to grow with its content rather than clipping enlarged copy.

Replay: play advances elapsed time and both route markers. Pause works. Keyboard
End on the compact slider stops replay and sets hero/chart to the same final
sample: 20:00, index 1200, pace 4:33/km, trace cursor x=600. Summary remains
4:10/km because it describes the whole session, not the selected sample.
Manual inspection is available with reduced motion.

Check-in action reaches the inline form. Blank save keeps zero answers, shows
the validation error and focuses effort. Mild discomfort reveals location.
Entry hides the floating dock. Test answers reset through the demo UI.
NRC screenshot source renders no route, no pace trace and disabled replay.

Desktop and phone screenshots inspected, including the detailed analysis chapter.
Synthetic screenshots remain under ignored private-data. No physical iPhone
Safari, FPS/Core Web Vitals benchmark, owner timing or full accessibility audit
is claimed. The latest visual design awaits owner feedback.
