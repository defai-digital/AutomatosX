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
  RecursiveDiscussionExecutor,
  StubProviderExecutor,
  createProviderBridge,
  type DiscussionProviderExecutor,
  type ProviderRegistryLike,
} from '@defai.digital/discussion-domain';
import {
  DEFAULT_PROVIDERS,
  TIMEOUT_PROVIDER_DEFAULT,
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
  type TimeoutStrategy,
  type DiscussionParticipant,
} from '@defai.digital/contracts';
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
        description: 'Per-provider timeout in ms (default: 180000, max: 30 minutes)',
        minimum: 5000,
        maximum: 1800000,
      },
      participants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['provider', 'agent'] },
            id: { type: 'string' },
          },
          required: ['type', 'id'],
        },
        description: 'Mix of providers and agents to participate (format: [{type: "provider", id: "claude"}, {type: "agent", id: "reviewer"}])',
      },
      agentWeightMultiplier: {
        type: 'number',
        description: 'Weight multiplier for agent responses in consensus (default: 1.5)',
        minimum: 0.5,
        maximum: 3.0,
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
    timeout = 180000,
    participants,
    agentWeightMultiplier = 1.5,
  } = args as {
    topic: string;
    pattern?: DiscussionPattern;
    providers?: string[];
    rounds?: number;
    consensus?: ConsensusMethod;
    synthesizer?: string;
    context?: string;
    timeout?: number;
    participants?: DiscussionParticipant[];
    agentWeightMultiplier?: number;
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
      agentWeightMultiplier,
      // Include participants if specified
      ...(participants !== undefined && { participants }),
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
      defaultTimeoutMs: 180000,
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
// discuss_recursive Tool
// ============================================================================

/**
 * Recursive discuss tool for nested multi-model discussions
 * INV-MCP-002: Side effects - executes LLM provider calls with potential sub-discussions
 * INV-DISC-600: Depth never exceeds maxDepth
 * INV-DISC-610: Child timeout ≤ parent remaining budget
 */
export const discussRecursiveTool: MCPTool = {
  name: 'discuss_recursive',
  description: `Execute a recursive multi-model discussion. Providers can spawn sub-discussions during their response for deeper exploration. Supports depth control and timeout budgets. SIDE EFFECTS: Makes LLM API calls to multiple providers, may spawn nested discussions.`,
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
        description: 'Per-provider timeout in ms (default: 180000, max: 30 minutes)',
        minimum: 5000,
        maximum: 1800000,
      },
      // Recursive-specific options
      maxDepth: {
        type: 'number',
        description: 'Maximum recursion depth (default: 2, max: 4)',
        minimum: 1,
        maximum: 4,
      },
      timeoutStrategy: {
        type: 'string',
        enum: ['fixed', 'cascade', 'budget'],
        description: 'Timeout strategy: fixed (same per level), cascade (halve each level), budget (total pool)',
      },
      totalBudget: {
        type: 'number',
        description: 'Total timeout budget in ms (default: 600000, max: 30 minutes)',
        minimum: 30000,
        maximum: 1800000,
      },
      maxCalls: {
        type: 'number',
        description: 'Maximum total provider calls across all levels (default: 20)',
        minimum: 5,
        maximum: 100,
      },
      earlyExit: {
        type: 'boolean',
        description: 'Exit early if high confidence consensus reached (default: true)',
      },
      confidenceThreshold: {
        type: 'number',
        description: 'Confidence threshold for early exit (default: 0.9)',
        minimum: 0.5,
        maximum: 1.0,
      },
      participants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['provider', 'agent'] },
            id: { type: 'string' },
          },
          required: ['type', 'id'],
        },
        description: 'Mix of providers and agents to participate (format: [{type: "provider", id: "claude"}, {type: "agent", id: "reviewer"}])',
      },
      agentWeightMultiplier: {
        type: 'number',
        description: 'Weight multiplier for agent responses in consensus (default: 1.5)',
        minimum: 0.5,
        maximum: 3.0,
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
      // Recursive-specific outputs
      subDiscussions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            discussionId: { type: 'string' },
            topic: { type: 'string' },
            participatingProviders: { type: 'array', items: { type: 'string' } },
            synthesis: { type: 'string' },
            durationMs: { type: 'number' },
            depth: { type: 'number' },
          },
        },
        description: 'Sub-discussions that were spawned',
      },
      totalProviderCalls: {
        type: 'number',
        description: 'Total provider calls across all levels',
      },
      maxDepthReached: {
        type: 'number',
        description: 'Maximum depth reached during discussion',
      },
    },
    required: ['success', 'pattern', 'topic', 'participatingProviders'],
  },
  idempotent: false,
};

/**
 * Handler for discuss_recursive tool
 */
export const handleDiscussRecursive: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    pattern = 'synthesis',
    providers = [...DEFAULT_PROVIDERS],
    rounds = 2,
    consensus = 'synthesis',
    synthesizer = 'claude',
    context,
    timeout = 180000,
    // Recursive options
    maxDepth = 2,
    timeoutStrategy = 'cascade',
    totalBudget = 600000,
    maxCalls = 20,
    earlyExit = true,
    confidenceThreshold = 0.9,
    // Participant options
    participants,
    agentWeightMultiplier = 1.5,
  } = args as {
    topic: string;
    pattern?: DiscussionPattern;
    providers?: string[];
    rounds?: number;
    consensus?: ConsensusMethod;
    synthesizer?: string;
    context?: string;
    timeout?: number;
    maxDepth?: number;
    timeoutStrategy?: TimeoutStrategy;
    totalBudget?: number;
    maxCalls?: number;
    earlyExit?: boolean;
    confidenceThreshold?: number;
    participants?: DiscussionParticipant[];
    agentWeightMultiplier?: number;
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

  // Validate maxDepth
  if (maxDepth < 1 || maxDepth > 4) {
    return {
      content: [{ type: 'text', text: 'Error: maxDepth must be between 1 and 4' }],
      isError: true,
    };
  }

  try {
    // Create recursive discussion executor
    const providerBridge = getProviderBridge();
    const executor = new RecursiveDiscussionExecutor({
      providerExecutor: providerBridge,
      defaultTimeoutMs: timeout,
      checkProviderHealth: true,
      recursive: {
        enabled: true,
        maxDepth,
        allowedProviders: providers,
        allowSubDiscussions: true,
      },
      timeout: {
        strategy: timeoutStrategy,
        totalBudgetMs: totalBudget,
        minSynthesisMs: 10000,
      },
      cost: {
        maxTotalCalls: maxCalls,
        cascadingConfidence: {
          enabled: earlyExit,
          threshold: confidenceThreshold,
          minProviders: 2,
        },
      },
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
      agentWeightMultiplier,
      // Include participants if specified
      ...(participants !== undefined && { participants }),
    };

    // Execute recursive discussion
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
      content: [{ type: 'text', text: `Recursive discussion failed: ${message}` }],
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
export const DISCUSS_TOOLS: MCPTool[] = [discussTool, discussQuickTool, discussRecursiveTool];

/**
 * All discuss handlers
 */
export const DISCUSS_HANDLERS: Record<string, ToolHandler> = {
  discuss: handleDiscuss,
  discuss_quick: handleDiscussQuick,
  discuss_recursive: handleDiscussRecursive,
};
