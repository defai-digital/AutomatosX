/**
 * Type definitions for Semantic Analysis (PRD-019)
 *
 * TypeScript Language Service integration for high-precision dead code detection.
 * Target: < 3% false positive rate through proper symbol resolution and usage context analysis.
 *
 * @module core/refactor/semantic/types
 * @since v12.9.0
 */

// ============================================================================
// Symbol Analysis Types
// ============================================================================

/**
 * Namespace classification for symbols
 * - 'value': Runtime value (variable, function, enum member)
 * - 'type': Type-only (interface, type alias, type parameter)
 * - 'both': Can be used as both (class, enum, namespace)
 */
export type SymbolNamespace = 'value' | 'type' | 'both';

/**
 * Symbol kinds supported by the analyzer
 */
export type SymbolKind =
  | 'variable'
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'enum_member'
  | 'namespace'
  | 'module'
  | 'parameter'
  | 'property'
  | 'method'
  | 'getter'
  | 'setter'
  | 'constructor'
  | 'index_signature'
  | 'call_signature'
  | 'unknown';

/**
 * Information about a symbol declaration
 */
export interface DeclarationInfo {
  /** File path containing the declaration */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** TypeScript syntax kind */
  syntaxKind: number;
  /** Whether this is a type-only declaration (import type, export type) */
  isTypeOnly: boolean;
  /** Whether this is an ambient declaration (.d.ts, declare) */
  isAmbient: boolean;
  /** The declaration text (truncated for large declarations) */
  text: string;
}

/**
 * A symbol entry in the symbol index
 */
