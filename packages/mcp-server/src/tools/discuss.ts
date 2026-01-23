/**
 * Discuss MCP Tools
 *
 * Multi-model discussion orchestration tools for MCP server.
 *
 * INV-MCP-001: All inputs validated via Zod schemas
 * INV-MCP-002: Side effects documented in descriptions
 * INV-TR-001: Complete event chain (run.start → run.end) for all discussions
 */

import { randomUUID } from 'node:crypto';
import type { MCPTool, ToolHandler, MCPToolResult } from '../types.js';
import {
  DiscussionExecutor,
  RecursiveDiscussionExecutor,
  StubProviderExecutor,
  createProviderBridge,
  type DiscussionProviderExecutor,
  type ProviderRegistryLike,
  type DiscussionProgressEvent,
} from '@defai.digital/discussion-domain';
import {
  DEFAULT_PROVIDERS,
  DEFAULT_PROVIDER_TIMEOUT,
  MAX_PROVIDER_TIMEOUT,
  DEFAULT_TOTAL_BUDGET_MS,
  DEFAULT_ROUNDS,
  DEFAULT_DISCUSSION_DEPTH,
  DEFAULT_MAX_TOTAL_CALLS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_AGENT_WEIGHT_MULTIPLIER,
  createRootTraceHierarchy,
  createChildTraceHierarchy,
  getErrorMessage,
  type DiscussionPattern,
  type ConsensusMethod,
  type DiscussStepConfig,
  type TimeoutStrategy,
  type DiscussionParticipant,
  type TraceEvent,
  type TraceHierarchy,
} from '@defai.digital/contracts';
import { getProviderRegistry, getTraceStore } from '../shared-dependencies.js';

// Check if we're in test environment
const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ============================================================================
// Smart Provider Selection
// ============================================================================

/**
 * Result of smart provider selection
 */
interface SmartProviderSelectionResult {
  /** Selected providers for discussion */
  providers: string[];
  /** Whether to skip discussion and call provider directly */
  skipDiscussion: boolean;
  /** Single provider to use when skipDiscussion is true */
  singleProvider?: string;
  /** Error message if selection failed */
  error?: string;
}

/**
 * Randomly selects N items from an array (Fisher-Yates shuffle)
 */
function randomSelect<T>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];

  // Fisher-Yates shuffle
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled.slice(0, count);
}

/**
 * Smart provider selection logic:
 * - If providers specified: use them
 * - If not specified and ≥3 available: randomly pick 3
 * - If not specified and exactly 2 available: use both
 * - If not specified and exactly 1 available: skip discussion, use single provider
 * - If not specified and 0 available: error
 */
async function selectProviders(
  specifiedProviders: string[] | undefined,
  providerBridge: DiscussionProviderExecutor
): Promise<SmartProviderSelectionResult> {
  // If providers explicitly specified, use them
  if (specifiedProviders !== undefined && specifiedProviders.length > 0) {
    if (specifiedProviders.length < 2) {
      const singleProvider = specifiedProviders[0];
      if (singleProvider === undefined) {
        return {
          providers: [],
          skipDiscussion: false,
          error: 'Invalid provider specified.',
        };
      }
      return {
        providers: [],
        skipDiscussion: true,
        singleProvider,
      };
    }
    return {
      providers: specifiedProviders,
      skipDiscussion: false,
    };
  }

  // Get all available providers
  const availableProviders = await providerBridge.getAvailableProviders();

  if (availableProviders.length === 0) {
    return {
      providers: [],
      skipDiscussion: false,
      error: 'No providers available. Run "ax doctor" to check provider status.',
    };
  }

  if (availableProviders.length === 1) {
    // Only 1 provider - skip discussion, call directly
    const singleProvider = availableProviders[0];
    if (singleProvider === undefined) {
      return {
        providers: [],
        skipDiscussion: false,
        error: 'No providers available.',
      };
    }
    return {
      providers: [],
      skipDiscussion: true,
      singleProvider,
    };
  }

  if (availableProviders.length === 2) {
    // Exactly 2 providers - use both
    return {
      providers: availableProviders,
      skipDiscussion: false,
    };
  }

  // 3 or more providers - randomly pick 3
  const selectedProviders = randomSelect(availableProviders, 3);
  return {
    providers: selectedProviders,
    skipDiscussion: false,
  };
}

