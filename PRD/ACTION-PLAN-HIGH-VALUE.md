# Action Plan: High-Value Additions

**Related PRD**: HIGH-VALUE-ADDITIONS-PRD.md
**Total Effort**: 10-14 hours
**Priority**: P0

---

## Quick Start

```bash
# After implementing all features, users can:
ax resume --agent=coder            # Resume failed execution
ax history                         # View past runs
ax status                          # Check system health
ax cleanup --force                 # Clean old data
```

---

## Implementation Order

Execute phases sequentially - each builds on the previous:

```
Phase 1: Resume Command (builds on existing checkpoint-manager)
    ↓
Phase 2: History Command (builds on session-domain)
    ↓
Phase 3: Status Command (aggregates existing data)
    ↓
Phase 4: Cleanup Command (uses existing retention)
    ↓
Phase 5: Dangerous Op Guards (integrated into all commands)
```

---

## Phase 1: Resume Command

### Step 1.1: Create Contract Schemas

**File**: `packages/contracts/src/cli/v1/resume.ts`

```typescript
import { z } from 'zod';

export const ResumeOptionsSchema = z.object({
  checkpointId: z.string().uuid().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  force: z.boolean().default(false),
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
  age: z.string(),
});

export type CheckpointInfo = z.infer<typeof CheckpointInfoSchema>;
```

### Step 1.2: Create CLI Index for Contracts

**File**: `packages/contracts/src/cli/v1/index.ts`

```typescript
export * from './resume.js';
```

### Step 1.3: Update Contracts Index

**File**: `packages/contracts/src/index.ts` (add export)

```typescript
// Add near end of file
export * from './cli/v1/index.js';
```

### Step 1.4: Create Resume Command Handler

**File**: `packages/cli/src/commands/resume.ts`

```typescript
import type { CommandHandler, CommandResult } from '../types.js';
import {
  createCheckpointManager,
  createInMemoryCheckpointStorage,
  type CheckpointStorage,
} from '@defai.digital/agent-execution';
import { type ResumeOptions, ResumeOptionsSchema } from '@defai.digital/contracts';

export const resumeCommand: CommandHandler = async (
  args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  // Handle list subcommand
  if (options.list || args[0] === 'list') {
    return listCheckpoints(options);
  }

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

  // Get checkpoint
  let checkpoint;
  if (opts.checkpointId) {
    checkpoint = await storage.load(opts.checkpointId);
  } else if (opts.agentId) {
    checkpoint = await storage.loadLatest(opts.agentId, opts.sessionId);
  } else {
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

  // Check expiry
  if (checkpoint.expiresAt && new Date(checkpoint.expiresAt) < new Date()) {
    return {
      success: false,
      exitCode: 1,
      message: `Checkpoint ${checkpoint.checkpointId} has expired`,
    };
  }

  // Show info
  if (!opts.force) {
    console.log(`\nResuming from checkpoint:`);
    console.log(`  Agent: ${checkpoint.agentId}`);
    console.log(`  Step: ${checkpoint.stepIndex} (${checkpoint.completedStepId})`);
    console.log(`  Created: ${formatAge(checkpoint.createdAt)}`);
  }

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

  if (!agentId) {
    return {
      success: false,
      exitCode: 1,
      message: 'Please specify --agent to list checkpoints',
    };
  }

  const checkpoints = await storage.list(agentId);

  if (checkpoints.length === 0) {
    return {
      success: true,
      exitCode: 0,
      message: 'No checkpoints found',
    };
  }

  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      data: checkpoints,
    };
  }

  console.log('\nAvailable Checkpoints:\n');
  for (const cp of checkpoints) {
    console.log(`  ${cp.checkpointId.slice(0, 8)}... | Step ${cp.stepIndex} | ${formatAge(cp.createdAt)}`);
  }

  return { success: true, exitCode: 0 };
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
  return createInMemoryCheckpointStorage();
}
```

### Step 1.5: Export Resume Command

**File**: `packages/cli/src/commands/index.ts` (add export)

```typescript
export { resumeCommand } from './resume.js';
```

### Step 1.6: Register Resume Command

**File**: `packages/cli/src/cli.ts` (add to imports and COMMANDS)

```typescript
// Add to imports
import { resumeCommand } from './commands/index.js';

// Add to COMMANDS
const COMMANDS: Record<string, CommandHandler> = {
  // ... existing commands ...
  resume: resumeCommand,
};
```

### Step 1.7: Add Tests

