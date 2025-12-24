# Routing Contract

## Purpose

The Routing domain handles intelligent model selection for AI tasks. It routes requests to the most appropriate LLM provider and model based on task characteristics, risk level, and required capabilities.

## Key Concepts

- **TaskType**: Classification of work (code_generation, analysis, conversation, etc.)
- **RiskLevel**: Safety classification (low, medium, high, critical)
- **RoutingDecision**: The selected model with reasoning
- **Fallback**: Alternative models if primary selection fails

## Schemas

| Schema | Purpose |
|--------|---------|
| `TaskTypeSchema` | Enum of supported task types |
| `RiskLevelSchema` | Risk classification levels |
| `RoutingInputSchema` | Input for routing decisions |
| `RoutingDecisionSchema` | Output model selection with reasoning |
| `RoutingRecordSchema` | Complete routing record for audit |

## Usage Example

```typescript
import {
  RoutingInputSchema,
  validateRoutingInput,
  type RoutingInput,
  type RoutingDecision,
} from '@automatosx/contracts/routing/v1';

// Validate routing input
const input: RoutingInput = validateRoutingInput({
  taskType: 'code_generation',
  riskLevel: 'medium',
  contextSize: 5000,
  requiredCapabilities: ['code', 'reasoning'],
});

// Use with routing engine
const decision: RoutingDecision = await routingEngine.route(input);
console.log(`Selected: ${decision.modelId}, Reason: ${decision.reasoning}`);
```

## Related Domains

- `provider`: Provides the models that routing selects from
- `trace`: Records routing decisions for observability
- `config`: Stores routing preferences and constraints

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-RT-001: Determinism (identical inputs produce identical outputs)
- INV-RT-002: Risk Gating (high risk never selects experimental models)
- INV-RT-003: Reasoning Requirement (all decisions include reasoning)
