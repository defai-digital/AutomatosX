// src/constants.ts
var MS_PER_SECOND = 1e3;
var MS_PER_MINUTE = 60 * MS_PER_SECOND;
var MS_PER_HOUR = 60 * MS_PER_MINUTE;
var MS_PER_DAY = 24 * MS_PER_HOUR;
var MS_PER_WEEK = 7 * MS_PER_DAY;
var BYTES_PER_KB = 1024;
var BYTES_PER_MB = BYTES_PER_KB * 1024;
var BYTES_PER_GB = BYTES_PER_MB * 1024;
var DIR_AUTOMATOSX = ".automatosx";
var DIR_SESSIONS = "sessions";
var DIR_MEMORY = "memory";
var DIR_CHECKPOINTS = "checkpoints";
var DIR_TRACES = "traces";
var DIR_LOGS = "logs";
var FILE_MEMORY_DB = "memories.db";
var PATH_MEMORY_DB = `${DIR_AUTOMATOSX}/${DIR_MEMORY}/${FILE_MEMORY_DB}`;
var PATH_SESSIONS = `${DIR_AUTOMATOSX}/${DIR_SESSIONS}`;
var PATH_CHECKPOINTS = `${DIR_AUTOMATOSX}/${DIR_CHECKPOINTS}`;
var PATH_TRACES = `${DIR_AUTOMATOSX}/${DIR_TRACES}`;
var PATH_LOGS = `${DIR_AUTOMATOSX}/${DIR_LOGS}`;
var TIMEOUT_EXECUTION = 5 * MS_PER_MINUTE;
var TIMEOUT_HEALTH_CHECK_REQUEST = 5 * MS_PER_SECOND;
var TIMEOUT_RETRY_MAX = 30 * MS_PER_SECOND;
var TIMEOUT_CIRCUIT_FAILURE_WINDOW = 5 * MS_PER_MINUTE;
var TIMEOUT_PROVIDER_COOLDOWN = 30 * MS_PER_SECOND;
var TIMEOUT_AUTO_SAVE = 30 * MS_PER_SECOND;
var LIMIT_MAX_LOG_SIZE = 10 * BYTES_PER_MB;

// src/format.ts
function formatBytes(bytes) {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}
function formatDuration(ms) {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m`;
  return `${Math.floor(ms / MS_PER_HOUR)}h`;
}
function formatDurationLong(ms) {
  if (ms < MS_PER_SECOND) return `${ms}ms`;
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  if (ms < MS_PER_HOUR) return `${Math.floor(ms / MS_PER_MINUTE)}m ${Math.floor(ms % MS_PER_MINUTE / MS_PER_SECOND)}s`;
  if (ms < MS_PER_DAY) return `${Math.floor(ms / MS_PER_HOUR)}h ${Math.floor(ms % MS_PER_HOUR / MS_PER_MINUTE)}m`;
  if (ms < MS_PER_WEEK) return `${Math.floor(ms / MS_PER_DAY)}d ${Math.floor(ms % MS_PER_DAY / MS_PER_HOUR)}h`;
  return `${Math.floor(ms / MS_PER_WEEK)}w ${Math.floor(ms % MS_PER_WEEK / MS_PER_DAY)}d`;
}
function formatRelativeTime(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) {
    return "in the future";
  }
  if (diffMs < MS_PER_MINUTE) {
    return "just now";
  }
  if (diffMs < MS_PER_HOUR) {
    const mins = Math.floor(diffMs / MS_PER_MINUTE);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < MS_PER_DAY) {
    const hours = Math.floor(diffMs / MS_PER_HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diffMs < MS_PER_WEEK) {
    const days = Math.floor(diffMs / MS_PER_DAY);
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }
  const weeks = Math.floor(diffMs / MS_PER_WEEK);
  if (weeks === 1) return "last week";
  if (weeks < 4) return `${weeks} weeks ago`;
  return date.toLocaleDateString();
}
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
function truncateId(id, length = 8) {
  return id.slice(0, length);
}
export {
  formatBytes,
  formatDuration,
  formatDurationLong,
  formatRelativeTime,
  truncate,
  truncateId
};
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
/**
 * Formatting Utilities
 *
 * Shared formatting functions for consistent display across the platform.
 *
 * @module @ax/schemas/format
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=format.js.map