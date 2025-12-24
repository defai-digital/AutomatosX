/**
 * Discuss MCP Tools
 *
 * Multi-model discussion orchestration tools for MCP server.
 *
 * INV-MCP-001: All inputs validated via Zod schemas
 * INV-MCP-002: Side effects documented in descriptions
 */

import type { MCPTool, ToolHandler, MCPToolResult } from '../types.js';
import {
  DiscussionExecutor,
  StubProviderExecutor,
  createProviderBridge,
  type DiscussionProviderExecutor,
  type ProviderRegistryLike,
} from '@automatosx/discussion-domain';
import {
  DEFAULT_PROVIDERS,
  TIMEOUT_PROVIDER_DEFAULT,
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
} from '@automatosx/contracts';
import { getProviderRegistry } from '../bootstrap.js';

// Check if we're in test environment
const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ============================================================================
// Provider Bridge for MCP
// ============================================================================

/**
 * Creates a real provider bridge for MCP server
 * Uses the actual provider registry from bootstrap for real LLM calls
 */
function createRealProviderBridge(): DiscussionProviderExecutor {
  const registry = getProviderRegistry();

  // Adapt registry to ProviderRegistryLike interface
  const registryAdapter = {
    get: (id: string) => registry.get(id),
    getAll: () => registry.getProviderIds()
      .map(id => registry.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined),
    has: (id: string) => registry.get(id) !== undefined,
  } as unknown as ProviderRegistryLike;

  return createProviderBridge(registryAdapter, {
    defaultTimeoutMs: TIMEOUT_PROVIDER_DEFAULT,
    performHealthChecks: true,
    healthCheckCacheMs: 60000,
  });
}

// Shared provider bridge instance
let _providerBridge: DiscussionProviderExecutor | null = null;

/**
 * Get the appropriate provider bridge based on environment
 * Uses stub in tests, real provider bridge otherwise
 */
function getProviderBridge(): DiscussionProviderExecutor {
  if (_providerBridge === null) {
    if (isTestEnv) {
      // Use stub executor in test environment to avoid real LLM calls
      _providerBridge = new StubProviderExecutor([...DEFAULT_PROVIDERS], 100);
    } else {
      // Use real provider bridge in production
      _providerBridge = createRealProviderBridge();
    }
  }
  return _providerBridge;
}

/**
 * Reset provider bridge (for testing)
 */
export function resetProviderBridge(): void {
  _providerBridge = null;
}

// ============================================================================
// discuss Tool
// ============================================================================

/**
 * Main discuss tool definition
 * INV-MCP-002: Side effects - executes LLM provider calls
 */
export const discussTool: MCPTool = {
  name: 'discuss',
  description: `Execute a multi-model discussion. Multiple AI providers discuss a topic and reach consensus through various patterns (synthesis, voting, debate, critique). SIDE EFFECTS: Makes LLM API calls to multiple providers.`,
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'The topic or question for discussion (max 2000 chars)',
      },
      pattern: {
        type: 'string',
        enum: ['synthesis', 'voting', 'debate', 'critique', 'round-robin'],
        description: 'Discussion pattern (default: synthesis)',
      },
      providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of providers to use (default: claude, glm, qwen, gemini)',
        minItems: 2,
        maxItems: 6,
      },
      rounds: {
        type: 'number',
        description: 'Number of discussion rounds (default: 2)',
        minimum: 1,
        maximum: 5,
      },
      consensus: {
        type: 'string',
        enum: ['synthesis', 'voting', 'moderator', 'unanimous', 'majority'],
        description: 'Consensus method (default: synthesis)',
      },
      synthesizer: {
        type: 'string',
        description: 'Provider for synthesis (default: claude)',
      },
      context: {
        type: 'string',
        description: 'Additional context for the discussion',
      },
      timeout: {
        type: 'number',
        description: 'Per-provider timeout in ms (default: 60000)',
        minimum: 5000,
        maximum: 300000,
      },
    },
    required: ['topic'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Whether discussion succeeded' },
      pattern: { type: 'string', description: 'Discussion pattern used' },
      topic: { type: 'string', description: 'Discussion topic' },
      participatingProviders: {
        type: 'array',
        items: { type: 'string' },
        description: 'Providers that participated',
      },
      failedProviders: {
        type: 'array',
        items: { type: 'string' },
        description: 'Providers that failed',
      },
      synthesis: { type: 'string', description: 'Final synthesized answer' },
      totalDurationMs: { type: 'number', description: 'Total duration in ms' },
      consensus: {
        type: 'object',
        properties: {
          method: { type: 'string' },
          synthesizer: { type: 'string' },
          agreementScore: { type: 'number' },
        },
      },
    },
    required: ['success', 'pattern', 'topic', 'participatingProviders'],
  },
  idempotent: false,
};

