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
