# AutomatosX High-Value Additions PRD

**Version**: 1.0.0
**Date**: 2025-12-15
**Status**: Draft

---

## Executive Summary

This PRD defines a focused set of high-value additions that provide maximum utility with minimal complexity. These additions build on existing infrastructure (checkpoint-manager, session-domain) rather than introducing new architectural patterns.

### Scope

| Feature | Value | Complexity | ROI |
|---------|-------|------------|-----|
| Resume Command | High - Recovery from failures | Low - Uses existing checkpoint-manager | Excellent |
| Run History | High - Visibility and debugging | Low - Uses existing session-domain | Excellent |
| Status Command | Medium - Operational visibility | Very Low - Aggregates existing data | Excellent |
| Cleanup Command | Medium - Data hygiene | Very Low - Uses existing retention | Excellent |
| Dangerous Op Guards | High - Prevent data loss | Low - Simple CLI integration | Excellent |

### Philosophy

These additions follow the **"Best Practice > Feature Parity"** principle:
- Build on existing, well-designed infrastructure
- Simple implementations that solve real problems
- No architectural changes or new packages required
- ~10-15 hours total effort vs 100+ hours for legacy restoration

### Out of Scope

Based on critical analysis, the following features from the old codebase are **intentionally not restored**:
- Spec/manifest system (legacy complexity)
- AST parsers for Claude artifacts (brittle)
- In-memory caching layer (premature optimization)
- Feature flags system (over-engineering for current scale)
- Cognitive frameworks/personality traits (enterprise scope)
- File system watcher (development convenience, not core)

---

## Feature 1: Resume Command

### Problem Statement

When an agent execution fails mid-workflow (provider error, timeout, user cancellation), users must restart from scratch. The checkpoint-manager already saves execution state - we need CLI access to resume from it.

### Solution

Add `ax resume` command that leverages the existing `@defai.digital/agent-execution` checkpoint-manager.

### User Stories

1. **As a user**, I want to resume a failed agent run so that I don't lose progress on long-running tasks.
2. **As a user**, I want to list available checkpoints so that I can choose which state to resume from.
3. **As a user**, I want to see what step a checkpoint was created at so that I understand the context.

### Contract Schema

```typescript
// packages/contracts/src/cli/v1/resume.ts

import { z } from 'zod';

export const ResumeOptionsSchema = z.object({
  /** Checkpoint ID to resume from (optional - defaults to latest) */
  checkpointId: z.string().uuid().optional(),

  /** Agent ID (required if no checkpoint ID) */
  agentId: z.string().optional(),

  /** Session ID to filter checkpoints */
  sessionId: z.string().uuid().optional(),

  /** Skip confirmation prompt */
  force: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type ResumeOptions = z.infer<typeof ResumeOptionsSchema>;

export const CheckpointInfoSchema = z.object({
  checkpointId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid().optional(),
  stepIndex: z.number().int(),
  completedStepId: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  /** Human-readable age */
  age: z.string(),
});

export type CheckpointInfo = z.infer<typeof CheckpointInfoSchema>;
```

### CLI Implementation

