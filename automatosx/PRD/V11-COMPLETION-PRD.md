# AutomatosX v11 Completion PRD - Simplified Design

**Version:** 11.0.0
**Status:** Approved
**Created:** 2024-11-27
**Updated:** 2024-11-27
**Author:** Engineering Team

---

## Executive Summary

This PRD outlines the **simplified** completion plan for AutomatosX v11, based on user feedback and design review.

### Key Decisions

After thorough analysis, we identified significant feature overlap and over-engineering in the original plan. This simplified design:

1. **Removes redundant features** - YAML Workflow System (overlaps with agent delegation)
2. **Simplifies implementation** - Keyword-based router instead of complex ML classifier
3. **Focuses on core value** - Setup wizard, memory management, better errors
4. **Reduces timeline** - 4 days instead of 4 weeks

### What We're NOT Building

| Feature | Reason |
|---------|--------|
| YAML Workflow System | Redundant with existing agent delegation |
| Spec-driven Development | Redundant with product agent capabilities |
| Complex Agent Router | Simple keyword matching is sufficient |
| `ax agent create` wizard | Template copy is sufficient |
| `ax config set` | JSON editing is sufficient |
| `ax session resume/delete` | Sessions are automatic, rarely needed |
| 18+ Slash Commands | MCP tools are superior approach |

---

## Part 1: Simple Agent Router

### 1.1 Design Philosophy

The original PRD proposed a complex multi-phase router with task classification, agent matching, and ML-style ranking. After review, **simple keyword matching** is sufficient and more maintainable.

### 1.2 Implementation (~50 lines)

**File:** `packages/core/src/agent/router.ts`

```typescript
const AGENT_KEYWORDS: Record<string, string[]> = {
  backend:  ['api', 'database', 'server', 'rest', 'graphql', 'sql', 'endpoint', 'auth', 'crud', 'backend'],
  frontend: ['ui', 'component', 'react', 'vue', 'css', 'button', 'form', 'page', 'frontend', 'html'],
  devops:   ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'aws', 'pipeline', 'infrastructure', 'terraform'],
  security: ['vulnerability', 'audit', 'security', 'penetration', 'xss', 'injection', 'owasp', 'encryption'],
  quality:  ['test', 'qa', 'coverage', 'bug', 'e2e', 'unit test', 'integration test', 'testing'],
  design:   ['ux', 'ui design', 'wireframe', 'mockup', 'figma', 'prototype', 'accessibility'],
  product:  ['requirements', 'spec', 'user story', 'roadmap', 'feature', 'prd', 'product'],
  data:     ['etl', 'pipeline', 'analytics', 'warehouse', 'data model', 'bigquery', 'data'],
  architecture: ['architecture', 'system design', 'adr', 'scalability', 'microservices'],
  writer:   ['documentation', 'docs', 'readme', 'technical writing', 'guide'],
  mobile:   ['ios', 'android', 'swift', 'kotlin', 'flutter', 'mobile', 'app'],
  fullstack: ['fullstack', 'full-stack', 'node', 'typescript', 'express'],
};

export function selectAgent(task: string, registry: AgentRegistry): Agent {
  const taskLower = task.toLowerCase();

  // Score each agent by keyword matches
  let bestAgent = 'standard';
  let bestScore = 0;

  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const score = keywords.filter(kw => taskLower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agentId;
    }
  }

  const agent = registry.get(bestAgent);
  return agent || registry.get('standard')!;
}

export function selectAgentWithReason(task: string, registry: AgentRegistry): {
  agent: Agent;
  reason: string;
  matchedKeywords: string[];
} {
  const taskLower = task.toLowerCase();
  let bestAgent = 'standard';
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const [agentId, keywords] of Object.entries(AGENT_KEYWORDS)) {
    const matched = keywords.filter(kw => taskLower.includes(kw));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      bestAgent = agentId;
      matchedKeywords = matched;
    }
  }

  const agent = registry.get(bestAgent) || registry.get('standard')!;
  const reason = bestScore > 0
    ? `Selected ${bestAgent} agent based on keywords: ${matchedKeywords.join(', ')}`
    : 'No keyword matches, using standard agent';

  return { agent, reason, matchedKeywords };
}
```

### 1.3 Performance

| Metric | Target | Expected |
|--------|--------|----------|
| Selection time | <10ms | <1ms |
| Memory usage | Minimal | ~1KB |
| Maintainability | High | Simple keyword list |

---

## Part 2: Setup Wizard

### 2.1 Command

```bash
ax setup [--force]
```

### 2.2 What It Does

