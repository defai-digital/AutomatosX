# Implementation PRD: Multi-Model Discussion System

**Version**: 1.0.0
**Status**: Ready for Implementation
**Author**: AutomatosX Team
**Date**: 2025-12-24
**Related**: PRD-v16-multi-model-discussion.md

---

## 1. Overview

### 1.1 Purpose

This document provides detailed implementation specifications for the Multi-Model Discussion System, enabling multiple LLM providers to collaborate, debate, and synthesize ideas.

### 1.2 Supported Providers

| Provider | Key Strengths | Discussion Role |
|----------|--------------|-----------------|
| **Claude** | Reasoning, synthesis, ethics | Synthesizer, moderator |
| **Gemini** | Research, long context (1M+) | Research, large docs |
| **Codex** | Code generation | Implementation details |
| **Qwen** | OCR (75% = GPT-4o), 29 languages, translation, math | Document processing, multilingual, math |
| **GLM** | Agentic coding (73.8% SWE-bench), tool use, 1/7th cost | Fast iteration, coding tasks, cost-sensitive |
| **Grok** | Real-time info, Twitter/X | Current events, fact-check |

### 1.3 Scope

| In Scope | Out of Scope |
|----------|--------------|
| New `discuss` workflow step type | Real-time streaming discussions |
| Provider routing per step | Custom consensus algorithms |
| 5 discussion patterns | Provider-specific fine-tuning |
| CLI `ax discuss` command | GUI/web interface |
| MCP tools for discussions | Cross-session discussion memory |
| Provider affinity for agents | Cost optimization algorithms |
| GLM + Qwen as primary providers | |

### 1.3 Dependencies

- Existing workflow engine (`packages/core/workflow-engine`)
- Provider adapters (`packages/adapters/providers`)
- Agent domain (`packages/core/agent-domain`)
- MCP server (`packages/mcp-server`)

---

## 2. Contract Changes

### 2.1 New File: `packages/contracts/src/discussion/v1/schema.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Discussion Pattern Schema
// ============================================================================

/**
 * Discussion patterns supported by the system
 *
 * Invariants:
 * - INV-DISC-001: Pattern determines execution flow
 * - INV-DISC-002: All patterns produce a final synthesis
 */
export const DiscussionPatternSchema = z.enum([
  'round-robin',    // Sequential responses, each builds on previous
  'debate',         // Opposing positions with judge
  'critique',       // Propose → critique → refine
  'voting',         // Each model votes with confidence
  'synthesis',      // Parallel perspectives → synthesize
]);

export type DiscussionPattern = z.infer<typeof DiscussionPatternSchema>;

// ============================================================================
// Consensus Configuration
// ============================================================================

/**
 * Consensus method for combining model outputs
 */
export const ConsensusMethodSchema = z.enum([
  'synthesis',      // One model synthesizes all perspectives
  'voting',         // Weighted voting by confidence
  'moderator',      // Designated moderator decides
  'unanimous',      // Require all models to agree
  'majority',       // Simple majority wins
]);

export type ConsensusMethod = z.infer<typeof ConsensusMethodSchema>;

/**
 * Consensus configuration
 *
 * Invariants:
 * - INV-DISC-003: Moderator required when method is 'moderator'
 * - INV-DISC-004: Threshold must be 0-1 for voting methods
 */
export const ConsensusConfigSchema = z.object({
  /** How to reach consensus */
  method: ConsensusMethodSchema.default('synthesis'),

  /** Provider to synthesize/moderate (required for synthesis/moderator) */
  synthesizer: z.string().optional(),

  /** Confidence threshold for voting (0-1) */
  threshold: z.number().min(0).max(1).default(0.5),

  /** Whether to include dissenting opinions in output */
  includeDissent: z.boolean().default(true),

  /** Custom synthesis prompt */
  synthesisPrompt: z.string().max(5000).optional(),
}).refine(
  (data) => {
    if (data.method === 'moderator' && !data.synthesizer) {
      return false;
    }
    return true;
  },
  { message: 'INV-DISC-003: Moderator method requires synthesizer provider' }
);

export type ConsensusConfig = z.infer<typeof ConsensusConfigSchema>;

// ============================================================================
// Role Assignment (for debate pattern)
// ============================================================================

/**
 * Role assignment for debate pattern
 */
export const DebateRoleSchema = z.enum([
  'proponent',      // Argues FOR
  'opponent',       // Argues AGAINST
  'judge',          // Evaluates debate
  'moderator',      // Facilitates discussion
  'neutral',        // Provides balanced view
]);

export type DebateRole = z.infer<typeof DebateRoleSchema>;

