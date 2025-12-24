/**
 * Analysis Response Parser
 *
 * Parses LLM responses into structured findings.
 */

import {
  type AnalysisFinding,
  type AnalysisTask,
  type FindingSeverity,
  safeValidateAnalysisFinding,
} from '@automatosx/contracts';
import type { AnalysisResponseParser } from './types.js';

/**
 * Response parser error
 */
export class ResponseParserError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ResponseParserError';
  }
}

/**
 * Creates an analysis response parser
 */
export function createAnalysisResponseParser(): AnalysisResponseParser {
  return {
    parseResponse(response: string, task: AnalysisTask): AnalysisFinding[] {
      // Try to extract JSON from response
      const jsonContent = extractJson(response);

      if (!jsonContent) {
        // If no JSON found, try to parse the entire response as JSON
        try {
          const parsed = JSON.parse(response);
          return parseFindings(parsed, task);
        } catch {
          // Return empty findings if parsing fails
          return [];
        }
      }

      try {
        const parsed = JSON.parse(jsonContent);
        return parseFindings(parsed, task);
      } catch {
        return [];
      }
    },
  };
}

/**
 * Extract JSON content from response
 * Handles cases where LLM wraps JSON in markdown code blocks
 */
function extractJson(response: string): string | null {
  // Try to find JSON in code blocks
  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)```/.exec(response);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = /\{[\s\S]*\}/.exec(response);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return null;
}

/**
 * Parse findings from JSON object
 */
function parseFindings(data: unknown, task: AnalysisTask): AnalysisFinding[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const obj = data as Record<string, unknown>;
  const rawFindings = obj.findings;

  if (!Array.isArray(rawFindings)) {
    return [];
  }

  const findings: AnalysisFinding[] = [];

  for (const raw of rawFindings) {
    const finding = normalizeFinding(raw, task);
    if (finding) {
      findings.push(finding);
    }
  }

  return findings;
}

/**
 * Normalize a raw finding into a valid AnalysisFinding
 */
function normalizeFinding(
  raw: unknown,
  task: AnalysisTask
): AnalysisFinding | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Build normalized finding
  const normalized = {
    findingId: `${task}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file: normalizeString(obj.file) ?? 'unknown',
    line: normalizeNumber(obj.line),
    lineEnd: normalizeNumber(obj.lineEnd ?? obj.line_end),
    title: normalizeString(obj.title) ?? 'Untitled Finding',
    description: normalizeString(obj.description) ?? '',
    severity: normalizeSeverity(obj.severity),
    category: normalizeString(obj.category) ?? 'other',
    suggestion: normalizeString(obj.suggestion ?? obj.fix ?? obj.recommendation),
    codeSnippet: normalizeString(obj.codeSnippet ?? obj.code_snippet ?? obj.code),
    confidence: normalizeConfidence(obj.confidence),
  };

  // Validate against schema
  const validation = safeValidateAnalysisFinding(normalized);
  if (validation.success) {
    return validation.data;
  }

  // Try to fix common issues and re-validate
  const fixed = {
    ...normalized,
    title: normalized.title.slice(0, 200),
    description: normalized.description.slice(0, 2000),
    category: normalized.category.slice(0, 50),
    suggestion: normalized.suggestion?.slice(0, 5000),
    codeSnippet: normalized.codeSnippet?.slice(0, 1000),
  };

  const fixedValidation = safeValidateAnalysisFinding(fixed);
  if (fixedValidation.success) {
    return fixedValidation.data;
  }

  return null;
}

/**
 * Normalize string value
 */
function normalizeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return undefined;
}

/**
 * Normalize number value
 */
function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !isNaN(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  return undefined;
}

/**
 * Normalize severity value
 */
function normalizeSeverity(value: unknown): FindingSeverity {
  const severityMap: Record<string, FindingSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'info',
    // Common alternatives
    error: 'high',
    warning: 'medium',
    warn: 'medium',
    suggestion: 'low',
    hint: 'info',
    note: 'info',
  };

  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    return severityMap[normalized] ?? 'medium';
  }

  return 'medium';
}

/**
 * Normalize confidence value
 */
function normalizeConfidence(value: unknown): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return Math.max(0, Math.min(1, num));
    }
  }
  return 0.8; // Default confidence
}

/**
 * Merge findings that refer to the same issue
 */
export function deduplicateFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  const seen = new Map<string, AnalysisFinding>();

  for (const finding of findings) {
    const key = `${finding.file}:${finding.line ?? 0}:${finding.category}`;

    if (!seen.has(key)) {
      seen.set(key, finding);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(key)!;
      if (finding.confidence > existing.confidence) {
        seen.set(key, finding);
      }
    }
  }

  return Array.from(seen.values());
}
