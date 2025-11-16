# Week 2 Implementation Plan - Phase 2: Agent Execution System

**Date**: 2025-11-15
**Phase**: Phase 2 (Agent Execution System)
**Estimated Effort**: 16-23 hours
**Target**: 5 working days

---

## 🎯 Objective

Restore v7.6.1 agent execution capabilities to v8.x:
- ✅ Load YAML agent profiles
- ✅ Load and inject abilities (markdown files)
- ✅ Execute agents with tasks via `ax run <agent> <task>`
- ✅ Support team-based configuration
- ✅ Integrate with v8.x provider system

---

## 📋 Phase 2 Breakdown

### Phase 2.1: Agent Infrastructure (6-8 hours)

**Goal**: Build core agent system modules

**Tasks**:
1. ✅ Extract agent modules from v7.6.1 (2h)
2. ✅ Update imports for v8.x compatibility (2h)
3. ✅ Implement ProfileLoader (2-3h)
4. ✅ Implement AbilitiesManager (1.5-2h)

**Deliverables**:
- `src/agents/ProfileLoader.ts` - Load YAML agent profiles
- `src/agents/AbilitiesManager.ts` - Load markdown abilities
- `src/agents/AgentExecutor.ts` - Execute agent with task
- `src/agents/ContextManager.ts` - Build execution context

---

### Phase 2.2: Agent Execution (4-6 hours)

**Goal**: Wire up execution engine and CLI command

**Tasks**:
1. ✅ Implement AgentExecutor (2-3h)
2. ✅ Extract and convert run.ts command (2h)
3. ✅ Register run command in CLI (1h)

**Deliverables**:
- `src/cli/commands/run.ts` - `ax run` command
- Agent execution working end-to-end

---

### Phase 2.3: Supporting Infrastructure (3-5 hours)

**Goal**: Add team management and context handling

**Tasks**:
1. ✅ Implement ContextManager (1.5-2h)
2. ✅ Extract and update TeamManager (1h)
3. ✅ Implement agent listing command (1-2h)

**Deliverables**:
- `src/core/TeamManager.ts` - Load team configs
- `ax list agents` command working
- Team inheritance working

---

### Phase 2.4: Testing & Refinement (3-4 hours)

**Goal**: Ensure all 21 agents work correctly

**Tasks**:
1. ✅ Write unit tests (2h)
2. ✅ Test all 21 agents (1h)
3. ✅ Fix any issues discovered (1h)

**Deliverables**:
- ≥85% test coverage
- All 21 agents execute successfully
- Documentation updated

---

## 🚀 Implementation Strategy

### Day 1: Agent Infrastructure Foundation (6 hours)

**Morning (3 hours)**:
- Extract agent modules from v7.6.1
- Create `src/agents/` directory structure
- Copy 4 core files (profile-loader, abilities-manager, executor, context-manager)

**Afternoon (3 hours)**:
- Update imports for v8.x
- Fix TypeScript compilation errors
- Implement ProfileLoader with YAML parsing

**Deliverables**:
- `src/agents/ProfileLoader.ts` compiling
- Can load agent YAML files
- Basic validation working

---

### Day 2: Abilities & Execution (6 hours)

**Morning (3 hours)**:
- Implement AbilitiesManager
- Load markdown abilities
- Implement ability selection logic

**Afternoon (3 hours)**:
- Implement AgentExecutor
- Wire up provider integration
- Test basic agent execution

**Deliverables**:
- `src/agents/AbilitiesManager.ts` complete
- `src/agents/AgentExecutor.ts` complete
- Can execute simple agent task

---

### Day 3: Run Command & CLI (5 hours)

**Morning (3 hours)**:
- Extract run.ts from v7.6.1
- Convert to Commander.js
- Wire up AgentExecutor

**Afternoon (2 hours)**:
- Register run command in CLI
- Test `ax run backend "hello world"`
- Fix any integration issues

**Deliverables**:
- `src/cli/commands/run.ts` working
- `ax run` command functional
- Basic agent execution working

---

