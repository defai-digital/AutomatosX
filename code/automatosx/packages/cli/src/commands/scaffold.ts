/**
 * Scaffold Command
 *
 * Generate contract-first project components: Zod schemas, invariant docs,
 * domain packages, and trust policies.
 *
 * Usage:
 *   ax scaffold contract <name>           Generate Zod schema + invariants
 *   ax scaffold domain <name>             Generate full domain package
 *   ax scaffold policy <policy-id>        Generate trust policy YAML
 *   ax scaffold project <name> -m <domain> Generate full project from template
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUARD_RADIUS_DEFAULT = 3;
const GUARD_GATES_DEFAULT  = ['contract-review', 'test-coverage', 'invariant-check'];
const SCAFFOLD_SCOPE_DEFAULT    = '@myorg';
const SCAFFOLD_TEMPLATE_DEFAULT = 'standalone';

// ---------------------------------------------------------------------------
// Template generators
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function generateSchemaTemplate(name: string, description: string): string {
  const P = toPascalCase(name);
  const code = name.substring(0, 3).toUpperCase();
  return `/**
 * ${P} Domain Contracts v1 — ${description}
 */

import { z } from 'zod';

export const ${P}IdSchema = z.string().uuid();
export type ${P}Id = z.infer<typeof ${P}IdSchema>;

export const ${P}StatusSchema = z.enum(['draft', 'active', 'completed', 'cancelled']);
export type ${P}Status = z.infer<typeof ${P}StatusSchema>;

/**
 * Invariants:
 * - INV-${code}-001: ID must be valid UUID
 * - INV-${code}-002: Status must be valid enum value
 */
export const ${P}Schema = z.object({
  id:        ${P}IdSchema,
  status:    ${P}StatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ${P} = z.infer<typeof ${P}Schema>;

export const ${P}EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('${name}.created'), ${name}Id: ${P}IdSchema, occurredAt: z.string().datetime() }),
  z.object({ type: z.literal('${name}.updated'), ${name}Id: ${P}IdSchema, changes: z.record(z.unknown()), occurredAt: z.string().datetime() }),
  z.object({ type: z.literal('${name}.deleted'), ${name}Id: ${P}IdSchema, occurredAt: z.string().datetime() }),
]);
export type ${P}Event = z.infer<typeof ${P}EventSchema>;

export const ${P}ErrorCode = {
  NOT_FOUND:         '${code}_NOT_FOUND',
  INVALID_STATUS:    '${code}_INVALID_STATUS',
  VALIDATION_FAILED: '${code}_VALIDATION_FAILED',
} as const;
export type ${P}ErrorCode = typeof ${P}ErrorCode[keyof typeof ${P}ErrorCode];

export function validate${P}(data: unknown): ${P} {
  return ${P}Schema.parse(data);
}
`;
}

function generateInvariantsTemplate(name: string, description: string): string {
  const P = toPascalCase(name);
  const code = name.substring(0, 3).toUpperCase();
  return `# ${P} Domain Invariants

## Overview
${description}

## Schema Invariants

### INV-${code}-001: Valid ID Format
${P} ID MUST be a valid UUID v4.
- **Enforcement**: schema

### INV-${code}-002: Valid Status
Status MUST be one of: draft, active, completed, cancelled.
- **Enforcement**: schema

## Runtime Invariants

### INV-${code}-101: Status Transitions
\`\`\`
draft → active, cancelled
active → completed, cancelled
completed → (terminal)
cancelled → (terminal)
\`\`\`

## Business Invariants

### INV-${code}-201: [Add business rules here]
`;
}

function generateGuardPolicyTemplate(policyId: string, domain: string, radius: number, gates: string[]): string {
  return `# ${toPascalCase(domain)} Domain Trust Policy

policy_id: ${policyId}

description: Trust policy for ${domain} domain development.

allowed_paths:
  - packages/contracts/src/${domain}/**
  - packages/core/${domain}-domain/**
  - tests/contract/${domain}.test.ts
  - tests/core/${domain}-domain.test.ts

forbidden_paths:
  - packages/cli/**
  - packages/mcp-server/**

gates:
${gates.map((g) => `  - ${g}`).join('\n')}

change_radius_limit: ${radius}

metadata:
  owner: ${domain}-team
  created_at: "${new Date().toISOString().split('T')[0]}"
  severity: medium
  auto_apply: false
`;
}

