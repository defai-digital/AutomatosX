/**
 * Focus Mode Prompts
 *
 * Specialized prompts for each review focus mode.
 * INV-REV-001: Each focus mode MUST only report issues relevant to that focus.
 */

import type { ReviewFocus } from '@defai.digital/contracts';

/**
 * Focus-specific system prompts
 * Each prompt instructs the LLM to focus on specific categories of issues.
 */
export const FOCUS_MODE_PROMPTS: Record<ReviewFocus, string> = {
  security: `You are a security-focused code reviewer. Analyze for:
- Injection vulnerabilities (SQL, XSS, command injection, LDAP injection)
- Authentication/authorization issues (broken auth, insecure sessions)
- Sensitive data exposure (PII leaks, hardcoded credentials, logging secrets)
- Insecure cryptography (weak algorithms, improper key management)
- Security misconfigurations (CORS, headers, permissions)
- OWASP Top 10 vulnerabilities
- Input validation failures
- Insecure deserialization

Only report security-related issues. Ignore style, naming, or general code quality.
Tag all comments with category starting with "security/".`,

  architecture: `You are an architecture-focused code reviewer. Analyze for:
- Single Responsibility Principle violations (classes/functions doing too much)
- High coupling between modules (tight dependencies, circular imports)
- Dependency inversion issues (high-level depending on low-level)
- Circular dependencies
- God classes/functions (doing too much)
- Missing abstraction layers
- Improper separation of concerns
- Leaky abstractions
- Interface segregation violations
- Improper layering (presentation touching data directly)

Only report architectural issues. Ignore security, performance, or style issues.
Tag all comments with category starting with "architecture/".`,

  performance: `You are a performance-focused code reviewer. Analyze for:
- N+1 query patterns (database queries in loops)
- Memory leaks (unclosed resources, event listeners not removed)
- Unnecessary re-renders or re-computations
- Expensive operations in loops (sorting, regex compilation)
- Missing caching opportunities
- Blocking operations in async contexts
- O(n²) or worse algorithms where O(n) is possible
- Unnecessary object creation in hot paths
- String concatenation in loops
- Unbounded collections growth

Only report performance issues. Ignore security, architecture, or style issues.
Tag all comments with category starting with "performance/".`,

  maintainability: `You are a maintainability-focused code reviewer. Analyze for:
- Code duplication (DRY violations, copy-paste code)
- Poor naming (unclear variable/function names, abbreviations)
- Missing or inadequate documentation
- Complex conditionals (deeply nested, long chains)
- Magic numbers/strings without constants
- Dead code or unreachable branches
- Inconsistent patterns within the codebase
- Long functions/methods (>50 lines)
- Too many parameters (>5)
- Complex boolean expressions

Only report maintainability issues. Ignore security, performance, or architecture issues.
Tag all comments with category starting with "maintainability/".`,

  correctness: `You are a correctness-focused code reviewer. Analyze for:
- Logic errors and off-by-one mistakes
- Null/undefined handling issues (missing null checks, optional chaining)
- Race conditions (async ordering, shared state)
- Error handling gaps (uncaught exceptions, unhandled rejections)
- Type mismatches or unsafe casts
- Edge cases not handled (empty arrays, zero values)
- Incorrect assumptions in comments vs code
- Integer overflow/underflow
- Floating point precision issues
- Incorrect comparisons (== vs ===)

Only report correctness issues. Focus on bugs, not style or optimization.
Tag all comments with category starting with "correctness/".`,

  all: `You are a comprehensive code reviewer. Analyze for issues in ALL categories:

SECURITY:
- Injection vulnerabilities, auth issues, data exposure, cryptography issues

ARCHITECTURE:
- SRP violations, high coupling, circular dependencies, missing abstractions

PERFORMANCE:
- N+1 queries, memory leaks, inefficient algorithms, blocking operations

MAINTAINABILITY:
- Code duplication, poor naming, complex conditionals, magic numbers

CORRECTNESS:
- Logic errors, null handling, race conditions, error handling gaps

Prioritize critical issues. Provide balanced coverage across all categories.
Tag comments with appropriate category prefixes (security/, architecture/, performance/, maintainability/, correctness/).`,
};

