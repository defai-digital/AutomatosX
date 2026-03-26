# Runtime Public API Contraction Candidates

Status: baseline established

Purpose:
- record package-entry exports that are currently unused by repo consumers
- prevent new internal consumers from depending on them before we decide whether to remove them
- make future API contraction incremental instead of ad hoc

Removed in first contraction batch:
- `discoverBridgeDefinitions`
- `discoverSkillDefinitions`
- `resolveBridgeReference`
- `resolveSkillReference`
- `loadRequiredBridgeDefinition`
- `loadRequiredSkillDefinition`

Removed in second contraction batch:
- `readAxBridgeTrustConfig`
- `buildImportedProvenance`

Removed in catalog contraction batch:
- `STABLE_CATALOG_AGENT_SOURCE`
- `enrichAgentEntry`
- `resolveWorkspaceWorkflowDir`

Removed in type contraction batch:
- `ReviewFinding`
- `ReviewSeverity`
- `RuntimeReviewResponse`
- `ApprovalSpec`
- `ProvenanceSpec`
- `AxBridgeTrustConfig`
- `RuntimeTrustDecision`
- `StableWorkflowCommandId`
- `StableWorkflowRequiredInputMode`

Why these are candidates:
- they are low-level bridge/governance helpers
- they are not imported from `@defai.digital/shared-runtime` by current repo source consumers
- they look more like internal registry/runtime plumbing than high-level package API

Guardrail:
- `tests/support/runtime-public-api-manifest.ts`
- `runtime-public-api.test.ts`
- `runtime-public-type-surface.test.ts`
- entrypoint compilation in `shared-runtime`, `cli`, and `mcp-server`

Exit criteria:
1. confirm no downstream consumer outside this repo relies on a candidate
2. remove the candidate from `runtime-public-bridge-exports.ts`
3. update `runtime-public-api.test.ts`
4. move the candidate to the removed section in this file

Current note:
- the initial contraction phase is complete
- future changes should be treated as explicit public API decisions, not opportunistic cleanup