/**
 * Call a single provider directly (when only 1 provider available)
 */
async function callSingleProvider(
  topic: string,
  providerId: string,
  providerBridge: DiscussionProviderExecutor,
  timeout: number
): Promise<MCPToolResult> {
  try {
    const result = await providerBridge.execute({
      providerId,
      prompt: topic,
      timeoutMs: timeout,
    });

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Provider ${providerId} failed: ${result.error}` }],
        isError: true,
      };
    }

    // Return result in discussion-like format for consistency
    const response = {
      success: true,
      pattern: 'direct',
      topic,
      participatingProviders: [providerId],
      failedProviders: [],
      synthesis: result.content ?? '',
      totalDurationMs: result.durationMs,
      consensus: {
        method: 'direct',
        synthesizer: providerId,
        agreementScore: 1.0,
      },
      metadata: {
        singleProviderMode: true,
        message: `Only ${providerId} was available, so the topic was answered directly without discussion.`,
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(response) }],
      isError: false,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      content: [{ type: 'text', text: `Single provider call failed: ${message}` }],
      isError: true,
    };
  }
}

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
    defaultTimeoutMs: DEFAULT_PROVIDER_TIMEOUT,
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
        description: 'List of providers to use (default: claude, grok, gemini)',
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
        description: 'Per-provider timeout in ms (default: 600000 / 10 min, max: 30 minutes)',
        minimum: 5000,
        maximum: MAX_PROVIDER_TIMEOUT,
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
      fastMode: {
        type: 'boolean',
        description: 'Fast mode: single round, skip cross-discussion (~50% faster)',
      },
      roundEarlyExit: {
        type: 'boolean',
        description: 'Enable round-level early exit on high agreement (default: true)',
      },
      roundAgreementThreshold: {
        type: 'number',
        description: 'Agreement threshold for round early exit (default: 0.85)',
        minimum: 0.5,
        maximum: 1.0,
      },
      confidenceThreshold: {
        type: 'number',
        description: 'Confidence threshold for early exit on strong agreement (default: 0.9)',
        minimum: 0.5,
        maximum: 1.0,
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
 *
 * Smart provider selection:
 * - If providers specified: use them
 * - If not specified and ≥3 available: randomly pick 3
 * - If not specified and exactly 2 available: use both
 * - If not specified and exactly 1 available: skip discussion, use single provider
 * - If not specified and 0 available: error
 */
export const handleDiscuss: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    pattern = 'synthesis',
    providers: specifiedProviders,
    rounds = DEFAULT_ROUNDS,
    consensus = 'synthesis',
    synthesizer = 'claude',
    context,
    timeout = DEFAULT_PROVIDER_TIMEOUT,
    participants,
    agentWeightMultiplier = DEFAULT_AGENT_WEIGHT_MULTIPLIER,
    fastMode = false,
    roundEarlyExit = true,
    roundAgreementThreshold = 0.85,
    confidenceThreshold = 0.9, // High threshold for early exit on strong agreement
    // Trace hierarchy support (optional)
    sessionId,
    parentTraceId,
    rootTraceId: inputRootTraceId,
    parentDepth,
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
    fastMode?: boolean;
    roundEarlyExit?: boolean;
    roundAgreementThreshold?: number;
    confidenceThreshold?: number;
    sessionId?: string;
    parentTraceId?: string;
    rootTraceId?: string;
    parentDepth?: number;
  };

  // Initialize tracing (INV-TR-001)
  const traceId = randomUUID();
  const traceStore = getTraceStore();
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();

  // Create trace hierarchy context
  let traceHierarchy: TraceHierarchy;
  if (parentTraceId) {
    traceHierarchy = createChildTraceHierarchy(parentTraceId, {
      parentTraceId: undefined,
      rootTraceId: inputRootTraceId ?? parentTraceId,
      traceDepth: parentDepth ?? 0,
      sessionId,
    });
  } else {
    traceHierarchy = createRootTraceHierarchy(traceId, sessionId);
  }

  // Helper to emit trace events (fire-and-forget with error logging)
  const emitTraceEvent = (event: TraceEvent): void => {
    traceStore.write(event).catch((err) => {
      console.error('[discuss] Failed to write trace event:', err);
    });
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

  // Get provider bridge for selection
  const providerBridge = getProviderBridge();

  // Smart provider selection (before emitting start event to include providers in payload)
  const selection = await selectProviders(specifiedProviders, providerBridge);

  // Handle selection errors (before tracing starts)
  if (selection.error) {
    return {
      content: [{ type: 'text', text: `Error: ${selection.error}` }],
      isError: true,
    };
  }

  // If only 1 provider available, skip discussion and call directly (no trace for single provider)
  if (selection.skipDiscussion && selection.singleProvider) {
    return callSingleProvider(topic, selection.singleProvider, providerBridge, timeout);
  }

  const providers = selection.providers;

  // Validate debate pattern has enough providers
  if (pattern === 'debate' && providers.length < 2) {
    return {
      content: [{ type: 'text', text: 'Error: debate pattern requires at least 2 providers (proponent and opponent)' }],
      isError: true,
    };
  }

  // Emit run.start trace event (INV-TR-001)
  emitTraceEvent({
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTimestamp,
    context: {
      ...traceHierarchy,
    },
    payload: {
      command: 'discuss',
      topic: topic.substring(0, 200), // Truncate for payload
      pattern,
      providers,
      rounds: fastMode ? 1 : rounds,
      consensus,
      fastMode,
    },
  });

  // Helper to convert progress events to trace events (Phase 2: Granular Events)
  const onProgress = (event: DiscussionProgressEvent): void => {
    switch (event.type) {
      case 'provider_complete':
        // Emit discussion.provider trace event
        if (event.provider && event.round !== undefined) {
          // Build payload with optional content/prompt fields
          const providerPayload: Record<string, unknown> = {
            providerId: event.provider,
            roundNumber: event.round,
            success: event.success ?? false,
            durationMs: event.durationMs ?? 0,
            tokenCount: event.tokenCount,
            role: event.role,
            error: event.error,
          };
          // Add conversation content for dashboard visibility
          if (event.prompt !== undefined) {
            providerPayload.prompt = event.prompt;
          }
          if (event.content !== undefined) {
            providerPayload.content = event.content;
          }
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.provider',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            status: event.success ? 'success' : 'failure',
            context: {
              ...traceHierarchy,
              providerId: event.provider,
            },
            payload: providerPayload,
          });
        }
        break;
      case 'round_complete':
        // Emit discussion.round trace event
        if (event.round !== undefined) {
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.round',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            context: {
              ...traceHierarchy,
            },
            payload: {
              roundNumber: event.round,
              participatingProviders: event.participatingProviders ?? [],
              failedProviders: event.failedProviders,
              responseCount: event.responseCount ?? 0,
              durationMs: event.durationMs ?? 0,
            },
          });
        }
        break;
      case 'consensus_complete':
        // Emit discussion.consensus trace event
        emitTraceEvent({
          eventId: randomUUID(),
          traceId,
          type: 'discussion.consensus',
          timestamp: event.timestamp,
          durationMs: event.durationMs,
          status: event.success ? 'success' : 'failure',
          context: {
            ...traceHierarchy,
          },
          payload: {
            method: event.consensusMethod ?? 'synthesis',
            success: event.success ?? false,
            winner: event.winner,
            confidence: event.confidence,
            votes: event.votes,
            durationMs: event.durationMs ?? 0,
          },
        });
        break;
    }
  };

  try {
    // Create discussion executor with cascading confidence for early exit
    const executor = new DiscussionExecutor({
      providerExecutor: providerBridge,
      defaultTimeoutMs: timeout,
      checkProviderHealth: true,
      cascadingConfidence: {
        enabled: true,
        threshold: confidenceThreshold,
        minProviders: 2,
      },
    });

    // Auto-assign roles for debate pattern (INV-DISC-008)
    // First provider = proponent, second = opponent, third = judge (if available)
    let roles: Record<string, 'proponent' | 'opponent' | 'judge'> | undefined;
    if (pattern === 'debate') {
      roles = {};
      if (providers[0]) roles[providers[0]] = 'proponent';
      if (providers[1]) roles[providers[1]] = 'opponent';
      if (providers[2]) roles[providers[2]] = 'judge';
    }

    // Build config
    const config: DiscussStepConfig = {
      pattern,
      rounds: fastMode ? 1 : rounds, // Fast mode uses single round
      providers,
      prompt: topic,
      context,
      verbose: false,
      consensus: {
        method: pattern === 'debate' && providers[2] ? 'moderator' : consensus,
        synthesizer: pattern === 'debate' && providers[2] ? providers[2] : synthesizer,
        threshold: 0.5,
        includeDissent: true,
      },
      providerTimeout: timeout,
      continueOnProviderFailure: true,
      minProviders: 2,
      temperature: 0.7,
      agentWeightMultiplier,
      // Performance optimization options
      fastMode,
      roundEarlyExit: {
        enabled: roundEarlyExit,
        agreementThreshold: roundAgreementThreshold,
        minRounds: 1,
      },
      // Include participants if specified
      ...(participants !== undefined && { participants }),
      // Include roles for debate pattern (INV-DISC-008)
      ...(roles !== undefined && { roles }),
    };

    // Execute discussion with onProgress for granular tracing
    const result = await executor.execute(config, { onProgress });

    // Extract provider responses from rounds for dashboard (like CLI does)
    const providerResponses: Record<string, string[]> = {};
    if (result.rounds) {
      for (const round of result.rounds) {
        for (const response of round.responses ?? []) {
          const providerId = response.provider ?? 'unknown';
          if (!providerResponses[providerId]) {
            providerResponses[providerId] = [];
          }
          if (response.content) {
            providerResponses[providerId].push(response.content);
          }
        }
      }
    }

    // Emit run.end trace event with success (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: result.success ? 'success' : 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss',
        success: result.success,
        pattern,
        providers,
        rounds: result.rounds?.length ?? 0,
        synthesis: result.synthesis, // Full synthesis for dashboard visibility
        consensus: result.consensus, // Consensus metadata for dashboard
        responses: providerResponses, // Provider responses by provider ID
        participatingProviders: result.participatingProviders,
        totalDurationMs: Date.now() - startTime,
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ...result, traceId }),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    // Emit run.end trace event with failure (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss',
        success: false,
        pattern,
        providers,
        error: { message },
        totalDurationMs: Date.now() - startTime,
      },
    });

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
        description: 'Optional: specific providers to use (default: claude, grok, gemini)',
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
 *
 * Smart provider selection:
 * - If providers specified: use them
 * - If not specified and ≥3 available: randomly pick 3
 * - If not specified and exactly 2 available: use both
 * - If not specified and exactly 1 available: skip discussion, use single provider
 * - If not specified and 0 available: error
 */
export const handleDiscussQuick: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    providers: specifiedProviders,
    // Trace hierarchy support (optional)
    sessionId,
    parentTraceId,
    rootTraceId: inputRootTraceId,
    parentDepth,
  } = args as {
    topic: string;
    providers?: string[];
    sessionId?: string;
    parentTraceId?: string;
    rootTraceId?: string;
    parentDepth?: number;
  };

  // Initialize tracing (INV-TR-001)
  const traceId = randomUUID();
  const traceStore = getTraceStore();
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();

  // Create trace hierarchy context
  let traceHierarchy: TraceHierarchy;
  if (parentTraceId) {
    traceHierarchy = createChildTraceHierarchy(parentTraceId, {
      parentTraceId: undefined,
      rootTraceId: inputRootTraceId ?? parentTraceId,
      traceDepth: parentDepth ?? 0,
      sessionId,
    });
  } else {
    traceHierarchy = createRootTraceHierarchy(traceId, sessionId);
  }

  // Helper to emit trace events (fire-and-forget with error logging)
  const emitTraceEvent = (event: TraceEvent): void => {
    traceStore.write(event).catch((err) => {
      console.error('[discuss_quick] Failed to write trace event:', err);
    });
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

  // Get provider bridge for selection
  const providerBridge = getProviderBridge();

  // Smart provider selection (before emitting start event)
  const selection = await selectProviders(specifiedProviders, providerBridge);

  // Handle selection errors (before tracing starts)
  if (selection.error) {
    return {
      content: [{ type: 'text', text: `Error: ${selection.error}` }],
      isError: true,
    };
  }

  // If only 1 provider available, skip discussion and call directly (no trace for single provider)
  if (selection.skipDiscussion && selection.singleProvider) {
    return callSingleProvider(topic, selection.singleProvider, providerBridge, DEFAULT_PROVIDER_TIMEOUT);
  }

  const providers = selection.providers;

  // Emit run.start trace event (INV-TR-001)
  emitTraceEvent({
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTimestamp,
    context: {
      ...traceHierarchy,
    },
    payload: {
      command: 'discuss_quick',
      topic: topic.substring(0, 200), // Truncate for payload
      providers,
    },
  });

  // Helper to convert progress events to trace events (Phase 2: Granular Events)
  const onProgressQuick = (event: DiscussionProgressEvent): void => {
    switch (event.type) {
      case 'provider_complete':
        // Emit discussion.provider trace event
        if (event.provider && event.round !== undefined) {
          // Build payload with optional content/prompt fields
          const providerPayload: Record<string, unknown> = {
            providerId: event.provider,
            roundNumber: event.round,
            success: event.success ?? false,
            durationMs: event.durationMs ?? 0,
            tokenCount: event.tokenCount,
            error: event.error,
          };
          // Add conversation content for dashboard visibility
          if (event.prompt !== undefined) {
            providerPayload.prompt = event.prompt;
          }
          if (event.content !== undefined) {
            providerPayload.content = event.content;
          }
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.provider',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            status: event.success ? 'success' : 'failure',
            context: {
              ...traceHierarchy,
              providerId: event.provider,
            },
            payload: providerPayload,
          });
        }
        break;
      case 'round_complete':
        // Emit discussion.round trace event
        if (event.round !== undefined) {
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.round',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            context: {
              ...traceHierarchy,
            },
            payload: {
              roundNumber: event.round,
              participatingProviders: event.participatingProviders ?? [],
              failedProviders: event.failedProviders,
              responseCount: event.responseCount ?? 0,
              durationMs: event.durationMs ?? 0,
            },
          });
        }
        break;
      case 'consensus_complete':
        // Emit discussion.consensus trace event
        emitTraceEvent({
          eventId: randomUUID(),
          traceId,
          type: 'discussion.consensus',
          timestamp: event.timestamp,
          durationMs: event.durationMs,
          status: event.success ? 'success' : 'failure',
          context: {
            ...traceHierarchy,
          },
          payload: {
            method: event.consensusMethod ?? 'synthesis',
            success: event.success ?? false,
            confidence: event.confidence,
            durationMs: event.durationMs ?? 0,
          },
        });
        break;
    }
  };

  try {
    // Create discussion executor
    const executor = new DiscussionExecutor({
      providerExecutor: providerBridge,
      defaultTimeoutMs: DEFAULT_PROVIDER_TIMEOUT,
      checkProviderHealth: true,
      // Enable cascading confidence for early exit with high threshold
      cascadingConfidence: {
        enabled: true,
        threshold: 0.9,
        minProviders: 2,
      },
    });

    // Quick synthesis with 2 rounds (with onProgress for granular tracing)
    const result = await executor.quickSynthesis(topic, { providers, onProgress: onProgressQuick });

    // Extract provider responses from rounds for dashboard (like CLI does)
    const providerResponses: Record<string, string[]> = {};
    if (result.rounds) {
      for (const round of result.rounds) {
        for (const response of round.responses ?? []) {
          const providerId = response.provider ?? 'unknown';
          if (!providerResponses[providerId]) {
            providerResponses[providerId] = [];
          }
          if (response.content) {
            providerResponses[providerId].push(response.content);
          }
        }
      }
    }

    // Emit run.end trace event with success (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: result.success ? 'success' : 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss_quick',
        success: result.success,
        providers,
        synthesis: result.synthesis, // Full synthesis for dashboard visibility
        consensus: result.consensus, // Consensus metadata for dashboard
        responses: providerResponses, // Provider responses by provider ID
        participatingProviders: result.participatingProviders,
        totalDurationMs: result.totalDurationMs,
      },
    });

    // Return simplified result with traceId
    const response = {
      success: result.success,
      synthesis: result.synthesis,
      participatingProviders: result.participatingProviders,
      totalDurationMs: result.totalDurationMs,
      traceId,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    // Emit run.end trace event with failure (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss_quick',
        success: false,
        providers,
        error: { message },
        totalDurationMs: Date.now() - startTime,
      },
    });

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
        description: 'List of providers to use (default: claude, grok, gemini)',
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
        description: 'Per-provider timeout in ms (default: 600000 / 10 min, max: 30 minutes)',
        minimum: 5000,
        maximum: MAX_PROVIDER_TIMEOUT,
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
        maximum: MAX_PROVIDER_TIMEOUT,
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
 *
 * Smart provider selection:
 * - If providers specified: use them
 * - If not specified and ≥3 available: randomly pick 3
 * - If not specified and exactly 2 available: use both
 * - If not specified and exactly 1 available: skip discussion, use single provider
 * - If not specified and 0 available: error
 */
export const handleDiscussRecursive: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    topic,
    pattern = 'synthesis',
    providers: specifiedProviders,
    rounds = DEFAULT_ROUNDS,
    consensus = 'synthesis',
    synthesizer = 'claude',
    context,
    timeout = DEFAULT_PROVIDER_TIMEOUT,
    // Recursive options
    maxDepth = DEFAULT_DISCUSSION_DEPTH,
    timeoutStrategy = 'cascade',
    totalBudget = DEFAULT_TOTAL_BUDGET_MS,
    maxCalls = DEFAULT_MAX_TOTAL_CALLS,
    earlyExit = true,
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    // Participant options
    participants,
    agentWeightMultiplier = DEFAULT_AGENT_WEIGHT_MULTIPLIER,
    // Performance options
    fastMode = false,
    // Trace hierarchy support (optional)
    sessionId,
    parentTraceId,
    rootTraceId: inputRootTraceId,
    parentDepth,
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
    fastMode?: boolean;
    sessionId?: string;
    parentTraceId?: string;
    rootTraceId?: string;
    parentDepth?: number;
  };

  // Initialize tracing (INV-TR-001)
  const traceId = randomUUID();
  const traceStore = getTraceStore();
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();

  // Create trace hierarchy context
  let traceHierarchy: TraceHierarchy;
  if (parentTraceId) {
    traceHierarchy = createChildTraceHierarchy(parentTraceId, {
      parentTraceId: undefined,
      rootTraceId: inputRootTraceId ?? parentTraceId,
      traceDepth: parentDepth ?? 0,
      sessionId,
    });
  } else {
    traceHierarchy = createRootTraceHierarchy(traceId, sessionId);
  }

  // Helper to emit trace events (fire-and-forget with error logging)
  const emitTraceEvent = (event: TraceEvent): void => {
    traceStore.write(event).catch((err) => {
      console.error('[discuss_recursive] Failed to write trace event:', err);
    });
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

  // Validate maxDepth
  if (maxDepth < 1 || maxDepth > 4) {
    return {
      content: [{ type: 'text', text: 'Error: maxDepth must be between 1 and 4' }],
      isError: true,
    };
  }

  // Get provider bridge for selection
  const providerBridge = getProviderBridge();

  // Smart provider selection (before emitting start event)
  const selection = await selectProviders(specifiedProviders, providerBridge);

  // Handle selection errors (before tracing starts)
  if (selection.error) {
    return {
      content: [{ type: 'text', text: `Error: ${selection.error}` }],
      isError: true,
    };
  }

  // If only 1 provider available, skip discussion and call directly (no trace for single provider)
  if (selection.skipDiscussion && selection.singleProvider) {
    return callSingleProvider(topic, selection.singleProvider, providerBridge, timeout);
  }

  const providers = selection.providers;

  // Validate debate pattern has enough providers
  if (pattern === 'debate' && providers.length < 2) {
    return {
      content: [{ type: 'text', text: 'Error: debate pattern requires at least 2 providers (proponent and opponent)' }],
      isError: true,
    };
  }

  // Emit run.start trace event (INV-TR-001)
  emitTraceEvent({
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTimestamp,
    context: {
      ...traceHierarchy,
    },
    payload: {
      command: 'discuss_recursive',
      topic: topic.substring(0, 200), // Truncate for payload
      pattern,
      providers,
      rounds: fastMode ? 1 : rounds,
      consensus,
      maxDepth,
      timeoutStrategy,
      fastMode,
    },
  });

  // Helper to convert progress events to trace events (Phase 2: Granular Events)
  const onProgressRecursive = (event: DiscussionProgressEvent): void => {
    switch (event.type) {
      case 'provider_complete':
        // Emit discussion.provider trace event
        if (event.provider && event.round !== undefined) {
          // Build payload with optional content/prompt fields
          const providerPayload: Record<string, unknown> = {
            providerId: event.provider,
            roundNumber: event.round,
            success: event.success ?? false,
            durationMs: event.durationMs ?? 0,
            tokenCount: event.tokenCount,
            error: event.error,
          };
          // Add conversation content for dashboard visibility
          if (event.prompt !== undefined) {
            providerPayload.prompt = event.prompt;
          }
          if (event.content !== undefined) {
            providerPayload.content = event.content;
          }
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.provider',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            status: event.success ? 'success' : 'failure',
            context: {
              ...traceHierarchy,
              providerId: event.provider,
            },
            payload: providerPayload,
          });
        }
        break;
      case 'round_complete':
        // Emit discussion.round trace event
        if (event.round !== undefined) {
          emitTraceEvent({
            eventId: randomUUID(),
            traceId,
            type: 'discussion.round',
            timestamp: event.timestamp,
            durationMs: event.durationMs,
            context: {
              ...traceHierarchy,
            },
            payload: {
              roundNumber: event.round,
              participatingProviders: event.participatingProviders ?? [],
              failedProviders: event.failedProviders,
              responseCount: event.responseCount ?? 0,
              durationMs: event.durationMs ?? 0,
            },
          });
        }
        break;
      case 'consensus_complete':
        // Emit discussion.consensus trace event
        emitTraceEvent({
          eventId: randomUUID(),
          traceId,
          type: 'discussion.consensus',
          timestamp: event.timestamp,
          durationMs: event.durationMs,
          status: event.success ? 'success' : 'failure',
          context: {
            ...traceHierarchy,
          },
          payload: {
            method: event.consensusMethod ?? 'synthesis',
            success: event.success ?? false,
            confidence: event.confidence,
            durationMs: event.durationMs ?? 0,
          },
        });
        break;
    }
  };

  try {
    // Create recursive discussion executor
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

    // Auto-assign roles for debate pattern (INV-DISC-008)
    // First provider = proponent, second = opponent, third = judge (if available)
    let roles: Record<string, 'proponent' | 'opponent' | 'judge'> | undefined;
    if (pattern === 'debate') {
      roles = {};
      if (providers[0]) roles[providers[0]] = 'proponent';
      if (providers[1]) roles[providers[1]] = 'opponent';
      if (providers[2]) roles[providers[2]] = 'judge';
    }

    // Build config
    const config: DiscussStepConfig = {
      pattern,
      rounds: fastMode ? 1 : rounds, // Fast mode uses single round
      providers,
      prompt: topic,
      context,
      verbose: false,
      consensus: {
        method: pattern === 'debate' && providers[2] ? 'moderator' : consensus,
        synthesizer: pattern === 'debate' && providers[2] ? providers[2] : synthesizer,
        threshold: 0.5,
        includeDissent: true,
      },
      providerTimeout: timeout,
      continueOnProviderFailure: true,
      minProviders: 2,
      temperature: 0.7,
      agentWeightMultiplier,
      // Performance optimization
      fastMode,
      // Include participants if specified
      ...(participants !== undefined && { participants }),
      // Include roles for debate pattern (INV-DISC-008)
      ...(roles !== undefined && { roles }),
    };

    // Execute recursive discussion with onProgress for granular tracing
    const result = await executor.execute(config, { onProgress: onProgressRecursive });

    // Extract provider responses from rounds for dashboard (like CLI does)
    const providerResponses: Record<string, string[]> = {};
    if (result.rounds) {
      for (const round of result.rounds) {
        for (const response of round.responses ?? []) {
          const providerId = response.provider ?? 'unknown';
          if (!providerResponses[providerId]) {
            providerResponses[providerId] = [];
          }
          if (response.content) {
            providerResponses[providerId].push(response.content);
          }
        }
      }
    }

    // Emit run.end trace event with success (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: result.success ? 'success' : 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss_recursive',
        success: result.success,
        pattern,
        providers,
        rounds: result.rounds?.length ?? 0,
        maxDepth,
        synthesis: result.synthesis, // Full synthesis for dashboard visibility
        consensus: result.consensus, // Consensus metadata for dashboard
        responses: providerResponses, // Provider responses by provider ID
        participatingProviders: result.participatingProviders,
        totalDurationMs: Date.now() - startTime,
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ...result, traceId }),
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    // Emit run.end trace event with failure (INV-TR-001)
    emitTraceEvent({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      status: 'failure',
      context: {
        ...traceHierarchy,
      },
      payload: {
        command: 'discuss_recursive',
        success: false,
        pattern,
        providers,
        error: { message },
        totalDurationMs: Date.now() - startTime,
      },
    });

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
