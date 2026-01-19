/**
 * Scaffold Command
 *
 * CLI command for scaffolding contract-first project components.
 * Generates Zod schemas, invariants, guard policies, and domain packages.
 *
 * @module cli/commands/scaffold
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  GUARD_RADIUS_DEFAULT,
  GUARD_GATES_DEFAULT,
  SCAFFOLD_SCOPE_DEFAULT,
  SCAFFOLD_TEMPLATE_DEFAULT,
} from '@defai.digital/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface ScaffoldContractOptions {
  name: string;
  description?: string | undefined;
  entities?: string | undefined;
  output?: string | undefined;
  dryRun?: boolean | undefined;
}

interface ScaffoldProjectOptions {
  projectName: string;
  template: 'monorepo' | 'standalone';
  domainName: string;
  scope?: string | undefined;
  description?: string | undefined;
  output?: string | undefined;
  dryRun?: boolean | undefined;
}

interface ScaffoldDomainOptions {
  name: string;
  contract?: string | undefined;
  output?: string | undefined;
  scope?: string | undefined;
  noTests?: boolean | undefined;
  noGuard?: boolean | undefined;
  dryRun?: boolean | undefined;
}

interface ScaffoldGuardOptions {
  policyId: string;
  domain?: string | undefined;
  radius?: number | undefined;
  gates?: string | undefined;
  dryRun?: boolean | undefined;
}

interface TemplateConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  variables: Record<string, {
    type: string;
    required?: boolean;
    default?: string;
    description: string;
  }>;
  structure: {
    type?: 'file' | 'directory';
    path: string;
    template?: string;
  }[];
  postCreate: string[] | {
    command: string;
    description: string;
  }[];
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Generate Zod schema template
 */
function generateSchemaTemplate(name: string, description: string): string {
  const pascalName = toPascalCase(name);
  const domainCode = name.substring(0, 3).toUpperCase();

  return `/**
 * ${pascalName} Domain Contracts v1
 *
 * ${description}
 *
 * @module @defai.digital/contracts/${name}/v1
 */

import { z } from 'zod';

// ============================================================================
// Value Objects
// ============================================================================

/**
 * ${pascalName} ID value object
 */
export const ${pascalName}IdSchema = z.string().uuid();

export type ${pascalName}Id = z.infer<typeof ${pascalName}IdSchema>;

// ============================================================================
// Enums
// ============================================================================

/**
 * ${pascalName} status
 */
export const ${pascalName}StatusSchema = z.enum([
  'draft',
  'active',
  'completed',
  'cancelled',
]);

export type ${pascalName}Status = z.infer<typeof ${pascalName}StatusSchema>;

// ============================================================================
// Entities
// ============================================================================

/**
 * ${pascalName} entity - Aggregate Root
 *
 * Invariants:
 * - INV-${domainCode}-001: ID must be valid UUID
 * - INV-${domainCode}-002: Status must be valid enum value
 */
export const ${pascalName}Schema = z.object({
  /** Unique identifier */
  id: ${pascalName}IdSchema,

  /** Current status */
  status: ${pascalName}StatusSchema,

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ${pascalName} = z.infer<typeof ${pascalName}Schema>;

// ============================================================================
// Domain Events
// ============================================================================

/**
 * ${pascalName} domain events
 */
export const ${pascalName}EventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('${name}.created'),
    ${name}Id: ${pascalName}IdSchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('${name}.updated'),
    ${name}Id: ${pascalName}IdSchema,
    changes: z.record(z.unknown()),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('${name}.deleted'),
    ${name}Id: ${pascalName}IdSchema,
    occurredAt: z.string().datetime(),
  }),
]);

export type ${pascalName}Event = z.infer<typeof ${pascalName}EventSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Create ${pascalName} request
 */
export const Create${pascalName}RequestSchema = z.object({
  // Add fields as needed
});

export type Create${pascalName}Request = z.infer<typeof Create${pascalName}RequestSchema>;

/**
 * Update ${pascalName} request
 */
export const Update${pascalName}RequestSchema = z.object({
  id: ${pascalName}IdSchema,
  // Add fields as needed
});

export type Update${pascalName}Request = z.infer<typeof Update${pascalName}RequestSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validate${pascalName}(data: unknown): ${pascalName} {
  return ${pascalName}Schema.parse(data);
}

export function validate${pascalName}Event(data: unknown): ${pascalName}Event {
  return ${pascalName}EventSchema.parse(data);
}

// ============================================================================
// Error Codes
// ============================================================================

export const ${pascalName}ErrorCode = {
  NOT_FOUND: '${domainCode}_NOT_FOUND',
  INVALID_STATUS: '${domainCode}_INVALID_STATUS',
  VALIDATION_FAILED: '${domainCode}_VALIDATION_FAILED',
} as const;

export type ${pascalName}ErrorCode = typeof ${pascalName}ErrorCode[keyof typeof ${pascalName}ErrorCode];
`;
}

