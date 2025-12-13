/**
 * Bugfix Module
 *
 * Autonomous bug-finding and fixing workflow.
 *
 * @module core/bugfix
 * @since v12.4.0
 * @updated v12.6.0 - Added git-aware scanning, JSON output, report generation
 * @updated v12.8.0 - Added AST-based detection for reduced false positives
 * @updated v12.9.0 - PRD-018: Added confidence filtering, enhanced verification, metrics tracking
 */

// Types
export * from './types.js';

// Components
export { BugDetector, createDefaultBugfixConfig } from './bug-detector.js';
export { BugFixer } from './bug-fixer.js';
export { VerificationGate, type VerificationOptions } from './verification-gate.js';
export { BugfixController, type BugfixControllerOptions } from './bugfix-controller.js';

// AST Analyzer (v12.8.0)
export {
  ASTAnalyzer,
  createASTAnalyzer,
  ALLOWLISTS,
  type ClassInfo,
  type MethodInfo,
  type PropertyInfo,
  type CallInfo,
  type VariableUsage,
  type FunctionInfo,
  // Phase 3-4 additions (v12.8.0)
  type PromiseTimeoutInfo,
  type UnreachableCodeInfo,
  // Phase 5 additions (v12.8.0)
  type TimerLeakInfo,
  // v12.9.0: PRD-018 additions
  type EventListenerInfo,
  type PromiseErrorInfo
} from './ast-analyzer.js';
// Python AST Bridge (v12.9.0)
export {
  PythonASTBridge,
  PythonBridgeError,
  type PythonASTBridgeOptions,
  type PythonASTQuery,
  type PythonASTQueryType,
  type PythonASTResponse,
  type PythonASTFinding,
  type PythonParseError,
  type PythonBridgeErrorCode
} from './python-ast-bridge.js';

// Metrics Tracker (v12.9.0) - PRD-018
export {
  MetricsTracker,
  getMetricsTracker,
  resetMetricsTracker,
  type DetectionMetric,
  type RuleMetrics,
  type MetricsSummary
} from './metrics-tracker.js';

// Git utilities (v12.6.0)
export {
  getChangedFiles,
  isGitRepo,
  getCurrentBranch,
  getDefaultBranch,
  type GitFilterOptions
} from './git-utils.js';

// Report generation (v12.6.0)
export {
  generateJsonOutput,
  generateMarkdownReport,
  writeReport,
  getDefaultReportPath,
  type BugfixJsonOutput
} from './report-generator.js';
