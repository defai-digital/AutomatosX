/**
 * Feedback MCP Tools
 *
 * Tools for agent feedback collection and learning.
 *
 * Invariants:
 * - INV-FBK-001: Feedback records immutable
 * - INV-FBK-002: Score adjustments bounded (-0.5 to +0.5)
 * - INV-FBK-003: Minimum sample count before adjustment applied
 * - INV-FBK-004: Adjustments decay over time
 */

import type { MCPTool, ToolHandler } from '../types.js';
import type {
  SubmitFeedbackInput,
  FeedbackRecord,
  AgentFeedbackStats,
  FeedbackOverview,
  AgentScoreAdjustment,
} from '@defai.digital/contracts';
import { SubmitFeedbackInputSchema, LIMIT_DEFAULT } from '@defai.digital/contracts';
import {
  createFeedbackCollector,
  createInMemoryFeedbackStorage,
  createScoreAdjuster,
  createInMemoryAdjustmentStorage,
  createSimplePatternMatcher,
  type FeedbackCollector,
  type ScoreAdjuster,
} from '@defai.digital/feedback-domain';

// ============================================================================
// Lazy-loaded Feedback Singletons
// ============================================================================

let _feedbackCollector: FeedbackCollector | null = null;
let _scoreAdjuster: ScoreAdjuster | null = null;
let _feedbackStorage: ReturnType<typeof createInMemoryFeedbackStorage> | null = null;

/**
 * Get or create the shared feedback storage singleton
 */
function getFeedbackStorage(): ReturnType<typeof createInMemoryFeedbackStorage> {
  if (!_feedbackStorage) {
    _feedbackStorage = createInMemoryFeedbackStorage();
  }
  return _feedbackStorage;
}

/**
 * Get or create the feedback collector singleton
 */
function getFeedbackCollector(): FeedbackCollector {
  if (!_feedbackCollector) {
    _feedbackCollector = createFeedbackCollector({
      storage: getFeedbackStorage(),
    });
  }
  return _feedbackCollector;
}

/**
 * Get or create the score adjuster singleton
 */
function getScoreAdjuster(): ScoreAdjuster {
  if (!_scoreAdjuster) {
    _scoreAdjuster = createScoreAdjuster({
      feedbackStorage: getFeedbackStorage(),
      adjustmentStorage: createInMemoryAdjustmentStorage(),
      patternMatcher: createSimplePatternMatcher(),
    });
  }
  return _scoreAdjuster;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Feedback submit tool
 * INV-FBK-001: Creates immutable feedback record
 * INV-FBK-100: No duplicate feedback (within 1 minute window)
 */
export const feedbackSubmitTool: MCPTool = {
  name: 'feedback_submit',
  description: 'Submit feedback for an agent task. SIDE EFFECTS: Creates feedback record and may update score adjustments. INV-FBK-001: Records are immutable after creation.',
  inputSchema: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'Description of the task performed (max 5000 chars)',
      },
      selectedAgent: {
        type: 'string',
        description: 'The agent that was used',
      },
      recommendedAgent: {
        type: 'string',
        description: 'The agent that was recommended (if different)',
      },
      feedbackType: {
        type: 'string',
        enum: ['explicit', 'implicit', 'outcome'],
        description: 'How feedback was collected (default: explicit)',
        default: 'explicit',
      },
      rating: {
        type: 'number',
        description: 'Rating 1-5 (optional)',
        minimum: 1,
        maximum: 5,
      },
      outcome: {
        type: 'string',
        enum: ['success', 'failure', 'partial', 'cancelled'],
        description: 'Task outcome (optional)',
      },
      durationMs: {
        type: 'number',
        description: 'Task duration in milliseconds (optional)',
        minimum: 0,
      },
      userComment: {
        type: 'string',
        description: 'User comment (max 1000 chars)',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID for grouping feedback (UUID format)',
      },
    },
    required: ['taskDescription', 'selectedAgent'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      feedbackId: { type: 'string' },
      taskHash: { type: 'string' },
      timestamp: { type: 'string' },
      recorded: { type: 'boolean' },
    },
    required: ['feedbackId', 'recorded'],
  },
  idempotent: false,
};

/**
 * Feedback history tool
 * INV-MCP-004: Idempotent - read-only operation
 */
export const feedbackHistoryTool: MCPTool = {
  name: 'feedback_history',
  description: 'Get feedback history with optional filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'Filter by agent ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum records to return (default: 20)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      since: {
        type: 'string',
        description: 'Filter records after this ISO date (ISO 8601 format)',
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      records: { type: 'array' },
      total: { type: 'number' },
    },
    required: ['records', 'total'],
  },
  idempotent: true,
};

/**
 * Feedback stats tool - get agent-specific stats
 */
export const feedbackStatsTool: MCPTool = {
  name: 'feedback_stats',
  description: 'Get feedback statistics for a specific agent. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The agent ID to get stats for',
      },
    },
    required: ['agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      totalFeedback: { type: 'number' },
      avgRating: { type: 'number' },
      successRate: { type: 'number' },
      recommendationAcceptRate: { type: 'number' },
      avgDurationMs: { type: 'number' },
      topPatterns: { type: 'array' },
      lastFeedback: { type: 'string' },
    },
    required: ['agentId', 'totalFeedback', 'successRate'],
  },
  idempotent: true,
};

/**
 * Feedback overview tool - get overall system stats
 */
