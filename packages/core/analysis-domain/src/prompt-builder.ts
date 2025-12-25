/**
 * Analysis Prompt Builder
 *
 * Builds task-specific prompts for LLM analysis.
 */

import type { AnalysisTask, CodeContext } from '@defai.digital/contracts';
import type { AnalysisPromptBuilder } from './types.js';

/**
 * Bugfix analysis prompt template
 */
const BUGFIX_PROMPT = `You are an expert code analyzer. Analyze the following code for bugs, errors, and potential issues.

Focus on:
- Logic errors and incorrect behavior
- Null/undefined reference issues
- Resource leaks (unclosed handles, missing cleanup)
- Type mismatches and type errors
- Concurrency issues (race conditions, deadlocks)
- Security vulnerabilities (injection, XSS, etc.)
- Error handling gaps
- Edge cases not handled

Code to analyze:
{code}

{userContext}

Return your findings as JSON in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "lineEnd": 45,
      "title": "Brief issue title (max 100 chars)",
      "description": "Detailed description of the issue and why it's a problem",
      "severity": "high",
      "category": "null-reference",
      "suggestion": "How to fix this issue with specific code changes",
      "confidence": 0.9
    }
  ]
}

Severity levels: "critical" (crashes/security), "high" (bugs), "medium" (potential issues), "low" (minor), "info" (suggestions)
Categories: "logic-error", "null-reference", "type-error", "resource-leak", "security", "concurrency", "error-handling", "edge-case", "other"

Important:
- Only report actual bugs and issues, not style preferences
- Be specific about line numbers and file paths
- Provide actionable suggestions
- If no issues found, return {"findings": []}
- Confidence should reflect certainty (0.0-1.0)`;

/**
 * Refactor analysis prompt template
 */
const REFACTOR_PROMPT = `You are an expert code refactoring advisor. Analyze the following code for refactoring opportunities.

Focus on:
- Functions that are too long or complex (>50 lines, >10 cyclomatic complexity)
- Duplicate code that could be extracted into shared functions
- Poor naming that reduces readability
- Complex conditionals that could be simplified
- Opportunities to improve type safety
- Code that violates single responsibility principle
- Outdated patterns that could be modernized
- Missing abstractions that would improve maintainability

Code to analyze:
{code}

{userContext}

Return your findings as JSON in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "lineEnd": 80,
      "title": "Brief opportunity title (max 100 chars)",
      "description": "Description of the refactoring opportunity",
      "severity": "medium",
      "category": "extract-function",
      "suggestion": "Suggested refactoring approach with example code",
      "confidence": 0.85
    }
  ]
}

Severity levels: "high" (significant improvement), "medium" (moderate improvement), "low" (minor improvement), "info" (optional)
Categories: "extract-function", "extract-variable", "simplify-conditional", "remove-duplication", "improve-types", "rename", "modernize", "split-responsibility", "other"

Important:
- Focus on impactful improvements that improve maintainability
- Do not report trivial style issues (formatting, spacing)
- Be specific about what to extract/change
- Provide concrete suggestions with example code
- If no opportunities found, return {"findings": []}`;

/**
 * Code review prompt template
 */
const REVIEW_PROMPT = `You are an expert code reviewer. Review the following code for quality, correctness, and best practices.

Consider:
- Code correctness and logic
- Error handling completeness
- Edge cases and boundary conditions
- Performance considerations
- Security best practices
- Code readability and maintainability
- Documentation quality
- Test coverage considerations

Code to review:
{code}

{userContext}

Return your review as JSON in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Review finding title",
      "description": "Detailed explanation of the review finding",
      "severity": "medium",
      "category": "best-practice",
      "suggestion": "Recommendation for improvement",
      "confidence": 0.8
    }
  ]
}

Severity levels: "critical" (must fix), "high" (should fix), "medium" (consider fixing), "low" (nice to have), "info" (observation)
Categories: "correctness", "error-handling", "performance", "security", "readability", "documentation", "testing", "best-practice", "other"`;

/**
 * Code explanation prompt template
 */
const EXPLAIN_PROMPT = `You are an expert code explainer. Explain what the following code does.

Code to explain:
{code}

{userContext}

Return your explanation as JSON in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 1,
      "title": "Code Overview",
      "description": "High-level explanation of what this code does and its purpose",
      "severity": "info",
      "category": "explanation",
      "suggestion": "Additional context or notes about the implementation",
      "confidence": 1.0
    }
  ]
}

For each significant function/component, provide a separate finding explaining:
- What it does
- Key implementation details
- Any notable patterns or techniques used`;

/**
 * Creates an analysis prompt builder
 */
export function createAnalysisPromptBuilder(): AnalysisPromptBuilder {
  return {
    buildPrompt(
      task: AnalysisTask,
      context: CodeContext,
      userContext?: string
    ): string {
      const template = getPromptTemplate(task);
      const codeBlock = formatCodeForPrompt(context);
      const contextBlock = userContext
        ? `Additional context from user:\n${userContext}`
        : '';

      return template
        .replace('{code}', codeBlock)
        .replace('{userContext}', contextBlock);
    },
  };
}

/**
 * Get prompt template for task
 */
function getPromptTemplate(task: AnalysisTask): string {
  switch (task) {
    case 'bugfix':
      return BUGFIX_PROMPT;
    case 'refactor':
      return REFACTOR_PROMPT;
    case 'review':
      return REVIEW_PROMPT;
    case 'explain':
      return EXPLAIN_PROMPT;
    default:
      return REVIEW_PROMPT;
  }
}

/**
 * Format code context for inclusion in prompt
 */
function formatCodeForPrompt(context: CodeContext): string {
  const parts: string[] = [];

  for (const file of context.files) {
    parts.push(`--- File: ${file.path} (${file.language}) ---`);
    parts.push(file.content);
    parts.push('');
  }

  if (context.truncated) {
    parts.push('--- Note: Some files were truncated due to size limits ---');
  }

  return parts.join('\n');
}

/**
 * Get task description for display
 */
export function getTaskDescription(task: AnalysisTask): string {
  switch (task) {
    case 'bugfix':
      return 'Bug Detection';
    case 'refactor':
      return 'Refactoring Opportunities';
    case 'review':
      return 'Code Review';
    case 'explain':
      return 'Code Explanation';
    default:
      return 'Analysis';
  }
}
