# @ax/core

Core orchestration engine for AutomatosX.

## Installation

```bash
pnpm add @ax/core
```

## Overview

This package provides the core functionality for AutomatosX:

- **Agent System** - Load, register, and execute AI agents
- **Memory Management** - Persistent SQLite-based memory with FTS5 search
- **Session Management** - Multi-agent session lifecycle
- **Provider Routing** - Multi-provider orchestration with fallback
- **Configuration** - YAML/JSON config loading and validation

## Modules

### Agent System

```typescript
import {
  AgentLoader,
  AgentRegistry,
  AgentExecutor,
  selectAgent,
  selectAgentWithReason,
} from '@ax/core/agent';

// Load agents from directory
const loader = new AgentLoader();
const agents = await loader.loadFromDirectory('.automatosx/agents');

// Register agents
const registry = new AgentRegistry();
registry.registerMany(agents);

// Execute tasks
const executor = new AgentExecutor(registry, router);
const result = await executor.execute('backend', 'Create a REST API');

// Auto-select agent based on task
const selection = selectAgentWithReason('Build a React component', registry);
console.log(selection.agent.name); // 'frontend'
console.log(selection.reason);     // 'Matched keywords: react, component'
```

### Memory Management

```typescript
import { MemoryManager } from '@ax/core/memory';

const memory = new MemoryManager({
  dbPath: '.automatosx/memory/memories.db',
  maxEntries: 10000,
});

// Add memory
const id = memory.add({
  agent: 'backend',
  type: 'conversation',
  content: 'Designed REST API for users',
  metadata: { task: 'api-design' },
});

// Search with full-text search
const results = memory.search('REST API', { limit: 10 });

// Clear old memories
memory.clear({ before: new Date('2024-01-01') });

// Get statistics
const stats = memory.getStats();
```

### Session Management

```typescript
import { SessionManager } from '@ax/core/session';

const sessions = new SessionManager({
  sessionsDir: '.automatosx/sessions',
});

// Create session
const session = await sessions.create({
  primaryAgent: 'product',
  task: 'Design authentication system',
});

// Add task to session
await sessions.addTask(session.id, {
  agent: 'backend',
  description: 'Implement API endpoints',
});

// Complete session
await sessions.complete(session.id, {
  summary: 'Auth system designed and implemented',
});
```

### Provider Routing

```typescript
import { ProviderRouter } from '@ax/core/router';

const router = new ProviderRouter(providers, {
  onFallback: (from, to, reason) => {
    console.log(`Switched from ${from} to ${to}: ${reason}`);
  },
});

// Route request to best available provider
const response = await router.route(request, {
  preferredProvider: 'claude',
  enableFallback: true,
});
```

### Configuration

```typescript
import { ConfigLoader } from '@ax/core/config';

const loader = new ConfigLoader();
const config = await loader.load('ax.config.json');

// Access typed config
console.log(config.providers.default);
console.log(config.execution.timeout);
```

### Error Handling

```typescript
import {
  AutomatosXError,
  AgentNotFoundError,
  ProviderUnavailableError,
  MemoryError,
  findSimilar,
} from '@ax/core';

try {
  registry.getOrThrow('backnd'); // typo
} catch (error) {
  if (error instanceof AgentNotFoundError) {
    console.log(error.suggestion); // 'Did you mean: backend?'
  }
}
```

## License

Apache-2.0
