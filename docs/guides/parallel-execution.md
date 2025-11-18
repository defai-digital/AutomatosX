# Parallel Execution Guide

**Feature:** Multi-Agent Parallel Execution
**Available:** All versions
**Status:** Production-ready

---

## Overview

AutomatosX supports parallel execution of multiple agents, enabling faster completion of independent tasks. This guide covers all parallel execution patterns, from simple bash parallelization to sophisticated DAG-based orchestration.

**Key Benefits:**
- ⚡ **4-10x faster** for independent tasks
- 🔄 **Automatic dependency resolution** with Spec-Kit
- 🛡️ **Error isolation** (one failure doesn't block others)
- 📊 **Progress tracking** for all parallel agents
- 🎯 **Resource-aware** execution (configurable concurrency limits)

---

## Quick Start

### Method 1: Bash Parallelization

Simplest approach using bash's `&` operator:

```bash
# Start multiple agents in parallel
ax run backend "Implement API endpoints" &
ax run frontend "Build UI components" &
ax run devops "Setup Docker configuration" &

# Wait for all to complete
wait

echo "All agents completed!"
```

### Method 2: --parallel Flag

Use AutomatosX's built-in parallel execution:

```bash
# Execute with parallel flag
ax run backend "Implement authentication" --parallel
```

**Note:** The `--parallel` flag enables parallel **delegation** within an agent (when it delegates to multiple other agents).

### Method 3: Spec-Kit DAG

Most powerful - automatic dependency resolution:

```yaml
# workflow.ax.yaml
name: Feature Development Workflow
tasks:
  - name: design
    agent: product
    dependencies: []

  - name: backend
    agent: backend
    dependencies: [design]

  - name: frontend
    agent: frontend
    dependencies: [design]

  - name: tests
    agent: quality
    dependencies: [backend, frontend]
```

```bash
# Execute spec (backend and frontend run in parallel after design)
ax spec run workflow.ax.yaml
```

---

## Patterns & Examples

### Pattern 1: Simple Bash Parallelization

**Use When:** Independent tasks with no dependencies

```bash
#!/bin/bash

# Function to run agent and capture result
run_agent() {
  local agent=$1
  local task=$2
  echo "Starting $agent..."
  ax run "$agent" "$task"
  echo "✓ $agent completed"
}

# Export function for parallel execution
export -f run_agent

# Run agents in parallel
run_agent "backend" "Implement REST API" &
run_agent "frontend" "Build React components" &
run_agent "devops" "Configure Kubernetes" &
run_agent "quality" "Setup test framework" &

# Wait for all background jobs
wait

echo "All agents completed successfully!"
```

**Pros:**
- Simple and familiar (standard bash)
- No special flags needed
- Works everywhere

**Cons:**
- No built-in error handling
- Manual dependency management
- No progress tracking

### Pattern 2: Parallel Execution with Error Handling

**Use When:** Need robust error handling and status tracking

```bash
#!/bin/bash

# Array to track PIDs and agent names
declare -a PIDS
declare -a AGENTS

# Function to run agent
run_agent_tracked() {
  local agent=$1
  local task=$2

  ax run "$agent" "$task" &
  local pid=$!

  PIDS+=($pid)
  AGENTS+=($agent)

  echo "Started $agent (PID: $pid)"
}

# Start all agents
run_agent_tracked "backend" "Implement API"
run_agent_tracked "frontend" "Build UI"
run_agent_tracked "devops" "Setup infra"

# Wait and check exit codes
failed_agents=()

for i in "${!PIDS[@]}"; do
  pid=${PIDS[$i]}
  agent=${AGENTS[$i]}

  if wait "$pid"; then
    echo "✅ $agent completed successfully"
  else
    echo "❌ $agent failed"
    failed_agents+=("$agent")
  fi
done

# Report results
if [ ${#failed_agents[@]} -eq 0 ]; then
  echo "All agents completed successfully!"
  exit 0
else
  echo "Failed agents: ${failed_agents[*]}"
  exit 1
fi
```

### Pattern 3: Staged Parallel Execution

**Use When:** Tasks have stages, with parallelization within each stage

```bash
#!/bin/bash

echo "=== Stage 1: Design Phase ==="
ax run product "Design authentication system"
ax run architecture "Create ADR for auth"

echo "=== Stage 2: Implementation (Parallel) ==="
ax run backend "Implement auth API" &
ax run frontend "Build auth UI" &
ax run database "Create auth tables" &
wait

echo "=== Stage 3: Validation (Parallel) ==="
ax run security "Security audit" &
ax run quality "Integration tests" &
wait

echo "=== Stage 4: Deployment ==="
ax run devops "Deploy to staging"

echo "Workflow complete!"
```

### Pattern 4: Resource-Constrained Parallelization

**Use When:** Need to limit concurrent agents (e.g., to avoid overwhelming providers)

```bash
#!/bin/bash

MAX_CONCURRENT=3

# List of tasks
tasks=(
  "backend:Implement user service"
  "backend:Implement post service"
  "backend:Implement comment service"
  "frontend:User profile page"
  "frontend:Feed page"
  "frontend:Comment component"
)

# Process tasks with concurrency limit
running=0

for task in "${tasks[@]}"; do
  IFS=':' read -r agent task_desc <<< "$task"

  # Wait if at max concurrency
  while [ $running -ge $MAX_CONCURRENT ]; do
    wait -n  # Wait for any job to complete
    ((running--))
  done

  # Start new task
  ax run "$agent" "$task_desc" &
  ((running++))
  echo "Started: $agent - $task_desc (running: $running)"
done

# Wait for remaining tasks
wait
echo "All tasks completed!"
```

### Pattern 5: DAG-Based Execution with Spec-Kit

**Use When:** Complex workflows with dependencies

**Example 1: Simple Dependency Chain**

```yaml
# auth-workflow.ax.yaml
name: Authentication Feature
policy:
  constraints:
    maxLatency: 5000
    privacy: private

tasks:
  # Design phase
  - name: design
    agent: product
    task: Design authentication system with JWT
    dependencies: []

  # Implementation phase (parallel after design)
  - name: backend-api
    agent: backend
    task: Implement authentication API
    dependencies: [design]

  - name: frontend-ui
    agent: frontend
    task: Build authentication UI
    dependencies: [design]

  - name: database-schema
    agent: backend
    task: Create user and session tables
    dependencies: [design]

  # Security phase (after implementations)
  - name: security-audit
    agent: security
    task: Audit authentication implementation
    dependencies: [backend-api, frontend-ui, database-schema]

  # Testing phase (after security)
  - name: integration-tests
    agent: quality
    task: Write integration tests for auth flow
    dependencies: [security-audit]

  # Deployment
  - name: deploy
    agent: devops
    task: Deploy authentication feature
    dependencies: [integration-tests]
```

**Execution:**

```bash
ax spec run auth-workflow.ax.yaml

# AutomatosX automatically:
# 1. Runs 'design' first
# 2. Runs backend-api, frontend-ui, database-schema in PARALLEL
# 3. Runs security-audit after all implementations complete
# 4. Runs integration-tests after security audit
# 5. Runs deploy after tests pass
```

**Example 2: Complex Multi-Feature Workflow**

```yaml
# feature-release.ax.yaml
name: Feature Release v2.0
tasks:
  # Core features (can run in parallel)
  - name: user-management
    agent: backend
    task: Implement user management API
    dependencies: []

  - name: post-system
    agent: backend
    task: Implement post system API
    dependencies: []

  - name: comment-system
    agent: backend
    task: Implement comment system API
    dependencies: [post-system]  # Comments depend on posts

  # Frontend (parallel development)
  - name: user-ui
    agent: frontend
    task: Build user management UI
    dependencies: [user-management]

  - name: post-ui
    agent: frontend
    task: Build post feed UI
    dependencies: [post-system]

  - name: comment-ui
    agent: frontend
    task: Build comment component
    dependencies: [comment-system]

  # Infrastructure
  - name: database-migrations
    agent: devops
    task: Create database migrations
    dependencies: [user-management, post-system, comment-system]

  - name: api-documentation
    agent: writer
    task: Document new API endpoints
    dependencies: [user-management, post-system, comment-system]

  # Quality assurance (after everything)
  - name: e2e-tests
    agent: quality
    task: End-to-end testing
    dependencies: [user-ui, post-ui, comment-ui, database-migrations]

  - name: performance-tests
    agent: quality
    task: Performance testing
    dependencies: [e2e-tests]

  # Deployment
  - name: staging-deploy
    agent: devops
    task: Deploy to staging environment
    dependencies: [performance-tests, api-documentation]

  - name: production-deploy
    agent: devops
    task: Deploy to production
    dependencies: [staging-deploy]
```

**Execution Visualization:**

```
                    ┌─ user-management ─┐
                    │                   ├─► user-ui ─┐
                    │                   │            │
Start ─► ┌─ post-system ───────┐       │            ├─► e2e-tests ─► performance-tests
         │                      ├─► post-ui ─┐      │                         │
         │                      │            │      │                         ▼
         └─► comment-system ────┴─► comment-ui ──┐  │              ┌─► staging-deploy
                                                  │  │              │
                        database-migrations ◄─────┴──┘              │
                        api-documentation ◄──────────┴──────────────┘
                                                                     │
                                                                     ▼
                                                           production-deploy
```

---

## Advanced Techniques

### Technique 1: Parallel Execution with BackgroundAgentMonitor

Combine parallel execution with file-based monitoring (zero polling):

```typescript
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';

async function parallelExecutionWithMonitoring() {
  const agents = [
    { name: 'backend', task: 'Implement API' },
    { name: 'frontend', task: 'Build UI' },
    { name: 'devops', task: 'Setup infra' }
  ];

  // Start all agents in parallel
  await Promise.all(
    agents.map(({name, task}) =>
      Bash({
        command: `ax run ${name} "${task}"`,
        run_in_background: true
      })
    )
  );

  console.log(`Started ${agents.length} agents in parallel`);

  // Monitor all completions (no polling!)
  const monitor = new BackgroundAgentMonitor();
  const results = await monitor.watchAgents(
    agents.map(a => a.name),
    (status) => {
      console.log(`✓ ${status.agent} completed in ${status.duration}ms`);
    }
  );

  console.log(`All ${results.length} agents completed!`);
  return results;
}
```

### Technique 2: Dynamic Parallelization

Adjust concurrency based on system resources or task complexity:

```typescript
async function dynamicParallelExecution(tasks: Array<{agent: string, task: string, complexity: 'low' | 'medium' | 'high'}>) {
  // Determine max concurrency based on complexity
  const lowComplexityTasks = tasks.filter(t => t.complexity === 'low');
  const mediumComplexityTasks = tasks.filter(t => t.complexity === 'medium');
  const highComplexityTasks = tasks.filter(t => t.complexity === 'high');

  // Run high-complexity tasks one at a time
  for (const task of highComplexityTasks) {
    await Bash({ command: `ax run ${task.agent} "${task.task}"` });
  }

  // Run medium-complexity tasks with limit of 2
  for (let i = 0; i < mediumComplexityTasks.length; i += 2) {
    const batch = mediumComplexityTasks.slice(i, i + 2);
    await Promise.all(
      batch.map(t => Bash({ command: `ax run ${t.agent} "${t.task}"` }))
    );
  }

  // Run low-complexity tasks fully parallel
  await Promise.all(
    lowComplexityTasks.map(t =>
      Bash({ command: `ax run ${t.agent} "${t.task}"` })
    )
  );
}
```

### Technique 3: Retry Failed Agents

Automatically retry failed agents in parallel workflows:

```bash
#!/bin/bash

MAX_RETRIES=3

run_with_retry() {
  local agent=$1
  local task=$2
  local attempt=1

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "Attempt $attempt: $agent"

    if ax run "$agent" "$task"; then
      echo "✅ $agent succeeded"
      return 0
    else
      echo "❌ $agent failed (attempt $attempt)"
      ((attempt++))
      sleep 5  # Wait before retry
    fi
  done

  echo "❌ $agent failed after $MAX_RETRIES attempts"
  return 1
}

# Run with retries in parallel
run_with_retry "backend" "Implement API" &
run_with_retry "frontend" "Build UI" &
run_with_retry "devops" "Setup infra" &

wait
```

---

## Configuration

### Concurrency Limits

Configure max concurrent agents in `automatosx.config.json`:

```json
{
  "execution": {
    "maxConcurrentAgents": 4,
    "parallelDelegationEnabled": true
  }
}
```

**Default:** 4 concurrent agents
**Range:** 1-10 (higher values may overwhelm AI providers)

### Provider Rate Limiting

Ensure providers can handle parallel requests:

```json
{
  "providers": {
    "gemini-cli": {
      "rateLimit": {
        "enabled": true,
        "capacity": 100,
        "refillRate": 10
      }
    }
  }
}
```

---

## Best Practices

### 1. Group Independent Tasks

```bash
# ✅ Good: Independent tasks in parallel
ax run backend "User service" &
ax run backend "Post service" &
ax run backend "Comment service" &
wait

# ❌ Bad: Dependent tasks in parallel
ax run backend "Create database schema" &
ax run backend "Insert seed data" &  # Needs schema first!
wait
```

### 2. Use Spec-Kit for Complex Dependencies

```yaml
# ✅ Good: Clear dependency declaration
tasks:
  - name: schema
    agent: backend
    dependencies: []

  - name: seed-data
    agent: backend
    dependencies: [schema]  # Explicit dependency
```

### 3. Set Appropriate Timeouts

```bash
# ✅ Good: Different timeouts for different task types
ax run backend "Quick validation" --timeout 30 &
ax run backend "Full refactor" --timeout 3600 &
wait
```

### 4. Monitor Progress

```bash
# ✅ Good: Progress visibility
ax run backend "Task 1" &
pid1=$!

ax run frontend "Task 2" &
pid2=$!

# Monitor progress
while kill -0 $pid1 2>/dev/null || kill -0 $pid2 2>/dev/null; do
  echo "Still running..."
  sleep 10
done

echo "All done!"
```

### 5. Handle Partial Failures

```bash
# ✅ Good: Continue on partial failure
ax run backend "Critical task" || exit 1  # Must succeed

ax run frontend "UI enhancement" || echo "Frontend failed (non-critical)" &
ax run devops "Optional logging" || echo "Devops failed (non-critical)" &
wait

echo "Workflow completed (with possible non-critical failures)"
```

---

## Performance Optimization

### CPU-Bound Tasks

Limit concurrency to avoid CPU contention:

```bash
# For CPU-intensive tasks, limit to CPU count
MAX_CONCURRENT=$(nproc)  # Or sysctl -n hw.ncpu on macOS

# Run with limit
# (use technique from Pattern 4 above)
```

### I/O-Bound Tasks

Higher concurrency is acceptable:

```bash
# For I/O-bound tasks (API calls, file operations), can go higher
MAX_CONCURRENT=10

# Run multiple agents calling external APIs
```

### Memory Constraints

Monitor memory usage with many parallel agents:

```bash
# Check available memory
free -h  # Linux
vm_stat  # macOS

# Adjust concurrency based on available RAM
```

---

## Troubleshooting

### Issue: Agents interfere with each other

**Symptoms:** File conflicts, database locks, port conflicts

**Solution:** Ensure true independence

```bash
# ❌ Bad: Agents writing to same file
ax run backend "Generate config > config.json" &
ax run frontend "Generate config > config.json" &  # CONFLICT!

# ✅ Good: Separate output files
ax run backend "Generate config > backend-config.json" &
ax run frontend "Generate config > frontend-config.json" &
```

### Issue: Provider rate limits hit

**Symptoms:** Agents fail with rate limit errors

**Solution:** Stagger execution or reduce concurrency

```bash
# Stagger starts
ax run backend "Task 1" &
sleep 2
ax run frontend "Task 2" &
sleep 2
ax run devops "Task 3" &
wait
```

### Issue: Unclear which agent failed

**Symptoms:** Exit code 1 but don't know which agent failed

**Solution:** Track PIDs (see Pattern 2 above)

---

## Performance Metrics

| Scenario | Sequential | Parallel | Speedup |
|----------|-----------|----------|---------|
| 3 independent agents (5 min each) | 15 min | 5 min | **3x** |
| 5 agents with dependencies | 15 min | 8 min | **1.9x** |
| 10 simple agents (1 min each) | 10 min | 2.5 min | **4x** |

**Note:** Actual speedup depends on:
- Task independence (more independent = better speedup)
- System resources (CPU, memory, network)
- Provider rate limits
- Agent complexity

---

## See Also

- [Background Agent Monitoring](./background-agent-monitoring.md)
- [Spec-Kit Workflows](./spec-kit.md)
- [Session Management](./session-management.md)
- [Claude Code Subagent Integration](./claude-code-subagent-integration.md)

---

**Questions or issues?** See [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
