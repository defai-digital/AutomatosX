# Contract-First Scaffold PRD

**Version**: 1.0.0
**Last Updated**: 2025-12-19
**Status**: Draft
**Author**: AutomatosX Team

---

## Executive Summary

### Vision

Enable AutomatosX users to **automatically generate contract-first software architectures** following the same patterns used by AutomatosX itself. This feature transforms ax from a pure orchestration platform into a **meta-development tool** that helps teams adopt contract-first, domain-driven design principles.

### Problem Statement

Organizations wanting to adopt contract-first architecture face significant barriers:

| Challenge | Impact |
|-----------|--------|
| **Steep learning curve** | Teams struggle to understand contract-first patterns |
| **Manual boilerplate** | Creating schema.ts, invariants.md, domain packages is tedious |
| **Inconsistent structure** | Different developers create inconsistent package layouts |
| **Missing governance** | Guard policies often forgotten or poorly configured |
| **Test scaffold gaps** | Contract tests are afterthoughts, not first-class citizens |

### Solution

AutomatosX Contract-First Scaffold provides:

1. **Intelligent Contract Generation** - AI-assisted Zod schema creation from natural language requirements
2. **Invariant Documentation** - Auto-generated behavioral guarantees with INV-XXX-NNN format
3. **Domain Package Scaffold** - Complete package structure following ax conventions
4. **Guard Policy Generation** - Pre-configured governance policies for the domain
5. **Test Scaffold** - Contract test templates that enforce invariants

### Strategic Alignment

This feature aligns with AutomatosX's core principle: **Contract-First Design**. By enabling users to scaffold contract-first projects, ax becomes not just a tool that *uses* contracts, but one that *propagates* the contract-first methodology.

---

## 1. Architecture Decision

### 1.1 Build vs. Buy vs. Addon Analysis

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A: Built into ax core** | Unified UX, shared infrastructure, single tool | Scope creep risk, maintenance burden | **Recommended (phased)** |
| **B: Separate project** | Clean slate, independent evolution | Ecosystem fragmentation, duplication | Not recommended |
| **C: Plugin/Addon** | Flexibility, community extensibility | Requires plugin system first, complexity | Future consideration |
| **D: Agent + Workflow only** | Zero new code, immediate availability | Limited capability, no file generation | **Phase 1 approach** |

### 1.2 Strategic Decision

**Phased approach combining D and A:**

```
Phase 1 (Immediate):    Agent + Workflow approach using existing primitives
Phase 2 (Short-term):   Add file generation MCP tools
Phase 3 (Medium-term):  Add CLI commands (ax scaffold)
Phase 4 (Long-term):    Full integration with project templates
```

### 1.3 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep | Medium | High | Strict phase gates, MVP definition |
| Generated code quality | Medium | High | Guard system validation, human review |
| Maintenance burden | Low | Medium | Leverage existing design_* tools |
| Breaking changes | Low | High | Versioned contracts, migration guides |

---

## 2. Contract Definitions

### 2.1 Scaffold Domain Contract

