/**
 * Autonomous Refactor Tool
 * @module core/refactor
 * @version 12.7.0
 */

// Types
export type {
  RefactorType,
  RefactorSeverity,
  RefactorState,
  RefactorStatus,
  DetectionMethod,
  RefactorRule,
  RefactorFinding,
  RefactorAttempt,
  RefactorMetrics,
  MetricImprovement,
  RefactorVerificationResult,
  SemanticVerificationConfig,
  RefactorConfig,
  RefactorStats,
  RefactorResult,
  RefactorControllerOptions,
  RefactorIgnoreState,
  OverengineeringGuards,
} from './types.js';

// Functions
export { createDefaultRefactorConfig, DEFAULT_OVERENGINEERING_GUARDS } from './types.js';

// Classes
export { RefactorController } from './refactor-controller.js';
export { RefactorDetector, createFinding } from './refactor-detector.js';
export { MetricsCollector } from './metrics-collector.js';

// Detectors
export { DUPLICATION_RULES, detectDuplication } from './detectors/duplication-detector.js';
export { READABILITY_RULES, detectReadability } from './detectors/readability-detector.js';
export { PERFORMANCE_RULES, detectPerformance } from './detectors/performance-detector.js';
export { HARDCODE_RULES, detectHardcode } from './detectors/hardcode-detector.js';
export { NAMING_RULES, detectNaming } from './detectors/naming-detector.js';
export { CONDITIONAL_RULES, detectConditionals } from './detectors/conditionals-detector.js';
export {
  DEAD_CODE_RULES,
  detectDeadCode,
  disposeSemanticAnalyzer,
  type DeadCodeDetectionOptions,
} from './detectors/dead-code-detector.js';
export { TYPE_SAFETY_RULES, detectTypeSafety } from './detectors/type-safety-detector.js';

// Semantic Analysis (PRD-019) - TypeScript Language Service integration
export * from './semantic/index.js';
