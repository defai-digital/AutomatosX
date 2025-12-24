/**
 * Scaffold Domain Contracts v1
 *
 * Schemas for contract-first scaffolding operations.
 *
 * @module @automatosx/contracts/scaffold/v1
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Valid domain name (lowercase, alphanumeric, hyphens)
 */
export const DomainNameSchema = z
  .string()
  .min(1, 'Domain name is required')
  .max(50, 'Domain name too long')
  .regex(/^[a-z][a-z0-9-]*$/, 'Domain name must be lowercase alphanumeric with hyphens');

/**
 * Package scope (e.g., @myorg)
 */
export const PackageScopeSchema = z
  .string()
  .regex(/^@[a-z][a-z0-9-]*$/, 'Scope must start with @ followed by lowercase alphanumeric');

/**
 * Output path
 */
export const OutputPathSchema = z
  .string()
  .min(1, 'Output path is required')
  .refine((p) => !p.includes('..'), 'Path traversal not allowed');

// ============================================================================
// Scaffold Contract Schemas
// ============================================================================

/**
 * Scaffold contract input
 *
 * Invariants:
 * - INV-SCF-001: Domain name must be valid format
 * - INV-SCF-002: Output path must not traverse directories
 */
export const ScaffoldContractInputSchema = z.object({
  /** Domain name (e.g., 'order', 'payment') */
  name: DomainNameSchema,

  /** Domain description */
  description: z.string().optional(),

  /** Entity names to include (comma-separated) */
  entities: z.string().optional(),

  /** Output directory path */
  output: OutputPathSchema.optional(),

  /** Preview without writing files */
  dryRun: z.boolean().default(false),
});

export type ScaffoldContractInput = z.infer<typeof ScaffoldContractInputSchema>;

/**
 * Scaffold contract output
 */
export const ScaffoldContractOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Human-readable message */
  message: z.string(),

  /** Generated files */
  files: z.array(z.object({
    path: z.string(),
    action: z.enum(['create', 'overwrite', 'skip']),
  })).optional(),

  /** Was this a dry run */
  dryRun: z.boolean(),
});

export type ScaffoldContractOutput = z.infer<typeof ScaffoldContractOutputSchema>;

// ============================================================================
// Scaffold Domain Schemas
// ============================================================================

/**
 * Scaffold domain input
 *
 * Invariants:
 * - INV-SCF-101: Domain must have corresponding contract
 * - INV-SCF-102: Scope must be valid package scope
 */
export const ScaffoldDomainInputSchema = z.object({
  /** Domain name (e.g., 'order', 'payment') */
  name: DomainNameSchema,

  /** Path to existing contract (optional) */
  contract: z.string().optional(),

  /** Output directory path */
  output: OutputPathSchema.optional(),

  /** Package scope (e.g., @automatosx) */
  scope: PackageScopeSchema.optional().default('@automatosx'),

  /** Skip test generation */
  noTests: z.boolean().default(false),

  /** Skip guard policy generation */
  noGuard: z.boolean().default(false),

  /** Preview without writing files */
  dryRun: z.boolean().default(false),
});

export type ScaffoldDomainInput = z.infer<typeof ScaffoldDomainInputSchema>;

/**
 * Scaffold domain output
 */
export const ScaffoldDomainOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Human-readable message */
  message: z.string(),

  /** Generated files */
  files: z.array(z.object({
    path: z.string(),
    action: z.enum(['create', 'overwrite', 'skip']),
  })).optional(),

  /** Was this a dry run */
  dryRun: z.boolean(),
});

export type ScaffoldDomainOutput = z.infer<typeof ScaffoldDomainOutputSchema>;

// ============================================================================
// Scaffold Guard Schemas
// ============================================================================

/**
 * Valid guard gate
 */
export const GuardGateSchema = z.enum([
  'path_violation',
  'dependency',
  'change_radius',
  'contract_tests',
  'secrets',
]);

export type GuardGate = z.infer<typeof GuardGateSchema>;

/**
 * Policy ID format
 */
