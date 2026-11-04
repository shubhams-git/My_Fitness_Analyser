# Research and tool shortlist

Checked 4 November 2026. Statements below concern documented capabilities, not a tested owner integration. Architecture/design choices elsewhere are recommendations.

## Continuity

OpenAI documents hierarchical repository instructions using AGENTS.md and a combined default size limit of 32 KiB. Keep the root file short and route to specialist docs. A resume record and tests are project workflow choices; do not assume all Markdown files load automatically. [Official AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Skills use progressive disclosure. This supports a small relevant skill set, not loading an enormous design pack on every turn. [Official skill documentation](https://learn.chatgpt.com/docs/build-skills).

## Garmin

The official [overview](https://developer.garmin.com/gc-developer-program/overview/) lists Personal API activity JSON/FIT and health JSON with pull delivery. The [FAQ](https://developer.garmin.com/gc-developer-program/personal/personal-faq/) documents personal use, key setup/expiry and 24-hour access tokens without refresh tokens. [Swagger docs](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/) are the endpoint reference. Actual account access, endpoint coverage and backfill limits require a live spike.

Official source references: [Garmin Personal API Python client](https://github.com/garmin/connect-personal-api-python) and [FIT JavaScript SDK](https://github.com/garmin/fit-javascript-sdk). Inspect exact versions/licences before installation. No SDK has been installed by this foundation.

## Design/tool selection

| Candidate | Proposed role | Decision now |
| --- | --- | --- |
| [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Art direction, typography, distinct composition | Shortlist one generation skill for the design iteration; do not stack conflicting style instructions |
| [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Structured UI review | Recommended review reference; adopted principles are written into this project's own contract |
| [Vercel React best practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | React implementation/performance review | Use if React is selected; no runtime or dependency decision implied |
| [Impeccable](https://github.com/pbakaus/impeccable) | Optional focused critique/polish | Candidate for selective instruction use; defer executable engine, hooks and live editing pending explicit inspection |
| [shadcn/ui](https://ui.shadcn.com/docs) | Selected accessible primitives | Candidate building blocks, not the finished visual identity; avoid shipping an unchanged component-demo dashboard |
| [Motion](https://motion.dev/docs/react-accessibility) | Complex shared transitions/sheets if needed | Defer until CSS/native interactions are insufficient; honour reduced motion |
| [Playwright](https://playwright.dev/docs/emulation) | Reproducible user-flow and browser checks | Recommended for application implementation; emulation is separate from real Safari |

Impeccable's current README describes a live-edit fallback that can launch a CLI with approval/sandbox checks bypassed. That is a concrete reason not to adopt its installer/hooks/live mode wholesale. Review-only design ideas may be useful independently. Do not copy a blanket install command from a popularity list.

No third-party skill was installed or authored in this iteration. Record canonical source, exact reviewed revision, licence, installed paths, scripts/hooks/network access and removal path in a skill lock record when one is adopted. Project rules take precedence over generic aesthetic instructions.

## Interface standards

[Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) provide a useful interaction checklist. This project chooses its own visual identity and copy conventions. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) defines the text contrast thresholds used in the token check. [Playwright screenshot comparisons](https://playwright.dev/docs/test-snapshots) support regression review; they do not judge visual taste. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) is relevant if Supabase is selected; ownership requires actual policy tests.

## Items deliberately not adopted

Reverse-engineering tools, bundles of anonymous design skills, an additional Python backend, public social features and an unrestricted AI agent are not prerequisites. No star counts, generated benchmark claims or old free-tier prices are used as evidence of suitability. Recheck current vendor terms/costs when selecting hosting, maps or AI services.
