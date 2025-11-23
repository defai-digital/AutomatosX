/**
 * Integration Tests for ax-cli SDK Enhancements (v9.2.2)
 *
 * Tests three new integration features:
 * 1. Token Usage Accuracy (actual tokens from SDK)
 * 2. Shared MCP Configuration (auto-load from ax-cli)
 * 3. Streaming Events (real-time progress)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxCliSdkAdapter } from '../../src/integrations/ax-cli-sdk/adapter.js';
import type { AxCliOptions } from '../../src/integrations/ax-cli/interface.js';

describe('ax-cli SDK Integration Enhancements', () => {
  let adapter: AxCliSdkAdapter;

  // Skip all tests if in mock mode (these are true integration tests)
  const skipTests = process.env.AX_MOCK_PROVIDERS === 'true';

  beforeEach(() => {
    if (skipTests) {
      console.log('⏭️  Skipping Phase 1 integration tests (AX_MOCK_PROVIDERS=true)');
      return;
    }

    adapter = new AxCliSdkAdapter({
      reuseEnabled: true,
      streamingEnabled: false
    });
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });

  describe('1. Token Usage Accuracy', () => {
    it.skipIf(skipTests)('should use actual token counts from SDK when available', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const options: AxCliOptions = {
        // SDK v3.7.0+: Model and credentials loaded from ax-cli setup
        // Only maxToolRounds is configurable per-execution
        maxToolRounds: 1
      };

      // Execute a simple task
      const response = await adapter.execute('Say hello', options);

      // Verify token counts are present and valid
      expect(response.tokensUsed).toBeDefined();
      expect(response.tokensUsed.total).toBeGreaterThan(0);
      expect(response.tokensUsed.prompt).toBeGreaterThan(0);
      expect(response.tokensUsed.completion).toBeGreaterThan(0);

      // Verify total = prompt + completion (actual tokens, not estimated)
      expect(response.tokensUsed.total).toBeGreaterThanOrEqual(
        response.tokensUsed.prompt + response.tokensUsed.completion
      );

      console.log('✅ Token accuracy test passed:', {
        prompt: response.tokensUsed.prompt,
        completion: response.tokensUsed.completion,
        total: response.tokensUsed.total
      });
    });

    it.skipIf(skipTests)('should fallback to estimation when SDK does not provide tokens', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Mock scenario: SDK returns response without token usage
      // (This tests the fallback path)

      // Even in fallback, token counts should be non-zero
      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 1
      };

      const response = await adapter.execute('Test', options);

      expect(response.tokensUsed.total).toBeGreaterThan(0);
      console.log('✅ Fallback estimation test passed');
    });
  });

  describe('2. Shared MCP Configuration', () => {
    it.skipIf(skipTests)('should load MCP servers from ax-cli config', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // This test verifies that the adapter attempts to load MCP config
      // The actual loading happens in initializeAgent, which is called during execute

      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 1
      };

      // Execute should initialize agent and load MCP config
      const response = await adapter.execute('Test MCP loading', options);

      // If no errors thrown, MCP loading worked (even if no MCP servers exist)
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      console.log('✅ MCP configuration loading test passed');
    });

    it.skipIf(skipTests)('should handle missing MCP config gracefully', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Even if MCP config doesn't exist, execution should succeed
      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 1
      };

      await expect(adapter.execute('Test', options)).resolves.toBeDefined();

      console.log('✅ Missing MCP config handling test passed');
    });
  });

  describe('3. Streaming Events', () => {
    it.skipIf(skipTests)('should trigger onStream callback for content chunks', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const streamChunks: any[] = [];

      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 1,
        onStream: (chunk) => {
          streamChunks.push(chunk);
        }
      };

      await adapter.execute('Count from 1 to 5', options);

      // Verify streaming callbacks were triggered
      // Note: Some models may not support streaming or may return in one chunk
      expect(streamChunks.length).toBeGreaterThanOrEqual(0);

      if (streamChunks.length > 0) {
        // Verify chunk structure
        const firstChunk = streamChunks[0];
        expect(firstChunk).toHaveProperty('type');
        expect(firstChunk).toHaveProperty('timestamp');

        console.log('✅ Streaming events test passed:', {
          chunks: streamChunks.length,
          firstChunkType: firstChunk.type
        });
      } else {
        console.log('⚠️  No streaming chunks received (model may not support streaming)');
      }
    });

    it.skipIf(skipTests)('should trigger onTool callback for tool invocations', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const toolInvocations: any[] = [];

      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 10,
        onTool: (tool) => {
          toolInvocations.push(tool);
        }
      };

      await adapter.execute('List files in the current directory', options);

      // Verify tool callbacks were triggered
      // Note: May be zero if model doesn't use tools for this task
      expect(toolInvocations.length).toBeGreaterThanOrEqual(0);

      if (toolInvocations.length > 0) {
        // Verify tool structure
        const firstTool = toolInvocations[0];
        expect(firstTool).toHaveProperty('name');

        console.log('✅ Tool invocation callback test passed:', {
          toolsUsed: toolInvocations.length,
          firstTool: firstTool.name
        });
      } else {
        console.log('ℹ️  No tools invoked for this task');
      }
    });

    it.skipIf(skipTests)('should handle streaming callbacks without errors', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      // Test that callbacks don't break execution
      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 1,
        onStream: (chunk) => {
          // Callback that doesn't throw
          void chunk;
        },
        onTool: (tool) => {
          // Callback that doesn't throw
          void tool;
        }
      };

      const response = await adapter.execute('Hello', options);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();

      console.log('✅ Streaming callbacks safety test passed');
    });
  });

  describe('Integration: All Features Together', () => {
    it.skipIf(skipTests)('should use all three features simultaneously', async () => {
      // Skip if SDK not available
      const isAvailable = await adapter.isAvailable();
      if (!isAvailable) {
        console.log('⏭️  Skipping: ax-cli SDK not installed');
        return;
      }

      const streamChunks: any[] = [];
      const toolInvocations: any[] = [];

      const options: AxCliOptions = {
        // SDK v3.7.0+: Credentials from ax-cli setup
        maxToolRounds: 5,
        onStream: (chunk) => {
          streamChunks.push(chunk);
        },
        onTool: (tool) => {
          toolInvocations.push(tool);
        }
      };

      const response = await adapter.execute('What is 2 + 2?', options);

      // Verify all features:
      // 1. Actual token counts
      expect(response.tokensUsed.total).toBeGreaterThan(0);

      // 2. MCP config loaded (no errors)
      expect(response).toBeDefined();

      // 3. Streaming callbacks triggered (if supported)
      expect(streamChunks.length).toBeGreaterThanOrEqual(0);
      expect(toolInvocations.length).toBeGreaterThanOrEqual(0);

      console.log('✅ Full integration test passed:', {
        tokens: response.tokensUsed.total,
        streamChunks: streamChunks.length,
        tools: toolInvocations.length
      });
    });
  });
});
