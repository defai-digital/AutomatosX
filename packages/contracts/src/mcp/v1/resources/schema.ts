/**
 * MCP Resource Contracts
 *
 * Zod schemas for MCP resources (application-controlled, read-only data).
 *
 * Invariants:
 * - INV-MCP-RES-001: Resources are read-only
 * - INV-MCP-RES-002: URI patterns follow RFC 3986
 * - INV-MCP-RES-003: Content returned as JSON text
 */

import { z } from 'zod';

// ============================================================================
// Resource Definition Schema
// ============================================================================

/**
 * MCP Resource definition
 */
export const McpResourceSchema = z.object({
  /** Unique resource identifier (URI format) */
  uri: z.string().min(1),
  /** Human-readable name */
  name: z.string().min(1),
  /** Description of the resource */
  description: z.string().optional(),
  /** MIME type of resource content */
  mimeType: z.string().default('application/json'),
});

export type McpResource = z.infer<typeof McpResourceSchema>;

// ============================================================================
// Resource List Response
// ============================================================================

/**
 * Response for resources/list method
 */
export const ResourceListResponseSchema = z.object({
  resources: z.array(McpResourceSchema),
});

export type ResourceListResponse = z.infer<typeof ResourceListResponseSchema>;

// ============================================================================
// Resource Content Schema
// ============================================================================

/**
 * Content item returned when reading a resource
 */
export const ResourceContentSchema = z.object({
  /** URI of the resource */
  uri: z.string(),
  /** MIME type of the content */
  mimeType: z.string(),
  /** Text content (for text-based resources) */
  text: z.string().optional(),
  /** Base64-encoded binary content */
  blob: z.string().optional(),
});

export type ResourceContent = z.infer<typeof ResourceContentSchema>;

// ============================================================================
// Resource Read Response
// ============================================================================

/**
 * Response for resources/read method
 */
export const ResourceReadResponseSchema = z.object({
  contents: z.array(ResourceContentSchema),
});

export type ResourceReadResponse = z.infer<typeof ResourceReadResponseSchema>;

// ============================================================================
// Resource Error Codes
// ============================================================================

/**
 * Resource-specific error codes
 */
export const ResourceErrorCode = {
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INVALID_URI: 'INVALID_URI',
  READ_FAILED: 'READ_FAILED',
} as const;

export type ResourceErrorCode = (typeof ResourceErrorCode)[keyof typeof ResourceErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates resource definition
 */
export function validateResource(data: unknown): McpResource {
  return McpResourceSchema.parse(data);
}

/**
 * Validates resource list response
 */
export function validateResourceListResponse(data: unknown): ResourceListResponse {
  return ResourceListResponseSchema.parse(data);
}

/**
 * Validates resource read response
 */
export function validateResourceReadResponse(data: unknown): ResourceReadResponse {
  return ResourceReadResponseSchema.parse(data);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a resource definition
 */
export function createResource(
  uri: string,
  name: string,
  description?: string,
  mimeType?: string
): McpResource {
  return {
    uri,
    name,
    description,
    mimeType: mimeType ?? 'application/json',
  };
}

/**
 * Creates resource content
 */
export function createResourceContent(
  uri: string,
  content: unknown,
  mimeType = 'application/json'
): ResourceContent {
  return {
    uri,
    mimeType,
    text: JSON.stringify(content, null, 2),
  };
}
