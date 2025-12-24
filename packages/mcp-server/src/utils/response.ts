/**
 * MCP Response Optimization Utilities
 *
 * Ensures all MCP responses are "Claude-safe" by enforcing:
 * - INV-MCP-RESP-001: All responses < 10 KB
 * - INV-MCP-RESP-002: Arrays limited to 10 items
 * - INV-MCP-RESP-003: Strings truncated at 500 chars
 * - INV-MCP-RESP-004: JSON depth <= 4 levels
 * - INV-MCP-RESP-005: Large results stored as artifacts
 * - INV-MCP-RESP-006: All responses include summary field
 */

import type { MCPToolResult } from '../types.js';

type ToolResult = MCPToolResult;

// ============================================================================
// Response Limits Configuration
// ============================================================================

export interface ResponseLimits {
  /** Maximum response size in bytes (default: 10KB) */
  maxBytes: number;
  /** Maximum array items before truncation (default: 10) */
  maxArrayItems: number;
  /** Maximum string length before truncation (default: 500) */
  maxStringLength: number;
  /** Maximum JSON nesting depth (default: 4) */
  maxJsonDepth: number;
  /** Maximum summary length (default: 100) */
  maxSummaryLength: number;
}

export const DEFAULT_LIMITS: ResponseLimits = {
  maxBytes: 10240,        // 10 KB
  maxArrayItems: 10,
  maxStringLength: 500,
  maxJsonDepth: 4,
  maxSummaryLength: 100,
};

// ============================================================================
// Response Contract Types
// ============================================================================

/**
 * Standard MCP response structure for Claude-safe responses
 */
export interface MCPResponseContract {
  /** One-line summary (max 100 chars) - REQUIRED */
  summary: string;
  /** Action success status */
  success: boolean;
  /** Optional count for list/scan results */
  count?: number;
  /** Optional top N items */
  items?: {
    id: string;
    label: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    [key: string]: unknown;
  }[];
  /** Reference to full data stored externally */
  artifactRef?: string;
  /** Indicates more data available */
  hasMore?: boolean;
  /** Cursor for pagination */
  nextCursor?: string;
  /** Additional fields */
  [key: string]: unknown;
}

/**
 * Artifact store function type
 */
export type ArtifactStoreFn = (key: string, data: unknown) => Promise<string>;

// ============================================================================
// Response Wrapper
// ============================================================================

export interface WrapResponseOptions {
  /** One-line summary (will be truncated to 100 chars) */
  summary: string;
  /** Whether the operation succeeded */
  success?: boolean;
  /** Custom response limits */
  limits?: Partial<ResponseLimits>;
  /** Function to store large artifacts externally */
  artifactStore?: ArtifactStoreFn;
  /** Artifact key prefix */
  artifactKeyPrefix?: string;
  /** Force artifact storage regardless of size */
  forceArtifact?: boolean;
}

/**
 * Wrap MCP response to enforce Claude-safe limits
 *
 * @example
 * ```typescript
 * return wrapResponse(bugs, {
 *   summary: `Found ${bugs.length} bugs`,
 *   artifactStore: storeArtifact,
 *   artifactKeyPrefix: 'bugfix:scan',
 * });
 * ```
 */
export async function wrapResponse<T>(
  data: T,
  options: WrapResponseOptions
): Promise<ToolResult> {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const success = options.success ?? true;

  // Calculate original size
  const originalJson = JSON.stringify(data);
  const originalSize = originalJson.length;
  const needsArtifact = originalSize > limits.maxBytes || options.forceArtifact;

  // Store artifact if needed
  let artifactRef: string | undefined;
  if (needsArtifact && options.artifactStore && options.artifactKeyPrefix) {
    const artifactKey = `${options.artifactKeyPrefix}:${Date.now()}`;
    artifactRef = await options.artifactStore(artifactKey, data);
  }

  // Truncate response to fit limits
  const truncated = truncateValue(data, limits, 0);

  // Build response
  const response: MCPResponseContract = {
    summary: options.summary.slice(0, limits.maxSummaryLength),
    success,
    ...truncated as object,
  };

  // Add artifact reference if stored
  if (artifactRef) {
    response.artifactRef = artifactRef;
    response.hasMore = true;
  }

  // Final size check
  const finalJson = JSON.stringify(response, null, 2);
  if (finalJson.length > limits.maxBytes) {
    // Emergency truncation - return minimal response
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: options.summary.slice(0, limits.maxSummaryLength),
          success,
          truncated: true,
          originalSize,
          artifactRef,
          hasMore: true,
          message: 'Response truncated due to size limits',
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: 'text',
      text: finalJson,
    }],
  };
}

/**
 * Create a simple success response
 */
export function successResponse(
  summary: string,
  data?: Record<string, unknown>
): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        summary: summary.slice(0, DEFAULT_LIMITS.maxSummaryLength),
        success: true,
        ...data,
      }, null, 2),
    }],
  };
}

/**
 * Create a simple error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        summary: `Error: ${message}`.slice(0, DEFAULT_LIMITS.maxSummaryLength),
        success: false,
        error: { code, message, ...details },
      }, null, 2),
    }],
    isError: true,
  };
}

// ============================================================================
// Truncation Utilities
// ============================================================================

/**
 * Truncate a value to fit within limits
 */
