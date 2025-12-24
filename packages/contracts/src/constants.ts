/**
 * AutomatosX Constants
 *
 * Single source of truth for all magic numbers, paths, and configuration defaults.
 * Import from '@automatosx/contracts' to use these values.
 *
 * Following the principle: "No magic numbers in code"
 */

// =============================================================================
// VERSION CONSTANTS
// =============================================================================

/** Current AutomatosX version */
export const AUTOMATOSX_VERSION = '13.0.0';

/** Default schema/config version for new resources */
export const DEFAULT_SCHEMA_VERSION = '1.0.0';

/** MCP protocol version */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

// =============================================================================
// SERVER & APPLICATION NAMES
// =============================================================================

/** MCP server name */
export const MCP_SERVER_NAME = 'automatosx-mcp';

/** Application name */
export const APP_NAME = 'automatosx';

/** CLI binary name */
export const CLI_NAME = 'ax';

// =============================================================================
// DIRECTORY & FILE NAMES
// =============================================================================

/** Default data directory name (relative to home or project) */
export const DATA_DIR_NAME = '.automatosx';

/** Default database filename */
export const DATABASE_FILENAME = 'data.db';

/** Default config filename */
export const CONFIG_FILENAME = 'config.json';

/** Default agents storage filename */
export const AGENTS_FILENAME = 'agents.json';

/** Context directory name */
export const CONTEXT_DIR_NAME = 'context';

/** Conventions file name */
export const CONVENTIONS_FILENAME = 'conventions.md';

/** Memory database filename */
export const MEMORY_DB_FILENAME = 'memory.db';

/** Trace database filename */
export const TRACE_DB_FILENAME = 'traces.db';

/** Session database filename */
export const SESSION_DB_FILENAME = 'sessions.db';

// =============================================================================
// TIMEOUT CONSTANTS (in milliseconds)
// =============================================================================

/** Default command execution timeout (5 seconds) */
export const TIMEOUT_COMMAND_DEFAULT = 5000;

/** Short timeout for quick operations (2 seconds) */
export const TIMEOUT_SHORT = 2000;

/** Medium timeout for standard operations (15 seconds) */
export const TIMEOUT_MEDIUM = 15000;

/** Long timeout for complex operations (30 seconds) */
export const TIMEOUT_LONG = 30000;

/** Extended timeout for analysis/scan operations (60 seconds) */
export const TIMEOUT_EXTENDED = 60000;

/** Workflow step timeout default (45 minutes) */
export const TIMEOUT_WORKFLOW_STEP = 2700000;

/** Maximum allowed workflow timeout (2 hours) */
export const TIMEOUT_WORKFLOW_MAX = 7200000;

/** Health check timeout (5 seconds) */
export const TIMEOUT_HEALTH_CHECK = 5000;

/** Provider call timeout (30 seconds) */
export const TIMEOUT_PROVIDER_CALL = 30000;

/** MCP tool execution timeout (60 seconds) */
export const TIMEOUT_MCP_TOOL = 60000;

/** Saga transaction timeout default (30 seconds) */
export const TIMEOUT_SAGA_DEFAULT = 30000;

/** Saga transaction timeout max (10 minutes) */
export const TIMEOUT_SAGA_MAX = 600000;

/** Analysis operation timeout (60 seconds) */
export const TIMEOUT_ANALYSIS = 60000;

/** Setup package add timeout (30 seconds) */
export const TIMEOUT_SETUP_ADD = 30000;

/** Setup package remove timeout (15 seconds) */
export const TIMEOUT_SETUP_REMOVE = 15000;

/** Gate contract test timeout (2 minutes) */
export const TIMEOUT_GATE_CONTRACT_TEST = 120000;

/** Gate dependency check timeout (1 minute) */
export const TIMEOUT_GATE_DEPENDENCY = 60000;

/** Provider default timeout (2 minutes) - for cli provider calls */
export const TIMEOUT_PROVIDER_DEFAULT = 120000;