/**
 * Generate invariants template
 */
function generateInvariantsTemplate(name: string, description: string): string {
  const pascalName = toPascalCase(name);
  const domainCode = name.substring(0, 3).toUpperCase();

  return `# ${pascalName} Domain Invariants

## Overview

${description}

## Schema Invariants

### INV-${domainCode}-001: Valid ID Format
${pascalName} ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: \`z.string().uuid()\` rejects invalid UUIDs

### INV-${domainCode}-002: Valid Status
Status MUST be one of the defined enum values.
- **Enforcement**: schema
- **Test**: \`z.enum([...])\` rejects invalid values

## Runtime Invariants

### INV-${domainCode}-101: Status Transitions
Status transitions MUST follow the defined state machine.
- **Enforcement**: runtime
- **Test**: Invalid transitions throw error
- **Valid Transitions**:
  \`\`\`
  draft     → active, cancelled
  active    → completed, cancelled
  completed → (terminal state)
  cancelled → (terminal state)
  \`\`\`

### INV-${domainCode}-102: Timestamp Consistency
UpdatedAt MUST be >= CreatedAt.
- **Enforcement**: runtime
- **Test**: Update with earlier timestamp → error

## Business Invariants

### INV-${domainCode}-201: [Add business rules]
[Description of business invariant]
- **Enforcement**: [schema|runtime|test]
- **Test**: [How to verify]
- **Owner**: [Team]

## Cross-Aggregate Invariants

### INV-${domainCode}-301: [Add cross-aggregate rules]
[Description of cross-aggregate invariant]
- **Enforcement**: [saga|event handler]
- **Aggregates**: [List of aggregates]
- **Event**: [Triggering event] → [Resulting action]
`;
}

/**
 * Generate guard policy template
 */
function generateGuardPolicyTemplate(
  policyId: string,
  domain: string,
  radius: number,
  gates: string[]
): string {
  return `# ${toPascalCase(domain)} Domain Guard Policy
#
# This policy governs changes to the ${domain} domain.

policy_id: ${policyId}

description: |
  Guard policy for ${domain} domain development.

allowed_paths:
  # Contract package
  - packages/contracts/src/${domain}/**
  - packages/contracts/src/${domain}/v1/schema.ts
  - packages/contracts/src/${domain}/v1/invariants.md
  - packages/contracts/src/${domain}/v1/index.ts

  # Domain package
  - packages/core/${domain}-domain/**
  - packages/core/${domain}-domain/src/**

  # Tests
  - tests/contract/${domain}.test.ts
  - tests/core/${domain}-domain.test.ts
  - tests/integration/${domain}/**

forbidden_paths:
  # Other domains' contracts
  - packages/contracts/src/*/v1/schema.ts
  - "!packages/contracts/src/${domain}/v1/schema.ts"

  # Infrastructure
  - packages/cli/**
  - packages/mcp-server/**
  - packages/guard/**

  # Adapters
  - packages/adapters/**

required_contracts:
  - ${domain}

gates:
${gates.map((g) => `  - ${g}`).join('\n')}

change_radius_limit: ${radius}

variables:
  domain: ${domain}

metadata:
  owner: ${domain}-team
  created_at: "${new Date().toISOString().split('T')[0]}"
  severity: medium
  auto_apply: false
`;
}

