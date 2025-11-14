# revamp_v1 Phase 5: CLI and UI Integration - Architecture PRD

**Project:** AutomatosX Revamp v1
**Phase:** Phase 5 - CLI and UI Integration (Final Phase)
**Duration:** 2 weeks (10 working days)
**Dates:** March 1-14, 2026
**Status:** Ready for Implementation

---

## Executive Summary

Phase 5 is the final integration phase that unifies all components (Memory, Providers, Agents, Workflows) into a cohesive user experience. This phase delivers a production-ready CLI and Web UI, completing the AutomatosX Revamp v1 project.

**Key Deliverables:**
- Unified CLI with comprehensive commands (ax workflow, ax agent, ax memory)
- Web UI dashboard with real-time updates
- LSP server enhancements for IDE integration
- Complete integration testing
- Production deployment configuration
- 45+ comprehensive tests
- Complete user and API documentation

---

## Architecture Overview

### Three-Layer Architecture (Final Integration)

```
┌─────────────────────────────────────────────────────┐
│  User Interface Layer                               │
│  CLI (Commander.js) + Web UI (React + Redux)        │
│  • Unified commands (workflow, agent, memory)       │
│  • Real-time dashboard with WebSocket               │
│  • LSP integration for IDEs                         │
└──────────────┬──────────────────────────────────────┘
               │ HTTP/WebSocket/LSP Protocol
┌──────────────▼──────────────────────────────────────┐
│  Service Orchestration Layer                        │
│  UnifiedAPI.ts → All Phase Services                 │
│  • MemoryService (Phase 1)                          │
│  • ProviderRouter (Phase 2)                         │
│  • AgentRegistry (Phase 3)                          │
│  • WorkflowEngine (Phase 4)                         │
└──────────────┬──────────────────────────────────────┘
               │ Service calls
┌──────────────▼──────────────────────────────────────┐
│  Core Services (from Phases 1-4)                    │
│  All previously implemented components              │
│  • ReScript state machines                          │
│  • TypeScript services                              │
│  • Database with SQLite                             │
└─────────────────────────────────────────────────────┘
```

---

## Component 1: Unified CLI Commands

### File Structure

```
src/cli/
├── commands/
│   ├── workflow.ts    # ax workflow run/list/status/resume
│   ├── agent.ts       # ax agent list/run/status/metrics
│   ├── memory.ts      # ax memory search/list/show/export (from Phase 1)
│   └── system.ts      # ax system status/health/config
├── ui/
│   ├── Dashboard.tsx  # TUI dashboard (Ink components)
│   └── Progress.tsx   # Progress indicators
└── index.ts          # CLI entry point
```

### Workflow Commands

**File:** `src/cli/commands/workflow.ts`

