# Contract-First Scaffolding

The AutomatosX CLI provides a powerful scaffolding system for creating contract-first TypeScript projects, domains, and guard policies.

## Quick Start

```bash
# Create a new standalone project
ax scaffold project my-app -m order

# Create a new monorepo
ax scaffold project ecommerce -m order -t monorepo -s @myorg

# Add a new contract to an existing project
ax scaffold contract payment -d "Payment processing domain"

# Add a new domain implementation
ax scaffold domain payment

# Create a guard policy
ax scaffold guard payment-development -r 3
```

## Commands

### `ax scaffold project`

Creates a new project from a template.

```bash
ax scaffold project <name> -m <domain> [options]
```

**Required:**
- `<name>` - Project name (kebab-case)
- `-m, --domain <name>` - Primary domain name

**Options:**
- `-t, --template <type>` - Template type: `standalone` (default) or `monorepo`
- `-s, --scope <scope>` - NPM package scope (default: `@myorg`)
- `-d, --description <desc>` - Project description
- `-o, --output <path>` - Output directory (default: project name)
- `--dry-run` - Preview without writing files

**Examples:**
```bash
# Standalone project (default)
ax scaffold project my-app -m order

# Monorepo with custom scope
ax scaffold project ecommerce -m order -t monorepo -s @mycompany

# Preview what would be created
ax scaffold project my-app -m order --dry-run
```

### `ax scaffold contract`

Generates Zod schemas and invariants for a new domain.

```bash
ax scaffold contract <name> [options]
```

**Options:**
- `-d, --description <desc>` - Domain description
- `-o, --output <path>` - Output directory
- `--dry-run` - Preview without writing files

**Generated Files:**
- `schema.ts` - Zod schemas for entities, events, and requests
- `invariants.md` - Domain invariants documentation
- `index.ts` - Barrel export

**Example:**
```bash
ax scaffold contract payment -d "Payment processing domain"
```

### `ax scaffold domain`

Generates a complete domain implementation package.

```bash
ax scaffold domain <name> [options]
```

**Options:**
- `-s, --scope <scope>` - Package scope (default: `@defai.digital`)
- `-o, --output <path>` - Output directory
- `--no-tests` - Skip test file generation
- `--no-guard` - Skip guard policy generation
- `--dry-run` - Preview without writing files

**Generated Files:**
- `package.json` - Domain package configuration
- `src/index.ts` - Barrel export
- `src/types.ts` - Domain types and interfaces
- `src/service.ts` - Domain service implementation
- `tests/contract/<name>.test.ts` - Contract tests
- `packages/guard/policies/<name>-development.yaml` - Guard policy

**Example:**
```bash
ax scaffold domain payment --no-tests
```

### `ax scaffold guard`

Generates a guard policy for a domain.

```bash
ax scaffold guard <policy-id> [options]
```

**Options:**
- `-m, --domain <name>` - Domain name (inferred from policy ID if not provided)
- `-r, --radius <n>` - Change radius limit (default: 3)
- `-g, --gates <gates>` - Comma-separated list of gates
- `--dry-run` - Preview without writing files

**Default Gates:**
- `path_violation` - Enforce allowed/forbidden paths
- `dependency` - Check import boundaries
- `change_radius` - Limit number of packages modified
- `contract_tests` - Verify contract tests pass

**Example:**
```bash
ax scaffold guard payment-dev -r 5 -g path_violation,dependency
```

## Templates

### Standalone Template

A single-package project structure for simpler applications.

**Structure:**
```
my-app/
├── package.json
├── tsconfig.json
├── src/
│   ├── contracts/
│   │   └── <domain>/
│   │       ├── schema.ts
│   │       ├── invariants.md
│   │       └── index.ts
│   └── domain/
│       └── <domain>/
│           ├── service.ts
│           ├── repository.ts
│           └── index.ts
├── tests/
│   └── contracts/
│       └── <domain>.test.ts
└── vitest.config.ts
```

### Monorepo Template

A multi-package monorepo structure for larger applications.

**Structure:**
```
my-app/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   └── src/<domain>/v1/
│   │       ├── schema.ts
│   │       ├── invariants.md
│   │       └── index.ts
│   ├── core/<domain>-domain/
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── adapters/
└── tests/
    ├── contract/
    └── core/
```

## Contract-First Design

The scaffold system follows contract-first design principles:

1. **Schema First**: All entities are defined as Zod schemas
2. **Invariants Documented**: Behavioral guarantees are documented in `invariants.md`
3. **Type Safety**: TypeScript types are inferred from schemas
4. **Validation Built-in**: Runtime validation via schema parsing

### Invariant Codes

Invariants use a consistent naming convention:

```
INV-XXX-NNN
     │   │
     │   └── Sequence number (001-999)
     └────── 3-letter domain code (e.g., ORD, PAY)
```

**Categories:**
- `001-099` - Schema invariants (enforced by Zod)
- `100-199` - Runtime invariants (enforced in code)
- `200-299` - Business invariants (enforced by tests)
- `300-399` - Cross-aggregate invariants

## Integration with Guard System

When scaffolding domains, guard policies are automatically generated to:

1. **Restrict File Changes**: Only allow modifications to domain-specific files
2. **Enforce Dependencies**: Prevent unauthorized cross-domain imports
3. **Limit Change Scope**: Set maximum number of packages that can be modified
4. **Require Tests**: Ensure contract tests pass before changes are accepted

Apply policies using:
```bash
ax guard apply <session-id> --policy <domain>-development
```

## Best Practices

1. **Start with Contracts**: Always scaffold contracts before implementation
2. **Use Invariants**: Document all behavioral guarantees
3. **Test Schemas**: Write contract tests for all schema validations
4. **Review Policies**: Customize guard policies for your team's workflow
5. **Preview First**: Use `--dry-run` to preview before creating files