**Location**: `packages/contracts/src/scaffold/v1/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Scaffold Request Contracts
// ============================================================================

/**
 * Domain definition input
 */
export const DomainDefinitionSchema = z.object({
  /** Domain name (kebab-case) */
  name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/),

  /** Human-readable description */
  description: z.string().min(10).max(500),

  /** Domain bounded context */
  boundedContext: z.string().max(100).optional(),

  /** Entity definitions */
  entities: z.array(z.object({
    name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/),
    description: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum([
        'string', 'number', 'boolean', 'date', 'datetime',
        'uuid', 'email', 'url', 'array', 'object', 'enum', 'ref'
      ]),
      required: z.boolean().default(true),
      description: z.string().optional(),
      constraints: z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.string().optional(),
        enumValues: z.array(z.string()).optional(),
        refEntity: z.string().optional(),
      }).optional(),
    })),
    isAggregate: z.boolean().default(false),
  })).min(1),

  /** Value objects */
  valueObjects: z.array(z.object({
    name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/),
    description: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean().default(true),
    })),
  })).optional(),

  /** Domain events */
  events: z.array(z.object({
    name: z.string().regex(/^[a-z]+\.[a-z]+$/),
    description: z.string(),
    payload: z.array(z.object({
      name: z.string(),
      type: z.string(),
    })),
  })).optional(),

  /** Business invariants */
  invariants: z.array(z.object({
    id: z.string().regex(/^INV-[A-Z]{2,4}-\d{3}$/),
    description: z.string(),
    enforcement: z.enum(['schema', 'runtime', 'test']),
  })).optional(),
});

export type DomainDefinition = z.infer<typeof DomainDefinitionSchema>;

/**
 * Scaffold request
 */
export const ScaffoldRequestSchema = z.object({
  /** Request type */
  type: z.enum(['contract', 'domain', 'guard', 'full-project']),

  /** Domain definition */
  domain: DomainDefinitionSchema,

  /** Output configuration */
  output: z.object({
    /** Base output directory */
    basePath: z.string(),
    /** Package scope (e.g., @myorg) */
    packageScope: z.string().optional(),
    /** Include test scaffolds */
    includeTests: z.boolean().default(true),
    /** Include guard policy */
    includeGuard: z.boolean().default(true),
    /** Dry run (preview only) */
    dryRun: z.boolean().default(false),
  }),

  /** Generation options */
  options: z.object({
    /** Use TypeScript strict mode */
    strict: z.boolean().default(true),
    /** Include JSDoc comments */
    includeJsDoc: z.boolean().default(true),
    /** Schema format */
    schemaFormat: z.enum(['zod', 'json-schema', 'both']).default('zod'),
  }).optional(),
});

export type ScaffoldRequest = z.infer<typeof ScaffoldRequestSchema>;

// ============================================================================
// Scaffold Result Contracts
// ============================================================================

/**
 * Generated file descriptor
 */
export const GeneratedFileSchema = z.object({
  /** Relative file path */
  path: z.string(),
  /** File content */
  content: z.string(),
  /** File type */
  type: z.enum(['schema', 'invariant', 'domain', 'test', 'guard', 'config']),
  /** Whether file already exists (for dry run) */
  exists: z.boolean().optional(),
  /** Diff if file exists */
  diff: z.string().optional(),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

/**
 * Scaffold result
 */
export const ScaffoldResultSchema = z.object({
  /** Whether scaffold succeeded */
  success: z.boolean(),
  /** Generated files */
  files: z.array(GeneratedFileSchema),
  /** Summary statistics */
  summary: z.object({
    totalFiles: z.number(),
    schemas: z.number(),
    invariants: z.number(),
    tests: z.number(),
    guards: z.number(),
  }),
  /** Warnings (non-fatal issues) */
  warnings: z.array(z.string()).optional(),
  /** Error if failed */
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type ScaffoldResult = z.infer<typeof ScaffoldResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const ScaffoldErrorCode = {
  INVALID_DOMAIN_NAME: 'INVALID_DOMAIN_NAME',
  INVALID_ENTITY_NAME: 'INVALID_ENTITY_NAME',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  DUPLICATE_INVARIANT_ID: 'DUPLICATE_INVARIANT_ID',
  OUTPUT_PATH_EXISTS: 'OUTPUT_PATH_EXISTS',
  GENERATION_FAILED: 'GENERATION_FAILED',
  FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
} as const;

export type ScaffoldErrorCode = typeof ScaffoldErrorCode[keyof typeof ScaffoldErrorCode];
```

### 2.2 Invariants

**Location**: `packages/contracts/src/scaffold/v1/invariants.md`

```markdown
# Scaffold Domain Invariants

## Schema Invariants

### INV-SCF-001: Domain Name Format
Domain names MUST be kebab-case, starting with a letter.
- **Enforcement**: Schema validation
- **Test**: `domain.name` matches `/^[a-z][a-z0-9-]*$/`

### INV-SCF-002: Entity Name Format
Entity names MUST be PascalCase, starting with uppercase letter.
- **Enforcement**: Schema validation
- **Test**: `entity.name` matches `/^[A-Z][a-zA-Z0-9]*$/`

### INV-SCF-003: Invariant ID Format
Invariant IDs MUST follow `INV-XXX-NNN` pattern.
- **Enforcement**: Schema validation
- **Test**: `invariant.id` matches `/^INV-[A-Z]{2,4}-\d{3}$/`

## Generation Invariants

### INV-SCF-010: No Circular References
Entity references MUST NOT form circular dependency chains.
- **Enforcement**: Runtime validation
- **Test**: Depth-first search detects no cycles

### INV-SCF-011: Unique Invariant IDs
All invariant IDs within a domain MUST be unique.
- **Enforcement**: Schema validation (superRefine)
- **Test**: Set size equals array length

### INV-SCF-012: Generated Code Validity
All generated TypeScript code MUST pass type checking.
- **Enforcement**: Post-generation validation
- **Test**: `tsc --noEmit` succeeds

## File System Invariants

### INV-SCF-020: Idempotent Generation
Running scaffold twice with same input produces identical output.
- **Enforcement**: Deterministic generation
- **Test**: Hash comparison of outputs

### INV-SCF-021: No Overwrites Without Flag
Existing files MUST NOT be overwritten without explicit `--force` flag.
- **Enforcement**: Runtime check
- **Test**: File existence check before write
```