```typescript
// packages/cli/src/commands/resume.ts

import type { CommandHandler, CommandResult } from '../types.js';
import {
  createCheckpointManager,
  createInMemoryCheckpointStorage,
  type CheckpointStorage,
} from '@defai.digital/agent-execution';
import {
  type ResumeOptions,
  ResumeOptionsSchema,
} from '@defai.digital/contracts';

/**
 * Resume command handler
 *
 * Usage:
 *   ax resume                          # Resume latest checkpoint
 *   ax resume --agent=coder            # Resume latest for specific agent
 *   ax resume --checkpoint=<uuid>      # Resume specific checkpoint
 *   ax resume --list                   # List available checkpoints
 */
export const resumeCommand: CommandHandler = async (
  args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  // Handle list subcommand
  if (options.list || args[0] === 'list') {
    return listCheckpoints(options);
  }

  // Validate options
  const parsed = ResumeOptionsSchema.safeParse(options);
  if (!parsed.success) {
    return {
      success: false,
      exitCode: 1,
      message: `Invalid options: ${parsed.error.message}`,
    };
  }

  const opts = parsed.data;
  const storage = getCheckpointStorage();

  // Get checkpoint to resume
  let checkpoint;
  if (opts.checkpointId) {
    checkpoint = await storage.load(opts.checkpointId);
  } else if (opts.agentId) {
    checkpoint = await storage.loadLatest(opts.agentId, opts.sessionId);
  } else {
    // Get latest across all agents
    return {
      success: false,
      exitCode: 1,
      message: 'Please specify --agent or --checkpoint',
    };
  }

  if (!checkpoint) {
    return {
      success: false,
      exitCode: 1,
      message: 'No checkpoint found',
    };
  }

  // Check if expired
  if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
    return {
      success: false,
      exitCode: 1,
      message: `Checkpoint ${checkpoint.checkpointId} has expired`,
    };
  }

  // Show checkpoint info and confirm
  if (!opts.force) {
    console.log(`\nResuming from checkpoint:`);
    console.log(`  Agent: ${checkpoint.agentId}`);
    console.log(`  Step: ${checkpoint.stepIndex} (${checkpoint.completedStepId})`);
    console.log(`  Created: ${formatAge(checkpoint.createdAt)}`);
    console.log(`\nThis will continue execution from step ${checkpoint.stepIndex + 1}.`);
  }

  // Create manager and get resume context
  const manager = createCheckpointManager(
    checkpoint.agentId,
    checkpoint.sessionId,
    storage
  );

  const resumeContext = await manager.getResumeContext(checkpoint.checkpointId);
  if (!resumeContext) {
    return {
      success: false,
      exitCode: 1,
      message: 'Failed to create resume context',
    };
  }

  // Execute agent with resume context
  // ... integration with agent execution ...

  return {
    success: true,
    exitCode: 0,
    message: `Resumed from step ${resumeContext.startFromStep}`,
    data: {
      checkpointId: checkpoint.checkpointId,
      startFromStep: resumeContext.startFromStep,
    },
  };
};

async function listCheckpoints(
  options: Record<string, unknown>
): Promise<CommandResult> {
  const storage = getCheckpointStorage();
  const agentId = options.agent as string | undefined;

  // Get all checkpoints (or filtered by agent)
  const checkpoints = agentId
    ? await storage.list(agentId)
    : []; // TODO: Add listAll() to storage interface

  if (checkpoints.length === 0) {
    return {
      success: true,
      exitCode: 0,
      message: 'No checkpoints found',
    };
  }

  const rows = checkpoints.map((cp) => ({
    checkpointId: cp.checkpointId.slice(0, 8) + '...',
    agentId: cp.agentId,
    step: `${cp.stepIndex} (${cp.completedStepId})`,
    created: formatAge(cp.createdAt),
    expires: cp.expiresAt ? formatAge(cp.expiresAt) : 'never',
  }));

  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      data: checkpoints,
    };
  }

  console.log('\nAvailable Checkpoints:\n');
  console.table(rows);

  return {
    success: true,
    exitCode: 0,
  };
}

function formatAge(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getCheckpointStorage(): CheckpointStorage {
  // TODO: Use SQLite storage in production
  return createInMemoryCheckpointStorage();
}
```

### Tests

```typescript
// tests/cli/resume.test.ts

describe('Resume Command', () => {
  it('should list available checkpoints', async () => {
    // ...
  });

  it('should resume from specific checkpoint', async () => {
    // ...
  });

  it('should reject expired checkpoints', async () => {
    // ...
  });

  it('should default to latest checkpoint for agent', async () => {
    // ...
  });
});
```

### Invariants

