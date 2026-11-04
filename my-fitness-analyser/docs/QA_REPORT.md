# Selected Field Notes QA — 5 November 2026

## Result and scope

B is the selected direction. This pass verifies the new root application and
/studio; the preceding two-direction comparison is historical. The updated
composition and motion still require owner visual approval.

## Automated checks

`npm run check`: passed; generated token agreement, required documents and 38
normal-text contrast pairs. `npm run test:prototypes`: six tests passed, including
recorded-time replay selection across irregular samples/gaps, existing sampled
calculations, non-text contrast and local server boundaries. JavaScript syntax
and Git whitespace checks passed. These checks are not a full accessibility audit.

## Browser layouts and states

Ten requested responsive layouts: 360×800, 375×812, 393×852, 440×900, 768×1024,
1280×900, 1440×1000, 1920×1080, 2560×1440 and 852×393 landscape. No horizontal
overflow or measured visible control under the 44px target was found. The browser
reports 394px for requested 393 and 394px height for requested 393 landscape.

All ten scenarios were rendered at 360 and 1440px: normal, missing GPS/HR, empty,
loading, load error, check-in error, offline, delayed, expired and completion.
None of the 20 cases overflowed; partial and screenshot-only records have no
route line. Five local imported-source layouts were also checked on phone:
Garmin run, track run, walk, Strava and NRC. Their existing source semantics and
unavailable GPS/HR were retained.

At 360px, 200% text (32px root) plus reduced motion retained the content without
horizontal overflow. Only the intentionally clipped decorative aura extended
outside the viewport. Route projection is removed, replay disabled and the dock
uses normal flow. Studio controls also produced the 32px/static alternative and
partial state; its requested 360px frame was reported as 361px by this browser.
This is a text-size override, not physical iPhone Dynamic Type or pinch zoom.

## Motion and interaction

- Entrance: masked words keep one accessible heading label. Route drawing and
  atmospheric depth appear in the running page, with all facts in the DOM.
- Replay: Play advances the visible chart position; Pause stops it and presents
  Resume. Both route representations show the same recorded cursor. Replay
  selection is tied to recorded elapsed time; no interpolated GPS is invented.
- Direct inspection: keyboard End reaches 20:00 in the synthetic sample; one
  chart marker and two route markers remain. Block selection highlights both
  route representations. New cursor movement updates attributes/readouts, with
  cached geometry, instead of rebuilding the SVG on every pointer event.
- Navigation: hash jumps preserve selection and no longer rebuild the page or
  restart the entrance. The sticky route, active detail link and reading line
  were inspected while scrolling. No native scroll interception is used.
- Activity picker: selecting NRC shows its source, no GPS route and its summary;
  browser Back restores the synthetic run. Optional native transitions and
  fallback behavior leave the same data contracts.
- Motion control: off restores plain headings, removes projection/movement and
  disables replay; on restores the expressive mode. OS reduced-motion change
  handling exists, but an actual OS-settings toggle was not exercised here.
- Check-in: blank submit focuses effort. Mild exposes a location. Four answers
  plus Knee survive the simulated failure; the result receives focus and stays
  above fixed UI. Retry completes and focuses the completion heading.
- Offline: pending answers and all four responses survive reload. Retry completes.
  Choosing None leaves location null. The shortcut dock hides during inline
  entry, and focused unanswered effort remains below the header.
- Synthetic check-in was reset through the UI after review. Real activity answers
  were not filled. Browser logs showed no reported errors in the inspected flows.

## Corrections made from inspection

Fixed section/history events rebuilding the page; stopped replay on direct
inspection, source dialogs and activity changes; removed repeated SVG redraws
from cursor movement; made the shortcut recede during inline entry; shortened
the mobile route composition; preserved tablet note access; accounted for sticky
header offsets and enlarged text; kept data labels separate from atmospheric art.

## Payload and remaining evidence

Pinned GSAP core plus ScrollTrigger: 118,036 bytes raw, 46,592 bytes when gzip
compressed locally. This is an asset-size measurement, not a device/network
benchmark. Font and script files are served from the same origin with licences.
No map provider or external animation/font CDN was introduced.

Synthetic screenshots and measured browser evidence are in ignored
`private-data/prototypes/field-notes-premium/`. These are browser review artifacts,
not physical iPhone Safari verification, owner completion timings, Lighthouse/Core
Web Vitals, 60fps evidence, production persistence or WCAG certification. The
application remains a local/browser design prototype with synthetic-only Git hosting.
