/**
 * Design Domain Contracts v1
 *
 * Schemas for architecture and component design tools.
 */

import { z } from 'zod';

// ============================================================================
// Design Type Schemas
// ============================================================================

/**
 * Design artifact type
 */
export const DesignTypeSchema = z.enum([
  'api',
  'component',
  'schema',
  'architecture',
  'flow',
  'data-model',
  'interface',
  'other',
]);
export type DesignType = z.infer<typeof DesignTypeSchema>;

/**
 * Design format
 */
export const DesignFormatSchema = z.enum([
  'openapi',
  'asyncapi',
  'graphql',
  'json-schema',
  'typescript',
  'mermaid',
  'plantuml',
  'markdown',
  'other',
]);
export type DesignFormat = z.infer<typeof DesignFormatSchema>;

/**
 * Design status
 */
export const DesignStatusSchema = z.enum(['draft', 'review', 'approved', 'implemented', 'deprecated']);
export type DesignStatus = z.infer<typeof DesignStatusSchema>;

// ============================================================================
// Design Artifact Schema
// ============================================================================

/**
 * Design artifact
 */
export const DesignArtifactSchema = z.object({
  designId: z.string().uuid(),
  type: DesignTypeSchema,
  format: DesignFormatSchema,
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).default('1.0.0'),
  status: DesignStatusSchema.default('draft'),
  content: z.string().max(100000),
  filePath: z.string().optional(),
  dependencies: z.array(z.string().uuid()).max(50).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DesignArtifact = z.infer<typeof DesignArtifactSchema>;

// ============================================================================
// API Design Schemas
// ============================================================================

/**
 * HTTP method
 */
export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

/**
 * API endpoint design
 */
export const ApiEndpointSchema = z.object({
  path: z.string().max(500),
  method: HttpMethodSchema,
  summary: z.string().max(200),
  description: z.string().max(2000).optional(),
  requestBody: z.string().max(10000).optional(),
  responseBody: z.string().max(10000).optional(),
  parameters: z.array(z.object({
    name: z.string().max(100),
    in: z.enum(['path', 'query', 'header', 'cookie']),
    required: z.boolean().default(false),
    type: z.string().max(100),
    description: z.string().max(500).optional(),
  })).max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});
export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;

/**
 * API design request
 */
export const ApiDesignRequestSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  endpoints: z.array(ApiEndpointSchema).min(1).max(100),
  baseUrl: z.string().url().optional(),
  version: z.string().max(50).default('1.0.0'),
  format: z.enum(['openapi', 'asyncapi']).default('openapi'),
  outputPath: z.string().optional(),
});
export type ApiDesignRequest = z.infer<typeof ApiDesignRequestSchema>;

/**
 * API design result
 */
