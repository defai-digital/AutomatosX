import { describe, expect, it } from 'vitest';
import { analyzeTraceRecord } from '../src/runtime-trace-analysis.js';

describe('runtime trace analysis', () => {
  it('surfaces runtime governance blocks and step failures as findings', () => {
    const analysis = analyzeTraceRecord({
      traceId: 'trace-governance-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-26T10:00:00.000Z',
      completedAt: '2026-03-26T10:00:05.000Z',
      stepResults: [
        {
          stepId: 'bridge-run',
          success: false,
          durationMs: 2000,
          retryCount: 1,
          error: 'blocked',
        },
      ],
      error: {
        code: 'WORKFLOW_STEP_EXECUTION_FAILED',
        message: 'Workflow blocked.',
      },
      metadata: {
        guardSummary: 'Blocked by runtime governance.',
        guardBlockedByRuntimeGovernance: true,
        guardFailedGates: ['runtime_trust'],
        guardFailedGateMessages: ['Bridge is denied.'],
      },
    });

    expect(analysis.durationMs).toBe(5000);
    expect(analysis.failedSteps).toBe(1);
    expect(analysis.retryCount).toBe(1);
    expect(analysis.findings.map((entry) => entry.code)).toEqual([
      'TRACE_FAILED',
      'STEP_FAILURES',
      'STEP_RETRIES',
      'RUNTIME_GOVERNANCE_BLOCK',
    ]);
  });

  it('surfaces checkpoint resumability for failed traces with valid checkpoints', () => {
    const analysis = analyzeTraceRecord({
      traceId: 'trace-checkpoint-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-26T10:00:00.000Z',
      completedAt: '2026-03-26T10:00:08.000Z',
      stepResults: [
        { stepId: 'step-a', success: true, durationMs: 3000, retryCount: 0 },
        { stepId: 'step-b', success: false, durationMs: 5000, retryCount: 1, error: 'provider timeout' },
      ],
      error: { code: 'WORKFLOW_STEP_EXECUTION_FAILED', message: 'Step step-b failed.' },
      checkpoint: {
        lastCompletedStepIndex: 0,
        lastCompletedStepId: 'step-a',
        checkpointedAt: '2026-03-26T10:00:03.000Z',
        workflowHash: 'abc123deadbeef00',
        stepOutputs: { 'step-a': 'output-a' },
      },
    });

    expect(analysis.resumable).toBe(true);
    expect(analysis.checkpointStepIndex).toBe(0);
    expect(analysis.checkpointWorkflowHash).toBe('abc123deadbeef00');
    expect(analysis.findings.map((f) => f.code)).toContain('CHECKPOINT_RESUMABLE');
    const resumeFinding = analysis.findings.find((f) => f.code === 'CHECKPOINT_RESUMABLE');
    expect(resumeFinding?.message).toContain('ax resume trace-checkpoint-001');
  });

  it('does not mark completed traces with checkpoints as resumable', () => {
    const analysis = analyzeTraceRecord({
      traceId: 'trace-checkpoint-002',
      workflowId: 'audit',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-26T10:00:00.000Z',
      completedAt: '2026-03-26T10:00:05.000Z',
      stepResults: [
        { stepId: 'step-a', success: true, durationMs: 5000, retryCount: 0 },
      ],
      checkpoint: {
        lastCompletedStepIndex: 0,
        lastCompletedStepId: 'step-a',
        checkpointedAt: '2026-03-26T10:00:05.000Z',
        workflowHash: 'deadbeefcafe1234',
        stepOutputs: { 'step-a': 'output-a' },
      },
    });

    expect(analysis.resumable).toBeUndefined();
    expect(analysis.checkpointStepIndex).toBe(0);
    expect(analysis.checkpointWorkflowHash).toBe('deadbeefcafe1234');
    expect(analysis.findings.map((f) => f.code)).not.toContain('CHECKPOINT_RESUMABLE');
  });

  it('marks empty successful traces as warnings instead of healthy', () => {
    const analysis = analyzeTraceRecord({
      traceId: 'trace-empty-001',
      workflowId: 'status',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-26T10:00:00.000Z',
      stepResults: [],
      metadata: {},
    });

    expect(analysis.findings).toEqual([
      {
        level: 'warn',
        code: 'NO_STEP_RESULTS',
        message: 'Trace completed without any recorded step results.',
      },
    ]);
  });
});