```typescript
import { Command } from 'commander';
import { WorkflowEngine } from '../../workflows/WorkflowEngine.js';
import { WorkflowDAO } from '../../database/dao/WorkflowDAO.js';
import chalk from 'chalk';
import ora from 'ora';

export function createWorkflowCommand(): Command {
  const workflow = new Command('workflow')
    .description('Manage and execute workflows');

  // ax workflow run <file>
  workflow
    .command('run <file>')
    .description('Execute a workflow from YAML/JSON file')
    .option('-c, --context <json>', 'Workflow context as JSON')
    .option('-w, --watch', 'Watch workflow execution with live updates')
    .option('--checkpoint <id>', 'Resume from checkpoint')
    .action(async (file, options) => {
      const spinner = ora('Loading workflow...').start();

      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        const definition = await fs.readFile(file, 'utf-8');
        const format = path.extname(file) === '.yaml' || path.extname(file) === '.yml'
          ? 'yaml'
          : 'json';

        const context = options.context ? JSON.parse(options.context) : {};

        spinner.text = 'Executing workflow...';

        const engine = new WorkflowEngine();
        let results;

        if (options.checkpoint) {
          results = await engine.resume(options.checkpoint);
        } else {
          results = await engine.execute(definition, format, context);
        }

        spinner.succeed('Workflow completed successfully');

        console.log(chalk.green('\n✓ Results:'));
        console.log(JSON.stringify(results, null, 2));
      } catch (error) {
        spinner.fail('Workflow execution failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // ax workflow list
  workflow
    .command('list')
    .description('List all workflows')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action(async (options) => {
      const dao = new WorkflowDAO();
      const workflows = await dao.listWorkflows();

      if (options.format === 'json') {
        console.log(JSON.stringify(workflows, null, 2));
      } else {
        // Table output
        console.log(chalk.bold('\nWorkflows:'));
        workflows.forEach((wf) => {
          console.log(`  ${wf.id} - ${wf.name} (v${wf.version})`);
        });
      }
    });

  // ax workflow status <id>
  workflow
    .command('status <executionId>')
    .description('Check workflow execution status')
    .option('-v, --verbose', 'Show detailed status')
    .action(async (executionId, options) => {
      const dao = new WorkflowDAO();
      const execution = await dao.getExecution(executionId);

      if (!execution) {
        console.error(chalk.red(`Execution not found: ${executionId}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\nWorkflow Execution: ${executionId}`));
      console.log(`Status: ${chalk.yellow(execution.status)}`);
      console.log(`Completed Steps: ${execution.completedSteps}/${execution.totalSteps}`);

      if (options.verbose) {
        const steps = await dao.getExecutionSteps(executionId);
        console.log(chalk.bold('\nSteps:'));
        steps.forEach((step) => {
          const statusIcon = step.status === 'completed' ? '✓' :
                            step.status === 'failed' ? '✗' : '○';
          console.log(`  ${statusIcon} ${step.stepName} (${step.status})`);
        });
      }
    });

  // ax workflow resume <checkpointId>
  workflow
    .command('resume <checkpointId>')
    .description('Resume workflow from checkpoint')
    .action(async (checkpointId) => {
      const spinner = ora('Resuming workflow...').start();

      try {
        const engine = new WorkflowEngine();
        const results = await engine.resume(checkpointId);

        spinner.succeed('Workflow resumed and completed');
        console.log(chalk.green('\n✓ Results:'));
        console.log(JSON.stringify(results, null, 2));
      } catch (error) {
        spinner.fail('Resume failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return workflow;
}
```

**Estimated Lines:** ~150 lines

### Agent Commands

**File:** `src/cli/commands/agent.ts`

```typescript
import { Command } from 'commander';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { TaskDAO } from '../../database/dao/TaskDAO.js';
import chalk from 'chalk';
import ora from 'ora';

export function createAgentCommand(): Command {
  const agent = new Command('agent')
    .description('Manage and run agents');

  // ax agent list
  agent
    .command('list')
    .description('List all available agents')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action((options) => {
      const registry = new AgentRegistry();
      const agents = registry.listAgents();

      if (options.format === 'json') {
        console.log(JSON.stringify(agents, null, 2));
      } else {
        console.log(chalk.bold('\nAvailable Agents:'));
        agents.forEach((a) => {
          console.log(`  ${chalk.cyan(a.id)} - ${a.name}`);
          console.log(`    ${chalk.gray(a.description)}`);
          console.log(`    Expertise: ${a.expertise.join(', ')}`);
          console.log();
        });
      }
    });

  // ax agent run <agentId> <task>
  agent
    .command('run <agentId> <task>')
    .description('Run an agent with a task')
    .option('-p, --priority <number>', 'Task priority (1-10)', '5')
    .option('-c, --context <json>', 'Task context as JSON')
    .action(async (agentId, task, options) => {
      const spinner = ora(`Running ${agentId} agent...`).start();

      try {
        const registry = new AgentRegistry();
        const agentInstance = registry.getAgent(agentId);

        const taskObj = {
          taskId: crypto.randomUUID(),
          agentId,
          description: task,
          priority: parseInt(options.priority),
          status: 'idle' as const,
          context: options.context ? JSON.parse(options.context) : {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const result = await agentInstance.processTask(taskObj);

        spinner.succeed(`Agent ${agentId} completed task`);
        console.log(chalk.green('\n✓ Result:'));
        console.log(result);
      } catch (error) {
        spinner.fail('Agent execution failed');
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  // ax agent status <agentId>
  agent
    .command('status <agentId>')
    .description('Show agent status and metrics')
    .action(async (agentId) => {
      const dao = new TaskDAO();
      const metrics = await dao.getAgentMetrics(agentId);

      console.log(chalk.bold(`\nAgent: ${agentId}`));
      console.log(`Total Tasks: ${metrics.totalTasks}`);
      console.log(`Completed: ${chalk.green(metrics.completedTasks)}`);
      console.log(`Failed: ${chalk.red(metrics.failedTasks)}`);
      console.log(`Avg Duration: ${metrics.avgTaskDuration}ms`);
    });

  return agent;
}
```

