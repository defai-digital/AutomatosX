import { describe, expect, it } from 'vitest';
import { GeminiProvider } from '@/providers/gemini-provider.js';

const baseConfig = {
  name: 'gemini',
  enabled: true,
  priority: 1,
  timeout: 1000
};

describe('GeminiProvider', () => {
  it('exposes CLI capabilities and args', async () => {
    const provider = new GeminiProvider(baseConfig);
    const args = await (provider as any).getCLIArgs();

    expect((provider as any).getCLICommand()).toBe('gemini');
    expect(args).toEqual(['--approval-mode', 'auto_edit', '--output-format', 'stream-json']);
    expect(provider.capabilities.integrationMode).toBe('cli');
    expect(provider.capabilities.supportsMcp).toBe(false);
  });

  it('executes in mock mode through base provider', async () => {
    const provider = new GeminiProvider(baseConfig);
    const result = await provider.execute({
      prompt: 'Hello Gemini',
      systemPrompt: 'System',
      maxTokens: 16,
      temperature: 0.2
    });

    expect(result.content).toContain('Mock Gemini Response');
    expect(result.model).toBe('default');
    expect(result.tokensUsed.total).toBe(0);
    expect(result.cached).toBe(false);
  });
});
