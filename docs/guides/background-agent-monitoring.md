# Background Agent Monitoring Guide

**Version:** 8.5.0+
**Feature:** BackgroundAgentMonitor
**Status:** Production-ready

---

## Overview

AutomatosX includes a built-in **Background Agent Monitor** (v8.5.0+) that enables zero-polling, file-based notifications when background agents complete execution.

**Key Benefits:**
- ⚡ **Low-latency notifications** (~10-50ms via `fs.watch()`)
- 🚫 **Zero polling required** (file-based event system)
- 🔄 **Automatic cleanup** of processed status files
- 🛡️ **Race condition handling** (works even if agent completes before monitoring starts)
- 📦 **Built-in since v8.5.0** (no installation needed)

---

## Quick Start

### Basic Usage

```typescript
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';
import { Bash } from '@claude/tools'; // Or your bash execution method

// 1. Start background agent
await Bash({
  command: 'ax run backend "implement user authentication"',
  run_in_background: true
});

// 2. Monitor completion (no polling!)
const monitor = new BackgroundAgentMonitor();
const status = await monitor.watchAgent('backend', (status) => {
  console.log(`✅ Backend agent completed in ${status.duration}ms`);
});

console.log('Status:', status.status);
console.log('Duration:', status.duration);
console.log('Task:', status.task);
```

### Multiple Agent Monitoring

```typescript
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';

// Start multiple background agents
await Promise.all([
  Bash({ command: 'ax run backend "API implementation"', run_in_background: true }),
  Bash({ command: 'ax run frontend "UI components"', run_in_background: true }),
  Bash({ command: 'ax run devops "Docker setup"', run_in_background: true })
]);

// Monitor all agents
const monitor = new BackgroundAgentMonitor();
const results = await monitor.watchAgents(['backend', 'frontend', 'devops'], (status) => {
  console.log(`${status.agent} ${status.status}`);
});

console.log(`All ${results.length} agents completed!`);
```

---

## How It Works

### Architecture

```
┌─────────────────┐
│ Background Agent│ (ax run backend "task" &)
└────────┬────────┘
         │ On completion
         ▼
┌────────────────────────────────────────┐
│ Status File Writer                     │
│ .automatosx/status/backend-{ts}.json  │
└────────┬───────────────────────────────┘
         │ fs.watch() event (~10-50ms)
         ▼
┌────────────────────────────────────────┐
│ BackgroundAgentMonitor                 │
│ • Detects new status file              │
│ • Reads and parses JSON                │
│ • Invokes callbacks                    │
│ • Cleans up file                       │
└────────────────────────────────────────┘
```

### Status File Format

When an agent completes, AutomatosX automatically writes:

```json
{
  "agent": "backend",
  "status": "completed",
  "timestamp": "2025-11-18T15:11:37.508Z",
  "pid": 8113,
  "duration": 13096,
  "task": "implement user authentication",
  "provider": "gemini-cli",
  "error": null
}
```

**Location:** `.automatosx/status/{agent}-{timestamp}.json`

---

## API Reference

### BackgroundAgentMonitor Class

#### Constructor

```typescript
constructor(projectDir?: string)
```

**Parameters:**
- `projectDir` (optional): Project directory (defaults to `process.cwd()`)

**Example:**
```typescript
const monitor = new BackgroundAgentMonitor('/path/to/project');
```

#### watchAgent()

Monitor a single agent for completion.

```typescript
async watchAgent(
  agentName: string,
  callback?: AgentCompletionCallback
): Promise<AgentStatus>
```

**Parameters:**
- `agentName`: Name of agent to monitor (e.g., 'backend', 'frontend')
- `callback` (optional): Callback invoked on completion

**Returns:** Promise that resolves with `AgentStatus`

**Example:**
```typescript
const status = await monitor.watchAgent('backend', (status) => {
  console.log(`Agent ${status.agent} finished with status: ${status.status}`);
});
```

#### watchAgents()

Monitor multiple agents for completion.

