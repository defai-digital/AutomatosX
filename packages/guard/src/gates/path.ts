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
 */

import type { GovernanceContext, GateResult } from '../types.js';

/**
 * Converts a glob pattern to a regex
 * INV-GUARD-PATH-002: ** for recursive, * for single level
 * INV-GUARD-PATH-004: Escape all regex special chars including ?
 */
function globToRegex(pattern: string): RegExp {
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
