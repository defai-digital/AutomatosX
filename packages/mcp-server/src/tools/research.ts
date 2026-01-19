/**
 * Research MCP Tools
 *
 * Tools for deep research with live documentation fetching and knowledge synthesis.
 * Integrates with trace store for dashboard visibility.
 *
 * Invariants:
 * - INV-RSH-001: All sources cited in synthesis
 * - INV-RSH-002: Confidence reflects source reliability
 * - INV-RSH-003: Stale data (>24h) flagged with warning
 */

import { randomUUID } from 'node:crypto';
import type { MCPTool, ToolHandler } from '../types.js';
import type {
  ResearchRequest,
  FetchRequest,
  SynthesisRequest,
  ResearchSource,
  TraceEvent,
  TraceHierarchy,
} from '@defai.digital/contracts';
import {
  ResearchRequestSchema,
  FetchRequestSchema,
  SynthesisRequestSchema,
  ResearchSourceSchema,
  getErrorMessage,
  createRootTraceHierarchy,
} from '@defai.digital/contracts';
import {
  createResearchAgent,
  createStubWebFetcher,
  createStubSynthesizer,
  type ResearchAgent,
} from '@defai.digital/research-domain';
import { getTraceStore } from '../bootstrap.js';

// ============================================================================
// Lazy-loaded Research Agent Singleton
// ============================================================================

let _researchAgent: ResearchAgent | null = null;

/**
 * Get or create the research agent singleton
 */
function getResearchAgent(): ResearchAgent {
  if (!_researchAgent) {
    // Create with stub implementations - production should inject real ones
    _researchAgent = createResearchAgent({
      webFetcher: createStubWebFetcher(),
      synthesizer: createStubSynthesizer(),
    });
  }
  return _researchAgent;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Research query tool
 * INV-RSH-001, INV-RSH-002, INV-RSH-003
 */
export const researchQueryTool: MCPTool = {
  name: 'research_query',
  description: 'Execute a research query with web search and knowledge synthesis. Returns sources and synthesized answer with confidence scores.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The research query (max 5000 chars)',
      },
      sources: {
        type: 'array',
        items: { type: 'string', enum: ['web', 'docs', 'github', 'stackoverflow', 'arxiv'] },
        description: 'Source types to search (default: ["web"])',
        default: ['web'],
      },
      maxSources: {
        type: 'number',
        description: 'Maximum sources to return (1-20, default: 5)',
        minimum: 1,
        maximum: 20,
        default: 5,
      },
      synthesize: {
        type: 'boolean',
        description: 'Whether to synthesize results (default: true)',
        default: true,
      },
      includeCode: {
        type: 'boolean',
        description: 'Include code examples (default: true)',
        default: true,
      },
      language: {
        type: 'string',
        description: 'Programming language filter (e.g., "python", "typescript")',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in ms (1000-300000, default: 60000)',
        minimum: 1000,
        maximum: 300000,
        default: 60000,
      },
    },
    required: ['query'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      resultId: { type: 'string' },
      query: { type: 'string' },
      sources: { type: 'array' },
      synthesis: { type: 'string' },
      codeExamples: { type: 'array' },
      confidence: { type: 'number' },
      warnings: { type: 'array' },
      durationMs: { type: 'number' },
    },
    required: ['resultId', 'query', 'sources', 'synthesis', 'confidence'],
  },
  idempotent: true,
};

/**
 * Research fetch tool - fetch a single URL
 */
export const researchFetchTool: MCPTool = {
  name: 'research_fetch',
  description: 'Fetch content from a specific URL with code extraction.',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must be a valid URL)',
      },
      extractCode: {
        type: 'boolean',
        description: 'Extract code blocks (default: true)',
        default: true,
      },
      maxLength: {
        type: 'number',
        description: 'Maximum content length (100-100000, default: 10000)',
        minimum: 100,
        maximum: 100000,
        default: 10000,
      },
      timeout: {
        type: 'number',
        description: 'Timeout in ms (1000-60000, default: 10000)',
        minimum: 1000,
        maximum: 60000,
        default: 10000,
      },
    },
    required: ['url'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      title: { type: 'string' },
      content: { type: 'string' },
      codeBlocks: { type: 'array' },
      reliability: { type: 'string' },
      fetchedAt: { type: 'string' },
      success: { type: 'boolean' },
      error: { type: 'string' },
    },
    required: ['url', 'success'],
  },
  idempotent: true,
};

/**
 * Research synthesize tool - synthesize provided sources
 */
export const researchSynthesizeTool: MCPTool = {
  name: 'research_synthesize',
  description: 'Synthesize multiple sources into a coherent answer. INV-RSH-001: All sources will be cited.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The original query for context (max 5000 chars)',
      },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            type: { type: 'string' },
            url: { type: 'string' },
            title: { type: 'string' },
            snippet: { type: 'string' },
            content: { type: 'string' },
            reliability: { type: 'string' },
            fetchedAt: { type: 'string' },
            relevanceScore: { type: 'number' },
          },
          required: ['sourceId', 'type', 'url', 'title', 'snippet', 'reliability', 'fetchedAt', 'relevanceScore'],
        },
        description: 'Sources to synthesize',
        minItems: 1,
      },
      style: {
        type: 'string',
        enum: ['concise', 'detailed', 'tutorial'],
        description: 'Synthesis style (default: detailed)',
        default: 'detailed',
      },
      includeCode: {
        type: 'boolean',
        description: 'Include code examples (default: true)',
        default: true,
      },
      maxLength: {
        type: 'number',
        description: 'Maximum synthesis length (100-50000, default: 5000)',
        minimum: 100,
        maximum: 50000,
        default: 5000,
      },
    },
    required: ['query', 'sources'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      synthesis: { type: 'string' },
      sourcesUsed: { type: 'number' },
    },
    required: ['synthesis', 'sourcesUsed'],
  },
  idempotent: true,
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handler for research_query tool
 * Records traces for dashboard visibility - this is a high-value LLM operation
 */