/**
 * Get the prompt for a specific focus mode
 */
export function getFocusModePrompt(focus: ReviewFocus): string {
  return FOCUS_MODE_PROMPTS[focus];
}

/**
 * Get the response format instructions
 * This instructs the LLM how to format its response for parsing.
 */
export const RESPONSE_FORMAT_INSTRUCTIONS = `
Respond with a JSON array of review comments. Each comment must have:
{
  "file": "path/to/file.ts",
  "line": 42,
  "lineEnd": 45,           // optional, for multi-line issues
  "severity": "critical",   // one of: critical, warning, suggestion, note
  "title": "Brief issue title (max 100 chars)",
  "body": "Detailed explanation of the issue and why it matters",
  "rationale": "Why this is important to fix", // optional but recommended
  "suggestion": "How to fix this issue",       // required for critical/warning
  "suggestedCode": "code snippet showing the fix", // optional
  "confidence": 0.95,      // your confidence 0-1
  "category": "security/sql-injection" // category with focus prefix
}

IMPORTANT:
- severity must be one of: critical, warning, suggestion, note
- critical/warning MUST include suggestion field
- body MUST explain WHY this matters
- confidence should reflect your certainty (0.0-1.0)
- Only report issues you are confident about
- Do not report style issues unless maintainability focus

Respond ONLY with the JSON array, no other text.
`;

/**
 * Build the complete review prompt
 */
export function buildReviewPrompt(
  focus: ReviewFocus,
  fileContents: { path: string; content: string }[],
  userContext?: string
): string {
  const focusPrompt = getFocusModePrompt(focus);

  let prompt = `${focusPrompt}

${RESPONSE_FORMAT_INSTRUCTIONS}

`;

  if (userContext) {
    prompt += `Additional context from the user:
${userContext}

`;
  }

  prompt += `Files to review:

`;

  for (const file of fileContents) {
    prompt += `--- ${file.path} ---
${file.content}

`;
  }

  prompt += `
Now analyze these files and provide your review comments as a JSON array.`;

  return prompt;
}

/**
 * Categories allowed for each focus mode
 * INV-REV-001: Used to validate that comments match their focus mode
 */
export const FOCUS_MODE_CATEGORIES: Record<ReviewFocus, string[]> = {
  security: [
    'security/injection',
    'security/xss',
    'security/sql-injection',
    'security/command-injection',
    'security/auth',
    'security/authorization',
    'security/data-exposure',
    'security/cryptography',
    'security/configuration',
    'security/deserialization',
    'security/validation',
    'security/other',
  ],
  architecture: [
    'architecture/srp-violation',
    'architecture/coupling',
    'architecture/circular-dependency',
    'architecture/god-class',
    'architecture/abstraction',
    'architecture/separation-of-concerns',
    'architecture/layering',
    'architecture/other',
  ],
  performance: [
    'performance/n-plus-one',
    'performance/memory-leak',
    'performance/re-render',
    'performance/loop-operation',
    'performance/caching',
    'performance/blocking',
    'performance/algorithm',
    'performance/allocation',
    'performance/other',
  ],
  maintainability: [
    'maintainability/duplication',
    'maintainability/naming',
    'maintainability/documentation',
    'maintainability/complexity',
    'maintainability/magic-number',
    'maintainability/dead-code',
    'maintainability/consistency',
    'maintainability/long-function',
    'maintainability/other',
  ],
  correctness: [
    'correctness/logic-error',
    'correctness/null-handling',
    'correctness/race-condition',
    'correctness/error-handling',
    'correctness/type-mismatch',
    'correctness/edge-case',
    'correctness/comparison',
    'correctness/overflow',
    'correctness/other',
  ],
  all: [], // All categories allowed
};

/**
 * Check if a category is valid for a focus mode
 * INV-REV-001: Validates focus mode isolation
 */
export function isCategoryValidForFocus(category: string, focus: ReviewFocus): boolean {
  if (focus === 'all') {
    return true; // All categories allowed for 'all' focus
  }

  const allowedCategories = FOCUS_MODE_CATEGORIES[focus];

  // Check exact match or prefix match
  return allowedCategories.some(
    (allowed) => category === allowed || category.startsWith(focus + '/')
  );
}
