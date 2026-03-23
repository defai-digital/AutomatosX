# Future Scope for v14

This file tracks optional follow-up work after the current v14 delivery was completed and verified.

Current completion baseline:
- `npm run typecheck` passed
- `npm test` passed
- `15` test files passed
- `129` tests passed

These are not pending delivery tasks. They are future-scope options.

## Priority 1

### Deepen provider-native adapters

- Harden native adapter behavior for each real provider CLI instead of relying on generic protocol presets alone.
- Add provider-specific request shaping, output normalization, timeout handling, and error mapping for `claude`, `gemini`, `codex`, and `grok`.
- Add explicit compatibility tests for each supported provider adapter mode.
- Decide whether native adapters should remain opt-in or become the default once confidence is high enough.

### Expand `ax call` autonomy mode

- Replace the current bounded phase loop with a richer phase machine for `query`, `analysis`, and `code` intents.
- Add stronger stop conditions, self-checks, and failure recovery between rounds.
- Add optional guard integration for autonomous `ax call` rounds when file or tool actions are introduced.
- Add clearer round summaries and structured outputs so downstream automation can consume autonomy results more safely.

## Priority 2

### Research domain

- Add web-grounded query, fetch, and synthesis support as a first-class runtime surface.
- Define source trust, timeout policy, and summarization contracts before implementation.
- Expose the domain consistently across runtime, MCP, and CLI layers.

### MCP ecosystem tooling

- Add external MCP server registration, listing, unregister, tool discovery, and direct invocation surfaces.
- Keep this separate from the local in-process MCP server so interoperability work does not destabilize the shipped baseline.
- Define server trust, timeout, and namespacing rules before broadening this surface.

### Design and scaffold surfaces

- Add `design.*` helpers for API, component, schema, architecture, and catalog generation.
- Add `scaffold.*` helpers for contract, domain, and guard bootstrapping.
- Prefer narrowly scoped generators with deterministic outputs over broad template sprawl.

## Priority 3

### Persistence architecture review

- Revisit whether file-backed state remains sufficient or whether a move to `sqlite` is justified.
- Compare operational simplicity, concurrency guarantees, backup/recovery needs, and query requirements.
- Treat this as an architectural change, not a drop-in replacement.

### Additional parity surfaces

- Evaluate whether any remaining legacy CLI or MCP surfaces are still worth restoring.
- Prefer features that add direct user value over command-count parity.
- Keep low-value parity work separate from core runtime improvements.

### Broader Git/PR automation

- Decide whether `git.status`, `git.diff`, `commit.prepare`, `pr.review`, and `pr.create` are sufficient for the operator workflow.
- Only expand this area if there is a real need for stronger branch, push, or release automation.

## Decision Rule

- Only start one of these items with a new PRD or scoped implementation plan.
- Do not reopen the completed migration tracker for this work.