**File**: `tests/cli/resume.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { resumeCommand } from '@defai.digital/cli';

describe('Resume Command', () => {
  it('should require agent or checkpoint option', async () => {
    const result = await resumeCommand([], {});
    expect(result.success).toBe(false);
    expect(result.message).toContain('specify');
  });

  it('should handle missing checkpoint', async () => {
    const result = await resumeCommand([], { agent: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('No checkpoint');
  });

  // Add more tests...
});
```

### Step 1.8: Verify

```bash
pnpm build
pnpm test tests/cli/resume.test.ts
node packages/cli/dist/bin.js resume --help
```

---

## Phase 2: History Command

### Step 2.1: Create Contract Schema

**File**: `packages/contracts/src/cli/v1/history.ts`

```typescript
import { z } from 'zod';

export const RunRecordSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  sessionId: z.string().uuid(),
  task: z.string().max(200),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  error: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().optional(),
  stepsCompleted: z.number().int().min(0),
  tokensUsed: z.number().int().min(0).optional(),
  providerId: z.string().optional(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

export const HistoryOptionsSchema = z.object({
  agent: z.string().optional(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.number().int().min(1).max(100).default(10),
  verbose: z.boolean().default(false),
  format: z.enum(['text', 'json']).default('text'),
});

export type HistoryOptions = z.infer<typeof HistoryOptionsSchema>;
```

### Step 2.2: Update CLI Index

**File**: `packages/contracts/src/cli/v1/index.ts` (add export)

```typescript
export * from './history.js';
```

### Step 2.3: Create History Command

**File**: `packages/cli/src/commands/history.ts`

```typescript
import type { CommandHandler, CommandResult } from '../types.js';
import { type HistoryOptions, HistoryOptionsSchema } from '@defai.digital/contracts';

export const historyCommand: CommandHandler = async (
  _args: string[],
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

  // TODO: Integrate with session-domain when getRunHistory is added
  const runs: Array<{
    agentId: string;
    status: string;
    startedAt: string;
    task: string;
  }> = [];

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

  console.log('\nRun History:\n');
  for (const run of runs) {
    const status = formatStatus(run.status);
    const task = run.task.length > 50 ? run.task.slice(0, 47) + '...' : run.task;
    console.log(`${status} ${run.agentId.padEnd(15)} ${formatAge(run.startedAt).padEnd(10)} ${task}`);
  }

  return { success: true, exitCode: 0 };
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
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
```

### Step 2.4: Export and Register

Same pattern as Phase 1 - add to index.ts and cli.ts.

---

## Phase 3: Status Command

### Step 3.1: Create Contract Schema

**File**: `packages/contracts/src/cli/v1/status.ts`

```typescript
import { z } from 'zod';

export const SystemStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  providers: z.array(z.object({
    providerId: z.string(),
    available: z.boolean(),
    latencyMs: z.number().optional(),
    errorRate: z.number().optional(),
    circuitState: z.enum(['closed', 'open', 'halfOpen']).optional(),
  })),
  activeSessions: z.number().int(),
  pendingCheckpoints: z.number().int(),
  uptime: z.string(),
  version: z.string(),
});

export type SystemStatus = z.infer<typeof SystemStatusSchema>;
```

### Step 3.2: Create Status Command

**File**: `packages/cli/src/commands/status.ts`

```typescript
import type { CommandHandler, CommandResult } from '../types.js';
import { CLI_VERSION } from './help.js';

export const statusCommand: CommandHandler = async (
  _args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  const status = {
    status: 'healthy' as const,
    providers: [] as Array<{ providerId: string; available: boolean }>,
    activeSessions: 0,
    pendingCheckpoints: 0,
    uptime: `${Math.floor(process.uptime())}s`,
    version: CLI_VERSION,
  };

  if (options.format === 'json') {
    return {
      success: true,
      exitCode: 0,
      data: status,
    };
  }

  const statusIcon = status.status === 'healthy' ? '[OK]' :
                     status.status === 'degraded' ? '[WARN]' : '[ERR]';

  console.log(`\nAutomatosX Status: ${statusIcon} ${status.status}`);
  console.log(`Version: ${status.version}`);
  console.log(`Uptime: ${status.uptime}`);
  console.log('');

  if (status.providers.length > 0) {
    console.log('Providers:');
    for (const provider of status.providers) {
      const icon = provider.available ? '[OK]' : '[ERR]';
      console.log(`  ${icon} ${provider.providerId}`);
    }
  } else {
    console.log('Providers: (none configured)');
  }
  console.log('');

  console.log(`Active Sessions: ${status.activeSessions}`);
  console.log(`Pending Checkpoints: ${status.pendingCheckpoints}`);

  return {
    success: true,
    exitCode: status.status === 'unhealthy' ? 1 : 0,
  };
};
```