### Day 4: Teams & Context (4 hours)

**Morning (2 hours)**:
- Implement ContextManager
- Extract TeamManager from v7.6.1
- Update imports

**Afternoon (2 hours)**:
- Implement team inheritance
- Test team-based provider fallback
- Implement `ax list agents` command

**Deliverables**:
- `src/core/TeamManager.ts` working
- Team inheritance functional
- `ax list agents` shows all 21 agents

---

### Day 5: Testing & Polish (2 hours)

**Morning (1 hour)**:
- Write unit tests for all modules
- Test all 21 agents
- Document any issues

**Afternoon (1 hour)**:
- Fix discovered issues
- Update documentation
- Prepare for Phase 3

**Deliverables**:
- All tests passing
- All 21 agents working
- Documentation updated

---

## 📊 Technical Architecture

### Module Dependencies

```
CLI Layer:
  src/cli/commands/run.ts
    ↓
Agent Execution Layer:
  src/agents/AgentExecutor.ts
    ↓
  src/agents/ProfileLoader.ts ← loads YAML
  src/agents/AbilitiesManager.ts ← loads markdown
  src/agents/ContextManager.ts ← builds context
    ↓
Core Infrastructure:
  src/core/TeamManager.ts ← team configs
    ↓
Provider Layer:
  src/services/ProviderRouterV2.ts ← v8.x provider system
    ↓
Providers:
  src/providers/ClaudeProvider.ts
  src/providers/GeminiProvider.ts
  src/providers/OpenAIProvider.ts
```

---

## 🔧 Key Implementation Details

### 1. ProfileLoader

**File**: `src/agents/ProfileLoader.ts`

**Responsibilities**:
- Load YAML agent profiles from `.automatosx/agents/*.yaml`
- Validate profile schema
- List available agents
- Resolve agent paths

**Key Methods**:
```typescript
class ProfileLoader {
  async loadProfile(agentName: string): Promise<AgentProfile>
  async listAgents(): Promise<string[]>
  private validateProfile(profile: unknown): asserts profile is AgentProfile
  private resolveProfilePath(agentName: string): string
}
```

**Dependencies**:
- `yaml` - YAML parsing
- `fs/promises` - File I/O
- `path` - Path resolution
- Zod schemas for validation

---

### 2. AbilitiesManager

**File**: `src/agents/AbilitiesManager.ts`

**Responsibilities**:
- Load markdown ability files from `.automatosx/abilities/*.md`
- Select relevant abilities for task (keyword matching)
- Inject abilities into system prompt
- Handle missing abilities gracefully

**Key Methods**:
```typescript
class AbilitiesManager {
  async loadAbilities(abilityRefs: string[]): Promise<string[]>
  async loadAbility(abilityName: string): Promise<string>
  selectAbilitiesForTask(task: string, available: string[]): string[]
  formatAbilitiesForPrompt(abilities: string[]): string
}
```

**Ability Selection Logic**:
```typescript
// From agent YAML:
abilitySelection:
  core: [api-design, code-generation]  // Always loaded
  taskBased:
    api: [api-design, service-resilience]
    database: [db-modeling]
    performance: [performance-analysis, caching-strategy]

// Task: "optimize database queries"
// → Loads: core abilities + database abilities
// → api-design, code-generation, db-modeling
```

---

### 3. AgentExecutor

**File**: `src/agents/AgentExecutor.ts`

**Responsibilities**:
- Coordinate agent execution flow
- Load profile + abilities + team config
- Build final system prompt
- Call provider with task
- Return formatted result

**Execution Flow**:
```
1. Load agent profile (ProfileLoader)
2. Load team config if specified (TeamManager)
3. Merge profile with team (provider fallback, shared abilities)
4. Load abilities (AbilitiesManager)
5. Select task-specific abilities
6. Build context (ContextManager)
7. Construct system prompt (profile + abilities + context)
8. Select provider (from profile or team)
9. Execute via ProviderRouter
10. Format and return result
```

