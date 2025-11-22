# Parallel Execution Observability

AutomatosX provides powerful observability features to help you understand and debug the parallel execution of your agents. This guide explains how to use the timeline and dependency graph visualizations, as well as how to monitor your system with Prometheus metrics.

## Timeline Visualization

The timeline visualization provides a chronological view of agent execution, helping you identify bottlenecks and understand the flow of your multi-agent system.

### How to Use

To view the execution timeline, use the `--show-timeline` flag with your command:

```bash
automatosx <your-command> --show-timeline
```

### How to Interpret the Timeline

The timeline is organized by execution levels, which are determined by the dependency graph. Agents at the same level can potentially run in parallel.

```
⏱️  Execution Timeline

Level 0:
  ✓ agent-a             ████████████████████ 150ms
  ✓ agent-b             ██████████ 100ms

Level 1:
  ✓ agent-c             ██████████████████████████████ 250ms
  ✗ agent-d             █ 10ms
     └─ Error: Agent failed to execute

Total Duration: 410ms
```

- **Status Icons**:
    - `✓`: Completed successfully
    - `✗`: Failed
    - `⊘`: Skipped (due to a dependency failure)
    - `⊗`: Cancelled
- **Agent Name**: The name of the agent.
- **Bar**: A visual representation of the agent's execution duration relative to the total time.
- **Duration**: The time the agent took to execute, in milliseconds.
- **Error**: If an agent fails, the error message is displayed.

## Dependency Graph Visualization

The dependency graph shows how your agents are interconnected, making it easy to understand execution order and dependencies.

### How to Use

To view the dependency graph, use the `--show-dependency-graph` flag:

```bash
automatosx <your-command> --show-dependency-graph
```

### How to Interpret the Dependency Graph

The graph displays agents grouped by execution level. Agents at a lower level must complete before agents at a higher level can begin.

```
📊 Agent Dependency Graph

Level 0:
  ○ agent-a [parallel]
  ○ agent-b [parallel]

Level 1:
  ○ agent-c [sequential]
     ↳ depends on: agent-a, agent-b
```

- **Level**: The execution level. All agents at a given level must finish before the next level begins.
- **Agent Name**: The name of the agent.
- **Execution Mode**:
    - `[parallel]`: This agent can run in parallel with other agents at the same level.
    - `[sequential]`: This agent will run sequentially, even if other agents are at the same level.
- **Dependencies**: The list of agents that must complete before this agent can start.

## Prometheus Metrics

AutomatosX can export metrics in a format compatible with Prometheus, a popular open-source monitoring and alerting toolkit.

### How it Works

When enabled, AutomatosX collects the following metrics:
- `automatosx_parallel_agents_total`: The total number of agents executed in parallel.
- `automatosx_parallel_execution_duration_seconds`: A summary of parallel execution durations.
- `automatosx_parallel_errors_total`: The total number of errors during parallel execution.

These metrics can be scraped by a Prometheus server to monitor the health and performance of your agent executions over time.

### How to Use

To enable the Prometheus metrics collector, you will need to configure it in your `ax.config.json`. The collected metrics can then be exposed through an endpoint for your Prometheus server to scrape.

*For detailed instructions on setting up a Prometheus server, please refer to the official Prometheus documentation.*

## Troubleshooting

- **Circular Dependencies**: If the dependency graph detects a circular dependency (e.g., Agent A depends on Agent B, and Agent B depends on Agent A), the execution will be aborted. The dependency graph visualization will help you identify and fix these cycles.
- **Performance Bottlenecks**: Use the timeline visualization to identify agents that are taking longer than expected. These may be candidates for optimization or for being broken down into smaller, more focused agents.
- **Execution Failures**: The timeline clearly marks failed agents and their error messages, allowing you to quickly pinpoint the source of a problem.
