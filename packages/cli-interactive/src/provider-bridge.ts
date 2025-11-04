/**
 * Provider Bridge
 *
 * Bridges the interactive CLI with AutomatosX providers
 * Handles streaming and error recovery
 */

import type { StreamEvent } from './types.js';

/**
 * Simple provider interface for interactive CLI
 */
export interface InteractiveProvider {
  name: string;
  streamResponse(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamEvent>;
  isAvailable(): Promise<boolean>;
}

/**
 * Mock Provider for testing (simulates Gemini-like responses)
 */
export class MockProvider implements InteractiveProvider {
  name = 'Gemini 2.5 Flash (simulated)';

  async *streamResponse(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    // Bug #8 fix: Check for cancellation before starting
    if (signal?.aborted) {
      yield {
        type: 'error',
        data: {
          message: 'Stream cancelled by user',
          code: 'STREAM_CANCELLED'
        }
      };
      return;
    }

    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check cancellation after initial delay
    if (signal?.aborted) {
      yield {
        type: 'error',
        data: {
          message: 'Stream cancelled by user',
          code: 'STREAM_CANCELLED'
        }
      };
      return;
    }

    // Generate response
    const responses = [
      `I understand your request about: "${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}"\n\n`,
      `Let me help you with that. `,
      `This is a simulated response for testing purposes. `,
      `The real Gemini integration will provide actual AI-generated content.\n\n`,
      `What you can do:\n`,
      `- Use /help to see available commands\n`,
      `- Try @agent task to delegate to specialized agents\n`,
      `- Type /agents to see all available agents\n\n`,
      `The interactive CLI is working! Real Gemini integration coming soon.`
    ];

    // Stream token by token
    for (const chunk of responses) {
      for (const char of chunk) {
        // Bug #8 fix: Check for cancellation during streaming
        if (signal?.aborted) {
          yield {
            type: 'error',
            data: {
              message: 'Stream cancelled by user',
              code: 'STREAM_CANCELLED'
            }
          };
          return;
        }

        yield {
          type: 'token',
          data: char
        };
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Final completion event
    yield {
      type: 'completion',
      data: {
        tokensUsed: this.estimateTokens(prompt + responses.join('')),
        provider: this.name
      }
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Gemini Provider Bridge
 * Integrates with AutomatosX GeminiProvider
 */
export class GeminiProviderBridge implements InteractiveProvider {
  name = 'Gemini 2.5 Flash';
  private useMock: boolean;

  constructor(useMock = false) {  // Default to real provider
    this.useMock = useMock;
    // Update name based on mode
    if (useMock) {
      this.name = 'Gemini 2.5 Flash (simulated)';
    }
  }

  async *streamResponse(prompt: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    if (this.useMock) {
      // Use mock provider for testing
      const mock = new MockProvider();
      yield* mock.streamResponse(prompt, signal);
      return;
    }

    // Integrate with real Gemini provider
    try {
      // Dynamic imports at runtime only
      const geminiProviderModule = await import('../../../src/providers/gemini-provider.js') as any;
      const configModule = await import('../../../src/core/config.js') as any;

      const config = await configModule.loadConfig(process.cwd());

      // Use gemini-cli from config (note: provider name is gemini-cli, not gemini)
      const baseConfig = config.providers?.['gemini-cli'];
      const geminiConfig = baseConfig ? {
        name: 'gemini-cli',  // Add name field (not in config file)
        ...baseConfig
      } : {
        name: 'gemini-cli',
        enabled: true,
        priority: 2,
        timeout: 2700000,
        command: 'gemini'
      };

      const provider = new geminiProviderModule.GeminiProvider(geminiConfig);

      // Create request
      const request = {
        prompt,
        maxTokens: 4096,
        temperature: 0.7
      };

      // Use true streaming with GeminiProvider.executeStreaming()
      // This provides real-time token streaming without artificial delays
      const streamingOptions = {
        enabled: true,
        onToken: (token: string) => {
          // Token callback is handled by the streaming mechanism
          // We'll collect tokens via the async generator below
        }
      };

      // Bug Fix #1: Implement true real-time streaming using token queue
      // Bug Fix #15: Add queue size limits to prevent DoS
      const tokenQueue: string[] = [];
      const MAX_QUEUE_SIZE_MB = 10; // 10MB limit
      const MAX_QUEUE_LENGTH = 1000; // Max 1000 pending tokens
      let queueSizeBytes = 0;
      let streamComplete = false;
      let streamError: Error | null = null as Error | null;  // Explicit type annotation
      let accumulatedContent = '';

      // Execute with streaming - tokens arrive via onToken callback
      const responsePromise = provider.executeStreaming(request, {
        enabled: true,
        onToken: (token: string) => {
          const tokenBytes = Buffer.byteLength(token, 'utf8');

          // Bug #15 fix: Enforce queue limits to prevent memory exhaustion
          if (queueSizeBytes + tokenBytes > MAX_QUEUE_SIZE_MB * 1024 * 1024) {
            streamError = new Error('Response too large: queue size limit exceeded (10MB)');
            return;
          }

          if (tokenQueue.length >= MAX_QUEUE_LENGTH) {
            streamError = new Error('Response too fast: queue overflow (1000 tokens)');
            return;
          }

          // Accumulate for final response
          accumulatedContent += token;
          // Queue for real-time streaming
          tokenQueue.push(token);
          queueSizeBytes += tokenBytes;
        }
      }).then((response: any) => {
        streamComplete = true;
        return response;
      }).catch((error: any) => {
        streamError = error;
        streamComplete = true;
        throw error;
      });

      // Stream tokens in real-time as they arrive in the queue
      // This provides true real-time streaming without waiting for full response
      while (!streamComplete || tokenQueue.length > 0) {
        // Bug #8 fix: Check for cancellation during streaming
        if (signal?.aborted) {
          streamComplete = true; // Stop the loop
          yield {
            type: 'error',
            data: {
              message: 'Stream cancelled by user',
              code: 'STREAM_CANCELLED'
            }
          };
          return;
        }

        // Check for errors
        if (streamError) {
          yield { type: 'error', data: { message: streamError.message } };
          throw streamError;
        }

        // Yield tokens from queue
        if (tokenQueue.length > 0) {
          const token = tokenQueue.shift()!;
          queueSizeBytes -= Buffer.byteLength(token, 'utf8');

          // Bug #15 fix: Yield entire tokens instead of char-by-char (faster consumption)
          yield {
            type: 'token',
            data: token
          };
        } else {
          // Wait briefly for more tokens (avoid busy-waiting)
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Get final response for metadata
      const response = await responsePromise;

      // Update provider name with actual model if available
      if (response.model) {
        // Map model IDs to friendly names
        const modelNames: Record<string, string> = {
          'gemini-2.5-flash': 'Gemini 2.5 Flash',
          'gemini-2.0-flash-exp': 'Gemini 2.5 Flash',
          'gemini-1.5-pro': 'Gemini 1.5 Pro',
          'gemini-1.5-flash': 'Gemini 1.5 Flash'
        };
        this.name = modelNames[response.model] || response.model;
      }

      // Yield completion event
      yield {
        type: 'completion',
        data: {
          tokensUsed: response.tokensUsed?.total || this.estimateTokens(response.content),
          provider: this.name,
          model: response.model
        }
      };

    } catch (error: unknown) {
      // Import ProviderError dynamically to check error type
      const errorsModule = await import('../../../src/utils/errors.js') as any;
      const ProviderError = errorsModule.ProviderError;

      // Check if this is a ProviderError with structured metadata
      if (error instanceof ProviderError) {
        // Preserve ProviderError metadata (code, suggestions, context)
        const providerError = error as any;  // Cast to access ProviderError properties
        yield {
          type: 'error',
          data: {
            message: `Gemini API error: ${providerError.message}`,
            code: providerError.code,
            suggestions: providerError.suggestions,
            context: providerError.context,
            error: error as Error
          }
        };
      } else {
        // Generic error handling
        yield {
          type: 'error',
          data: {
            message: `Gemini API error: ${(error as Error).message}`,
            error: error as Error
          }
        };
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this.useMock) {
      return true;
    }

    try {
      // Check if gemini CLI is available
      const { spawn } = await import('child_process');
      return new Promise((resolve) => {
        const child = spawn('which', ['gemini']);

        // Bug Fix #2: Add timeout to prevent hanging (5 second timeout)
        const timeout = setTimeout(() => {
          // Bug Fix #3: Kill process on timeout to prevent leak
          child.kill('SIGTERM');
          resolve(false);
        }, 5000);

        // Bug Fix #3: Clean up timeout and ensure process is killed
        const cleanup = (result: boolean) => {
          clearTimeout(timeout);
          // Ensure process is terminated (idempotent - safe to call multiple times)
          child.kill('SIGTERM');
          resolve(result);
        };

        child.on('exit', (code) => {
          cleanup(code === 0);
        });

        child.on('error', () => {
          cleanup(false);
        });
      });
    } catch {
      return false;
    }
  }

  private estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Get the appropriate provider based on environment
 */
export async function getProvider(): Promise<InteractiveProvider> {
  // Check if we should use mock mode
  // Default to real providers in production, only mock if explicitly requested
  const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true';

  const provider = new GeminiProviderBridge(useMock);

  // Check availability
  const available = await provider.isAvailable();

  if (!available && !useMock) {
    console.warn('[Provider] Gemini not available, using mock mode');
    return new MockProvider();
  }

  return provider;
}