1. Creates `.automatosx/` directory structure
2. Copies default agents from package
3. Creates `ax.config.json` with sensible defaults
4. Initializes memory database
5. Runs `ax doctor` to verify setup

### 2.3 Implementation

**File:** `packages/cli/src/commands/setup.ts`

```typescript
export const setupCommand: CommandModule = {
  command: 'setup',
  describe: 'Initialize AutomatosX in your project',
  builder: (yargs) => yargs
    .option('force', {
      describe: 'Overwrite existing configuration',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    const spinner = ora('Setting up AutomatosX...').start();

    // 1. Check existing
    if (!argv.force && existsSync('.automatosx')) {
      spinner.fail('AutomatosX already initialized. Use --force to reinitialize.');
      return;
    }

    // 2. Create directories
    spinner.text = 'Creating directories...';
    await mkdir('.automatosx/agents', { recursive: true });
    await mkdir('.automatosx/memory', { recursive: true });
    await mkdir('.automatosx/sessions', { recursive: true });
    await mkdir('.automatosx/abilities', { recursive: true });

    // 3. Copy default agents
    spinner.text = 'Installing default agents...';
    await copyDefaultAgents();

    // 4. Create config
    spinner.text = 'Creating configuration...';
    await createDefaultConfig();

    // 5. Initialize memory
    spinner.text = 'Initializing memory database...';
    const memoryManager = new MemoryManager({ basePath: '.automatosx' });
    await memoryManager.initialize();

    // 6. Run doctor
    spinner.text = 'Running diagnostics...';
    const diagnostics = await runDiagnostics();

    spinner.succeed('AutomatosX initialized successfully!');
    console.log('\nNext steps:');
    console.log('  ax agent list     - See available agents');
    console.log('  ax run backend "your task"  - Run a task');
    console.log('  ax status         - Check system status');
  },
};
```

### 2.4 Default Config

```json
{
  "$schema": "https://automatosx.dev/schema/config.json",
  "version": "11.0.0",
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 1
    }
  },
  "execution": {
    "defaultTimeout": 1500000,
    "maxRetries": 3
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000,
    "autoCleanup": true
  },
  "routing": {
    "defaultAgent": "standard",
    "enableAutoSelection": true
  }
}
```

---

## Part 3: Memory Clear Command

### 3.1 Command

```bash
ax memory clear [--before <date>] [--agent <name>] [--all] [--confirm]
```

### 3.2 Options

| Option | Description |
|--------|-------------|
| `--before <date>` | Clear memories before this date |
| `--agent <name>` | Clear memories from specific agent |
| `--all` | Clear all memories |
| `--confirm` | Skip confirmation prompt |

### 3.3 Implementation

**File:** `packages/core/src/memory/manager.ts` - Add method

```typescript
clear(options?: {
  before?: Date;
  agent?: string;
  all?: boolean;
}): { deleted: number } {
  let query = 'DELETE FROM memories WHERE 1=1';
  const params: unknown[] = [];

  if (options?.before) {
    query += ' AND created_at < ?';
    params.push(options.before.toISOString());
  }

  if (options?.agent) {
    query += ' AND agent_id = ?';
    params.push(options.agent);
  }

  if (!options?.all && !options?.before && !options?.agent) {
    throw new Error('Must specify --before, --agent, or --all');
  }

  const result = this.db.prepare(query).run(...params);
  return { deleted: result.changes };
}
```

**File:** `packages/cli/src/commands/memory.ts` - Add command

```typescript
const clearCommand: CommandModule = {
  command: 'clear',
  describe: 'Clear old memories',
  builder: (yargs) => yargs
    .option('before', { describe: 'Clear before date (YYYY-MM-DD)', type: 'string' })
    .option('agent', { describe: 'Clear specific agent memories', type: 'string' })
    .option('all', { describe: 'Clear all memories', type: 'boolean' })
    .option('confirm', { describe: 'Skip confirmation', type: 'boolean' }),
  handler: async (argv) => {
    if (!argv.confirm) {
      const confirm = await promptConfirm('Are you sure you want to clear memories?');
      if (!confirm) return;
    }

    const memoryManager = new MemoryManager({ basePath: '.automatosx' });
    const result = memoryManager.clear({
      before: argv.before ? new Date(argv.before) : undefined,
      agent: argv.agent,
      all: argv.all,
    });

    console.log(`Cleared ${result.deleted} memories.`);
  },
};
```

---

## Part 4: Better Error Messages

### 4.1 Current Issues

- Generic "Agent not found" errors
- No suggestions for typos
- No context on what went wrong

### 4.2 Improvements