/**
 * Generate index.ts template
 */
function generateIndexTemplate(name: string): string {
  return `/**
 * ${toPascalCase(name)} Contracts v1
 *
 * @module @defai.digital/contracts/${name}/v1
 */

export * from './schema.js';
`;
}

/**
 * Generate domain package.json template
 */
function generatePackageJsonTemplate(name: string, scope: string): string {
  return JSON.stringify(
    {
      name: `${scope}/${name}-domain`,
      version: '1.0.0',
      description: `${toPascalCase(name)} domain implementation`,
      type: 'module',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          import: './dist/index.js',
          types: './dist/index.d.ts',
        },
      },
      scripts: {
        build: 'tsc --build',
        clean: 'rm -rf dist',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@defai.digital/contracts': 'workspace:*',
      },
      devDependencies: {
        typescript: '^5.3.0',
      },
    },
    null,
    2
  );
}

/**
 * Generate domain index.ts template
 */
function generateDomainIndexTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `/**
 * ${pascalName} Domain
 *
 * @module @defai.digital/${name}-domain
 */

export * from './types.js';
export * from './service.js';
`;
}

/**
 * Generate domain types.ts template
 */
function generateDomainTypesTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `/**
 * ${pascalName} Domain Types
 */

import type { ${pascalName}, ${pascalName}Event } from '@defai.digital/contracts';

/**
 * ${pascalName} repository interface
 */
export interface ${pascalName}Repository {
  findById(id: string): Promise<${pascalName} | undefined>;
  findAll(): Promise<${pascalName}[]>;
  save(entity: ${pascalName}): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * ${pascalName} event publisher interface
 */
export interface ${pascalName}EventPublisher {
  publish(event: ${pascalName}Event): Promise<void>;
}

/**
 * ${pascalName} service dependencies
 */
export interface ${pascalName}ServiceDeps {
  repository: ${pascalName}Repository;
  eventPublisher: ${pascalName}EventPublisher;
}
`;
}

/**
 * Generate domain service.ts template
 */
function generateDomainServiceTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `/**
 * ${pascalName} Domain Service
 */

import type { ${pascalName} } from '@defai.digital/contracts';
import type { ${pascalName}ServiceDeps } from './types.js';

/**
 * ${pascalName} service
 */
export class ${pascalName}Service {
  constructor(private readonly deps: ${pascalName}ServiceDeps) {}

  async findById(id: string): Promise<${pascalName} | undefined> {
    return this.deps.repository.findById(id);
  }

  async findAll(): Promise<${pascalName}[]> {
    return this.deps.repository.findAll();
  }

  // Add domain operations here
}

/**
 * Create ${pascalName} service
 */
export function create${pascalName}Service(deps: ${pascalName}ServiceDeps): ${pascalName}Service {
  return new ${pascalName}Service(deps);
}
`;
}

/**
 * Generate test file template
 */
function generateTestTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const domainCode = name.substring(0, 3).toUpperCase();

  return `/**
 * ${pascalName} Contract Tests
 *
 * Tests for schema validation and invariant enforcement.
 */

import { describe, it, expect } from 'vitest';
import {
  ${pascalName}Schema,
  ${pascalName}EventSchema,
  validate${pascalName},
  ${pascalName}ErrorCode,
} from '@defai.digital/contracts';

describe('${pascalName} Contract', () => {
  describe('Schema Validation', () => {
    // INV-${domainCode}-001: Valid ID Format
    it('should reject invalid UUID', () => {
      const invalid = {
        id: 'not-a-uuid',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => ${pascalName}Schema.parse(invalid)).toThrow();
    });

    // INV-${domainCode}-002: Valid Status
    it('should reject invalid status', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'invalid-status',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => ${pascalName}Schema.parse(invalid)).toThrow();
    });

    it('should accept valid entity', () => {
      const valid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(() => ${pascalName}Schema.parse(valid)).not.toThrow();
    });
  });

  describe('Event Validation', () => {
    it('should accept valid created event', () => {
      const event = {
        type: '${name}.created',
        ${name}Id: '550e8400-e29b-41d4-a716-446655440000',
        occurredAt: new Date().toISOString(),
      };

      expect(() => ${pascalName}EventSchema.parse(event)).not.toThrow();
    });

    it('should reject event with invalid type', () => {
      const event = {
        type: 'invalid.event',
        ${name}Id: '550e8400-e29b-41d4-a716-446655440000',
        occurredAt: new Date().toISOString(),
      };

      expect(() => ${pascalName}EventSchema.parse(event)).toThrow();
    });
  });
});
`;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert string to UPPER_CASE
 */