function generateDomainPackageJson(name: string, scope: string): string {
  return JSON.stringify({
    name: `${scope}/${name}-domain`,
    version: '1.0.0',
    description: `${toPascalCase(name)} domain implementation`,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
    scripts: { build: 'tsc --build', clean: 'rm -rf dist', typecheck: 'tsc --noEmit' },
    dependencies: { '@defai.digital/contracts': 'workspace:*' },
    devDependencies: { typescript: '^5.3.0' },
  }, null, 2);
}

function generateDomainIndex(name: string): string {
  return `export * from './types.js';\nexport * from './service.js';\n`;
}

function generateDomainTypes(name: string): string {
  const P = toPascalCase(name);
  return `import type { ${P} } from '@defai.digital/contracts';

export interface ${P}Repository {
  findById(id: string): Promise<${P} | undefined>;
  findAll(): Promise<${P}[]>;
  save(entity: ${P}): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ${P}ServiceDeps {
  repository: ${P}Repository;
}
`;
}

function generateDomainService(name: string): string {
  const P = toPascalCase(name);
  return `import type { ${P} } from '@defai.digital/contracts';
import type { ${P}ServiceDeps } from './types.js';

export class ${P}Service {
  constructor(private readonly deps: ${P}ServiceDeps) {}

  async findById(id: string): Promise<${P} | undefined> {
    return this.deps.repository.findById(id);
  }

  async findAll(): Promise<${P}[]> {
    return this.deps.repository.findAll();
  }
}

export function create${P}Service(deps: ${P}ServiceDeps): ${P}Service {
  return new ${P}Service(deps);
}
`;
}

function generateContractTest(name: string): string {
  const P = toPascalCase(name);
  const code = name.substring(0, 3).toUpperCase();
  return `import { describe, it, expect } from 'vitest';
import { ${P}Schema, ${P}EventSchema } from '@defai.digital/contracts';

describe('${P} Contract', () => {
  // INV-${code}-001
  it('rejects invalid UUID', () => {
    expect(() => ${P}Schema.parse({ id: 'bad', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).toThrow();
  });

  // INV-${code}-002
  it('rejects invalid status', () => {
    expect(() => ${P}Schema.parse({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'invalid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).toThrow();
  });

  it('accepts valid entity', () => {
    expect(() => ${P}Schema.parse({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).not.toThrow();
  });
});
`;
}

// ---------------------------------------------------------------------------
// File write helper
// ---------------------------------------------------------------------------

interface FileRecord { path: string; action: 'create' | 'overwrite' }

