# Field Notes: research and art direction

5 November 2026. Owner selected B for all future development, requested a much
more expressive experience, and instructed work directly on updated master.
Selection of B is confirmed; the new treatment still requires visual review.

## Inspection

Reviewed the product/design/state/decision contracts, active feature, quality
gates, routes, server, normalized data, chart/route calculations, questionnaire,
draft persistence, tokens, fonts, deployment adapter and existing tests. The
first two studies were principally static report compositions. Root opened a
comparison tool; the chosen app lacked an intentional entrance, spatial
continuity, or a distinct shift between overview and detailed inspection.

Keep measured data, four-answer questionnaire, provenance and resilient states.
Replace the selected direction's presentation. Root should open the app; move
review tools to /studio. Existing A is historical, not a continuing product.

## Sources and what they change

1. [Official GPT-6.1 Sol model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
   confirms support for high reasoning. [Desktop model controls](https://learn.chatgpt.com/docs/models?surface=web)
   place model/effort selection beneath the composer. This task cannot infer or
   change a chat's current effort from the repository. More reasoning is not a
   substitute for concrete art direction and rendered review.
2. [OpenAI frontend guidance](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)
   recommends composition, references, a narrative and intentional motion, with
   browser verification. The article's model-specific tuning concerns GPT-5.4;
   do not transfer those settings as a proven optimum for 6.1 Sol. Use the
   design-and-browser workflow, not an unsupported model ranking.
3. [Tuch et al., 2012](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/)
   experimentally found rapid effects of complexity and familiarity on aesthetic
   judgments. Use one dominant composition per section and recognizable controls.
   It does not establish a universal luxury palette or promise an emotional result.
4. [Nielsen Norman Group: aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/)
   explains why attractive interfaces can seem easier to use. Test actual tasks
   separately: a beautiful screen is not evidence of a usable check-in.
5. [Apple motion guidance](https://developer.apple.com/design/human-interface-guidelines/motion)
   supports meaningful, optional, precise movement. Translate this into a visible
   motion toggle, cancelable replay, and an immediate static alternative.
6. [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
   supplies scroll-linked animation and lifecycle controls. Use native scrolling,
   bound the depth effect, clean up listeners/timelines on activity replacement,
   and animate transforms/opacity rather than layout on each scroll event.
7. [GSAP standard licence](https://gsap.com/community/standard-license/)
   permits use in websites/app interfaces. Pin 3.15.1 from the official npm gsap
   package; bundle only core and ScrollTrigger locally with notices. This adds a
   concrete motion capability, not an application framework migration.
8. [Impeccable upstream](https://github.com/pbakaus/impeccable)
   was inspected as research. Its distinction between expressive experiences
   and task-oriented controls is useful here. Its launcher and hooks were not
   installed or executed. No additional skill is required for this iteration.
9. [MDN: startViewTransition](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
   documents same-document transitions and feature-detected fallbacks. Activity
   switching uses this optional enhancement; reduced mode changes immediately.
   The transition overlay does not capture pointer input.

UI/UX Pro Max: inspected system-wide design searches for editorial fitness and
luxury journals, then focused UX and GSAP searches for scroll/reduced-motion
behavior. Broad results leaned toward generic showcase/liquid-glass patterns;
they are not a verified match for this personal sports instrument. Keep focused
motion/accessibility guidance; use the owner's selected B identity for art direction.

## Visual thesis

An illuminated training folio: near-black ink, atmospheric midnight-blue depth,
warm champagne light, ivory editorial type. Gradients describe light around the
route and selected objects; their role is material/spatial, not an extra statistic.

Core colours: ink #080D13, surface #111B25, raised #202D3B, ivory #F5F0E6,
platinum #B8C2CE, champagne #DFC28D. Decorative blue and gold glow are separate
tokens from text and semantic status. Controls preserve contrast independently.

Instrument Serif is the expressive voice; Manrope gives labels, facts and
tabular measurements precision. Both are self-hosted with OFL licences. Avoid
tiny tracking-heavy labels, royalty slogans, fake medals and invented records.

```text
desktop
  quiet brand / Activity / Notes / motion / sources
  large activity title         luminous route on a deep optical field
  source & date                distance set in large precision type
  essential facts / scroll cue
  finding + sticky route       chart + sampled blocks
  four-question check-in       closing activity recap

phone
  brand / activities
  activity title / date
  route / distance / essential facts
  finding / analysis / blocks / inline check-in / recap
  reachable check-in action (reserves space; normal flow at 200% text)
```

## Psychology as design hypotheses

- Ownership: the athlete's actual activity and route are the exhibit. All source
  labels remain truthful; synthetic data remains identified.
- Perceived craftsmanship: optical spacing, type contrast, soft rim light and
  aligned measurements. This is an art-direction hypothesis, not a causal claim.
- Continuity and control: route geometry carries from the opening into the
  analysis; a user can play/pause a compressed route replay or scrub directly.
- Attention: one coordinated opening, then scroll responds to the user's pace.
  Controls react quickly. No mandatory intro or delayed access to information.
- Closure: a compact recap ends the session; completing a check-in focuses its
  result and keeps the demonstration's browser-only meaning clear.

## Motion score and acceptance

Entrance: title and atmosphere resolve together; route draw up to 1.5s.
Scroll: one bounded depth composition, plus a line/section reveal for evidence.
Utility: 120–180ms press/selection and short dialog transitions. Replay is
explicitly a 12-second visual preview, follows recorded timestamps and stops
on user inspection, data replacement, hidden document, or reduced motion.

No autoplay replay, scroll interception, fake terrain, foreground infinite
motion, or numerical roulette. The route's luminous style is not elevation data.
Reduced motion and 200% text must retain all content and controls. Inspect phone,
landscape, tablet and desktop; verify preserved answers and linked exploration.
Record measured evidence and outstanding device/performance limits separately.

## Codex Windows workflow used here

Keep GPT-6.1 Sol and the owner's preferred High effort in the composer; do not
claim a repository setting can change the running chat. Give the model concrete
accepted/rejected visual context, an explicit composition and a short motion
score. Inspect actual phone and desktop renders, then correct observed problems
before extending the page. Use the browser to inspect behavior, not just HTML.

Available capabilities used: local code/terminal, UI/UX Pro Max search, official
documentation/web research, browser DOM/screenshot inspection, and source-control
checks. Raster image generation is useful when a design needs original imagery;
this interface's defining artifact is actual route geometry, better rendered as
SVG. A Figma connection or a larger framework is not necessary to improve this
slice. No extra model, subagent, design launcher or unrelated plugin was installed.

The brief's emotion is tested by showing the owner the running result, not by
self-awarding luxury/psychology scores. Physical Safari behavior, actual owner
check-in timing and device performance remain separate evidence gates.

Typography source: [Google Fonts Instrument Serif](https://github.com/google/fonts/tree/main/ofl/instrumentserif),
regular and italic TTFs with the supplied SIL OFL. Manrope is retained from the
first study. Both families are served from the repository, without font CDNs.