**Key Methods**:
```typescript
class AgentExecutor {
  async execute(
    agentName: string,
    task: string,
    options: ExecuteOptions
  ): Promise<ExecutionResult>

  private async buildSystemPrompt(
    profile: AgentProfile,
    abilities: string[],
    context: Context
  ): Promise<string>

  private async selectProvider(
    profile: AgentProfile,
    options: ExecuteOptions
  ): Promise<string>
}
```

---

### 4. ContextManager

**File**: `src/agents/ContextManager.ts`

**Responsibilities**:
- Build execution context from task and environment
- Load relevant memory (if requested)
- Load session context (Phase 3)
- Provide workspace information

**Context Structure**:
```typescript
interface Context {
  task: string;
  timestamp: Date;
  cwd: string;
  environment: 'development' | 'production';
  memory?: MemoryEntry[];
  session?: SessionContext;
  workspace?: WorkspaceInfo;
}
```

---

### 5. TeamManager

**File**: `src/core/TeamManager.ts`

**Responsibilities**:
- Load team YAML configurations
- Merge agent profile with team config
- Handle provider fallback chains
- Manage shared abilities

**Team Config Structure** (from YAML):
```yaml
name: engineering
displayName: "Engineering Team"

provider:
  primary: codex
  fallback: gemini
  fallbackChain: [codex, gemini, claude]

sharedAbilities:
  - our-coding-standards
  - our-project-structure

capabilities:
  canDo: [...]
  shouldDelegate: [...]
```

**Merge Logic**:
```typescript
// Agent backend.yaml:
{ team: 'engineering', abilities: ['code-generation'] }

// Team engineering.yaml:
{ sharedAbilities: ['our-coding-standards'] }

// Result after merge:
{
  abilities: ['code-generation', 'our-coding-standards'],
  providers: { default: 'codex', fallback: ['gemini', 'claude'] }
}
```

---

### 6. Run Command

**File**: `src/cli/commands/run.ts`

**Commander.js Pattern**:
```typescript
export function createRunCommand(): Command {
  return new Command('run')
    .description('Run an agent with a specific task')
    .argument('<agent>', 'Agent name (e.g., backend, frontend)')
    .argument('<task>', 'Task to perform')
    .option('-p, --provider <name>', 'Override provider (claude, gemini, openai)')
    .option('-m, --model <model>', 'Override model')
    .option('--memory', 'Use memory/RAG for context')
    .option('-v, --verbose', 'Verbose output')
    .option('-f, --format <format>', 'Output format (text, json, markdown)', 'text')
    .option('-s, --save <file>', 'Save output to file')
    .action(runHandler);
}

async function runHandler(
  agentName: string,
  task: string,
  options: RunOptions
): Promise<void> {
  // Initialize components
  const profileLoader = new ProfileLoader();
  const abilitiesManager = new AbilitiesManager();
  const contextManager = new ContextManager();
  const teamManager = new TeamManager();

  const executor = new AgentExecutor(
    profileLoader,
    abilitiesManager,
    contextManager,
    teamManager
  );

  // Execute
  const result = await executor.execute(agentName, task, options);

  // Display
  console.log(formatOutput(result, options.format));

  // Save if requested
  if (options.save) {
    await fs.writeFile(options.save, result.output);
  }
}
```

---

## 📝 Type Definitions

### AgentProfile (from YAML)

```typescript
interface AgentProfile {
  name: string;
  displayName?: string;
  team?: string;
  role: string;
  description: string;

  abilities: string[];
  abilitySelection?: {
    core: string[];
    taskBased: Record<string, string[]>;
  };

  providers?: {
    default: string;
    fallback?: string[];
  };

  orchestration?: {
    maxDelegationDepth: number;
    canReadWorkspaces: string[];
    canWriteToShared: boolean;
  };

  systemPrompt: string;

  // Optional
  temperature?: number;
  maxTokens?: number;
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  agent: string;
  task: string;
  output: string;
  provider: string;
  model?: string;
  timestamp: Date;
  duration: number;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  metadata?: Record<string, unknown>;
}
```

