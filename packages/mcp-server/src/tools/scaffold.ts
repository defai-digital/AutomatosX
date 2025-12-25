/**
 * Scaffold MCP Tools
 *
 * MCP tools for scaffolding contract-first project components.
 * Uses file_write tool for file creation.
 *
 * @module mcp-server/tools/scaffold
 */

import type { MCPTool, ToolHandler } from '../types.js';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Scaffold contract tool
 */
export const scaffoldContractTool: MCPTool = {
  name: 'scaffold_contract',
  description:
    'Generate Zod schema and invariants for a domain. SIDE EFFECTS: Creates files on disk.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Domain name (kebab-case)',
      },
      description: {
        type: 'string',
        description: 'Domain description',
      },
      output: {
        type: 'string',
        description: 'Output directory (default: packages/contracts/src/<name>/v1)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without writing files',
        default: false,
      },
    },
    required: ['name'],
  },
  idempotent: false,
};

/**
 * Scaffold domain tool
 */
export const scaffoldDomainTool: MCPTool = {
  name: 'scaffold_domain',
  description:
    'Generate complete domain package with service, types, and tests. SIDE EFFECTS: Creates files on disk.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Domain name (kebab-case)',
      },
      output: {
        type: 'string',
        description: 'Output directory (default: packages/core/<name>-domain)',
      },
      scope: {
        type: 'string',
        description: 'Package scope (default: @defai.digital)',
        default: '@defai.digital',
      },
      includeTests: {
        type: 'boolean',
        description: 'Include test scaffolds',
        default: true,
      },
      includeGuard: {
        type: 'boolean',
        description: 'Include guard policy',
        default: true,
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without writing files',
        default: false,
      },
    },
    required: ['name'],
  },
  idempotent: false,
};

/**
 * Scaffold guard tool
 */
export const scaffoldGuardTool: MCPTool = {
  name: 'scaffold_guard',
  description:
    'Generate guard policy for a domain. SIDE EFFECTS: Creates file on disk.',
  inputSchema: {
    type: 'object',
    properties: {
      policyId: {
        type: 'string',
        description: 'Policy ID (e.g., "payment-development")',
      },
      domain: {
        type: 'string',
        description: 'Domain name (default: derived from policyId)',
      },
      radius: {
        type: 'number',
        description: 'Change radius limit',
        default: 3,
      },
      gates: {
        type: 'array',
        items: { type: 'string' },
        description: 'Gates to include',
        default: ['path_violation', 'dependency', 'change_radius', 'contract_tests'],
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without writing files',
        default: false,
      },
    },
    required: ['policyId'],
  },
  idempotent: false,
};

// ============================================================================
// Template Functions
// ============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

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

export const ${pascalName}IdSchema = z.string().uuid();
export type ${pascalName}Id = z.infer<typeof ${pascalName}IdSchema>;

// ============================================================================
// Enums
// ============================================================================

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
  id: ${pascalName}IdSchema,
  status: ${pascalName}StatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ${pascalName} = z.infer<typeof ${pascalName}Schema>;

// ============================================================================
// Domain Events
// ============================================================================

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
]);
export type ${pascalName}Event = z.infer<typeof ${pascalName}EventSchema>;

// ============================================================================
// Validation
// ============================================================================

export function validate${pascalName}(data: unknown): ${pascalName} {
  return ${pascalName}Schema.parse(data);
}

// ============================================================================
// Error Codes
// ============================================================================

export const ${pascalName}ErrorCode = {
  NOT_FOUND: '${domainCode}_NOT_FOUND',
  INVALID_STATUS: '${domainCode}_INVALID_STATUS',
} as const;
`;
}

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
- **Valid Transitions**:
  \`\`\`
  draft     → active, cancelled
  active    → completed, cancelled
  \`\`\`

## Business Invariants

### INV-${domainCode}-201: [Add business rules]
[Description of business invariant]
- **Enforcement**: [schema|runtime|test]
- **Test**: [How to verify]
`;
}

function generateIndexTemplate(_name: string): string {
  return `export * from './schema.js';
`;
}

