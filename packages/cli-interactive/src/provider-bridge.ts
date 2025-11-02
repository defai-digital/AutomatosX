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
  streamResponse(prompt: string): AsyncGenerator<StreamEvent>;
  isAvailable(): Promise<boolean>;
}

/**
 * Mock Provider for testing (simulates Gemini-like responses)
 */
export class MockProvider implements InteractiveProvider {
  name = 'Gemini 2.5 Flash (simulated)';

  async *streamResponse(prompt: string): AsyncGenerator<StreamEvent> {
    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 500));

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

  constructor(useMock = true) {
    this.useMock = useMock;
    // Update name based on mode
    if (useMock) {
      this.name = 'Gemini 2.5 Flash (simulated)';
    }
  }

  async *streamResponse(prompt: string): AsyncGenerator<StreamEvent> {
    if (this.useMock) {
      // Use mock provider for testing
      const mock = new MockProvider();
      yield* mock.streamResponse(prompt);
      return;
    }

    // Integrate with real Gemini provider
    try {
      // Dynamic imports at runtime only
      const geminiProviderModule = await import('../../../src/providers/gemini-provider.js') as any;
      const configModule = await import('../../../src/core/config.js') as any;

      const config = await configModule.loadConfig();
      const geminiConfig = config.providers?.gemini || { name: 'gemini', command: 'gemini' };

      const provider = new geminiProviderModule.GeminiProvider(geminiConfig);

      // Execute request
      const request = {
        prompt,
        maxTokens: 4096,
        temperature: 0.7
      };

      const response = await provider.execute(request);

      // Stream the response character by character
      for (const char of response.content) {
        yield {
          type: 'token',
          data: char
        };
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Update provider name with actual model if available
      if (response.model) {
        // Map model IDs to friendly names
        const modelNames: Record<string, string> = {
          'gemini-2.5-flash': 'Gemini 2.5 Flash',
          'gemini-2.0-flash-exp': 'Gemini 2.5 Flash', // 2.0 Flash Experimental is now 2.5
          'gemini-1.5-pro': 'Gemini 1.5 Pro',
          'gemini-1.5-flash': 'Gemini 1.5 Flash'
        };
        this.name = modelNames[response.model] || response.model;
      }

      yield {
        type: 'completion',
        data: {
          tokensUsed: response.tokensUsed?.total || 0,
          provider: this.name,
          model: response.model
        }
      };

    } catch (error) {
      yield {
        type: 'error',
        data: {
          message: `Gemini API error: ${(error as Error).message}`,
          error
        }
      };
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
        child.on('exit', (code) => {
          resolve(code === 0);
        });
        child.on('error', () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
}

/**
 * Get the appropriate provider based on environment
 */
export async function getProvider(): Promise<InteractiveProvider> {
  // Check if we should use mock mode
  const useMock = process.env.AUTOMATOSX_MOCK_PROVIDERS !== 'false';

  const provider = new GeminiProviderBridge(useMock);

  // Check availability
  const available = await provider.isAvailable();

  if (!available) {
    console.warn('[Provider] Gemini not available, using mock mode');
    return new MockProvider();
  }

  return provider;
}
