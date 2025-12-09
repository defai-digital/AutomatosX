/**
 * Bugfix Module
 *
 * Autonomous bug-finding and fixing workflow.
 *
 * @module core/bugfix
 * @since v12.4.0
 * @updated v12.6.0 - Added git-aware scanning, JSON output, report generation
 */

// Types
export * from './types.js';

// Components
export { BugDetector, createDefaultBugfixConfig } from './bug-detector.js';
export { BugFixer } from './bug-fixer.js';
export { VerificationGate, type VerificationOptions } from './verification-gate.js';
export { BugfixController, type BugfixControllerOptions } from './bugfix-controller.js';

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
