/**
 * Tests for PySemanticDeadCodeAnalyzer - Python dead code detection
 * @module tests/unit/core/refactor/semantic/py-semantic-analyzer.test.ts
 * @since v12.10.0
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { resolve, join } from 'path';
import { execSync } from 'child_process';
import {
  PySemanticDeadCodeAnalyzer,
  createPySemanticAnalyzer,
} from '@/core/refactor/semantic/py-semantic-analyzer.js';
import type { PyDeadCodeFinding } from '@/core/refactor/semantic/py-types.js';

// Fixture paths
const FIXTURES_DIR = resolve(__dirname, '../../../../fixtures/refactor/python');
const DEAD_CODE_SAMPLE = join(FIXTURES_DIR, 'dead_code_sample.py');
const DECORATORS_SAMPLE = join(FIXTURES_DIR, 'decorators_sample.py');
const DUNDER_METHODS_SAMPLE = join(FIXTURES_DIR, 'dunder_methods_sample.py');
const TYPE_ANNOTATIONS_SAMPLE = join(FIXTURES_DIR, 'type_annotations_sample.py');

// Check if Python is available
function isPythonAvailable(): boolean {
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const PYTHON_AVAILABLE = isPythonAvailable();
const describeIfPython = PYTHON_AVAILABLE ? describe : describe.skip;

describeIfPython('PySemanticDeadCodeAnalyzer', () => {
  let analyzer: PySemanticDeadCodeAnalyzer;

  beforeAll(async () => {
    analyzer = createPySemanticAnalyzer(FIXTURES_DIR, {
      includeExports: true, // Include public symbols (Python has no __all__)
      includePrivate: true,
      minConfidence: 0.5, // Lower threshold for testing
      skipFilePatterns: [], // Don't skip test fixtures
    });
    await analyzer.init();
  });

  afterAll(() => {
    analyzer.dispose();
  });

  describe('Basic dead code detection', () => {
    it('should detect unused imports', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      // Unused imports have reason 'unused_import' from the Python bridge
      const unusedImports = result.findings.filter(
        (f) => f.symbol.kind === 'import' && f.reason === 'unused_import'
      );

      // Should find os and sys as unused
      const importNames = unusedImports.map((f) => f.symbol.name);
      expect(importNames).toContain('os');
      expect(importNames).toContain('sys');

      // json should NOT be flagged (it's used)
      expect(importNames).not.toContain('json');
    });

    it('should detect unused functions', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      const unusedFunctions = result.findings.filter(
        (f) => f.symbol.kind === 'function' && f.reason === 'no_usages'
      );

      const funcNames = unusedFunctions.map((f) => f.symbol.name);
      expect(funcNames).toContain('unused_func');
      expect(funcNames).not.toContain('used_func');
      expect(funcNames).not.toContain('main');
    });

    it('should detect unused classes', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      const unusedClasses = result.findings.filter(
        (f) => f.symbol.kind === 'class' && f.reason === 'no_usages'
      );

      const classNames = unusedClasses.map((f) => f.symbol.name);
      expect(classNames).toContain('UnusedClass');
      expect(classNames).not.toContain('UsedClass');
    });

    it('should detect unused variables', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      const unusedVars = result.findings.filter(
        (f) => f.symbol.kind === 'variable' && f.reason === 'no_usages'
      );

      const varNames = unusedVars.map((f) => f.symbol.name);
      expect(varNames).toContain('UNUSED_CONST');
      expect(varNames).toContain('unused_var');
      expect(varNames).not.toContain('USED_CONST');
      expect(varNames).not.toContain('used_var');
    });
  });

  describe('Decorator awareness', () => {
    it('should NOT flag decorated functions', async () => {
      const result = await analyzer.analyze([DECORATORS_SAMPLE]);

      const funcNames = result.findings
        .filter((f) => f.symbol.kind === 'function' || f.symbol.kind === 'method')
        .map((f) => f.symbol.name);

      // Decorated functions should not be flagged
      expect(funcNames).not.toContain('cached_computation');
      expect(funcNames).not.toContain('value'); // @property
      expect(funcNames).not.toContain('helper'); // @staticmethod
      expect(funcNames).not.toContain('create'); // @classmethod

      // truly_unused should be flagged
      expect(funcNames).toContain('truly_unused');
    });

    it('should NOT flag dataclasses', async () => {
      const result = await analyzer.analyze([DECORATORS_SAMPLE]);

      const classNames = result.findings
        .filter((f) => f.symbol.kind === 'class')
        .map((f) => f.symbol.name);

      expect(classNames).not.toContain('DataPoint');
    });
  });

  describe('Dunder method recognition', () => {
    it('should NOT flag dunder methods', async () => {
      const result = await analyzer.analyze([DUNDER_METHODS_SAMPLE]);

      const methodNames = result.findings
        .filter((f) => f.symbol.kind === 'method')
        .map((f) => f.symbol.name);

      // Dunder methods should not be flagged
      expect(methodNames).not.toContain('__init__');
      expect(methodNames).not.toContain('__str__');
      expect(methodNames).not.toContain('__repr__');
      expect(methodNames).not.toContain('__eq__');
      expect(methodNames).not.toContain('__hash__');
      expect(methodNames).not.toContain('__len__');
      expect(methodNames).not.toContain('__iter__');
      expect(methodNames).not.toContain('__getitem__');
      expect(methodNames).not.toContain('__call__');
      expect(methodNames).not.toContain('__enter__');
      expect(methodNames).not.toContain('__exit__');

      // unused_method should be flagged
      expect(methodNames).toContain('unused_method');
    });
  });

  describe('Confidence scoring', () => {
    it('should assign high confidence to clear cases', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      // Unused imports should have high confidence
      const unusedImport = result.findings.find(
        (f) => f.symbol.name === 'os' && f.symbol.kind === 'import'
      );
      expect(unusedImport?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should penalize methods due to potential inheritance', async () => {
      const result = await analyzer.analyze([DUNDER_METHODS_SAMPLE]);

      const unusedMethod = result.findings.find(
        (f) => f.symbol.name === 'unused_method' && f.symbol.kind === 'method'
      );

      if (unusedMethod) {
        // Methods get a -0.15 penalty, so confidence should be < 0.85
        expect(unusedMethod.confidence).toBeLessThan(0.85);
      }
    });
  });

  describe('Finding properties', () => {
    it('should provide proper explanations', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      const unusedFunc = result.findings.find(
        (f) => f.symbol.name === 'unused_func'
      );

      expect(unusedFunc?.explanation).toContain('unused_func');
      // Python bridge uses "has no external usages" phrasing
      expect(unusedFunc?.explanation).toContain('no external usages');
    });

    it('should assess false positive risk', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      for (const finding of result.findings) {
        expect(['low', 'medium', 'high']).toContain(finding.falsePositiveRisk);
      }
    });

    it('should suggest appropriate actions', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      for (const finding of result.findings) {
        expect(['remove', 'review', 'ignore']).toContain(finding.suggestedAction);
      }
    });
  });

  describe('Analysis result structure', () => {
    it('should return proper result structure', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('totalSymbols');
      expect(result).toHaveProperty('totalUsages');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('filesAnalyzed');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('metrics');

      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.filesAnalyzed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should track total symbols and usages', async () => {
      const result = await analyzer.analyze([DEAD_CODE_SAMPLE]);

      expect(result.totalSymbols).toBeGreaterThan(0);
      expect(result.totalUsages).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await analyzer.analyze(['/nonexistent/file.py']);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.type).toBe('parse_error');
    });

    it('should skip test files by default', async () => {
      // Create analyzer with default skip patterns (which includes test files)
      const testAnalyzer = createPySemanticAnalyzer(FIXTURES_DIR);
      await testAnalyzer.init();

      // Create a mock test file path (test_ prefix)
      const mockTestFile = join(FIXTURES_DIR, 'test_sample.py');
      const result = await testAnalyzer.analyze([mockTestFile]);

      // Should not analyze test files (they're skipped by default pattern)
      // Note: even if file doesn't exist, it's skipped before checking existence
      expect(result.filesAnalyzed).toBe(0);

      testAnalyzer.dispose();
    });
  });

  describe('Factory function', () => {
    it('should create analyzer with custom options', () => {
      const customAnalyzer = createPySemanticAnalyzer(FIXTURES_DIR, {
        includeExports: true,
        includePrivate: false,
        minConfidence: 0.9,
      });

      expect(customAnalyzer).toBeInstanceOf(PySemanticDeadCodeAnalyzer);
      customAnalyzer.dispose();
    });
  });
});

// Skip tests if Python is not available
if (!PYTHON_AVAILABLE) {
  describe('PySemanticDeadCodeAnalyzer (skipped)', () => {
    it.skip('Python not available - tests skipped', () => {});
  });
}
