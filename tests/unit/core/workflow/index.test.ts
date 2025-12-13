import { describe, it, expect } from 'vitest';

describe('workflow/index exports', () => {
  it('exposes workflow mode helpers', async () => {
    const workflowIndex = await import('../../../../src/core/workflow/index.js');
    expect(workflowIndex.WORKFLOW_MODES).toBeDefined();
    expect(typeof workflowIndex.getWorkflowModeConfig).toBe('function');
    expect(typeof workflowIndex.isValidWorkflowMode).toBe('function');
  });

  it('exposes managers and providers', async () => {
    const workflowIndex = await import('../../../../src/core/workflow/index.js');
    expect(typeof workflowIndex.WorkflowModeManager).toBe('function');
    expect(typeof workflowIndex.WorkflowProgressProvider).toBe('function');
  });
});