**Estimated Lines:** ~120 lines

### System Commands

**File:** `src/cli/commands/system.ts`

```typescript
import { Command } from 'commander';
import { getDatabase } from '../../database/connection.js';
import { ProviderRouter } from '../../providers/ProviderRouter.js';
import chalk from 'chalk';

export function createSystemCommand(): Command {
  const system = new Command('system')
    .description('System status and configuration');

  // ax system status
  system
    .command('status')
    .description('Show system status')
    .option('-v, --verbose', 'Show detailed status')
    .action(async (options) => {
      console.log(chalk.bold('\nAutomatosX System Status\n'));

      // Database
      const db = getDatabase();
      const dbStats = db.prepare('SELECT COUNT(*) as count FROM sqlite_master').get();
      console.log(chalk.cyan('Database:'));
      console.log(`  Tables: ${dbStats.count}`);

      // Memory
      const conversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get();
      console.log(chalk.cyan('\nMemory:'));
      console.log(`  Conversations: ${conversations.count}`);

      // Agents
      const tasks = db.prepare('SELECT COUNT(*) as count FROM agent_tasks').get();
      console.log(chalk.cyan('\nAgents:'));
      console.log(`  Total Tasks: ${tasks.count}`);

      // Workflows
      const workflows = db.prepare('SELECT COUNT(*) as count FROM workflows').get();
      console.log(chalk.cyan('\nWorkflows:'));
      console.log(`  Defined: ${workflows.count}`);

      if (options.verbose) {
        // Additional stats
        const memUsage = process.memoryUsage();
        console.log(chalk.cyan('\nProcess:'));
        console.log(`  Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        console.log(`  Uptime: ${Math.round(process.uptime())}s`);
      }
    });

  // ax system health
  system
    .command('health')
    .description('Check system health')
    .action(async () => {
      console.log(chalk.bold('\nSystem Health Check\n'));

      const checks = [];

      // Database check
      try {
        const db = getDatabase();
        db.prepare('SELECT 1').get();
        checks.push({ name: 'Database', status: 'healthy' });
      } catch (error) {
        checks.push({ name: 'Database', status: 'unhealthy', error: error.message });
      }

      // Provider check
      try {
        const router = new ProviderRouter({
          primaryProvider: 'claude',
          fallbackProviders: [],
          enableFallback: false,
          enableCircuitBreaker: false,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000,
        });
        const health = await router.healthCheck('claude');
        checks.push({ name: 'Provider (Claude)', status: health.status });
      } catch (error) {
        checks.push({ name: 'Provider (Claude)', status: 'down', error: error.message });
      }

      // Display results
      checks.forEach((check) => {
        const icon = check.status === 'healthy' ? '✓' : '✗';
        const color = check.status === 'healthy' ? chalk.green : chalk.red;
        console.log(`${icon} ${check.name}: ${color(check.status)}`);
        if (check.error) {
          console.log(`  ${chalk.gray(check.error)}`);
        }
      });
    });

  return system;
}
```

**Estimated Lines:** ~110 lines

---

## Component 2: Web UI Dashboard

### Technology Stack

- **Framework:** React 18
- **State Management:** Redux Toolkit
- **UI Library:** Material-UI (MUI)
- **Charts:** Recharts
- **Real-time:** WebSocket
- **Build:** Vite

### Dashboard Pages

**File Structure:**

```
src/web/
├── pages/
│   ├── Dashboard.tsx       # Main dashboard overview
│   ├── Workflows.tsx       # Workflow management
│   ├── Agents.tsx          # Agent status and metrics
│   ├── Memory.tsx          # Conversation browser
│   └── Settings.tsx        # Configuration
├── components/
│   ├── WorkflowCard.tsx    # Workflow execution card
│   ├── AgentMetrics.tsx    # Agent performance charts
│   ├── ConversationList.tsx # Memory conversation list
│   └── SystemHealth.tsx     # Health indicators
├── store/
│   ├── workflowSlice.ts    # Workflow state
│   ├── agentSlice.ts       # Agent state
│   └── memorySlice.ts      # Memory state
└── api/
    └── client.ts           # API client with WebSocket