| ID | Invariant | Test |
|----|-----------|------|
| INV-RS-001 | Resume starts from step after checkpoint | `startFromStep === checkpoint.stepIndex + 1` |
| INV-RS-002 | Expired checkpoints rejected | Error returned for expired checkpoint |
| INV-RS-003 | Previous outputs available | `resumeContext.previousOutputs` contains step outputs |

---

## Feature 2: Run History

### Problem Statement

Users cannot see past agent executions. When debugging issues or reviewing work, there's no record of what was run, when, or what the outcome was.

### Solution

Track agent runs in session-domain and expose via `ax history` command.

### User Stories

1. **As a user**, I want to see recent agent runs so that I can review past work.
2. **As a user**, I want to see run outcomes (success/failure) so that I can identify issues.
3. **As a user**, I want to filter history by agent or date so that I can find specific runs.

### Contract Schema

```typescript
// packages/contracts/src/cli/v1/history.ts

import { z } from 'zod';

export const RunRecordSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid(),

  /** Task/prompt that initiated the run */
  task: z.string().max(200), // Truncated for display

  /** Run outcome */
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),

  /** Error message if failed */
  error: z.string().optional(),

  /** Timing */
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().optional(),

  /** Metrics */
  stepsCompleted: z.number().int().min(0),
  tokensUsed: z.number().int().min(0).optional(),

  /** Provider used */
  providerId: z.string().optional(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

export const HistoryOptionsSchema = z.object({
  /** Filter by agent */
  agent: z.string().optional(),

  /** Filter by status */
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),

  /** Number of records to show */
  limit: z.number().int().min(1).max(100).default(10),

  /** Show all details */
  verbose: z.boolean().default(false),

  /** Output format */
  format: z.enum(['text', 'json']).default('text'),
});

export type HistoryOptions = z.infer<typeof HistoryOptionsSchema>;
```

### Implementation

```typescript
// packages/cli/src/commands/history.ts

import type { CommandHandler, CommandResult } from '../types.js';
import { createSessionManager } from '@defai.digital/session-domain';
import { type HistoryOptions, HistoryOptionsSchema } from '@defai.digital/contracts';

/**
 * History command handler
 *
 * Usage:
 *   ax history                      # Show last 10 runs
 *   ax history --limit=20           # Show last 20 runs
 *   ax history --agent=coder        # Filter by agent
 *   ax history --status=failed      # Show only failed runs
 *   ax history --verbose            # Show full details
 */
export const historyCommand: CommandHandler = async (
  args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  const parsed = HistoryOptionsSchema.safeParse(options);
  if (!parsed.success) {
    return {
      success: false,
      exitCode: 1,
      message: `Invalid options: ${parsed.error.message}`,
    };
  }

  const opts = parsed.data;

  // Get run history from session manager
  const sessionManager = getSessionManager();
  const runs = await sessionManager.getRunHistory({
    agentId: opts.agent,
    status: opts.status,
    limit: opts.limit,
  });

  if (runs.length === 0) {
    return {
      success: true,
      exitCode: 0,
      message: 'No runs found',
    };
  }

  if (opts.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      data: runs,
    };
  }

  // Format as table
  console.log('\nRun History:\n');

  for (const run of runs) {
    const status = formatStatus(run.status);
    const duration = run.durationMs ? `${Math.round(run.durationMs / 1000)}s` : '-';
    const task = run.task.length > 50 ? run.task.slice(0, 47) + '...' : run.task;

    console.log(`${status} ${run.agentId.padEnd(15)} ${formatAge(run.startedAt).padEnd(10)} ${duration.padEnd(6)} ${task}`);

    if (opts.verbose && run.error) {
      console.log(`   Error: ${run.error}`);
    }
  }

  return {
    success: true,
    exitCode: 0,
  };
};

function formatStatus(status: string): string {
  switch (status) {
    case 'completed': return '[OK]';
    case 'failed': return '[FAIL]';
    case 'running': return '[...]';
    case 'cancelled': return '[STOP]';
    default: return '[?]';
  }
}

function formatAge(isoDate: string): string {
  // ... same as resume command
}
```

