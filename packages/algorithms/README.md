# @ax/algorithms

Performance-critical algorithms for AutomatosX.

## Installation

```bash
pnpm add @ax/algorithms
```

## Overview

This package contains optimized algorithms implemented in ReScript with
TypeScript bindings:

- **Routing** - Multi-factor provider selection
- **DAG Scheduler** - Directed acyclic graph task scheduling
- **Memory Ranking** - Relevance scoring for memory search

## Algorithms

### Provider Routing

Select the best provider based on multiple factors:

```typescript
import { selectProvider, calculateProviderScore } from '@ax/algorithms';

const result = selectProvider(providers, context);
console.log(result.provider);     // Selected provider
console.log(result.score);        // Selection score
console.log(result.alternatives); // Fallback options

// Scoring factors:
// - Provider health status
// - Recent latency
// - Success rate
// - Priority configuration
```

### DAG Scheduler

Schedule tasks with dependencies:

```typescript
import {
  createDAG,
  addTask,
  addDependency,
  getExecutionOrder,
  getParallelGroups,
  getCriticalPath,
  detectCycles,
} from '@ax/algorithms';

// Create task graph
const dag = createDAG();
addTask(dag, 'setup', { name: 'Setup environment' });
addTask(dag, 'build', { name: 'Build project' });
addTask(dag, 'test', { name: 'Run tests' });
addDependency(dag, 'build', 'setup');
addDependency(dag, 'test', 'build');

// Get execution order (topological sort)
const order = getExecutionOrder(dag);
// ['setup', 'build', 'test']

// Get parallel execution groups
const groups = getParallelGroups(dag);
// [['setup'], ['build'], ['test']]

// Find critical path
const critical = getCriticalPath(dag);

// Detect cycles (returns null if valid)
const cycle = detectCycles(dag);
```

### Memory Ranking

Rank memory entries by relevance:

```typescript
import { rankMemories, calculateRelevanceScore } from '@ax/algorithms';

const ranked = rankMemories(entries, {
  query: 'authentication API',
  recencyWeight: 0.3,
  frequencyWeight: 0.2,
  typeBonus: { code: 1.2, decision: 1.1 },
  tagBonus: { important: 1.5 },
});

// Each result includes:
// - entry: The memory entry
// - score: Combined relevance score
// - components: Individual score breakdown
```

## Scoring Details

### Provider Score Components

| Factor | Weight | Description |
|--------|--------|-------------|
| Health | 0.4 | Provider availability |
| Latency | 0.3 | Recent response times |
| Success | 0.2 | Historical success rate |
| Priority | 0.1 | Configuration priority |

### Memory Relevance Components

| Factor | Weight | Description |
|--------|--------|-------------|
| FTS Score | 0.4 | Full-text search match |
| Recency | 0.3 | Time decay factor |
| Frequency | 0.2 | Access count |
| Type/Tag | 0.1 | Bonus multipliers |

## Implementation

The core algorithms are implemented in ReScript for performance:

```
packages/algorithms/
├── src/
│   ├── Routing.res       # Provider selection
│   ├── DagScheduler.res  # DAG operations
│   └── MemoryRank.res    # Relevance ranking
└── bindings/
    ├── routing.ts        # TypeScript bindings
    ├── dag.ts            # TypeScript bindings
    └── ranking.ts        # TypeScript bindings
```

## License

Apache-2.0