export const PolicyIdSchema = z
  .string()
  .min(1, 'Policy ID is required')
  .max(50, 'Policy ID too long')
  .regex(/^[a-z][a-z0-9-]*$/, 'Policy ID must be lowercase alphanumeric with hyphens');

/**
 * Scaffold guard input
 *
 * Invariants:
 * - INV-SCF-201: Policy ID must be unique
 * - INV-SCF-202: Change radius must be positive
 * - INV-SCF-203: At least one gate must be specified
 */
export const ScaffoldGuardInputSchema = z.object({
  /** Policy identifier */
  policyId: PolicyIdSchema,

  /** Domain name (inferred from policyId if not provided) */
  domain: DomainNameSchema.optional(),

  /** Change radius limit */
  radius: z.number().int().min(1).max(100).optional().default(3),

  /** Gates to include (comma-separated or array) */
  gates: z.union([
    z.string(),
    z.array(GuardGateSchema),
  ]).optional().default('path_violation,dependency,change_radius,contract_tests'),

  /** Preview without writing files */
  dryRun: z.boolean().default(false),
});

export type ScaffoldGuardInput = z.infer<typeof ScaffoldGuardInputSchema>;

/**
 * Scaffold guard output
 */
export const ScaffoldGuardOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Human-readable message */
  message: z.string(),

  /** Generated files */
  files: z.array(z.object({
    path: z.string(),
    action: z.enum(['create', 'overwrite', 'skip']),
  })).optional(),

  /** Was this a dry run */
  dryRun: z.boolean(),
});

export type ScaffoldGuardOutput = z.infer<typeof ScaffoldGuardOutputSchema>;

// ============================================================================
// Scaffold Project Schemas
// ============================================================================

/**
 * Project template type
 */
export const TemplateTypeSchema = z.enum(['monorepo', 'standalone']);

export type TemplateType = z.infer<typeof TemplateTypeSchema>;

/**
 * Scaffold project input
 *
 * Invariants:
 * - INV-SCF-301: Project name must be valid npm package name
 * - INV-SCF-302: Domain name is required
 * - INV-SCF-303: Template must exist
 */
export const ScaffoldProjectInputSchema = z.object({
  /** Project name */
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name too long')
    .regex(/^[a-z][a-z0-9-]*$/, 'Project name must be lowercase alphanumeric with hyphens'),

  /** Template type */
  template: TemplateTypeSchema.default('standalone'),

  /** Initial domain name */
  domainName: DomainNameSchema,

  /** Package scope */
  scope: PackageScopeSchema.optional().default('@myorg'),

  /** Project description */
  description: z.string().optional(),

  /** Output directory */
  output: OutputPathSchema.optional(),

  /** Preview without writing files */
  dryRun: z.boolean().default(false),
});

export type ScaffoldProjectInput = z.infer<typeof ScaffoldProjectInputSchema>;

/**
 * Scaffold project output
 */
export const ScaffoldProjectOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Human-readable message */
  message: z.string(),

  /** Generated files and directories */
  files: z.array(z.object({
    path: z.string(),
    action: z.string(),
  })).optional(),

  /** Was this a dry run */
  dryRun: z.boolean(),

  /** Next steps for the user */
  nextSteps: z.array(z.string()).optional(),
});

export type ScaffoldProjectOutput = z.infer<typeof ScaffoldProjectOutputSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const ScaffoldErrorCode = {
  INVALID_DOMAIN_NAME: 'SCF_INVALID_DOMAIN_NAME',
  INVALID_POLICY_ID: 'SCF_INVALID_POLICY_ID',
  INVALID_SCOPE: 'SCF_INVALID_SCOPE',
  TEMPLATE_NOT_FOUND: 'SCF_TEMPLATE_NOT_FOUND',
  PATH_TRAVERSAL: 'SCF_PATH_TRAVERSAL',
  FILE_EXISTS: 'SCF_FILE_EXISTS',
  WRITE_FAILED: 'SCF_WRITE_FAILED',
} as const;

export type ScaffoldErrorCode = typeof ScaffoldErrorCode[keyof typeof ScaffoldErrorCode];