function writeScaffoldFile(filePath: string, content: string, dryRun: boolean, files: FileRecord[]): void {
  const action: FileRecord['action'] = fs.existsSync(filePath) ? 'overwrite' : 'create';
  files.push({ path: filePath, action });
  if (!dryRun) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

function handleContract(name: string, opts: { description?: string; output?: string; dryRun: boolean }): CommandResult {
  const desc   = opts.description ?? `${toPascalCase(name)} domain.`;
  const outDir = opts.output ?? `packages/contracts/src/${name}/v1`;
  const files: FileRecord[] = [];

  writeScaffoldFile(path.join(outDir, 'schema.ts'),     generateSchemaTemplate(name, desc),     opts.dryRun, files);
  writeScaffoldFile(path.join(outDir, 'invariants.md'), generateInvariantsTemplate(name, desc), opts.dryRun, files);
  writeScaffoldFile(path.join(outDir, 'index.ts'),      `export * from './schema.js';\n`,        opts.dryRun, files);

  const verb = opts.dryRun ? 'Would create' : 'Created';
  return success(
    `${verb} contract for "${name}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`,
    { name, files, dryRun: opts.dryRun },
  );
}

function handleDomain(name: string, opts: { scope?: string; output?: string; noTests?: boolean; noPolicy?: boolean; dryRun: boolean }): CommandResult {
  const scope    = opts.scope ?? SCAFFOLD_SCOPE_DEFAULT;
  const domainDir = opts.output ?? `packages/core/${name}-domain`;
  const files: FileRecord[] = [];

  writeScaffoldFile(path.join(domainDir, 'package.json'),      generateDomainPackageJson(name, scope), opts.dryRun, files);
  writeScaffoldFile(path.join(domainDir, 'src', 'index.ts'),   generateDomainIndex(name),              opts.dryRun, files);
  writeScaffoldFile(path.join(domainDir, 'src', 'types.ts'),   generateDomainTypes(name),              opts.dryRun, files);
  writeScaffoldFile(path.join(domainDir, 'src', 'service.ts'), generateDomainService(name),            opts.dryRun, files);

  if (!opts.noTests) {
    writeScaffoldFile(`tests/contract/${name}.test.ts`, generateContractTest(name), opts.dryRun, files);
  }
  if (!opts.noPolicy) {
    writeScaffoldFile(
      `packages/guard/policies/${name}-development.yaml`,
      generateGuardPolicyTemplate(`${name}-development`, name, GUARD_RADIUS_DEFAULT, [...GUARD_GATES_DEFAULT]),
      opts.dryRun,
      files,
    );
  }

  const verb = opts.dryRun ? 'Would create' : 'Created';
  return success(
    `${verb} domain package for "${name}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`,
    { name, files, dryRun: opts.dryRun },
  );
}

function handlePolicy(policyId: string, opts: { domain?: string; radius?: number; gates?: string; dryRun: boolean }): CommandResult {
  const domain = opts.domain ?? policyId.replace(/-development$/, '');
  const radius = opts.radius ?? GUARD_RADIUS_DEFAULT;
  const gates  = opts.gates ? opts.gates.split(',').map((g) => g.trim()) : [...GUARD_GATES_DEFAULT];
  const files: FileRecord[] = [];

  writeScaffoldFile(
    `packages/guard/policies/${policyId}.yaml`,
    generateGuardPolicyTemplate(policyId, domain, radius, gates),
    opts.dryRun,
    files,
  );

  const verb = opts.dryRun ? 'Would create' : 'Created';
  return success(
    `${verb} policy "${policyId}":\n${files.map((f) => `  ${f.action}: ${f.path}`).join('\n')}`,
    { policyId, domain, files, dryRun: opts.dryRun },
  );
}

// ---------------------------------------------------------------------------
// Argument parsing helpers
// ---------------------------------------------------------------------------

function pickFlag(flags: string[], ...names: string[]): string | undefined {
  for (const name of names) {
    const idx = flags.indexOf(name);
    if (idx !== -1 && idx + 1 < flags.length) return flags[idx + 1];
    const eq = flags.find((f) => f.startsWith(`${name}=`));
    if (eq !== undefined) return eq.split('=').slice(1).join('=');
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function scaffoldCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (args.length === 0 || args[0] === 'help' || options.help) {
    return success(
      'Usage: ax scaffold <subcommand> [options]\n\n' +
      'Subcommands:\n' +
      '  contract <name>   Generate Zod schema + invariants doc\n' +
      '  domain <name>     Generate full domain package\n' +
      '  policy <policy-id> Generate trust policy YAML\n\n' +
      'Options:\n' +
      '  -d, --description <desc>  Description (contract/domain)\n' +
      '  -o, --output <path>       Output directory\n' +
      '  -s, --scope <scope>       Package scope (default: @myorg)\n' +
      '  -r, --radius <n>          Change radius limit (default: 3)\n' +
      '  -g, --gates <gates>       Comma-separated gate names\n' +
      '  --no-tests                Skip test scaffold\n' +
      '  --no-policy               Skip trust policy\n' +
      '  --dry-run                 Preview without writing files',
    );
  }

  const subcommand = args[0];
  const rest       = args.slice(1);
  const dryRun     = rest.includes('--dry-run') || (options.dryRun ?? false);

  // Collect positional (non-flag) arguments
  const positional = rest.filter((a) => !a.startsWith('-'));
  const name       = positional[0];

  switch (subcommand) {
    case 'contract': {
      if (name === undefined) return failure('Usage: ax scaffold contract <name> [options]');
      return handleContract(name, {
        description: pickFlag(rest, '-d', '--description'),
        output:      pickFlag(rest, '-o', '--output'),
        dryRun,
      });
    }

    case 'domain': {
      if (name === undefined) return failure('Usage: ax scaffold domain <name> [options]');
      return handleDomain(name, {
        scope:   pickFlag(rest, '-s', '--scope'),
        output:  pickFlag(rest, '-o', '--output'),
        noTests: rest.includes('--no-tests'),
        noPolicy: rest.includes('--no-policy'),
        dryRun,
      });
    }

    case 'policy':
    case 'guard': {
      if (name === undefined) return failure('Usage: ax scaffold policy <policy-id> [options]');
      const radiusRaw = pickFlag(rest, '-r', '--radius');
      return handlePolicy(name, {
        domain: pickFlag(rest, '-m', '--domain', '-d', '--description'),
        radius: radiusRaw !== undefined ? parseInt(radiusRaw, 10) : undefined,
        gates:  pickFlag(rest, '-g', '--gates'),
        dryRun,
      });
    }

    default:
      return failure(
        `Unknown subcommand: "${subcommand}"\nAvailable: contract, domain, policy\nRun "ax scaffold help" for usage.`,
      );
  }
}
