# Guard Contract

## Purpose

The Guard domain provides post-check governance for AI-generated code changes. It enforces policies that validate changes against allowed paths, dependency boundaries, and security requirements before they are committed.

## Key Concepts

- **Policy**: Rules defining what changes are allowed
- **Gate**: Individual check (path_violation, secrets_detection, etc.)
- **GovernanceContext**: Resolved policy with variables substituted
- **GuardResult**: Combined result of all gate checks

## Schemas

| Schema | Purpose |
|--------|---------|
| `PolicySchema` | Governance policy definition |
| `GateTypeSchema` | Enum of available gates |
| `AgentPolicySchema` | Per-agent behavioral policy |
| `PolicyCheckResultSchema` | Result of policy evaluation |

## Available Gates

| Gate | Purpose |
|------|---------|
| `path_violation` | Checks files against allowed/forbidden paths |
| `change_radius` | Limits packages modified in one change |
| `dependency` | Enforces layer boundaries |
| `contract_tests` | Ensures contract tests pass |
| `secrets_detection` | Scans for hardcoded secrets |
| `sensitive_change` | Flags security-sensitive changes |

## Usage Example

```typescript
import {
  PolicySchema,
  validatePolicy,
  type Policy,
  type GateType,
} from '@automatosx/contracts/guard/v1';

// Define a policy
const policy: Policy = validatePolicy({
  policyId: 'provider-refactor',
  allowedPaths: ['packages/adapters/providers/**'],
  forbiddenPaths: ['packages/contracts/**'],
  gates: ['path_violation', 'change_radius', 'secrets_detection'],
  changeRadiusLimit: 2,
});

// Apply policy
const result = await guard.check(policy, changedFiles);
if (result.status === 'FAIL') {
  console.error('Guard check failed:', result.suggestions);
}
```

## Related Domains

- `config`: Stores policy definitions
- `trace`: Records guard check results
- `mcp`: Exposes guard tools

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-GUARD-PATH-003: Forbidden paths take precedence (deny wins)
- INV-GUARD-004: Gate order independence
- INV-GUARD-RES-002: Every FAIL includes actionable suggestions