---

## 3. MCP Tool Definitions

### 3.1 scaffold_contract Tool

```typescript
export const scaffoldContractTool: MCPTool = {
  name: 'scaffold_contract',
  description: 'Generate Zod schema and invariants for a domain contract',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Contract/domain name (kebab-case)',
      },
      description: {
        type: 'string',
        description: 'Human-readable description of the domain',
      },
      entities: {
        type: 'array',
        description: 'Entity definitions with fields',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Entity name (PascalCase)' },
            description: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  required: { type: 'boolean', default: true },
                  description: { type: 'string' },
                },
                required: ['name', 'type'],
              },
            },
            isAggregate: { type: 'boolean', default: false },
          },
          required: ['name', 'fields'],
        },
      },
      invariants: {
        type: 'array',
        description: 'Business invariants to enforce',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID in INV-XXX-NNN format' },
            description: { type: 'string' },
            enforcement: {
              type: 'string',
              enum: ['schema', 'runtime', 'test'],
            },
          },
          required: ['id', 'description', 'enforcement'],
        },
      },
      outputPath: {
        type: 'string',
        description: 'Output directory path',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without writing files',
        default: true,
      },
    },
    required: ['name', 'description', 'entities'],
  },
};
```

### 3.2 scaffold_domain Tool

```typescript
export const scaffoldDomainTool: MCPTool = {
  name: 'scaffold_domain',
  description: 'Generate complete domain package with contracts, implementation, and tests',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Domain package name (kebab-case)',
      },
      contractPath: {
        type: 'string',
        description: 'Path to existing contract, or generate new',
      },
      outputPath: {
        type: 'string',
        description: 'Base output directory',
      },
      packageScope: {
        type: 'string',
        description: 'NPM package scope (e.g., @myorg)',
      },
      includeTests: {
        type: 'boolean',
        description: 'Generate test scaffolds',
        default: true,
      },
      includeGuard: {
        type: 'boolean',
        description: 'Generate guard policy',
        default: true,
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without writing files',
        default: true,
      },
    },
    required: ['name', 'outputPath'],
  },
};
```

### 3.3 scaffold_guard Tool

```typescript
export const scaffoldGuardTool: MCPTool = {
  name: 'scaffold_guard',
  description: 'Generate guard policy for a domain',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      policyId: {
        type: 'string',
        description: 'Policy identifier (kebab-case)',
      },
      domainPath: {
        type: 'string',
        description: 'Path to domain package',
      },
      changeRadiusLimit: {
        type: 'number',
        description: 'Maximum packages that can be modified',
        default: 3,
      },
      gates: {
        type: 'array',
        description: 'Gates to enable',
        items: {
          type: 'string',
          enum: ['path_violation', 'dependency', 'change_radius', 'contract_tests', 'secrets_detection'],
        },
        default: ['path_violation', 'dependency', 'change_radius', 'contract_tests'],
      },
      outputPath: {
        type: 'string',
        description: 'Output directory for policy file',
      },
      dryRun: {
        type: 'boolean',
        default: true,
      },
    },
    required: ['policyId', 'domainPath'],
  },
};
```

### 3.4 file_write Tool (New Infrastructure)

```typescript
export const fileWriteTool: MCPTool = {
  name: 'file_write',
  description: 'Write content to a file on the filesystem',
  idempotent: false, // File writes have side effects
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute file path to write',
      },
      content: {
        type: 'string',
        description: 'File content to write',
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist',
        default: true,
      },
      overwrite: {
        type: 'boolean',
        description: 'Overwrite existing file',
        default: false,
      },
      encoding: {
        type: 'string',
        description: 'File encoding',
        enum: ['utf-8', 'ascii', 'base64'],
        default: 'utf-8',
      },
    },
    required: ['path', 'content'],
  },
};
```