function truncateValue(
  value: unknown,
  limits: ResponseLimits,
  depth: number
): unknown {
  // Max depth check
  if (depth > limits.maxJsonDepth) {
    return '[depth limit exceeded]';
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return truncateArray(value, limits, depth);
  }

  // Handle strings
  if (typeof value === 'string') {
    return truncateString(value, limits.maxStringLength);
  }

  // Handle objects
  if (typeof value === 'object' && value !== null) {
    return truncateObject(value as Record<string, unknown>, limits, depth);
  }

  // Primitives pass through
  return value;
}

/**
 * Truncate array to max items
 */
function truncateArray(
  arr: unknown[],
  limits: ResponseLimits,
  depth: number
): unknown {
  if (arr.length <= limits.maxArrayItems) {
    return arr.map(item => truncateValue(item, limits, depth + 1));
  }

  // Return truncated array with metadata
  const truncated = arr
    .slice(0, limits.maxArrayItems)
    .map(item => truncateValue(item, limits, depth + 1));

  return {
    items: truncated,
    totalCount: arr.length,
    showing: limits.maxArrayItems,
    hasMore: true,
  };
}

/**
 * Truncate string to max length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate object properties recursively
 */
function truncateObject(
  obj: Record<string, unknown>,
  limits: ResponseLimits,
  depth: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = truncateValue(value, limits, depth + 1);
  }

  return result;
}

// ============================================================================
// Summary Helpers
// ============================================================================

/**
 * Create summary for count-based results
 */
export function createCountSummary(
  action: string,
  count: number,
  bySeverity?: Record<string, number>
): string {
  if (bySeverity) {
    const parts = Object.entries(bySeverity)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');
    return `${action}: ${count} total${parts ? ` (${parts})` : ''}`;
  }
  return `${action}: ${count} item${count !== 1 ? 's' : ''}`;
}

/**
 * Create summary for list results
 */
export function createListSummary(
  domain: string,
  total: number,
  showing: number
): string {
  if (showing < total) {
    return `${domain}: showing ${showing} of ${total}`;
  }
  return `${domain}: ${total} item${total !== 1 ? 's' : ''}`;
}

// ============================================================================
// List Response Helper
// ============================================================================

export interface ListResponseOptions<T> {
  /** Domain name for summary (e.g., "agents", "sessions") */
  domain: string;
  /** Field to use as label (default: 'id') */
  labelField?: keyof T;
  /** Field to use as id (default: 'id') */
  idField?: keyof T;
  /** Maximum items to return (default: 10) */
  limit?: number;
  /** Custom limits */
  limits?: Partial<ResponseLimits>;
}

/**
 * Create a paginated list response
 */
export function createListResponse<T extends Record<string, unknown>>(
  items: T[],
  options: ListResponseOptions<T>
): ToolResult {
  const limit = options.limit ?? DEFAULT_LIMITS.maxArrayItems;
  const idField = options.idField ?? 'id';
  const labelField = options.labelField ?? idField;

  const showing = items.slice(0, limit);
  const hasMore = items.length > limit;

  const response = {
    summary: createListSummary(options.domain, items.length, showing.length),
    success: true,
    items: showing.map(item => ({
      id: String(item[idField as keyof T] ?? ''),
      label: truncateString(String(item[labelField as keyof T] ?? ''), 50),
      ...pickFields(item, ['status', 'severity', 'type', 'enabled']),
    })),
    totalCount: items.length,
    showing: showing.length,
    hasMore,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(response, null, 2),
    }],
  };
}

/**
 * Pick specific fields from an object
 */
function pickFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj && obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}

// ============================================================================
// Scan Response Helper (for bugfix, refactor)
// ============================================================================

export interface ScanResultItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  file?: string | undefined;
  line?: number | undefined;
  [key: string]: unknown;
}

export interface ScanResponseOptions {
  /** Scan type for summary (e.g., "bugs", "refactoring opportunities") */
  scanType: string;
  /** Scan ID for artifact reference */
  scanId: string;
  /** Maximum items to include in response (default: 5) */
  topN?: number;
  /** Artifact store function */
  artifactStore?: ArtifactStoreFn;
}

/**
 * Create a scan response with severity breakdown
 */
export async function createScanResponse(
  results: ScanResultItem[],
  options: ScanResponseOptions
): Promise<ToolResult> {
  const topN = options.topN ?? 5;

  // Count by severity
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const item of results) {
    bySeverity[item.severity] = (bySeverity[item.severity] ?? 0) + 1;
  }

  // Sort by severity (critical first)
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  const sorted = [...results].sort((a, b) => {
    return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
  });

  // Take top N
  const topItems = sorted.slice(0, topN).map(item => ({
    id: item.id,
    severity: item.severity,
    message: truncateString(item.message, 100),
    file: item.file,
    line: item.line,
  }));

  // Store full results if artifact store provided
  let artifactRef: string | undefined;
  if (options.artifactStore && results.length > topN) {
    artifactRef = await options.artifactStore(
      `${options.scanType}:${options.scanId}`,
      results
    );
  }

  const response = {
    summary: createCountSummary(`Found ${options.scanType}`, results.length, bySeverity),
    success: true,
    scanId: options.scanId,
    count: results.length,
    bySeverity,
    topItems,
    hasMore: results.length > topN,
    artifactRef,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(response, null, 2),
    }],
  };
}