/**
 * Provider role assignment
 */
export const RoleAssignmentSchema = z.record(
  z.string(),  // provider ID
  DebateRoleSchema
);

export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

// ============================================================================
// Discussion Step Configuration
// ============================================================================

/**
 * Configuration for a discuss workflow step
 *
 * Invariants:
 * - INV-DISC-005: At least 2 providers required
 * - INV-DISC-006: Max 6 providers per discussion
 * - INV-DISC-007: Rounds between 1-10
 * - INV-DISC-008: Debate pattern requires role assignments
 */
export const DiscussStepConfigSchema = z.object({
  /** Discussion pattern to use */
  pattern: DiscussionPatternSchema.default('synthesis'),

  /** Number of discussion rounds */
  rounds: z.number().int().min(1).max(10).default(2),

  /** Providers to participate in discussion */
  providers: z.array(z.string()).min(2).max(6),

  /** Main discussion prompt/topic */
  prompt: z.string().min(1).max(10000),

  /** Provider-specific prompt overrides */
  providerPrompts: z.record(z.string(), z.string().max(10000)).optional(),

  /** Role assignments (required for debate pattern) */
  roles: RoleAssignmentSchema.optional(),

  /** Consensus configuration */
  consensus: ConsensusConfigSchema.default({}),

  /** Timeout per provider response in ms */
  providerTimeout: z.number().int().min(5000).max(300000).default(60000),

  /** Whether to continue if a provider fails */
  continueOnProviderFailure: z.boolean().default(true),

  /** Minimum providers required to succeed */
  minProviders: z.number().int().min(1).default(2),

  /** Temperature for responses (0-2) */
  temperature: z.number().min(0).max(2).default(0.7),

  /** Enable verbose output with all perspectives */
  verbose: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.pattern === 'debate' && !data.roles) {
      return false;
    }
    return true;
  },
  { message: 'INV-DISC-008: Debate pattern requires role assignments' }
).refine(
  (data) => data.minProviders <= data.providers.length,
  { message: 'minProviders cannot exceed providers array length' }
);

export type DiscussStepConfig = z.infer<typeof DiscussStepConfigSchema>;

// ============================================================================
// Discussion Response
// ============================================================================

/**
 * Single provider's response in a discussion
 */
export const ProviderResponseSchema = z.object({
  /** Provider that generated this response */
  provider: z.string(),

  /** Response content */
  content: z.string(),

  /** Round number (1-indexed) */
  round: z.number().int().min(1),

  /** Role in discussion (if applicable) */
  role: DebateRoleSchema.optional(),

  /** Confidence score (0-1) for voting */
  confidence: z.number().min(0).max(1).optional(),

  /** Vote choice (for voting pattern) */
  vote: z.string().optional(),

  /** Response timestamp */
  timestamp: z.string().datetime(),

  /** Duration in ms */
  durationMs: z.number().int().min(0),

  /** Error if response failed */
  error: z.string().optional(),
});

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

/**
 * Discussion round containing all provider responses
 */
export const DiscussionRoundSchema = z.object({
  /** Round number (1-indexed) */
  roundNumber: z.number().int().min(1),

  /** Responses from each provider */
  responses: z.array(ProviderResponseSchema),

  /** Round summary (if generated) */
  summary: z.string().optional(),
});

export type DiscussionRound = z.infer<typeof DiscussionRoundSchema>;

/**
 * Complete discussion result
 *
 * Invariants:
 * - INV-DISC-009: Result always contains synthesis
 * - INV-DISC-010: participatingProviders >= minProviders
 */
export const DiscussionResultSchema = z.object({
  /** Whether discussion completed successfully */
  success: z.boolean(),

  /** Discussion pattern used */
  pattern: DiscussionPatternSchema,

  /** Original topic/prompt */
  topic: z.string(),

  /** Providers that participated */
  participatingProviders: z.array(z.string()),

  /** Providers that failed */
  failedProviders: z.array(z.string()),

  /** All discussion rounds */
  rounds: z.array(DiscussionRoundSchema),

  /** Final synthesized output */
  synthesis: z.string(),

  /** Consensus details */
  consensus: z.object({
    method: ConsensusMethodSchema,
    synthesizer: z.string().optional(),
    agreementScore: z.number().min(0).max(1).optional(),
    dissent: z.array(z.object({
      provider: z.string(),
      position: z.string(),
    })).optional(),
  }),

  /** Voting results (for voting pattern) */
  votingResults: z.object({
    winner: z.string(),
    votes: z.record(z.string(), z.number()),
    weightedVotes: z.record(z.string(), z.number()),
  }).optional(),

  /** Total duration in ms */
  totalDurationMs: z.number().int().min(0),

  /** Discussion metadata */
  metadata: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    totalTokens: z.number().int().optional(),
    estimatedCost: z.number().optional(),
  }),

  /** Error if discussion failed */
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type DiscussionResult = z.infer<typeof DiscussionResultSchema>;