---

## 4. CLI Commands

### 4.1 Command Structure

```
ax scaffold <subcommand> [options]

Subcommands:
  contract    Generate contract (schema + invariants)
  domain      Generate complete domain package
  guard       Generate guard policy
  project     Generate full project structure
```

### 4.2 ax scaffold contract

```bash
ax scaffold contract <name> [options]

Generate a contract-first domain contract.

Arguments:
  name                     Domain name (kebab-case)

Options:
  -d, --description <desc> Domain description
  -e, --entities <json>    Entity definitions as JSON
  -i, --interactive        Interactive mode (prompts for input)
  -o, --output <path>      Output directory (default: ./packages/contracts/src/<name>/v1)
  --dry-run                Preview without writing files
  --format <format>        Output format: zod, json-schema, both (default: zod)

Examples:
  ax scaffold contract user-management -i
  ax scaffold contract billing --entities '[{"name":"Invoice","fields":[...]}]'
  ax scaffold contract auth -d "Authentication domain" --dry-run
```

### 4.3 ax scaffold domain

```bash
ax scaffold domain <name> [options]

Generate a complete domain package.

Arguments:
  name                     Domain name (kebab-case)

Options:
  -c, --contract <path>    Path to existing contract (or generate new)
  -o, --output <path>      Output directory (default: ./packages/core/<name>-domain)
  -s, --scope <scope>      Package scope (e.g., @myorg)
  --no-tests               Skip test scaffolds
  --no-guard               Skip guard policy
  --dry-run                Preview without writing files

Examples:
  ax scaffold domain payment
  ax scaffold domain inventory -c ./contracts/inventory.ts
  ax scaffold domain analytics -s @acme --dry-run
```

### 4.4 ax scaffold guard

```bash
ax scaffold guard <policy-id> [options]

Generate a guard policy for a domain.

Arguments:
  policy-id                Policy identifier (kebab-case)

Options:
  -d, --domain <path>      Path to domain package
  -r, --radius <n>         Change radius limit (default: 3)
  -g, --gates <gates>      Comma-separated gates to enable
  -o, --output <path>      Output path for policy file
  --dry-run                Preview without writing files

Examples:
  ax scaffold guard payment-changes -d packages/core/payment-domain
  ax scaffold guard major-refactor -r 10 -g dependency,contract_tests
```

---

## 5. Agent Definitions

### 5.1 contract-architect Agent

**Location**: `.automatosx/agents.json`

