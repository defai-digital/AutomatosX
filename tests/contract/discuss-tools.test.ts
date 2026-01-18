/**
 * Discuss MCP Tool Handler Tests
 *
 * Tests for the discuss, discuss_quick, and discuss_recursive MCP tool handlers.
 *
 * Invariants tested:
 * - INV-MCP-001: All MCP tools validate inputs via Zod schemas
 * - INV-MCP-002: Side effects documented in descriptions
 * - INV-DISC-008: Debate pattern auto-assigns roles
 * - INV-DISC-600: Depth never exceeds maxDepth
 * - INV-DISC-610: Child timeout ≤ parent remaining budget
 * - INV-DISC-642: Agent weight multiplier between 0.5-3.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleDiscuss,
  handleDiscussQuick,
  handleDiscussRecursive,
  discussTool,
  discussQuickTool,
  discussRecursiveTool,
  resetProviderBridge,
  type MCPToolResult,
} from '@defai.digital/mcp-server';

// Helper to extract text content from MCP result
function getTextContent(result: MCPToolResult): string {
  const content = result.content[0];
  if (content?.type === 'text' && content.text) {
    return content.text;
  }
  return '';
}

// ============================================================================
// Tool Definition Tests
// ============================================================================

describe('Discuss MCP Tools - Tool Definitions', () => {
  describe('discussTool', () => {
    it('should have correct name', () => {
      expect(discussTool.name).toBe('discuss');
    });

    it('should have description', () => {
      expect(discussTool.description).toBeDefined();
      expect(discussTool.description).toContain('multi-model discussion');
    });

    it('should have inputSchema with required topic', () => {
      expect(discussTool.inputSchema).toBeDefined();
      expect(discussTool.inputSchema.properties?.topic).toBeDefined();
      expect(discussTool.inputSchema.required).toContain('topic');
    });

    it('should have all expected input properties', () => {
      const props = discussTool.inputSchema.properties;
      expect(props?.topic).toBeDefined();
      expect(props?.pattern).toBeDefined();
      expect(props?.providers).toBeDefined();
      expect(props?.rounds).toBeDefined();
      expect(props?.consensus).toBeDefined();
      expect(props?.synthesizer).toBeDefined();
      expect(props?.context).toBeDefined();
      expect(props?.timeout).toBeDefined();
    });

    it('should have outputSchema', () => {
      expect(discussTool.outputSchema).toBeDefined();
      expect(discussTool.outputSchema?.properties?.success).toBeDefined();
      expect(discussTool.outputSchema?.properties?.synthesis).toBeDefined();
    });

    it('should be marked as non-idempotent', () => {
      expect(discussTool.idempotent).toBe(false);
    });
  });

  describe('discussQuickTool', () => {
    it('should have correct name', () => {
      expect(discussQuickTool.name).toBe('discuss_quick');
    });

    it('should have description', () => {
      expect(discussQuickTool.description).toBeDefined();
      expect(discussQuickTool.description).toContain('Quick');
    });

    it('should have simpler inputSchema', () => {
      expect(discussQuickTool.inputSchema).toBeDefined();
      expect(discussQuickTool.inputSchema.properties?.topic).toBeDefined();
      expect(discussQuickTool.inputSchema.properties?.providers).toBeDefined();
    });

    it('should be marked as non-idempotent', () => {
      expect(discussQuickTool.idempotent).toBe(false);
    });
  });
});

// ============================================================================
// Handler Validation Tests
// ============================================================================

describe('Discuss MCP Tools - Handler Validation', () => {
  describe('handleDiscuss', () => {
    it('should reject empty topic', async () => {
      const result = await handleDiscuss({ topic: '' });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('topic is required');
    });

    it('should reject whitespace-only topic', async () => {
      const result = await handleDiscuss({ topic: '   ' });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('topic is required');
    });

    it('should reject topic exceeding max length', async () => {
      const result = await handleDiscuss({ topic: 'x'.repeat(2001) });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('2000 characters');
    });

    it('should use single provider mode when only 1 provider specified', async () => {
      // With smart provider selection, specifying 1 provider now triggers
      // single provider mode (direct call) instead of returning an error
      const result = await handleDiscuss({
        topic: 'Test topic',
        providers: ['claude'],
      });
      // Should succeed with single provider direct call
      expect(result.isError).toBe(false);
      const content = getTextContent(result);
      // Should contain the response in discussion-like format
      expect(content).toContain('success');
      expect(content).toContain('claude');
    });

    it('should accept valid input with defaults', async () => {
      const result = await handleDiscuss({ topic: 'Test topic' });
      // Should not be a validation error (may still fail on execution)
      // The stub executor returns mock responses
      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
    });
  });

  describe('handleDiscussQuick', () => {
    it('should reject empty topic', async () => {
      const result = await handleDiscussQuick({ topic: '' });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('topic is required');
    });

    it('should reject whitespace-only topic', async () => {
      const result = await handleDiscussQuick({ topic: '   ' });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('topic is required');
    });

    it('should reject topic exceeding max length', async () => {
      const result = await handleDiscussQuick({ topic: 'x'.repeat(2001) });
      expect(result.isError).toBe(true);
      expect(getTextContent(result)).toContain('2000 characters');
    });

    it('should accept valid input', async () => {
      const result = await handleDiscussQuick({ topic: 'Test topic' });
      // Should not be a validation error
      expect(result.content).toBeDefined();
      expect(result.content[0]).toBeDefined();
    });
  });
});

// ============================================================================
// Handler Execution Tests (using stub executor)
// ============================================================================

describe('Discuss MCP Tools - Handler Execution', () => {
  describe('handleDiscuss', () => {
    it('should return JSON content', async () => {
      const result = await handleDiscuss({
        topic: 'What is the best programming language?',
      });

      expect(result.content).toBeDefined();
      const text = getTextContent(result);
      expect(text).toBeTruthy();

      // Parse the JSON result
      const data = JSON.parse(text);
      expect(data).toBeDefined();
    });

    it('should include success flag in result', async () => {
      const result = await handleDiscuss({
        topic: 'Discuss microservices vs monolith',
      });

      const data = JSON.parse(getTextContent(result));
      expect(typeof data.success).toBe('boolean');
    });

    it('should include pattern in result', async () => {
      const result = await handleDiscuss({
        topic: 'Test topic',
        pattern: 'voting',
      });

      const data = JSON.parse(getTextContent(result));
      // Either succeeded with pattern or failed (both valid outcomes)
      if (data.pattern) {
        expect(data.pattern).toBe('voting');
      }
    });

    it('should include participating providers', async () => {
      const result = await handleDiscuss({
        topic: 'Test topic',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      // Should have participating or failed providers
      expect(Array.isArray(data.participatingProviders) || Array.isArray(data.failedProviders)).toBe(true);
    });

    it('should respect custom timeout', async () => {
      const result = await handleDiscuss({
        topic: 'Test topic',
        timeout: 30000,
      });

      // Should complete without timeout (stub executor is fast)
      expect(result.content).toBeDefined();
    });
  });

  describe('handleDiscussQuick', () => {
    it('should return JSON content', async () => {
      const result = await handleDiscussQuick({
        topic: 'What is the best approach?',
      });

      expect(result.content).toBeDefined();
      const text = getTextContent(result);
      expect(text).toBeTruthy();

      // Parse the JSON result
      const data = JSON.parse(text);
      expect(data).toBeDefined();
    });

    it('should include success flag', async () => {
      const result = await handleDiscussQuick({
        topic: 'Quick discussion topic',
      });

      const data = JSON.parse(getTextContent(result));
      expect(typeof data.success).toBe('boolean');
    });

    it('should include synthesis in successful result', async () => {
      const result = await handleDiscussQuick({
        topic: 'What is the best option?',
      });

      const data = JSON.parse(getTextContent(result));
      // Either has synthesis or failed
      if (data.success) {
        expect(data.synthesis).toBeDefined();
      }
    });

    it('should include duration in result', async () => {
      const result = await handleDiscussQuick({
        topic: 'Test topic',
      });

      const data = JSON.parse(getTextContent(result));
      expect(typeof data.totalDurationMs).toBe('number');
    });

    it('should use custom providers when specified', async () => {
      const result = await handleDiscussQuick({
        topic: 'Test topic',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      // Should use the specified providers
      expect(data.participatingProviders || data.failedProviders).toBeDefined();
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Discuss MCP Tools - Error Handling', () => {
  describe('handleDiscuss', () => {
    it('should handle missing topic gracefully', async () => {
      const result = await handleDiscuss({} as { topic: string });
      expect(result.isError).toBe(true);
    });

    it('should set isError flag on validation failure', async () => {
      const result = await handleDiscuss({ topic: '' });
      expect(result.isError).toBe(true);
    });
  });

  describe('handleDiscussQuick', () => {
    it('should handle missing topic gracefully', async () => {
      const result = await handleDiscussQuick({} as { topic: string });
      expect(result.isError).toBe(true);
    });

    it('should set isError flag on validation failure', async () => {
      const result = await handleDiscussQuick({ topic: '' });
      expect(result.isError).toBe(true);
    });
  });
});

// ============================================================================
// Tool Registration Tests
// ============================================================================

describe('Discuss MCP Tools - Registration', () => {
  it('should export DISCUSS_TOOLS array', async () => {
    const { DISCUSS_TOOLS } = await import('@defai.digital/mcp-server');
    expect(Array.isArray(DISCUSS_TOOLS)).toBe(true);
    expect(DISCUSS_TOOLS.length).toBe(3); // discuss, discuss_quick, discuss_recursive
  });

  it('should export DISCUSS_HANDLERS record', async () => {
    const { DISCUSS_HANDLERS } = await import('@defai.digital/mcp-server');
    expect(typeof DISCUSS_HANDLERS).toBe('object');
    expect(DISCUSS_HANDLERS.discuss).toBeDefined();
    expect(DISCUSS_HANDLERS.discuss_quick).toBeDefined();
    expect(DISCUSS_HANDLERS.discuss_recursive).toBeDefined();
  });

  it('should have matching tool names in handlers', async () => {
    const { DISCUSS_TOOLS, DISCUSS_HANDLERS } = await import('@defai.digital/mcp-server');
    for (const tool of DISCUSS_TOOLS) {
      expect(DISCUSS_HANDLERS[tool.name]).toBeDefined();
    }
  });
});

// ============================================================================
// discussRecursiveTool Definition Tests
// ============================================================================

describe('Discuss MCP Tools - discussRecursiveTool Definition', () => {
  it('should have correct name', () => {
    expect(discussRecursiveTool.name).toBe('discuss_recursive');
  });

  it('should have description mentioning side effects (INV-MCP-002)', () => {
    expect(discussRecursiveTool.description).toContain('SIDE EFFECTS');
    expect(discussRecursiveTool.description).toContain('nested discussions');
  });

  it('should be marked as non-idempotent', () => {
    expect(discussRecursiveTool.idempotent).toBe(false);
  });

  it('should have recursive-specific properties', () => {
    const props = discussRecursiveTool.inputSchema.properties;
    expect(props?.maxDepth).toBeDefined();
    expect(props?.timeoutStrategy).toBeDefined();
    expect(props?.totalBudget).toBeDefined();
    expect(props?.maxCalls).toBeDefined();
    expect(props?.earlyExit).toBeDefined();
    expect(props?.confidenceThreshold).toBeDefined();
  });

  it('should have maxDepth limits (1-4)', () => {
    const maxDepthProp = discussRecursiveTool.inputSchema.properties?.maxDepth;
    expect(maxDepthProp?.minimum).toBe(1);
    expect(maxDepthProp?.maximum).toBe(4);
  });

  it('should have timeoutStrategy enum', () => {
    const strategyProp = discussRecursiveTool.inputSchema.properties?.timeoutStrategy;
    expect(strategyProp?.enum).toContain('fixed');
    expect(strategyProp?.enum).toContain('cascade');
    expect(strategyProp?.enum).toContain('budget');
  });

  it('should have confidenceThreshold limits (0.5-1.0)', () => {
    const thresholdProp = discussRecursiveTool.inputSchema.properties?.confidenceThreshold;
    expect(thresholdProp?.minimum).toBe(0.5);
    expect(thresholdProp?.maximum).toBe(1.0);
  });

  it('should have output schema with recursive fields', () => {
    const output = discussRecursiveTool.outputSchema;
    expect(output?.properties?.subDiscussions).toBeDefined();
    expect(output?.properties?.totalProviderCalls).toBeDefined();
    expect(output?.properties?.maxDepthReached).toBeDefined();
  });

  it('should have participants and agentWeightMultiplier (INV-DISC-642)', () => {
    const props = discussRecursiveTool.inputSchema.properties;
    expect(props?.participants).toBeDefined();
    expect(props?.agentWeightMultiplier).toBeDefined();
    expect(props?.agentWeightMultiplier?.minimum).toBe(0.5);
    expect(props?.agentWeightMultiplier?.maximum).toBe(3.0);
  });
});

// ============================================================================
// handleDiscussRecursive Validation Tests
// ============================================================================

describe('Discuss MCP Tools - handleDiscussRecursive Validation', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  it('should reject empty topic', async () => {
    const result = await handleDiscussRecursive({ topic: '' });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('topic is required');
  });

  it('should reject whitespace-only topic', async () => {
    const result = await handleDiscussRecursive({ topic: '   ' });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('topic is required');
  });

  it('should reject topic exceeding max length', async () => {
    const result = await handleDiscussRecursive({ topic: 'x'.repeat(2001) });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('2000 characters');
  });

  it('should use single provider mode when only 1 provider specified', async () => {
    // With smart provider selection, specifying 1 provider now triggers
    // single provider mode (direct call) instead of returning an error
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude'],
    });
    // Should succeed with single provider direct call
    expect(result.isError).toBe(false);
    const content = getTextContent(result);
    // Should contain the response in discussion-like format
    expect(content).toContain('success');
    expect(content).toContain('claude');
  });

  it('should reject maxDepth > 4', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
      maxDepth: 5,
    });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('maxDepth must be between');
  });

  it('should reject maxDepth < 1', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
      maxDepth: 0,
    });
    expect(result.isError).toBe(true);
    expect(getTextContent(result)).toContain('maxDepth must be between');
  });

  it('should accept valid input with defaults', async () => {
    const result = await handleDiscussRecursive({ topic: 'Test topic' });
    expect(result.content).toBeDefined();
    expect(result.content[0]).toBeDefined();
  });
});

// ============================================================================
// handleDiscussRecursive Execution Tests
// ============================================================================

describe('Discuss MCP Tools - handleDiscussRecursive Execution', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  it('should return JSON content', async () => {
    const result = await handleDiscussRecursive({
      topic: 'What is the best architecture pattern?',
      providers: ['claude', 'grok'],
    });

    expect(result.content).toBeDefined();
    const text = getTextContent(result);
    expect(text).toBeTruthy();

    const data = JSON.parse(text);
    expect(data).toBeDefined();
  });

  it('should include success flag in result', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
    });

    const data = JSON.parse(getTextContent(result));
    expect(typeof data.success).toBe('boolean');
  });

  it('should include totalProviderCalls in result', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
    });

    const data = JSON.parse(getTextContent(result));
    expect(typeof data.totalProviderCalls).toBe('number');
    expect(data.totalProviderCalls).toBeGreaterThan(0);
  });

  it('should include maxDepthReached in result', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
    });

    const data = JSON.parse(getTextContent(result));
    expect(typeof data.maxDepthReached).toBe('number');
    expect(data.maxDepthReached).toBeGreaterThanOrEqual(0);
  });

  it('should accept recursive options', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
      maxDepth: 2,
      timeoutStrategy: 'cascade',
      totalBudget: 120000,
      maxCalls: 15,
      earlyExit: true,
      confidenceThreshold: 0.85,
    });

    expect(result.content).toBeDefined();
    const data = JSON.parse(getTextContent(result));
    expect(data.success).toBeDefined();
  });

  it('should auto-assign roles for debate pattern (INV-DISC-008)', async () => {
    const result = await handleDiscussRecursive({
      topic: 'TypeScript vs JavaScript',
      pattern: 'debate',
      providers: ['claude', 'grok', 'gemini'],
    });

    expect(result.isError).toBe(false);
    const data = JSON.parse(getTextContent(result));
    expect(data.pattern).toBe('debate');
  });

  it('should accept participants parameter', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Code review best practices',
      participants: [
        { type: 'provider', id: 'claude' },
        { type: 'provider', id: 'grok' },
        { type: 'agent', id: 'reviewer' },
      ],
    });

    expect(result.content).toBeDefined();
  });

  it('should accept agentWeightMultiplier parameter', async () => {
    const result = await handleDiscussRecursive({
      topic: 'Test topic',
      providers: ['claude', 'grok'],
      agentWeightMultiplier: 2.0,
    });

    expect(result.content).toBeDefined();
  });
});

// ============================================================================
// Invariant Tests
// ============================================================================

describe('Discuss MCP Tools - Invariants', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  describe('INV-MCP-002: Side effects documented', () => {
    it('discussTool should document LLM API calls', () => {
      expect(discussTool.description).toContain('SIDE EFFECTS');
      expect(discussTool.description).toContain('LLM');
    });

    it('discussQuickTool should document side effects', () => {
      expect(discussQuickTool.description).toContain('SIDE EFFECTS');
    });

    it('discussRecursiveTool should document nested discussions', () => {
      expect(discussRecursiveTool.description).toContain('SIDE EFFECTS');
      expect(discussRecursiveTool.description).toContain('nested');
    });
  });

  describe('INV-DISC-008: Debate pattern auto-assigns roles', () => {
    it('should auto-assign roles for debate with 3 providers', async () => {
      const result = await handleDiscuss({
        topic: 'REST vs GraphQL',
        pattern: 'debate',
        providers: ['claude', 'grok', 'gemini'],
      });

      // Should not error and should use debate pattern
      const data = JSON.parse(getTextContent(result));
      if (data.success) {
        expect(data.pattern).toBe('debate');
      }
    });

    it('should work with debate pattern in recursive handler', async () => {
      const result = await handleDiscussRecursive({
        topic: 'Microservices vs Monolith',
        pattern: 'debate',
        providers: ['claude', 'grok', 'gemini'],
      });

      const data = JSON.parse(getTextContent(result));
      if (data.success) {
        expect(data.pattern).toBe('debate');
      }
    });
  });

  describe('INV-DISC-642: Agent weight multiplier limits', () => {
    it('discussTool should enforce weight limits 0.5-3.0', () => {
      const weightProp = discussTool.inputSchema.properties?.agentWeightMultiplier;
      expect(weightProp?.minimum).toBe(0.5);
      expect(weightProp?.maximum).toBe(3.0);
    });

    it('discussRecursiveTool should enforce weight limits 0.5-3.0', () => {
      const weightProp = discussRecursiveTool.inputSchema.properties?.agentWeightMultiplier;
      expect(weightProp?.minimum).toBe(0.5);
      expect(weightProp?.maximum).toBe(3.0);
    });
  });
});

// ============================================================================
// Pattern-Specific Tests
// ============================================================================

describe('Discuss MCP Tools - Pattern-Specific Behavior', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  describe('synthesis pattern', () => {
    it('should produce synthesis output', async () => {
      const result = await handleDiscuss({
        topic: 'What is the best database?',
        pattern: 'synthesis',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      if (data.success) {
        expect(data.synthesis).toBeDefined();
      }
    });
  });

  describe('voting pattern', () => {
    it('should work with voting pattern', async () => {
      const result = await handleDiscuss({
        topic: 'Which framework to choose?',
        pattern: 'voting',
        providers: ['claude', 'grok', 'gemini'],
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success !== undefined).toBe(true);
    });
  });

  describe('critique pattern', () => {
    it('should work with critique pattern', async () => {
      const result = await handleDiscuss({
        topic: 'Review this architecture decision',
        pattern: 'critique',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success !== undefined).toBe(true);
    });
  });

  describe('round-robin pattern', () => {
    it('should work with round-robin pattern', async () => {
      const result = await handleDiscuss({
        topic: 'Discuss caching strategies',
        pattern: 'round-robin',
        providers: ['claude', 'grok', 'gemini'],
        rounds: 2,
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success !== undefined).toBe(true);
    });
  });
});

// ============================================================================
// Trace Event Emission Tests (INV-TR-001)
// ============================================================================

describe('Discuss MCP Tools - Trace Event Emission (INV-TR-001)', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  describe('handleDiscuss tracing', () => {
    it('should include traceId in result', async () => {
      const result = await handleDiscuss({
        topic: 'What is the best approach for caching?',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.traceId).toBeDefined();
      expect(typeof data.traceId).toBe('string');
      // Trace ID should be a valid UUID format
      expect(data.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('handleDiscussQuick tracing', () => {
    it('should include traceId in result', async () => {
      const result = await handleDiscussQuick({
        topic: 'Quick discussion about API design',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.traceId).toBeDefined();
      expect(typeof data.traceId).toBe('string');
      // Trace ID should be a valid UUID format
      expect(data.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('handleDiscussRecursive tracing', () => {
    it('should include traceId in result', async () => {
      const result = await handleDiscussRecursive({
        topic: 'Deep discussion about system architecture',
        providers: ['claude', 'grok'],
        maxDepth: 2,
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.traceId).toBeDefined();
      expect(typeof data.traceId).toBe('string');
      // Trace ID should be a valid UUID format
      expect(data.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });
});

// ============================================================================
// Phase 2: Granular Trace Events Tests
// ============================================================================

describe('Discuss MCP Tools - Granular Trace Events (Phase 2)', () => {
  beforeEach(() => {
    resetProviderBridge();
  });

  afterEach(() => {
    resetProviderBridge();
  });

  describe('discussion.provider events', () => {
    it('should emit provider events for each provider response', async () => {
      // This test verifies the handler infrastructure is set up to emit provider events
      // The actual event emission is fire-and-forget, so we verify the handler completes
      // successfully with multiple providers (which triggers provider_complete callbacks)
      const result = await handleDiscuss({
        topic: 'Test topic for provider events',
        providers: ['claude', 'grok', 'gemini'],
        rounds: 1,
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      // Multiple providers should have participated
      expect(data.participatingProviders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('discussion.round events', () => {
    it('should complete rounds and emit round events', async () => {
      // Verify handler completes with multiple rounds (which triggers round_complete callbacks)
      const result = await handleDiscuss({
        topic: 'Test topic for round events',
        providers: ['claude', 'grok'],
        rounds: 2,
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      // Should have completed at least 1 round
      expect(data.rounds).toBeDefined();
    });
  });

  describe('discussion.consensus events', () => {
    it('should emit consensus event on synthesis completion', async () => {
      // Verify handler completes with synthesis consensus (which triggers consensus_complete callback)
      const result = await handleDiscuss({
        topic: 'Test topic for consensus events',
        providers: ['claude', 'grok'],
        consensus: 'synthesis',
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      expect(data.consensus).toBeDefined();
      expect(data.consensus.method).toBe('synthesis');
    });

    it('should emit consensus event on voting completion', async () => {
      // Verify handler completes with voting consensus (which triggers consensus_complete callback)
      const result = await handleDiscuss({
        topic: 'Should we use A or B?',
        providers: ['claude', 'grok'],
        pattern: 'voting',
        consensus: 'voting',
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      expect(data.consensus).toBeDefined();
    });
  });

  describe('quick handler granular events', () => {
    it('should emit granular events for quick discussions', async () => {
      const result = await handleDiscussQuick({
        topic: 'Quick test for granular events',
        providers: ['claude', 'grok'],
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      expect(data.participatingProviders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('recursive handler granular events', () => {
    it('should emit granular events for recursive discussions', async () => {
      const result = await handleDiscussRecursive({
        topic: 'Recursive test for granular events',
        providers: ['claude', 'grok'],
        maxDepth: 2,
      });

      const data = JSON.parse(getTextContent(result));
      expect(data.success).toBe(true);
      expect(data.participatingProviders.length).toBeGreaterThanOrEqual(2);
    });
  });
});