// ============================================================================
// Discussion Request (for CLI/MCP)
// ============================================================================

/**
 * Request to start a discussion
 */
export const DiscussionRequestSchema = z.object({
  /** Topic or question to discuss */
  topic: z.string().min(1).max(5000),

  /** Discussion pattern */
  pattern: DiscussionPatternSchema.optional(),

  /** Providers to use */
  providers: z.array(z.string()).min(2).max(6).optional(),

  /** Number of rounds */
  rounds: z.number().int().min(1).max(10).optional(),

  /** Consensus method */
  consensusMethod: ConsensusMethodSchema.optional(),

  /** Options for voting pattern */
  votingOptions: z.array(z.string()).max(10).optional(),

  /** Additional context */
  context: z.string().max(10000).optional(),

  /** Session ID to associate with */
  sessionId: z.string().uuid().optional(),
});

export type DiscussionRequest = z.infer<typeof DiscussionRequestSchema>;

// ============================================================================
// Error Codes
// ============================================================================

export const DiscussionErrorCodes = {
  INSUFFICIENT_PROVIDERS: 'DISCUSSION_INSUFFICIENT_PROVIDERS',
  PROVIDER_TIMEOUT: 'DISCUSSION_PROVIDER_TIMEOUT',
  ALL_PROVIDERS_FAILED: 'DISCUSSION_ALL_PROVIDERS_FAILED',
  CONSENSUS_FAILED: 'DISCUSSION_CONSENSUS_FAILED',
  INVALID_PATTERN: 'DISCUSSION_INVALID_PATTERN',
  INVALID_ROLES: 'DISCUSSION_INVALID_ROLES',
  SYNTHESIS_FAILED: 'DISCUSSION_SYNTHESIS_FAILED',
} as const;

export type DiscussionErrorCode =
  (typeof DiscussionErrorCodes)[keyof typeof DiscussionErrorCodes];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateDiscussStepConfig(data: unknown): DiscussStepConfig {
  return DiscussStepConfigSchema.parse(data);
}

export function validateDiscussionRequest(data: unknown): DiscussionRequest {
  return DiscussionRequestSchema.parse(data);
}

export function validateDiscussionResult(data: unknown): DiscussionResult {
  return DiscussionResultSchema.parse(data);
}
```

### 2.2 New File: `packages/contracts/src/discussion/v1/invariants.md`

```markdown
# Discussion Domain Invariants

## Schema Invariants

### INV-DISC-001: Pattern Determines Execution Flow
Each discussion pattern has a specific execution flow that must be followed:
- `round-robin`: Sequential provider responses, each sees previous responses
- `debate`: Parallel opening → rebuttals → judge verdict
- `critique`: Proposal → parallel critiques → author refinement
- `voting`: Parallel votes → tally → winner declaration
- `synthesis`: Parallel perspectives → synthesizer combines

### INV-DISC-002: All Patterns Produce Synthesis
Every discussion pattern MUST produce a final `synthesis` field in the result,
regardless of the pattern used. This ensures consistent output format.

### INV-DISC-003: Moderator Method Requires Synthesizer
When `consensus.method` is `moderator`, the `consensus.synthesizer` field MUST
be specified to designate which provider acts as moderator.

### INV-DISC-004: Threshold Range for Voting
When using voting-based consensus, the `threshold` value MUST be between 0 and 1.

### INV-DISC-005: Minimum Provider Count
A discussion MUST have at least 2 providers. Single-provider "discussions"
should use regular prompt steps instead.

### INV-DISC-006: Maximum Provider Count
A discussion MUST NOT exceed 6 providers to maintain quality and manage costs.

### INV-DISC-007: Round Limits
Discussion rounds MUST be between 1 and 10 inclusive.

### INV-DISC-008: Debate Pattern Requires Roles
When pattern is `debate`, the `roles` field MUST be specified with at least
one `proponent` and one `opponent` role assigned.

## Runtime Invariants

### INV-DISC-009: Result Contains Synthesis
The `DiscussionResult.synthesis` field MUST always be populated, even if
the discussion partially failed. Fallback to best available response.

### INV-DISC-010: Minimum Provider Participation
At least `minProviders` providers MUST successfully respond for the
discussion to be considered successful.

