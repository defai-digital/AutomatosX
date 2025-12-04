# Embedded Instructions System

**Version**: v11.3.0
**Status**: Production Ready

---

## Overview

The Embedded Instructions System enhances AI agent performance by automatically injecting contextual reminders, task tracking, and domain-specific guidance into agent conversations. This system helps agents stay focused, follow best practices, and maintain consistency across long conversations.

## Key Features

- **Automatic Task Reminders**: Periodic reminders based on active todo items
- **Memory Context Injection**: Relevant past context automatically surfaced
- **Workflow Mode Control**: Different modes for planning, iteration, and review
- **Agent-Specific Templates**: Domain expertise for backend, frontend, security, quality agents
- **Token Budget Management**: Smart allocation to stay within context limits
- **Session Collaboration**: Multi-agent coordination support

---

## Quick Start

### CLI Commands

```bash
# Workflow Mode Management
ax mode plan          # Enter plan mode (read-only exploration)
ax mode iterate       # Enter iterate mode (autonomous execution)
ax mode review        # Enter review mode (code analysis)
ax mode default       # Return to default mode
ax mode --list        # List all available modes
ax mode --status      # Show current mode status

# Debug Instructions State
ax debug:instructions                  # Show overall state
ax debug:instructions --tokens         # Show token budget details
ax debug:instructions --providers      # List active providers
ax debug:instructions --templates      # List agent templates
ax debug:instructions --agent backend  # Show backend agent template
```

### Programmatic Usage

```typescript
import {
  OrchestrationService,
  createOrchestrationService,
  createTodoItem
} from './src/core/orchestration/index.js';

// Create service
const service = createOrchestrationService({
  agentDomain: 'backend',
  todoIntegration: { enabled: true },
  memoryIntegration: { enabled: true },
  sessionIntegration: { enabled: true }
});

// Update todos
service.updateTodos([
  createTodoItem('Implement auth', 'Implementing auth', 'in_progress'),
  createTodoItem('Add tests', 'Adding tests', 'pending')
]);

// Set workflow mode
service.setWorkflowMode('plan');

// Inject instructions
const result = await service.injectInstructions({
  task: 'Design authentication system',
  agentName: 'backend'
});

// Format as system reminder
const formatted = service.formatAsSystemReminder(result.content);
```

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   OrchestrationService                       │
│  - Central coordinator for all instruction providers         │
│  - Manages workflow modes and tool filtering                 │
│  - Tracks turn count and session state                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ TodoProvider  │   │ MemoryProvider│   │SessionProvider│
│ - Task lists  │   │ - Context     │   │ - Multi-agent │
│ - Reminders   │   │ - Relevance   │   │ - Progress    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OrchestrationInstructionInjector                │
│  - Priority-based instruction ordering                       │
│  - Token budget allocation                                   │
│  - Format as system reminders                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     TokenBudgetManager                       │
│  - Estimates token usage                                     │
│  - Allocates budget per provider                             │
│  - Enforces limits (default: 2000 tokens)                    │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── core/
│   ├── orchestration/
│   │   ├── types.ts                    # Core type definitions
│   │   ├── token-budget.ts             # Token budget management
│   │   ├── instruction-injector.ts     # Main injection logic
│   │   ├── todo-instruction-provider.ts
│   │   ├── memory-instruction-provider.ts
│   │   ├── session-instruction-provider.ts
│   │   ├── orchestration-service.ts    # Central service
│   │   └── index.ts                    # Public exports
│   └── workflow/
│       ├── workflow-mode.ts            # Mode definitions
│       ├── workflow-mode-manager.ts    # Mode management
│       └── index.ts
├── agents/
│   ├── instruction-templates.ts        # Agent templates
│   └── agent-instruction-injector.ts   # Agent-specific injection
└── cli/
    └── commands/
        ├── mode.ts                     # ax mode command
        └── debug-instructions.ts       # ax debug:instructions
