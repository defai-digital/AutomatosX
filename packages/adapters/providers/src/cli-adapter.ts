/**
 * Generic CLI adapter for LLM providers
 *
 * DESIGN: AutomatosX does NOT manage credentials.
 * Each provider CLI handles its own authentication.
 * We simply spawn CLI processes and parse their output.
 */

import type {
  LLMProvider,
  CLIProviderConfig,
  CompletionRequest,
  CompletionResponse,
  HealthCheckResult,
  ModelConfig,
} from './types.js';
import { spawnCLI, isCommandAvailable, getCommandVersion, buildPromptFromMessages } from './process-manager.js';
import { parseOutput, extractOrEstimateTokenUsage } from './output-parser.js';
import { classifyError, classifySpawnResult } from './error-classifier.js';

/**
 * Creates a CLI-based LLM provider adapter
 *
 * @param config - Provider configuration (command, args, models, etc.)
 * @returns LLMProvider implementation that calls the CLI
 */
export function createCLIAdapter(config: CLIProviderConfig): LLMProvider {
  return {
    providerId: config.providerId,
    config,

    /**
     * Executes a completion request by calling the CLI
     */
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const startTime = Date.now();

      try {
        // Build prompt from messages
        const prompt = buildPromptFromMessages(request.messages, request.systemPrompt);

        // Determine how to pass the prompt based on promptStyle
        const useArgStyle = config.promptStyle === 'arg';
        const args = useArgStyle
          ? [...config.args, prompt]  // Append prompt as argument
          : [...config.args];         // Use stdin for prompt

        // Spawn CLI process
        const result = await spawnCLI({
          command: config.command,
          args,
          stdin: useArgStyle ? '' : prompt,  // Only use stdin if not using arg style
          env: config.env,
          timeout: request.timeout ?? config.timeout,
        });

        const latencyMs = Date.now() - startTime;

        // Check for errors (non-zero exit code or timeout)
        if (result.exitCode !== 0 || result.timedOut) {
          const error = classifySpawnResult(result);
          return {
            success: false,
            requestId: request.requestId,
            error,
            latencyMs,
          };
        }

        // Parse output
        const parsed = parseOutput(result.stdout, config.outputFormat);

        // Extract or estimate token usage
        const usage = extractOrEstimateTokenUsage(
          parsed.metadata,
          prompt,
          parsed.content
        );

        return {
          success: true,
          requestId: request.requestId,
          content: parsed.content,
          model: request.model,
          usage,
          stopReason: 'end_turn',
          latencyMs,
          cached: false,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
          success: false,
          requestId: request.requestId,
          error: classifyError(error),
          latencyMs,
        };
      }
    },

    /**
     * Checks if the provider CLI is available and healthy
     */
    async checkHealth(): Promise<HealthCheckResult> {
      const startTime = Date.now();

      const available = await isCommandAvailable(config.command);
      const latencyMs = Date.now() - startTime;

      if (!available) {
        return {
          providerId: config.providerId,
          timestamp: Date.now(),
          status: 'unhealthy',
          latencyMs,
          details: {
            cliAvailable: false,
            cliCommand: config.command,
          },
        };
      }

      // Try to get version
      const version = await getCommandVersion(config.command);

      return {
        providerId: config.providerId,
        timestamp: Date.now(),
        status: 'healthy',
        latencyMs,
        details: {
          cliAvailable: true,
          cliCommand: config.command,
          version,
        },
      };
    },

    /**
     * Checks if a model is supported by this provider
     */
    supportsModel(model: string): boolean {
      return config.models.some((m) => m.modelId === model);
    },

    /**
     * Gets all available models for this provider
     */
    getModels(): readonly ModelConfig[] {
      return config.models;
    },

    /**
     * Checks if the provider CLI is available
     */
    async isAvailable(): Promise<boolean> {
      return isCommandAvailable(config.command);
    },

    /**
     * Estimates token count for text (approximate)
     * Uses ~4 characters per token as a conservative estimate
     */
    estimateTokens(text: string): number {
      return Math.ceil(text.length / 4);
    },
  };
}

/**
 * Creates multiple CLI adapters from an array of configs
 *
 * @param configs - Array of provider configurations
 * @returns Map of providerId to LLMProvider
 */
export function createCLIAdapters(
  configs: readonly CLIProviderConfig[]
): Map<string, LLMProvider> {
  const adapters = new Map<string, LLMProvider>();

  for (const config of configs) {
    adapters.set(config.providerId, createCLIAdapter(config));
  }

  return adapters;
}