### INV-DISC-011: Provider Isolation
Provider failures MUST NOT affect other providers' responses. Each provider
executes independently with proper error isolation.

### INV-DISC-012: Deterministic Synthesis Order
When synthesizing, provider responses MUST be presented in a consistent
order (alphabetical by provider ID) to ensure reproducible synthesis.

### INV-DISC-013: Round Context Accumulation
In round-robin pattern, each subsequent round MUST include all previous
round responses in the context for the provider.

### INV-DISC-014: Vote Immutability
Once a provider casts a vote, that vote MUST NOT be modified or re-cast
within the same discussion round.

## Cross-Domain Invariants

### INV-DISC-015: Trace Integration
All discussion steps MUST emit trace events for each provider response,
enabling full replay and debugging.

### INV-DISC-016: Memory Isolation
Discussion steps MUST NOT automatically write to memory. Memory storage
should be handled by explicit subsequent steps.

### INV-DISC-017: Session Association
When a sessionId is provided, all discussion activity MUST be associated
with that session for auditability.
```

### 2.3 Update: `packages/contracts/src/workflow/v1/schema.ts`

Add `discuss` to step types:

```typescript
export const StepTypeSchema = z.enum([
  'prompt',
  'tool',
  'conditional',
  'loop',
  'parallel',
  'discuss',  // NEW
]);
```

### 2.4 Update: `packages/contracts/src/agent/v1/schema.ts`

Add provider affinity:

```typescript
/**
 * Provider affinity configuration
 *
 * Invariants:
 * - INV-AGT-PA-001: Preferred providers tried in order
 * - INV-AGT-PA-002: Fallback used when all preferred fail
 */
export const ProviderAffinitySchema = z.object({
  /** Preferred providers in priority order */
  preferred: z.array(z.string()).max(6).optional(),

  /** Task type to provider mapping */
  taskMapping: z.record(
    z.string(),  // task type (e.g., 'code-review', 'research')
    z.string()   // provider ID
  ).optional(),

  /** Fallback provider when preferred unavailable */
  fallback: z.string().optional(),

  /** Exclude these providers */
  exclude: z.array(z.string()).optional(),
});

export type ProviderAffinity = z.infer<typeof ProviderAffinitySchema>;

// Add to AgentProfileSchema
export const AgentProfileSchema = AgentProfileBaseSchema.extend({
  // ... existing fields ...
  providerAffinity: ProviderAffinitySchema.optional(),
});
```

---

## 3. Core Domain Implementation

### 3.1 New Package: `packages/core/discussion-domain`

#### Structure

```
packages/core/discussion-domain/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── discussion-executor.ts
│   ├── patterns/
│   │   ├── index.ts
│   │   ├── round-robin.ts
│   │   ├── debate.ts
│   │   ├── critique.ts
│   │   ├── voting.ts
│   │   └── synthesis.ts
│   ├── consensus/
│   │   ├── index.ts
│   │   ├── synthesis-consensus.ts
│   │   ├── voting-consensus.ts
│   │   └── moderator-consensus.ts
│   └── prompts/
│       ├── index.ts
│       ├── round-robin-prompts.ts
│       ├── debate-prompts.ts
│       └── synthesis-prompts.ts
└── tests/
    ├── discussion-executor.test.ts
    └── patterns/
```

#### Key Interfaces

```typescript
// src/types.ts

import type {
  DiscussionPattern,
  DiscussStepConfig,
  DiscussionResult,
  ProviderResponse,
} from '@automatosx/contracts';

/**
 * Provider executor interface for discussion domain
 */
export interface DiscussionProviderExecutor {
  execute(
    provider: string,
    prompt: string,
    options?: {
      temperature?: number;
      timeout?: number;
    }
  ): Promise<{
    content: string;
    durationMs: number;
  }>;
}

/**
 * Pattern executor interface
 */
export interface PatternExecutor {
  pattern: DiscussionPattern;
  execute(
    config: DiscussStepConfig,
    providerExecutor: DiscussionProviderExecutor,
    context: Record<string, unknown>
  ): Promise<DiscussionResult>;
}

/**
 * Consensus executor interface
 */
export interface ConsensusExecutor {
  synthesize(
    responses: ProviderResponse[],
    config: DiscussStepConfig,
    providerExecutor: DiscussionProviderExecutor
  ): Promise<{
    synthesis: string;
    agreementScore?: number;
    dissent?: Array<{ provider: string; position: string }>;
  }>;
}
```

#### Main Executor

```typescript
// src/discussion-executor.ts

