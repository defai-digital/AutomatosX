/**
 * Test Helpers - Central Export
 *
 * Provides test utilities for creating mock data and API responses.
 *
 * @module tests/helpers
 * @since v12.8.3
 *
 * @example
 * // Import factories
 * import {
 *   createAgentProfile,
 *   createMockProvider,
 *   createExecutionContext,
 *   setTestSeed
 * } from '../helpers';
 *
 * // Import MSW handlers
 * import { defaultHandlers, fastHandlers } from '../helpers';
 *
 * // Use in tests
 * describe('MyTest', () => {
 *   beforeEach(() => {
 *     setTestSeed(12345); // Reproducible data
 *   });
 *
 *   it('should work with mock data', () => {
 *     const provider = createMockProvider({ name: 'test' });
 *     const context = createExecutionContext({ provider });
 *     // ...
 *   });
 * });
 */

// ============================================================================
// Factory Functions (Faker-based test data generation)
// ============================================================================

export {
  // Seed management
  setTestSeed,
  resetTestSeed,

  // Agent factories
  createAgentProfile,
  createStage,
  createPersonality,

  // Provider factories
  createProviderCapabilities,
  createHealthStatus,
  createRateLimitStatus,
  createExecutionResponse,
  createMockProvider,

  // Context factories
  createExecutionContext,

  // Memory factories
  createMemoryEntry,
  createMemoryEntries,

  // Delegation factories
  createDelegationResult,

  // Task factories
  createTaskDescription,
  createComplexTask,

  // ID generators
  createSessionId,
  createTaskId,
  createDelegationChain,
} from './factories.js';

// ============================================================================
// MSW Handlers (API mocking)
// ============================================================================

export {
  // Handler types
  type MockResponseOptions,

  // Handler factory
  createProviderHandlers,

  // Preset handlers
  defaultHandlers,
  fastHandlers,
  slowHandlers,
  errorHandlers,
  rateLimitHandlers,

  // Custom handler builders
  createFailAfterNHandler,
  createFlakyHandler,
  createStreamingHandler,

  // Re-exports from msw
  http,
  HttpResponse,
  delay,
} from './msw-handlers.js';
