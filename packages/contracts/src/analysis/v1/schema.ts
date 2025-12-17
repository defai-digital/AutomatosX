/**
 * Analysis Domain Contracts v1
 *
 * Schemas for LLM-delegated code analysis (bugfix, refactor, review).
 * Replaces the complex AST-based approach with provider-delegated analysis.
 */

import { z } from 'zod';

// ============================================================================
// Analysis Task Types
// ============================================================================

/**
 * Analysis task type
 */
export const AnalysisTaskSchema = z.enum(['bugfix', 'refactor', 'review', 'explain']);
export type AnalysisTask = z.infer<typeof AnalysisTaskSchema>;

/**
 * Analysis severity filter
 */
export const AnalysisSeverityFilterSchema = z.enum(['all', 'medium', 'high', 'critical']);
export type AnalysisSeverityFilter = z.infer<typeof AnalysisSeverityFilterSchema>;

/**
 * Finding severity level
 */
export const FindingSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

// ============================================================================
// Analysis Request
// ============================================================================

/**
 * Analysis request schema
 */
export const AnalysisRequestSchema = z.object({
  /** Analysis task type */
  task: AnalysisTaskSchema,

  /** File paths to analyze */
  paths: z.array(z.string()).min(1).max(50),

  /** Additional context for the analysis */
  context: z.string().max(2000).optional(),

  /** Minimum severity to report */
  severity: AnalysisSeverityFilterSchema.default('all'),

  /** Maximum files to analyze */
  maxFiles: z.number().int().min(1).max(100).default(20),

  /** Maximum lines per file to include */
  maxLinesPerFile: z.number().int().min(100).max(5000).default(1000),

  /** Provider to use (optional - uses routing if not specified) */
  providerId: z.string().optional(),

  /** Request timeout in ms */
  timeoutMs: z.number().int().min(5000).max(120000).default(60000),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

// ============================================================================
// Analysis Finding
// ============================================================================

/**
 * Single finding from analysis
 */
export const AnalysisFindingSchema = z.object({
  /** Unique finding ID */
  findingId: z.string(),

  /** File path */
  file: z.string(),

  /** Line number (if applicable) */
  line: z.number().int().min(1).optional(),

  /** End line (for ranges) */
  lineEnd: z.number().int().min(1).optional(),

  /** Issue title */
  title: z.string().max(200),

  /** Detailed description */
  description: z.string().max(2000),

  /** Severity level */
  severity: FindingSeveritySchema,

  /** Category (for grouping) */
  category: z.string().max(50),

  /** Suggested fix or improvement */
  suggestion: z.string().max(5000).optional(),

  /** Code snippet showing the issue */
  codeSnippet: z.string().max(1000).optional(),

  /** Confidence score 0-1 */
  confidence: z.number().min(0).max(1),
});

export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;

// ============================================================================
// Analysis Result
// ============================================================================

/**
 * Analysis result schema
 */
export const AnalysisResultSchema = z.object({
  /** Unique result ID */
  resultId: z.string().uuid(),

  /** Task that was performed */
  task: AnalysisTaskSchema,

  /** Findings from analysis */
  findings: z.array(AnalysisFindingSchema),

  /** Summary of findings */
  summary: z.string().max(1000),

  /** Files that were analyzed */
  filesAnalyzed: z.array(z.string()),

  /** Total lines analyzed */
  linesAnalyzed: z.number().int().min(0),

  /** Provider that performed analysis */
  providerId: z.string(),

  /** Analysis duration in ms */
  durationMs: z.number().int().min(0),

  /** Timestamp */
  completedAt: z.string().datetime(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ============================================================================
// Code Context
// ============================================================================

/**
 * File content for analysis
 */
export const AnalysisFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  lines: z.number().int().min(0),
  language: z.string(),
});

export type AnalysisFile = z.infer<typeof AnalysisFileSchema>;

/**
 * Code context gathered for analysis
 */
export const CodeContextSchema = z.object({
  files: z.array(AnalysisFileSchema),
  totalLines: z.number().int().min(0),
  truncated: z.boolean(),
});

export type CodeContext = z.infer<typeof CodeContextSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const AnalysisErrorCodes = {
  NO_FILES_FOUND: 'ANALYSIS_NO_FILES_FOUND',
  FILE_READ_ERROR: 'ANALYSIS_FILE_READ_ERROR',
  PROVIDER_ERROR: 'ANALYSIS_PROVIDER_ERROR',
  PARSE_ERROR: 'ANALYSIS_PARSE_ERROR',
  CONTEXT_TOO_LARGE: 'ANALYSIS_CONTEXT_TOO_LARGE',
  TIMEOUT: 'ANALYSIS_TIMEOUT',
  INVALID_REQUEST: 'ANALYSIS_INVALID_REQUEST',
} as const;

export type AnalysisErrorCode = (typeof AnalysisErrorCodes)[keyof typeof AnalysisErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateAnalysisRequest(data: unknown): AnalysisRequest {
  return AnalysisRequestSchema.parse(data);
}

export function safeValidateAnalysisRequest(
  data: unknown
): { success: true; data: AnalysisRequest } | { success: false; error: z.ZodError } {
  const result = AnalysisRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function validateAnalysisFinding(data: unknown): AnalysisFinding {
  return AnalysisFindingSchema.parse(data);
}

export function safeValidateAnalysisFinding(
  data: unknown
): { success: true; data: AnalysisFinding } | { success: false; error: z.ZodError } {
  const result = AnalysisFindingSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

export function validateAnalysisResult(data: unknown): AnalysisResult {
  return AnalysisResultSchema.parse(data);
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultAnalysisRequest(
  task: AnalysisTask,
  paths: string[]
): AnalysisRequest {
  return AnalysisRequestSchema.parse({ task, paths });
}

export function createAnalysisFinding(data: {
  file: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: string;
  confidence: number;
  line?: number;
  lineEnd?: number;
  suggestion?: string;
  codeSnippet?: string;
}): AnalysisFinding {
  return {
    findingId: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...data,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Filter findings by minimum severity
 */
export function filterFindingsBySeverity(
  findings: AnalysisFinding[],
  minSeverity: AnalysisSeverityFilter
): AnalysisFinding[] {
  if (minSeverity === 'all') return findings;

  const severityOrder: Record<FindingSeverity, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const minLevel = severityOrder[minSeverity as FindingSeverity] ?? 0;

  return findings.filter((f) => severityOrder[f.severity] >= minLevel);
}

/**
 * Group findings by category
 */
export function groupFindingsByCategory(
  findings: AnalysisFinding[]
): Record<string, AnalysisFinding[]> {
  return findings.reduce(
    (acc, finding) => {
      const category = finding.category;
      if (!acc[category]) acc[category] = [];
      acc[category].push(finding);
      return acc;
    },
    {} as Record<string, AnalysisFinding[]>
  );
}

/**
 * Group findings by severity
 */
export function groupFindingsBySeverity(
  findings: AnalysisFinding[]
): Record<FindingSeverity, AnalysisFinding[]> {
  return findings.reduce(
    (acc, finding) => {
      if (!acc[finding.severity]) acc[finding.severity] = [];
      acc[finding.severity].push(finding);
      return acc;
    },
    {} as Record<FindingSeverity, AnalysisFinding[]>
  );
}

/**
 * Get language from file path
 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    vue: 'vue',
    svelte: 'svelte',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return langMap[ext] ?? 'unknown';
}
