# Workflow Contract

## Purpose

The Workflow domain defines executable workflows composed of steps that can be sequenced, parallelized, or conditionally executed. Workflows are the execution backbone for agents and automated tasks.

## Key Concepts

- **Workflow**: A sequence of steps to execute
- **WorkflowStep**: Individual unit of work (prompt, tool, conditional, etc.)
- **StepType**: Classification of step behavior (prompt, tool, loop, parallel, delegate)
- **Dependencies**: DAG-based step ordering

## Schemas

| Schema | Purpose |
|--------|---------|
| `WorkflowSchema` | Complete workflow definition |
| `WorkflowStepSchema` | Single step in the workflow |
| `WorkflowResultSchema` | Execution result with step outputs |
| `StepTypeSchema` | Enum of step types |

## Usage Example

```typescript
import {
  WorkflowSchema,
  validateWorkflow,
  type Workflow,
  type WorkflowStep,
} from '@defai.digital/contracts/workflow/v1';

// Define a workflow
const workflow: Workflow = validateWorkflow({
  workflowId: 'data-pipeline',
  name: 'Data Processing Pipeline',
  steps: [
    {
      stepId: 'extract',
      name: 'Extract Data',
      type: 'tool',
      config: { tool: 'data_extract' },
    },
    {
      stepId: 'transform',
      name: 'Transform Data',
      type: 'prompt',
      dependencies: ['extract'],
      config: { prompt: 'Transform: {{steps.extract.output}}' },
    },
  ],
});
```

## Related Domains

- `agent`: Uses workflows for agent execution
- `trace`: Records workflow execution events
- `mcp`: Exposes workflow tools via MCP

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-WF-001: Steps execute in dependency order
- INV-WF-002: Parallel steps run concurrently
- INV-WF-003: Step outputs are immutable
