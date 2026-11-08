# A direct coach, with reliable numbers

Reviewed against official documentation on 9 November 2026. Implemented in F14.

## Reasoning and output have different jobs

The model should think extensively and answer briefly. The server sends one bounded evidence packet and makes one explicit generation request. The runner sees a conclusion, a short explanation and a practical action. It does not see the reasoning trace, JSON, calculation metadata or a generic caution paragraph.

[Google thinking documentation](https://ai.google.dev/gemini-api/docs/thinking) defines the actual control. Interactions requests use `generation_config.thinking_level: "high"` and a 16,384-token output ceiling to leave room for thinking. The prompt additionally asks the model to test competing explanations, reconcile pace/splits/heart rate/reported effort, rank the strongest useful pattern and check direction before writing. Those instructions describe work; words such as "maximum intelligence" alone would not activate a capability. Custom temperature is not added: current Gemini 3.6+ documentation deprecates/ignores those controls.

The configured free-project model remains Gemini 3.6 Flash. A synthetic probe of the newer allowed 3.8 Flash endpoint returned HTTP 503; there is no automatic model or paid-tier fallback. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing) and project Free status govern zero cost, not a consumer subscription. Generation stays explicit, cached and rate-limited. Ordinary browsing makes no generation request.

## Evidence selection

The deterministic layer calculates facts before the model reasons about them. Running receives up to sixty selected runs, source/environment/timing basis, weekly distance/frequency, comparable pace baselines, all available full-kilometre split paces, supported GPS best efforts, heart rate/cadence and the four structured check-in answers when recorded. Missing data remains null. Weight receives the actual observation sequence, calendar trend, recent/longer changes, latest jump, distance from trend, rate, variability and observation spacing. Goal is explicitly unknown until supplied.

Names, emails, raw GPS, source images, private notes and credentials add no value to this reasoning task and stay out. Local reference mappings reconnect model statements to the member's real sessions. Versioned evidence hashes bind reports to their exact inputs. Training and Journal use the member's timezone, including Australian DST.

Reject sending every raw sample merely to make the prompt large: it duplicates arithmetic, exposes locations and uses quota without improving the question. Reject a separate LLM for every metric: it adds cost and contradictions. The useful unit is one well-defined domain briefing. Cross-domain coaching can later combine these domains with an explicit purpose and sharing choice.

## A strict display contract, not a canned opinion

Run schema v3: a complete primary message with 24-word verdict, 35-word explanation and 22-word action; at most three findings with 14-word headline, 35-word explanation and 22-word next action; at most one supported comparison chart. Weight schema v2: headline 16 words, explanation 38 and generated advice 22. A UI action category is separate from the prose, so the recommendation is no longer forced into a canned sentence.

The prompt asks for second-person, direct, numerical language. It explicitly removes "based on historical data", imported-record commentary, generic cautions and motivational filler. It permits training advice and ordinary likely explanations. For abrupt weight movement, explaining likely fluid/food/timing and advising against changing a routine over one reading is useful; pretending the scale measured fat is not. [Cleveland Clinic's explanation of daily fluctuations](https://health.clevelandclinic.org/weight-fluctuations) supports that distinction. No goal or preferred weight direction is silently assumed.

[Google structured output](https://ai.google.dev/gemini-api/docs/structured-output) constrains JSON shape; it does not establish that the content is true. Large repeated fact-ID enums initially exceeded the decoder's constraint-state budget. The provider schema is compacted while local Ajv retains the complete exact enum, bounds, required fields and extra-property rejection. Every numerical measurement is a fact placeholder. A signal identifies direction; semantic checks reject reversed signed pace/weight/volume claims. The renderer inserts exact measured values and avoids double negatives.

Main verdict and chart references must validate. An unsupported optional finding can be omitted while retaining a valid main brief, with no extra API request. Invalid main claims fail rather than being relabelled as a successful answer. Both engines recheck evidence before publication. Permission revocation and per-owner isolation remain enforced by existing database procedures. Old-version reports remain stored but do not masquerade as a current answer.

This follows the useful engineering principle in [Anthropic's workflow research](https://www.anthropic.com/research/building-effective-agents): clear bounded tasks and measured evaluation before adding elaborate orchestration. It does not claim to reproduce a proprietary Claude system.

## Real provider experiments using synthetic data

| Probe | Observed result |
|---|---|
| 3.8 Flash, synthetic running | HTTP 503, no fallback request |
| 3.6 Flash, eight synthetic runs, full enum schema | HTTP 400 decoder complexity; corrected compact provider schema |
| 3.6 Flash, same synthetic evidence, compact schema | HTTP 200, 33.7 s; 6,739 thinking tokens, 568 output tokens; primary and two findings validated; unsupported optional finding omitted |
| 3.6 Flash, synthetic downward weight trend plus isolated jump | HTTP 200, 15.2 s; 2,619 thinking tokens, 208 output tokens; valid direct explanation and maintain-routine advice |

Synthetic weight output chose the desired behavior without being supplied that answer: it contrasted the latest jump with the downward trend, suggested likely fluid/food volume and said not to change the routine over one weigh-in. These experiments did not write production records. Live owner generation and saved reload are documented separately in F14, so synthetic evaluation is never presented as personal coaching.

## Live coherence correction

The first owner v2 run report passed its numerical checks, but the UI combined a
verdict about the latest longer run with a first finding about an older short
run. Live review caught this mismatch. V3 gives the main verdict its own required
explanation and action; all optional findings remain additional observations.
The UI no longer borrows one finding to explain a different conclusion. Tests
require a complete primary message even when no optional finding survives.
The existing report is retained in the database and v3 gets a fresh evidence key.

Live outcome: the owner weight insight completed and restored after reload. Two
personal v3 running requests returned explicit Google HTTP 503, including one
retry. No v3 run answer was published or substituted, and no paid service was
used. The earlier v2 personal answer remains stored. V3 live success is an open
verification item, not a claimed result of the successful synthetic v2 probes.
