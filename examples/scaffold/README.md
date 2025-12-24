# Contract-First Scaffold Examples

This directory contains examples of using the AutomatosX scaffold system.

## Quick Start

```bash
# Preview standalone project creation
pnpm ax scaffold project my-shop -m product --dry-run

# Preview monorepo creation
pnpm ax scaffold project ecommerce -m order -t monorepo -s @acme --dry-run

# Preview contract creation
pnpm ax scaffold contract inventory -d "Inventory management" --dry-run
```

## Example: E-commerce Platform

This example shows how to scaffold a complete e-commerce platform using the monorepo template.

### Step 1: Create the Monorepo

```bash
ax scaffold project ecommerce -m order -t monorepo -s @ecom
```

This creates:
- Core order domain contracts
- Order domain implementation skeleton
- Monorepo structure with pnpm workspaces

### Step 2: Add More Domains

```bash
# Add payment domain
ax scaffold contract payment -d "Payment processing"
ax scaffold domain payment

# Add inventory domain
ax scaffold contract inventory -d "Inventory management"
ax scaffold domain inventory

# Add customer domain
ax scaffold contract customer -d "Customer management"
ax scaffold domain customer
```

### Step 3: Configure Guard Policies

Each domain automatically gets a guard policy. Review and customize:

```yaml
# packages/guard/policies/order-development.yaml
policy_id: order-development
change_radius_limit: 3
gates:
  - path_violation
  - dependency
  - change_radius
  - contract_tests
```

### Step 4: Run Tests

```bash
cd ecommerce
pnpm install
pnpm build
pnpm test
```

## Example: Microservice

For a simpler single-service project, use the standalone template:

```bash
ax scaffold project payment-service -m payment
cd payment-service
pnpm install
pnpm build
pnpm test
```

## Generated Invariants

Each domain includes documented invariants. Example for order domain:

```markdown
# Order Domain Invariants

## Schema Invariants

### INV-ORD-001: Valid ID Format
Order ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs

### INV-ORD-002: Valid Status
Status MUST be one of: draft, active, completed, cancelled
- **Enforcement**: schema
- **Test**: `z.enum([...])` rejects invalid values

## Runtime Invariants

### INV-ORD-101: Status Transitions
Status transitions MUST follow the state machine.
- **Valid**: draft → active, cancelled
- **Valid**: active → completed, cancelled
- **Invalid**: completed → any, cancelled → any
```

## Template Customization

Templates can be customized by editing files in `templates/`:

```
templates/
├── monorepo/
│   ├── template.json       # Template configuration
│   ├── package.json.hbs    # Root package.json
│   ├── schema.ts.hbs       # Zod schema template
│   └── ...
└── standalone/
    ├── template.json
    └── ...
```

### Template Variables

Available in all templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{projectName}}` | Project name | `ecommerce` |
| `{{domainName}}` | Domain name | `order` |
| `{{scope}}` | Package scope | `@ecom` |
| `{{description}}` | Description | `E-commerce platform` |
| `{{pascalCase domainName}}` | PascalCase | `Order` |
| `{{upperCase (substring domainName 0 3)}}` | Domain code | `ORD` |