/** Provider short timeout (1 minute) - for providers with shutdown issues */
export const TIMEOUT_PROVIDER_SHORT = 60000;

/** Graceful shutdown timeout (5 seconds) */
export const TIMEOUT_GRACEFUL_SHUTDOWN = 5000;

/** Force kill delay (1 second) */
export const TIMEOUT_FORCE_KILL = 1000;

/** Health check interval (5 minutes) */
export const INTERVAL_HEALTH_CHECK = 300000;

/** Session timeout (1 hour) */
export const TIMEOUT_SESSION = 3600000;

// =============================================================================
// LIMIT CONSTANTS
// =============================================================================

/** Default pagination limit */
export const LIMIT_DEFAULT = 10;

/** Default list limit for agents */
export const LIMIT_AGENTS = 50;

/** Default list limit for sessions */
export const LIMIT_SESSIONS = 20;

/** Default list limit for traces */
export const LIMIT_TRACES = 10;

/** Default list limit for workflows */
export const LIMIT_WORKFLOWS = 10;

/** Default list limit for policies */
export const LIMIT_POLICIES = 20;

/** Default list limit for memory entries */
export const LIMIT_MEMORY = 100;

/** Default list limit for dead letter queue */
export const LIMIT_DEAD_LETTER = 100;

/** Default list limit for telemetry */
export const LIMIT_TELEMETRY = 100;

/** Maximum pagination limit */
export const LIMIT_MAX = 1000;

/** Maximum abilities to inject */
export const LIMIT_ABILITIES_INJECT = 10;

/** Maximum tokens for ability injection */
export const LIMIT_ABILITY_TOKENS = 50000;

/** Maximum tokens for agent ability injection */
export const LIMIT_ABILITY_TOKENS_AGENT = 10000;

/** Event buffer size */
export const LIMIT_EVENT_BUFFER = 1000;

/** Max lines per file for analysis */
export const LIMIT_LINES_PER_FILE = 1000;

/** Max metrics to track (requests) */
export const LIMIT_REQUEST_METRICS = 10000;

/** Max metrics to track (errors) */
export const LIMIT_ERROR_METRICS = 1000;

/** Memory bulk delete limit */
export const LIMIT_MEMORY_BULK_DELETE = 1000;

/** Default list limit for orchestration tasks */
export const LIMIT_ORCHESTRATION = 50;

/** Default list limit for guard policies */
export const LIMIT_GUARD_POLICIES = 20;

/** Default list limit for design patterns */
export const LIMIT_DESIGN = 50;

/** Default list limit for bugfix/refactor scans */
export const LIMIT_SCAN_RESULTS = 50;

/** Maximum queue size for rate limiter */
export const LIMIT_QUEUE_SIZE = 100;

/** Max entries for idempotency/dead letter */
export const LIMIT_STORE_ENTRIES = 10000;

/** Default retry batch size */
export const LIMIT_RETRY_BATCH = 10;

/** Default max concurrent executions */
export const LIMIT_CONCURRENT_EXECUTIONS = 3;

/** Default max delegation depth */
export const LIMIT_DELEGATION_DEPTH = 3;

/** Default max checkpoints per agent */
export const LIMIT_CHECKPOINTS = 10;

/** Default checkpoint retention hours */
export const CHECKPOINT_RETENTION_HOURS = 24;

/** Default idempotency TTL seconds */
export const IDEMPOTENCY_TTL_SECONDS = 3600;

/** Default cleanup interval seconds */
export const CLEANUP_INTERVAL_SECONDS = 300;

/** Default retention days for dead letter */
export const RETENTION_DAYS_DEFAULT = 7;

/** Default priority value */
export const PRIORITY_DEFAULT = 50;

/** Maximum priority value */
export const PRIORITY_MAX = 100;

/** Default backoff multiplier */
export const BACKOFF_MULTIPLIER_DEFAULT = 2;

