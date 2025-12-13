/**
 * PySemanticDeadCodeAnalyzer - Python Dead Code Detection
 *
 * Uses the Python AST bridge directly for dead code detection.
 * The Python bridge handles symbol extraction, usage tracking, and
 * confidence scoring internally.
 *
 * @module core/refactor/semantic/py-semantic-analyzer
 * @since v12.10.0
 */

import { resolve } from 'path';
import { glob } from 'glob';
import { logger } from '../../../shared/logging/logger.js';
import { PyProgramManager, createPyProgramManager } from './py-program-manager.js';
import type {
  PySymbol,
  PySymbolKind,
  PyDeadCodeFinding,
  PyDeadCodeReason,
  PyFalsePositiveRisk,
  PySemanticAnalyzerOptions,
  PySemanticAnalysisResult,
  PySemanticAnalysisError,
  PySemanticQualityMetrics,
  PyBridgeFinding,
} from './py-types.js';
import { createEmptyPyUsageSummary, classifyPyNamespace } from './py-types.js';

/**
 * Dunder methods that are implicitly used by Python runtime
 */
const IMPLICIT_DUNDER_METHODS = new Set([
  '__init__', '__new__', '__del__',
  '__str__', '__repr__', '__bytes__',
  '__hash__', '__eq__', '__ne__', '__lt__', '__le__', '__gt__', '__ge__',
  '__bool__', '__len__', '__iter__', '__next__', '__contains__',
  '__getitem__', '__setitem__', '__delitem__',
  '__call__', '__enter__', '__exit__', '__aenter__', '__aexit__',
  '__add__', '__sub__', '__mul__', '__truediv__', '__floordiv__',
  '__mod__', '__pow__', '__and__', '__or__', '__xor__',
  '__radd__', '__rsub__', '__rmul__', '__rtruediv__',
  '__iadd__', '__isub__', '__imul__', '__itruediv__',
  '__neg__', '__pos__', '__abs__', '__invert__',
  '__int__', '__float__', '__complex__', '__index__',
  '__await__', '__aiter__', '__anext__',
  '__get__', '__set__', '__delete__', '__set_name__',
  '__init_subclass__', '__class_getitem__',
]);

/**
 * Decorators that indicate implicit usage
 */
const IMPLICIT_USAGE_DECORATORS = new Set([
  'property', 'staticmethod', 'classmethod', 'abstractmethod',
  'cached_property', 'lru_cache', 'functools.lru_cache',
  'pytest.fixture', 'fixture',
  'app.route', 'route', 'get', 'post', 'put', 'delete', 'patch',
  'celery.task', 'task',
  'click.command', 'command',
  'dataclass', 'dataclasses.dataclass',
]);

/**
 * PySemanticDeadCodeAnalyzer - Python dead code detection
 *
 * Features:
 * - Direct bridge integration for single-file analysis
 * - Confidence scoring with dynamic pattern penalties
 * - Dunder method recognition
 * - Decorator-aware analysis
 * - File pattern filtering
 */
export class PySemanticDeadCodeAnalyzer {
  private programManager: PyProgramManager;
  private options: Required<PySemanticAnalyzerOptions>;
  private initialized = false;
  private rootDir: string;

  constructor(rootDir: string, options: PySemanticAnalyzerOptions = {}) {
    this.rootDir = resolve(rootDir);
    this.programManager = createPyProgramManager({ rootDir: this.rootDir });
    this.options = {
      includeExports: options.includeExports ?? false,
      includePrivate: options.includePrivate ?? true,
      minConfidence: options.minConfidence ?? 0.7,
      ignorePatterns: options.ignorePatterns ?? [],
      skipFilePatterns: options.skipFilePatterns ?? [
        /test_.*\.py$/,
        /.*_test\.py$/,
        /tests?\/.*\.py$/,
        /conftest\.py$/,
        /__pycache__/,
        /\.pyc$/,
        /setup\.py$/,
      ],
    };
  }

