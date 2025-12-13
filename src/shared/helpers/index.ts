/**
 * Shared Helpers Module
 *
 * This module contains utility functions organized by concern:
 *
 * **Configuration & Merging**
 * - `deepMerge` - Type-safe deep config merging with null/undefined handling
 *
 * **Environment Detection**
 * - `isClaudeCodeEnvironment`, `isCursorEnvironment` - AI IDE detection
 * - `shouldAutoEnableMockProviders` - Auto-configuration for AI IDEs
 *
 * **Resilience Patterns**
 * - `retry`, `Retry` decorator - Exponential backoff retry logic
 * - `CircuitBreaker` - Prevent cascading failures
 *
 * **Statistics**
 * - `getPercentile`, `getStatistics` - Statistical calculations
 *
 * **CLI Utilities**
 * - `PromptHelper`, `withPrompt` - Interactive CLI prompts
 *
 * **Package Utilities**
 * - `getPackageRoot`, `getVersion` - Package metadata
 *
 * @module shared/helpers
 */

// Configuration
export * from './deep-merge.js';

// Environment detection
export * from './environment.js';

// Resilience patterns
export * from './retry.js';
export * from './circuit-breaker.js';

// Statistics
export * from './statistics.js';

// Resource management
export * from './resource-calculator.js';
export * from './run-cleanup.js';

// Package utilities
export * from './version.js';
export * from './package-root.js';

// Math utilities
export * from './factorial.js';

// CLI utilities
export * from './prompt-helper.js';

// Agent utilities
export * from './agent-status-writer.js';