### Session Manager Extension

```typescript
// packages/core/session-domain/src/manager.ts (addition)

interface RunHistoryQuery {
  agentId?: string;
  status?: 'running' | 'completed' | 'failed' | 'cancelled';
  limit?: number;
  since?: string;
}

// Add to SessionManager interface:
getRunHistory(query: RunHistoryQuery): Promise<RunRecord[]>;
```

### Tests

```typescript
describe('History Command', () => {
  it('should list recent runs', async () => {
    // ...
  });

  it('should filter by agent', async () => {
    // ...
  });

  it('should filter by status', async () => {
    // ...
  });

  it('should respect limit', async () => {
    // ...
  });
});
```

---

## Feature 3: Status Command

### Problem Statement

Users have no single view of system health - are providers available? Are there pending tasks? What's the current session state?

### Solution

Add `ax status` command that aggregates existing health/state data from various domains.

### User Stories

1. **As a user**, I want a quick status check so that I know if the system is ready to use.
2. **As a user**, I want to see provider health so that I know which providers are available.
3. **As a user**, I want to see active sessions so that I know what's running.

### Contract Schema

```typescript
// packages/contracts/src/cli/v1/status.ts

import { z } from 'zod';

export const SystemStatusSchema = z.object({
  /** Overall status */
  status: z.enum(['healthy', 'degraded', 'unhealthy']),

  /** Provider health */
  providers: z.array(z.object({
    providerId: z.string(),
    available: z.boolean(),
    latencyMs: z.number().optional(),
    errorRate: z.number().optional(),
    circuitState: z.enum(['closed', 'open', 'halfOpen']).optional(),
  })),

  /** Active sessions */
  activeSessions: z.number().int(),

  /** Pending checkpoints */
  pendingCheckpoints: z.number().int(),

  /** System info */
  uptime: z.string(),
  version: z.string(),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;
```

### Implementation

```typescript
// packages/cli/src/commands/status.ts

import type { CommandHandler, CommandResult } from '../types.js';
import { CLI_VERSION } from './help.js';

/**
 * Status command handler
 *
 * Usage:
 *   ax status                # Show system status
 *   ax status --verbose      # Show detailed status
 *   ax status --json         # Output as JSON
 */
export const statusCommand: CommandHandler = async (
  _args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  const status = await gatherStatus();

  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      data: status,
    };
  }

  // Display status
  const statusIcon = status.status === 'healthy' ? '[OK]' :
                     status.status === 'degraded' ? '[WARN]' : '[ERR]';

  console.log(`\nAutomatosX Status: ${statusIcon} ${status.status}`);
  console.log(`Version: ${status.version}`);
  console.log('');

  // Providers
  console.log('Providers:');
  for (const provider of status.providers) {
    const icon = provider.available ? '[OK]' : '[ERR]';
    const latency = provider.latencyMs ? `${provider.latencyMs}ms` : '-';
    console.log(`  ${icon} ${provider.providerId.padEnd(15)} ${latency}`);
  }
  console.log('');

  // Sessions
  console.log(`Active Sessions: ${status.activeSessions}`);
  console.log(`Pending Checkpoints: ${status.pendingCheckpoints}`);

  return {
    success: true,
    exitCode: status.status === 'unhealthy' ? 1 : 0,
  };
};

async function gatherStatus(): Promise<SystemStatus> {
  // Aggregate from various sources
  const providers = await getProviderStatus();
  const sessions = await getActiveSessionCount();
  const checkpoints = await getPendingCheckpointCount();

  const allHealthy = providers.every(p => p.available);
  const someHealthy = providers.some(p => p.available);

  return {
    status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
    providers,
    activeSessions: sessions,
    pendingCheckpoints: checkpoints,
    uptime: process.uptime().toString(),
    version: CLI_VERSION,
  };
}

async function getProviderStatus() {
  // Get from provider-domain health monitors
  return [];
}

async function getActiveSessionCount(): Promise<number> {
  // Get from session-domain
  return 0;
}

async function getPendingCheckpointCount(): Promise<number> {
  // Get from agent-execution
  return 0;
}
```