```json
{
  "agentId": "contract-architect",
  "displayName": "Aria",
  "description": "Software architect specializing in contract-first design, domain modeling, and invariant documentation",
  "role": "Contract-First Domain Architect",
  "team": "engineering",
  "expertise": [
    "domain-driven-design",
    "contract-first-architecture",
    "zod-schemas",
    "invariant-documentation",
    "hexagonal-architecture"
  ],
  "capabilities": [
    "domain-modeling",
    "schema-design",
    "invariant-authoring",
    "package-structure-design",
    "guard-policy-design"
  ],
  "systemPrompt": "You are Aria, a Contract-First Domain Architect. Your expertise is designing clean, well-documented domain models following contract-first principles.\n\n## Your Approach\n\n1. **Contracts First**: Always start with Zod schemas before implementation\n2. **Explicit Invariants**: Document all behavioral guarantees in INV-XXX-NNN format\n3. **Bounded Contexts**: Identify clear domain boundaries\n4. **Aggregate Roots**: Design entities with clear ownership hierarchies\n5. **Event-Driven**: Consider domain events for state changes\n\n## Output Format\n\nWhen designing contracts, always provide:\n- Complete Zod schemas with validation rules\n- Invariants in markdown format\n- Domain events if applicable\n- Guard policy recommendations\n\n## Constraints\n\n- Schema field names: camelCase\n- Entity names: PascalCase\n- Domain/package names: kebab-case\n- Invariant IDs: INV-XXX-NNN (XXX = domain abbrev, NNN = sequence)",
  "workflow": [
    {
      "stepId": "analyze-requirements",
      "name": "Analyze Requirements",
      "type": "prompt",
      "config": {
        "prompt": "Analyze the requirements and identify:\n1. Bounded context and domain name\n2. Entities and their relationships\n3. Value objects\n4. Domain events\n5. Business invariants\n\nRequirements:\n{{input}}"
      }
    },
    {
      "stepId": "design-schema",
      "name": "Design Zod Schema",
      "type": "tool",
      "dependencies": ["analyze-requirements"],
      "config": {
        "tool": "design_schema"
      }
    },
    {
      "stepId": "write-invariants",
      "name": "Document Invariants",
      "type": "prompt",
      "dependencies": ["design-schema"],
      "config": {
        "prompt": "Based on the schema design, document all invariants in the following format:\n\n## Invariants\n\n### INV-XXX-001: [Name]\n[Description]\n- **Enforcement**: [schema|runtime|test]\n- **Test**: [How to verify]\n\nSchema:\n{{steps.design-schema.output}}"
      }
    },
    {
      "stepId": "design-guard",
      "name": "Design Guard Policy",
      "type": "prompt",
      "dependencies": ["write-invariants"],
      "config": {
        "prompt": "Design a guard policy for this domain:\n\n1. Allowed paths\n2. Forbidden paths\n3. Required gates\n4. Change radius limit\n\nProvide as YAML configuration."
      }
    },
    {
      "stepId": "generate-summary",
      "name": "Generate Summary",
      "type": "prompt",
      "dependencies": ["design-guard"],
      "config": {
        "prompt": "Provide a complete summary of the contract-first design:\n\n1. Domain overview\n2. Entities and relationships (diagram)\n3. Zod schemas (full code)\n4. Invariants (full markdown)\n5. Guard policy (YAML)\n6. Recommended next steps"
      }
    }
  ],
  "selectionMetadata": {
    "primaryIntents": [
      "design contract",
      "create schema",
      "define domain",
      "write invariants"
    ],
    "keywords": [
      "contract", "schema", "zod", "domain", "invariant",
      "entity", "aggregate", "bounded context", "ddd"
    ],
    "exampleTasks": [
      "Design a contract for user authentication",
      "Create Zod schemas for an e-commerce domain",
      "Write invariants for payment processing",
      "Scaffold a new domain package"
    ],
    "notForTasks": [
      "Fix a bug",
      "Write unit tests",
      "Deploy application",
      "Review code"
    ],
    "agentCategory": "specialist"
  },
  "enabled": true,
  "tags": ["contract-first", "architecture", "ddd", "scaffold"]
}
```

### 5.2 contract-first-project Workflow

**Location**: `examples/workflows/contract-first-project.yaml`

