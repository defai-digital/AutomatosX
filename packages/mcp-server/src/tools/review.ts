/**
 * Review MCP Tools
 *
 * AI-powered code review tools for the MCP server.
 * Provides focused analysis modes: security, architecture, performance,
 * maintainability, correctness, and comprehensive reviews.
 * Integrates with trace store for dashboard visibility.
 */

import type { MCPTool, ToolHandler } from '../types.js';
import { randomUUID } from 'crypto';
import {
  successResponse,
  errorResponse,
  createListResponse,
} from '../utils/response.js';
import { storeArtifact } from '../utils/artifact-store.js';
import {
  type TraceEvent,
  type TraceHierarchy,
  ReviewFocusSchema,
  TIMEOUT_PROVIDER_DEFAULT,
  PROVIDER_DEFAULT,
  getErrorMessage,
  createRootTraceHierarchy,
} from '@defai.digital/contracts';
import {
  createReviewService,
  type ReviewPromptExecutor,
  type ReviewFocus,
} from '@defai.digital/review-domain';
import { getProviderRegistry, getTraceStore } from '../bootstrap.js';

// Check if we're in test environment
const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

// ============================================================================
// Prompt Executor for Review Service
// ============================================================================

/**
 * Creates a prompt executor that uses the provider registry for real LLM calls
 */
function createReviewPromptExecutor(): ReviewPromptExecutor {
  const registry = getProviderRegistry();

  return {
    async execute(
      prompt: string,
      options: { providerId?: string; timeoutMs?: number }
    ): Promise<{ content: string; providerId: string; modelId: string }> {
      const providerId = options.providerId ?? PROVIDER_DEFAULT;
      const timeoutMs = options.timeoutMs ?? TIMEOUT_PROVIDER_DEFAULT;

      const provider = registry.get(providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      // Execute the prompt using the provider
      // Convert prompt to messages format expected by the provider
      const response = await provider.complete({
        requestId: randomUUID(),
        model: `${providerId}-default`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 4096,
        temperature: 0.3, // Lower temperature for more focused analysis
        timeout: timeoutMs,
      });

      // Handle the discriminated union response
      if (!response.success) {
        throw new Error(`Provider error: ${response.error.message}`);
      }

      return {
        content: response.content,
        providerId,
        modelId: response.model,
      };
    },
  };
}

// Cached review service instance
let _reviewService: ReturnType<typeof createReviewService> | null = null;

/**
 * Get the review service (creates with real executor in production)
 */
function getReviewService(): ReturnType<typeof createReviewService> {
  if (_reviewService === null) {
    if (isTestEnv) {
      // In tests, create without executor (returns placeholder results)
      _reviewService = createReviewService();
    } else {
      // In production, create with real prompt executor
      _reviewService = createReviewService(
        {
          defaultProvider: PROVIDER_DEFAULT,
          defaultTimeoutMs: TIMEOUT_PROVIDER_DEFAULT,
        },
        createReviewPromptExecutor()
      );
    }
  }
  return _reviewService;
}

/**
 * Reset review service (for testing)
 */
export function resetReviewService(): void {
  _reviewService = null;
}

/**
 * Review analyze tool definition
 */
export const reviewAnalyzeTool: MCPTool = {
  name: 'review_analyze',
  description:
    'AI-powered code review with focused analysis modes. Use --focus to specify: security (OWASP/vulnerabilities), architecture (SRP/coupling), performance (N+1/memory), maintainability (smells/duplication), correctness (bugs/edge cases), or all (comprehensive).',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        description: 'List of file or directory paths to review',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 50,
      },
      focus: {
        type: 'string',
        description:
          'Focus mode: security, architecture, performance, maintainability, correctness, all (default: all)',
        enum: ['security', 'architecture', 'performance', 'maintainability', 'correctness', 'all'],
        default: 'all',
      },
      context: {
        type: 'string',
        description: 'Additional context for the review (e.g., "This is a payment service", max 2000 chars)',
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold 0-1 (default: 0.7)',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
      maxFiles: {
        type: 'number',
        description: 'Maximum files to analyze (default: 20)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      maxLinesPerFile: {
        type: 'number',
        description: 'Maximum lines per file (default: 500)',
        minimum: 1,
        maximum: 1000,
        default: 500,
      },
      providerId: {
        type: 'string',
        description: 'Specific provider to use (optional, uses default routing)',
      },
      outputFormat: {
        type: 'string',
        description: 'Output format: markdown, json, sarif (default: markdown)',
        enum: ['markdown', 'json', 'sarif'],
        default: 'markdown',
      },
      dryRun: {
        type: 'boolean',
        description: 'Only show what would be analyzed without running the review',
        default: false,
      },
      since: {
        type: 'string',
        description: 'Git commit SHA or reference to compare against for incremental reviews (Tier 2). Only review files changed since this commit.',
      },
      smartBatching: {
        type: 'boolean',
        description: 'Enable smart batching by focus mode (Tier 2). Groups files by relevance to focus mode for better analysis. Default: true',
        default: true,
      },
      dependencyOrdering: {
        type: 'boolean',
        description: 'Enable dependency-aware file ordering (Tier 3). Reviews files with more dependents first for better context. Default: false',
        default: false,
      },
      enableRecovery: {
        type: 'boolean',
        description: 'Enable partial result recovery on failure (Tier 3). Allows resuming failed reviews. Default: true',
        default: true,
      },
    },
    required: ['paths'],
  },
};

