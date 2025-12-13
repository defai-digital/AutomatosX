/**
 * LLM Triage Response Parser
 *
 * Parses and validates JSON responses from the LLM triage filter.
 * Uses Zod for runtime validation to ensure type safety.
 *
 * @module core/bugfix/llm-triage/response-parser
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import { z } from 'zod';
import type { TriageVerdict, LLMTriageBatchResponse } from './types.js';

/**
 * Zod schema for a single verdict
 */
const VerdictSchema = z.object({
  id: z.string().min(1, 'Finding ID is required'),
  accepted: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});

/**
 * Zod schema for the batch response
 */
const BatchResponseSchema = z.object({
  verdicts: z.array(VerdictSchema).min(1, 'At least one verdict is required'),
});

/**
 * Result of parsing a response
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed verdicts (if successful) */
  verdicts?: TriageVerdict[];
  /** Error message (if failed) */
  error?: string;
  /** Raw response that was parsed */
  rawResponse: string;
}

/**
 * Extract JSON from a response that may contain markdown or other text
 *
 * Handles common LLM response formats:
 * - Pure JSON
 * - JSON in markdown code block
 * - JSON with leading/trailing text
 *
 * @param response - Raw LLM response
 * @returns Extracted JSON string or null if not found
 */
function extractJson(response: string): string | null {
  const trimmed = response.trim();

  // Try parsing as-is first (pure JSON)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  // Try extracting from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // Try finding JSON object anywhere in the response
  const jsonObjectMatch = trimmed.match(/\{[\s\S]*"verdicts"[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }

  // Try finding JSON array (in case LLM returns just the array)
  const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    // Wrap in object with verdicts key
    return `{"verdicts": ${jsonArrayMatch[0]}}`;
  }

  return null;
}

/**
 * Parse and validate an LLM triage response
 *
 * @param response - Raw LLM response string
 * @returns Parse result with verdicts or error
 */
export function parseTriageResponse(response: string): ParseResult {
  if (!response || typeof response !== 'string') {
    return {
      success: false,
      error: 'Response is empty or not a string',
      rawResponse: String(response),
    };
  }

  // Extract JSON from response
  const jsonString = extractJson(response);
  if (!jsonString) {
    return {
      success: false,
      error: 'Could not find JSON in response',
      rawResponse: response,
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : 'Parse error'}`,
      rawResponse: response,
    };
  }

  // Validate with Zod
  const result = BatchResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      success: false,
      error: `Validation failed: ${issues}`,
      rawResponse: response,
    };
  }

  // Convert to TriageVerdict type
  const verdicts: TriageVerdict[] = result.data.verdicts.map(v => ({
    findingId: v.id,
    accepted: v.accepted,
    confidence: v.confidence,
    reason: v.reason,
  }));

  return {
    success: true,
    verdicts,
    rawResponse: response,
  };
}

/**
 * Validate that all expected finding IDs have verdicts
 *
 * @param verdicts - Parsed verdicts
 * @param expectedIds - Expected finding IDs
 * @returns Object with missing and extra IDs
 */
export function validateVerdictCoverage(
  verdicts: TriageVerdict[],
  expectedIds: string[]
): { missing: string[]; extra: string[] } {
  const verdictIds = new Set(verdicts.map(v => v.findingId));
  const expectedSet = new Set(expectedIds);

  const missing = expectedIds.filter(id => !verdictIds.has(id));
  const extra = [...verdictIds].filter(id => !expectedSet.has(id));

  return { missing, extra };
}

/**
 * Create default verdicts for findings that the LLM didn't respond to
 *
 * Used when LLM response is incomplete. Defaults to accepting findings
 * (conservative - don't hide potential bugs).
 *
 * @param findingIds - IDs of findings without verdicts
 * @returns Default verdicts (accepted with low confidence)
 */
export function createDefaultVerdicts(findingIds: string[]): TriageVerdict[] {
  return findingIds.map(id => ({
    findingId: id,
    accepted: true, // Default to accepting (don't hide bugs)
    confidence: 0.5,
    reason: 'LLM did not provide verdict, defaulting to accept',
  }));
}