export const feedbackOverviewTool: MCPTool = {
  name: 'feedback_overview',
  description: 'Get overall feedback system statistics. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  outputSchema: {
    type: 'object',
    properties: {
      totalFeedback: { type: 'number' },
      feedbackByType: { type: 'object' },
      avgRating: { type: 'number' },
      overallSuccessRate: { type: 'number' },
      topAgents: { type: 'array' },
      recentTrend: { type: 'string' },
      lastUpdated: { type: 'string' },
    },
    required: ['totalFeedback', 'overallSuccessRate', 'lastUpdated'],
  },
  idempotent: true,
};

/**
 * Feedback adjustments tool - view score adjustments
 * INV-FBK-002, INV-FBK-003, INV-FBK-004
 */
export const feedbackAdjustmentsTool: MCPTool = {
  name: 'feedback_adjustments',
  description: 'View score adjustments for an agent based on feedback. INV-FBK-002: Bounded -0.5 to +0.5. INV-FBK-003: Minimum samples required. INV-FBK-004: Values decay over time.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The agent ID to get adjustments for',
      },
    },
    required: ['agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
      adjustments: { type: 'array' },
      totalAdjustments: { type: 'number' },
    },
    required: ['agentId', 'adjustments', 'totalAdjustments'],
  },
  idempotent: true,
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handler for feedback_submit tool
 */
export const handleFeedbackSubmit: ToolHandler = async (args) => {
  try {
    // Validate and parse input
    const input: SubmitFeedbackInput = SubmitFeedbackInputSchema.parse({
      taskDescription: args.taskDescription,
      selectedAgent: args.selectedAgent,
      recommendedAgent: args.recommendedAgent,
      feedbackType: args.feedbackType ?? 'explicit',
      rating: args.rating,
      outcome: args.outcome,
      durationMs: args.durationMs,
      userComment: args.userComment,
      sessionId: args.sessionId,
    });

    const collector = getFeedbackCollector();
    const record: FeedbackRecord = await collector.submit(input);

    // Also process for score adjustments
    const adjuster = getScoreAdjuster();
    await adjuster.processNewFeedback(record);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              feedbackId: record.feedbackId,
              taskHash: record.taskHash,
              timestamp: record.timestamp,
              recorded: true,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'FEEDBACK_SUBMIT_FAILED',
            message,
            recorded: false,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for feedback_history tool
 */
export const handleFeedbackHistory: ToolHandler = async (args) => {
  try {
    const collector = getFeedbackCollector();

    // Build filter object conditionally (exactOptionalPropertyTypes)
    const filter: { agentId?: string; limit?: number; since?: string } = {
      limit: (args.limit as number | undefined) ?? LIMIT_DEFAULT,
    };
    if (args.agentId !== undefined) filter.agentId = args.agentId as string;
    if (args.since !== undefined) filter.since = args.since as string;

    const records = await collector.getHistory(filter);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              records: records.map((r: FeedbackRecord) => ({
                feedbackId: r.feedbackId,
                taskDescription: r.taskDescription.slice(0, 100) + (r.taskDescription.length > 100 ? '...' : ''),
                selectedAgent: r.selectedAgent,
                recommendedAgent: r.recommendedAgent,
                feedbackType: r.feedbackType,
                rating: r.rating,
                outcome: r.outcome,
                timestamp: r.timestamp,
              })),
              total: records.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'FEEDBACK_HISTORY_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for feedback_stats tool
 */
export const handleFeedbackStats: ToolHandler = async (args) => {
  try {
    const agentId = args.agentId as string;

    const collector = getFeedbackCollector();
    const stats: AgentFeedbackStats = await collector.getAgentStats(agentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agentId: stats.agentId,
              totalFeedback: stats.totalFeedback,
              avgRating: stats.avgRating,
              successRate: stats.successRate,
              recommendationAcceptRate: stats.recommendationAcceptRate,
              avgDurationMs: stats.avgDurationMs,
              topPatterns: stats.topPatterns,
              lastFeedback: stats.lastFeedback,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'FEEDBACK_STATS_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for feedback_overview tool
 */
export const handleFeedbackOverview: ToolHandler = async () => {
  try {
    const collector = getFeedbackCollector();
    const overview: FeedbackOverview = await collector.getOverview();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              totalFeedback: overview.totalFeedback,
              feedbackByType: overview.feedbackByType,
              avgRating: overview.avgRating,
              overallSuccessRate: overview.overallSuccessRate,
              topAgents: overview.topAgents,
              recentTrend: overview.recentTrend,
              lastUpdated: overview.lastUpdated,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'FEEDBACK_OVERVIEW_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for feedback_adjustments tool
 */
export const handleFeedbackAdjustments: ToolHandler = async (args) => {
  try {
    const agentId = args.agentId as string;

    const adjuster = getScoreAdjuster();
    const adjustments: AgentScoreAdjustment[] = await adjuster.getAgentAdjustments(agentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              agentId,
              adjustments: adjustments.map((a) => ({
                taskPattern: a.taskPattern,
                scoreAdjustment: a.scoreAdjustment,
                sampleCount: a.sampleCount,
                confidence: a.confidence,
                lastUpdated: a.lastUpdated,
                expiresAt: a.expiresAt,
              })),
              totalAdjustments: adjustments.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'FEEDBACK_ADJUSTMENTS_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// Exports
// ============================================================================

export const FEEDBACK_TOOLS: MCPTool[] = [
  feedbackSubmitTool,
  feedbackHistoryTool,
  feedbackStatsTool,
  feedbackOverviewTool,
  feedbackAdjustmentsTool,
];

export const FEEDBACK_HANDLERS: Record<string, ToolHandler> = {
  feedback_submit: handleFeedbackSubmit,
  feedback_history: handleFeedbackHistory,
  feedback_stats: handleFeedbackStats,
  feedback_overview: handleFeedbackOverview,
  feedback_adjustments: handleFeedbackAdjustments,
};