```typescript
async watchAgents(
  agentNames: string[],
  callback?: AgentCompletionCallback
): Promise<AgentStatus[]>
```

**Parameters:**
- `agentNames`: Array of agent names to monitor
- `callback` (optional): Callback invoked for each completion

**Returns:** Promise that resolves when all agents complete

**Example:**
```typescript
const results = await monitor.watchAgents(
  ['backend', 'frontend', 'security'],
  (status) => console.log(`${status.agent} done`)
);
```

#### stop()

Stop monitoring and cleanup.

```typescript
async stop(): Promise<void>
```

**Example:**
```typescript
await monitor.stop();
```

#### displayNotification() (static)

Display console notification for agent completion.

```typescript
static displayNotification(status: AgentStatus): void
```

**Example:**
```typescript
BackgroundAgentMonitor.displayNotification(status);
// Output:
// ✅ Background agent 'backend' completed
//    Duration: 5.2s
```

---

## Common Patterns

### Pattern 1: Fire-and-Forget with Notification

```typescript
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';

async function runBackgroundTask(agent: string, task: string) {
  // Start background agent
  await Bash({
    command: `ax run ${agent} "${task}"`,
    run_in_background: true
  });

  console.log(`✓ Started ${agent} in background`);

  // Monitor completion
  const monitor = new BackgroundAgentMonitor();
  const status = await monitor.watchAgent(agent);

  // Display notification
  BackgroundAgentMonitor.displayNotification(status);

  return status;
}

// Usage
await runBackgroundTask('backend', 'refactor authentication module');
```

### Pattern 2: Parallel Execution with Monitoring

```typescript
async function parallelAgentExecution(tasks: Array<{agent: string, task: string}>) {
  // Start all agents in parallel
  await Promise.all(
    tasks.map(({agent, task}) =>
      Bash({
        command: `ax run ${agent} "${task}"`,
        run_in_background: true
      })
    )
  );

  console.log(`Started ${tasks.length} background agents`);

  // Monitor all completions
  const monitor = new BackgroundAgentMonitor();
  const agentNames = tasks.map(t => t.agent);

  const results = await monitor.watchAgents(agentNames, (status) => {
    BackgroundAgentMonitor.displayNotification(status);
  });

  return results;
}

// Usage
const results = await parallelAgentExecution([
  { agent: 'backend', task: 'Implement API endpoints' },
  { agent: 'frontend', task: 'Build UI components' },
  { agent: 'devops', task: 'Setup Docker configuration' }
]);

console.log(`All ${results.length} agents completed successfully`);
```

### Pattern 3: Timeout Handling

```typescript
async function runWithTimeout(agent: string, task: string, timeoutMs: number = 300000) {
  // Start background agent
  await Bash({
    command: `ax run ${agent} "${task}"`,
    run_in_background: true
  });

  // Monitor with timeout
  const monitor = new BackgroundAgentMonitor();

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    const status = await Promise.race([
      monitor.watchAgent(agent),
      timeoutPromise
    ]);

    return status;
  } catch (error) {
    await monitor.stop();
    throw error;
  }
}

// Usage
try {
  const status = await runWithTimeout('backend', 'large refactor', 600000); // 10 min
  console.log('Completed:', status);
} catch (error) {
  console.error('Agent timed out:', error);
}
```

### Pattern 4: Conditional Execution

```typescript
async function conditionalExecution() {
  // Step 1: Run design agent
  await Bash({
    command: 'ax run product "Design authentication system"',
    run_in_background: true
  });

  const monitor = new BackgroundAgentMonitor();
  const designStatus = await monitor.watchAgent('product');

  if (designStatus.status !== 'completed') {
    console.error('Design failed, aborting workflow');
    return;
  }

  // Step 2: Run implementation in parallel (only if design succeeded)
  await Promise.all([
    Bash({ command: 'ax run backend "Implement auth API"', run_in_background: true }),
    Bash({ command: 'ax run frontend "Build auth UI"', run_in_background: true })
  ]);

  const implResults = await monitor.watchAgents(['backend', 'frontend']);

  // Step 3: Run testing (only if all implementations succeeded)
  if (implResults.every(r => r.status === 'completed')) {
    await Bash({
      command: 'ax run quality "Test authentication system"',
      run_in_background: true
    });

    const testStatus = await monitor.watchAgent('quality');
    console.log('Test result:', testStatus.status);
  }
}
```