```

---

## Workflow Modes

### Available Modes

| Mode | Description | Blocked Tools |
|------|-------------|---------------|
| `default` | Standard operation with all tools | None |
| `plan` | Read-only exploration for planning | Write, Edit, Bash, NotebookEdit |
| `iterate` | Autonomous execution mode | None |
| `review` | Code review and analysis | Write, Edit, Bash, NotebookEdit |

### Mode Properties

```typescript
// Plan Mode
{
  name: 'plan',
  displayName: 'Plan Mode',
  description: 'Planning mode - read-only exploration',
  allowNesting: false,
  blockedTools: ['Write', 'Edit', 'NotebookEdit', 'Bash'],
  autoExitConditions: {
    onToolUse: ['ExitPlanMode']
  }
}

// Iterate Mode
{
  name: 'iterate',
  displayName: 'Iterate Mode',
  description: 'Continuous iteration for implementation',
  allowNesting: true,
  maxNestingDepth: 2
}
```

### Tool Filtering

```typescript
// Filter tools based on current mode
const allowedTools = service.filterTools([
  { name: 'Read' },
  { name: 'Write' },
  { name: 'Edit' },
  { name: 'Bash' }
]);

// Check individual tool
const canWrite = service.isToolAllowed('Write'); // false in plan mode
```

---

## Agent Templates

### Available Domains

- `backend` - API, database, server-side
- `frontend` - UI, React, accessibility
- `security` - OWASP, vulnerabilities, auditing
- `quality` - Testing, code quality, coverage
- `architecture` - System design, patterns
- `devops` - CI/CD, deployment, infrastructure
- `standard` - General purpose (default)

### Template Structure

```typescript
interface AgentTemplate {
  displayName: string;
  domainReminders: string[];      // Periodic reminders
  qualityChecklist: string[];     // Quality checks
  delegationTriggers: Array<{    // Cross-agent delegation
    suggestedAgent: string;
    keywords: string[];
    reason: string;
  }>;
  antiPatterns: string[];        // Patterns to avoid
  bestPractices: string[];       // Recommended practices
}
```

### Example: Backend Template

```typescript
{
  displayName: 'Backend Developer',
  domainReminders: [
    'Follow RESTful API design principles',
    'Use prepared statements for database queries',
    'Implement proper error handling'
  ],
  qualityChecklist: [
    'Input validation on all endpoints',
    'Proper HTTP status codes',
    'Database transactions where needed'
  ],
  delegationTriggers: [
    {
      suggestedAgent: 'security',
      keywords: ['authentication', 'authorization', 'encryption'],
      reason: 'Security expertise needed'
    }
  ]
}
```

---

## Token Budget Management

### Default Configuration

```typescript
{
  maxTotal: 2000,           // Maximum tokens for all instructions
  criticalReserve: 200,     // Reserved for critical instructions
  perTypeLimit: {
    task: 500,              // Todo reminders
    memory: 400,            // Memory context
    session: 300,           // Session state
    delegation: 300,        // Delegation hints
    mode: 200               // Mode instructions
  }
}
```

### Budget Allocation

Instructions are allocated budget by priority:
1. Critical (guaranteed)
2. High (preferred)
3. Normal (if space available)
4. Low (only if plenty of space)

### Token Estimation

- Approximately 4 characters = 1 token
- Actual usage may vary by content
- Budget includes safety margin

---

## Configuration

### ax.config.json

```json
{
  "orchestration": {
    "embeddedInstructions": {
      "enabled": true,
      "tokenBudget": {
        "maxTotal": 2000,
        "criticalReserve": 200
      }
    },
    "todoIntegration": {
      "enabled": true,
      "reminderFrequency": 3,
      "compactMode": false
    },
    "memoryIntegration": {
      "enabled": true,
      "maxEntries": 5,
      "minRelevance": 0.5
    },
    "sessionIntegration": {
      "enabled": true,
      "showCollaboration": true
    },
    "agentTemplates": {
      "enabled": true,
      "reminderFrequency": 5
    }
  }
}
```

### Disabling Features

```typescript
// Disable specific providers
const service = new OrchestrationService({
  todoIntegration: { enabled: false },
  memoryIntegration: { enabled: false },
  sessionIntegration: { enabled: false },
  agentTemplates: { enabled: false }
});
```

---

## API Reference

### OrchestrationService

```typescript
class OrchestrationService {
  // Constructor
  constructor(config?: OrchestrationServiceConfig);