/**
 * Handler for discuss tool
 */
export const handleDiscuss: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    pattern = 'synthesis',
    providers = [...DEFAULT_PROVIDERS],
    rounds = 2,
    consensus = 'synthesis',
    synthesizer = 'claude',
    context,
    timeout = 60000,
  } = args as {
    topic: string;
    pattern?: DiscussionPattern;
    providers?: string[];
    rounds?: number;
    consensus?: ConsensusMethod;
    synthesizer?: string;
    context?: string;
    timeout?: number;
  };

  // Validate topic
  if (!topic || topic.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: topic is required' }],
      isError: true,
    };
  }

  if (topic.length > 2000) {
    return {
      content: [{ type: 'text', text: 'Error: topic must be <= 2000 characters' }],
      isError: true,
    };
  }

  // Validate providers
  if (providers.length < 2) {
    return {
      content: [{ type: 'text', text: 'Error: at least 2 providers required' }],
      isError: true,
    };
  }

  try {
    // Create discussion executor
    const providerBridge = getProviderBridge();
    const executor = new DiscussionExecutor({
      providerExecutor: providerBridge,
      defaultTimeoutMs: timeout,
      checkProviderHealth: true,
    });

    // Build config
    const config: DiscussStepConfig = {
      pattern,
      rounds,
      providers,
      prompt: topic,
      context,
      verbose: false,
      consensus: {
        method: consensus,
        synthesizer,
        threshold: 0.5,
        includeDissent: true,
      },
      providerTimeout: timeout,
      continueOnProviderFailure: true,
      minProviders: 2,
      temperature: 0.7,
    };

    // Execute discussion
    const result = await executor.execute(config);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Discussion failed: ${message}` }],
      isError: true,
    };
  }
};

// ============================================================================
// discuss_quick Tool
// ============================================================================

/**
 * Quick discuss tool for simple synthesis discussions
 * INV-MCP-002: Side effects - executes LLM provider calls
 */
export const discussQuickTool: MCPTool = {
  name: 'discuss_quick',
  description: `Quick multi-model synthesis discussion. Runs a 2-round synthesis discussion with default providers. Use this for simple topics that need multiple perspectives. SIDE EFFECTS: Makes LLM API calls.`,
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'The topic or question for discussion (max 2000 chars)',
      },
      providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific providers to use (default: claude, glm, qwen)',
        minItems: 2,
        maxItems: 4,
      },
    },
    required: ['topic'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      synthesis: { type: 'string', description: 'Synthesized answer' },
      participatingProviders: {
        type: 'array',
        items: { type: 'string' },
      },
      totalDurationMs: { type: 'number' },
    },
    required: ['success', 'synthesis', 'participatingProviders'],
  },
  idempotent: false,
};

/**
 * Handler for discuss_quick tool
 */
export const handleDiscussQuick: ToolHandler = async (args): Promise<MCPToolResult> => {
  const { topic, providers = ['claude', 'glm', 'qwen'] } = args as {
    topic: string;
    providers?: string[];
  };

  // Validate topic
  if (!topic || topic.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: topic is required' }],
      isError: true,
    };
  }

  if (topic.length > 2000) {
    return {
      content: [{ type: 'text', text: 'Error: topic must be <= 2000 characters' }],
      isError: true,
    };
  }

  try {
    // Create discussion executor
    const providerBridge = getProviderBridge();
    const executor = new DiscussionExecutor({
      providerExecutor: providerBridge,
      defaultTimeoutMs: 60000,
      checkProviderHealth: true,
    });

    // Quick synthesis with 2 rounds
    const result = await executor.quickSynthesis(topic, { providers });

    // Return simplified result
    const response = {
      success: result.success,
      synthesis: result.synthesis,
      participatingProviders: result.participatingProviders,
      totalDurationMs: result.totalDurationMs,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Quick discussion failed: ${message}` }],
      isError: true,
    };
  }
};

// ============================================================================
// Export Arrays
// ============================================================================

/**
 * All discuss tools
 */
export const DISCUSS_TOOLS: MCPTool[] = [discussTool, discussQuickTool];

/**
 * All discuss handlers
 */
export const DISCUSS_HANDLERS: Record<string, ToolHandler> = {
  discuss: handleDiscuss,
  discuss_quick: handleDiscussQuick,
};
