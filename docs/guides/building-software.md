# Building Quality Software with AutomatosX

This guide teaches you how to use AutomatosX (ax) to build high-quality software from scratch. You'll learn the contract-first approach, how to leverage AI agents, and how to enforce quality through governance.

## Table of Contents

1. [Philosophy: Contract-First Development](#philosophy-contract-first-development)
2. [Project Setup](#project-setup)
3. [Defining Contracts](#defining-contracts)
4. [Implementing Domains](#implementing-domains)
5. [Using AI Agents](#using-ai-agents)
6. [Running Workflows](#running-workflows)
7. [Code Review & Quality](#code-review--quality)
8. [Governance with Guards](#governance-with-guards)
9. [Complete Example: E-Commerce Platform](#complete-example-e-commerce-platform)

---

## Philosophy: Contract-First Development

AutomatosX follows a **contract-first** approach:

1. **Define contracts first** - Zod schemas and invariants before code
2. **Generate scaffolds** - Consistent structure from contracts
3. **Implement with AI** - Use agents for development
4. **Review and validate** - AI-powered code review
5. **Enforce governance** - Guard policies prevent violations

This approach ensures:
- **Type safety** across your entire codebase
- **Behavioral guarantees** documented as invariants
- **Consistent architecture** via scaffolding
- **Quality enforcement** through automated checks

---

## Project Setup

### Option 1: Create a New Standalone Project

Best for single applications or microservices:

```bash
# Create project with order domain
pnpm ax scaffold project my-app \
  --domain order \
  --template standalone \
  --scope @mycompany \
  --description "Order management system"

# Navigate and setup
cd my-app
pnpm install
pnpm build
```

This creates:
```
my-app/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── packages/
│   └── contracts/
│       └── src/
│           └── order/
│               └── v1/
│                   ├── schema.ts      # Zod schemas
│                   ├── invariants.md  # Behavioral rules
│                   └── index.ts
└── src/
    ├── index.ts
    ├── order-service.ts
    └── order-repository.ts
```

### Option 2: Create a Monorepo Project

Best for platforms with multiple domains:

```bash
# Create monorepo structure
pnpm ax scaffold project platform \
  --domain user \
  --template monorepo \
  --scope @platform

cd platform
pnpm install

# Add more domains
pnpm ax scaffold contract order --description "Order management"
pnpm ax scaffold contract payment --description "Payment processing"
pnpm ax scaffold contract inventory --description "Inventory tracking"
```

This creates:
```
platform/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── contracts/
│   │   └── src/
│   │       ├── user/v1/
│   │       ├── order/v1/
│   │       ├── payment/v1/
│   │       └── inventory/v1/
│   └── core/
│       └── user-domain/
└── tests/
```

---

## Defining Contracts

Contracts are the foundation of your application. They define **what** your system does before you write **how**.

### Scaffold a Contract

```bash
pnpm ax scaffold contract payment \
  --description "Payment processing domain" \
  --entities "Payment,Refund,PaymentMethod"
```

### Contract Structure

Each contract has three files:

#### 1. `schema.ts` - Zod Schemas

```typescript
// packages/contracts/src/payment/v1/schema.ts
import { z } from 'zod';

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded'
]);

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: PaymentStatusSchema,
  createdAt: z.date(),
  processedAt: z.date().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentInputSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  paymentMethod: z.string(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentInputSchema>;

export const CreatePaymentOutputSchema = z.object({
  payment: PaymentSchema,
  transactionId: z.string(),
});
```

#### 2. `invariants.md` - Behavioral Rules

```markdown
# Payment Domain Invariants

## Schema Invariants

### INV-PAY-001: Positive Amount
Payment amounts MUST be positive numbers.
- **Enforcement**: schema
- **Test**: `CreatePaymentInputSchema` rejects non-positive amounts

### INV-PAY-002: Valid Currency
Currency codes MUST be exactly 3 uppercase letters (ISO 4217).
- **Enforcement**: schema
- **Test**: `PaymentSchema` validates currency format

## Business Invariants

### INV-PAY-101: Idempotent Processing
Processing the same payment twice MUST return the existing result.
- **Enforcement**: runtime
- **Key**: orderId + amount + paymentMethod

### INV-PAY-102: Refund Cannot Exceed Payment
Refund amount MUST NOT exceed original payment amount.
- **Enforcement**: runtime
- **Test**: Refund creation validates against payment total

### INV-PAY-103: Terminal States Are Final
Completed, failed, and refunded payments CANNOT change status.
- **Enforcement**: runtime
- **Test**: State machine rejects invalid transitions
```

#### 3. `index.ts` - Exports

```typescript
// packages/contracts/src/payment/v1/index.ts
export * from './schema.js';
```

### Writing Good Invariants

Follow the INV-XXX-NNN naming convention:

| Range | Category | Example |
|-------|----------|---------|
| 001-099 | Schema validation | INV-PAY-001: Positive Amount |
| 101-199 | Business rules | INV-PAY-101: Idempotent Processing |
| 201-299 | State management | INV-PAY-201: Valid Transitions |
| 301-399 | Integration | INV-PAY-301: Gateway Timeout |
| 401-499 | Security | INV-PAY-401: PCI Compliance |

---

## Implementing Domains

Once contracts are defined, scaffold the domain implementation:

```bash
pnpm ax scaffold domain payment \
  --contract ./packages/contracts/src/payment \
  --scope @platform
```

This creates:
```
packages/core/payment-domain/
├── package.json
├── src/
│   ├── index.ts
│   ├── types.ts          # Re-exports from contracts
│   ├── service.ts        # Business logic
│   └── repository.ts     # Data access (port interface)
└── tests/
    └── payment.test.ts
```

### Domain Service Pattern

```typescript
// packages/core/payment-domain/src/service.ts
import {
  Payment,
  CreatePaymentInput,
  CreatePaymentInputSchema,
  PaymentSchema,
} from '@platform/contracts';
import { PaymentRepository } from './repository.js';

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  /**
   * Create a new payment
   *
   * Invariants:
   * - INV-PAY-001: Amount must be positive (schema enforced)
   * - INV-PAY-101: Idempotent - returns existing if duplicate
   */
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    // Validate input against schema
    const validated = CreatePaymentInputSchema.parse(input);

    // Check for existing payment (INV-PAY-101)
    const existing = await this.repository.findByOrderId(validated.orderId);
    if (existing) {
      return existing;
    }

    // Create new payment
    const payment = await this.repository.create({
      id: crypto.randomUUID(),
      ...validated,
      status: 'pending',
      createdAt: new Date(),
    });

    return PaymentSchema.parse(payment);
  }

  /**
   * Process a pending payment
   *
   * Invariants:
   * - INV-PAY-103: Only pending payments can be processed
   */
  async processPayment(paymentId: string): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);

    if (!payment) {
      throw new Error('Payment not found');
    }

    // INV-PAY-103: Terminal states are final
    if (payment.status !== 'pending') {
      throw new Error(`Cannot process payment in ${payment.status} status`);
    }

    // Process with payment gateway...
    const processed = await this.repository.update(paymentId, {
      status: 'completed',
      processedAt: new Date(),
    });

    return PaymentSchema.parse(processed);
  }
}
```

---

## Using AI Agents

AutomatosX provides specialized agents for different development tasks.

### List Available Agents

```bash
pnpm ax agent list
```

AutomatosX provides 23+ specialized agents:

**Engineering Agents:**
| Agent | Purpose |
|-------|---------|
| `fullstack` | End-to-end web development |
| `backend` | API and server-side development |
| `frontend` | UI/UX implementation |
| `architecture` | System design and patterns |
| `security` | Security analysis and hardening |
| `quality` | Code quality and testing |
| `devops` | Infrastructure and deployment |
| `mobile` | Cross-platform mobile development |

**ML/Data Agents:**
| Agent | Purpose |
|-------|---------|
| `data-scientist` | Data analysis and ML models |
| `ml-engineer` | Production ML systems |
| `mlops-engineer` | ML infrastructure and ops |

**Leadership Agents:**
| Agent | Purpose |
|-------|---------|
| `cto` | Technical strategy and leadership |
| `product` | Product management and planning |

See [Agents Reference](../reference/agents.md) for the complete list.

### Run an Agent

```bash
# Get agent details
pnpm ax agent get fullstack

# Run with a task
pnpm ax agent run fullstack --input '{
  "query": "Implement a REST API for the payment domain with Stripe integration"
}'
```

### Register Custom Agents

Create a JSON file and register:

```json
{
  "agentId": "payment-specialist",
  "displayName": "Payment Specialist",
  "description": "Expert in payment processing and PCI compliance",
  "team": "engineering",
  "expertise": ["stripe", "payment-processing", "pci-dss", "fraud-detection"],
  "capabilities": ["payment-integration", "security-review", "compliance"],
  "systemPrompt": "You are a payment integration specialist with deep knowledge of Stripe, PCI-DSS compliance, and fraud prevention...",
  "enabled": true
}
```

```bash
pnpm ax agent register < payment-specialist.json
```

---

## Running Workflows

Workflows orchestrate multiple steps and agents for complex tasks.

### List Available Workflows

```bash
pnpm ax list
```

### Run a Workflow

```bash
# Feature development workflow
pnpm ax run developer --input '{
  "feature": "Add subscription billing to payment domain"
}'

# Code review workflow
pnpm ax run code-reviewer --input '{
  "paths": ["packages/core/payment-domain/src/"]
}'

# Security audit workflow
pnpm ax run security-audit --input '{
  "scope": "packages/core/payment-domain/"
}'
```

### Create Custom Workflows

Create a YAML file in your workflows directory:

```yaml
# workflows/payment-feature.yaml
workflowId: payment-feature
version: "1.0.0"
name: Payment Feature Development
description: End-to-end payment feature implementation

steps:
  - stepId: analyze
    type: prompt
    name: Analyze Requirements
    config:
      agentId: architecture
      prompt: |
        Analyze the payment feature request:
        ${input.feature}

        Consider:
        1. PCI-DSS compliance requirements
        2. Idempotency needs
        3. Error handling and rollback
        4. Integration points

  - stepId: design
    type: prompt
    name: Design API
    config:
      agentId: backend
      prompt: |
        Based on the analysis, design the API:
        ${previousOutputs.analyze.content}

        Include:
        1. Endpoint specifications
        2. Request/response schemas
        3. Error codes
        4. Webhook events
    dependencies: [analyze]

  - stepId: implement
    type: prompt
    name: Implement Feature
    config:
      agentId: fullstack
      prompt: |
        Implement the payment feature:
        ${previousOutputs.design.content}

        Follow the contract-first approach.
    dependencies: [design]

  - stepId: review
    type: tool
    name: Security Review
    config:
      tool: review_analyze
      args:
        paths: ["packages/core/payment-domain/"]
        focus: security
    dependencies: [implement]

metadata:
  category: payment
  tags: [payment, feature, stripe]
```

---

## Code Review & Quality

### AI-Powered Code Review

```bash
# Security-focused review
pnpm ax review analyze src/ --focus security

# Architecture review
pnpm ax review analyze src/ --focus architecture

# Performance review
pnpm ax review analyze src/ --focus performance

# Maintainability review
pnpm ax review analyze src/ --focus maintainability

# Correctness review
pnpm ax review analyze src/ --focus correctness

# Comprehensive review (all aspects)
pnpm ax review analyze src/ --focus all
```

### Review Focus Modes

| Focus | What It Checks |
|-------|----------------|
| `security` | Vulnerabilities, injection, auth issues, secrets |
| `architecture` | Design patterns, coupling, separation of concerns |
| `performance` | Bottlenecks, memory leaks, inefficient algorithms |
| `maintainability` | Code complexity, documentation, test coverage |
| `correctness` | Logic errors, edge cases, invariant violations |
| `all` | All of the above |

### View Past Reviews

```bash
pnpm ax review list --limit 10
```

---

## Governance with Guards

Guards enforce policies on AI-generated code changes.

### Built-in Policies

| Policy | Purpose | Radius |
|--------|---------|--------|
| `bugfix` | Bug fix changes | 3 packages |
| `provider-refactor` | Provider adapter changes | 2 packages |
| `rebuild` | Major refactoring | 10 packages |

### Check Changes Against Policy

```bash
# Check what files were changed
pnpm ax guard check \
  --policy bugfix \
  --changed-paths "packages/core/payment-domain/src/service.ts,packages/core/payment-domain/src/types.ts"
```

### Create Custom Guard Policies

```bash
pnpm ax scaffold guard payment-changes \
  --domain payment \
  --radius 2 \
  --gates path_violation,dependency,contract_tests
```

This creates a policy that:
- Limits changes to 2 package radius
- Checks for path violations
- Validates dependency boundaries
- Ensures contract tests pass

### Gate Types

| Gate | Purpose |
|------|---------|
| `path_violation` | Enforce allowed/forbidden paths |
| `dependency` | Check import boundaries |
| `change_radius` | Limit number of packages modified |
| `contract_tests` | Verify contract tests pass |
| `secrets` | Detect potential secrets in code |

---

## Complete Example: E-Commerce Platform

Let's build a complete e-commerce platform from scratch.

### Step 1: Create Project Structure

```bash
# Create monorepo
pnpm ax scaffold project ecommerce \
  --domain user \
  --template monorepo \
  --scope @ecom \
  --description "E-commerce platform"

cd ecommerce
pnpm install
```

### Step 2: Define Domain Contracts

```bash
# User domain (already created)
# Add order domain
pnpm ax scaffold contract order \
  --description "Order management - cart, checkout, order tracking"

# Payment domain
pnpm ax scaffold contract payment \
  --description "Payment processing - Stripe integration, refunds"

# Inventory domain
pnpm ax scaffold contract inventory \
  --description "Inventory tracking - stock levels, reservations"

# Shipping domain
pnpm ax scaffold contract shipping \
  --description "Shipping - rates, tracking, delivery"
```

### Step 3: Review and Refine Contracts

```bash
# Use AI to review your contracts
pnpm ax call claude --file packages/contracts/src/order/v1/schema.ts \
  "Review this order schema. Suggest improvements for a production e-commerce system."
```

Edit the schemas based on feedback, adding:
- Validation rules
- Default values
- Optional fields
- Proper types

### Step 4: Generate Domain Implementations

```bash
pnpm ax scaffold domain order
pnpm ax scaffold domain payment
pnpm ax scaffold domain inventory
pnpm ax scaffold domain shipping
```

### Step 5: Implement Business Logic

Use the developer workflow:

```bash
pnpm ax run developer --input '{
  "feature": "Implement order creation with inventory reservation and payment processing"
}'
```

Or use specific agents:

```bash
# Backend implementation
pnpm ax agent run backend --input '{
  "query": "Implement the order service with cart management, checkout flow, and integration with payment and inventory domains"
}'

# Frontend implementation
pnpm ax agent run frontend --input '{
  "query": "Create React components for shopping cart, checkout flow, and order confirmation"
}'
```

### Step 6: Review Code Quality

```bash
# Security review
pnpm ax review analyze packages/core/ --focus security

# Architecture review
pnpm ax review analyze packages/core/ --focus architecture

# Full review
pnpm ax review analyze packages/ --focus all
```

### Step 7: Set Up Governance

```bash
# Create domain-specific policies
pnpm ax scaffold guard order-changes --domain order --radius 2
pnpm ax scaffold guard payment-changes --domain payment --radius 1

# Check compliance
pnpm ax guard check --policy payment-changes \
  --changed-paths "packages/core/payment-domain/src/service.ts"
```

### Step 8: Iterate and Improve

```bash
# Debug issues
pnpm ax run debugger --input '{"issue": "Orders failing at checkout"}'

# Add new features
pnpm ax run developer --input '{"feature": "Add coupon code support"}'

# Refactor for scale
pnpm ax run refactoring --input '{"target": "packages/core/order-domain/"}'
```

---

## Best Practices

### 1. Always Start with Contracts

```bash
# Good: Contract first
pnpm ax scaffold contract feature-x
# Then implement
pnpm ax scaffold domain feature-x

# Bad: Code first (leads to inconsistencies)
```

### 2. Write Comprehensive Invariants

Document all behavioral rules in `invariants.md`:
- Schema validation rules
- Business logic constraints
- State machine rules
- Integration requirements
- Security requirements

### 3. Use Focused Reviews

```bash
# Review specific aspects, not everything at once
pnpm ax review analyze src/auth/ --focus security
pnpm ax review analyze src/api/ --focus performance
```

### 4. Enforce Governance

```bash
# Always check changes against policies
pnpm ax guard check --policy bugfix --changed-paths "..."
```

### 5. Leverage Specialized Agents

```bash
# Use the right agent for the job
pnpm ax agent run security --input '{"query": "Audit the authentication flow"}'
pnpm ax agent run architecture --input '{"query": "Design the caching strategy"}'
```

### 6. Trace and Debug

```bash
# View execution traces
pnpm ax trace

# Analyze specific trace
pnpm ax trace <trace-id> --verbose
```

---

## Autonomous Development Mode

For complex tasks, use the autonomous iterate mode:

```bash
# Let AI work autonomously on implementation
pnpm ax iterate claude "implement the payment domain with Stripe integration"

# With iteration limits
pnpm ax iterate gemini --max-iterations 30 "add comprehensive test coverage"

# Time-limited
pnpm ax iterate codex --max-time 15m "refactor authentication module"
```

The iterate mode:
1. Sends your task to the AI
2. AI works on the implementation
3. Continues automatically until complete
4. Pauses when it needs your input
5. Stops when done or limits reached

---

## Next Steps

- **[Quickstart Guide](../quickstart.md)** - Get running in 5 minutes
- **[Improving Apps Guide](./improving-apps.md)** - Modernize existing applications
- **[MLOps Guide](./mlops-guide.md)** - Machine learning operations
- **[CLI Reference](../reference/cli-commands.md)** - Complete CLI documentation
- **[Workflows Reference](../reference/workflows.md)** - All available workflows
- **[Agents Reference](../reference/agents.md)** - All available agents
