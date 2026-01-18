/**
 * Research Domain Contracts v1
 *
 * Zod schemas for deep research agent with live documentation fetching.
 */

import { z } from 'zod';

// ============================================================================
// Research Sources
// ============================================================================

/**
 * Research source types
 */
export const ResearchSourceTypeSchema = z.enum([
  'web',
  'docs',
  'github',
  'stackoverflow',
  'arxiv',
]);

export type ResearchSourceType = z.infer<typeof ResearchSourceTypeSchema>;

/**
 * Source reliability levels
 */
export const SourceReliabilitySchema = z.enum([
  'official', // Official documentation, verified sources
  'community', // Community-maintained, Stack Overflow
  'generated', // AI-generated summaries
  'unknown', // Reliability not determined
]);

export type SourceReliability = z.infer<typeof SourceReliabilitySchema>;

// ============================================================================
// Research Request
// ============================================================================

/**
 * Research request schema
 */
export const ResearchRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  sources: z.array(ResearchSourceTypeSchema).default(['web']),
  maxSources: z.number().int().min(1).max(20).default(5),
  synthesize: z.boolean().default(true),
  includeCode: z.boolean().default(true),
  language: z.string().max(10).optional(), // e.g., 'python', 'typescript'
  timeout: z.number().int().min(1000).max(300000).default(60000),
  freshness: z.enum(['any', 'recent', 'latest']).default('any'),
});

export type ResearchRequest = z.infer<typeof ResearchRequestSchema>;

/**
 * Create default research request
 */
export function createDefaultResearchRequest(query: string): ResearchRequest {
  return ResearchRequestSchema.parse({ query });
}

// ============================================================================
// Research Source
// ============================================================================

/**
 * Individual research source
 */
export const ResearchSourceSchema = z.object({
  sourceId: z.string(),
  type: ResearchSourceTypeSchema,
  url: z.string().url(),
  title: z.string().max(500),
  snippet: z.string().max(2000),
  content: z.string().max(50000).optional(),
  reliability: SourceReliabilitySchema,
  publishedAt: z.string().datetime().optional(),
  fetchedAt: z.string().datetime(),
  relevanceScore: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

// ============================================================================
// Code Example
// ============================================================================

/**
 * Code example from research
 */
export const CodeExampleSchema = z.object({
  code: z.string().max(10000),
  language: z.string().max(50),
  source: z.string().url().optional(),
  description: z.string().max(500).optional(),
  tested: z.boolean().default(false),
});

export type CodeExample = z.infer<typeof CodeExampleSchema>;

// ============================================================================
// Research Result
// ============================================================================

/**
 * Research result schema
 */
export const ResearchResultSchema = z.object({
  resultId: z.string().uuid(),
  query: z.string(),
  sources: z.array(ResearchSourceSchema),
  synthesis: z.string().max(50000),
  codeExamples: z.array(CodeExampleSchema).default([]),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
  durationMs: z.number().int().min(0),
  completedAt: z.string().datetime(),
});

export type ResearchResult = z.infer<typeof ResearchResultSchema>;

// ============================================================================
// Research Session
// ============================================================================

/**
 * Research session for tracking multi-query research
 */
export const ResearchSessionSchema = z.object({
  sessionId: z.string().uuid(),
  queries: z.array(z.string()),
  results: z.array(ResearchResultSchema),
  context: z.string().max(10000).optional(),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ResearchSession = z.infer<typeof ResearchSessionSchema>;

// ============================================================================
// Fetch Request/Response
// ============================================================================

/**
 * Single URL fetch request
 */
export const FetchRequestSchema = z.object({
  url: z.string().url(),
  extractCode: z.boolean().default(true),
  maxLength: z.number().int().min(100).max(100000).default(10000),
  timeout: z.number().int().min(1000).max(60000).default(10000),
});

export type FetchRequest = z.infer<typeof FetchRequestSchema>;

/**
 * Single URL fetch response
 */
export const FetchResponseSchema = z.object({
  url: z.string().url(),
  title: z.string().max(500),
  content: z.string(),
  codeBlocks: z.array(CodeExampleSchema).default([]),
  reliability: SourceReliabilitySchema,
  fetchedAt: z.string().datetime(),
  success: z.boolean(),
  error: z.string().optional(),
});

export type FetchResponse = z.infer<typeof FetchResponseSchema>;

// ============================================================================
// Synthesis Request
// ============================================================================

/**
 * Synthesis request schema
 */
export const SynthesisRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  sources: z.array(ResearchSourceSchema).min(1),
  style: z.enum(['concise', 'detailed', 'tutorial']).default('detailed'),
  includeCode: z.boolean().default(true),
  maxLength: z.number().int().min(100).max(50000).default(5000),
});

export type SynthesisRequest = z.infer<typeof SynthesisRequestSchema>;

// ============================================================================
// Research Cache
// ============================================================================

/**
 * Cached research entry
 */
export const ResearchCacheEntrySchema = z.object({
  query: z.string(),
  queryHash: z.string(),
  result: ResearchResultSchema,
  cachedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  hitCount: z.number().int().min(0).default(0),
});

export type ResearchCacheEntry = z.infer<typeof ResearchCacheEntrySchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Research error codes
 */
export const ResearchErrorCodes = {
  FETCH_FAILED: 'RSH_FETCH_FAILED',
  SYNTHESIS_FAILED: 'RSH_SYNTHESIS_FAILED',
  NO_SOURCES_FOUND: 'RSH_NO_SOURCES_FOUND',
  TIMEOUT: 'RSH_TIMEOUT',
  RATE_LIMITED: 'RSH_RATE_LIMITED',
  INVALID_URL: 'RSH_INVALID_URL',
  CACHE_MISS: 'RSH_CACHE_MISS',
} as const;

export type ResearchErrorCode =
  (typeof ResearchErrorCodes)[keyof typeof ResearchErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate research request
 */
export function validateResearchRequest(data: unknown): ResearchRequest {
  return ResearchRequestSchema.parse(data);
}

/**
 * Validate research result
 */
export function validateResearchResult(data: unknown): ResearchResult {
  return ResearchResultSchema.parse(data);
}

/**
 * Validate fetch request
 */
export function validateFetchRequest(data: unknown): FetchRequest {
  return FetchRequestSchema.parse(data);
}

/**
 * Calculate confidence based on source reliability
 */
export function calculateConfidence(sources: ResearchSource[]): number {
  if (sources.length === 0) return 0;

  const weights: Record<SourceReliability, number> = {
    official: 1.0,
    community: 0.7,
    generated: 0.5,
    unknown: 0.3,
  };

  const totalWeight = sources.reduce(
    (sum, s) => sum + weights[s.reliability] * s.relevanceScore,
    0
  );

  return Math.min(1, totalWeight / sources.length);
}

/**
 * Check if result has stale data warning
 */
export function hasStaleDataWarning(result: ResearchResult): boolean {
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  const now = new Date().getTime();

  return result.sources.some((s) => {
    if (!s.publishedAt) return false;
    const age = now - new Date(s.publishedAt).getTime();
    return age > STALE_THRESHOLD_MS;
  });
}
