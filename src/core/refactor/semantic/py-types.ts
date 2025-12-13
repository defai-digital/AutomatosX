/**
 * Type definitions for Python Semantic Analysis
 *
 * Mirrors the TypeScript semantic analyzer architecture for Python codebases.
 * Uses Python AST bridge for symbol extraction and usage tracking.
 *
 * @module core/refactor/semantic/py-types
 * @since v12.10.0
 */

// ============================================================================
// Symbol Types
// ============================================================================

/**
 * Python symbol kinds
 */
export type PySymbolKind =
  | 'import'
  | 'function'
  | 'class'
  | 'variable'
  | 'parameter'
  | 'method';

/**
 * Namespace classification for Python symbols
 * - 'value': Runtime value (function, variable, instance)
 * - 'type': Type-only (used in type annotations)
 * - 'both': Can be used as both (class)
 */
export type PySymbolNamespace = 'value' | 'type' | 'both';

/**
 * Information about a Python symbol
 */
export interface PySymbol {
  /** Unique identifier (file:name:kind) */
  id: string;
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: PySymbolKind;
  /** File path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** End line number */
  endLine?: number;
  /** End column number */
  endColumn?: number;
  /** Whether the symbol is private (starts with _) */
  isPrivate: boolean;
  /** Whether the symbol is a dunder (__name__) */
  isDunder: boolean;
  /** Whether the symbol is exported (in __all__ or public) */
  isExported: boolean;
  /** Whether dynamic patterns affect this symbol */
  isDynamic: boolean;
  /** Applied decorators */
  decorators: string[];
  /** Parent class name (for methods) */
  parentClass?: string;
  /** Namespace classification */
  namespace: PySymbolNamespace;
}

// ============================================================================
// Usage Types
// ============================================================================

/**
 * Context type for a Python symbol usage
 */
export type PyUsageContextType =
  | 'value'           // Runtime usage: x.foo(), x()
  | 'type'            // Type annotation: x: Type
  | 'decorator'       // @decorator
  | 'attribute'       // obj.attr access
  | 'import'          // Import statement
  | 'unknown';

/**
 * A single usage of a Python symbol
 */
export interface PyUsage {
  /** File containing the usage */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** Type of usage context */
  contextType: PyUsageContextType;
  /** Whether this usage is runtime-relevant */
  isRuntimeRelevant: boolean;
  /** Whether this is a self-reference (same line as definition) */
  isSelfReference: boolean;
}

/**
 * Summary of all usages for a Python symbol
 */
export interface PyUsageSummary {
  /** Symbol ID */
  symbolId: string;
  /** Total number of usages */
  totalUsages: number;
  /** Number of value (runtime) usages */
  valueUsages: number;
  /** Number of type annotation usages */
  typeUsages: number;
  /** Number of decorator usages */
  decoratorUsages: number;
  /** Number of import usages */
  importUsages: number;
  /** Whether the symbol has any runtime usage */
  hasRuntimeUsage: boolean;
  /** Whether the symbol is only used in type positions */
  isTypeOnlyUsed: boolean;
  /** Whether dynamic access patterns may affect this symbol */
  dynamicAccessPossible: boolean;
  /** All usage locations */
  usageLocations: PyUsage[];
}

// ============================================================================
// Dead Code Types
// ============================================================================

/**
 * Reason a Python symbol is considered dead code
 */
export type PyDeadCodeReason =
  | 'no_usages'              // Symbol has no usages
  | 'type_only_usage'        // Only used in type annotations
  | 'self_reference_only'    // Only used in its own definition
  | 'unused_import'          // Imported but never used
  | 'unused_parameter';      // Parameter never used

/**
 * False positive risk level
 */
export type PyFalsePositiveRisk = 'low' | 'medium' | 'high';

/**
 * A Python dead code finding
 */
export interface PyDeadCodeFinding {
  /** The symbol that appears to be dead */
  symbol: PySymbol;
  /** Confidence score (0.0-1.0) */
  confidence: number;
  /** Why this is considered dead code */
  reason: PyDeadCodeReason;
  /** Usage summary for context */
  usageSummary: PyUsageSummary;
  /** Whether it's safe to auto-fix (remove) */
  safeToAutoFix: boolean;
  /** Suggested action */
  suggestedAction: 'remove' | 'review' | 'ignore';
  /** Risk of false positive */
  falsePositiveRisk: PyFalsePositiveRisk;
  /** Explanation for the finding */
  explanation: string;
  /** Edge cases that were considered */
  consideredEdgeCases: string[];
}

// ============================================================================
// Dynamic Pattern Types
// ============================================================================

/**
 * A detected dynamic pattern that reduces confidence
 */