---

## 🧪 Testing Strategy

### Unit Tests

**ProfileLoader Tests**:
```typescript
describe('ProfileLoader', () => {
  it('should load backend agent profile');
  it('should list all 21 agents');
  it('should validate profile schema');
  it('should throw on missing agent');
});
```

**AbilitiesManager Tests**:
```typescript
describe('AbilitiesManager', () => {
  it('should load ability markdown file');
  it('should load multiple abilities');
  it('should select abilities based on task keywords');
  it('should handle missing abilities gracefully');
});
```

**AgentExecutor Tests**:
```typescript
describe('AgentExecutor', () => {
  it('should execute agent with task');
  it('should inject abilities into prompt');
  it('should use provider from profile');
  it('should use provider from team fallback');
  it('should merge team shared abilities');
});
```

### Integration Tests

**Test All 21 Agents**:
```bash
# Engineering team
ax run backend "hello world"
ax run frontend "hello world"
ax run fullstack "hello world"
ax run devops "hello world"
ax run mobile "hello world"
ax run data "hello world"

# Design team
ax run design "hello world"
ax run product "hello world"
ax run writer "hello world"

# Core team
ax run architecture "hello world"
ax run security "hello world"
ax run quality "hello world"

# Business team
ax run ceo "hello world"
ax run cto "hello world"
ax run creative-marketer "hello world"

# Research team
ax run researcher "hello world"
ax run data-scientist "hello world"
ax run aerospace-scientist "hello world"
ax run quantum-engineer "hello world"

# Other
ax run standard "hello world"
```

**Expected**: All agents should execute without errors

---

## 🚨 Known Challenges

### Challenge 1: Provider Integration

**Issue**: v7.6.1 providers vs v8.x ProviderRouterV2

**Solution**:
- Use v8.x ProviderRouterV2 for all provider calls
- Map v7.6.1 provider names to v8.x equivalents
- Respect provider fallback chains from team configs

### Challenge 2: Ability Loading Performance

**Issue**: Loading 60+ markdown files may be slow

**Solution**:
- Cache loaded abilities in memory
- Only load abilities needed for specific task
- Lazy load on first use

### Challenge 3: YAML Schema Validation

**Issue**: Need robust validation for agent profiles

**Solution**:
- Create Zod schemas for AgentProfile, TeamConfig
- Validate on load, provide helpful error messages
- Support both v7.6.1 and potential v8.x schema extensions

---

## 📊 Success Criteria

### Must Have (Phase 2 Complete):
- [x] ProfileLoader loads all 21 agent YAML files
- [x] AbilitiesManager loads markdown abilities
- [x] AgentExecutor executes agents with tasks
- [x] `ax run <agent> <task>` command works
- [x] Team inheritance working (shared abilities, provider fallback)
- [x] All 21 agents execute successfully
- [x] Tests passing (≥85% coverage)

### Nice to Have:
- [ ] `ax list agents` with detailed info
- [ ] Ability selection optimization (ML-based)
- [ ] Performance profiling
- [ ] Memory integration (RAG)

---

## 📅 Timeline

| Day | Focus | Hours | Deliverable |
|-----|-------|-------|-------------|
| Day 1 | Agent Infrastructure | 6h | ProfileLoader, AbilitiesManager |
| Day 2 | Execution Engine | 6h | AgentExecutor working |
| Day 3 | Run Command | 5h | `ax run` command functional |
| Day 4 | Teams & Context | 4h | TeamManager, ContextManager |
| Day 5 | Testing & Polish | 2h | All tests passing |
| **Total** | | **23h** | **Phase 2 Complete** |

---

## 🎯 Ready to Start

**Prerequisites** ✅:
- Phase 1 complete (setup command working)
- Examples directory extracted (113 files)
- v8.x provider system functional
- Commander.js conversion pattern established

**Next Step**: Begin Day 1 - Extract agent modules from v7.6.1

---

**Plan Created**: 2025-11-15
**Ready for Implementation**: YES ✅
**Confidence Level**: HIGH
