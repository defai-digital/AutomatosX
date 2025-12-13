import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock adapters
const sdkAvailableRef = vi.hoisted(() => ({ available: true }));
const sdkExecuteRef = vi.hoisted(() => ({
  content: 'sdk',
  tokensUsed: { prompt: 1, completion: 1, total: 2 },
  latencyMs: 1,
  finishReason: 'stop',
  cached: false,
  model: 'qwen-turbo'
}));
const hybridExecuteRef = vi.hoisted(() => ({
  content: 'hybrid',
  tokensUsed: { prompt: 1, completion: 1, total: 2 },
  latencyMs: 1,
  finishReason: 'stop',
  cached: false,
  model: 'qwen-turbo'
}));

vi.mock('../../../src/integrations/qwen-code/index.js', () => ({
  QwenSdkAdapter: class MockSdkAdapter {
    async isAvailable() {
      return sdkAvailableRef.available;
    }
    async execute() {
      return sdkExecuteRef;
    }
  },
  QwenHybridAdapter: class MockHybridAdapter {
    async execute() {
      return hybridExecuteRef;
    }
  },
  normalizeQwenModel: (m: string) => m,
  QWEN_DEFAULT_MODEL: 'qwen-turbo',
  isVisionModel: () => false,
  getModelContextWindow: () => 128000,
}));

import { QwenProvider } from '../../../src/providers/qwen-provider.js';
import type { QwenModel } from '../../../src/integrations/qwen-code/types.js';

const baseConfig = {
  name: 'qwen',
  enabled: true,
  priority: 1,
  timeout: 1000,
};

describe('QwenProvider', () => {
  beforeEach(() => {
    sdkAvailableRef.available = true;
    process.env.AX_MOCK_PROVIDERS = undefined;
  });

  it('falls back to default model when unknown', () => {
    const provider = new QwenProvider({ ...baseConfig, model: 'unknown' as QwenModel });
    // Access private method using type assertion
    const getNormalizedModel = (provider as unknown as { getNormalizedModel: () => string }).getNormalizedModel;
    expect(getNormalizedModel.call(provider)).toBe('qwen-turbo');
  });

  it('uses SDK mode by default', async () => {
    sdkAvailableRef.available = true;
    const provider = new QwenProvider({ ...baseConfig });
    const res = await provider.execute({ prompt: 'hello' });
    expect(res.content).toBe('sdk');
  });

  it('uses hybrid adapter in auto mode', async () => {
    const provider = new QwenProvider({ ...baseConfig, mode: 'auto' });
    const res = await provider.execute({ prompt: 'hi' });
    expect(res.content).toBe('hybrid');
  });

  it('throws when SDK unavailable in sdk mode', async () => {
    sdkAvailableRef.available = false;
    const provider = new QwenProvider({ ...baseConfig });
    await expect(provider.execute({ prompt: 'fail' })).rejects.toThrow(/SDK is not available/);
  });
});
