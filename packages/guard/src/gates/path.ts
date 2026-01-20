/**
 * Path Violation Gate
 *
 * Checks that modified files are within allowed paths and not in forbidden paths.
 * Forbidden paths take precedence (deny wins).
 *
 * Invariants:
 * - INV-GUARD-PATH-001: Exact Match - modified files checked against exact resolved paths
 * - INV-GUARD-PATH-002: Glob Semantics - ** for recursive, * for single level
 * - INV-GUARD-PATH-003: Forbidden Wins - if path matches both allowed and forbidden, treat as forbidden
 * - INV-GUARD-PATH-005: ReDoS Protection - limit recursive wildcards and pattern length
 */

import type { GovernanceContext, GateResult } from '../types.js';

/**
 * Maximum number of ** wildcards allowed in a pattern
 * INV-GUARD-PATH-005: Prevents ReDoS from overlapping quantifiers
 */
const MAX_GLOBSTAR_COUNT = 3;

/**
 * Maximum pattern length to prevent abuse
 * INV-GUARD-PATH-005: Prevents excessively long patterns
 */
const MAX_PATTERN_LENGTH = 500;

/**
 * Validates a glob pattern for ReDoS safety
 * INV-GUARD-PATH-005: Rejects patterns that could cause catastrophic backtracking
 * @throws Error if pattern is unsafe
 */
function validateGlobPattern(pattern: string): void {
  // Check pattern length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(
      `Glob pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`
    );
  }

  // Count ** occurrences to prevent overlapping quantifiers
  const globstarCount = (pattern.match(/\*\*/g) ?? []).length;
  if (globstarCount > MAX_GLOBSTAR_COUNT) {
    throw new Error(
      `Glob pattern contains ${globstarCount} recursive wildcards (**), maximum is ${MAX_GLOBSTAR_COUNT}`
    );
  }
}

/**
 * Converts a glob pattern to a regex
 * INV-GUARD-PATH-002: ** for recursive, * for single level
 * INV-GUARD-PATH-004: Escape all regex special chars including ?
 * INV-GUARD-PATH-005: Validates pattern safety before conversion
 */
function globToRegex(pattern: string): RegExp {
  // Validate pattern for ReDoS safety
  validateGlobPattern(pattern);

  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars (including ?)
    .replace(/\*\*/g, '{{GLOBSTAR}}') // Temp placeholder for **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\{\{GLOBSTAR\}\}/g, '.*'); // ** matches anything including /

  return new RegExp(`^${escaped}$`);
}

/**
 * Checks if a file path matches any of the given glob patterns
 */
function matchesAnyPattern(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(filePath);
  });
}

/**
 * Executes the path violation gate
 * INV-GUARD-PATH-001: Exact Match against resolved paths
 * INV-GUARD-PATH-003: Forbidden Wins (check forbidden first)
 */
export function pathViolationGate(
  context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> {
  const violations: string[] = [];
  const notAllowed: string[] = [];

  for (const file of changedFiles) {
    // Check forbidden paths first (deny wins)
    if (matchesAnyPattern(file, context.forbiddenPaths)) {
      violations.push(file);
      continue;
    }

    // Check if file is in allowed paths
    if (
      context.allowedPaths.length > 0 &&
      !matchesAnyPattern(file, context.allowedPaths)
    ) {
      notAllowed.push(file);
    }
  }

  const allViolations = [...violations, ...notAllowed];

  if (allViolations.length === 0) {
    return Promise.resolve({
      gate: 'path_violation',
      status: 'PASS',
      message: `All ${String(changedFiles.length)} modified files are within allowed paths`,
    });
  }

  const details: Record<string, unknown> = {};
  if (violations.length > 0) {
    details.forbiddenPathViolations = violations;
  }
  if (notAllowed.length > 0) {
    details.outsideAllowedPaths = notAllowed;
  }

  return Promise.resolve({
    gate: 'path_violation',
    status: 'FAIL',
    message: `${String(allViolations.length)} file(s) violate path restrictions`,
    details,
  });
}
