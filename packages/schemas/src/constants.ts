/**
 * Shared Constants
 *
 * Centralized constants for the AutomatosX platform.
 * Import these instead of using magic numbers or hardcoded strings.
 *
 * @module @ax/schemas/constants
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Version
// =============================================================================

/** Current AutomatosX version */
export const VERSION = '11.0.0-alpha.0';

// =============================================================================
// Time Constants (in milliseconds)
// =============================================================================

/** Milliseconds per second */
export const MS_PER_SECOND = 1000;

/** Milliseconds per minute */
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

/** Milliseconds per hour */
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Milliseconds per day */
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Milliseconds per week */
export const MS_PER_WEEK = 7 * MS_PER_DAY;

// =============================================================================
// Byte Constants
// =============================================================================

/** Bytes per kilobyte */
export const BYTES_PER_KB = 1024;

/** Bytes per megabyte */
export const BYTES_PER_MB = BYTES_PER_KB * 1024;

/** Bytes per gigabyte */
export const BYTES_PER_GB = BYTES_PER_MB * 1024;

// =============================================================================
// Directory Names
// =============================================================================

/** Root AutomatosX directory name */
export const DIR_AUTOMATOSX = '.automatosx';

/** Agents subdirectory name */
export const DIR_AGENTS = 'agents';

/** Sessions subdirectory name */
export const DIR_SESSIONS = 'sessions';

/** Memory subdirectory name */
export const DIR_MEMORY = 'memory';

/** Checkpoints subdirectory name */
export const DIR_CHECKPOINTS = 'checkpoints';

/** Traces subdirectory name */
export const DIR_TRACES = 'traces';

/** Logs subdirectory name */
export const DIR_LOGS = 'logs';

/** Workspace PRD directory */
export const DIR_WORKSPACE_PRD = 'automatosx/PRD';

/** Workspace tmp directory */
export const DIR_WORKSPACE_TMP = 'automatosx/tmp';

// =============================================================================
// File Names
// =============================================================================

/** Memory database file name */
export const FILE_MEMORY_DB = 'memories.db';

/** Config file name */
export const FILE_CONFIG = 'ax.config.json';

// =============================================================================
// Default Paths (relative to project root)
// =============================================================================

/** Default memory database path */
export const PATH_MEMORY_DB = `${DIR_AUTOMATOSX}/${DIR_MEMORY}/${FILE_MEMORY_DB}`;

/** Default sessions data path */
export const PATH_SESSIONS = `${DIR_AUTOMATOSX}/${DIR_SESSIONS}`;

/** Default checkpoints path */
export const PATH_CHECKPOINTS = `${DIR_AUTOMATOSX}/${DIR_CHECKPOINTS}`;

/** Default traces path */
export const PATH_TRACES = `${DIR_AUTOMATOSX}/${DIR_TRACES}`;

/** Default logs path */
export const PATH_LOGS = `${DIR_AUTOMATOSX}/${DIR_LOGS}`;

// =============================================================================
// Display Truncation Lengths
// =============================================================================

/** ID display length (e.g., UUID prefix) */
export const DISPLAY_ID_LENGTH = 8;

/** Short preview length */
export const DISPLAY_PREVIEW_SHORT = 40;

/** Medium preview length */
export const DISPLAY_PREVIEW_MEDIUM = 100;

/** Long preview length */
export const DISPLAY_PREVIEW_LONG = 200;

/** Extra long preview length */
export const DISPLAY_PREVIEW_XLARGE = 300;

/** Name truncation length */
export const DISPLAY_NAME_LENGTH = 20;

/** Role/description truncation length */
export const DISPLAY_ROLE_LENGTH = 30;

/** Task description truncation length */
export const DISPLAY_TASK_LENGTH = 50;

// =============================================================================
// List Display Limits
// =============================================================================

/** Default items to show in preview lists */
export const LIST_PREVIEW_LIMIT = 10;

/** Default search result limit */
export const LIST_SEARCH_LIMIT = 10;

/** Top tags to display */
export const LIST_TOP_TAGS = 5;

// =============================================================================
// Default Timeout Values
// =============================================================================

/** Default execution timeout (5 minutes) */
export const TIMEOUT_EXECUTION = 5 * MS_PER_MINUTE;

/** Default health check interval (1 minute) */
export const TIMEOUT_HEALTH_CHECK = MS_PER_MINUTE;