  // Mode Management
  setWorkflowMode(mode: string): void;
  getWorkflowMode(): string;
  isToolAllowed(toolName: string): boolean;
  filterTools<T extends { name: string }>(tools: T[]): T[];

  // Todo Management
  updateTodos(todos: TodoItem[]): void;

  // Turn Tracking
  incrementTurn(): void;
  getTurnCount(): number;

  // Instruction Injection
  injectInstructions(options: {
    task?: string;
    agentName?: string;
    sessionId?: string;
    parentAgent?: string;
  }): Promise<ServiceInjectionResult>;

  // Formatting
  formatAsSystemReminder(content: string): string;

  // State Management
  reset(): void;
  getDebugInfo(): DebugInfo;
  getConfig(): OrchestrationConfig;
  updateConfig(updates: Partial<OrchestrationConfig>): void;
}
```

### Helper Functions

```typescript
// Create todo items
function createTodoItem(
  content: string,
  activeForm: string,
  status: TodoStatus
): TodoItem;

// Create mock providers (for testing)
function createMockMemoryProvider(entries: MemoryEntry[]): MemorySearchProvider;
function createMockSessionProvider(state: SessionState): SessionStateProvider;
```

---

## Testing

### Unit Tests

```bash
# Run all orchestration tests
npm run test:unit -- tests/unit/orchestration/

# Run specific test file
npx vitest run tests/unit/orchestration/orchestration-service.test.ts
```

### Integration Tests

```bash
# Run integration tests
npx vitest run tests/integration/orchestration/
```

### Test Coverage

- Phase 1: Core types, token budget, instruction injector, todo provider
- Phase 2: Memory provider, workflow modes
- Phase 3: Agent templates, session integration
- Phase 4: CLI commands, orchestration service, integration tests

---

## Best Practices

### 1. Use Workflow Modes Appropriately

```bash
# Planning phase - explore without modifying
ax mode plan
ax run architecture "Design the API structure"

# Implementation phase
ax mode iterate
ax run backend "Implement the API"

# Review phase
ax mode review
ax run quality "Review the implementation"
```

### 2. Keep Todos Updated

```typescript
// Update todos as work progresses
service.updateTodos([
  createTodoItem('Task 1', 'Task 1 done', 'completed'),
  createTodoItem('Task 2', 'Working on Task 2', 'in_progress'),
  createTodoItem('Task 3', 'Task 3', 'pending')
]);
```

### 3. Use Domain-Specific Agents

Match the agent to the task domain for best results:
- Backend work → backend agent
- Security audit → security agent
- UI development → frontend agent

### 4. Monitor Token Usage

```bash
# Check token budget usage
ax debug:instructions --tokens
```

---

## Troubleshooting

### Instructions Not Appearing

1. Check if feature is enabled:
   ```bash
   ax debug:instructions
   ```

2. Verify turn count (reminders are periodic):
   ```typescript
   console.log(service.getTurnCount());
   ```

3. Check token budget:
   ```bash
   ax debug:instructions --tokens
   ```

### Mode Not Changing

1. Verify mode is valid:
   ```bash
   ax mode --list
   ```

2. Check current mode:
   ```bash
   ax mode --status
   ```

### Tools Not Being Filtered

1. Verify mode is set correctly
2. Check tool name matches exactly
3. Review mode configuration:
   ```bash
   ax debug:instructions --templates
   ```

---

## Migration Guide

### From v11.2.x to v11.3.0

1. No breaking changes - embedded instructions are additive
2. New CLI commands available: `ax mode`, `ax debug:instructions`
3. New configuration options in `ax.config.json`
4. All existing functionality continues to work

### Configuration Migration

Add to `ax.config.json`:

```json
{
  "orchestration": {
    "embeddedInstructions": {
      "enabled": true
    }
  }
}
```

---

## Changelog

### v11.3.0 (Current)

- Initial release of embedded instructions system
- Phase 1: Core types, token budget, todo integration
- Phase 2: Memory integration, workflow modes
- Phase 3: Agent templates, session integration
- Phase 4: CLI commands, orchestration service

---

## Support

- GitHub Issues: https://github.com/defai-digital/automatosx/issues
- Documentation: See `CLAUDE.md` for development guidelines
