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
 * Extracts error message from JSON error response in stdout
 * Handles formats like OpenCode: {"type":"error","error":{"data":{"message":"..."}}}
 *
 * @param stdout - Raw stdout from CLI process
 * @returns Error message if found, null otherwise
 */
function extractJsonErrorFromStdout(stdout: string): string | null {
  if (stdout.length === 0) {
    return null;
  }

  try {
    // Try to parse as JSON (may be one line or multiple lines)
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || !trimmed.startsWith('{')) {
        continue;
      }

      const data = JSON.parse(trimmed) as Record<string, unknown>;

      // Check for type: "error" format (OpenCode style)
      if (data.type === 'error') {
        const error = data.error as Record<string, unknown> | undefined;
        if (error !== undefined) {
          // Try error.data.message first
          const errorData = error.data as Record<string, unknown> | undefined;
          if (errorData?.message !== undefined && typeof errorData.message === 'string') {
            return errorData.message;
          }
          // Try error.message
          if (typeof error.message === 'string') {
            return error.message;
          }
        }
      }

      // Check for direct error field
      if (typeof data.error === 'string') {
        return data.error;
      }
      if (typeof data.message === 'string' && data.type === 'error') {
        return data.message;
      }
    }
  } catch {
    // Not valid JSON, ignore
  }

  return null;
}

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
          earlyTerminateOn: config.earlyTerminateOn,
        });

        const latencyMs = Date.now() - startTime;

        // Parse output first - we may have valid output even if process timed out
        const parsed = parseOutput(result.stdout, config.outputFormat);

        // Check for JSON error response in stdout (e.g., OpenCode returns errors as JSON)
        // Format: {"type":"error","error":{"name":"...","data":{"message":"..."}}}
        const stdoutErrorMessage = extractJsonErrorFromStdout(result.stdout);

        // Check for errors (non-zero exit code or timeout)
        // BUT: if we got valid output and the process timed out OR was early-terminated
        // (common with CLIs that don't exit cleanly), treat it as success.
        const hasValidOutput = parsed.content.length > 0;
        const processKilledWithOutput = (result.timedOut || result.earlyTerminated) && hasValidOutput;

        if ((result.exitCode !== 0 || result.timedOut) && !processKilledWithOutput) {
          // If we have a JSON error from stdout, use that instead of stderr
          if (stdoutErrorMessage !== null) {
            return {
              success: false,
              requestId: request.requestId,
              error: classifyError(stdoutErrorMessage),
              latencyMs,
            };
          }
          const error = classifySpawnResult(result);
          return {
            success: false,
            requestId: request.requestId,
            error,
            latencyMs,
          };
        }

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
