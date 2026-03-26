import { describe, expect, it } from 'vitest';
import { createWorkflowPromptExecutor } from '../src/runtime-workflow-prompt-executor.js';

describe('runtime workflow prompt executor', () => {
  it('returns subprocess responses from the provider bridge unchanged', async () => {
    const executor = createWorkflowPromptExecutor(
      {
        executePrompt: async (request) => ({
          type: 'response',
          response: {
            success: true,
            provider: request.provider,
            model: request.model,
            content: `REAL:${request.prompt}`,
            latencyMs: 12,
            mode: 'subprocess',
          },
        }),
      },
      (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      'claude',
      'workflow-model',
    );

    await expect(executor.execute({
      prompt: 'Summarize release risk.',
    })).resolves.toMatchObject({
      success: true,
      provider: 'claude',
      model: 'workflow-model',
      content: 'REAL:Summarize release risk.',
      latencyMs: 12,
    });
  });

  it('simulates prompt output when no provider executor is available', async () => {
    const executor = createWorkflowPromptExecutor(
      {
        executePrompt: async () => ({
          type: 'unavailable',
          error: 'missing executor',
        }),
      },
      (value) => value.split(/\s+/).filter((entry) => entry.length > 0).length,
      'claude',
      'workflow-model',
    );

    await expect(executor.execute({
      prompt: 'Summarize release risk.',
      systemPrompt: 'Be concise.',
      provider: 'openai',
      model: 'override-model',
    })).resolves.toMatchObject({
      success: true,
      provider: 'openai',
      model: 'override-model',
      latencyMs: 0,
      content: 'System: Be concise.\nPrompt: Summarize release risk.',
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      },
    });
  });
});