  /**
   * Initialize the analyzer
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.programManager.init();
    this.initialized = true;
    logger.debug('PySemanticDeadCodeAnalyzer initialized', {
      rootDir: this.rootDir,
    });
  }

  /**
   * Analyze Python files for dead code
   * Uses Python bridge directly for analysis
   */
  async analyze(files: string[]): Promise<PySemanticAnalysisResult> {
    if (!this.initialized) {
      await this.init();
    }

    const startTime = Date.now();
    const findings: PyDeadCodeFinding[] = [];
    const errors: PySemanticAnalysisError[] = [];
    let filesAnalyzed = 0;
    let totalSymbols = 0;
    let totalUsages = 0;

    // Filter files
    const filteredFiles = files.filter(f => !this.shouldSkipFile(f));

    // Analyze each file using the Python bridge
    for (const file of filteredFiles) {
      try {
        const absolutePath = resolve(file);
        const result = await this.programManager.analyzeFile(
          absolutePath,
          ['unused_import', 'unused_function', 'unused_class', 'unused_variable'],
          true // Include symbols for metrics
        );

        filesAnalyzed++;

        // Track metrics
        if (result.symbols) {
          totalSymbols += result.symbols.length;
        }
        if (result.usages) {
          for (const usages of Object.values(result.usages)) {
            totalUsages += usages.length;
          }
        }

        // Handle parse errors
        for (const parseError of result.parseErrors) {
          errors.push({
            type: 'parse_error',
            file: absolutePath,
            message: parseError.message,
            recoverable: true,
          });
        }

        // Convert bridge findings to PyDeadCodeFinding
        for (const bridgeFinding of result.findings) {
          const finding = this.convertBridgeFinding(bridgeFinding, absolutePath);
          if (finding) {
            findings.push(finding);
          }
        }
      } catch (error) {
        errors.push({
          type: 'subprocess_error',
          file,
          message: (error as Error).message,
          recoverable: true,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    logger.debug('PySemanticDeadCodeAnalyzer analysis complete', {
      files: filesAnalyzed,
      symbols: totalSymbols,
      findings: findings.length,
      durationMs,
    });

    return {
      findings,
      totalSymbols,
      totalUsages,
      durationMs,
      filesAnalyzed,
      errors,
      metrics: this.calculateMetrics(findings, totalSymbols),
    };
  }

  /**
   * Analyze all Python files in the root directory
   */
  async analyzeDirectory(pattern = '**/*.py'): Promise<PySemanticAnalysisResult> {
    const files = await glob(pattern, {
      cwd: this.rootDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/__pycache__/**', '**/venv/**', '**/.venv/**'],
    });

    return this.analyze(files);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.programManager.dispose();
    this.initialized = false;
    logger.debug('PySemanticDeadCodeAnalyzer disposed');
  }

  /**
   * Convert a Python bridge finding to PyDeadCodeFinding
   */
  private convertBridgeFinding(
    bridgeFinding: PyBridgeFinding,
    filePath: string
  ): PyDeadCodeFinding | null {
    const { metadata } = bridgeFinding;

    // Skip dunder methods
    const isDunder = metadata.symbolName.startsWith('__') && metadata.symbolName.endsWith('__');
    if (isDunder && IMPLICIT_DUNDER_METHODS.has(metadata.symbolName)) {
      return null;
    }

    // Skip exports unless configured
    if (!this.options.includeExports && metadata.isExported) {
      return null;
    }

    // Skip if matches ignore patterns
    if (this.matchesIgnorePattern(metadata.symbolName)) {
      return null;
    }

    // Skip symbols with implicit usage decorators
    if (metadata.decorators.some(d => IMPLICIT_USAGE_DECORATORS.has(d))) {
      return null;
    }

    // Filter by minimum confidence
    const confidence = metadata.confidence;
    if (confidence < this.options.minConfidence) {
      return null;
    }

    // Create symbol
    const kind = this.mapSymbolKind(metadata.symbolKind);
    const symbol: PySymbol = {
      id: `${filePath}:${metadata.symbolName}:${kind}`,
      name: metadata.symbolName,
      kind,
      file: filePath,
      line: bridgeFinding.line,
      column: bridgeFinding.column,
      endLine: bridgeFinding.endLine,
      endColumn: bridgeFinding.endColumn,
      isPrivate: metadata.isPrivate,
      isDunder,
      isExported: metadata.isExported,
      isDynamic: false,
      decorators: metadata.decorators,
      parentClass: undefined,
      namespace: classifyPyNamespace(kind),
    };

    // Map finding type to reason
    const reason = this.mapFindingTypeToReason(bridgeFinding.type);

    // Assess false positive risk
    const falsePositiveRisk = this.assessFalsePositiveRisk(confidence, symbol);
    const safeToAutoFix = confidence >= 0.85 && !symbol.isDynamic && !symbol.isExported;

    return {
      symbol,
      confidence,
      reason,
      usageSummary: createEmptyPyUsageSummary(symbol.id),
      safeToAutoFix,
      suggestedAction: safeToAutoFix ? 'remove' : confidence >= 0.7 ? 'review' : 'ignore',
      falsePositiveRisk,
      explanation: bridgeFinding.message,
      consideredEdgeCases: this.getConsideredEdgeCases(symbol, metadata.decorators),
    };
  }

  /**
   * Map Python bridge symbol kind to PySymbolKind
   */
  private mapSymbolKind(kind: string): PySymbolKind {
    switch (kind) {
      case 'import':
        return 'import';
      case 'function':
        return 'function';
      case 'class':
        return 'class';
      case 'variable':
        return 'variable';
      case 'parameter':
        return 'parameter';
      case 'method':
        return 'method';
      default:
        return 'variable';
    }
  }

  /**
   * Map bridge finding type to PyDeadCodeReason
   */
  private mapFindingTypeToReason(findingType: string): PyDeadCodeReason {
    switch (findingType) {
      case 'unused_import':
        return 'unused_import';
      case 'unused_function':
      case 'unused_class':
      case 'unused_variable':
        return 'no_usages';
      case 'type_only_import':
        return 'type_only_usage';
      case 'unused_parameter':
        return 'unused_parameter';
      default:
        return 'no_usages';
    }
  }

  /**
   * Check if symbol name matches ignore patterns
   */
  private matchesIgnorePattern(name: string): boolean {
    return this.options.ignorePatterns.some(p => p.test(name));
  }

  /**
   * Check if file should be skipped
   */
  private shouldSkipFile(filePath: string): boolean {
    return this.options.skipFilePatterns.some(p => p.test(filePath));
  }

  /**
   * Assess false positive risk level
   */
  private assessFalsePositiveRisk(
    confidence: number,
    symbol: PySymbol
  ): PyFalsePositiveRisk {
    if (confidence >= 0.85 && !symbol.isDynamic) {
      return 'low';
    }
    if (confidence >= 0.7) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Get list of edge cases that were considered
   */
  private getConsideredEdgeCases(symbol: PySymbol, decorators: string[]): string[] {
    const cases: string[] = [];

    if (symbol.isDynamic) {
      cases.push('dynamic_attribute_access');
    }

    if (decorators.length > 0) {
      cases.push(`decorators: ${decorators.join(', ')}`);
    }

    if (symbol.isDunder) {
      cases.push('dunder_method');
    }

    if (symbol.isPrivate) {
      cases.push('private_symbol');
    }

    if (symbol.kind === 'method' && symbol.parentClass) {
      cases.push('class_method');
    }

    if (symbol.isExported) {
      cases.push('exported_symbol');
    }

    return cases;
  }

  /**
   * Calculate quality metrics (placeholder - requires ground truth)
   */
  private calculateMetrics(
    findings: PyDeadCodeFinding[],
    totalSymbols: number
  ): PySemanticQualityMetrics {
    // These would require ground truth data to calculate accurately
    // For now, return placeholder values
    return {
      precision: 0,
      recall: 0,
      f1Score: 0,
      falsePositiveRate: 0,
      calibrationScore: 0,
    };
  }
}

/**
 * Create a PySemanticDeadCodeAnalyzer instance
 */
export function createPySemanticAnalyzer(
  rootDir: string,
  options?: PySemanticAnalyzerOptions
): PySemanticDeadCodeAnalyzer {
  return new PySemanticDeadCodeAnalyzer(rootDir, options);
}