export const handleResearchQuery: ToolHandler = async (args) => {
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
      workflowId: 'research-query',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'research_query',
      query: (args.query as string).slice(0, 200),
      sources: args.sources ?? ['web'],
      maxSources: args.maxSources ?? 5,
      synthesize: args.synthesize ?? true,
    },
  };
  await traceStore.write(startEvent);

  try {
    // Validate and parse input
    const request: ResearchRequest = ResearchRequestSchema.parse({
      query: args.query,
      sources: args.sources ?? ['web'],
      maxSources: args.maxSources ?? 5,
      synthesize: args.synthesize ?? true,
      includeCode: args.includeCode ?? true,
      language: args.language,
      timeout: args.timeout ?? 60000,
      freshness: 'any',
    });

    const agent = getResearchAgent();
    const result = await agent.research(request);

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: result.durationMs,
      status: 'success',
      context: {
        workflowId: 'research-query',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: true,
        resultId: result.resultId,
        sourceCount: result.sources.length,
        synthesisLength: result.synthesis.length,
        codeExampleCount: result.codeExamples.length,
        confidence: result.confidence,
        warningCount: result.warnings.length,
        tool: 'research_query',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              resultId: result.resultId,
              query: result.query,
              sources: result.sources.map((s: ResearchSource) => ({
                sourceId: s.sourceId,
                type: s.type,
                url: s.url,
                title: s.title,
                snippet: s.snippet,
                reliability: s.reliability,
                relevanceScore: s.relevanceScore,
              })),
              synthesis: result.synthesis,
              codeExamples: result.codeExamples,
              confidence: result.confidence,
              warnings: result.warnings,
              durationMs: result.durationMs,
            },
            null,
            2
          ),
        },
      ],
    };
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
        workflowId: 'research-query',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        tool: 'research_query',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'RESEARCH_QUERY_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for research_fetch tool
 * Records traces for dashboard visibility - URL fetching with code extraction
 */
export const handleResearchFetch: ToolHandler = async (args) => {
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
      workflowId: 'research-fetch',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'research_fetch',
      url: args.url,
      extractCode: args.extractCode ?? true,
    },
  };
  await traceStore.write(startEvent);

  try {
    // Validate and parse input
    const request: FetchRequest = FetchRequestSchema.parse({
      url: args.url,
      extractCode: args.extractCode ?? true,
      maxLength: args.maxLength ?? 10000,
      timeout: args.timeout ?? 10000,
    });

    const agent = getResearchAgent();
    const result = await agent.fetch(request);

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: result.success ? 'success' : 'failure',
      context: {
        workflowId: 'research-fetch',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: result.success,
        url: result.url,
        title: result.title,
        contentLength: result.content?.length ?? 0,
        codeBlockCount: result.codeBlocks?.length ?? 0,
        reliability: result.reliability,
        tool: 'research_fetch',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              url: result.url,
              title: result.title,
              content: result.content,
              codeBlocks: result.codeBlocks,
              reliability: result.reliability,
              fetchedAt: result.fetchedAt,
              success: result.success,
              error: result.error,
            },
            null,
            2
          ),
        },
      ],
    };
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
        workflowId: 'research-fetch',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        url: args.url,
        tool: 'research_fetch',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'RESEARCH_FETCH_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for research_synthesize tool
 * Records traces for dashboard visibility - LLM synthesis of multiple sources
 */
export const handleResearchSynthesize: ToolHandler = async (args) => {
  // Get trace store and create trace context
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, undefined);

  const sourceCount = (args.sources as unknown[])?.length ?? 0;

  // Emit run.start trace event
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: 'research-synthesize',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'research_synthesize',
      query: (args.query as string).slice(0, 200),
      sourceCount,
      style: args.style ?? 'detailed',
      includeCode: args.includeCode ?? true,
    },
  };
  await traceStore.write(startEvent);

  try {
    // Parse and validate sources
    const sources: ResearchSource[] = (args.sources as unknown[]).map((s) =>
      ResearchSourceSchema.parse(s)
    );

    // Validate and parse input
    const request: SynthesisRequest = SynthesisRequestSchema.parse({
      query: args.query,
      sources,
      style: args.style ?? 'detailed',
      includeCode: args.includeCode ?? true,
      maxLength: args.maxLength ?? 5000,
    });

    const agent = getResearchAgent();
    const synthesis = await agent.synthesize(request);

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'success',
      context: {
        workflowId: 'research-synthesize',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: true,
        synthesisLength: synthesis.length,
        sourcesUsed: sources.length,
        style: args.style ?? 'detailed',
        tool: 'research_synthesize',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              synthesis,
              sourcesUsed: sources.length,
            },
            null,
            2
          ),
        },
      ],
    };
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
        workflowId: 'research-synthesize',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        sourceCount,
        tool: 'research_synthesize',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'RESEARCH_SYNTHESIZE_FAILED',
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

export const RESEARCH_TOOLS: MCPTool[] = [
  researchQueryTool,
  researchFetchTool,
  researchSynthesizeTool,
];

export const RESEARCH_HANDLERS: Record<string, ToolHandler> = {
  research_query: handleResearchQuery,
  research_fetch: handleResearchFetch,
  research_synthesize: handleResearchSynthesize,
};