```typescript
// packages/core/src/agent/registry.ts

get(id: string): Agent | undefined {
  const agent = this.agents.get(id);
  if (!agent) {
    const available = Array.from(this.agents.keys());
    const similar = findSimilar(id, available);

    if (similar.length > 0) {
      throw new AgentNotFoundError(
        `Agent "${id}" not found. Did you mean: ${similar.join(', ')}?`
      );
    } else {
      throw new AgentNotFoundError(
        `Agent "${id}" not found. Available agents: ${available.slice(0, 5).join(', ')}...`
      );
    }
  }
  return agent;
}

function findSimilar(input: string, options: string[]): string[] {
  return options
    .filter(opt =>
      opt.includes(input) ||
      input.includes(opt) ||
      levenshteinDistance(input, opt) <= 2
    )
    .slice(0, 3);
}
```

### 4.3 Error Types

```typescript
// packages/core/src/errors.ts

export class AutomatosXError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'AutomatosXError';
  }
}

export class AgentNotFoundError extends AutomatosXError {
  constructor(message: string, suggestion?: string) {
    super(message, 'AGENT_NOT_FOUND', suggestion);
  }
}

export class ProviderUnavailableError extends AutomatosXError {
  constructor(provider: string) {
    super(
      `Provider "${provider}" is not available`,
      'PROVIDER_UNAVAILABLE',
      'Check provider status with: ax provider status'
    );
  }
}

export class MemoryError extends AutomatosXError {
  constructor(message: string) {
    super(message, 'MEMORY_ERROR', 'Check memory status with: ax memory stats');
  }
}
```

---

## Part 5: Implementation Plan

### Timeline: 4 Days

| Day | Task | Deliverable |
|-----|------|-------------|
| **Day 1** | Simple Agent Router | `selectAgent()` function working |
| **Day 2** | Setup Wizard | `ax setup` command complete |
| **Day 3** | Memory Clear | `ax memory clear` command complete |
| **Day 4** | Error Messages + Testing | Better errors, all tests passing |

### File Changes

```
packages/core/src/agent/
├── router.ts           # NEW - Simple keyword router
└── router.test.ts      # NEW - Router tests

packages/core/src/errors.ts    # NEW - Error classes

packages/core/src/memory/
└── manager.ts          # UPDATE - Add clear() method

packages/cli/src/commands/
├── setup.ts            # NEW - Setup wizard
└── memory.ts           # UPDATE - Add clear command

packages/cli/src/templates/    # NEW - Default templates
├── agents/             # Default agent YAML files
└── config.json         # Default config template
```

### Success Criteria

| Metric | Target |
|--------|--------|
| Agent selection time | <1ms |
| Setup wizard time | <10s |
| Tests passing | 100% |
| Error messages helpful | Yes (with suggestions) |

---

## Part 6: What's Already Done

### Existing Features (v11.0.0-alpha)

- Agent System (loader, registry, executor, delegation)
- Memory System (SQLite FTS5, search, stats)
- Session Management (create, list, update, persist)
- Provider Routing (multi-provider, fallback, health)
- MCP Server (12 tools, ax-cli integration)
- Configuration System (Zod validation, loader)
- CLI Commands (run, agent, memory, provider, session, status, doctor)
- 468 tests passing

### What This PRD Adds

| Feature | Status |
|---------|--------|
| Simple Agent Router | To implement |
| `ax setup` wizard | To implement |
| `ax memory clear` | To implement |
| Better error messages | To implement |

---

## Appendix: Feature Analysis

### Why We Removed These Features

| Feature | Original Effort | Why Removed |
|---------|-----------------|-------------|
| YAML Workflow System | 3 days | Redundant with agent delegation. Agents already delegate to each other automatically. |
| Spec-driven Development | 2 days | Redundant with product agent. Product agent already breaks down tasks. |
| Complex Agent Router | 2 days | Over-engineered. Simple keyword matching works just as well. |
| `ax agent create` wizard | 1 day | Template copy is sufficient. Users can copy and edit YAML. |
| `ax config set` | 0.5 day | JSON editing is sufficient. Config rarely changes. |
| `ax session resume/delete` | 0.5 day | Sessions are automatic. Users rarely need these. |
| 18+ Slash Commands | 2 days | MCP tools are superior. Claude Code already has MCP integration. |

### Savings

- **Original plan:** 4 weeks
- **Simplified plan:** 4 days
- **Reduction:** 85%

---

## Approval

- [x] Engineering Lead (Option A selected)
- [ ] Product Owner
- [ ] QA Lead

---

*This is the finalized PRD for AutomatosX v11 completion.*