function toUpperCase(str: string): string {
  return str.toUpperCase();
}

/**
 * Get substring
 */
function substring(str: string, start: number, end: number): string {
  return str.substring(start, end);
}

/**
 * Simple Handlebars-like template engine
 * Supports: {{variable}}, {{pascalCase variable}}, {{upperCase (substring variable 0 3)}}
 */
function processTemplate(template: string, variables: Record<string, string>): string {
  // Helper function registry
  const helpers: Record<string, (...args: string[]) => string> = {
    pascalCase: (s) => toPascalCase(s),
    upperCase: (s) => toUpperCase(s),
    substring: (s, start, end) => substring(s, parseInt(start, 10), parseInt(end, 10)),
  };

  // Process nested helpers like {{upperCase (substring domainName 0 3)}}
  let result = template.replace(/\{\{(\w+)\s+\((\w+)\s+(\w+)\s+(\d+)\s+(\d+)\)\}\}/g,
    (_, outerHelper, innerHelper, varName, start, end) => {
      const value = variables[varName] || varName;
      const innerResult = helpers[innerHelper] ? helpers[innerHelper](value, start, end) : value;
      return helpers[outerHelper] ? helpers[outerHelper](innerResult) : innerResult;
    }
  );

  // Process single helpers like {{pascalCase domainName}}
  result = result.replace(/\{\{(\w+)\s+(\w+)\}\}/g, (_, helper, varName) => {
    const value = variables[varName] || varName;
    return helpers[helper] ? helpers[helper](value) : value;
  });

  // Process simple variables like {{domainName}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return variables[varName] || '';
  });

  return result;
}

/**
 * Write file with optional dry-run
 */