import type {
  DiscussStepConfig,
  DiscussionResult,
  DiscussionPattern,
} from '@automatosx/contracts';
import { DiscussionErrorCodes } from '@automatosx/contracts';
import type { DiscussionProviderExecutor, PatternExecutor } from './types.js';
import { RoundRobinExecutor } from './patterns/round-robin.js';
import { DebateExecutor } from './patterns/debate.js';
import { CritiqueExecutor } from './patterns/critique.js';
import { VotingExecutor } from './patterns/voting.js';
import { SynthesisExecutor } from './patterns/synthesis.js';

export class DiscussionExecutor {
  private patternExecutors: Map<DiscussionPattern, PatternExecutor>;

  constructor(private providerExecutor: DiscussionProviderExecutor) {
    this.patternExecutors = new Map([
      ['round-robin', new RoundRobinExecutor()],
      ['debate', new DebateExecutor()],
      ['critique', new CritiqueExecutor()],
      ['voting', new VotingExecutor()],
      ['synthesis', new SynthesisExecutor()],
    ]);
  }

  async execute(
    config: DiscussStepConfig,
    context: Record<string, unknown> = {}
  ): Promise<DiscussionResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // Validate provider availability
    const availableProviders = await this.checkProviderAvailability(
      config.providers
    );

    if (availableProviders.length < config.minProviders) {
      return this.createFailureResult(
        config,
        DiscussionErrorCodes.INSUFFICIENT_PROVIDERS,
        `Only ${availableProviders.length} providers available, need ${config.minProviders}`,
        startedAt
      );
    }

    // Get pattern executor
    const executor = this.patternExecutors.get(config.pattern);
    if (!executor) {
      return this.createFailureResult(
        config,
        DiscussionErrorCodes.INVALID_PATTERN,
        `Unknown pattern: ${config.pattern}`,
        startedAt
      );
    }

    try {
      // Execute the pattern
      const result = await executor.execute(
        { ...config, providers: availableProviders },
        this.providerExecutor,
        context
      );

      return {
        ...result,
        metadata: {
          ...result.metadata,
          startedAt,
          completedAt: new Date().toISOString(),
        },
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.createFailureResult(
        config,
        DiscussionErrorCodes.SYNTHESIS_FAILED,
        error instanceof Error ? error.message : 'Unknown error',
        startedAt
      );
    }
  }

  private async checkProviderAvailability(
    providers: string[]
  ): Promise<string[]> {
    // Implementation checks which providers are available
    // For now, return all providers
    return providers;
  }

  private createFailureResult(
    config: DiscussStepConfig,
    code: string,
    message: string,
    startedAt: string
  ): DiscussionResult {
    return {
      success: false,
      pattern: config.pattern,
      topic: config.prompt,
      participatingProviders: [],
      failedProviders: config.providers,
      rounds: [],
      synthesis: '',
      consensus: {
        method: config.consensus.method,
      },
      totalDurationMs: Date.now() - new Date(startedAt).getTime(),
      metadata: {
        startedAt,
        completedAt: new Date().toISOString(),
      },
      error: { code, message },
    };
  }
}
```

---

## 4. CLI Implementation

### 4.1 New Command: `packages/cli/src/commands/discuss.ts`

```typescript
import type { CommandContext, CommandResult } from '../types.js';
import {
  validateDiscussionRequest,
  type DiscussionPattern,
  type ConsensusMethod,
} from '@automatosx/contracts';

export interface DiscussOptions {
  providers?: string[];
  pattern?: DiscussionPattern;
  rounds?: number;
  consensus?: ConsensusMethod;
  options?: string[];  // For voting pattern
  context?: string;
  verbose?: boolean;
  json?: boolean;
}

export async function discussCommand(
  topic: string,
  options: DiscussOptions,
  ctx: CommandContext
): Promise<CommandResult> {
  // Validate input
  const request = validateDiscussionRequest({
    topic,
    pattern: options.pattern,
    providers: options.providers,
    rounds: options.rounds,
    consensusMethod: options.consensus,
    votingOptions: options.options,
    context: options.context,
  });

  // Default providers if not specified
  const providers = request.providers || ['claude', 'gemini', 'codex'];

  ctx.output.info(`Starting ${request.pattern || 'synthesis'} discussion...`);
  ctx.output.info(`Providers: ${providers.join(', ')}`);
  ctx.output.info(`Rounds: ${request.rounds || 2}`);
  ctx.output.info('');

  // Execute discussion
  const executor = ctx.services.discussionExecutor;
  const result = await executor.execute({
    pattern: request.pattern || 'synthesis',
    providers,
    prompt: request.topic,
    rounds: request.rounds || 2,
    consensus: {
      method: request.consensusMethod || 'synthesis',
      synthesizer: providers[0],
    },
    verbose: options.verbose,
  });

  if (!result.success) {
    ctx.output.error(`Discussion failed: ${result.error?.message}`);
    return { success: false };
  }

  // Output results
  if (options.json) {
    ctx.output.json(result);
  } else {
    outputDiscussionResult(result, ctx, options.verbose);
  }

  return { success: true };
}

