# Roadmap Notes

## Wishlist

### Iterate mode vs. "Claude Code Ralph Wiggum way"

- Review why users feel the current `iterate` mode is weaker than the "Claude Code Ralph Wiggum way".
- Identify concrete gaps in prompting, loop structure, tool use, planning quality, or review behavior.
- Propose changes that make `iterate` mode feel more capable and reliable in practice.

## To-Do

### Add a "gstack"-style workflow for v11.4

- Review how the current `agent` and `workflow` modes compare to Garry Tan's "gstack" workflow.
- Define what parts of the "gstack" flow should be supported in AutomatosX.
- Target inclusion of an improved "gstack"-style workflow in version `11.4`.

### Strengthen code scanning and debugging workflows

- Significantly improve code scanning and debugging performance, since this is a core strength of AutomatosX.
- Add a workflow focused on debugging, including faster issue isolation, root-cause tracing, and fix verification.
- Add a workflow to identify dead code and support safe refactors that reduce unused logic.
- Detect duplicate code created by AI coders and support refactors that consolidate repeated logic into cleaner shared abstractions.
- Detect placeholder implementations left by AI coders and require either full implementation or explicit follow-up tasks.
- Detect hardcoded values, strings, and settings that should be moved into maintainable configuration files such as `yaml` or `json`.
- Improve refactor support so repeated literals, fragile constants, and embedded settings are normalized into clearer config structures.
- Improve overall code quality and maintainability by reducing duplication, simplifying structure, and standardizing patterns across generated code.

### Expand agent autonomy and specialization

- Review strengths from systems like OpenClaw in agentic task execution and identify what AutomatosX should adopt.
- Add specialized agents such as frontend agents and backend agents so work can be delegated more effectively by domain.
- Improve autonomous execution so agents can complete more tasks end-to-end without repeatedly asking the user unnecessary questions.
- Increase automation in planning, execution, verification, and handoff so AutomatosX can operate more independently when the task is clear.

### Add a local web UI for settings and secure configuration

- Review whether the current CLI-first setup should be complemented by a local web page for setup, provider selection, and workflow configuration.
- Let users select providers, models, and execution styles through a local UI instead of relying only on CLI arguments and config edits.
- Improve onboarding so important setup information can be entered through guided forms rather than manual configuration.
- Let users choose where configuration and operational data are stored, including local `sqlite` or a user-provided PostgreSQL server.
- Review whether state, task history, and related metadata should be able to live in PostgreSQL instead of being limited to local `sqlite`.
- Strengthen secret handling so API keys and other sensitive values are not stored in plaintext in local `yaml` files.
- Evaluate secure local secret storage options such as encryption or OS-backed keychain integration, with hashing used only where verification is sufficient.

### Review governance architecture against best practices

- Review whether the current governance model based on contracts, domains, workflows, invariants, and guards reflects current best practices.
- Identify gaps, overlaps, or unnecessary complexity in the existing governance layers.
- Improve the governance approach so policies are clearer, easier to maintain, and more consistently enforced.
- Review whether invariants and guards are defined at the right boundaries and whether contracts and domains are separated cleanly.
- Propose changes that make the governance system more aligned with best-practice architecture and operational reliability.

### Help existing codebases migrate toward governance automatically

- Review whether AutomatosX can use workflows, agents, or other automation to correct an existing project so it follows the governance approach more consistently.
- Add support for scanning an existing codebase, identifying governance violations, and proposing or applying fixes with very little human involvement.
- Improve automation for upgrading legacy code into governance-aligned structures such as contracts, domains, workflows, invariants, and guards.
- Let users run low-touch remediation flows that refactor code, fill governance gaps, and verify compliance with minimal manual effort.
- Focus on reducing human intervention so AutomatosX can help teams bring existing projects into a governance-ready state more autonomously.