function writeFile(
  filePath: string,
  content: string,
  dryRun: boolean,
  files: { path: string; action: string }[]
): void {
  const action = fs.existsSync(filePath) ? 'overwrite' : 'create';
  files.push({ path: filePath, action });

  if (!dryRun) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Handle scaffold contract subcommand
 */
async function handleScaffoldContract(
  options: ScaffoldContractOptions
): Promise<CommandResult> {
  const { name, description = `${toPascalCase(name)} domain.`, output, dryRun = false } = options;

  const outputDir = output || `packages/contracts/src/${name}/v1`;
  const files: { path: string; action: string }[] = [];

  // Generate files
  writeFile(
    path.join(outputDir, 'schema.ts'),
    generateSchemaTemplate(name, description),
    dryRun,
    files
  );

  writeFile(
    path.join(outputDir, 'invariants.md'),
    generateInvariantsTemplate(name, description),
    dryRun,
    files
  );

  writeFile(path.join(outputDir, 'index.ts'), generateIndexTemplate(name), dryRun, files);

  const message = dryRun
    ? `Dry run - would create ${files.length} files:\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`
    : `Created contract for "${name}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`;

  return {
    success: true,
    message,
    data: { name, files, dryRun },
    exitCode: 0,
  };
}

/**
 * Handle scaffold domain subcommand
 */
async function handleScaffoldDomain(
  options: ScaffoldDomainOptions
): Promise<CommandResult> {
  const {
    name,
    output,
    scope = SCAFFOLD_SCOPE_DEFAULT,
    noTests = false,
    noGuard = false,
    dryRun = false,
  } = options;

  const domainDir = output || `packages/core/${name}-domain`;
  const files: { path: string; action: string }[] = [];

  // Generate domain package files
  writeFile(
    path.join(domainDir, 'package.json'),
    generatePackageJsonTemplate(name, scope),
    dryRun,
    files
  );

  writeFile(
    path.join(domainDir, 'src', 'index.ts'),
    generateDomainIndexTemplate(name),
    dryRun,
    files
  );

  writeFile(
    path.join(domainDir, 'src', 'types.ts'),
    generateDomainTypesTemplate(name),
    dryRun,
    files
  );

  writeFile(
    path.join(domainDir, 'src', 'service.ts'),
    generateDomainServiceTemplate(name),
    dryRun,
    files
  );

  // Generate test file
  if (!noTests) {
    writeFile(
      `tests/contract/${name}.test.ts`,
      generateTestTemplate(name),
      dryRun,
      files
    );
  }

  // Generate guard policy
  if (!noGuard) {
    writeFile(
      `packages/guard/policies/${name}-development.yaml`,
      generateGuardPolicyTemplate(
        `${name}-development`,
        name,
        GUARD_RADIUS_DEFAULT,
        [...GUARD_GATES_DEFAULT]
      ),
      dryRun,
      files
    );
  }

  const message = dryRun
    ? `Dry run - would create ${files.length} files:\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`
    : `Created domain package for "${name}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`;

  return {
    success: true,
    message,
    data: { name, files, dryRun },
    exitCode: 0,
  };
}

/**
 * Handle scaffold guard subcommand
 */
async function handleScaffoldGuard(
  options: ScaffoldGuardOptions
): Promise<CommandResult> {
  const {
    policyId,
    domain = policyId.replace(/-development$/, ''),
    radius = GUARD_RADIUS_DEFAULT,
    gates = GUARD_GATES_DEFAULT.join(','),
    dryRun = false,
  } = options;

  const gatesList = gates.split(',').map((g) => g.trim());
  const files: { path: string; action: string }[] = [];

  writeFile(
    `packages/guard/policies/${policyId}.yaml`,
    generateGuardPolicyTemplate(policyId, domain, radius, gatesList),
    dryRun,
    files
  );

  const message = dryRun
    ? `Dry run - would create ${files.length} files:\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`
    : `Created guard policy "${policyId}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`;

  return {
    success: true,
    message,
    data: { policyId, domain, files, dryRun },
    exitCode: 0,
  };
}

/**
 * Handle scaffold project subcommand
 */
async function handleScaffoldProject(
  options: ScaffoldProjectOptions
): Promise<CommandResult> {
  const {
    projectName,
    template,
    domainName,
    scope = SCAFFOLD_SCOPE_DEFAULT,
    description = 'A contract-first TypeScript project',
    output,
    dryRun = false,
  } = options;

  // Find templates directory - check bundled first, then development path
  // Bundled: packages/cli/dist/commands -> cli/dist -> cli -> bundled/templates
  // Development: packages/cli/dist/commands -> cli/dist -> cli -> packages -> automatosx/templates
  const bundledTemplatesDir = path.resolve(__dirname, '../../bundled/templates');
  const devTemplatesDir = path.resolve(__dirname, '../../../../templates');
  const templatesDir = fs.existsSync(bundledTemplatesDir) ? bundledTemplatesDir : devTemplatesDir;
  const templateDir = path.join(templatesDir, template);

  // Check if template exists
  if (!fs.existsSync(templateDir)) {
    return {
      success: false,
      message: `Template "${template}" not found. Available templates: monorepo, standalone`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Load template config
  const configPath = path.join(templateDir, 'template.json');
  if (!fs.existsSync(configPath)) {
    return {
      success: false,
      message: `Template config not found: ${configPath}`,
      data: undefined,
      exitCode: 1,
    };
  }

  let config: TemplateConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    return {
      success: false,
      message: `Failed to parse template config: ${e}`,
      data: undefined,
      exitCode: 1,
    };
  }

  // Prepare variables for template processing
  const variables: Record<string, string> = {
    projectName,
    domainName,
    scope,
    description,
  };

  // Determine output directory
  const outputDir = output || projectName;
  const files: { path: string; action: string }[] = [];

  // Process each item in the template structure
  for (const item of config.structure) {
    // Process path with variables (e.g., {{domainName}})
    const outputPath = processTemplate(item.path, variables);
    const fullOutputPath = path.join(outputDir, outputPath);

    // Handle directory items
    if (item.type === 'directory') {
      const action = fs.existsSync(fullOutputPath) ? 'exists' : 'create';
      files.push({ path: fullOutputPath, action: `${action} (dir)` });

      if (!dryRun && !fs.existsSync(fullOutputPath)) {
        fs.mkdirSync(fullOutputPath, { recursive: true });
      }
      continue;
    }

    // Handle file items
    if (!item.template) {
      continue;
    }

    // Read template file
    const templatePath = path.join(templateDir, item.template);
    if (!fs.existsSync(templatePath)) {
      // Template file doesn't exist, skip
      continue;
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Process template content
    const processedContent = processTemplate(templateContent, variables);

    // Write file
    writeFile(fullOutputPath, processedContent, dryRun, files);
  }

  // Format postCreate commands
  const postCreateCommands = config.postCreate.map(c =>
    typeof c === 'string' ? c : c.command
  );

  const message = dryRun
    ? `Dry run - would create project "${projectName}" with ${files.length} items:\n` +
      `Template: ${config.displayName}\n\n` +
      `Items:\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}\n\n` +
      `Post-create commands:\n${postCreateCommands.map(c => `  ${c}`).join('\n')}`
    : `Created project "${projectName}":\n` +
      `Template: ${config.displayName}\n\n` +
      `Items:\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}\n\n` +
      `Next steps:\n` +
      `  cd ${outputDir}\n` +
      postCreateCommands.map(c => `  ${c}`).join('\n');

  return {
    success: true,
    message,
    data: { projectName, template, domainName, files, dryRun },
    exitCode: 0,
  };
}

// ============================================================================
// Main Command
// ============================================================================

/**
 * Handles the 'scaffold' command
 *
 * Subcommands:
 *   scaffold project <name>   - Generate new project from template
 *   scaffold contract <name>  - Generate Zod schema and invariants
 *   scaffold domain <name>    - Generate complete domain package
 *   scaffold guard <id>       - Generate guard policy
 */
export async function scaffoldCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Handle help request
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return {
      success: true,
      message:
        'Usage: ax scaffold <subcommand> [options]\n\n' +
        'Subcommands:\n' +
        '  project <name>   Generate new project from template\n' +
        '  contract <name>  Generate Zod schema and invariants\n' +
        '  domain <name>    Generate complete domain package\n' +
        '  guard <id>       Generate guard policy\n\n' +
        'Options:\n' +
        '  -t, --template <type>     Template: monorepo or standalone (default: standalone)\n' +
        '  -m, --domain <name>       Primary domain name (required for project)\n' +
        '  -d, --description <desc>  Domain/project description\n' +
        '  -o, --output <path>       Output directory\n' +
        '  -s, --scope <scope>       Package scope (default: @myorg)\n' +
        '  -r, --radius <n>          Change radius limit (default: 3)\n' +
        '  -g, --gates <gates>       Comma-separated gates\n' +
        '  --no-tests                Skip test scaffolds\n' +
        '  --no-guard                Skip guard policy\n' +
        '  --dry-run                 Preview without writing files',
      data: undefined,
      exitCode: 0,
    };
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  // Parse common options
  // Note: Due to CLI parser behavior, flag values appear as positional args
  // BEFORE their flags. We need to handle this specially.
  const dryRun = options.verbose || subArgs.includes('--dry-run');

  // Separate flags from non-flags and track flag positions
  const flags: string[] = [];
  const nonFlags: string[] = [];
  const boolFlags = new Set(['--dry-run', '--no-tests', '--no-guard']);

  for (const arg of subArgs) {
    if (arg.startsWith('-')) {
      flags.push(arg);
    } else {
      nonFlags.push(arg);
    }
  }

  // Map of flag to value based on order of appearance
  // The parser puts values before flags, so nonFlags[i] corresponds to flags[i] (if flags[i] expects a value)
  const flagOrder = ['-m', '--domain', '-t', '--template', '-s', '--scope', '-d', '--description',
                     '-o', '--output', '-r', '--radius', '-g', '--gates'];

  // Build a map of flags that are present
  const presentFlags: string[] = [];
  for (const flag of flags) {
    if (!boolFlags.has(flag) && flagOrder.includes(flag)) {
      presentFlags.push(flag);
    }
  }

  // Match values to flags by order (after skipping the first non-flag which is the name)
  const flagValueMap = new Map<string, string>();
  const numValues = nonFlags.length > 0 ? nonFlags.length - 1 : 0; // First nonFlag is the name

  // presentFlags appear in the order their values appeared in nonFlags
  for (let i = 0; i < Math.min(numValues, presentFlags.length); i++) {
    const value = nonFlags[i + 1]; // Skip the first (name)
    const flag = presentFlags[i];
    if (value && flag) {
      flagValueMap.set(flag, value);
    }
  }

  // Get option values from the map
  const descriptionValue = flagValueMap.get('-d') || flagValueMap.get('--description');
  const outputValue = flagValueMap.get('-o') || flagValueMap.get('--output');
  const scopeValue = flagValueMap.get('-s') || flagValueMap.get('--scope');
  const radiusValue = flagValueMap.get('-r') || flagValueMap.get('--radius');
  const gatesValue = flagValueMap.get('-g') || flagValueMap.get('--gates');
  const templateValue = flagValueMap.get('-t') || flagValueMap.get('--template');
  const domainValue = flagValueMap.get('-m') || flagValueMap.get('--domain');

  // First non-flag is the name
  const positionalArgs = nonFlags.length > 0 ? [nonFlags[0]] : [];

  switch (subcommand) {
    case 'project': {
      const projectName = positionalArgs[0];

      if (!projectName) {
        return {
          success: false,
          message: 'Usage: ax scaffold project <name> -m <domain> [options]\n\n' +
            'Example: ax scaffold project my-app -m order -t monorepo',
          data: undefined,
          exitCode: 1,
        };
      }
      if (!domainValue) {
        return {
          success: false,
          message: 'Domain name is required. Use -m or --domain to specify.\n\n' +
            'Example: ax scaffold project my-app -m order',
          data: undefined,
          exitCode: 1,
        };
      }

      const templateStr = templateValue || SCAFFOLD_TEMPLATE_DEFAULT;
      if (templateStr !== 'monorepo' && templateStr !== 'standalone') {
        return {
          success: false,
          message: `Invalid template: ${templateStr}. Available: monorepo, standalone`,
          data: undefined,
          exitCode: 1,
        };
      }

      return handleScaffoldProject({
        projectName,
        template: templateStr,
        domainName: domainValue,
        scope: scopeValue,
        description: descriptionValue,
        output: outputValue,
        dryRun,
      });
    }

    case 'contract': {
      const name = positionalArgs[0];
      if (!name) {
        return {
          success: false,
          message: 'Usage: ax scaffold contract <name> [options]',
          data: undefined,
          exitCode: 1,
        };
      }
      return handleScaffoldContract({
        name,
        description: descriptionValue,
        output: outputValue,
        dryRun,
      });
    }

    case 'domain': {
      const name = positionalArgs[0];
      if (!name) {
        return {
          success: false,
          message: 'Usage: ax scaffold domain <name> [options]',
          data: undefined,
          exitCode: 1,
        };
      }
      return handleScaffoldDomain({
        name,
        output: outputValue,
        scope: scopeValue,
        noTests: subArgs.includes('--no-tests'),
        noGuard: subArgs.includes('--no-guard'),
        dryRun,
      });
    }

    case 'guard': {
      const policyId = positionalArgs[0];
      if (!policyId) {
        return {
          success: false,
          message: 'Usage: ax scaffold guard <policy-id> [options]',
          data: undefined,
          exitCode: 1,
        };
      }
      return handleScaffoldGuard({
        policyId,
        domain: domainValue || descriptionValue,
        radius: radiusValue ? parseInt(radiusValue, 10) : undefined,
        gates: gatesValue,
        dryRun,
      });
    }

    default:
      return {
        success: false,
        message: `Unknown subcommand: ${subcommand}\n\nAvailable subcommands: project, contract, domain, guard`,
        data: undefined,
        exitCode: 1,
      };
  }
}