function outputDiscussionResult(
  result: DiscussionResult,
  ctx: CommandContext,
  verbose?: boolean
): void {
  if (verbose) {
    // Show all rounds
    for (const round of result.rounds) {
      ctx.output.heading(`Round ${round.roundNumber}`);
      for (const response of round.responses) {
        ctx.output.info(`\n📘 ${response.provider}:`);
        ctx.output.text(response.content);
      }
    }
    ctx.output.info('');
  }

  ctx.output.heading('Synthesis');
  ctx.output.text(result.synthesis);

  if (result.consensus.dissent && result.consensus.dissent.length > 0) {
    ctx.output.info('\n⚠️  Dissenting views:');
    for (const d of result.consensus.dissent) {
      ctx.output.info(`  - ${d.provider}: ${d.position}`);
    }
  }

  ctx.output.info(`\n✓ Completed in ${result.totalDurationMs}ms`);
  ctx.output.info(`  Providers: ${result.participatingProviders.join(', ')}`);
}

// Command registration
export const discuss = {
  command: 'discuss <topic>',
  description: 'Start a multi-model discussion on a topic',
  options: [
    {
      flags: '-p, --providers <list>',
      description: 'Comma-separated providers (default: claude,gemini,codex)',
    },
    {
      flags: '--pattern <pattern>',
      description: 'Discussion pattern: round-robin, debate, critique, voting, synthesis',
    },
    {
      flags: '-r, --rounds <n>',
      description: 'Number of discussion rounds (default: 2)',
    },
    {
      flags: '--consensus <method>',
      description: 'Consensus method: synthesis, voting, moderator',
    },
    {
      flags: '-o, --options <list>',
      description: 'Comma-separated options for voting pattern',
    },
    {
      flags: '-c, --context <text>',
      description: 'Additional context for discussion',
    },
    {
      flags: '-v, --verbose',
      description: 'Show all rounds and responses',
    },
    {
      flags: '--json',
      description: 'Output as JSON',
    },
  ],
  handler: discussCommand,
};
```

### 4.2 CLI Usage Examples

```bash
# Basic discussion
ax discuss "What's the best database for a real-time app?"

# Specify providers
ax discuss "Compare React vs Vue" --providers claude,gemini

# Debate pattern
ax discuss "Microservices vs Monolith" --pattern debate --rounds 3

# Voting pattern
ax discuss "Best API style" --pattern voting --options "REST,GraphQL,gRPC"

# With context
ax discuss "How to scale this?" --context "E-commerce, 1M users, Node.js"

# Verbose output
ax discuss "Explain quantum computing" --verbose

# JSON output
ax discuss "Compare languages" --json > result.json
```

---

## 5. MCP Tool Implementation

### 5.1 New Tool: `packages/mcp-server/src/tools/discuss.ts`

```typescript
import { z } from 'zod';
import type { McpToolHandler } from '../types.js';
import {
  DiscussionRequestSchema,
  DiscussionPatternSchema,
  ConsensusMethodSchema,
} from '@automatosx/contracts';