---

## Feature 4: Cleanup Command

### Problem Statement

Over time, expired checkpoints, old sessions, and stale data accumulate. Users need a way to clean up without manually deleting files.

### Solution

Add `ax cleanup` command that uses existing retention mechanisms.

### User Stories

1. **As a user**, I want to clean up old data so that disk space is freed.
2. **As a user**, I want to see what will be cleaned before it happens so that I don't lose important data.
3. **As a user**, I want cleanup to be safe by default so that I can't accidentally delete active data.

### Contract Schema

```typescript
// packages/contracts/src/cli/v1/cleanup.ts

import { z } from 'zod';

export const CleanupOptionsSchema = z.object({
  /** Dry run - show what would be cleaned */
  dryRun: z.boolean().default(true),

  /** Data types to clean */
  types: z.array(z.enum(['checkpoints', 'sessions', 'traces', 'dlq'])).default(['checkpoints', 'sessions']),

  /** Override retention period (days) */
  olderThan: z.number().int().min(1).optional(),

  /** Force cleanup without confirmation */
  force: z.boolean().default(false),
});

export type CleanupOptions = z.infer<typeof CleanupOptionsSchema>;

export const CleanupResultSchema = z.object({
  cleaned: z.array(z.object({
    type: z.string(),
    count: z.number().int(),
    freedBytes: z.number().int().optional(),
  })),
  totalCount: z.number().int(),
  totalFreedBytes: z.number().int().optional(),
  dryRun: z.boolean(),
});

export type CleanupResult = z.infer<typeof CleanupResultSchema>;
```

### Implementation

```typescript
// packages/cli/src/commands/cleanup.ts

import type { CommandHandler, CommandResult } from '../types.js';
import { createRetentionManager } from '@defai.digital/cross-cutting';

/**
 * Cleanup command handler
 *
 * Usage:
 *   ax cleanup                     # Dry run (show what would be cleaned)
 *   ax cleanup --force             # Actually perform cleanup
 *   ax cleanup --older-than=7      # Clean data older than 7 days
 *   ax cleanup --types=checkpoints # Clean only checkpoints
 */
export const cleanupCommand: CommandHandler = async (
  _args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  const dryRun = options.force !== true;
  const olderThan = (options['older-than'] ?? options.olderThan) as number | undefined;
  const types = parseTypes(options.types);

  const results: CleanupResult = {
    cleaned: [],
    totalCount: 0,
    dryRun,
  };

  console.log(dryRun ? '\nDry run - no data will be deleted:\n' : '\nCleaning up...\n');

  // Clean each type
  for (const type of types) {
    const count = await cleanType(type, olderThan, dryRun);
    results.cleaned.push({ type, count });
    results.totalCount += count;
    console.log(`  ${type}: ${count} items ${dryRun ? 'would be' : ''} cleaned`);
  }

  console.log('');

  if (dryRun) {
    console.log(`Total: ${results.totalCount} items would be cleaned.`);
    console.log('Run with --force to actually clean.');
  } else {
    console.log(`Total: ${results.totalCount} items cleaned.`);
  }

  return {
    success: true,
    exitCode: 0,
    data: results,
  };
};

async function cleanType(
  type: string,
  olderThanDays: number | undefined,
  dryRun: boolean
): Promise<number> {
  switch (type) {
    case 'checkpoints': {
      const storage = getCheckpointStorage();
      if (dryRun) {
        const expired = await countExpiredCheckpoints(storage, olderThanDays);
        return expired;
      }
      return storage.deleteExpired();
    }

    case 'sessions': {
      // Use session-domain cleanup
      return 0;
    }

    case 'traces': {
      // Use trace-domain cleanup
      return 0;
    }

    case 'dlq': {
      // Use cross-cutting DLQ cleanup
      return 0;
    }

    default:
      return 0;
  }
}

function parseTypes(value: unknown): string[] {
  if (!value) return ['checkpoints', 'sessions'];
  if (typeof value === 'string') return value.split(',');
  if (Array.isArray(value)) return value;
  return ['checkpoints', 'sessions'];
}
```

