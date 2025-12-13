/**
 * LLM Refactor Response Parser
 *
 * Parses and validates JSON responses from the LLM refactoring service.
 * Uses Zod for runtime validation to ensure type safety.
 *
 * @module core/refactor/llm-refactor/response-parser
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

import { z } from 'zod';
import type { LLMRefactorResponse, ParseResult } from './types.js';

/**
 * Zod schema for a single refactoring result
 */
const RefactoringResultSchema = z.object({
  id: z.string().min(1, 'Finding ID is required'),
  success: z.boolean(),
  refactoredCode: z.string().optional(),
  explanation: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  safeToAutoApply: z.boolean().default(false),
  manualReviewReason: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Zod schema for the batch response
 */
const RefactorResponseSchema = z.object({
  refactorings: z.array(RefactoringResultSchema).min(1, 'At least one refactoring result is required'),
});

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

  // Try finding JSON object with refactorings key
  const jsonObjectMatch = trimmed.match(/\{[\s\S]*"refactorings"[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }

  // Try finding JSON array (in case LLM returns just the array)
  const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    // Wrap in object with refactorings key
    return `{"refactorings": ${jsonArrayMatch[0]}}`;
  }

  return null;
}

/**
 * Parse and validate an LLM refactor response
 *
 * @param response - Raw LLM response string
 * @returns Parse result with refactorings or error
 */
export function parseRefactorResponse(response: string): ParseResult {
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
  const result = RefactorResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return {
      success: false,
      error: `Validation failed: ${issues}`,
      rawResponse: response,
    };
  }

  // Convert to LLMRefactorResponse type
  const refactorResponse: LLMRefactorResponse = {
    refactorings: result.data.refactorings.map(r => ({
      id: r.id,
      success: r.success,
      refactoredCode: r.refactoredCode,
      explanation: r.explanation,
      confidence: r.confidence,
      safeToAutoApply: r.safeToAutoApply,
      manualReviewReason: r.manualReviewReason,
      error: r.error,
    })),
  };

  return {
    success: true,
    response: refactorResponse,
    rawResponse: response,
  };
}

/**
 * Validate that all expected finding IDs have results
 *
 * @param response - Parsed response
 * @param expectedIds - Expected finding IDs
 * @returns Object with missing and extra IDs
 */
export function validateResultCoverage(
  response: LLMRefactorResponse,
  expectedIds: string[]
): { missing: string[]; extra: string[] } {
  const resultIds = new Set(response.refactorings.map(r => r.id));
  const expectedSet = new Set(expectedIds);

  const missing = expectedIds.filter(id => !resultIds.has(id));
  const extra = [...resultIds].filter(id => !expectedSet.has(id));

  return { missing, extra };
}

/**
 * Create default results for findings that the LLM didn't respond to
 *
 * @param findingIds - IDs of findings without results
 * @returns Default results (marked for manual review)
 */
export function createDefaultResults(findingIds: string[]): LLMRefactorResponse['refactorings'] {
  return findingIds.map(id => ({
    id,
    success: false,
    confidence: 0,
    safeToAutoApply: false,
    manualReviewReason: 'LLM did not provide result',
    error: 'No result from LLM',
  }));
}

/**
 * Sanitize refactored code to ensure it's valid
 *
 * - Removes markdown code block markers if present
 * - Trims whitespace
 * - Validates basic structure
 *
 * @param code - Code from LLM response
 * @returns Sanitized code or null if invalid
 */
export function sanitizeRefactoredCode(code: string | undefined): string | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  let sanitized = code.trim();

  // Remove markdown code block markers
  if (sanitized.startsWith('```')) {
    const lines = sanitized.split('\n');
    // Remove first line (```typescript or similar)
    lines.shift();
    // Remove last line if it's closing ```
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop();
    }
    sanitized = lines.join('\n');
  }

  // Basic validation - must have some content
  if (sanitized.length === 0) {
    return null;
  }

  return sanitized;
}
