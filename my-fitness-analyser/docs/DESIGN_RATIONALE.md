# F01 refinement rationale

The activity is a personal record worth looking at. Give its route and distance
space, then make the useful evidence easy to inspect.

## Two proposals

Trackside: graphite `#090E14`, surface `#111B26`, raised `#1C2B3C`, cool white
`#F3F5F7`, mineral blue `#9DC5FA`, secondary `#AFBAC7`. Manrope provides
precise display type and tabular metrics. One integrated route-and-summary
composition replaces the disconnected map card and small number rail.

Field Notes: ink `#0D1217`, surface `#161E25`, raised `#25313B`, ivory
`#F3EFE6`, champagne `#D8B677`, platinum `#B4BCCA`. Existing licensed Newsreader
gives the activity and observation a reflective voice; Manrope keeps measurements
clear. Champagne identifies actions, selection and the route, with quiet surfaces
around it. This is a new candidate, not selected branding.

```text
Trackside desktop: title + primary distance | generous route poster
                  secondary session facts  | route controls
                  observation             | check-in
                  linked chart            | time blocks
Trackside phone: title / route / large distance + facts / observation / analysis

Field Notes: activity title / finding + facts | route
             chart / time blocks / inline four-answer check-in
```

## Reference decisions

Adopted from the attached prompt: scale contrast, controlled champagne accents,
material precision, quiet utility, retained review controls and progressive depth.
Kept text readable instead of tiny tracked labels. Deferred its framework rewrite,
nine screens, cinematic maps, invented multi-year dataset and new analytics: those
would broaden F01 and need separate data and architecture decisions.

UI/UX Pro Max searches: `fitness activity mobile premium` returned generic
luxury/glass guidance; a narrower `running activity analytics` returned generic
Swiss/SaaS patterns. Neither is a verified product-specific visual match. The
palette and composition therefore follow the explicit brief and existing subject
matter. Its focus, responsive layout, touch and reduced-motion rules inform the
implementation and review. No generated design-system output was persisted.

## Mechanics and limits

- Ownership: the activity title, route and source stay central; no social ranking.
- Competence: the single finding retains its recorded evidence and method.
- Progressive disclosure: section links reach charts/blocks/check-in; secondary
  source and method details stay behind labelled controls.
- Speed: no added runtime dependency or map request; original values appear
  immediately without count-up ceremonies or scroll interception.
- Care: distance has the greatest numerical emphasis, units are quieter, control
  boundaries remain legible, and selected states retain shape/text cues.
- Motion: feedback follows input; reduced motion remains a complete static view.

Device performance metrics and actual iPhone Safari behavior require measurement;
visual polish alone does not establish accessibility certification or usability.
