/**
 * Step Guard Engine Core Tests
 *
 * Tests the StepGuardEngine, GateRegistry, and ProgressTracker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StepGuardEngine,
  createStepGuardEngine,
  createGateRegistry,
  ProgressTracker,
  createProgressTracker,
  DEFAULT_STEP_GUARD_ENGINE_CONFIG,
  type GateCheckFn,
  type GateRegistry,
} from '@defai.digital/workflow-engine';
import type {
  StepGuardContext,
  StepGuardPolicy,
  StageProgressEvent,
} from '@defai.digital/contracts';

describe('StepGuardEngine', () => {
  let engine: StepGuardEngine;

  beforeEach(() => {
    engine = createStepGuardEngine();
  });

  describe('constructor and defaults', () => {
    it('creates engine with default config', () => {
      expect(engine).toBeInstanceOf(StepGuardEngine);
    });

    it('respects custom config', () => {
      const customEngine = createStepGuardEngine({
        enabled: false,
        defaultOnFail: 'block',
      });
      expect(customEngine).toBeInstanceOf(StepGuardEngine);
    });
  });

  describe('DEFAULT_STEP_GUARD_ENGINE_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_STEP_GUARD_ENGINE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_STEP_GUARD_ENGINE_CONFIG.defaultOnFail).toBe('warn');
    });
  });

  describe('policy management', () => {
    const testPolicy: StepGuardPolicy = {
      policyId: 'test-policy',
      name: 'Test Policy',
      enabled: true,
      priority: 10,
      workflowPatterns: ['*'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'test-guard',
          stepId: '*',
          position: 'before',
          gates: ['validation'],
          onFail: 'warn',
          enabled: true,
        },
      ],
    };

    it('registers and retrieves policies', () => {
      engine.registerPolicy(testPolicy);
      const policies = engine.getPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0]!.policyId).toBe('test-policy');
    });

    it('removes policies', () => {
      engine.registerPolicy(testPolicy);
      expect(engine.getPolicies()).toHaveLength(1);

      const removed = engine.removePolicy('test-policy');
      expect(removed).toBe(true);
      expect(engine.getPolicies()).toHaveLength(0);
    });

    it('returns false when removing non-existent policy', () => {
      const removed = engine.removePolicy('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('gate registration', () => {
    it('registers custom gates', async () => {
      const customGate: GateCheckFn = async (context) => ({
        gateId: 'custom',
        status: 'PASS',
        message: `Checked agent ${context.agentId}`,
      });

      engine.registerGate('custom', customGate);

      // Register policy using custom gate
      engine.registerPolicy({
        policyId: 'custom-policy',
        name: 'Custom Gate Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'custom-guard',
            stepId: '*',
            position: 'before',
            gates: ['custom'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'test-agent',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 3,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.gates[0]!.status).toBe('PASS');
    });
  });

  describe('runBeforeGuards', () => {
    // INV-WF-GUARD-001: Before guards run before step execution
    it('runs before guards for matching policies', async () => {
      engine.registerPolicy({
        policyId: 'before-policy',
        name: 'Before Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'pre-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.guardId).toBe('pre-guard');
      expect(results[0]!.position).toBe('before');
    });

    it('skips after guards in runBeforeGuards', async () => {
      engine.registerPolicy({
        policyId: 'mixed-policy',
        name: 'Mixed Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'before-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
          {
            guardId: 'after-guard',
            stepId: '*',
            position: 'after',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.guardId).toBe('before-guard');
    });

    it('returns empty array when disabled', async () => {
      const disabledEngine = createStepGuardEngine({ enabled: false });

      disabledEngine.registerPolicy({
        policyId: 'test-policy',
        name: 'Test',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await disabledEngine.runBeforeGuards(context);
      expect(results).toHaveLength(0);
    });
  });

  describe('runAfterGuards', () => {
    // INV-WF-GUARD-002: After guards run after step completes
    it('runs after guards for matching policies', async () => {
      engine.registerPolicy({
        policyId: 'after-policy',
        name: 'After Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'post-guard',
            stepId: '*',
            position: 'after',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runAfterGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.guardId).toBe('post-guard');
      expect(results[0]!.position).toBe('after');
    });
  });

  describe('shouldBlock', () => {
    // INV-WF-GUARD-003: Block failures prevent execution
    it('returns true when any result is blocked', () => {
      const results = [
        {
          guardId: 'guard-1',
          stepId: 'step-1',
          position: 'before' as const,
          status: 'PASS' as const,
          gates: [{ gateId: 'test', status: 'PASS' as const, message: 'OK' }],
          blocked: false,
          summary: 'All passed',
          timestamp: new Date().toISOString(),
          durationMs: 0,
        },
        {
          guardId: 'guard-2',
          stepId: 'step-1',
          position: 'before' as const,
          status: 'FAIL' as const,
          gates: [{ gateId: 'test', status: 'FAIL' as const, message: 'Failed' }],
          blocked: true,
          summary: '1 failed',
          timestamp: new Date().toISOString(),
          durationMs: 0,
        },
      ];

      expect(engine.shouldBlock(results)).toBe(true);
    });

    it('returns false when no results are blocked', () => {
      const results = [
        {
          guardId: 'guard-1',
          stepId: 'step-1',
          position: 'before' as const,
          status: 'PASS' as const,
          gates: [{ gateId: 'test', status: 'PASS' as const, message: 'OK' }],
          blocked: false,
          summary: 'All passed',
          timestamp: new Date().toISOString(),
          durationMs: 0,
        },
      ];

      expect(engine.shouldBlock(results)).toBe(false);
    });

    it('returns false for empty results', () => {
      expect(engine.shouldBlock([])).toBe(false);
    });
  });

  describe('policy filtering', () => {
    beforeEach(() => {
      // Register multiple policies
      engine.registerPolicy({
        policyId: 'agent-specific',
        name: 'Agent Specific',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
        agentPatterns: ['agent-1'],
        guards: [
          {
            guardId: 'specific-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      engine.registerPolicy({
        policyId: 'all-agents',
        name: 'All Agents',
        enabled: true,
        priority: 5,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'general-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      engine.registerPolicy({
        policyId: 'disabled-policy',
        name: 'Disabled',
        enabled: false,
        priority: 100,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'disabled-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });
    });

    it('filters by agent pattern', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-2',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      // Should only match 'all-agents' policy, not 'agent-specific'
      expect(results).toHaveLength(1);
      expect(results[0]!.guardId).toBe('general-guard');
    });

    it('matches specific agent patterns', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      // Should match both 'agent-specific' and 'all-agents'
      expect(results).toHaveLength(2);
    });

    it('skips disabled policies', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      const guardIds = results.map((r) => r.guardId);
      expect(guardIds).not.toContain('disabled-guard');
    });

    // INV-POL-001: Priority ordering
    it('sorts policies by priority (highest first)', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      // agent-specific (priority 10) should come before all-agents (priority 5)
      expect(results[0]!.guardId).toBe('specific-guard');
      expect(results[1]!.guardId).toBe('general-guard');
    });
  });

  describe('step matching', () => {
    beforeEach(() => {
      engine.registerPolicy({
        policyId: 'step-policy',
        name: 'Step Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'all-steps',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
          {
            guardId: 'init-only',
            stepId: 'init*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
          {
            guardId: 'exact-match',
            stepId: 'process-data',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });
    });

    it('matches wildcard stepId', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'any-step',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      const guardIds = results.map((r) => r.guardId);
      expect(guardIds).toContain('all-steps');
    });

    it('matches glob pattern', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'init-setup',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      const guardIds = results.map((r) => r.guardId);
      expect(guardIds).toContain('init-only');
    });

    it('matches exact stepId', async () => {
      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'process-data',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      const guardIds = results.map((r) => r.guardId);
      expect(guardIds).toContain('exact-match');
    });
  });

  describe('gate execution', () => {
    it('handles missing gates gracefully', async () => {
      engine.registerPolicy({
        policyId: 'missing-gate-policy',
        name: 'Missing Gate Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'missing-gate-guard',
            stepId: '*',
            position: 'before',
            gates: ['non-existent-gate'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.gates[0]!.status).toBe('WARN');
      expect(results[0]!.gates[0]!.message).toContain('not found');
    });

    it('handles gate errors', async () => {
      const errorGate: GateCheckFn = async () => {
        throw new Error('Gate execution failed');
      };

      engine.registerGate('error-gate', errorGate);
      engine.registerPolicy({
        policyId: 'error-policy',
        name: 'Error Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'error-guard',
            stepId: '*',
            position: 'before',
            gates: ['error-gate'],
            onFail: 'block',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.gates[0]!.status).toBe('FAIL');
      expect(results[0]!.gates[0]!.message).toBe('Gate execution failed');
      expect(results[0]!.blocked).toBe(true); // onFail is 'block'
    });

    // INV-GATE-001: Gates execute independently
    it('executes all gates even if one fails', async () => {
      engine.registerGate('failing-gate', async () => ({
        gateId: 'failing-gate',
        status: 'FAIL',
        message: 'Always fails',
      }));

      engine.registerGate('passing-gate', async () => ({
        gateId: 'passing-gate',
        status: 'PASS',
        message: 'Always passes',
      }));

      engine.registerPolicy({
        policyId: 'multi-gate-policy',
        name: 'Multi Gate Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'multi-guard',
            stepId: '*',
            position: 'before',
            gates: ['failing-gate', 'passing-gate'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results).toHaveLength(1);
      expect(results[0]!.gates).toHaveLength(2);
      expect(results[0]!.gates[0]!.status).toBe('FAIL');
      expect(results[0]!.gates[1]!.status).toBe('PASS');
    });
  });

  describe('default gates', () => {
    it('has validation gate', async () => {
      engine.registerPolicy({
        policyId: 'validation-policy',
        name: 'Validation Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'validation-guard',
            stepId: '*',
            position: 'before',
            gates: ['validation'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 0,
        totalSteps: 5,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results[0]!.gates[0]!.gateId).toBe('validation');
      expect(results[0]!.gates[0]!.status).toBe('PASS');
    });

    it('has progress gate with percentage', async () => {
      engine.registerPolicy({
        policyId: 'progress-policy',
        name: 'Progress Policy',
        enabled: true,
        priority: 10,
        workflowPatterns: ['*'],
      agentPatterns: ['*'],
        guards: [
          {
            guardId: 'progress-guard',
            stepId: '*',
            position: 'before',
            gates: ['progress'],
            onFail: 'warn',
            enabled: true,
          },
        ],
      });

      const context: StepGuardContext = {
        executionId: 'exec-1',
        agentId: 'agent-1',
        stepId: 'step-1',
        stepIndex: 2,
        totalSteps: 4,
        stepType: 'prompt',
        previousOutputs: {},
      };

      const results = await engine.runBeforeGuards(context);
      expect(results[0]!.gates[0]!.gateId).toBe('progress');
      expect(results[0]!.gates[0]!.details?.percentComplete).toBe(75); // (2+1)/4 * 100
    });
  });

  describe('emitProgress', () => {
    it('calls onProgressEvent callback', () => {
      const events: StageProgressEvent[] = [];
      const engineWithProgress = createStepGuardEngine({
        onProgressEvent: (event) => events.push(event),
      });

      engineWithProgress.emitProgress(
        'exec-123',
        'agent-1',
        0,
        5,
        'init',
        'prompt',
        'starting'
      );

      expect(events).toHaveLength(1);
      expect(events[0]!.executionId).toBe('exec-123');
      expect(events[0]!.status).toBe('starting');
    });

    it('does nothing when no callback configured', () => {
      // Should not throw
      expect(() =>
        { engine.emitProgress('exec-123', 'agent-1', 0, 5, 'init', 'prompt', 'starting'); }
      ).not.toThrow();
    });
  });
});

describe('GateRegistry', () => {
  let registry: GateRegistry;

  beforeEach(() => {
    registry = createGateRegistry();
  });

  it('registers and retrieves gates', () => {
    const gate: GateCheckFn = async () => ({
      gateId: 'test',
      status: 'PASS',
      message: 'Passed',
    });

    registry.register('test', gate);
    expect(registry.get('test')).toBe(gate);
  });

  it('returns undefined for non-existent gates', () => {
    expect(registry.get('non-existent')).toBeUndefined();
  });

  it('checks gate existence', () => {
    const gate: GateCheckFn = async () => ({
      gateId: 'test',
      status: 'PASS',
      message: 'Passed',
    });

    registry.register('test', gate);
    expect(registry.has('test')).toBe(true);
    expect(registry.has('non-existent')).toBe(false);
  });

  it('lists all gate IDs', () => {
    registry.register('gate-1', async () => ({ gateId: 'gate-1', status: 'PASS', message: 'Passed' }));
    registry.register('gate-2', async () => ({ gateId: 'gate-2', status: 'PASS', message: 'Passed' }));

    const ids = registry.list();
    expect(ids).toContain('gate-1');
    expect(ids).toContain('gate-2');
    expect(ids).toHaveLength(2);
  });
});

describe('ProgressTracker', () => {
  let events: StageProgressEvent[];
  let tracker: ProgressTracker;

  beforeEach(() => {
    events = [];
    tracker = createProgressTracker(
      'exec-123',
      'agent-1',
      5,
      (event) => events.push(event),
      'session-1'
    );
  });

  // INV-PROG-001: Every stage emits starting event
  describe('starting', () => {
    it('emits starting event', () => {
      tracker.starting(0, 'init', 'prompt');

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('stage.progress');
      expect(events[0]!.status).toBe('starting');
      expect(events[0]!.stageIndex).toBe(0);
      expect(events[0]!.stageName).toBe('init');
      expect(events[0]!.stageType).toBe('prompt');
    });
  });

  // INV-PROG-002: Every stage emits terminal event
  describe('completed', () => {
    it('emits completed event with duration', () => {
      tracker.completed(1, 'process', 'tool', 150);

      expect(events).toHaveLength(1);
      expect(events[0]!.status).toBe('completed');
      expect(events[0]!.durationMs).toBe(150);
    });
  });

  describe('failed', () => {
    it('emits failed event with error', () => {
      tracker.failed(2, 'validate', 'conditional', 'Validation failed', 50);

      expect(events).toHaveLength(1);
      expect(events[0]!.status).toBe('failed');
      expect(events[0]!.error).toBe('Validation failed');
      expect(events[0]!.durationMs).toBe(50);
    });
  });

  describe('skipped', () => {
    it('emits skipped event', () => {
      tracker.skipped(3, 'optional', 'prompt');

      expect(events).toHaveLength(1);
      expect(events[0]!.status).toBe('skipped');
    });
  });

  describe('blocked', () => {
    it('emits blocked event with guard result', () => {
      const guardResult = {
        guardId: 'block-guard',
        stepId: 'step-1',
        position: 'before' as const,
        status: 'FAIL' as const,
        gates: [{ gateId: 'test', status: 'FAIL' as const, message: 'Failed' }],
        blocked: true,
        summary: '1 failed',
        timestamp: new Date().toISOString(),
        durationMs: 0,
      };

      tracker.blocked(1, 'step-1', 'prompt', guardResult);

      expect(events).toHaveLength(1);
      expect(events[0]!.status).toBe('blocked');
      expect(events[0]!.guardResult).toEqual(guardResult);
    });
  });

  describe('event properties', () => {
    it('includes executionId', () => {
      tracker.starting(0, 'init', 'prompt');
      expect(events[0]!.executionId).toBe('exec-123');
    });

    it('includes agentId', () => {
      tracker.starting(0, 'init', 'prompt');
      expect(events[0]!.agentId).toBe('agent-1');
    });

    it('includes sessionId', () => {
      tracker.starting(0, 'init', 'prompt');
      expect(events[0]!.sessionId).toBe('session-1');
    });

    it('includes stageTotal', () => {
      tracker.starting(0, 'init', 'prompt');
      expect(events[0]!.stageTotal).toBe(5);
    });

    it('includes timestamp', () => {
      tracker.starting(0, 'init', 'prompt');
      expect(events[0]!.timestamp).toBeDefined();
    });
  });
});
