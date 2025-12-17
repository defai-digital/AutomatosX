/**
 * Dependency Gate
 *
 * Checks for dependency boundary violations using dependency-cruiser.
 * Uses the project's existing .dependency-cruiser.cjs configuration.
 *
 * Invariants:
 * - INV-GUARD-DEP-001: Boundary Enforcement - cross-layer imports detected via dependency-cruiser
 * - INV-GUARD-DEP-002: Existing Rules - use project's .dependency-cruiser.cjs configuration
 * - INV-GUARD-DEP-003: New Violations Only - only report violations in changed files
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { GovernanceContext, GateResult } from '../types.js';

const execAsync = promisify(exec);

/**
 * Runs dependency-cruiser and returns any violations
 */
async function runDependencyCruiser(
  files: string[]
): Promise<{ violations: string[]; error?: string }> {
  if (files.length === 0) {
    return { violations: [] };
  }

  try {
    // Run dependency-cruiser on specific files
    // Use --output-type err to get just violations
    const { stdout, stderr } = await execAsync(
      `npx dependency-cruiser ${files.join(' ')} --config .dependency-cruiser.cjs --output-type err 2>&1`,
      { cwd: process.cwd(), timeout: 60000 }
    );

    // If there's output, there are violations
    const output = (stdout + stderr).trim();
    if (output.length === 0) {
      return { violations: [] };
    }

    // Parse violations from output
    const violations = output
      .split('\n')
      .filter((line) => line.trim().length > 0);

    return { violations };
  } catch (error) {
    // Exit code 1 means violations found
    if (error instanceof Error && 'stdout' in error) {
      const stdout = (error as { stdout: string }).stdout || '';
      const violations = stdout
        .split('\n')
        .filter((line: string) => line.trim().length > 0);

      if (violations.length > 0) {
        return { violations };
      }
    }

    // Other errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { violations: [], error: message };
  }
}

/**
 * Filters files to only include TypeScript/JavaScript source files
 */
function filterSourceFiles(files: string[]): string[] {
  return files.filter(
    (f) =>
      (f.endsWith('.ts') || f.endsWith('.js')) &&
      !f.endsWith('.test.ts') &&
      !f.endsWith('.spec.ts') &&
      !f.includes('/dist/') &&
      f.startsWith('packages/')
  );
}

/**
 * Executes the dependency gate
 * INV-GUARD-DEP-001: Boundary Enforcement via dependency-cruiser
 * INV-GUARD-DEP-002: Uses project's .dependency-cruiser.cjs
 * INV-GUARD-DEP-003: Only checks changed source files
 */
export async function dependencyGate(
  _context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> {
  const sourceFiles = filterSourceFiles(changedFiles);

  if (sourceFiles.length === 0) {
    return {
      gate: 'dependency',
      status: 'PASS',
      message: 'No source files to check for dependency violations',
    };
  }

  const result = await runDependencyCruiser(sourceFiles);

  if (result.error !== undefined) {
    return {
      gate: 'dependency',
      status: 'WARN',
      message: `Dependency check could not complete: ${result.error}`,
      details: { error: result.error },
    };
  }

  if (result.violations.length === 0) {
    return {
      gate: 'dependency',
      status: 'PASS',
      message: `No dependency violations in ${String(sourceFiles.length)} file(s)`,
    };
  }

  return {
    gate: 'dependency',
    status: 'FAIL',
    message: `${String(result.violations.length)} dependency violation(s) found`,
    details: {
      violations: result.violations,
      filesChecked: sourceFiles,
    },
  };
}
