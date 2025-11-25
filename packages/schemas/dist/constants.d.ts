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
/** Current AutomatosX version */
declare const VERSION = "11.0.0-alpha.0";
/** Milliseconds per second */
declare const MS_PER_SECOND = 1000;
/** Milliseconds per minute */
declare const MS_PER_MINUTE: number;
/** Milliseconds per hour */
declare const MS_PER_HOUR: number;
/** Milliseconds per day */
declare const MS_PER_DAY: number;
/** Milliseconds per week */
declare const MS_PER_WEEK: number;
/** Bytes per kilobyte */
declare const BYTES_PER_KB = 1024;
/** Bytes per megabyte */
declare const BYTES_PER_MB: number;
/** Bytes per gigabyte */
declare const BYTES_PER_GB: number;
/** Root AutomatosX directory name */
declare const DIR_AUTOMATOSX = ".automatosx";
/** Agents subdirectory name */
declare const DIR_AGENTS = "agents";
/** Sessions subdirectory name */
declare const DIR_SESSIONS = "sessions";
/** Memory subdirectory name */
declare const DIR_MEMORY = "memory";
/** Checkpoints subdirectory name */
declare const DIR_CHECKPOINTS = "checkpoints";
/** Traces subdirectory name */
declare const DIR_TRACES = "traces";
/** Logs subdirectory name */
declare const DIR_LOGS = "logs";
/** Workspace PRD directory */
declare const DIR_WORKSPACE_PRD = "automatosx/PRD";
/** Workspace tmp directory */
declare const DIR_WORKSPACE_TMP = "automatosx/tmp";
/** Memory database file name */
declare const FILE_MEMORY_DB = "memories.db";
/** Config file name */
declare const FILE_CONFIG = "ax.config.json";
/** Default memory database path */
declare const PATH_MEMORY_DB = ".automatosx/memory/memories.db";
/** Default sessions data path */
declare const PATH_SESSIONS = ".automatosx/sessions";
/** Default checkpoints path */
declare const PATH_CHECKPOINTS = ".automatosx/checkpoints";
/** Default traces path */
declare const PATH_TRACES = ".automatosx/traces";
/** Default logs path */
declare const PATH_LOGS = ".automatosx/logs";
/** ID display length (e.g., UUID prefix) */
declare const DISPLAY_ID_LENGTH = 8;
/** Short preview length */
declare const DISPLAY_PREVIEW_SHORT = 40;
/** Medium preview length */
declare const DISPLAY_PREVIEW_MEDIUM = 100;
/** Long preview length */
declare const DISPLAY_PREVIEW_LONG = 200;
/** Extra long preview length */
declare const DISPLAY_PREVIEW_XLARGE = 300;
/** Name truncation length */
declare const DISPLAY_NAME_LENGTH = 20;
/** Role/description truncation length */
declare const DISPLAY_ROLE_LENGTH = 30;
/** Task description truncation length */
declare const DISPLAY_TASK_LENGTH = 50;
/** Default items to show in preview lists */
declare const LIST_PREVIEW_LIMIT = 10;
/** Default search result limit */
declare const LIST_SEARCH_LIMIT = 10;
/** Top tags to display */
declare const LIST_TOP_TAGS = 5;
/** Default execution timeout (5 minutes) */
declare const TIMEOUT_EXECUTION: number;
/** Default health check interval (1 minute) */
declare const TIMEOUT_HEALTH_CHECK: number;
/** Default health check timeout (5 seconds) */
declare const TIMEOUT_HEALTH_CHECK_REQUEST: number;
/** Default session timeout (1 hour) */
declare const TIMEOUT_SESSION: number;
/** Default retry initial delay (1 second) */
declare const TIMEOUT_RETRY_INITIAL = 1000;
/** Default retry max delay (30 seconds) */
declare const TIMEOUT_RETRY_MAX: number;
/** Default circuit breaker recovery (1 minute) */
declare const TIMEOUT_CIRCUIT_RECOVERY: number;
/** Default circuit breaker failure window (5 minutes) */
declare const TIMEOUT_CIRCUIT_FAILURE_WINDOW: number;
/** Default cooldown after provider failure (30 seconds) */
declare const TIMEOUT_PROVIDER_COOLDOWN: number;
/** Default auto-save interval (30 seconds) */
declare const TIMEOUT_AUTO_SAVE: number;
/** Default save debounce (1 second) */
declare const TIMEOUT_SAVE_DEBOUNCE = 1000;
/** Default max retry attempts */
declare const LIMIT_RETRY_ATTEMPTS = 3;
/** Default max concurrent executions */
declare const LIMIT_CONCURRENCY = 4;
/** Default max memory entries */
declare const LIMIT_MEMORY_ENTRIES = 10000;
/** Default memory retention days */
declare const LIMIT_RETENTION_DAYS = 30;
/** Default max sessions */
declare const LIMIT_MAX_SESSIONS = 100;
/** Default max checkpoints per session */
declare const LIMIT_CHECKPOINTS_PER_SESSION = 20;
/** Default checkpoint retention days */
declare const LIMIT_CHECKPOINT_RETENTION_DAYS = 7;
/** Default max log files */
declare const LIMIT_MAX_LOG_FILES = 10;
/** Default max log file size (10 MB) */
declare const LIMIT_MAX_LOG_SIZE: number;
/** Default tmp file retention days */
declare const LIMIT_TMP_RETENTION_DAYS = 7;
/** Default circuit breaker failure threshold */
declare const LIMIT_CIRCUIT_BREAKER_THRESHOLD = 3;
/** Default provider priority (lowest precedence) */
declare const LIMIT_DEFAULT_PROVIDER_PRIORITY = 99;
/** SQLite cache size in KB */
declare const DB_CACHE_SIZE_KB = 8192;
/** Request history size for metrics */
declare const DB_REQUEST_HISTORY_SIZE = 100;
/** Default success rate for new providers */
declare const DB_DEFAULT_SUCCESS_RATE = 1;
/** Weight for age factor in hybrid cleanup */
declare const CLEANUP_AGE_WEIGHT = 0.4;
/** Weight for access frequency in hybrid cleanup */
declare const CLEANUP_ACCESS_WEIGHT = 0.3;
/** Weight for importance in hybrid cleanup */
declare const CLEANUP_IMPORTANCE_WEIGHT = 0.3;
/** Default memory entry type */
declare const DEFAULT_MEMORY_TYPE = "document";
/** Default memory entry source */
declare const DEFAULT_MEMORY_SOURCE = "unknown";
/** Default memory entry importance (0-1 scale) */
declare const DEFAULT_MEMORY_IMPORTANCE = 0.5;
/** Circuit breaker closed state (normal operation) */
declare const CIRCUIT_CLOSED: "closed";
/** Circuit breaker open state (failing fast) */
declare const CIRCUIT_OPEN: "open";
/** Circuit breaker half-open state (testing recovery) */
declare const CIRCUIT_HALF_OPEN: "half-open";
/** Circuit breaker state type */
type CircuitState = typeof CIRCUIT_CLOSED | typeof CIRCUIT_OPEN | typeof CIRCUIT_HALF_OPEN;

