/**
 * Unit tests for provider-bridge
 * Tests MockProvider and GeminiProviderBridge
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockProvider, GeminiProviderBridge } from '../../../packages/cli-interactive/src/provider-bridge.js';
import type { StreamEvent } from '../../../packages/cli-interactive/src/types.js';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('initialization', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('Gemini 2.5 Flash (simulated)');
    });

    it('should be available', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('streamResponse', () => {
    it('should stream tokens for a simple prompt', async () => {
      const prompt = 'Hello';
      const events: StreamEvent[] = [];

      for await (const event of provider.streamResponse(prompt)) {
        events.push(event);
      }

      // Should have token events and completion event
      expect(events.length).toBeGreaterThan(0);

      const tokenEvents = events.filter(e => e.type === 'token');
      const completionEvents = events.filter(e => e.type === 'completion');

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(completionEvents.length).toBe(1);
    });

    it('should include prompt in response', async () => {
      const prompt = 'TestPrompt123';
      const events: StreamEvent[] = [];

      for await (const event of provider.streamResponse(prompt)) {
        events.push(event);
      }

      const fullText = events
        .filter(e => e.type === 'token')
        .map(e => e.data)
        .join('');

      expect(fullText).toContain('TestPrompt123');
    });

    it('should provide completion metadata', async () => {
      const prompt = 'Test';
      let completionEvent: StreamEvent | undefined;

      for await (const event of provider.streamResponse(prompt)) {
        if (event.type === 'completion') {
          completionEvent = event;
        }
      }

      expect(completionEvent).toBeDefined();
      expect(completionEvent?.data).toHaveProperty('tokensUsed');
      expect(completionEvent?.data).toHaveProperty('provider');

      // Type narrowing for discriminated union
      if (completionEvent && completionEvent.type === 'completion') {
        expect(completionEvent.data.provider).toBe('Gemini 2.5 Flash (simulated)');
        expect(typeof completionEvent.data.tokensUsed).toBe('number');
        expect(completionEvent.data.tokensUsed).toBeGreaterThan(0);
      }
    });

    it('should estimate tokens correctly', async () => {
      const shortPrompt = 'Hi';
      const longPrompt = 'This is a much longer prompt with many more characters';

      let shortTokens = 0;
      let longTokens = 0;

      for await (const event of provider.streamResponse(shortPrompt)) {
        if (event.type === 'completion') {
          shortTokens = event.data.tokensUsed;
        }
      }

      for await (const event of provider.streamResponse(longPrompt)) {
        if (event.type === 'completion') {
          longTokens = event.data.tokensUsed;
        }
      }

      // Longer prompt should use more tokens
      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should stream character by character', async () => {
      const prompt = 'Test';
      const tokenEvents: StreamEvent[] = [];

      for await (const event of provider.streamResponse(prompt)) {
        if (event.type === 'token') {
          tokenEvents.push(event);
        }
      }

      // Should have multiple token events (streaming effect)
      expect(tokenEvents.length).toBeGreaterThan(10);

      // Most tokens should be single characters or small chunks
      const singleCharTokens = tokenEvents.filter(e =>
        typeof e.data === 'string' && e.data.length <= 2
      );
      expect(singleCharTokens.length).toBeGreaterThan(0);
    });
  });
});

describe('GeminiProviderBridge', () => {
  describe('mock mode', () => {
    let provider: GeminiProviderBridge;

    beforeEach(() => {
      provider = new GeminiProviderBridge(true); // Mock mode
    });

    it('should initialize with mock mode enabled', () => {
      expect(provider.name).toContain('simulated');
    });

    it('should be available in mock mode', async () => {
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should stream responses in mock mode', async () => {
      const prompt = 'Test prompt';
      const events: StreamEvent[] = [];

      for await (const event of provider.streamResponse(prompt)) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);

      const hasTokens = events.some(e => e.type === 'token');
      const hasCompletion = events.some(e => e.type === 'completion');

      expect(hasTokens).toBe(true);
      expect(hasCompletion).toBe(true);
    });

    it('should delegate to MockProvider in mock mode', async () => {
      const prompt = 'Hello';
      let completionData: any;

      for await (const event of provider.streamResponse(prompt)) {
        if (event.type === 'completion') {
          completionData = event.data;
        }
      }

      // Mock provider should be used
      expect(completionData.provider).toContain('simulated');
    });
  });

  describe('real mode (may fail without gemini CLI)', () => {
    let provider: GeminiProviderBridge;

    beforeEach(() => {
      provider = new GeminiProviderBridge(false); // Real mode
    });

    it('should initialize with real mode', () => {
      // Name doesn't contain "simulated" initially
      expect(provider.name).toBe('Gemini 2.5 Flash');
    });

    it('should check availability correctly', async () => {
      const available = await provider.isAvailable();
      // May be true or false depending on environment
      expect(typeof available).toBe('boolean');
    });

    // Note: Real streaming tests would require actual Gemini CLI
    // These are tested in integration tests instead
  });

  describe('error handling', () => {
    it('should handle stream errors gracefully', async () => {
      const provider = new GeminiProviderBridge(true);
      const events: StreamEvent[] = [];

      // This should still work and not throw
      try {
        for await (const event of provider.streamResponse('')) {
          events.push(event);
        }
        // Empty prompt should still get a response in mock mode
        expect(events.length).toBeGreaterThan(0);
      } catch (error) {
        // If it errors, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });
});

describe('Provider integration', () => {
  it('should provide consistent interface between mock and real', async () => {
    const mockProvider = new MockProvider();
    const bridgeProvider = new GeminiProviderBridge(true);

    // Both should have the same interface
    expect(typeof mockProvider.streamResponse).toBe('function');
    expect(typeof bridgeProvider.streamResponse).toBe('function');
    expect(typeof mockProvider.isAvailable).toBe('function');
    expect(typeof bridgeProvider.isAvailable).toBe('function');

    // Both should be available
    expect(await mockProvider.isAvailable()).toBe(true);
    expect(await bridgeProvider.isAvailable()).toBe(true);
  });

  it('should produce compatible event streams', async () => {
    const mockProvider = new MockProvider();
    const bridgeProvider = new GeminiProviderBridge(true);

    const prompt = 'Test';
    const mockEvents: StreamEvent[] = [];
    const bridgeEvents: StreamEvent[] = [];

    for await (const event of mockProvider.streamResponse(prompt)) {
      mockEvents.push(event);
    }

    for await (const event of bridgeProvider.streamResponse(prompt)) {
      bridgeEvents.push(event);
    }

    // Both should produce events
    expect(mockEvents.length).toBeGreaterThan(0);
    expect(bridgeEvents.length).toBeGreaterThan(0);

    // Both should have the same event types
    const mockEventTypes = new Set(mockEvents.map(e => e.type));
    const bridgeEventTypes = new Set(bridgeEvents.map(e => e.type));

    expect(mockEventTypes).toEqual(bridgeEventTypes);
  });
});
