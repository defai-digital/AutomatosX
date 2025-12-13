/**
 * LLM Refactor Prompt Builder
 *
 * Constructs prompts for the LLM to perform code refactoring.
 *
 * @module core/refactor/llm-refactor/prompt-builder
 * @since v12.10.0
 * @see PRD-022: Refactor Tool LLM Enhancement
 */

import type { RefactorFinding } from '../types.js';
import type { RefactorBatch, RefactorPrompt } from './types.js';
import { REFACTOR_TYPE_DESCRIPTIONS } from './constants.js';

/**
 * System prompt for LLM refactoring
 */
const SYSTEM_PROMPT = `You are an expert code refactoring assistant. Your task is to refactor code based on detected issues while preserving functionality and improving code quality.

## Guidelines

1. **Preserve Semantics**: The refactored code MUST behave identically to the original
2. **Minimal Changes**: Only change what's necessary to address the issue
3. **Follow Conventions**: Match the existing code style (indentation, quotes, etc.)
4. **Be Conservative**: When uncertain, mark for manual review rather than making risky changes
5. **No Side Effects**: Don't introduce new dependencies, remove used code, or change APIs

## Safety Rules

Mark for MANUAL REVIEW if:
- The change affects exported/public APIs
- Constructor or class inheritance is involved
- The change is more than 20 lines
- You're less than 85% confident the change is correct
- The code has complex control flow or side effects

## Response Format

Respond with a valid JSON object containing a "refactorings" array.
Each refactoring must have:
- id: string (the finding ID)
- success: boolean (whether refactoring was possible)
- refactoredCode: string (the new code, if successful)
- explanation: string (brief explanation of changes)
- confidence: number (0.0 to 1.0)
- safeToAutoApply: boolean (true if safe for automatic application)
- manualReviewReason: string (required if safeToAutoApply is false)
- error: string (if success is false)

Example:
{
  "refactorings": [
    {
      "id": "finding-1",
      "success": true,
      "refactoredCode": "const MAX_RETRIES = 3;\\nretry(MAX_RETRIES);",
      "explanation": "Extracted magic number 3 to named constant MAX_RETRIES",
      "confidence": 0.95,
      "safeToAutoApply": true
    },
    {
      "id": "finding-2",
      "success": true,
      "refactoredCode": "export function process(input: string): Result {",
      "explanation": "Replaced any with specific types",
      "confidence": 0.75,
      "safeToAutoApply": false,
      "manualReviewReason": "Changes public API signature - requires manual verification"
    }
  ]
}`;

/**
 * Format a single finding for the prompt
 */
function formatFinding(finding: RefactorFinding, index: number): string {
  const typeDescription = REFACTOR_TYPE_DESCRIPTIONS[finding.type] || finding.type;

  const parts: string[] = [
    `### Finding ${index + 1}`,
    `**ID:** ${finding.id}`,
    `**Type:** ${finding.type} - ${typeDescription}`,
    `**Location:** Lines ${finding.lineStart}-${finding.lineEnd}`,
    `**Severity:** ${finding.severity}`,
    `**Message:** ${finding.message}`,
  ];

  if (finding.suggestedFix) {
    parts.push(`**Suggested Approach:** ${finding.suggestedFix}`);
  }

  parts.push('', '**Code to Refactor:**', '```', finding.context.trim(), '```');

  return parts.join('\n');
}

/**
 * Build the user prompt with file content and findings
 */
function buildUserPrompt(batch: RefactorBatch): string {
  const header = `Refactor the following ${batch.findings.length} issue(s) in file: ${batch.file}

## File Content
\`\`\`typescript
${batch.fileContent}
\`\`\`

## Findings to Address
`;

  const formattedFindings = batch.findings
    .map((f, i) => formatFinding(f, i))
    .join('\n\n---\n\n');

  const footer = `
---

## Instructions

For each finding:
1. Analyze the code context in the full file
2. Determine the minimal refactoring needed
3. Ensure the refactored code compiles and behaves identically
4. Assess whether it's safe to auto-apply

Respond with a JSON object containing a "refactorings" array.
Remember: Be conservative. When in doubt, mark for manual review.`;

  return header + formattedFindings + footer;
}

/**
 * Build the complete refactoring prompt for a batch
 *
 * @param batch - Batch of findings to refactor
 * @returns Prompt object with system and user prompts
 */
export function buildRefactorPrompt(batch: RefactorBatch): RefactorPrompt {
  if (batch.findings.length === 0) {
    throw new Error('Cannot build prompt for empty findings batch');
  }

  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(batch),
  };
}

/**
 * Estimate the token count for a prompt
 *
 * Uses a rough approximation of ~4 characters per token.
 *
 * @param prompt - The prompt object
 * @returns Estimated token count
 */
export function estimateTokens(prompt: RefactorPrompt): number {
  const totalChars = prompt.system.length + prompt.user.length;
  return Math.ceil(totalChars / 4);
}

/**
 * Build a simpler prompt for single-finding refactoring
 * Used when batching is disabled or for complex findings
 */
export function buildSingleFindingPrompt(
  finding: RefactorFinding,
  fileContent: string,
  filePath: string
): RefactorPrompt {
  const batch: RefactorBatch = {
    batchId: finding.id,
    file: filePath,
    fileContent,
    findings: [finding],
  };

  return buildRefactorPrompt(batch);
}