export { BYTES_PER_GB, BYTES_PER_KB, BYTES_PER_MB, CIRCUIT_CLOSED, CIRCUIT_HALF_OPEN, CIRCUIT_OPEN, CLEANUP_ACCESS_WEIGHT, CLEANUP_AGE_WEIGHT, CLEANUP_IMPORTANCE_WEIGHT, type CircuitState, DB_CACHE_SIZE_KB, DB_DEFAULT_SUCCESS_RATE, DB_REQUEST_HISTORY_SIZE, DEFAULT_MEMORY_IMPORTANCE, DEFAULT_MEMORY_SOURCE, DEFAULT_MEMORY_TYPE, DIR_AGENTS, DIR_AUTOMATOSX, DIR_CHECKPOINTS, DIR_LOGS, DIR_MEMORY, DIR_SESSIONS, DIR_TRACES, DIR_WORKSPACE_PRD, DIR_WORKSPACE_TMP, DISPLAY_ID_LENGTH, DISPLAY_NAME_LENGTH, DISPLAY_PREVIEW_LONG, DISPLAY_PREVIEW_MEDIUM, DISPLAY_PREVIEW_SHORT, DISPLAY_PREVIEW_XLARGE, DISPLAY_ROLE_LENGTH, DISPLAY_TASK_LENGTH, FILE_CONFIG, FILE_MEMORY_DB, LIMIT_CHECKPOINTS_PER_SESSION, LIMIT_CHECKPOINT_RETENTION_DAYS, LIMIT_CIRCUIT_BREAKER_THRESHOLD, LIMIT_CONCURRENCY, LIMIT_DEFAULT_PROVIDER_PRIORITY, LIMIT_MAX_LOG_FILES, LIMIT_MAX_LOG_SIZE, LIMIT_MAX_SESSIONS, LIMIT_MEMORY_ENTRIES, LIMIT_RETENTION_DAYS, LIMIT_RETRY_ATTEMPTS, LIMIT_TMP_RETENTION_DAYS, LIST_PREVIEW_LIMIT, LIST_SEARCH_LIMIT, LIST_TOP_TAGS, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, MS_PER_WEEK, PATH_CHECKPOINTS, PATH_LOGS, PATH_MEMORY_DB, PATH_SESSIONS, PATH_TRACES, TIMEOUT_AUTO_SAVE, TIMEOUT_CIRCUIT_FAILURE_WINDOW, TIMEOUT_CIRCUIT_RECOVERY, TIMEOUT_EXECUTION, TIMEOUT_HEALTH_CHECK, TIMEOUT_HEALTH_CHECK_REQUEST, TIMEOUT_PROVIDER_COOLDOWN, TIMEOUT_RETRY_INITIAL, TIMEOUT_RETRY_MAX, TIMEOUT_SAVE_DEBOUNCE, TIMEOUT_SESSION, VERSION };