```

### Main Dashboard Component

**File:** `src/web/pages/Dashboard.tsx`

```typescript
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fetchSystemStats } from '../store/systemSlice';
import { SystemHealth } from '../components/SystemHealth';
import { WorkflowCard } from '../components/WorkflowCard';
import { AgentMetrics } from '../components/AgentMetrics';

export function Dashboard() {
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((state) => state.system);
  const { recentWorkflows } = useSelector((state) => state.workflows);
  const { agents } = useSelector((state) => state.agents);

  useEffect(() => {
    dispatch(fetchSystemStats());

    // WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'workflow_update') {
        dispatch(updateWorkflowStatus(data.payload));
      } else if (data.type === 'agent_update') {
        dispatch(updateAgentMetrics(data.payload));
      }
    };

    return () => ws.close();
  }, [dispatch]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        AutomatosX Dashboard
      </Typography>

      {/* System Health */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <SystemHealth />
        </Grid>
      </Grid>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Workflows
              </Typography>
              <Typography variant="h3">{stats.activeWorkflows}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Agent Tasks
              </Typography>
              <Typography variant="h3">{stats.agentTasks}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Conversations
              </Typography>
              <Typography variant="h3">{stats.conversations}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Checkpoints
              </Typography>
              <Typography variant="h3">{stats.checkpoints}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Workflows */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Workflows
              </Typography>
              {recentWorkflows.map((workflow) => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Metrics */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Performance
              </Typography>
              <AgentMetrics agents={agents} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Activity Chart */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity (Last 7 Days)
              </Typography>
              <LineChart width={1000} height={300} data={stats.activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="workflows" stroke="#8884d8" />
                <Line type="monotone" dataKey="tasks" stroke="#82ca9d" />
              </LineChart>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
```

**Estimated Lines:** ~180 lines

---

## Component 3: LSP Server Enhancements

### Enhanced Capabilities

**File:** `src/lsp/EnhancedLSPServer.ts`

```typescript
import { LSPServer } from './LSPServer.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { WorkflowParser } from '../workflows/WorkflowParser.js';

export class EnhancedLSPServer extends LSPServer {
  private agentRegistry: AgentRegistry;
  private workflowParser: WorkflowParser;

  constructor() {
    super();
    this.agentRegistry = new AgentRegistry();
    this.workflowParser = new WorkflowParser();
  }

  // Workflow YAML autocomplete
  async provideWorkflowCompletion(position: Position): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    // Agent ID completion
    const agents = this.agentRegistry.listAgents();
    agents.forEach((agent) => {
      items.push({
        label: agent.id,
        kind: CompletionItemKind.Value,
        detail: agent.name,
        documentation: agent.description,
      });
    });

    return items;
  }

  // Workflow validation
  async validateWorkflow(document: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    try {
      const text = document.getText();
      this.workflowParser.parse(text, 'yaml');
    } catch (error) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 100 },
        },
        message: error.message,
        source: 'automatosx',
      });
    }

    return diagnostics;
  }

  // Agent task hover information
  async provideAgentHover(agentId: string): Promise<Hover> {
    const agent = this.agentRegistry.getAgent(agentId);

    return {
      contents: {
        kind: 'markdown',
        value: `
**${agent.getName()}**

${agent.getExpertise().join(', ')}

Capabilities:
${agent.config.capabilities.map(c => `- ${c}`).join('\n')}
        `,
      },
    };
  }
}
```

**Estimated Lines:** ~100 lines

---

## Component 4: Integration Testing

### E2E Test Suite

**File:** `src/__tests__/integration/e2e-workflow.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WorkflowEngine } from '../../workflows/WorkflowEngine.js';
import { AgentRegistry } from '../../agents/AgentRegistry.js';
import { MemoryService } from '../../memory/MemoryService.js';

