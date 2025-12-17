/**
 * Change Radius Gate
 *
 * Checks that the number of modified packages does not exceed the limit.
 * Only counts top-level package directories under `packages/`.
 *
 * Invariants:
 * - INV-GUARD-RAD-001: Package Counting - only top-level package directories counted
 * - INV-GUARD-RAD-002: Limit Enforcement - if count > limit, gate MUST FAIL
 * - INV-GUARD-RAD-003: Root Changes - changes outside packages/ don't count toward radius
 */

import type { GovernanceContext, GateResult } from '../types.js';

/**
 * Extracts the package name from a file path
 * INV-GUARD-RAD-001: Only top-level package directories
 * INV-GUARD-RAD-003: Returns undefined if file is not under packages/
 */
function extractPackageName(filePath: string): string | undefined {
  // Match packages/<name>/... or packages/<category>/<name>/...
  const match = /^packages\/([^/]+)(?:\/([^/]+))?/.exec(filePath);

  if (match === null) {
    return undefined;
  }

  // Handle nested packages like packages/core/workflow-engine
  const first = match[1];
  const second = match[2];

  // Known categories that contain sub-packages
  const categories = ['core', 'adapters'];

  if (first !== undefined && categories.includes(first) && second !== undefined) {
    return `${first}/${second}`;
  }

  return first;
}

/**
 * Executes the change radius gate
 * INV-GUARD-RAD-002: If count exceeds limit, gate MUST FAIL
 */
export function changeRadiusGate(
  context: GovernanceContext,
  changedFiles: string[]
): Promise<GateResult> {
  const packages = new Set<string>();

  for (const file of changedFiles) {
    const packageName = extractPackageName(file);
    if (packageName !== undefined) {
      packages.add(packageName);
    }
  }

  const count = packages.size;
  const limit = context.changeRadiusLimit;

  if (count <= limit) {
    return Promise.resolve({
      gate: 'change_radius',
      status: 'PASS',
      message: `Change radius: ${String(count)} package(s) (limit: ${String(limit)})`,
      details: {
        packages: Array.from(packages),
        count,
        limit,
      },
    } as const);
  }

  return Promise.resolve({
    gate: 'change_radius',
    status: 'FAIL',
    message: `Change radius exceeded: ${String(count)} packages (limit: ${String(limit)})`,
    details: {
      packages: Array.from(packages),
      count,
      limit,
    },
  } as const);
}
