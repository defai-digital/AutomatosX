/**
 * Bugfix Module
 *
 * Autonomous bug-finding and fixing workflow.
 *
 * @module core/bugfix
 * @since v12.4.0
 */

// Types
export * from './types.js';

// Components
export { BugDetector, createDefaultBugfixConfig } from './bug-detector.js';
export { BugFixer } from './bug-fixer.js';
export { VerificationGate, type VerificationOptions } from './verification-gate.js';
export { BugfixController, type BugfixControllerOptions } from './bugfix-controller.js';
