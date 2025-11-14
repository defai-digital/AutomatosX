# Phase 7 Day 4: Collaboration & CLI Integration - Ultra Implementation Plan

**Objective**: Complete Phase 7 Agent System with multi-agent collaboration, intelligent task routing, and CLI integration
**Estimated Lines**: ~680 lines across 5 files
**Timeline**: Complete all components in one session

---

## **Day 4 Components**

### **1. AgentCollaborator** (~250 lines)
**Purpose**: Orchestrate multi-agent workflows for complex tasks

**Key Features**:
- Task decomposition (break complex tasks into subtasks)
- Agent selection for each subtask
- Sequential and parallel execution strategies
- Result aggregation and synthesis
- Conflict resolution when agents disagree
- Progress tracking and reporting

**Core Methods**:
```typescript
class AgentCollaborator {
  // Break task into subtasks
  async decomposeTask(task: Task, context: AgentContext): Promise<SubTask[]>

  // Select best agent for each subtask
  selectAgentForSubtask(subtask: SubTask): AgentBase | null

  // Execute workflow (sequential or parallel)
  async executeWorkflow(subtasks: SubTask[], strategy: 'sequential' | 'parallel'): Promise<WorkflowResult>

  // Aggregate results from multiple agents
  aggregateResults(results: TaskResult[]): TaskResult

  // Handle conflicts when agents disagree
  resolveConflicts(results: TaskResult[]): TaskResult
}
```

**Example Workflow**:
```
Task: "Build a complete authentication system"
→ Decompose into:
  1. Design database schema (DatabaseAgent)
  2. Create API endpoints (APIAgent)
  3. Implement security measures (SecurityAgent)
  4. Write tests (QualityAgent)
  5. Document APIs (WriterAgent)
→ Execute sequentially with dependencies
→ Aggregate results into final solution
```

---

### **2. TaskRouter** (~200 lines)
**Purpose**: Intelligent natural language task parsing and agent routing

**Key Features**:
- Intent detection from natural language
- Keyword extraction and analysis
- Agent capability matching
- Confidence scoring
- Fallback to default agent if no match
- Support for @mentions (`@backend`, `@security`)

**Core Methods**:
```typescript
class TaskRouter {
  // Parse natural language task description
  parseTask(description: string): ParsedTask

  // Detect user intent (what type of task is this?)
  detectIntent(description: string): TaskIntent

  // Extract relevant keywords
  extractKeywords(description: string): string[]

  // Route to best agent based on intent + keywords
  routeToAgent(task: Task): AgentBase | null

  // Handle explicit @mentions
  handleMention(description: string): AgentBase | null
}
```

**Intent Detection Examples**:
```
"Design a REST API" → API agent (keywords: design, REST, API)
"Optimize database queries" → Database agent (keywords: optimize, database, queries)
"Fix security vulnerabilities" → Security agent (keywords: fix, security, vulnerabilities)
"@backend implement user service" → Backend agent (explicit mention)
```

**Scoring Algorithm**:
```
score = (keyword_matches × 1.0) + (intent_match × 2.0) + (mention_match × 5.0)
threshold = 0.5
```

---

### **3. CLI Commands** (~150 lines)

#### **Command 1: `ax agent list`**
```bash
ax agent list [--type <type>] [--format <json|table>]
```
- List all available agents
- Show agent metadata (type, name, capabilities, specializations)
- Filter by type (core, specialized, leadership, etc.)
- Output formats: table (default) or JSON

#### **Command 2: `ax agent describe <type>`**
```bash
ax agent describe backend
ax agent describe security --verbose
```
- Show detailed information about specific agent
- Include capabilities, specializations, temperature
- Show example tasks the agent can handle
- With `--verbose`: show internal configuration

#### **Command 3: `ax run @<agent> "<task>"`**
```bash
ax run @backend "Create a user service"
ax run @security "Audit authentication code"
ax run @cto "Define technical roadmap"
```
- Execute task with specific agent
- Support natural language task descriptions
- Show progress and results
- Store in memory for learning

**Implementation**:
```typescript
// src/cli/commands/agent.ts
export function registerAgentCommands(program: Command) {
  program
    .command('agent')
    .description('Manage and interact with agents')
    .addCommand(listAgentsCommand())
    .addCommand(describeAgentCommand())
    .addCommand(runAgentCommand());
}
```

---

### **4. Integration Tests** (~80 lines)

**Test Scenarios**:

1. **Multi-Agent Workflow**:
   - Decompose complex task
   - Execute with multiple agents
   - Aggregate results
   - Verify all agents called correctly

2. **Task Routing**:
   - Natural language → correct agent
   - @mentions work correctly
   - Fallback to default agent
   - Confidence scoring accurate

3. **CLI Commands**:
   - `ax agent list` returns all agents
   - `ax agent describe` shows correct details
   - `ax run @agent` executes successfully