---

## Feature 5: Dangerous Operation Guards

### Problem Statement

Some operations could cause data loss or unintended consequences - like deleting all checkpoints, clearing sessions, or force-resetting providers. Users need protection from accidental destructive actions.

### Solution

Add confirmation gates for dangerous operations, integrated at the CLI level.

### User Stories

1. **As a user**, I want dangerous operations to require confirmation so that I don't accidentally lose data.
2. **As a user**, I want to bypass confirmation when scripting so that automation works.
3. **As a user**, I want clear warnings about what will happen so that I make informed decisions.

### Contract Schema

```typescript
// packages/contracts/src/cli/v1/dangerous-ops.ts

import { z } from 'zod';

export const DangerousOperationSchema = z.object({
  operation: z.string(),
  description: z.string(),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  requiresConfirmation: z.boolean(),
  confirmationPhrase: z.string().optional(),
});

export type DangerousOperation = z.infer<typeof DangerousOperationSchema>;

export const DANGEROUS_OPERATIONS: Record<string, DangerousOperation> = {
  'cleanup.force': {
    operation: 'cleanup.force',
    description: 'Permanently delete old data',
    impact: 'medium',
    requiresConfirmation: true,
  },
  'checkpoint.delete-all': {
    operation: 'checkpoint.delete-all',
    description: 'Delete all checkpoints for an agent',
    impact: 'high',
    requiresConfirmation: true,
  },
  'session.terminate-all': {
    operation: 'session.terminate-all',
    description: 'Terminate all active sessions',
    impact: 'high',
    requiresConfirmation: true,
  },
  'provider.force-reset': {
    operation: 'provider.force-reset',
    description: 'Force reset provider state (circuit breaker, rate limiter)',
    impact: 'medium',
    requiresConfirmation: true,
  },
  'guard.bypass': {
    operation: 'guard.bypass',
    description: 'Bypass governance check',
    impact: 'critical',
    requiresConfirmation: true,
    confirmationPhrase: 'I understand the risks',
  },
};
```

### Implementation

```typescript
// packages/cli/src/utils/dangerous-op-guard.ts

import { DANGEROUS_OPERATIONS, type DangerousOperation } from '@defai.digital/contracts';
import * as readline from 'readline';

export interface DangerousOpResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a dangerous operation should proceed
 */
export async function checkDangerousOp(
  operationId: string,
  options: {
    force?: boolean;
    yes?: boolean;
    noPrompt?: boolean;
  }
): Promise<DangerousOpResult> {
  const op = DANGEROUS_OPERATIONS[operationId];

  if (!op) {
    // Not a dangerous operation
    return { allowed: true };
  }

  // Skip if --force or --yes
  if (options.force || options.yes) {
    console.warn(`Warning: Bypassing confirmation for ${op.operation}`);
    return { allowed: true };
  }

  // Skip prompt if CI/scripting
  if (options.noPrompt || !process.stdin.isTTY) {
    return {
      allowed: false,
      reason: 'Dangerous operation requires --force flag in non-interactive mode',
    };
  }

  // Show warning
  console.log('');
  console.log(`[WARNING] ${op.description}`);
  console.log(`Impact: ${op.impact.toUpperCase()}`);
  console.log('');

  // Require confirmation
  if (op.confirmationPhrase) {
    const answer = await prompt(`Type "${op.confirmationPhrase}" to confirm: `);
    if (answer !== op.confirmationPhrase) {
      return { allowed: false, reason: 'Confirmation phrase did not match' };
    }
  } else {
    const answer = await prompt('Continue? [y/N]: ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      return { allowed: false, reason: 'User cancelled' };
    }
  }

  return { allowed: true };
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
```

