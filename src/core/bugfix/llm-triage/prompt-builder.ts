/**
 * LLM Triage Prompt Builder
 *
 * Constructs prompts for the LLM triage filter to review detected findings.
 *
 * @module core/bugfix/llm-triage/prompt-builder
 * @since v12.9.0
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import type { BugFinding } from '../types.js';

/**
 * Prompt parts returned by the builder
 */
export interface TriagePrompt {
  /** System prompt with instructions */
  system: string;
  /** User prompt with findings to review */
  user: string;
}

/**
 * System prompt for LLM triage
 *
 * Instructs the LLM to act as a strict code reviewer,
 * preferring precision over recall (filter false positives).
 */
const SYSTEM_PROMPT = `You are a TypeScript/JavaScript static analysis reviewer. Your task is to review bug findings detected by AST analysis and determine if each is a REAL bug or a FALSE POSITIVE.

## Your Role
- Be STRICT about false positives - only confirm clearly real bugs
- Prefer precision over recall (it's better to miss a bug than flag a false positive)
- Consider project conventions, intentional patterns, and proper cleanup

## What to Check

### Timer Leaks (timer_leak)
- Look for .unref() calls (chained or on the variable)
- Check for clearInterval/clearTimeout in destroy(), dispose(), cleanup(), close() methods
- Check if variable is tracked and cleared in class lifecycle
- Check for intentional long-running timers (heartbeats, polling) that are properly managed

### Missing Destroy (missing_destroy)
- Check if class has proper cleanup in destroy(), dispose(), close(), or shutdown() methods
- Look for EventEmitter cleanup patterns
- Consider if parent class handles cleanup

### Promise Timeout Leaks (promise_timeout_leak)
- Check if timeout is cleared in catch blocks and finally blocks
- Look for proper cleanup on both resolve and reject paths

### Event Leaks (event_leak)
- Check for removeListener/removeEventListener/off in cleanup methods
- Consider if using once() instead of on()
- Check for AbortController patterns

### Uncaught Promises (uncaught_promise)
- Check if promise chain has .catch() or try/catch
- Look for global error handlers
- Consider intentional fire-and-forget patterns with proper handling

## Response Format
Respond ONLY with a valid JSON object containing a "verdicts" array.
Each verdict must have:
- id: string (the finding ID)
- accepted: boolean (true = real bug, false = false positive)
- confidence: number (0.0 to 1.0)
- reason: string (brief explanation)

Example:
{
  "verdicts": [
    {"id": "f1", "accepted": true, "confidence": 0.9, "reason": "No cleanup found in class lifecycle"},
    {"id": "f2", "accepted": false, "confidence": 0.85, "reason": "Timer is cleared in destroy() method"}
  ]
}`;

/**
 * Format a single finding for the prompt
 */
function formatFinding(finding: BugFinding, index: number): string {
  const parts: string[] = [
    `### Finding ${index + 1}`,
    `**ID:** ${finding.id}`,
    `**Type:** ${finding.type}`,
    `**File:** ${finding.file}:${finding.lineStart}`,
    `**Severity:** ${finding.severity}`,
    `**AST Confidence:** ${(finding.confidence * 100).toFixed(0)}%`,
    `**Message:** ${finding.message}`,
  ];

  if (finding.fixStrategy) {
    parts.push(`**Suggested Fix:** ${finding.fixStrategy}`);
  }

  parts.push('', '**Code Context:**', '```typescript', finding.context.trim(), '```');

  return parts.join('\n');
}

/**
 * Build the user prompt with all findings to review
 */
function buildUserPrompt(findings: BugFinding[]): string {
  const header = `Review the following ${findings.length} finding(s) detected by AST analysis.
For each finding, determine if it's a real bug or a false positive.

## Bug Type Reference
- **timer_leak**: setInterval/setTimeout without cleanup
- **missing_destroy**: EventEmitter subclass without proper destroy()
- **promise_timeout_leak**: setTimeout in Promise without cleanup on error
- **event_leak**: .on() without .off()/.removeListener()
- **uncaught_promise**: Promise without .catch() or try/catch
- **resource_leak**: Generic resource leak pattern
- **memory_leak**: Generic memory leak pattern

---
`;

  const formattedFindings = findings.map((f, i) => formatFinding(f, i)).join('\n\n---\n\n');

  const footer = `
---

Respond with a JSON object containing a "verdicts" array with one verdict per finding.
Remember: Be strict about false positives. When uncertain, mark as false positive.`;

  return header + formattedFindings + footer;
}

/**
 * Build the complete triage prompt for a batch of findings
 *
 * @param findings - Array of bug findings to review
 * @returns Prompt object with system and user prompts
 */
export function buildTriagePrompt(findings: BugFinding[]): TriagePrompt {
  if (findings.length === 0) {
    throw new Error('Cannot build prompt for empty findings array');
  }

  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(findings),
  };
}

/**
 * Estimate the token count for a prompt
 *
 * Uses a rough approximation of ~4 characters per token.
 * This is a conservative estimate for English text with code.
 *
 * @param prompt - The prompt object
 * @returns Estimated token count
 */
export function estimateTokens(prompt: TriagePrompt): number {
  const totalChars = prompt.system.length + prompt.user.length;
  return Math.ceil(totalChars / 4);
}
