# F01 visual study

Historical two-direction study. Owner selected B for all future development.
The new selected Field Notes composition and motion score are in DESIGN.md and
docs/DESIGN_RESEARCH_2026-11.md. Trackside is no longer an active UI direction.

Second study, 5 November 2026: see docs/DESIGN_RATIONALE.md for the current
composition and palette decisions. The original plan below records the first
comparison; Field Notes now compares ink/champagne, and Trackside integrates its
route and measurements into one composition. Neither direction is approved.

Two local, interactive alternatives; neither is selected branding. Same inspected Garmin Run, same four-answer contract, same source boundaries. No production stack selection or hosting in this increment.

## Trackside

Graphite #0C1015, surface #151C24, raised #202B38, text #F3F5F7, secondary #A7B0BB, mineral blue #7DB0FF. System body, locally supplied Manrope for compact headings and tabular figures. The route is the visual anchor: a real GPS outline on a coordinate graticule, not invented streets or terrain. A compact metric rail, synchronized chart/time-block inspection and a reachable check-in sheet make it an instrument for inspecting a session.

```text
Desktop: navigation | activity heading / source
                   | route + metric rail | observation / check-in
                   | aligned chart       | time blocks
Phone: heading / route / metric rail / chart / time blocks / fixed check-in
```

## Field Notes

Ink #101C22, surface #182A32, raised #233B46, softened white #F1F1E9, secondary #ACBCBD, sea glass #87C9B8. Locally supplied Newsreader is restricted to expressive activity headings and the main observation; body and figures remain highly legible. Lead with a concise calculation, then let a continuous page reveal route, session facts, chart and inline check-in. No dashboard card matrix or sidebar on this alternative.

```text
Desktop: quiet wordmark / journal controls
         activity title + observation | open route composition
         continuous facts / analysis / time-block table
         inline four-question check-in
Phone: activity / observation / facts / route / analysis / inline check-in
```

## Review of plan against the brief

The two proposed dark palettes are retained because they are the project's explicit shortlist. Difference comes from route-first versus finding-first hierarchy, navigation, typography and sheet versus inline feedback. Generic dashboard boxes, motivational slogans, decorative gradients, invented maps, medical interpretation and empty destinations are excluded. The sample's short distance remains honest; minute blocks are labelled as sampled intervals rather than fabricated kilometre splits.

## Deliverables and review

- A comparison surface and full-size versions of both Activity Detail flows.
- Same selectable Garmin and screenshot activities, optional clearly synthetic demo, and source provenance.
- Working four-question check-in, conditional discomfort location, optional note, unanswered defaults, draft preservation and demonstrable success/error/offline behavior. Prototype completion is not a production save.
- Synchronized time-block selection, GPS interval highlight and chart selection, with keyboard/text alternatives.
- Review states: default, selected, focus, loading, empty, partial, request error/retry, offline pending, delayed sync, expired key and completion.
- Renders at 360, 393, 440, 768 and desktop widths; reduced-motion and text-enlargement review. Browser verification remains separate from actual iPhone Safari and measured owner timing.

Font sources: Google Fonts official `google/fonts` repository, Manrope and Newsreader under accompanying SIL Open Font Licenses. Total source font payload approximately 616 KB; served locally with font-display: swap, without third-party requests. They remain provisional typography.
