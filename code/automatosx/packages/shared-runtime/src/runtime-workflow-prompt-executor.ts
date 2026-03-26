import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

export function createWorkflowPromptExecutor(
  providerBridge: ProviderBridgeLike,
  tokenize: (value: string) => number,
  provider?: string,
  model?: string,
) {
  return {
    getDefaultProvider: () => provider ?? 'claude',
    execute: async (request: {
      prompt: string;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      timeout?: number;
    }) => {
      const resolvedProvider = request.provider ?? provider ?? 'claude';
      const bridgeResult = await providerBridge.executePrompt({
        provider: resolvedProvider,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        model: request.model ?? model ?? 'v14-shared-runtime',
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        timeoutMs: request.timeout,
      });

      if (bridgeResult.type === 'response' || bridgeResult.type === 'failure') {
        return bridgeResult.response;
      }

      const content = [
        request.systemPrompt ? `System: ${request.systemPrompt}` : undefined,
        `Prompt: ${request.prompt}`,
      ].filter((value): value is string => value !== undefined).join('\n');
      const promptInputTokens = tokenize(request.prompt) + (request.systemPrompt ? tokenize(request.systemPrompt) : 0);
      const promptOutputTokens = tokenize(content);
      return {
        success: true,
        content,
        provider: resolvedProvider,
        model: request.model ?? model ?? 'v14-shared-runtime',
        latencyMs: 0,
        usage: {
          inputTokens: promptInputTokens,
          outputTokens: promptOutputTokens,
          totalTokens: promptInputTokens + promptOutputTokens,
        },
      };
    },
  };
}
