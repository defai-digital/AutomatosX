import { beforeEach, describe, expect, it } from 'vitest';
import {
  StepGuardEngine,
  createStepGuardEngine,
  createProgressTracker,
  DEFAULT_STEP_GUARD_ENGINE_CONFIG,
} from '../src/index.js';
import type {
  StageProgressEvent,
  StepGuardContext,
  StepGuardPolicy,
} from '@defai.digital/contracts';

describe('step guard engine', () => {
  let engine: StepGuardEngine;

  beforeEach(() => {
    engine = createStepGuardEngine();
  });

  it('creates engine with expected defaults', () => {
    expect(engine).toBeInstanceOf(StepGuardEngine);
    expect(DEFAULT_STEP_GUARD_ENGINE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_STEP_GUARD_ENGINE_CONFIG.defaultOnFail).toBe('warn');
  });

  it('registers policies and runs matching before guards', async () => {
    const policy: StepGuardPolicy = {
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
    };
    engine.registerPolicy(policy);

    const context: StepGuardContext = {
      executionId: 'exec-1',
      agentId: 'agent-1',
      stepId: 'step-1',
      stepIndex: 0,
      totalSteps: 3,
      stepType: 'prompt',
      previousOutputs: {},
      stepConfig: {
        prompt: 'hello',
      },
    };

    const results = await engine.runBeforeGuards(context);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      guardId: 'pre-guard',
      position: 'before',
      blocked: false,
    });
    expect(results[0]?.gates[0]).toMatchObject({
      gateId: 'validation',
      status: 'PASS',
    });
  });

  it('blocks execution when a blocking guard fails', async () => {
    engine.registerPolicy({
      policyId: 'blocking-policy',
      name: 'Blocking Policy',
      enabled: true,
      priority: 10,
      workflowPatterns: ['*'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'blocking-guard',
          stepId: '*',
          position: 'before',
          gates: ['validation'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-2',
      agentId: 'agent-1',
      stepId: 'step-1',
      stepIndex: 0,
      totalSteps: 3,
      stepType: 'tool',
      previousOutputs: {},
      stepConfig: {
        unexpected: true,
      },
    };

    const results = await engine.runBeforeGuards(context);
    expect(engine.shouldBlock(results)).toBe(true);
    expect(results[0]).toMatchObject({
      guardId: 'blocking-guard',
      blocked: true,
      status: 'FAIL',
    });
  });

  it('enforces path, change-radius, sensitive-path, and secrets gates', async () => {
    engine.registerPolicy({
      policyId: 'filesystem-safety',
      name: 'Filesystem Safety',
      enabled: true,
      priority: 20,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'filesystem-guard',
          stepId: '*',
          position: 'before',
          gates: ['path_violation', 'change_radius', 'sensitive_change', 'secrets_detection'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-2b',
      agentId: 'agent-1',
      stepId: 'write-files',
      stepIndex: 0,
      totalSteps: 3,
      stepType: 'tool',
      previousOutputs: {},
      stepConfig: {
        changedPaths: ['src/app.ts', '.github/workflows/deploy.yml'],
        allowedPaths: ['src/**'],
        changeRadius: 1,
        content: 'const token = "sk-live-abcdefghijklmnopqrstuvwxyz";',
      },
    };

    const results = await engine.runBeforeGuards(context);
    expect(engine.shouldBlock(results)).toBe(true);
    expect(results[0]).toMatchObject({
      guardId: 'filesystem-guard',
      blocked: true,
      status: 'FAIL',
    });
    expect(results[0]?.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ gateId: 'path_violation', status: 'FAIL' }),
      expect.objectContaining({ gateId: 'change_radius', status: 'FAIL' }),
      expect.objectContaining({ gateId: 'sensitive_change', status: 'FAIL' }),
      expect.objectContaining({ gateId: 'secrets_detection', status: 'FAIL' }),
    ]));
  });

  it('does not flag mismatched quote delimiters in secret patterns', async () => {
    engine.registerPolicy({
      policyId: 'secrets-only',
      name: 'Secrets Only',
      enabled: true,
      priority: 20,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'secrets-guard',
          stepId: '*',
          position: 'before',
          gates: ['secrets_detection'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-2c',
      agentId: 'agent-1',
      stepId: 'write-files',
      stepIndex: 0,
      totalSteps: 3,
      stepType: 'tool',
      previousOutputs: {},
      stepConfig: {
        content: 'const api_key = "abcdefgh\'',
      },
    };

    const results = await engine.runBeforeGuards(context);
    expect(results).toHaveLength(1);
    expect(engine.shouldBlock(results)).toBe(false);
    expect(results[0]).toMatchObject({
      guardId: 'secrets-guard',
      blocked: false,
    });
    expect(results[0]?.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ gateId: 'secrets_detection', status: 'PASS' }),
    ]));
  });

  it('filters policies by agent patterns and preserves priority order', async () => {
    engine.registerPolicy({
      policyId: 'general',
      name: 'General',
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
      policyId: 'specific',
      name: 'Specific',
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

    const context: StepGuardContext = {
      executionId: 'exec-3',
      agentId: 'agent-1',
      stepId: 'step-1',
      stepIndex: 0,
      totalSteps: 3,
      stepType: 'prompt',
      previousOutputs: {},
      stepConfig: {
        prompt: 'hello',
      },
    };

    const results = await engine.runBeforeGuards(context);
    expect(results).toHaveLength(2);
    expect(results[0]?.guardId).toBe('specific-guard');
    expect(results[1]?.guardId).toBe('general-guard');
  });

  it('evaluates canonical runtime trust metadata from tool output', async () => {
    engine.registerPolicy({
      policyId: 'runtime-governance',
      name: 'Runtime Governance',
      enabled: true,
      priority: 30,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'enforce-runtime-trust',
          stepId: '*',
          position: 'after',
          gates: ['runtime_trust'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-runtime-pass',
      agentId: 'agent-1',
      workflowId: 'ship',
      stepId: 'run-skill',
      stepIndex: 1,
      totalSteps: 2,
      stepType: 'tool',
      stepConfig: {
        toolName: 'skill.run',
        requiredTrustStates: ['trusted-id', 'approved-policy'],
      },
      previousOutputs: {
        'run-skill': {
          type: 'tool',
          toolName: 'skill.run',
          toolOutput: {
            skillId: 'deploy-review',
            dispatch: 'delegate',
            success: true,
            skillTrust: {
              allowed: true,
              state: 'trusted-id',
              reason: 'Trusted by id "deploy-review".',
              remoteSource: false,
            },
          },
        },
      },
      currentOutput: {
        type: 'tool',
        toolName: 'skill.run',
        toolOutput: {
          skillId: 'deploy-review',
          dispatch: 'delegate',
          success: true,
          skillTrust: {
            allowed: true,
            state: 'trusted-id',
            reason: 'Trusted by id "deploy-review".',
            remoteSource: false,
          },
        },
      },
      currentStepSuccess: true,
    };

    const results = await engine.runAfterGuards(context);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      guardId: 'enforce-runtime-trust',
      blocked: false,
      status: 'PASS',
    });
    expect(results[0]?.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gateId: 'runtime_trust',
        status: 'PASS',
      }),
    ]));
  });

  it('blocks runtime trust states that do not satisfy workflow requirements', async () => {
    engine.registerPolicy({
      policyId: 'runtime-governance',
      name: 'Runtime Governance',
      enabled: true,
      priority: 30,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'enforce-runtime-trust',
          stepId: '*',
          position: 'after',
          gates: ['runtime_trust'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-runtime-fail',
      agentId: 'agent-1',
      workflowId: 'ship',
      stepId: 'run-skill',
      stepIndex: 1,
      totalSteps: 2,
      stepType: 'tool',
      stepConfig: {
        toolName: 'skill.run',
        requiredTrustStates: ['trusted-id'],
      },
      previousOutputs: {
        'run-skill': {
          type: 'tool',
          toolName: 'skill.run',
          toolOutput: {
            skillId: 'deploy-review',
            dispatch: 'delegate',
            success: true,
            skillTrust: {
              allowed: true,
              state: 'implicit-local',
              reason: 'Allowed because the definition is local and does not require explicit approval.',
              remoteSource: false,
            },
          },
        },
      },
      currentOutput: {
        type: 'tool',
        toolName: 'skill.run',
        toolOutput: {
          skillId: 'deploy-review',
          dispatch: 'delegate',
          success: true,
          skillTrust: {
            allowed: true,
            state: 'implicit-local',
            reason: 'Allowed because the definition is local and does not require explicit approval.',
            remoteSource: false,
          },
        },
      },
      currentStepSuccess: true,
    };

    const results = await engine.runAfterGuards(context);
    expect(engine.shouldBlock(results)).toBe(true);
    expect(results[0]).toMatchObject({
      guardId: 'enforce-runtime-trust',
      blocked: true,
      status: 'FAIL',
    });
    expect(results[0]?.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gateId: 'runtime_trust',
        status: 'FAIL',
      }),
    ]));
  });

  it('blocks bridge installs when installed bridge trust is denied', async () => {
    engine.registerPolicy({
      policyId: 'runtime-governance',
      name: 'Runtime Governance',
      enabled: true,
      priority: 30,
      workflowPatterns: ['*'],
      stepTypes: ['tool'],
      agentPatterns: ['*'],
      guards: [
        {
          guardId: 'enforce-runtime-trust',
          stepId: '*',
          position: 'after',
          gates: ['runtime_trust'],
          onFail: 'block',
          enabled: true,
        },
      ],
    });

    const context: StepGuardContext = {
      executionId: 'exec-bridge-install-fail',
      agentId: 'agent-1',
      workflowId: 'ship',
      stepId: 'install-bridge',
      stepIndex: 1,
      totalSteps: 2,
      stepType: 'tool',
      stepConfig: {
        toolName: 'bridge.install',
      },
      previousOutputs: {
        'install-bridge': {
          type: 'tool',
          toolName: 'bridge.install',
          toolOutput: {
            definition: {
              bridgeId: 'remote-bridge',
              provenance: {
                importer: 'ax.bridge.install',
                type: 'github',
                ref: 'https://github.com/example/remote-bridge',
              },
            },
            trust: {
              allowed: false,
              state: 'denied',
              reason: 'Execution blocked because remote source "https://github.com/example/remote-bridge" is not trusted in .automatosx/config.json.',
              sourceRef: 'https://github.com/example/remote-bridge',
              remoteSource: true,
            },
          },
        },
      },
      currentOutput: {
        type: 'tool',
        toolName: 'bridge.install',
        toolOutput: {
          definition: {
            bridgeId: 'remote-bridge',
            provenance: {
              importer: 'ax.bridge.install',
              type: 'github',
              ref: 'https://github.com/example/remote-bridge',
            },
          },
          trust: {
            allowed: false,
            state: 'denied',
            reason: 'Execution blocked because remote source "https://github.com/example/remote-bridge" is not trusted in .automatosx/config.json.',
            sourceRef: 'https://github.com/example/remote-bridge',
            remoteSource: true,
          },
        },
      },
      currentStepSuccess: true,
    };

    const results = await engine.runAfterGuards(context);
    expect(engine.shouldBlock(results)).toBe(true);
    expect(results[0]).toMatchObject({
      guardId: 'enforce-runtime-trust',
      blocked: true,
      status: 'FAIL',
    });
    expect(results[0]?.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gateId: 'runtime_trust',
        status: 'FAIL',
        message: expect.stringContaining('Installed bridge trust denied'),
      }),
    ]));
  });

  it('emits stage progress events through progress tracker', () => {
    const events: StageProgressEvent[] = [];
    const tracker = createProgressTracker('exec-4', 'agent-2', 2, (event) => events.push(event));

    tracker.starting(0, 'step-1', 'prompt');
    tracker.completed(0, 'step-1', 'prompt', 12);
    tracker.failed(1, 'step-2', 'tool', 'boom', 9);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: 'stage.progress',
      status: 'starting',
      stageIndex: 0,
      stageTotal: 2,
    });
    expect(events[1]).toMatchObject({
      status: 'completed',
      durationMs: 12,
    });
    expect(events[2]).toMatchObject({
      status: 'failed',
      error: 'boom',
      durationMs: 9,
    });
  });
});