export const ApiDesignResultSchema = z.object({
  designId: z.string().uuid(),
  name: z.string(),
  format: z.string(),
  content: z.string().max(100000),
  filePath: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type ApiDesignResult = z.infer<typeof ApiDesignResultSchema>;

// ============================================================================
// Component Design Schemas
// ============================================================================

/**
 * Component type
 */
export const ComponentTypeSchema = z.enum([
  'function',
  'class',
  'module',
  'service',
  'controller',
  'repository',
  'factory',
  'adapter',
  'hook',
  'component',
  'other',
]);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Component design request
 */
export const ComponentDesignRequestSchema = z.object({
  name: z.string().max(200),
  type: ComponentTypeSchema,
  description: z.string().max(2000),
  inputs: z.array(z.object({
    name: z.string().max(100),
    type: z.string().max(200),
    description: z.string().max(500).optional(),
    required: z.boolean().default(true),
  })).max(50).optional(),
  outputs: z.array(z.object({
    name: z.string().max(100),
    type: z.string().max(200),
    description: z.string().max(500).optional(),
  })).max(20).optional(),
  dependencies: z.array(z.string().max(200)).max(30).optional(),
  patterns: z.array(z.string().max(100)).max(10).optional(),
  constraints: z.array(z.string().max(500)).max(20).optional(),
  language: z.enum(['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'other']).default('typescript'),
  outputPath: z.string().optional(),
});
export type ComponentDesignRequest = z.infer<typeof ComponentDesignRequestSchema>;

/**
 * Component design result
 */
export const ComponentDesignResultSchema = z.object({
  designId: z.string().uuid(),
  name: z.string(),
  type: ComponentTypeSchema,
  interface: z.string().max(20000),
  implementation: z.string().max(50000).optional(),
  tests: z.string().max(20000).optional(),
  filePath: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type ComponentDesignResult = z.infer<typeof ComponentDesignResultSchema>;

// ============================================================================
// Schema Design Schemas
// ============================================================================

/**
 * Schema field type
 */
export const SchemaFieldTypeSchema = z.enum([
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
  'null',
  'date',
  'datetime',
  'uuid',
  'email',
  'url',
  'enum',
  'ref',
]);
export type SchemaFieldType = z.infer<typeof SchemaFieldTypeSchema>;

/**
 * Schema field
 */
export const SchemaFieldSchema = z.object({
  name: z.string().max(100),
  type: SchemaFieldTypeSchema,
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
  nullable: z.boolean().default(false),
  default: z.unknown().optional(),
  enumValues: z.array(z.string().max(100)).max(50).optional(),
  refSchema: z.string().max(200).optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().max(500).optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  }).optional(),
});
export type SchemaField = z.infer<typeof SchemaFieldSchema>;

/**
 * Schema design request
 */
export const SchemaDesignRequestSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(SchemaFieldSchema).min(1).max(100),
  format: z.enum(['zod', 'json-schema', 'typescript', 'prisma', 'drizzle']).default('zod'),
  outputPath: z.string().optional(),
});
export type SchemaDesignRequest = z.infer<typeof SchemaDesignRequestSchema>;

/**
 * Schema design result
 */
export const SchemaDesignResultSchema = z.object({
  designId: z.string().uuid(),
  name: z.string(),
  format: z.string(),
  content: z.string().max(50000),
  filePath: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type SchemaDesignResult = z.infer<typeof SchemaDesignResultSchema>;

// ============================================================================
// Architecture Design Schemas
// ============================================================================

/**
 * Architecture pattern
 */
export const ArchitecturePatternSchema = z.enum([
  'hexagonal',
  'clean',
  'layered',
  'microservices',
  'event-driven',
  'cqrs',
  'ddd',
  'mvc',
  'mvvm',
  'pipe-filter',
  'other',
]);
export type ArchitecturePattern = z.infer<typeof ArchitecturePatternSchema>;

/**
 * Architecture component
 */
export const ArchitectureComponentSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  type: z.enum(['domain', 'application', 'infrastructure', 'presentation', 'adapter', 'port', 'service', 'database', 'queue', 'cache', 'external']),
  description: z.string().max(1000).optional(),
  dependencies: z.array(z.string().max(100)).max(30).optional(),
});
export type ArchitectureComponent = z.infer<typeof ArchitectureComponentSchema>;

/**
 * Architecture design request
 */
export const ArchitectureDesignRequestSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(5000),
  pattern: ArchitecturePatternSchema,
  components: z.array(ArchitectureComponentSchema).min(1).max(50),
  constraints: z.array(z.string().max(500)).max(20).optional(),
  format: z.enum(['mermaid', 'plantuml', 'markdown', 'c4']).default('mermaid'),
  outputPath: z.string().optional(),
});
export type ArchitectureDesignRequest = z.infer<typeof ArchitectureDesignRequestSchema>;

/**
 * Architecture design result
 */
export const ArchitectureDesignResultSchema = z.object({
  designId: z.string().uuid(),
  name: z.string(),
  pattern: ArchitecturePatternSchema,
  diagram: z.string().max(50000),
  documentation: z.string().max(100000).optional(),
  filePath: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type ArchitectureDesignResult = z.infer<typeof ArchitectureDesignResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const DesignErrorCode = {
  DESIGN_NOT_FOUND: 'DESIGN_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  GENERATION_FAILED: 'GENERATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
} as const;

export type DesignErrorCode = (typeof DesignErrorCode)[keyof typeof DesignErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateApiDesignRequest(data: unknown): ApiDesignRequest {
  return ApiDesignRequestSchema.parse(data);
}

export function validateComponentDesignRequest(data: unknown): ComponentDesignRequest {
  return ComponentDesignRequestSchema.parse(data);
}

export function validateSchemaDesignRequest(data: unknown): SchemaDesignRequest {
  return SchemaDesignRequestSchema.parse(data);
}

export function validateArchitectureDesignRequest(data: unknown): ArchitectureDesignRequest {
  return ArchitectureDesignRequestSchema.parse(data);
}

export function safeValidateApiDesignRequest(
  data: unknown
): { success: true; data: ApiDesignRequest } | { success: false; error: z.ZodError } {
  const result = ApiDesignRequestSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
