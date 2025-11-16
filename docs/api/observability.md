# Observability API Reference

This document provides a reference for the observability-related APIs in AutomatosX, including the `MetricsCollector` class and visualization methods.

## MetricsCollector

The `MetricsCollector` class is used to collect and export metrics for parallel agent executions in a Prometheus-compatible format.

### `incrementParallelAgents(count: number = 1): void`

Increments the total count of parallel agents executed.

- **`count`** (number, optional): The number to increment the counter by. Defaults to `1`.

### `incrementParallelErrors(count: number = 1): void`

Increments the total count of parallel execution errors.

- **`count`** (number, optional): The number to increment the counter by. Defaults to `1`.

### `observeParallelExecutionDuration(seconds: number): void`

Records a parallel execution duration.

- **`seconds`** (number): The execution duration in seconds.

### `exportPrometheus(): string`

Exports the collected metrics in Prometheus text format.

- **Returns**: A string containing the metrics in a format that can be scraped by a Prometheus server.

### Example

```typescript
import { MetricsCollector } from '../core/metrics';

const metrics = new MetricsCollector();

metrics.incrementParallelAgents(5);
metrics.incrementParallelErrors();
metrics.observeParallelExecutionDuration(1.23);

const prometheusMetrics = metrics.exportPrometheus();
console.log(prometheusMetrics);
```

## Visualization Methods

These methods generate string representations of the execution timeline and dependency graph.

### `visualizeTimeline(timeline: TimelineEntry[]): string`

Generates a string visualization of the execution timeline.

- **`timeline`** (TimelineEntry[]): An array of timeline entries.
- **Returns**: A formatted string representing the timeline.

### `visualizeDependencyGraph(graph: DependencyGraph): string`

Generates a string visualization of the agent dependency graph.

- **`graph`** (DependencyGraph): The dependency graph object.
- **Returns**: A formatted string representing the dependency graph.

### `TimelineEntry` Interface

```typescript
interface TimelineEntry {
  agentName: string;
  startTime: number;
  endTime: number;
  duration: number;
  level: number;
  status: 'completed' | 'failed' | 'skipped' | 'cancelled';
  error?: string;
}
```

### `DependencyGraph` Interface

```typescript
interface DependencyGraph {
  nodes: Map<string, AgentNode>;
  adjacencyList: Map<string, string[]>;
  levels: Map<number, string[]>;
  maxLevel: number;
}
```