---

## Claude Code Integration

### Using with Claude Code Bash Tool

```typescript
// In Claude Code context
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';

// Start background agent via Claude Code Bash tool
await Bash({
  command: 'ax run backend "implement user authentication"',
  run_in_background: true,
  description: 'Start backend agent for auth implementation'
});

// Monitor completion
const monitor = new BackgroundAgentMonitor();
const status = await monitor.watchAgent('backend', (status) => {
  // This callback runs when agent completes
  console.log(`Backend agent completed in ${status.duration}ms`);
  console.log(`Provider used: ${status.provider}`);
});

// Agent completed - continue workflow
if (status.status === 'completed') {
  console.log('✅ Authentication implementation complete!');
  // Next steps...
}
```

### Recommended Pattern for Claude Code

```typescript
/**
 * Run AutomatosX agent in background and wait for completion
 */
async function runAgentInBackground(agent: string, task: string) {
  console.log(`Starting ${agent} agent in background...`);

  // Start agent
  await Bash({
    command: `ax run ${agent} "${task}"`,
    run_in_background: true,
    description: `Run ${agent} agent: ${task}`
  });

  // Monitor completion
  const monitor = new BackgroundAgentMonitor();
  const status = await monitor.watchAgent(agent);

  // Display result
  if (status.status === 'completed') {
    console.log(`✅ ${agent} completed successfully in ${(status.duration / 1000).toFixed(1)}s`);
  } else {
    console.error(`❌ ${agent} failed: ${status.error || 'Unknown error'}`);
  }

  return status;
}

// Usage in Claude Code
const result = await runAgentInBackground('backend', 'implement JWT authentication');
```

---

## Troubleshooting

### Issue: Monitor doesn't detect completion

**Symptoms:** `watchAgent()` hangs indefinitely

**Solutions:**

1. **Check status directory exists:**
   ```bash
   ls -la .automatosx/status/
   ```

2. **Verify agent is writing status files:**
   ```bash
   # Start agent
   ax run backend "test task" &

   # Wait a moment, then check
   ls -la .automatosx/status/backend-*.json
   ```

3. **Check agent completed successfully:**
   ```bash
   # View status file contents
   cat .automatosx/status/backend-*.json
   ```

4. **Enable debug logging:**
   ```bash
   export AUTOMATOSX_LOG_LEVEL=debug
   ax run backend "task" &
   ```

### Issue: Race condition (agent completes before monitoring starts)

**Symptoms:** Status file exists but monitor doesn't detect it

**Solution:** BackgroundAgentMonitor handles this automatically!

```typescript
// Even if agent completes before watchAgent() is called,
// the monitor checks for existing status files
const monitor = new BackgroundAgentMonitor();

// This will find status file even if agent already completed
const status = await monitor.watchAgent('backend');
```

### Issue: Multiple status files for same agent

**Symptoms:** Multiple `backend-*.json` files in status directory

**Cause:** Agent run multiple times without cleanup

**Solution:**
```bash
# Clean up old status files
rm .automatosx/status/*.json

# Or let BackgroundAgentMonitor clean up automatically
# (it removes files after processing)
```

### Issue: Monitor doesn't clean up status files

**Symptoms:** Status files accumulate in `.automatosx/status/`

**Cause:** Monitor not processing files correctly

**Solution:**

1. **Check file permissions:**
   ```bash
   chmod 644 .automatosx/status/*.json
   ```

2. **Manual cleanup:**
   ```bash
   rm .automatosx/status/*.json
   ```

