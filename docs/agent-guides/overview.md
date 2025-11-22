# AutomatosX Agents Guide

Use this playbook to understand the built-in AutomatosX agents, customize new profiles, and keep orchestration workflows healthy.

## Agent Catalog
| Agent ID | Persona | Primary Focus | Typical Tasks |
|----------|---------|---------------|---------------|
| `backend` | Bob | Backend services (Go/Rust/TypeScript) | API design, database integrations, service refactors |
| `frontend` | Frank | Web/mobile UI (React/Next.js/Swift) | Component implementation, accessibility sweeps |
| `architecture` | Avery | System architecture & governance | ADR management, architecture runway, technical debt triage |
| `fullstack` | Felix | Cross-stack delivery | End-to-end features, handoff between UI and API |
| `mobile` | Maya | Native and cross-platform apps | iOS/Android screens, mobile networking |
| `devops` | Oliver | Infrastructure & CI/CD | Deployment pipelines, observability, IaC reviews |
| `security` | Steve | Security audits | Threat modeling, dependency checks, vulnerability patches |
| `data` | Daisy | Data engineering | ETL pipelines, warehouse modeling |
| `quality` | Queenie | QA and testing | Regression plans, automated test suites |
| `design` | Debbee | UX/UI | Wireframes, UX copy, design QA |
| `writer` | Wendy | Technical writing | Release notes, docs, tutorials |
| `product` | Paris | Product strategy | PRDs, acceptance criteria, roadmap briefs |
| `cto` | Tony | Technology leadership | Architectural reviews, platform direction |
| `ceo` | Eric | Business leadership | Company vision, stakeholder messaging |
| `researcher` | Rodman | Market & technical research | Competitive analysis, exploratory reports |
| `data-scientist` | Dana | ML & analytics | Model prototyping, notebook exploration |
| `aerospace-scientist` | Astrid | Aerospace systems | Mission design, simulation planning |
| `quantum-engineer` | Quinn | Quantum computing | Algorithm design, hardware considerations |
| `creative-marketer` | Candy | Marketing strategy | Campaign ideation, brand messaging |
| `standard` | Stan | Standards & governance | Best-practice reviews, compliance checklists |

Check current capabilities and metadata at any time with `ax list agents --format json`.

## Workflow Overview
1. **Clarify objectives** in `automatosx/PRD/` or `docs/` before delegating.
2. **Select an agent** based on domain expertise; mix and match via delegation (`@agentName`) for complex tasks.
3. **Persist context** by saving outputs to the appropriate workspace directory (`PRD/` for specs, `tmp/` for drafts).
4. **Review and refine** with follow-up prompts or additional agents (e.g., hand off implementation to `backend`, request tests from `quality`).

## Custom Agents
1. Prototype with templates:
   ```bash
   ax agent create <name> --template developer --interactive
   ```
2. Profiles live under `.automatosx/agents/` (local) or `examples/agents/` (shared).
3. Define persona details, specialties, delegation limits, and timeouts; align config keys with `ax.config.json`.
4. Document new capabilities in `docs/` and sync sample configs when introducing new options.

## Configuration Essentials
- Provider priorities and limits reside in `ax.config.json`; regenerate type-safe accessors via `npm run prebuild:config`.
- `src/config.generated.ts` is generated—never edit it manually.
- Path aliases (`@/*`, `@tests/*`) are defined in `tsconfig.json` for clean imports.

## Testing Agent Workflows
- Keep coverage ≥85%; place unit tests under `tests/unit/` mirroring agent logic.
- Use `npm run test:unit -- agent` or similar filters for targeted suites.
- Smoke-test CLI flows (especially new commands or agent interactions) via `tests/smoke/`.
- Run `npm test` plus `npm run typecheck` before opening a PR; include output in the PR description.

## Best Practices
- Prefer small, composable tasks and leverage delegation instead of overloading a single agent.
- Record architecture updates or decisions in `automatosx/PRD/` for future automation runs.
- Keep temporary explorations in `automatosx/tmp/`; clean with `bash tools/cleanup-tmp.sh` when done.
- Guard against configuration drift by running `npm run sync:all-versions` and updating `docs/configuration.md` when necessary.
- Use `npm run commit` (Commitizen) to follow Conventional Commits and include spec/test evidence when submitting changes.