export interface SymbolEntry {
  /** Unique identifier (file:name:kind) */
  id: string;
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** TypeScript SymbolFlags bitmask */
  flags: number;
  /** All declarations of this symbol */
  declarations: DeclarationInfo[];
  /** Whether the symbol is exported */
  isExported: boolean;
  /** Whether the symbol is ambient (declare, .d.ts) */
  isAmbient: boolean;
  /** Namespace classification */
  namespace: SymbolNamespace;
  /** Primary file (first declaration) */
  file: string;
  /** Primary line (first declaration) */
  line: number;
  /** Parent symbol ID (for nested symbols) */
  parentId?: string;
  /** Whether this is a re-export from another module */
  isReExport: boolean;
  /** Original module if re-exported */
  originalModule?: string;
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

/**
 * Context type for a symbol usage
 */
export type UsageContextType =
  | 'value'           // Runtime usage: x.foo(), new X(), x = y
  | 'type'            // Type annotation: x: Type, as Type
  | 'typeof'          // typeof X
  | 'jsdoc'           // @param {Type}, @returns {Type}
  | 'generic'         // <T extends Type>
  | 'decorator'       // @Decorator
  | 'extends'         // class X extends Y (value context for class)
  | 'implements'      // class X implements Y (type context)
  | 'import'          // import { X }
  | 'import_type'     // import type { X }
  | 'export'          // export { X }
  | 'export_type'     // export type { X }
  | 'unknown';

/**
 * A single usage of a symbol
 */
export interface UsageContext {
  /** File containing the usage */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** Type of usage context */
  contextType: UsageContextType;
  /** Whether this usage is runtime-relevant (affects emitted JS) */
  isRuntimeRelevant: boolean;
  /** Description of the enclosing node for debugging */
  enclosingNode: string;
  /** The usage text (truncated) */
  text: string;
}

/**
 * Summary of all usages for a symbol
 */
export interface SymbolUsageSummary {
  /** Symbol ID */
  symbolId: string;
  /** Total number of usages */
  totalUsages: number;
  /** Number of value (runtime) usages */
  valueUsages: number;
  /** Number of type-only usages */
  typeUsages: number;
  /** Number of JSDoc usages */
  jsDocUsages: number;
  /** Number of import usages */
  importUsages: number;
  /** Number of export usages */
  exportUsages: number;
  /** Whether the symbol has any runtime usage */
  hasRuntimeUsage: boolean;
  /** Whether the symbol is only used in type positions */
  isTypeOnlyUsed: boolean;
  /** All usage locations */
  usageLocations: UsageContext[];
}

// ============================================================================
// Dead Code Analysis Types
// ============================================================================

/**
 * Reason a symbol is considered dead code
 */
export type DeadCodeReason =
  | 'no_usages'                  // Symbol has no usages at all
  | 'type_only_usage'            // Only used in type positions (not runtime)
  | 'jsdoc_only_usage'           // Only referenced in JSDoc comments
  | 'self_reference_only'        // Only used in its own declaration
  | 'unreachable_export'         // Exported but never imported anywhere
  | 'circular_only_usage'        // Only used in a circular reference chain
  | 'unused_parameter'           // Function parameter never used
  | 'unused_import';             // Imported but never used

/**
 * False positive risk level
 */
export type FalsePositiveRisk = 'low' | 'medium' | 'high';

/**
 * A semantic dead code finding
 */
export interface SemanticDeadCodeFinding {
  /** The symbol that appears to be dead */
  symbol: SymbolEntry;
  /** Confidence score (0.0-1.0) */
  confidence: number;
  /** Why this is considered dead code */
  reason: DeadCodeReason;
  /** Usage summary for context */
  usageSummary: SymbolUsageSummary;
  /** Whether it's safe to auto-fix (remove) */
  safeToAutoFix: boolean;
  /** Suggested action */
  suggestedAction: 'remove' | 'review' | 'ignore';
  /** Risk of false positive */
  falsePositiveRisk: FalsePositiveRisk;
  /** Explanation for the finding */
  explanation: string;
  /** Edge cases that were considered */
  consideredEdgeCases: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for TSProgramManager
 */
export interface TSProgramManagerOptions {
  /** Root directory for the project */
  rootDir: string;
  /** Path to tsconfig.json (auto-detected if not provided) */
  configPath?: string;
  /** Maximum age of cached program in milliseconds (default: 60000) */
  maxProgramAgeMs?: number;
  /** Enable incremental compilation (default: true) */
  enableIncrementalMode?: boolean;
  /** Maximum number of programs to cache (default: 3) */
  maxCachedPrograms?: number;
  /** Files to include (overrides tsconfig if provided) */
  includeFiles?: string[];
  /** Files to exclude (added to tsconfig excludes) */
  excludeFiles?: string[];
}

/**
 * Options for SymbolIndex
 */
export interface SymbolIndexOptions {
  /** Include ambient declarations (.d.ts, declare) */
  includeAmbient?: boolean;
  /** Include node_modules symbols */
  includeNodeModules?: boolean;
  /** Maximum symbols to index (default: 100000) */
  maxSymbols?: number;
}

/**
 * Options for UsageTracker
 */
export interface UsageTrackerOptions {
  /** Track JSDoc type references */
  trackJsDoc?: boolean;
  /** Track generic type parameters */
  trackGenerics?: boolean;
  /** Track decorator usages */
  trackDecorators?: boolean;
  /** Maximum usages to track per symbol (default: 1000) */
  maxUsagesPerSymbol?: number;
}

/**
 * Options for SemanticDeadCodeAnalyzer
 */
export interface SemanticAnalyzerOptions {
  /** Include exported symbols in analysis */
  includeExports?: boolean;
  /** Include type-only symbols (interfaces, type aliases) */
  includeTypeOnly?: boolean;
  /** Minimum confidence to report (default: 0.7) */
  minConfidence?: number;
  /** Respect existing allowlists from bugfix module */
  respectAllowlists?: boolean;
  /** Custom patterns to ignore */
  ignorePatterns?: RegExp[];
  /** File patterns to skip */
  skipFilePatterns?: RegExp[];
}

/**
 * Combined semantic analysis configuration
 */
export interface SemanticAnalysisConfig {
  program: TSProgramManagerOptions;
  symbolIndex: SymbolIndexOptions;
  usageTracker: UsageTrackerOptions;
  analyzer: SemanticAnalyzerOptions;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of semantic analysis
 */
export interface SemanticAnalysisResult {
  /** All dead code findings */
  findings: SemanticDeadCodeFinding[];
  /** Total symbols analyzed */
  totalSymbols: number;
  /** Total usages tracked */
  totalUsages: number;
  /** Analysis duration in milliseconds */
  durationMs: number;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Errors encountered (non-fatal) */
  errors: SemanticAnalysisError[];
  /** Quality metrics */
  metrics: SemanticQualityMetrics;
}

/**
 * Non-fatal error during analysis
 */
export interface SemanticAnalysisError {
  /** Error type */
  type: 'parse_error' | 'type_error' | 'timeout' | 'unknown';
  /** File where error occurred */
  file?: string;
  /** Error message */
  message: string;
  /** Whether analysis continued after this error */
  recoverable: boolean;
}

// ============================================================================
// Quality Metrics Types
// ============================================================================

/**
 * Quality metrics for the semantic analyzer
 */
export interface SemanticQualityMetrics {
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

/**
 * Detection metrics for a specific rule
 */
export interface RuleDetectionMetrics {
  /** Rule identifier */
  ruleId: string;
  /** True positives (correctly identified dead code) */
  truePositives: number;
  /** False positives (incorrectly flagged as dead) */
  falsePositives: number;
  /** True negatives (correctly identified as used) */
  trueNegatives: number;
  /** False negatives (missed dead code) */
  falseNegatives: number;
  /** Precision for this rule */
  precision: number;
  /** Recall for this rule */
  recall: number;
  /** F1 score for this rule */
  f1Score: number;
}

/**
 * Full quality report
 */
export interface QualityReport {
  /** Report generation timestamp */
  timestamp: string;
  /** AutomatosX version */
  version: string;
  /** Overall precision */
  overallPrecision: number;
  /** Overall recall */
  overallRecall: number;
  /** Overall F1 score */
  overallF1: number;
  /** Overall false positive rate */
  overallFalsePositiveRate: number;
  /** Metrics by detection rule */
  byRule: RuleDetectionMetrics[];
  /** Metrics by dead code reason */
  byReason: Map<DeadCodeReason, RuleDetectionMetrics>;
  /** Whether the 3% FPR threshold was met */
  meetsThreshold: boolean;
  /** Recommendations for improvement */
  recommendations: string[];
}

// ============================================================================
// Edge Case Types
// ============================================================================

/**
 * Known edge cases that can cause false positives
 */
export type EdgeCaseType =
  | 'side_effect_import'         // import './polyfill'
  | 'dynamic_import'             // import(path)
  | 'decorator_metadata'         // @Injectable()
  | 'reflection'                 // Object.keys(X)
  | 'module_augmentation'        // declare module
  | 'global_augmentation'        // declare global
  | 'barrel_reexport'            // export * from
  | 'react_jsx'                  // <Component />
  | 'conditional_export'         // exports.x = ...
  | 'eval_usage'                 // eval('X')
  | 'string_reference'           // 'ClassName' in strings
  | 'webpack_magic_comment'      // /* webpackChunkName */
  | 'test_mock';                 // jest.mock()

/**
 * Edge case detection result
 */
export interface EdgeCaseDetection {
  /** Type of edge case */
  type: EdgeCaseType;
  /** File where detected */
  file: string;
  /** Line number */
  line: number;
  /** Affected symbol (if known) */
  affectedSymbol?: string;
  /** Confidence that this is a real edge case */
  confidence: number;
  /** Recommendation */
  recommendation: 'skip' | 'reduce_confidence' | 'flag_for_review';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default semantic analysis configuration
 */
export function createDefaultSemanticConfig(
  rootDir: string,
  overrides?: Partial<SemanticAnalysisConfig>
): SemanticAnalysisConfig {
  return {
    program: {
      rootDir,
      maxProgramAgeMs: 60000,
      enableIncrementalMode: true,
      maxCachedPrograms: 3,
      ...overrides?.program,
    },
    symbolIndex: {
      includeAmbient: false,
      includeNodeModules: false,
      maxSymbols: 100000,
      ...overrides?.symbolIndex,
    },
    usageTracker: {
      trackJsDoc: true,
      trackGenerics: true,
      trackDecorators: true,
      maxUsagesPerSymbol: 1000,
      ...overrides?.usageTracker,
    },
    analyzer: {
      includeExports: false,
      includeTypeOnly: false,
      minConfidence: 0.7,
      respectAllowlists: true,
      ignorePatterns: [],
      skipFilePatterns: [
        /\.test\.[tj]sx?$/,
        /\.spec\.[tj]sx?$/,
        /\.d\.ts$/,
      ],
      ...overrides?.analyzer,
    },
  };
}

/**
 * Create an empty usage summary
 */
export function createEmptyUsageSummary(symbolId: string): SymbolUsageSummary {
  return {
    symbolId,
    totalUsages: 0,
    valueUsages: 0,
    typeUsages: 0,
    jsDocUsages: 0,
    importUsages: 0,
    exportUsages: 0,
    hasRuntimeUsage: false,
    isTypeOnlyUsed: false,
    usageLocations: [],
  };
}