```yaml
workflowId: contract-first-project
name: Contract-First Project Scaffold
description: Generate a complete contract-first project structure with domains, guards, and tests
version: "1.0.0"
category: scaffold
tags:
  - contract-first
  - scaffold
  - architecture
  - ddd

metadata:
  requiredAbilities:
    - domain-driven-design
    - zod-schemas
    - guard-policies
  estimatedDuration: 180
  complexity: high

steps:
  - stepId: gather-requirements
    name: Gather Domain Requirements
    type: prompt
    timeout: 120000
    config:
      agent: contract-architect
      task: |
        Gather requirements for the domain:

        1. **Domain Identification**:
           - What is the core domain/bounded context?
           - What problem does it solve?
           - Who are the main actors?

        2. **Entity Discovery**:
           - What are the main entities?
           - What are the aggregate roots?
           - What value objects exist?

        3. **Business Rules**:
           - What invariants must be enforced?
           - What validation rules apply?
           - What are the domain events?

        4. **Integration Points**:
           - What external systems interact?
           - What APIs are needed?

  - stepId: design-contracts
    name: Design Domain Contracts
    type: tool
    timeout: 60000
    dependencies: [gather-requirements]
    config:
      tool: design_schema
      passContext: true

  - stepId: write-invariants
    name: Write Invariant Documentation
    type: prompt
    timeout: 60000
    dependencies: [design-contracts]
    config:
      agent: contract-architect
      task: |
        Create invariants.md with the following structure:

        # {{domain_name}} Domain Invariants

        ## Schema Invariants
        [Invariants enforced by Zod schema validation]

        ## Runtime Invariants
        [Invariants enforced by runtime checks]

        ## Business Invariants
        [Invariants enforced by tests and reviews]

        Use INV-{{DOMAIN_ABBREV}}-NNN format for all IDs.

  - stepId: design-package-structure
    name: Design Package Structure
    type: prompt
    timeout: 60000
    dependencies: [write-invariants]
    config:
      agent: contract-architect
      task: |
        Design the package structure:

        ```
        packages/
        ├── contracts/src/{{domain}}/v1/
        │   ├── schema.ts          # Zod schemas
        │   ├── invariants.md      # Behavioral guarantees
        │   └── index.ts           # Exports
        ├── core/{{domain}}-domain/
        │   ├── src/
        │   │   ├── index.ts       # Public API
        │   │   ├── types.ts       # Internal types
        │   │   └── [entities].ts  # Domain logic
        │   ├── package.json
        │   └── tsconfig.json
        └── guard/policies/
            └── {{domain}}.yaml    # Guard policy
        ```

  - stepId: generate-guard-policy
    name: Generate Guard Policy
    type: prompt
    timeout: 30000
    dependencies: [design-package-structure]
    config:
      agent: contract-architect
      task: |
        Generate guard policy YAML:

        ```yaml
        policy_id: {{domain}}-development
        allowed_paths:
          - packages/contracts/src/{{domain}}/**
          - packages/core/{{domain}}-domain/**
          - tests/contract/{{domain}}.test.ts
          - tests/core/{{domain}}-domain.test.ts
        forbidden_paths:
          - packages/contracts/src/*/v1/schema.ts  # Except own
          - packages/cli/**
          - packages/mcp-server/**
        required_contracts: []
        gates:
          - path_violation
          - dependency
          - change_radius
          - contract_tests
        change_radius_limit: 2
        ```

  - stepId: generate-test-scaffold
    name: Generate Test Scaffolds
    type: prompt
    timeout: 60000
    dependencies: [design-contracts]
    config:
      agent: quality
      task: |
        Generate test scaffolds:

        1. **Contract Tests** (tests/contract/{{domain}}.test.ts)
           - Schema validation tests
           - Invariant enforcement tests
           - Edge case tests

        2. **Domain Tests** (tests/core/{{domain}}-domain.test.ts)
           - Unit tests for domain logic
           - Integration tests

  - stepId: generate-summary
    name: Generate Implementation Summary
    type: prompt
    timeout: 60000
    dependencies: [generate-guard-policy, generate-test-scaffold]
    config:
      agent: writer
      task: |
        Create a comprehensive implementation summary:

        # {{domain}} Domain - Contract-First Scaffold

        ## Overview
        [Brief description]

        ## Generated Artifacts

        ### Contracts
        - schema.ts: [List of schemas]
        - invariants.md: [List of invariants]

        ### Domain Package
        - [List of files and their purposes]

        ### Guard Policy
        - Policy ID: {{domain}}-development
        - Change radius: 2
        - Gates: [List]

        ### Tests
        - Contract tests: [Count]
        - Domain tests: [Count]

        ## Next Steps
        1. Review generated schemas
        2. Implement domain logic
        3. Run guard check
        4. Write additional tests

  - stepId: store-scaffold-result
    name: Store Scaffold Result
    type: tool
    timeout: 10000
    dependencies: [generate-summary]
    config:
      tool: memory_store
      namespace: scaffold
      key: "{{domain}}/{{timestamp}}"
```

---

## 6. User Stories

### 6.1 Epic: Contract Generation

**US-SCF-001: Generate Zod Schema from Description**
```
As a developer
I want to describe my domain in natural language
So that I can get a valid Zod schema without manual coding

Acceptance Criteria:
- [ ] Can describe entities with fields and types
- [ ] Generated schema passes TypeScript compilation
- [ ] Schema includes appropriate validation rules
- [ ] Generated code follows camelCase conventions
```

**US-SCF-002: Generate Invariants Documentation**
```
As a developer
I want to automatically generate invariants.md
So that behavioral guarantees are documented consistently

Acceptance Criteria:
- [ ] Invariants follow INV-XXX-NNN format
- [ ] Each invariant has description, enforcement, and test
- [ ] Invariants are categorized (schema, runtime, test)
- [ ] Generated markdown is properly formatted
```

### 6.2 Epic: Domain Package Scaffold

**US-SCF-010: Scaffold Domain Package**
```
As a developer
I want to scaffold a complete domain package
So that I have a consistent project structure

Acceptance Criteria:
- [ ] Generates contracts/src/<domain>/v1/ structure
- [ ] Generates core/<domain>-domain/ structure
- [ ] Includes package.json with correct dependencies
- [ ] Includes tsconfig.json with correct paths
- [ ] Exports are properly configured
```

**US-SCF-011: Scaffold with Existing Contract**
```
As a developer
I want to scaffold a domain from existing contracts
So that I can generate implementation scaffolds

Acceptance Criteria:
- [ ] Accepts path to existing schema.ts
- [ ] Generates domain implementation stubs
- [ ] Generates test stubs
- [ ] Does not overwrite existing files
```

### 6.3 Epic: Guard Policy Generation

**US-SCF-020: Generate Guard Policy**
```
As a developer
I want to automatically generate guard policies
So that governance is configured correctly

Acceptance Criteria:
- [ ] Generates policy with correct allowed_paths
- [ ] Generates policy with correct forbidden_paths
- [ ] Includes all recommended gates
- [ ] Change radius is appropriate for domain size
```

### 6.4 Epic: CLI Integration

**US-SCF-030: Interactive Scaffold Mode**
```
As a developer
I want an interactive CLI mode
So that I can scaffold without knowing exact options

Acceptance Criteria:
- [ ] Prompts for domain name
- [ ] Prompts for entities
- [ ] Shows preview before generating
- [ ] Confirms before writing files
```

---

## 7. Success Metrics

### 7.1 Adoption Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Scaffold command usage | 500+ invocations/month |
| Contract-architect agent usage | 200+ runs/month |
| Projects using scaffolded structure | 50+ |

### 7.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Generated code compilation rate | 99%+ |
| Invariant documentation completeness | 95%+ |
| Guard policy effectiveness | 90%+ violations caught |

### 7.3 Efficiency Metrics

| Metric | Target |
|--------|--------|
| Time to scaffold new domain | < 5 minutes |
| Time saved vs manual creation | 80%+ reduction |
| Developer satisfaction score | 4.5+/5.0 |

---

## 8. Implementation Roadmap

### Phase 1: Agent + Workflow (Week 1-2)
**Scope**: Leverage existing infrastructure

| Task | Owner | Status |
|------|-------|--------|
| Create contract-architect agent | Engineering | Pending |
| Create contract-first-project workflow | Engineering | Pending |
| Create scaffold ability documents | Engineering | Pending |
| Test with real domain examples | QA | Pending |

**Deliverables**:
- `contract-architect` agent in agents.json
- `contract-first-project` workflow in examples/workflows
- `contract-first.md` ability in examples/abilities

### Phase 2: File Generation Tools (Week 3-4)
**Scope**: Add file writing capability

| Task | Owner | Status |
|------|-------|--------|
| Implement file_write MCP tool | Engineering | Pending |
| Implement directory_create MCP tool | Engineering | Pending |
| Add file system contracts | Engineering | Pending |
| Security review for file operations | Security | Pending |

**Deliverables**:
- `file_write` MCP tool
- `directory_create` MCP tool
- File operation contracts in packages/contracts

### Phase 3: CLI Commands (Week 5-7)
**Scope**: Add scaffold CLI subcommands

| Task | Owner | Status |
|------|-------|--------|
| Implement `ax scaffold contract` | Engineering | Pending |
| Implement `ax scaffold domain` | Engineering | Pending |
| Implement `ax scaffold guard` | Engineering | Pending |
| Add interactive mode | Engineering | Pending |
| Documentation | Documentation | Pending |

**Deliverables**:
- `ax scaffold` command with subcommands
- Interactive prompts for each command
- CLI documentation

### Phase 4: Full Integration (Week 8-10)
**Scope**: Polish and ecosystem integration

| Task | Owner | Status |
|------|-------|--------|
| Project templates system | Engineering | Pending |
| IDE extension hints | Engineering | Pending |
| Comprehensive testing | QA | Pending |
| User documentation | Documentation | Pending |
| Launch announcement | Marketing | Pending |

**Deliverables**:
- Project template system
- Complete documentation
- Example projects

---

## 9. Dependencies

### 9.1 Internal Dependencies

| Dependency | Required For | Status |
|------------|--------------|--------|
| design_schema tool | Contract generation | Exists |
| design_component tool | Domain scaffolding | Exists |
| design_architecture tool | Structure visualization | Exists |
| Agent execution system | Agent workflows | Exists |
| Workflow engine | Multi-step orchestration | Exists |
| Guard system | Policy validation | Exists |

### 9.2 New Components Required

| Component | Purpose | Phase |
|-----------|---------|-------|
| file_write MCP tool | Write files to disk | Phase 2 |
| directory_create MCP tool | Create directories | Phase 2 |
| scaffold CLI command | User interface | Phase 3 |
| Template engine | Project templates | Phase 4 |

---

## 10. Risks and Mitigations

### 10.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Generated code quality issues | Medium | High | Validation gates, human review required |
| File system security concerns | Low | High | Sandboxing, path validation, permission checks |
| Breaking existing workflows | Low | Medium | Feature flags, backward compatibility |

### 10.2 Adoption Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Steep learning curve | Medium | Medium | Interactive mode, comprehensive docs, examples |
| Resistance to generated code | Medium | Medium | Show value through time savings, quality metrics |
| Over-reliance on generation | Low | Low | Emphasize scaffolding, not replacement |

---

## 11. Open Questions

| Question | Owner | Due Date |
|----------|-------|----------|
| Should file_write require explicit user confirmation? | Security | Week 2 |
| What's the maximum project size we should support? | Architecture | Week 3 |
| Should we support languages other than TypeScript? | Product | Week 4 |
| How do we handle contract versioning in scaffolds? | Architecture | Week 4 |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Contract** | Zod schema defining interface shape |
| **Invariant** | Behavioral guarantee that must always hold |
| **Scaffold** | Generated project structure/boilerplate |
| **Domain** | Bounded context with its own contracts and logic |
| **Aggregate** | Entity cluster with clear ownership root |
| **Guard Policy** | Governance rules for code changes |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-19 | AutomatosX Team | Initial PRD |

---

## Appendix A: Example Generated Output

### A.1 Example: Payment Domain Contract

**Input**:
```
Domain: payment
Entities:
- Invoice (aggregate): id, customerId, amount, currency, status, dueDate
- LineItem: id, invoiceId, description, quantity, unitPrice
- Payment: id, invoiceId, amount, method, processedAt
```

**Generated schema.ts**:
```typescript
import { z } from 'zod';

// ============================================================================
// Payment Domain Contracts v1
// ============================================================================

export const CurrencySchema = z.enum(['USD', 'EUR', 'GBP', 'JPY']);
export type Currency = z.infer<typeof CurrencySchema>;

export const InvoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const PaymentMethodSchema = z.enum([
  'credit_card',
  'bank_transfer',
  'paypal',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Line item in an invoice
 */