/** Default health check timeout (5 seconds) */
export const TIMEOUT_HEALTH_CHECK_REQUEST = 5 * MS_PER_SECOND;

/** Default session timeout (1 hour) */
export const TIMEOUT_SESSION = MS_PER_HOUR;

/** Default retry initial delay (1 second) */
export const TIMEOUT_RETRY_INITIAL = MS_PER_SECOND;

/** Default retry max delay (30 seconds) */
export const TIMEOUT_RETRY_MAX = 30 * MS_PER_SECOND;

/** Default circuit breaker recovery (1 minute) */
export const TIMEOUT_CIRCUIT_RECOVERY = MS_PER_MINUTE;

/** Default circuit breaker failure window (5 minutes) */
export const TIMEOUT_CIRCUIT_FAILURE_WINDOW = 5 * MS_PER_MINUTE;

/** Default cooldown after provider failure (30 seconds) */
export const TIMEOUT_PROVIDER_COOLDOWN = 30 * MS_PER_SECOND;

/** Default auto-save interval (30 seconds) */
export const TIMEOUT_AUTO_SAVE = 30 * MS_PER_SECOND;

/** Default save debounce (1 second) */
export const TIMEOUT_SAVE_DEBOUNCE = MS_PER_SECOND;

// =============================================================================
// Default Limits
// =============================================================================

/** Default max retry attempts */
export const LIMIT_RETRY_ATTEMPTS = 3;

/** Default max concurrent executions */
export const LIMIT_CONCURRENCY = 4;

/** Default max memory entries */
export const LIMIT_MEMORY_ENTRIES = 10000;

/** Default memory retention days */
export const LIMIT_RETENTION_DAYS = 30;

/** Default max sessions */
export const LIMIT_MAX_SESSIONS = 100;

/** Default max checkpoints per session */
export const LIMIT_CHECKPOINTS_PER_SESSION = 20;

/** Default checkpoint retention days */
export const LIMIT_CHECKPOINT_RETENTION_DAYS = 7;

/** Default max log files */
export const LIMIT_MAX_LOG_FILES = 10;

/** Default max log file size (10 MB) */
export const LIMIT_MAX_LOG_SIZE = 10 * BYTES_PER_MB;

/** Default tmp file retention days */
export const LIMIT_TMP_RETENTION_DAYS = 7;

/** Default circuit breaker failure threshold */
export const LIMIT_CIRCUIT_BREAKER_THRESHOLD = 3;

/** Default provider priority (lowest precedence) */
export const LIMIT_DEFAULT_PROVIDER_PRIORITY = 99;

// =============================================================================
// Database Configuration
// =============================================================================

/** SQLite cache size in KB */
export const DB_CACHE_SIZE_KB = 8192;

/** Request history size for metrics */
export const DB_REQUEST_HISTORY_SIZE = 100;

/** Default success rate for new providers */
export const DB_DEFAULT_SUCCESS_RATE = 1.0;

// =============================================================================
// Memory Cleanup Weights (for hybrid strategy)
// =============================================================================

/** Weight for age factor in hybrid cleanup */
export const CLEANUP_AGE_WEIGHT = 0.4;

/** Weight for access frequency in hybrid cleanup */
export const CLEANUP_ACCESS_WEIGHT = 0.3;

/** Weight for importance in hybrid cleanup */
export const CLEANUP_IMPORTANCE_WEIGHT = 0.3;

// =============================================================================
// Default Metadata Values
// =============================================================================

/** Default memory entry type */
export const DEFAULT_MEMORY_TYPE = 'document';

/** Default memory entry source */
export const DEFAULT_MEMORY_SOURCE = 'unknown';

/** Default memory entry importance (0-1 scale) */
export const DEFAULT_MEMORY_IMPORTANCE = 0.5;

// =============================================================================
// Circuit Breaker States
// =============================================================================

/** Circuit breaker closed state (normal operation) */
export const CIRCUIT_CLOSED = 'closed' as const;

/** Circuit breaker open state (failing fast) */
export const CIRCUIT_OPEN = 'open' as const;

/** Circuit breaker half-open state (testing recovery) */
export const CIRCUIT_HALF_OPEN = 'half-open' as const;

/** Circuit breaker state type */
export type CircuitState = typeof CIRCUIT_CLOSED | typeof CIRCUIT_OPEN | typeof CIRCUIT_HALF_OPEN;