---

## Phase 4: Cleanup Command

### Step 4.1: Create Contract Schema

**File**: `packages/contracts/src/cli/v1/cleanup.ts`

```typescript
import { z } from 'zod';

export const CleanupOptionsSchema = z.object({
  dryRun: z.boolean().default(true),
  types: z.array(z.enum(['checkpoints', 'sessions', 'traces', 'dlq'])).default(['checkpoints', 'sessions']),
  olderThan: z.number().int().min(1).optional(),
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
  dryRun: z.boolean(),
});

export type CleanupResult = z.infer<typeof CleanupResultSchema>;
```

### Step 4.2: Create Cleanup Command

**File**: `packages/cli/src/commands/cleanup.ts`

```typescript
import type { CommandHandler, CommandResult } from '../types.js';
import { createInMemoryCheckpointStorage } from '@defai.digital/agent-execution';

export const cleanupCommand: CommandHandler = async (
  _args: string[],
  options: Record<string, unknown>
): Promise<CommandResult> => {
  const dryRun = options.force !== true;
  const types = parseTypes(options.types);

  const results = {
    cleaned: [] as Array<{ type: string; count: number }>,
    totalCount: 0,
    dryRun,
  };

  console.log(dryRun ? '\nDry run - no data will be deleted:\n' : '\nCleaning up...\n');

  for (const type of types) {
    const count = await cleanType(type, dryRun);
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

async function cleanType(type: string, dryRun: boolean): Promise<number> {
  switch (type) {
    case 'checkpoints': {
      const storage = createInMemoryCheckpointStorage();
      if (dryRun) return 0; // Would need count method
      return storage.deleteExpired();
    }
    default:
      return 0;
  }
}

function parseTypes(value: unknown): string[] {
  if (!value) return ['checkpoints', 'sessions'];
  if (typeof value === 'string') return value.split(',');
  if (Array.isArray(value)) return value as string[];
  return ['checkpoints', 'sessions'];
}
```

---

## Phase 5: Dangerous Op Guards

### Step 5.1: Create Contract

**File**: `packages/contracts/src/cli/v1/dangerous-ops.ts`

```typescript
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
};
```

### Step 5.2: Create Guard Utility

**File**: `packages/cli/src/utils/dangerous-op-guard.ts`

```typescript
import { DANGEROUS_OPERATIONS } from '@defai.digital/contracts';
import * as readline from 'readline';

export interface DangerousOpResult {
  allowed: boolean;
  reason?: string;
}

export async function checkDangerousOp(
  operationId: string,
  options: { force?: boolean; yes?: boolean }
): Promise<DangerousOpResult> {
  const op = DANGEROUS_OPERATIONS[operationId];
  if (!op) return { allowed: true };

  if (options.force || options.yes) {
    console.warn(`Warning: Bypassing confirmation for ${op.operation}`);
    return { allowed: true };
  }

  if (!process.stdin.isTTY) {
    return {
      allowed: false,
      reason: 'Dangerous operation requires --force in non-interactive mode',
    };
  }

  console.log('');
  console.log(`[WARNING] ${op.description}`);
  console.log(`Impact: ${op.impact.toUpperCase()}`);
  console.log('');

  const answer = await prompt('Continue? [y/N]: ');
  if (answer.toLowerCase() !== 'y') {
    return { allowed: false, reason: 'User cancelled' };
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

### Step 5.3: Integrate with Cleanup

Update `cleanup.ts` to use the guard:

```typescript
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

  // ... rest of implementation
};
```

---

## Verification Checklist

After implementing all phases:

```bash
# Build
pnpm build

# Run tests
pnpm test

# Manual verification
ax resume --help
ax resume --list --agent=test
ax history
ax history --limit=5
ax status
ax status --format=json
ax cleanup
ax cleanup --force

# Verify type safety
pnpm typecheck
```

---

## Summary

| Command | Implementation | Status |
|---------|---------------|--------|
| `ax resume` | Uses existing checkpoint-manager | Ready to implement |
| `ax history` | Uses existing session-domain | Ready to implement |
| `ax status` | Aggregates existing health data | Ready to implement |
| `ax cleanup` | Uses existing retention | Ready to implement |
| Dangerous guards | CLI utility | Ready to implement |

Total new code: ~620 LOC
Total new tests: ~46
Estimated effort: 10-14 hours
