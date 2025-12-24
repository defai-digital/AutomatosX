# Agent Contract

## Purpose

The Agent domain defines AI agents with specialized capabilities, personalities, and workflows. Agents can be registered, executed, delegate to other agents, and maintain execution checkpoints for resumability.

## Key Concepts

- **AgentProfile**: Complete definition of an agent (ID, capabilities, workflow, etc.)
- **AgentWorkflowStep**: A step in the agent's execution workflow
- **Delegation**: Ability for agents to delegate tasks to other agents
- **Checkpoint**: Saved execution state for resumability

## Schemas

| Schema | Purpose |
|--------|---------|
| `AgentProfileSchema` | Complete agent definition |
| `AgentWorkflowStepSchema` | Single workflow step definition |
| `AgentResultSchema` | Execution result with step outputs |
| `DelegationContextSchema` | Tracks delegation chain and depth |
| `CheckpointSchema` | Saved execution state |

## Usage Example

```typescript
import {
  AgentProfileSchema,
  validateAgentProfile,
  type AgentProfile,
  type AgentResult,
} from '@automatosx/contracts/agent/v1';

// Define an agent
const profile: AgentProfile = validateAgentProfile({
  agentId: 'code-reviewer',
  description: 'Reviews code for quality and best practices',
  capabilities: ['code-review', 'analysis'],
  team: 'engineering',
  workflow: [
    {
      stepId: 'analyze',
      name: 'Analyze Code',
      type: 'prompt',
      config: { prompt: 'Analyze this code: {{input}}' },
    },
  ],
  enabled: true,
});

// Execute agent
const result: AgentResult = await executor.execute(profile.agentId, { code: '...' });
```

## Related Domains

- `workflow`: Underlying workflow execution engine
- `session`: Manages collaboration sessions between agents
- `memory`: Stores agent state and conversation history
- `trace`: Records agent execution for debugging

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-AGT-WF-001: Prompt steps must have non-empty prompt in config
- INV-DT-001: Delegation depth never exceeds maxDepth
- INV-DT-002: No circular delegations allowed