export const LineItemSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});
export type LineItem = z.infer<typeof LineItemSchema>;

/**
 * Invoice aggregate root
 *
 * Invariants:
 * - INV-PAY-001: Invoice amount equals sum of line items
 * - INV-PAY-002: Invoice cannot be paid if already cancelled
 */
export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().min(0),
  currency: CurrencySchema,
  status: InvoiceStatusSchema.default('draft'),
  dueDate: z.string().datetime(),
  lineItems: z.array(LineItemSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

/**
 * Payment record
 */
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: z.number().min(0),
  method: PaymentMethodSchema,
  processedAt: z.string().datetime(),
});
export type Payment = z.infer<typeof PaymentSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateInvoice(data: unknown): Invoice {
  return InvoiceSchema.parse(data);
}

export function validatePayment(data: unknown): Payment {
  return PaymentSchema.parse(data);
}
```

**Generated invariants.md**:
```markdown
# Payment Domain Invariants

## Schema Invariants

### INV-PAY-001: Invoice Amount Consistency
Invoice amount MUST equal the sum of all line item totals.
- **Enforcement**: Runtime validation
- **Test**: `invoice.amount === sum(lineItems.map(li => li.quantity * li.unitPrice))`

### INV-PAY-002: Status Transition Rules
Invoice status transitions MUST follow valid state machine.
- **Enforcement**: Runtime validation
- **Valid Transitions**:
  - draft → sent
  - sent → paid | overdue | cancelled
  - overdue → paid | cancelled
- **Test**: State machine validation

### INV-PAY-003: Payment Amount Constraint
Payment amount MUST NOT exceed invoice amount.
- **Enforcement**: Schema validation (superRefine)
- **Test**: `payment.amount <= invoice.amount`

## Business Invariants

### INV-PAY-010: Currency Consistency
All line items inherit currency from parent invoice.
- **Enforcement**: Schema (no currency field on LineItem)
- **Test**: N/A (enforced by schema design)

### INV-PAY-011: Due Date Validity
Invoice due date MUST be in the future when created.
- **Enforcement**: Runtime validation
- **Test**: `new Date(invoice.dueDate) > new Date()`
```
