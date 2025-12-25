/**
 * Comment Builder
 *
 * Parses LLM responses and builds validated review comments.
 * Enforces INV-REV-002 (Confidence Filtering), INV-REV-003 (Explanation Required),
 * and INV-REV-004 (Actionable Suggestions).
 */

import { v4 as uuidv4 } from 'uuid';
import {
  type ReviewComment,
  type ReviewFocus,
  ReviewCommentSchema,
  ReviewCommentSeveritySchema,
} from '@defai.digital/contracts';
import { isCategoryValidForFocus } from './focus-modes.js';
import type { ParsedReviewResponse } from './types.js';

/**
 * Raw comment from LLM response (before validation)
 */
interface RawComment {
  file?: string;
  line?: number;
  lineEnd?: number;
  severity?: string;
  title?: string;
  body?: string;
  rationale?: string;
  suggestion?: string;
  suggestedCode?: string;
  confidence?: number;
  category?: string;
}

/**
 * Parse LLM response into review comments
 * Validates against schema and enforces invariants
 */
export function parseReviewResponse(
  response: string,
  focus: ReviewFocus,
  minConfidence: number
): ParsedReviewResponse {
  const errors: string[] = [];
  const comments: ReviewComment[] = [];

  // Try to extract JSON array from response
  let rawComments: RawComment[];
  try {
    // Handle responses that might have text before/after JSON
    const jsonMatch = /\[[\s\S]*\]/.exec(response);
    if (!jsonMatch) {
      return {
        comments: [],
        success: false,
        errors: ['No JSON array found in response'],
      };
    }
    rawComments = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return {
      comments: [],
      success: false,
      errors: [`Failed to parse JSON: ${e instanceof Error ? e.message : 'Unknown error'}`],
    };
  }

  if (!Array.isArray(rawComments)) {
    return {
      comments: [],
      success: false,
      errors: ['Response is not an array'],
    };
  }

  for (let i = 0; i < rawComments.length; i++) {
    const raw = rawComments[i]!;
    if (!raw) continue;
    const result = buildComment(raw, focus, minConfidence);

    if (result.success && result.comment) {
      comments.push(result.comment);
    } else if (result.error) {
      errors.push(`Comment ${i}: ${result.error}`);
    }
  }

  const result: ParsedReviewResponse = {
    comments,
    success: errors.length === 0,
  };
  if (errors.length > 0) {
    result.errors = errors;
  }
  return result;
}

/**
 * Build a single validated comment
 */
function buildComment(
  raw: RawComment,
  focus: ReviewFocus,
  minConfidence: number
): { success: boolean; comment?: ReviewComment; error?: string } {
  // Validate required fields
  if (!raw.file || typeof raw.file !== 'string') {
    return { success: false, error: 'Missing or invalid file path' };
  }

  if (!raw.line || typeof raw.line !== 'number' || raw.line < 1) {
    return { success: false, error: 'Missing or invalid line number' };
  }

  if (!raw.severity || !isValidSeverity(raw.severity)) {
    return { success: false, error: `Invalid severity: ${raw.severity}` };
  }

  if (!raw.title || typeof raw.title !== 'string') {
    return { success: false, error: 'Missing title' };
  }

  // INV-REV-003: Explanation Required - body must be present
  if (!raw.body || typeof raw.body !== 'string' || raw.body.length < 10) {
    return { success: false, error: 'Missing or too short body (min 10 chars)' };
  }

  // INV-REV-002: Confidence Filtering
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;
  if (confidence < minConfidence) {
    return { success: false, error: `Confidence ${confidence} below threshold ${minConfidence}` };
  }

  // INV-REV-004: Actionable Suggestions for critical/warning
  const severity = raw.severity as 'critical' | 'warning' | 'suggestion' | 'note';
  if ((severity === 'critical' || severity === 'warning') && !raw.suggestion) {
    return { success: false, error: `${severity} comment must have suggestion` };
  }

  // INV-REV-001: Focus Mode Isolation
  const category = raw.category || `${focus}/other`;
  if (focus !== 'all' && !isCategoryValidForFocus(category, focus)) {
    // Allow but warn - don't reject outright
    // The comment will still be included but this is noted
  }

  const comment: ReviewComment = {
    commentId: uuidv4(),
    file: raw.file,
    line: raw.line,
    lineEnd: raw.lineEnd,
    severity,
    title: raw.title.slice(0, 100), // Enforce max length
    body: raw.body.slice(0, 2000),
    rationale: raw.rationale?.slice(0, 500),
    suggestion: raw.suggestion?.slice(0, 1000),
    suggestedCode: raw.suggestedCode?.slice(0, 2000),
    focus,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
    category: category.slice(0, 50),
  };

  // Validate against schema
  const validation = ReviewCommentSchema.safeParse(comment);
  if (!validation.success) {
    return {
      success: false,
      error: `Schema validation failed: ${validation.error.errors.map((e) => e.message).join(', ')}`,
    };
  }

  return { success: true, comment };
}

/**
 * Check if a severity value is valid
 */
function isValidSeverity(severity: string): boolean {
  return ReviewCommentSeveritySchema.safeParse(severity).success;
}

/**
 * Filter comments by focus mode
 * INV-REV-001: Focus Mode Isolation
 */
export function filterCommentsByFocus(
  comments: ReviewComment[],
  focus: ReviewFocus
): ReviewComment[] {
  if (focus === 'all') {
    return comments;
  }

  return comments.filter((comment) => {
    // Check if category matches focus
    return isCategoryValidForFocus(comment.category, focus);
  });
}

/**
 * Filter comments by confidence threshold
 * INV-REV-002: Confidence Filtering
 */
export function filterCommentsByConfidence(
  comments: ReviewComment[],
  minConfidence: number
): ReviewComment[] {
  return comments.filter((comment) => comment.confidence >= minConfidence);
}

/**
 * Validate that critical/warning comments have suggestions
 * INV-REV-004: Actionable Suggestions
 */
export function validateActionableSuggestions(
  comments: ReviewComment[]
): { valid: boolean; invalidComments: ReviewComment[] } {
  const invalidComments = comments.filter((comment) => {
    const needsSuggestion = comment.severity === 'critical' || comment.severity === 'warning';
    return needsSuggestion && !comment.suggestion;
  });

  return {
    valid: invalidComments.length === 0,
    invalidComments,
  };
}

// Export uuid for testing
export { v4 as generateCommentId } from 'uuid';