/**
 * Review list tool definition
 */
export const reviewListTool: MCPTool = {
  name: 'review_list',
  description: 'List recent code review results',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        description: 'Filter by focus mode',
        enum: ['security', 'architecture', 'performance', 'maintainability', 'correctness', 'all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
    },
  },
};

// In-memory storage for review results
const reviewStore = new Map<string, StoredReviewResult>();

interface StoredReviewResult {
  resultId: string;
  requestId: string;
  focus: string;
  filesReviewed: string[];
  summary: {
    bySeverity: {
      critical: number;
      warning: number;
      suggestion: number;
      note: number;
    };
    healthScore: number;
    verdict: string;
  };
  commentCount: number;
  completedAt: string;
}

/**
 * Handler for review_analyze tool
 *
 * Uses the ReviewService with real LLM providers for AI-powered code review.
 * In test environments, falls back to placeholder results.
 * Records traces for dashboard visibility.
 */
export const handleReviewAnalyze: ToolHandler = async (args) => {
  const paths = args.paths as string[];
  const focus = (args.focus as string) ?? 'all';
  const context = args.context as string | undefined;
  const minConfidence = (args.minConfidence as number) ?? 0.7;
  const maxFiles = (args.maxFiles as number) ?? 20;
  const maxLinesPerFile = (args.maxLinesPerFile as number) ?? 500;
  const dryRun = (args.dryRun as boolean) ?? false;
  const outputFormat = (args.outputFormat as 'markdown' | 'json' | 'sarif') ?? 'markdown';
  const providerId = args.providerId as string | undefined;
  // Tier 2 & 3 parameters
  const since = args.since as string | undefined;
  const smartBatching = (args.smartBatching as boolean) ?? true;
  const dependencyOrdering = (args.dependencyOrdering as boolean) ?? false;
  const enableRecovery = (args.enableRecovery as boolean) ?? true;

  // Get trace store and create trace context
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, undefined);

  // Emit run.start trace event
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: 'review-analyze',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'review_analyze',
      paths,
      focus,
      dryRun,
      providerId,
      // Tier 2 & 3 parameters
      since,
      smartBatching,
      dependencyOrdering,
      enableRecovery,
    },
  };
  await traceStore.write(startEvent);

  try {
    // Validate focus mode
    const focusValidation = ReviewFocusSchema.safeParse(focus);
    if (!focusValidation.success) {
      // Emit run.end trace event for validation failure
      await traceStore.write({
        eventId: randomUUID(),
        traceId,
        type: 'run.end',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - new Date(startTime).getTime(),
        status: 'failure',
        context: {
          workflowId: 'review-analyze',
          parentTraceId: traceHierarchy.parentTraceId,
          rootTraceId: traceHierarchy.rootTraceId,
          traceDepth: traceHierarchy.traceDepth,
          sessionId: traceHierarchy.sessionId,
        },
        payload: {
          success: false,
          error: `Invalid focus mode: ${focus}`,
          tool: 'review_analyze',
        },
      });

      return errorResponse(
        'INVALID_FOCUS',
        `Invalid focus mode: ${focus}. Use: security, architecture, performance, maintainability, correctness, or all`,
        { focus }
      );
    }

    const requestId = randomUUID();

    // Get the review service (wired with real providers in production)
    const reviewService = getReviewService();

    // Execute the review
    // Build execution options, only including providerId if defined
    const executionOptions = dryRun
      ? { dryRun }
      : providerId !== undefined
        ? { providerId }
        : undefined;

    const result = await reviewService.review(
      {
        requestId,
        paths,
        focus: focus as ReviewFocus,
        context,
        minConfidence,
        maxFiles,
        maxLinesPerFile,
        dryRun,
        providerId,
        timeoutMs: TIMEOUT_PROVIDER_DEFAULT,
        outputFormat,
        // Tier 2 & 3 parameters
        since,
        smartBatching,
        dependencyOrdering,
        enableRecovery,
      },
      executionOptions
    );

    // Store result for listing
    const storedResult: StoredReviewResult = {
      resultId: result.resultId,
      requestId: result.requestId,
      focus,
      filesReviewed: result.filesReviewed,
      summary: {
        bySeverity: result.summary.bySeverity,
        healthScore: result.summary.healthScore,
        verdict: result.summary.verdict,
      },
      commentCount: result.comments.length,
      completedAt: result.completedAt,
    };
    reviewStore.set(result.resultId, storedResult);

    // Emit run.end trace event on success with full results for dashboard visibility
    // Limit comments to avoid bloating trace storage (show top issues by severity)
    const topComments = result.comments
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, suggestion: 2, note: 3 };
        return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      })
      .slice(0, 20) // Top 20 most severe issues
      .map(c => ({
        severity: c.severity,
        title: c.title,
        file: c.file,
        line: c.line,
        category: c.category,
        body: c.body?.slice(0, 500), // Truncate long explanations
        suggestion: c.suggestion?.slice(0, 300),
        confidence: c.confidence,
      }));

    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: result.durationMs,
      status: 'success',
      context: {
        workflowId: 'review-analyze',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: true,
        tool: 'review_analyze',
        resultId: result.resultId,
        // Review parameters
        focus,
        paths,
        context,
        providerId: result.providerId,
        // Full summary for dashboard display
        summary: {
          verdict: result.summary.verdict,
          healthScore: result.summary.healthScore,
          bySeverity: result.summary.bySeverity,
        },
        // Files reviewed (full list for small sets, truncated for large)
        filesReviewed: result.filesReviewed.length <= 20
          ? result.filesReviewed
          : [...result.filesReviewed.slice(0, 20), `... and ${result.filesReviewed.length - 20} more`],
        filesReviewedCount: result.filesReviewed.length,
        linesAnalyzed: result.linesAnalyzed,
        // Issues found (top 20 by severity for dashboard)
        comments: topComments,
        commentCount: result.comments.length,
        // Timing
        totalDurationMs: result.durationMs,
      },
    });

    // Format response based on output format
    const formattedOutput = reviewService.formatResult(result, outputFormat);

    if (outputFormat === 'json') {
      return successResponse('Review complete', JSON.parse(formattedOutput) as Record<string, unknown>);
    }

    // For markdown/sarif, return as text
    // Store full output as artifact if large
    if (formattedOutput.length > 8000) {
      const artifactKey = `review-${result.resultId}`;
      const artifactId = await storeArtifact(artifactKey, {
        type: 'review-result',
        resultId: result.resultId,
        format: outputFormat,
        content: formattedOutput,
      });
      return successResponse(
        `Review complete. Found ${result.comments.length} issues. Full result stored in artifact: ${artifactId}`,
        {
          resultId: result.resultId,
          artifactId,
          summary: result.summary,
          commentCount: result.comments.length,
        }
      );
    }

    return successResponse(formattedOutput, {
      resultId: result.resultId,
      summary: result.summary,
      commentCount: result.comments.length,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    // Emit run.end trace event on failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'review-analyze',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        focus,
        tool: 'review_analyze',
      },
    });

    return errorResponse('REVIEW_FAILED', message, { paths, focus });
  }
};

