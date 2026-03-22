import { mkdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearWarnedFilesCache,
  createRealStepExecutor,
  createStepGuardEngine,
  createWorkflowLoader,
  createWorkflowRunner,
} from '../src/index.js';
import { safeValidateWorkflow } from '@defai.digital/contracts';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `workflow-engine-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('workflow-engine', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    clearWarnedFilesCache();
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('loads yaml workflow definitions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    writeFileSync(join(tempDir, 'sample.yaml'), [
      'workflowId: sample',
      'version: 1.0.0',
      'name: Sample Workflow',
      'steps:',
      '  - stepId: first-step',
      '    type: prompt',
      '    config:',
      '      prompt: Hello',
      '',
    ].join('\n'), 'utf8');

    const loader = createWorkflowLoader({ workflowsDir: tempDir });
    const workflow = await loader.load('sample');

    expect(workflow?.workflowId).toBe('sample');
    expect(workflow?.steps).toHaveLength(1);
  });

  it('fails duplicate step ids during run validation', async () => {
    const runner = createWorkflowRunner();
    const result = await runner.run({
      workflowId: 'broken',
      version: '1.0.0',
      steps: [
        { stepId: 'dup-step', type: 'prompt' },
        { stepId: 'dup-step', type: 'prompt' },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('WORKFLOW_DUPLICATE_STEP_ID');
    expect(result.error?.message).toContain('Duplicate step ID found');
  });

  it('exposes safe contract validation for workflow definitions', () => {
    const valid = safeValidateWorkflow({
      workflowId: 'safe-parse',
      version: '1.0.0',
      steps: [{ stepId: 'step-1', type: 'prompt' }],
    });

    const invalid = safeValidateWorkflow({
      workflowId: 'safe-parse',
      version: '1.0.0',
      steps: [{ stepId: 'step-1', type: 'prompt' }],
      unknownField: true,
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('creates a production-shaped real step executor for prompt and tool steps', async () => {
    const stepExecutor = createRealStepExecutor({
      promptExecutor: {
        getDefaultProvider: () => 'openai',
        execute: async (request) => ({
          success: true,
          content: `PROMPT:${request.prompt}`,
          provider: request.provider ?? 'openai',
          model: request.model ?? 'gpt-5.4',
          latencyMs: 5,
        }),
      },
      toolExecutor: {
        isToolAvailable: (toolName) => toolName === 'lint',
        getAvailableTools: () => ['lint'],
        execute: async (toolName, args) => ({
          success: true,
          output: { toolName, args },
          durationMs: 5,
        }),
      },
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
    });

    const promptResult = await stepExecutor(
      {
        stepId: 'prompt-step',
        type: 'prompt',
      },
      {
        workflowId: 'real-executor',
        stepIndex: 0,
        previousResults: [],
        input: { prompt: 'hello world' },
      },
    );

    const toolResult = await stepExecutor(
      {
        stepId: 'tool-step',
        type: 'tool',
        config: {
          toolName: 'lint',
        },
      },
      {
        workflowId: 'real-executor',
        stepIndex: 1,
        previousResults: [promptResult],
        input: { file: 'src/index.ts' },
      },
    );

    expect(promptResult.success).toBe(true);
    expect(promptResult.output).toMatchObject({
      content: 'PROMPT:hello world',
      provider: 'openai',
      model: 'gpt-5.4',
    });
    expect(toolResult.success).toBe(true);
    expect(toolResult.output).toMatchObject({
      type: 'tool',
      toolName: 'lint',
      toolOutput: {
        toolName: 'lint',
        args: { file: 'src/index.ts' },
      },
    });
  });

  it('returns discussion executor errors through the production-shaped executor', async () => {
    const stepExecutor = createRealStepExecutor({
      promptExecutor: {
        getDefaultProvider: () => 'openai',
        execute: async () => ({
          success: true,
          content: 'unused',
          latencyMs: 1,
        }),
      },
      discussionExecutor: {
        execute: async () => ({
          success: false,
          pattern: 'synthesis',
          topic: 'test topic',
          participatingProviders: ['openai', 'anthropic'],
          failedProviders: [],
          rounds: [],
          synthesis: '',
          consensus: { method: 'synthesis' },
          totalDurationMs: 10,
          metadata: {
            startedAt: new Date(0).toISOString(),
            completedAt: new Date(10).toISOString(),
          },
          error: {
            code: 'DISCUSSION_FAILED',
            message: 'providers disagreed',
          },
        }),
      },
    });

    const result = await stepExecutor(
      {
        stepId: 'discuss-step',
        type: 'discuss',
        config: {
          prompt: 'compare options',
          providers: ['openai', 'anthropic'],
        },
      },
      {
        workflowId: 'discussion-workflow',
        stepIndex: 0,
        previousResults: [],
        input: { content: 'context from previous step' },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: 'DISCUSSION_FAILED',
      message: 'providers disagreed',
    });
    expect(result.output).toMatchObject({
      type: 'discuss',
      pattern: 'synthesis',
    });
  });

  it('blocks runner execution when a before guard fails with block policy', async () => {
    const stepGuardEngine = createStepGuardEngine();
    stepGuardEngine.registerPolicy({
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

    const runner = createWorkflowRunner({
      stepGuardEngine,
    });

    const result = await runner.run({
      workflowId: 'guarded-workflow',
      version: '1.0.0',
      steps: [
        {
          stepId: 'tool-step',
          type: 'tool',
          config: {
            unexpected: true,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: 'WORKFLOW_GUARD_BLOCKED',
      failedStepId: 'tool-step',
    });
  });
});