3. **Verify monitor is stopping correctly:**
   ```typescript
   const monitor = new BackgroundAgentMonitor();
   await monitor.watchAgent('backend');
   await monitor.stop(); // Ensure cleanup
   ```

---

## Best Practices

### 1. Always Stop Monitor When Done

```typescript
const monitor = new BackgroundAgentMonitor();
try {
  const status = await monitor.watchAgent('backend');
  // Process status...
} finally {
  await monitor.stop(); // Clean up resources
}
```

### 2. Use Callbacks for Progress Updates

```typescript
const monitor = new BackgroundAgentMonitor();
await monitor.watchAgents(['backend', 'frontend', 'devops'], (status) => {
  // Real-time progress updates
  console.log(`[${new Date().toISOString()}] ${status.agent}: ${status.status}`);
});
```

### 3. Handle Errors Gracefully

```typescript
const status = await monitor.watchAgent('backend');

if (status.status === 'failed') {
  console.error(`Agent failed: ${status.error}`);
  // Handle failure...
} else {
  console.log('Agent succeeded!');
  // Continue workflow...
}
```

### 4. Set Timeouts for Long-Running Agents

```typescript
const timeoutMs = 600000; // 10 minutes

const status = await Promise.race([
  monitor.watchAgent('backend'),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  )
]);
```

### 5. Use Descriptive Task Names

```bash
# Good: Clear what agent is doing
ax run backend "implement JWT authentication with refresh tokens" &

# Bad: Vague task description
ax run backend "auth stuff" &
```

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **Notification latency** | 10-50ms | Via `fs.watch()` |
| **Overhead per agent** | < 5ms | Status file write |
| **Memory usage** | ~100KB | Per monitor instance |
| **Cleanup delay** | Immediate | After callback completes |
| **Max concurrent agents** | Unlimited | Limited only by system resources |

---

## Comparison: Polling vs File-Based Monitoring

### ❌ Polling Approach (DON'T USE)

```typescript
// BAD: Constant polling wastes resources
async function pollForCompletion(agent: string) {
  while (true) {
    const result = await BashOutput({ bash_id: shellId });
    if (result.status === 'completed') {
      return result;
    }
    await sleep(5000); // Poll every 5 seconds
  }
}
```

**Problems:**
- High CPU usage (constant checking)
- Network overhead (if checking remote status)
- Poor latency (5s delay minimum)
- Wasted API calls

### ✅ File-Based Monitoring (USE THIS)

```typescript
// GOOD: Event-driven, zero polling
const monitor = new BackgroundAgentMonitor();
const status = await monitor.watchAgent('backend');
```

**Benefits:**
- Zero CPU usage (event-driven)
- 10-50ms latency (instant notification)
- No wasted resources
- Scales to hundreds of agents

---

## Advanced Usage

### Custom Status Directory

```typescript
const monitor = new BackgroundAgentMonitor('/custom/project/path');
```

### Monitoring with Custom Validation

```typescript
const monitor = new BackgroundAgentMonitor();
const status = await monitor.watchAgent('backend', (status) => {
  // Custom validation
  if (status.duration > 300000) {
    console.warn(`Agent took ${status.duration}ms - longer than expected`);
  }

  if (status.provider !== 'gemini-cli') {
    console.log(`Used ${status.provider} instead of free-tier Gemini`);
  }
});
```

### Integration with External Notifications

```typescript
import { BackgroundAgentMonitor } from '@defai.digital/automatosx';
import fetch from 'node-fetch';

const monitor = new BackgroundAgentMonitor();
await monitor.watchAgent('backend', async (status) => {
  // Send Slack notification
  await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
    method: 'POST',
    body: JSON.stringify({
      text: `Agent ${status.agent} completed in ${status.duration}ms`
    })
  });
});
```

---

## See Also

- [Parallel Execution Guide](./parallel-execution.md)
- [Claude Code Subagent Integration](./claude-code-subagent-integration.md)
- [AutomatosX CLI Reference](../reference/cli-commands.md)
- [Agent Profiles](./agent-profiles.md)

---

**Questions or issues?** See [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