export interface PyDynamicPattern {
  /** Pattern type (getattr, __dict__, etc.) */
  pattern: string;
  /** Line number where detected */
  line: number;
  /** Confidence penalty (0.0-1.0) */
  confidencePenalty: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for PyProgramManager
 */
export interface PyProgramManagerOptions {
  /** Root directory for the project */
  rootDir: string;
  /** Path to Python executable */
  pythonPath?: string;
  /** Path to pyrightconfig.json or pyproject.toml */
  configPath?: string;
  /** Maximum age of cached analysis in milliseconds */
  maxCacheAgeMs?: number;
  /** Subprocess timeout in milliseconds */
  subprocessTimeoutMs?: number;
}

/**
 * Options for PySymbolIndex
 */
export interface PySymbolIndexOptions {
  /** Include private symbols (starting with _) */
  includePrivate?: boolean;
  /** Include __all__ exports only */
  exportsOnly?: boolean;
  /** Maximum symbols to index */
  maxSymbols?: number;
}

/**
 * Options for PyUsageTracker
 */
export interface PyUsageTrackerOptions {
  /** Track type annotation usages */
  trackTypeAnnotations?: boolean;
  /** Track decorator usages */
  trackDecorators?: boolean;
  /** Maximum usages per symbol */
  maxUsagesPerSymbol?: number;
}

/**
 * Options for PySemanticDeadCodeAnalyzer
 */
export interface PySemanticAnalyzerOptions {
  /** Include exported symbols in analysis */
  includeExports?: boolean;
  /** Include private symbols in analysis */
  includePrivate?: boolean;
  /** Minimum confidence to report (default: 0.7) */
  minConfidence?: number;
  /** Custom patterns to ignore */
  ignorePatterns?: RegExp[];
  /** File patterns to skip */
  skipFilePatterns?: RegExp[];
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result from Python AST bridge analysis
 */
export interface PyBridgeResult {
  /** Findings from analysis */
  findings: PyBridgeFinding[];
  /** Extracted symbols (if requested) */
  symbols?: PyBridgeSymbol[];
  /** Collected usages (if requested) */
  usages?: Record<string, PyBridgeUsage[]>;
  /** Detected dynamic patterns */
  dynamicPatterns?: PyDynamicPattern[];
  /** Parse errors */
  parseErrors: PyBridgeParseError[];
  /** Python version used */
  pythonVersion: string;
}

/**
 * Raw finding from Python bridge
 */
export interface PyBridgeFinding {
  type: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  context: string;
  metadata: {
    symbolName: string;
    symbolKind: string;
    confidence: number;
    isPrivate: boolean;
    isExported: boolean;
    decorators: string[];
  };
}

/**
 * Raw symbol from Python bridge
 */
export interface PyBridgeSymbol {
  name: string;
  kind: string;
  line: number;
  column: number;
  isPrivate: boolean;
  isDunder: boolean;
  isExported: boolean;
  decorators: string[];
  parentClass?: string;
}

/**
 * Raw usage from Python bridge
 */
export interface PyBridgeUsage {
  line: number;
  column: number;
  context: string;
  isSelfReference: boolean;
}

/**
 * Parse error from Python bridge
 */
export interface PyBridgeParseError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Result of Python semantic analysis
 */
export interface PySemanticAnalysisResult {
  /** All dead code findings */
  findings: PyDeadCodeFinding[];
  /** Total symbols analyzed */
  totalSymbols: number;
  /** Total usages tracked */
  totalUsages: number;
  /** Analysis duration in milliseconds */
  durationMs: number;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Errors encountered (non-fatal) */
  errors: PySemanticAnalysisError[];
  /** Quality metrics */
  metrics: PySemanticQualityMetrics;
}

/**
 * Non-fatal error during Python analysis
 */
export interface PySemanticAnalysisError {
  /** Error type */
  type: 'parse_error' | 'subprocess_error' | 'timeout' | 'unknown';
  /** File where error occurred */
  file?: string;
  /** Error message */
  message: string;
  /** Whether analysis continued after this error */
  recoverable: boolean;
}

/**
 * Quality metrics for Python semantic analyzer
 */
export interface PySemanticQualityMetrics {
  /** Precision: TP / (TP + FP) */
  precision: number;
  /** Recall: TP / (TP + FN) */
  recall: number;
  /** F1 Score: 2 * (P * R) / (P + R) */
  f1Score: number;
  /** False positive rate: FP / (FP + TN) */
  falsePositiveRate: number;
  /** Confidence calibration score */
  calibrationScore: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty Python usage summary
 */
export function createEmptyPyUsageSummary(symbolId: string): PyUsageSummary {
  return {
    symbolId,
    totalUsages: 0,
    valueUsages: 0,
    typeUsages: 0,
    decoratorUsages: 0,
    importUsages: 0,
    hasRuntimeUsage: false,
    isTypeOnlyUsed: false,
    dynamicAccessPossible: false,
    usageLocations: [],
  };
}

/**
 * Classify Python symbol namespace based on kind
 */
export function classifyPyNamespace(kind: PySymbolKind): PySymbolNamespace {
  switch (kind) {
    case 'class':
      return 'both'; // Classes are both types and values in Python
    case 'function':
    case 'variable':
    case 'import':
    case 'parameter':
    case 'method':
      return 'value';
    default:
      return 'value';
  }
}