### Integration Example

```typescript
// In cleanup command:
import { checkDangerousOp } from '../utils/dangerous-op-guard.js';

export const cleanupCommand: CommandHandler = async (args, options) => {
  if (options.force) {
    const check = await checkDangerousOp('cleanup.force', options);
    if (!check.allowed) {
      return {
        success: false,
        exitCode: 1,
        message: check.reason ?? 'Operation cancelled',
      };
    }
  }

  // ... proceed with cleanup
};
```

---

## Implementation Plan

### Phase 1: Resume Command (2-3 hours)

| Task | File | Notes |
|------|------|-------|
| Resume options schema | `packages/contracts/src/cli/v1/resume.ts` | Contract |
| Resume command | `packages/cli/src/commands/resume.ts` | Handler |
| Update exports | `packages/cli/src/commands/index.ts` | Export |
| Register command | `packages/cli/src/cli.ts` | Add to COMMANDS |
| Tests | `tests/cli/resume.test.ts` | Unit tests |

### Phase 2: History Command (2-3 hours)

| Task | File | Notes |
|------|------|-------|
| History options schema | `packages/contracts/src/cli/v1/history.ts` | Contract |
| Run record schema | `packages/contracts/src/cli/v1/history.ts` | Data type |
| History command | `packages/cli/src/commands/history.ts` | Handler |
| Session manager extension | `packages/core/session-domain/src/manager.ts` | Add getRunHistory |
| Tests | `tests/cli/history.test.ts` | Unit tests |

### Phase 3: Status Command (1-2 hours)

| Task | File | Notes |
|------|------|-------|
| Status schema | `packages/contracts/src/cli/v1/status.ts` | Contract |
| Status command | `packages/cli/src/commands/status.ts` | Handler |
| Tests | `tests/cli/status.test.ts` | Unit tests |

### Phase 4: Cleanup Command (2-3 hours)

| Task | File | Notes |
|------|------|-------|
| Cleanup options schema | `packages/contracts/src/cli/v1/cleanup.ts` | Contract |
| Cleanup command | `packages/cli/src/commands/cleanup.ts` | Handler |
| Tests | `tests/cli/cleanup.test.ts` | Unit tests |

### Phase 5: Dangerous Op Guards (2-3 hours)

| Task | File | Notes |
|------|------|-------|
| Dangerous ops schema | `packages/contracts/src/cli/v1/dangerous-ops.ts` | Contract |
| Guard utility | `packages/cli/src/utils/dangerous-op-guard.ts` | Utility |
| Integration | Update cleanup, session, etc. | Use guard |
| Tests | `tests/cli/dangerous-ops.test.ts` | Unit tests |

---

## Success Criteria

### Feature 1: Resume
- [ ] `ax resume --list` shows available checkpoints
- [ ] `ax resume --agent=X` resumes latest checkpoint for agent
- [ ] `ax resume --checkpoint=X` resumes specific checkpoint
- [ ] Expired checkpoints are rejected with clear message
- [ ] Resume context contains all data for continuation

### Feature 2: History
- [ ] `ax history` shows recent runs
- [ ] `ax history --agent=X` filters by agent
- [ ] `ax history --status=failed` filters by status
- [ ] Run records include timing, steps, status
- [ ] JSON output available

### Feature 3: Status
- [ ] `ax status` shows overall health
- [ ] Provider availability shown
- [ ] Active sessions counted
- [ ] Exit code reflects health (0=healthy, 1=unhealthy)

### Feature 4: Cleanup
- [ ] Dry run by default (safe)
- [ ] `--force` required for actual deletion
- [ ] Multiple data types supported
- [ ] Clear output of what was/would be cleaned