function generateGuardPolicyTemplate(
  policyId: string,
  domain: string,
  radius: number,
  gates: string[]
): string {
  return `# ${toPascalCase(domain)} Domain Guard Policy

policy_id: ${policyId}

description: |
  Guard policy for ${domain} domain development.

allowed_paths:
  - packages/contracts/src/${domain}/**
  - packages/core/${domain}-domain/**
  - tests/contract/${domain}.test.ts
  - tests/core/${domain}-domain.test.ts

forbidden_paths:
  - packages/contracts/src/*/v1/schema.ts
  - "!packages/contracts/src/${domain}/v1/schema.ts"
  - packages/cli/**
  - packages/mcp-server/**
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

// ============================================================================
// Tool Handlers
// ============================================================================

export const handleScaffoldContract: ToolHandler = async (args) => {
  const name = args.name as string;
  const description = (args.description as string) || `${toPascalCase(name)} domain.`;
  const output = (args.output as string) || `packages/contracts/src/${name}/v1`;
  const dryRun = (args.dryRun as boolean) || false;

  const files = [
    { path: `${output}/schema.ts`, content: generateSchemaTemplate(name, description) },
    { path: `${output}/invariants.md`, content: generateInvariantsTemplate(name, description) },
    { path: `${output}/index.ts`, content: generateIndexTemplate(name) },
  ];

  if (dryRun) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            dryRun: true,
            name,
            files: files.map((f) => ({ path: f.path, size: f.content.length })),
            message: `Would create ${files.length} files for contract "${name}"`,
          }),
        },
      ],
    };
  }

  // In a real implementation, this would use file_write tool
  // For now, return the generated content
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          dryRun: false,
          name,
          files: files.map((f) => ({ path: f.path, size: f.content.length })),
          generatedContent: files,
          message: `Generated contract scaffold for "${name}". Use file_write tool to persist files.`,
        }),
      },
    ],
  };
};

export const handleScaffoldDomain: ToolHandler = async (args) => {
  const name = args.name as string;
  const output = (args.output as string) || `packages/core/${name}-domain`;
  const scope = (args.scope as string) || '@defai.digital';
  const includeGuard = args.includeGuard !== false;
  const dryRun = (args.dryRun as boolean) || false;

  const pascalName = toPascalCase(name);

  const files = [
    {
      path: `${output}/package.json`,
      content: JSON.stringify(
        {
          name: `${scope}/${name}-domain`,
          version: '1.0.0',
          type: 'module',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
        },
        null,
        2
      ),
    },
    {
      path: `${output}/src/index.ts`,
      content: `export * from './types.js';\nexport * from './service.js';\n`,
    },
    {
      path: `${output}/src/types.ts`,
      content: `import type { ${pascalName} } from '@defai.digital/contracts';

export interface ${pascalName}Repository {
  findById(id: string): Promise<${pascalName} | undefined>;
  save(entity: ${pascalName}): Promise<void>;
}
`,
    },
    {
      path: `${output}/src/service.ts`,
      content: `import type { ${pascalName} } from '@defai.digital/contracts';
import type { ${pascalName}Repository } from './types.js';

export class ${pascalName}Service {
  constructor(private readonly repository: ${pascalName}Repository) {}

  async findById(id: string): Promise<${pascalName} | undefined> {
    return this.repository.findById(id);
  }
}
`,
    },
  ];

  if (includeGuard) {
    files.push({
      path: `packages/guard/policies/${name}-development.yaml`,
      content: generateGuardPolicyTemplate(
        `${name}-development`,
        name,
        3,
        ['path_violation', 'dependency', 'change_radius', 'contract_tests']
      ),
    });
  }

  if (dryRun) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            dryRun: true,
            name,
            files: files.map((f) => ({ path: f.path, size: f.content.length })),
            message: `Would create ${files.length} files for domain "${name}"`,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          dryRun: false,
          name,
          files: files.map((f) => ({ path: f.path, size: f.content.length })),
          generatedContent: files,
          message: `Generated domain scaffold for "${name}". Use file_write tool to persist files.`,
        }),
      },
    ],
  };
};

export const handleScaffoldGuard: ToolHandler = async (args) => {
  const policyId = args.policyId as string;
  const domain = (args.domain as string) || policyId.replace(/-development$/, '');
  const radius = (args.radius as number) || 3;
  const gates = (args.gates as string[]) || [
    'path_violation',
    'dependency',
    'change_radius',
    'contract_tests',
  ];
  const dryRun = (args.dryRun as boolean) || false;

  const content = generateGuardPolicyTemplate(policyId, domain, radius, gates);
  const filePath = `packages/guard/policies/${policyId}.yaml`;

  if (dryRun) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            dryRun: true,
            policyId,
            domain,
            file: { path: filePath, size: content.length },
            message: `Would create guard policy "${policyId}"`,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          dryRun: false,
          policyId,
          domain,
          file: { path: filePath, size: content.length },
          generatedContent: { path: filePath, content },
          message: `Generated guard policy "${policyId}". Use file_write tool to persist.`,
        }),
      },
    ],
  };
};

// ============================================================================
// Exports
// ============================================================================

export const SCAFFOLD_TOOLS: MCPTool[] = [
  scaffoldContractTool,
  scaffoldDomainTool,
  scaffoldGuardTool,
];

export const SCAFFOLD_HANDLERS: Record<string, ToolHandler> = {
  scaffold_contract: handleScaffoldContract,
  scaffold_domain: handleScaffoldDomain,
  scaffold_guard: handleScaffoldGuard,
};
