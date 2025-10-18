/**
 * Vitest Global Setup
 * Automatic cleanup hooks for all tests to prevent memory leaks
 */

import { afterEach, beforeEach, vi } from 'vitest';

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
});

// Global setup hook - runs before each test
beforeEach(() => {
  // Reset module cache between tests
  // This ensures test isolation and prevents module state leakage
  vi.resetModules();

  // Use fake timers for better control
  // This makes tests faster and more deterministic
  vi.useFakeTimers();
});