### Feature 5: Dangerous Op Guards
- [ ] Confirmation required for dangerous operations
- [ ] `--force` bypasses confirmation
- [ ] Non-interactive mode requires `--force`
- [ ] Clear warnings shown before confirmation

---

## File Summary

### New Files

```
packages/
├── contracts/src/cli/v1/
│   ├── resume.ts          # Resume command schemas
│   ├── history.ts         # History command schemas
│   ├── status.ts          # Status command schemas
│   ├── cleanup.ts         # Cleanup command schemas
│   ├── dangerous-ops.ts   # Dangerous operation definitions
│   └── index.ts           # Export all CLI schemas
└── cli/src/
    ├── commands/
    │   ├── resume.ts      # Resume command handler
    │   ├── history.ts     # History command handler
    │   ├── status.ts      # Status command handler
    │   └── cleanup.ts     # Cleanup command handler
    └── utils/
        └── dangerous-op-guard.ts  # Dangerous op utility

tests/cli/
├── resume.test.ts
├── history.test.ts
├── status.test.ts
├── cleanup.test.ts
└── dangerous-ops.test.ts
```

### Modified Files

```
packages/
├── contracts/src/index.ts          # Export new CLI schemas
├── cli/src/commands/index.ts       # Export new commands
├── cli/src/cli.ts                  # Register new commands
└── core/session-domain/src/
    └── manager.ts                  # Add getRunHistory
```

### Estimated Effort

| Feature | New Files | LOC | Tests | Hours |
|---------|-----------|-----|-------|-------|
| Resume | 2 | ~150 | ~10 | 2-3 |
| History | 2 | ~150 | ~10 | 2-3 |
| Status | 2 | ~100 | ~8 | 1-2 |
| Cleanup | 2 | ~120 | ~8 | 2-3 |
| Dangerous Ops | 2 | ~100 | ~10 | 2-3 |
| **Total** | **10** | **~620** | **~46** | **10-14** |

---

## Appendix: Why These Features

### Resume Command
- **Value**: Users often run long agent tasks. Failures are frustrating if progress is lost.
- **Effort**: Very low - checkpoint-manager already exists, just needs CLI access.
- **Risk**: None - read-only operation on existing data.

### History Command
- **Value**: Debugging and reviewing past work is essential for productive use.
- **Effort**: Low - session-domain already tracks sessions, needs query extension.
- **Risk**: None - read-only operation.

### Status Command
- **Value**: Quick health check before running commands saves debugging time.
- **Effort**: Very low - aggregates existing health data.
- **Risk**: None - read-only operation.

### Cleanup Command
- **Value**: Data hygiene prevents disk issues and improves performance.
- **Effort**: Low - retention mechanisms already exist.
- **Risk**: Low - dry run by default, requires explicit --force.

### Dangerous Op Guards
- **Value**: Prevents accidental data loss - critical for trust.
- **Effort**: Low - simple confirmation gate pattern.
- **Risk**: None - adds safety, doesn't change functionality.

---

## Appendix: Features NOT Included

Based on critical evaluation, these features from the old codebase provide insufficient value for their complexity:

| Feature | Why Not |
|---------|---------|
| Spec/manifest system | Legacy complexity, modern contract-first approach is better |
| AST parsers | Brittle, breaks with Claude output changes |
| In-memory caching | Premature optimization, add when measured need arises |
| Feature flags | Over-engineering, YAGNI at current scale |
| Cognitive frameworks | Enterprise scope, not needed for CLI tool |
| File system watcher | Dev convenience, external tools (nodemon) handle this |
| Tool discovery | Dynamic loading adds complexity, explicit registration is clearer |
| Handoff protocols | Enterprise multi-team feature, out of scope |
| History export | Can add later if needed, start simple |
| Browser automation | Orthogonal to core functionality |