/**
 * Handler for review_list tool
 */
export const handleReviewList: ToolHandler = async (args) => {
  const focus = args.focus as string | undefined;
  const limit = (args.limit as number) ?? 10;

  try {
    let results = Array.from(reviewStore.values());

    // Filter by focus if specified
    if (focus !== undefined) {
      results = results.filter((r) => r.focus === focus);
    }

    // Sort by completion time (newest first)
    results.sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    // Limit results
    results = results.slice(0, limit);

    // Format for list response
    const listItems = results.map((r) => ({
      id: r.resultId,
      label: `${r.focus} review (${r.filesReviewed.length} files)`,
      focus: r.focus,
      healthScore: r.summary.healthScore,
      commentCount: r.commentCount,
      completedAt: r.completedAt,
    }));

    return createListResponse(listItems, {
      domain: 'reviews',
      idField: 'id',
      labelField: 'label',
      limit: 10,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return errorResponse('LIST_FAILED', message);
  }
};

/**
 * Export all review tools
 */
export const reviewTools: MCPTool[] = [
  reviewAnalyzeTool,
  reviewListTool,
];

/**
 * Export all review handlers
 */
export const reviewHandlers: Record<string, ToolHandler> = {
  review_analyze: handleReviewAnalyze,
  review_list: handleReviewList,
};