export const discussTools: McpToolHandler[] = [
  {
    name: 'ax_discuss',
    description: `Start a multi-model discussion where multiple AI providers debate,
discuss, and reach consensus on a topic. Leverages cognitive diversity for better outcomes.

Patterns:
- synthesis: All models give perspective, one synthesizes (default)
- round-robin: Models respond in sequence, building on each other
- debate: Models argue opposing positions with a judge
- critique: One proposes, others critique, author refines
- voting: Models vote with confidence scores`,

    inputSchema: z.object({
      topic: z.string().min(1).max(5000)
        .describe('Topic or question to discuss'),
      pattern: DiscussionPatternSchema.optional()
        .describe('Discussion pattern (default: synthesis)'),
      providers: z.array(z.string()).min(2).max(6).optional()
        .describe('Providers to use (default: claude, gemini, codex)'),
      rounds: z.number().int().min(1).max(10).optional()
        .describe('Number of rounds (default: 2)'),
      consensusMethod: ConsensusMethodSchema.optional()
        .describe('How to reach consensus'),
      votingOptions: z.array(z.string()).max(10).optional()
        .describe('Options for voting pattern'),
      context: z.string().max(10000).optional()
        .describe('Additional context'),
    }),

    handler: async (args, ctx) => {
      const request = DiscussionRequestSchema.parse(args);

      const result = await ctx.services.discussionExecutor.execute({
        pattern: request.pattern || 'synthesis',
        providers: request.providers || ['claude', 'gemini', 'codex'],
        prompt: request.topic,
        rounds: request.rounds || 2,
        consensus: {
          method: request.consensusMethod || 'synthesis',
        },
        providerPrompts: request.context ? {
          _context: request.context,
        } : undefined,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  },

  {
    name: 'ax_discuss_quick',
    description: `Quick multi-model discussion with defaults.
Uses synthesis pattern with claude, gemini, codex.`,

    inputSchema: z.object({
      topic: z.string().min(1).max(2000)
        .describe('Topic to discuss'),
    }),

    handler: async (args, ctx) => {
      const result = await ctx.services.discussionExecutor.execute({
        pattern: 'synthesis',
        providers: ['claude', 'gemini', 'codex'],
        prompt: args.topic,
        rounds: 1,
        consensus: { method: 'synthesis' },
      });

      return {
        content: [{
          type: 'text',
          text: result.success ? result.synthesis : `Error: ${result.error?.message}`,
        }],
      };
    },
  },
];
```

---

## 6. Workflow Engine Integration

### 6.1 Update: `packages/core/workflow-engine/src/step-handlers/discuss.ts`

```typescript
import type { WorkflowStep, StepContext, StepResult } from '../types.js';
import {
  validateDiscussStepConfig,
  type DiscussStepConfig,
} from '@automatosx/contracts';
import { DiscussionExecutor } from '@automatosx/discussion-domain';

export class DiscussStepHandler {
  constructor(private discussionExecutor: DiscussionExecutor) {}

  async execute(
    step: WorkflowStep,
    context: StepContext
  ): Promise<StepResult> {
    // Validate config
    const config = validateDiscussStepConfig(step.config);

    // Interpolate prompt with context
    const interpolatedPrompt = this.interpolate(config.prompt, context);

    // Execute discussion
    const result = await this.discussionExecutor.execute({
      ...config,
      prompt: interpolatedPrompt,
    }, context.variables);

    return {
      success: result.success,
      output: {
        synthesis: result.synthesis,
        rounds: result.rounds,
        consensus: result.consensus,
        participatingProviders: result.participatingProviders,
      },
      error: result.error,
      durationMs: result.totalDurationMs,
    };
  }

  private interpolate(
    template: string,
    context: StepContext
  ): string {
    // Replace {{input}}, {{steps.X.output}}, etc.
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const parts = path.trim().split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return `{{${path}}}`;  // Keep original if not found
        }
      }
      return String(value);
    });
  }
}
```

---

## 7. Testing Requirements

### 7.1 Contract Tests

```typescript
// tests/contract/discussion.test.ts

