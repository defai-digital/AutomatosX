/**
 * Conditionals detector tests
 */

import { describe, it, expect } from 'vitest';
import { detectConditionals } from '../../../../src/core/refactor/detectors/conditionals-detector.js';
import type { RefactorIgnoreState } from '../../../../src/core/refactor/types.js';

const emptyIgnoreState: RefactorIgnoreState = {
  ignoreAllLines: new Set(),
  ignoreTypeLines: new Map(),
  ignoreBlocks: []
};

describe('conditionals detector', () => {
  it('detects deeply nested conditionals', () => {
    const content = `
function example(a, b, c, d) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          return true;
        }
      }
    }
  }
}
`.trim();
    const lines = content.split('\n');

    const findings = detectConditionals(
      'src/example.ts',
      content,
      lines,
      emptyIgnoreState,
      {} as any
    );

    const nestedFinding = findings.find(f => f.ruleId === 'deeply-nested-if');
    expect(nestedFinding).toBeDefined();
    expect(nestedFinding?.lineStart).toBe(5); // depth breach happens at deepest if
    expect(nestedFinding?.message).toContain('Deeply nested conditional');
  });

  it('detects unnecessary else after return', () => {
    const content = `
function demo(flag) {
  if (flag) {
    return true;
  } else {
    return false;
  }
}
`.trim();
    const lines = content.split('\n');

    const findings = detectConditionals(
      'src/demo.ts',
      content,
      lines,
      emptyIgnoreState,
      {} as any
    );

    const elseFinding = findings.find(f => f.ruleId === 'else-after-return');
    expect(elseFinding).toBeDefined();
    expect(elseFinding?.context).toContain('else');
  });
});
