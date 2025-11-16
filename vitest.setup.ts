/**
 * Vitest Global Setup
 * Automatic cleanup hooks for all tests to prevent memory leaks
 */

import { afterEach, beforeEach, vi } from 'vitest';
import { providerCache } from './src/core/provider-cache.js';
import { clearDetectCache } from './src/core/cli-provider-detector.js';

// Global cleanup hook - runs after each test
afterEach(() => {
  // Clear all timers (setTimeout, setInterval)
  // This prevents timers from keeping the event loop alive
  vi.clearAllTimers();

  // Restore all mocks to their original implementations
  // This prevents memory leaks from accumulated mock state
  vi.restoreAllMocks();

  // Clear all mock call history
  // This frees memory from accumulated call data
  vi.clearAllMocks();

  // v5.12.4: Clear global caches to prevent test pollution
  // This prevents stale cache entries from affecting subsequent tests
  // See: automatosx/tmp/bug-report-provider-test-failures.md
  providerCache.clearAll();

  // Note: clearDetectCache() is NOT called globally because some tests
  // need to verify cache behavior. Tests that need a clean cache should
  // call clearDetectCache() in their own beforeEach hooks.
});

// Global setup hook - runs before each test
beforeEach(() => {
  // Reset module cache between tests
  // This ensures test isolation and prevents module state leakage
  vi.resetModules();

  // ✅ v5.7.0: Global fake timers removed
  // Each test should now explicitly declare its timer requirements using:
  //   beforeEach(() => vi.useFakeTimers())  // For fake timers
  //   beforeEach(() => vi.useRealTimers())   // For real timers (if needed)
  //
  // Migration completed: All priority tests now manage their own timers
  // See tmp/fake-timers-migration-roadmap-revised.md for details
});