/** Max concurrent for parallel execution */
export const LIMIT_PARALLEL_CONCURRENT = 5;

// =============================================================================
// RETRY CONSTANTS
// =============================================================================

/** Default max retries */
export const RETRY_MAX_DEFAULT = 3;

/** Maximum allowed retries */
export const RETRY_MAX_LIMIT = 10;

/** Default retry delay (1 second) */
export const RETRY_DELAY_DEFAULT = 1000;

/** Maximum retry delay (30 seconds) */
export const RETRY_DELAY_MAX = 30000;

/** Maximum backoff cap (60 seconds) */
export const RETRY_BACKOFF_CAP = 60000;

// =============================================================================
// ORCHESTRATION TIMEOUT CONSTANTS
// =============================================================================

/** Orchestration execution timeout default (5 minutes) */
export const TIMEOUT_ORCHESTRATION_EXECUTION = 300000;

/** Orchestration graceful shutdown default (10 seconds) */
export const TIMEOUT_ORCHESTRATION_GRACEFUL = 10000;

/** Maximum queue timeout (24 hours) */
export const TIMEOUT_QUEUE_MAX = 86400000;

// =============================================================================
// ANALYSIS CONSTANTS
// =============================================================================

/** Analysis max files default */
export const ANALYSIS_MAX_FILES_DEFAULT = 20;

/** Analysis max files limit */
export const ANALYSIS_MAX_FILES_LIMIT = 100;

/** Analysis max lines per file limit */
export const ANALYSIS_MAX_LINES_LIMIT = 5000;

/** Analysis timeout minimum */
export const TIMEOUT_ANALYSIS_MIN = 5000;

/** Analysis timeout maximum */
export const TIMEOUT_ANALYSIS_MAX = 120000;

// =============================================================================
// ITERATE CONSTANTS
// =============================================================================

/** Default max iterations for iterate command */
export const ITERATE_MAX_DEFAULT = 20;

/** Maximum allowed iterations */
export const ITERATE_MAX_LIMIT = 100;

/** Default iterate timeout (5 minutes) */
export const ITERATE_TIMEOUT_DEFAULT = 300000;

// =============================================================================
// RATE LIMIT CONSTANTS
// =============================================================================

/** Default requests per minute */
export const RATE_LIMIT_RPM_DEFAULT = 60;

/** Default requests per day */
export const RATE_LIMIT_RPD_DEFAULT = 10000;

/** Default tokens per minute */
export const RATE_LIMIT_TPM_DEFAULT = 100000;

// =============================================================================
// CIRCUIT BREAKER CONSTANTS
// =============================================================================

/** Failure threshold to open circuit */
export const CIRCUIT_FAILURE_THRESHOLD = 5;

/** Success threshold to close circuit */
export const CIRCUIT_SUCCESS_THRESHOLD = 3;

/** Half-open timeout (30 seconds) */
export const CIRCUIT_HALF_OPEN_TIMEOUT = 30000;

/** Circuit breaker recovery timeout (60 seconds) */
export const CIRCUIT_RECOVERY_TIMEOUT = 60000;

/** Circuit breaker failure window (60 seconds) */
export const CIRCUIT_FAILURE_WINDOW = 60000;

/** Circuit breaker queue timeout (30 seconds) */
export const CIRCUIT_QUEUE_TIMEOUT = 30000;

/** Circuit breaker reset timeout (30 seconds) */
export const CIRCUIT_RESET_TIMEOUT = 30000;

/** Half-open requests allowed */
export const CIRCUIT_HALF_OPEN_REQUESTS = 2;

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/** Minimum confidence score */
export const CONFIDENCE_MIN = 0;

/** Maximum confidence score */
export const CONFIDENCE_MAX = 1;

/** Default minimum confidence for scans */
export const CONFIDENCE_DEFAULT_MIN = 0.7;

/** Maximum string length for short fields */
export const STRING_LENGTH_SHORT = 50;