describe('E2E: Complete Workflow Execution', () => {
  let engine: WorkflowEngine;

  beforeAll(() => {
    engine = new WorkflowEngine();
  });

  test('executes multi-agent workflow with memory integration', async () => {
    const workflow = `
id: test-workflow
name: Test Workflow
steps:
  - id: design
    agentId: architecture
    task: Design a simple API
    dependencies: []

  - id: implement
    agentId: backend
    task: Implement the API from design step
    dependencies: [design]

  - id: test
    agentId: quality
    task: Write tests for the API
    dependencies: [implement]
`;

    const results = await engine.execute(workflow, 'yaml', {});

    expect(results.design).toBeDefined();
    expect(results.implement).toBeDefined();
    expect(results.test).toBeDefined();

    // Verify memory was stored
    const memory = new MemoryService();
    const conversations = await memory.searchConversations('API');
    expect(conversations.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout

  test('creates and resumes from checkpoint', async () => {
    const workflow = `
id: checkpoint-test
name: Checkpoint Test
steps:
  - id: step1
    agentId: backend
    task: Step 1
    dependencies: []

  - id: step2
    agentId: backend
    task: Step 2
    dependencies: [step1]
`;

    // Execute and get checkpoint
    const execution = await engine.execute(workflow, 'yaml', {});

    // Simulate resume
    const checkpointId = 'test-checkpoint';
    const resumed = await engine.resume(checkpointId);

    expect(resumed).toBeDefined();
  });
});
```

**Estimated Lines:** ~80 lines per test file, 3 test files = ~240 lines

---

## Testing Strategy

### Unit Tests
- CLI command handlers (15 tests)
- Web UI components (15 tests)
- LSP enhancements (5 tests)

### Integration Tests
- E2E workflows (10 tests)
- CLI + API integration (5 tests)

### Total Tests: 45+ tests

---

## Success Criteria

### Functional Requirements

- ✅ Unified CLI with all commands
- ✅ Web UI dashboard operational
- ✅ Real-time updates via WebSocket
- ✅ LSP integration working
- ✅ Complete E2E workflow execution

### Performance Requirements

- ✅ CLI command response: <100ms
- ✅ Web UI load time: <2s
- ✅ Real-time update latency: <500ms
- ✅ Dashboard rendering: 60fps

### Quality Requirements

- ✅ 45+ tests passing (100%)
- ✅ Test coverage >85%
- ✅ Zero P0/P1 bugs
- ✅ Complete documentation
- ✅ Production ready

---

## Production Readiness

### Deployment Configuration

**File:** `deployment/docker-compose.yml`

```yaml
version: '3.8'

services:
  automatosx:
    image: automatosx:latest
    build: .
    ports:
      - "3000:3000"  # Web UI
      - "3001:3001"  # WebSocket
      - "8080:8080"  # LSP Server
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/automatosx.db
    volumes:
      - automatosx-data:/data
    restart: unless-stopped

volumes:
  automatosx-data:
```

### Environment Configuration

```bash
# Production environment
NODE_ENV=production
DATABASE_PATH=/var/lib/automatosx/db.sqlite
LOG_LEVEL=info
ANTHROPIC_API_KEY=<key>
GOOGLE_API_KEY=<key>
OPENAI_API_KEY=<key>
```

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR IMPLEMENTATION
**Next Review:** 2026-03-14 (Phase 5 Gate Review)
**Project Completion:** 2026-03-31
