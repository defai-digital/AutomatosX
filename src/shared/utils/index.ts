/**
 * Shared Utilities
 *
 * Safe timer utilities and disposable base classes for resource management.
 *
 * @module shared/utils
 * @since v12.4.0
 */

// Safe timer utilities
export {
  createSafeInterval,
  createSafeTimeout,
  withTimeout,
  createDeferredWithTimeout,
  SafeTimerTimeoutError,
  type SafeIntervalOptions,
  type SafeTimeoutOptions,
  type WithTimeoutOptions
} from './safe-timers.js';

// Re-export sleep with different name to avoid conflict
export { sleep as safeSleep } from './safe-timers.js';

// Disposable base classes
export {
  Disposable,
  DisposableEventEmitter,
  createDisposableWrapper,
  type CleanupTask
} from './disposable.js';