/** Maximum string length for medium fields */
export const STRING_LENGTH_MEDIUM = 200;

/** Maximum string length for long fields */
export const STRING_LENGTH_LONG = 1000;

/** Maximum string length for content fields */
export const STRING_LENGTH_CONTENT = 10000;

// =============================================================================
// FILE SCAN CONSTANTS
// =============================================================================

/** Default max files to scan */
export const SCAN_MAX_FILES_DEFAULT = 100;

/** Maximum files to scan */
export const SCAN_MAX_FILES_LIMIT = 1000;

/** Minimum files to scan */
export const SCAN_MIN_FILES = 1;

// =============================================================================
// ENVIRONMENT VARIABLE NAMES
// =============================================================================

/** Storage mode environment variable */
export const ENV_STORAGE_MODE = 'AX_STORAGE';

/** Data directory environment variable */
export const ENV_DATA_DIR = 'AX_DATA_DIR';

/** Log level environment variable */
export const ENV_LOG_LEVEL = 'AX_LOG_LEVEL';

/** MCP tool prefix environment variable */
export const ENV_MCP_TOOL_PREFIX = 'AX_MCP_TOOL_PREFIX';

/**
 * Default MCP tool prefix
 *
 * Best practice for multi-server MCP environments: prefix tools to identify
 * which server they belong to. This follows SEP-986 naming conventions.
 *
 * Tools will be named: ax_<domain>_<action> (e.g., ax_config_set, ax_agent_list)
 * Can be overridden via AX_MCP_TOOL_PREFIX environment variable.
 * Set to empty string '' to disable prefixing.
 */
export const MCP_TOOL_PREFIX_DEFAULT = 'ax';

/** Debug mode environment variable */
export const ENV_DEBUG = 'AX_DEBUG';

// =============================================================================
// STORAGE MODE CONSTANTS
// =============================================================================

/** SQLite storage mode */
export const STORAGE_MODE_SQLITE = 'sqlite';

/** In-memory storage mode */
export const STORAGE_MODE_MEMORY = 'memory';

/** Default storage mode */
export const STORAGE_MODE_DEFAULT = STORAGE_MODE_SQLITE;

// =============================================================================
// PROVIDER CONSTANTS
// =============================================================================

/** Available provider IDs */
export const PROVIDER_IDS = [
  'claude',
  'gemini',
  'codex',
  'qwen',
  'glm',
  'grok',
] as const;

/** Default provider */
export const PROVIDER_DEFAULT = 'claude';

/** Default provider priority */
export const PROVIDER_PRIORITY_DEFAULT = 50;

/** Maximum provider priority */
export const PROVIDER_PRIORITY_MAX = 100;

// =============================================================================
// SEVERITY & STATUS CONSTANTS
// =============================================================================

/** Bug severity levels */
export const BUG_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

/** Default minimum severity for scans */
export const BUG_SEVERITY_DEFAULT_MIN = 'medium';

/** Refactor impact levels */
export const REFACTOR_IMPACTS = [
  'breaking',
  'major',
  'minor',
  'trivial',
] as const;

/** Default maximum impact for refactoring */
export const REFACTOR_IMPACT_DEFAULT_MAX = 'major';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the default data directory path
 * @param homeDir - User's home directory
 * @returns Full path to data directory
 */
export function getDefaultDataDir(homeDir: string): string {
  return `${homeDir}/${DATA_DIR_NAME}`;
}

/**
 * Get the default database path
 * @param homeDir - User's home directory
 * @returns Full path to database file
 */
export function getDefaultDatabasePath(homeDir: string): string {
  return `${homeDir}/${DATA_DIR_NAME}/${DATABASE_FILENAME}`;
}

/**
 * Get project data directory path
 * @param projectDir - Project root directory
 * @returns Full path to project data directory
 */
export function getProjectDataDir(projectDir: string): string {
  return `${projectDir}/${DATA_DIR_NAME}`;
}