describe('Discussion Domain Contracts', () => {
  describe('DiscussStepConfigSchema', () => {
    it('INV-DISC-005: requires at least 2 providers', () => {
      expect(() => validateDiscussStepConfig({
        pattern: 'synthesis',
        providers: ['claude'],
        prompt: 'test',
      })).toThrow();
    });

    it('INV-DISC-006: max 6 providers', () => {
      expect(() => validateDiscussStepConfig({
        pattern: 'synthesis',
        providers: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        prompt: 'test',
      })).toThrow();
    });

    it('INV-DISC-008: debate requires roles', () => {
      expect(() => validateDiscussStepConfig({
        pattern: 'debate',
        providers: ['claude', 'gemini'],
        prompt: 'test',
        // missing roles
      })).toThrow();
    });
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/discussion.test.ts

describe('Discussion Execution', () => {
  it('executes synthesis pattern with 3 providers', async () => {
    const result = await executor.execute({
      pattern: 'synthesis',
      providers: ['claude', 'gemini', 'codex'],
      prompt: 'Test topic',
      rounds: 1,
      consensus: { method: 'synthesis' },
    });

    expect(result.success).toBe(true);
    expect(result.participatingProviders.length).toBeGreaterThanOrEqual(2);
    expect(result.synthesis).toBeTruthy();
  });

  it('handles provider failure gracefully', async () => {
    // Mock one provider to fail
    const result = await executor.execute({
      pattern: 'synthesis',
      providers: ['claude', 'failing-provider', 'codex'],
      prompt: 'Test topic',
      rounds: 1,
      consensus: { method: 'synthesis' },
      minProviders: 2,
      continueOnProviderFailure: true,
    });

    expect(result.success).toBe(true);
    expect(result.failedProviders).toContain('failing-provider');
  });
});
```

---

## 8. Acceptance Criteria

### 8.1 Core Functionality

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-1 | `discuss` step type works in workflows | Integration test |
| AC-2 | All 5 patterns execute correctly | Unit tests per pattern |
| AC-3 | Provider failures handled gracefully | Integration test |
| AC-4 | Synthesis always produced | Contract test |
| AC-5 | CLI `ax discuss` works end-to-end | CLI test |
| AC-6 | MCP `ax_discuss` tool works | MCP test |

### 8.2 Performance

| ID | Criteria | Target |
|----|----------|--------|
| AC-7 | Discussion completes within timeout | < 5 min for 3 rounds |
| AC-8 | Parallel provider calls | Yes for applicable patterns |
| AC-9 | Memory efficient | < 100MB additional |

### 8.3 Quality

| ID | Criteria | Target |
|----|----------|--------|
| AC-10 | Test coverage | > 90% |
| AC-11 | No type errors | `pnpm typecheck` passes |
| AC-12 | Lint passes | `pnpm lint` passes |
| AC-13 | Contract tests pass | All invariants verified |

---

## 9. Implementation Checklist

### Phase 1: Contracts (Day 1-2)

- [ ] Create `packages/contracts/src/discussion/v1/schema.ts`
- [ ] Create `packages/contracts/src/discussion/v1/invariants.md`
- [ ] Create `packages/contracts/src/discussion/v1/index.ts`
- [ ] Update `packages/contracts/src/index.ts` exports
- [ ] Update workflow step types to include `discuss`
- [ ] Add provider affinity to agent schema
- [ ] Write contract tests

### Phase 2: Core Domain (Day 3-5)

- [ ] Create `packages/core/discussion-domain` package
- [ ] Implement `DiscussionExecutor` class
- [ ] Implement `round-robin` pattern
- [ ] Implement `debate` pattern
- [ ] Implement `critique` pattern
- [ ] Implement `voting` pattern
- [ ] Implement `synthesis` pattern
- [ ] Implement consensus executors
- [ ] Write unit tests for each pattern

### Phase 3: Integration (Day 6-7)

- [ ] Add `discuss` step handler to workflow engine
- [ ] Update workflow runner for new step type
- [ ] Write integration tests

### Phase 4: CLI (Day 8)

- [ ] Create `packages/cli/src/commands/discuss.ts`
- [ ] Register command in CLI
- [ ] Write CLI tests
- [ ] Test manual execution

### Phase 5: MCP (Day 9)

- [ ] Create `packages/mcp-server/src/tools/discuss.ts`
- [ ] Register tools in MCP server
- [ ] Write MCP tool tests

### Phase 6: Documentation (Day 10)

- [ ] Update README with discussion features
- [ ] Create docs/guides/multi-model-discussion.md
- [ ] Add examples to examples/workflows/

---

## 10. Rollout Plan

### 10.1 Feature Flag

```typescript
// packages/contracts/src/config/v1/config.ts
features: {
  enableDiscussions: z.boolean().default(true),
}
```

### 10.2 Gradual Rollout

1. **Alpha** (Week 1): Internal testing only
2. **Beta** (Week 2): Available with feature flag
3. **GA** (Week 3): Default enabled

### 10.3 Monitoring

Track metrics:
- Discussion success rate
- Average duration by pattern
- Provider failure rates
- User satisfaction scores

---

## Appendix A: Example Workflow with Discussion

```yaml
workflowId: architecture-decision
version: "1.0.0"
name: Architecture Decision Workflow

steps:
  - stepId: gather-requirements
    type: prompt
    config:
      prompt: "Summarize the key requirements for: {{input}}"

  - stepId: discuss-options
    type: discuss
    dependencies: [gather-requirements]
    config:
      pattern: debate
      providers: [claude, gemini, codex]
      rounds: 2
      prompt: |
        Based on these requirements:
        {{steps.gather-requirements.output}}

        Debate the best architecture approach.
      roles:
        claude: proponent
        gemini: opponent
        codex: judge
      consensus:
        method: moderator
        synthesizer: codex

  - stepId: document-decision
    type: prompt
    dependencies: [discuss-options]
    config:
      prompt: |
        Create an ADR based on this discussion:
        {{steps.discuss-options.output.synthesis}}
```

---

*This implementation PRD is ready for engineering review and implementation.*
