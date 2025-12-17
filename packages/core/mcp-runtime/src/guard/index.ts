export {
  // Types
  type GuardStatus,
  type GuardCheckResult,
  type RuntimeGuardResult,
  type RuntimeGuardConfig,
  type RuntimeGuardContext,

  // Constants
  DEFAULT_GUARD_CONFIG,

  // Class and helpers
  RuntimeGuard,
  createRuntimeGuard,
  quickGuardCheck,
} from './runtime-guard.js';