4. **End-to-End**:
   - User input → TaskRouter → Agent execution → Result
   - Memory storage works
   - Context injection correct

---

## **Implementation Order**

### **Phase 1: Core Collaboration (60 mins)**
1. Create `AgentCollaborator.ts`
   - Task decomposition logic
   - Agent selection for subtasks
   - Sequential execution
   - Parallel execution (with Promise.all)
   - Result aggregation
   - Conflict resolution

2. Create types for collaboration:
   - `SubTask` interface
   - `WorkflowResult` interface
   - `WorkflowStrategy` enum
   - `CollaborationContext` interface

### **Phase 2: Task Routing (40 mins)**
3. Create `TaskRouter.ts`
   - Intent detection (regex + keyword matching)
   - Keyword extraction
   - Agent scoring and selection
   - @mention handling
   - Fallback logic

4. Add routing utilities:
   - Intent patterns (regex for common task types)
   - Keyword weights
   - Confidence thresholds

### **Phase 3: CLI Integration (30 mins)**
5. Create `src/cli/commands/agent.ts`
   - `ax agent list` command
   - `ax agent describe` command
   - `ax run @agent` command
   - Formatting utilities (table, JSON)

6. Update `src/cli/index.ts`:
   - Register new agent commands
   - Add to help menu

### **Phase 4: Testing (20 mins)**
7. Create `src/__tests__/agents/agent-collaboration.test.ts`
   - AgentCollaborator tests
   - TaskRouter tests
   - CLI command tests
   - End-to-end integration tests

---

## **Data Flow**

### **Single Agent Execution**:
```
User Input → CLI → TaskRouter → Select Agent → Execute → Result
```

### **Multi-Agent Collaboration**:
```
User Input → CLI → AgentCollaborator → Decompose Task
                                     → Select Agents
                                     → Execute Workflow
                                     → Aggregate Results
                                     → Return Final Result
```

### **With Memory**:
```
Execute Task → Agent → Memory.store() → Future tasks recall past solutions
```

---

## **Key Design Decisions**

### **1. Task Decomposition Strategy**
- Use simple rule-based decomposition initially
- Can be enhanced with LLM-based decomposition later
- Identify dependencies between subtasks
- Support both sequential and parallel execution

### **2. Agent Selection**
- Reuse existing `canHandle()` scoring from AgentBase
- Add intent-based boosting
- Support explicit @mentions (highest priority)
- Fallback to generalist agent if no good match

### **3. Result Aggregation**
- Combine results from multiple agents
- Preserve individual agent contributions
- Handle failures gracefully (partial results OK)
- Support different aggregation strategies (concat, synthesize, vote)

### **4. CLI Design**
- Follow existing `ax` command patterns
- Use Commander.js for consistency
- Support both human-readable and machine-readable output
- Provide helpful error messages

---

## **Success Criteria**

✅ AgentCollaborator can decompose and execute multi-agent workflows
✅ TaskRouter correctly routes 80%+ of natural language inputs
✅ CLI commands work and integrate with existing `ax` tooling
✅ All integration tests pass
✅ Memory integration works across agents
✅ Documentation is clear and examples provided

---

## **Example Usage**

### **Multi-Agent Collaboration**:
```bash
ax run "Build complete authentication system with database, API, security, and tests"
# → AgentCollaborator decomposes into 5 subtasks
# → Executes: DatabaseAgent → APIAgent → SecurityAgent → QualityAgent → WriterAgent
# → Returns aggregated solution with all components
```

### **Task Routing**:
```bash
ax run "Optimize slow queries"
# → TaskRouter detects: database task
# → Routes to: DatabaseAgent
# → Executes and returns results
```

### **Explicit Agent**:
```bash
ax run @cto "Define 2025 technical strategy"
# → Routes directly to CTOAgent (mention takes precedence)
# → Executes and returns strategy document
```

---

## **File Structure**

```
src/agents/
├── AgentCollaborator.ts (250 lines)
└── TaskRouter.ts (200 lines)

src/cli/commands/
└── agent.ts (150 lines)

src/__tests__/agents/
└── agent-collaboration.test.ts (80 lines)
```

**Total**: 4 files, ~680 lines

---

## **Phase 7 Completion After Day 4**

- **Day 1**: Foundation (types, base, registry, runtime) ✅
- **Day 2**: Core 8 Agents ✅
- **Day 3**: Specialized 12 Agents ✅
- **Day 4**: Collaboration + CLI ⏳ IN PROGRESS

**Final Stats**:
- **Total Agents**: 20 (8 core + 12 specialized)
- **Total Code**: ~5,200 lines
- **Total Tests**: ~110 test cases
- **Phase 7**: 100% COMPLETE 🎉

---

Let's implement! 🚀
