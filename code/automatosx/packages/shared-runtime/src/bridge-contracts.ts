import { join } from 'node:path';
import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const AUTOMATOSX_DIRECTORY = '.automatosx';
export const BRIDGE_DIRECTORY = 'bridges';
export const SKILL_DIRECTORY = 'skills';
export const CANONICAL_BRIDGE_FILE = 'bridge.json';
export const CANONICAL_SKILL_FILE = 'skill.json';
export const SKILL_MARKDOWN_FILE = 'SKILL.md';

export const BridgeKindSchema = z.enum([
  'command',
  'service',
  'script',
  'external',
  'generated',
]);

export const ApprovalSpecSchema = z.object({
  mode: z.enum(['prompt', 'policy', 'auto']),
  policyId: nonEmptyStringSchema.optional(),
}).passthrough();

export const ProvenanceSpecSchema = z.object({
  type: nonEmptyStringSchema,
  ref: nonEmptyStringSchema.optional(),
  importedAt: nonEmptyStringSchema.optional(),
  importer: nonEmptyStringSchema.optional(),
}).passthrough();

export const SkillDispatchModeSchema = z.enum([
  'prompt',
  'delegate',
  'bridge',
]);

export const SkillSpecSchema = z.object({
  skillId: nonEmptyStringSchema,
  name: nonEmptyStringSchema.optional(),
  description: nonEmptyStringSchema.optional(),
  dispatch: SkillDispatchModeSchema,
  userInvocable: z.boolean().optional(),
  modelInvocable: z.boolean().optional(),
  linkedBridgeId: nonEmptyStringSchema.optional(),
  linkedAgentId: nonEmptyStringSchema.optional(),
  approval: ApprovalSpecSchema.optional(),
  provenance: ProvenanceSpecSchema.optional(),
}).passthrough();

export const BridgeArtifactSchema = z.object({
  kind: nonEmptyStringSchema,
  name: nonEmptyStringSchema.optional(),
  path: nonEmptyStringSchema.optional(),
  command: nonEmptyStringSchema.optional(),
}).passthrough();

export const BridgeSpecSchema = z.object({
  schemaVersion: z.literal(1),
  bridgeId: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  kind: BridgeKindSchema,
  source: z.object({
    type: nonEmptyStringSchema,
    ref: nonEmptyStringSchema,
  }).passthrough().optional(),
  entrypoint: z.object({
    type: z.enum(['command', 'script', 'url', 'module', 'manual']),
    command: nonEmptyStringSchema.optional(),
    path: nonEmptyStringSchema.optional(),
    module: nonEmptyStringSchema.optional(),
    url: nonEmptyStringSchema.optional(),
    args: z.array(z.string()).optional(),
  }).passthrough().refine((value) => (
    value.type === 'manual'
      || value.command !== undefined
      || value.path !== undefined
      || value.module !== undefined
      || value.url !== undefined
  ), {
    message: 'entrypoint must declare command, path, module, or url unless type is manual',
  }),
  capabilities: z.array(nonEmptyStringSchema).default([]),
  tags: z.array(nonEmptyStringSchema).default([]),
  skills: z.array(SkillSpecSchema).default([]),
  artifacts: z.object({
    runtime: z.array(BridgeArtifactSchema).default([]),
    skills: z.array(BridgeArtifactSchema).default([]),
  }).default({
    runtime: [],
    skills: [],
  }),
  approval: ApprovalSpecSchema.optional(),
  provenance: ProvenanceSpecSchema.optional(),
}).passthrough();

export type BridgeSpec = z.infer<typeof BridgeSpecSchema>;
export type SkillSpec = z.infer<typeof SkillSpecSchema>;
export type ApprovalSpec = z.infer<typeof ApprovalSpecSchema>;
export type ProvenanceSpec = z.infer<typeof ProvenanceSpecSchema>;

export function resolveBridgeRoot(basePath: string): string {
  return join(basePath, AUTOMATOSX_DIRECTORY, BRIDGE_DIRECTORY);
}

export function resolveSkillRoot(basePath: string): string {
  return join(basePath, AUTOMATOSX_DIRECTORY, SKILL_DIRECTORY);
}

export function formatSchemaErrors(error: z.ZodError): string {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  }).join('; ');
}
