/**
 * Semantic Analysis Module - PRD-019
 *
 * TypeScript and Python Language Service integration for high-precision dead code detection.
 * Target: < 3% false positive rate through proper symbol resolution and usage context analysis.
 *
 * Components:
 * - TSProgramManager: Shared TypeScript program with type checker access
 * - SymbolIndex: Symbol resolution with namespace classification
 * - UsageTracker: Usage context analysis (value vs type position)
 * - SemanticDeadCodeAnalyzer: High-precision dead code detection
 *
 * Python Components (v12.10.0):
 * - PyProgramManager: Python AST bridge subprocess management
 * - PySymbolIndex: Python symbol indexing
 * - PyUsageTracker: Python usage tracking
 * - PySemanticDeadCodeAnalyzer: Python dead code detection
 *
 * @module core/refactor/semantic
 * @since v12.9.0
 */

// TypeScript Types
export * from './types.js';

// TypeScript Core components
export { TSProgramManager, createTSProgramManager } from './ts-program-manager.js';
export { SymbolIndex, createSymbolIndex } from './symbol-index.js';
export { UsageTracker, createUsageTracker } from './usage-tracker.js';
export {
  SemanticDeadCodeAnalyzer,
  createSemanticAnalyzer,
} from './semantic-analyzer.js';

// Python Types (v12.10.0)
export * from './py-types.js';

// Python Core components (v12.10.0)
export { PyProgramManager, createPyProgramManager } from './py-program-manager.js';
export { PySymbolIndex, createPySymbolIndex } from './py-symbol-index.js';
export { PyUsageTracker, createPyUsageTracker } from './py-usage-tracker.js';
export {
  PySemanticDeadCodeAnalyzer,
  createPySemanticAnalyzer,
} from './py-semantic-analyzer.js';
