import { describe, expect, it } from 'vitest';
import type { Workflow, WorkflowResult } from '@defai.digital/workflow-engine';
import { buildWorkflowGuardSummary } from '../src/runtime-workflow-guard-summary.js';

describe('runtime workflow guard summary', () => {
  it('extracts runtime governance context from blocked tool steps', () => {
    const workflow = {
      workflowId: 'ship',
      version: '1.0.0',
      steps: [
        {
          stepId: 'run-skill',
          type: 'tool',
          config: {
            toolName: 'skill.run',
            requiredTrustStates: ['trusted-id'],
          },
        },
      ],
    } as Workflow;
    const result = {
      success: false,
      stepResults: [
        {
          stepId: 'run-skill',
          success: false,
          durationMs: 1,
          retryCount: 0,
          output: {
            type: 'tool',
            toolName: 'skill.run',
            toolOutput: {
              skillTrust: {
                state: 'implicit-local',
                approvalMode: 'prompt',
                sourceRef: 'skill:deploy-review',
              },
            },
          },
        },
      ],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        failedStepId: 'run-skill',
        message: 'blocked',
        details: {
          guardId: 'enforce-runtime-trust',
          failedGates: ['runtime_trust'],
          failedGateMessages: ['Trust state must be trusted-id.'],
        },
      },
    } as WorkflowResult;

    expect(buildWorkflowGuardSummary(workflow, result)).toMatchObject({
      blockedByRuntimeGovernance: true,
      toolName: 'skill.run',
      trustState: 'implicit-local',
      requiredTrustStates: ['trusted-id'],
      sourceRef: 'skill:deploy-review',
    });
  });

  it('formats generic guard blocks without runtime governance metadata', () => {
    const workflow = {
      workflowId: 'ship',
      version: '1.0.0',
      steps: [
        {
          stepId: 'review',
          type: 'prompt',
          config: {},
        },
      ],
    } as Workflow;
    const result = {
      success: false,
      stepResults: [],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        failedStepId: 'review',
        message: 'blocked',
        details: {
          guardId: 'enforce-step-budget',
          failedGates: ['budget'],
          failedGateMessages: ['Too many steps requested.'],
        },
      },
    } as WorkflowResult;

    expect(buildWorkflowGuardSummary(workflow, result)).toMatchObject({
      blockedByRuntimeGovernance: false,
      guardId: 'enforce-step-budget',
      failedGates: ['budget'],
      summary: 'Workflow step "review" was blocked by guard "enforce-step-budget". Failed gates: budget. Too many steps requested.',
    });
  });
});
