# Phases 2-5: Action Plans Summary

**Project:** AutomatosX v1 to v2 Migration
**Phases:** 2 (Provider Layer), 3 (Agent System), 4 (Workflow Engine), 5 (CLI/UI Integration)
**Total Duration:** 14 weeks (December 8, 2025 - March 14, 2026)

---

## Phase 2: AI Provider Layer (3 weeks)

**Duration:** December 8 - December 28, 2025
**Goal:** Implement multi-provider abstraction with automatic fallback

### Week 1: Provider Infrastructure

**Day 1-3: Provider Base & Router**

**Files to Create:**
- `src/providers/Provider.ts` - Interface definition
- `src/providers/ProviderRouter.ts` - Router with fallback logic
- `src/types/schemas/provider.schema.ts` - Zod schemas

**Tasks:**
1. Define Provider interface
```typescript
export interface Provider {
  name: string;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterator<string>;
  checkHealth(): Promise<ProviderHealth>;
  getRateLimits(): RateLimitInfo;
}

export interface ProviderRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ProviderResponse {
  content: string;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  provider: string;
  duration: number;
}
```

2. Implement ProviderRouter
   - Primary/secondary/tertiary provider logic
   - Automatic fallback on failure
   - Health checks and circuit breakers
   - Rate limiting and quota management

3. Write 15 tests for router logic

**Day 4-5: Provider Configuration**

**Files to Create:**
- `src/providers/ProviderConfig.ts` - Configuration management
- `automatosx.providers.json` - Provider configuration file

**Tasks:**
1. Load provider configurations from file
2. Environment variable overrides
3. Validate API keys and endpoints
4. Provider priority management

**Deliverables:**
- ✅ Provider interface defined
- ✅ ProviderRouter with fallback
- ✅ Configuration management
- ✅ 15+ tests passing

---

### Week 2: Provider Implementations

**Day 6-8: Claude Provider**

**Files to Create:**
- `src/providers/ClaudeProvider.ts`
- `src/providers/__tests__/ClaudeProvider.test.ts`

**Tasks:**
1. Implement Claude API integration
   - Anthropic SDK usage
   - Message format conversion
   - Streaming support
   - Error handling

2. Features:
   - Models: claude-3-5-sonnet, claude-3-opus
   - Max tokens: 200K
   - Rate limiting: 5 req/min (tier 1)
   - Retry logic with exponential backoff

3. Write 10 tests (unit + integration)

**Day 9-10: Gemini Provider**

**Files to Create:**
- `src/providers/GeminiProvider.ts`
- `src/providers/__tests__/GeminiProvider.test.ts`

**Tasks:**
1. Implement Gemini API integration
   - Google Generative AI SDK
   - Message format conversion
   - Streaming support

2. Features:
   - Models: gemini-1.5-pro, gemini-1.5-flash
   - Max tokens: 2M
   - Rate limiting: 10 req/min
   - Safety settings

3. Write 10 tests

---

### Week 3: OpenAI & Testing

**Day 11-12: OpenAI Provider**

**Files to Create:**
- `src/providers/OpenAIProvider.ts`
- `src/providers/__tests__/OpenAIProvider.test.ts`

**Tasks:**
1. Implement OpenAI API integration
   - OpenAI SDK usage
   - Chat completions API
   - Streaming support

2. Features:
   - Models: gpt-4-turbo, gpt-4o
   - Max tokens: 128K
   - Rate limiting: 10 req/min
   - Function calling support

3. Write 10 tests

**Day 13-15: Integration & Performance Testing**

**Files to Create:**
- `src/providers/__tests__/provider-integration.test.ts`
- `src/providers/__tests__/provider-fallback.test.ts`
- `automatosx/PRD/provider-performance-report.md`

**Tasks:**
1. Write integration tests (10 tests)
   - Provider fallback scenarios
   - Circuit breaker behavior
   - Rate limiting enforcement

2. Performance testing
   - Measure latency (target <2s for first token)
   - Test streaming performance
   - Load testing with concurrent requests

3. Documentation
   - API reference for each provider
   - Configuration guide
   - Troubleshooting guide

**Phase 2 Deliverables:**
- ✅ 3 provider implementations (Claude, Gemini, OpenAI)
- ✅ ProviderRouter with automatic fallback
- ✅ 40+ tests passing
- ✅ Complete documentation
- ✅ Performance benchmarks met

---

## Phase 3: Agent System (5 weeks)

**Duration:** December 29, 2025 - February 1, 2026
**Goal:** Migrate 20 specialized agents with code intelligence integration

### Week 1: Agent Infrastructure

**Day 1-3: Agent Base Classes**

**Files to Create:**
- `src/agents/Agent.ts` - Base agent class
- `src/agents/AgentRegistry.ts` - Agent registry and factory
- `src/agents/AgentRuntime.ts` - Task execution runtime
- `src/types/schemas/agent.schema.ts` - Zod schemas

**Tasks:**
1. Define Agent base class
```typescript
export abstract class Agent {
  abstract id: string;
  abstract name: string;
  abstract category: AgentCategory;
  abstract capabilities: string[];
  abstract systemPrompt: string;

  // Code intelligence integration
  protected fileService: FileService;
  protected queryRouter: QueryRouter;

  async executeTask(task: Task): Promise<TaskResult> {
    // Validate task
    // Execute with provider
    // Use code intelligence if needed
    // Return result
  }

  protected async analyzeCode(query: string): Promise<CodeAnalysisResult> {
    return this.fileService.search(query);
  }

  protected async findSymbol(symbol: string): Promise<SymbolInfo[]> {
    return this.queryRouter.findDefinitions(symbol);
  }
}
```

2. Implement AgentRegistry
   - Load agent manifests
   - Agent factory pattern
   - Agent lifecycle management

3. Implement AgentRuntime
   - Task execution with provider
   - Progress tracking
   - Error handling and retries

4. Write 20 tests

**Day 4-5: Tool System**

**Files to Create:**
- `src/agents/tools/Tool.ts` - Tool interface
- `src/agents/tools/BashTool.ts` - Execute bash commands
- `src/agents/tools/FileTool.ts` - File read/write operations
- `src/agents/tools/WebTool.ts` - Web fetch operations
- `src/agents/tools/CodeTool.ts` - Code analysis operations

**Tasks:**
1. Define Tool interface
2. Implement 4 core tools
3. Tool execution sandboxing
4. Tool result validation
5. Write 15 tests

**Deliverables:**
- ✅ Agent base classes
- ✅ AgentRegistry and AgentRuntime
- ✅ Tool system with 4 tools
- ✅ 35+ tests passing

---

### Week 2: Core Agents (Part 1)

**Day 6-10: Implement 8 Agents**

**Agents to Implement:**
1. **backend** (Bob) - Backend development
2. **frontend** (Frank) - Frontend development
3. **fullstack** (Felix) - Full-stack development
4. **devops** (Oliver) - DevOps and infrastructure
5. **security** (Steve) - Security auditing
6. **quality** (Queenie) - QA and testing
7. **data** (Daisy) - Data engineering
8. **mobile** (Maya) - Mobile development

**Files to Create (per agent):**
- `src/agents/implementations/BackendAgent.ts`
- `src/agents/manifests/backend.json`
- `src/agents/__tests__/BackendAgent.test.ts`

**Tasks (per agent):**
1. Create agent class extending Agent base
2. Define system prompt and capabilities
3. Implement task execution logic
4. Integrate with code intelligence APIs
5. Write 3 tests per agent (24 tests total)

**Agent Manifest Example:**
```json
{
  "id": "backend",
  "name": "Bob the Backend Agent",
  "category": "development",
  "capabilities": [
    "api-development",
    "database-design",
    "backend-architecture",
    "performance-optimization"
  ],
  "systemPrompt": "You are Bob, an expert backend developer...",
  "tools": ["bash", "file", "code"],
  "languages": ["typescript", "go", "rust", "python"],
  "priority": 50,
  "enabled": true
}
```

---

### Week 3: Core Agents (Part 2)

**Day 11-15: Implement 8 More Agents**

**Agents to Implement:**
9. **design** (Debbee) - UX/UI design
10. **writer** (Wendy) - Technical writing
11. **product** (Paris) - Product management
12. **cto** (Tony) - Technical strategy
13. **ceo** (Eric) - Business leadership
14. **researcher** (Rodman) - Research and analysis
15. **data-scientist** (Dana) - ML and data science
16. **architecture** (Avery) - System architecture

**Tasks:**
- Same as Week 2
- 24 more tests

---

### Week 4: Specialized Agents & Integration

**Day 16-18: Implement Final 4 Agents**

**Agents to Implement:**
17. **aerospace-scientist** (Astrid) - Aerospace engineering
18. **quantum-engineer** (Quinn) - Quantum computing
19. **creative-marketer** (Candy) - Marketing and content
20. **standard** (Stan) - Standards and best practices

**Tasks:**
- Implement 4 specialized agents
- 12 tests

**Day 19-20: Agent-to-Agent Communication**

**Files to Create:**
- `src/agents/AgentMessaging.ts` - Inter-agent communication
- `src/agents/__tests__/agent-delegation.test.ts`

**Tasks:**
1. Implement task delegation
2. Agent collaboration protocols
3. Message passing between agents
4. Write 10 tests

**Phase 3 Deliverables:**
- ✅ 20 agents implemented
- ✅ Tool system working
- ✅ Agent-to-agent communication
- ✅ 60+ tests passing
- ✅ All agents can use code intelligence

---

### Week 5: Testing & Documentation

**Day 21-25: Comprehensive Testing & Docs**

**Tasks:**
1. Integration testing (15 tests)
   - Multi-agent scenarios
   - Code intelligence integration
   - Tool execution

2. Performance testing
   - Agent task initiation <2s
   - Tool execution latency
   - Memory usage

3. Documentation
   - Agent capabilities reference
   - Usage examples for each agent
   - Best practices guide

**Phase 3 Deliverables:**
- ✅ 95+ tests passing
- ✅ Performance targets met
- ✅ Complete agent documentation

---

## Phase 4: Workflow Engine (4 weeks)

**Duration:** February 2 - February 28, 2026
**Goal:** Implement task planning, delegation, and orchestration

### Week 1: Workflow Foundation

**Day 1-3: Workflow Definition & Parser**

**Files to Create:**
- `src/workflows/Workflow.ts` - Workflow data model
- `src/workflows/WorkflowParser.ts` - Parse YAML workflow definitions
- `src/workflows/WorkflowValidator.ts` - Validate workflow structure
- `src/types/schemas/workflow.schema.ts` - Zod schemas

**Tasks:**
1. Define workflow YAML format
```yaml
name: "Implement Authentication Feature"
description: "Multi-agent workflow for auth implementation"

tasks:
  - id: design
    agent: product
    description: "Design authentication system architecture"
    dependencies: []

  - id: implement_backend
    agent: backend
    description: "Implement authentication API"
    dependencies: [design]

  - id: implement_frontend
    agent: frontend
    description: "Create login UI components"
    dependencies: [design]

  - id: security_audit
    agent: security
    description: "Audit authentication implementation"
    dependencies: [implement_backend, implement_frontend]

  - id: write_tests
    agent: quality
    description: "Write integration tests"
    dependencies: [implement_backend, implement_frontend]

  - id: documentation
    agent: writer
    description: "Document authentication flow"
    dependencies: [security_audit, write_tests]
```

2. Implement parser and validator
3. Dependency resolution (topological sort)
4. Write 15 tests

**Day 4-5: Task Planner**

**Files to Create:**
- `src/workflows/TaskPlanner.ts` - Task planning and scheduling
- `src/workflows/DependencyResolver.ts` - Resolve task dependencies

**Tasks:**
1. Implement dependency resolver
2. Identify parallel execution opportunities
3. Task scheduling algorithm
4. Write 10 tests

**Deliverables:**
- ✅ Workflow parser and validator
- ✅ Task planner with dependency resolution
- ✅ 25+ tests passing

---

### Week 2: Workflow Execution

**Day 6-8: Workflow Engine Core**

**Files to Create:**
- `src/workflows/WorkflowEngine.ts` - Main execution engine
- `src/workflows/WorkflowExecutor.ts` - Task execution coordinator

**Tasks:**
1. Implement workflow execution
```typescript
export class WorkflowEngine {
  async createWorkflow(definition: WorkflowDefinition): Promise<Workflow> {
    // Parse and validate
    // Create workflow instance
    // Save to database
  }

  async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    // Load workflow
    // Resolve dependencies
    // Execute tasks in order
    // Handle parallel execution
    // Collect results
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    // Save current state
    // Pause running tasks
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    // Load saved state
    // Resume from checkpoint
  }
}
```

2. Implement task execution coordination
3. Progress tracking
4. Write 15 tests

**Day 9-10: Parallel Execution**

**Files to Create:**
- `src/workflows/ParallelExecutor.ts` - Execute tasks in parallel

**Tasks:**
1. Identify parallelizable tasks
2. Worker pool integration
3. Resource management
4. Write 10 tests

**Deliverables:**
- ✅ Workflow engine with execution
- ✅ Parallel execution support
- ✅ 25+ tests passing

---

### Week 3: Advanced Features

**Day 11-13: Workflow State Management**

**Files to Create:**
- `src/workflows/WorkflowState.ts` - State machine for workflows
- `src/workflows/WorkflowCheckpoint.ts` - Checkpoint/resume functionality
- `src/workflows/WorkflowDAO.ts` - Workflow persistence

**Tasks:**
1. Implement workflow state machine
2. Checkpoint/resume system
3. Workflow persistence to database
4. Write 15 tests

**Day 14-15: Error Handling & Retries**

**Files to Create:**
- `src/workflows/WorkflowErrorHandler.ts` - Error handling strategies
- `src/workflows/WorkflowRetry.ts` - Retry logic

**Tasks:**
1. Task failure handling
2. Automatic retries with backoff
3. Workflow rollback on critical failures
4. Write 10 tests

**Deliverables:**
- ✅ State management and checkpointing
- ✅ Error handling and retries
- ✅ 25+ tests passing

---

### Week 4: Integration & Testing

**Day 16-18: Web UI Integration**

**Files to Create:**
- `src/web/pages/WorkflowDashboard.tsx` - Workflow dashboard
- `src/web/components/WorkflowGraph.tsx` - Visual workflow graph
- `src/web/components/TaskProgress.tsx` - Task progress tracking

**Tasks:**
1. Create workflow dashboard page
2. Visualize workflow graph with D3.js
3. Real-time progress updates
4. Workflow controls (pause/resume/cancel)

**Day 19-20: End-to-End Testing**

**Files to Create:**
- `src/workflows/__tests__/workflow-e2e.test.ts`

**Tasks:**
1. E2E workflow tests (10 tests)
2. Multi-agent workflow scenarios
3. Error recovery testing
4. Performance benchmarks

5. Documentation
   - Workflow creation guide
   - YAML reference
   - Best practices

**Phase 4 Deliverables:**
- ✅ Workflow engine complete
- ✅ Parallel execution working
- ✅ Checkpoint/resume functional
- ✅ Web UI integration
- ✅ 75+ tests passing
- ✅ Complete documentation

---

## Phase 5: CLI and UI Integration (2 weeks)

**Duration:** March 1 - March 14, 2026
**Goal:** Unify CLI commands and Web UI for seamless UX

### Week 1: CLI Unification

**Day 1-2: Unified CLI Structure**

**Files to Modify:**
- `src/cli/index.ts` - Main CLI entry point

**Tasks:**
1. Reorganize CLI commands
```bash
# Unified command structure
ax <domain> <action> [options]

# Code Intelligence
ax code find "Calculator"
ax code def "getUserById"
ax code flow "processPayment"
ax code analyze quality

# Agents
ax agent list
ax agent run backend "implement auth"
ax agent chat backend

# Memory
ax memory search "authentication"
ax memory list
ax memory show <id>

# Workflows
ax workflow create --spec auth-workflow.yaml
ax workflow run <id>
ax workflow status <id>

# System
ax status --verbose
ax config show
```

2. Implement command routing
3. Consistent help documentation
4. Write 10 tests

**Day 3-4: Agent CLI Commands**

**Files to Create:**
- `src/cli/commands/agent.ts`

**Tasks:**
1. `ax agent list` - List all agents
2. `ax agent run` - Execute agent task
3. `ax agent chat` - Interactive chat
4. `ax agent status` - Show agent activity
5. Write 10 tests

**Day 5: Workflow CLI Commands**

**Files to Create:**
- `src/cli/commands/workflow.ts`

**Tasks:**
1. Workflow commands implementation
2. YAML file validation
3. Progress display
4. Write 5 tests

**Deliverables:**
- ✅ Unified CLI structure
- ✅ All agent commands working
- ✅ All workflow commands working
- ✅ 25+ CLI tests passing

---

### Week 2: Web UI & Final Integration

**Day 6-8: Web UI Agent Dashboard**

**Files to Create:**
- `src/web/pages/AgentDashboard.tsx`
- `src/web/components/AgentList.tsx`
- `src/web/components/AgentActivity.tsx`
- `src/web/components/ConversationViewer.tsx`

**Tasks:**
1. Agent dashboard page
2. Real-time agent activity feed
3. Conversation history viewer
4. Agent execution controls

**Day 9: LSP Integration**

**Files to Create:**
- `src/lsp/providers/AgentCodeActionProvider.ts`
- `src/lsp/providers/AgentCompletionProvider.ts`

**Tasks:**
1. Agent-powered code actions
   - "Ask agent to implement this function"
   - "Get agent security review"
2. Agent completion suggestions
3. Write 5 tests

**Day 10: End-to-End Testing**

**Tasks:**
1. Full system E2E tests (15 tests)
   - CLI → Agent → Code Intelligence → Result
   - Web UI → Workflow → Multi-agent → Completion
   - LSP → Agent suggestion → Code generation

2. Performance testing
   - System-wide latency measurements
   - Memory usage profiling
   - Load testing

3. User acceptance testing
   - Test all user workflows
   - Collect feedback
   - Fix critical issues

**Phase 5 Deliverables:**
- ✅ Unified CLI with all commands
- ✅ Web UI with agent + workflow dashboards
- ✅ LSP with agent integration
- ✅ 45+ tests passing
- ✅ E2E tests covering all workflows

---

## Overall Migration Completion

**Total Duration:** 18 weeks (November 10, 2025 - March 14, 2026)

### Final Test Count

| Component | Tests |
|-----------|-------|
| Phase 1: Memory System | 30 |
| Phase 2: Provider Layer | 40 |
| Phase 3: Agent System | 95 |
| Phase 4: Workflow Engine | 75 |
| Phase 5: CLI/UI Integration | 45 |
| **New Tests Total** | **285** |
| **Existing v2 Tests** | **245** |
| **Grand Total** | **530+** |

### Final Deliverables

1. **Code:**
   - 20 functional AI agents
   - 3 AI providers with fallback
   - Complete memory system
   - Workflow engine
   - Unified CLI
   - Integrated Web UI
   - LSP with agent features

2. **Tests:**
   - 530+ tests passing (100%)
   - 85%+ code coverage
   - E2E tests covering all workflows

3. **Documentation:**
   - Master PRD
   - Phase action plans (5)
   - API reference docs
   - User guides
   - Developer guides
   - Migration guide

4. **Performance:**
   - Agent task initiation <2s
   - Memory search <5ms
   - Code intelligence <5ms
   - Workflow initiation <3s

### Success Criteria (Final Check)

- [ ] All 5 phases complete
- [ ] 530+ tests passing (100%)
- [ ] Zero P0/P1 bugs
- [ ] Complete documentation
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing complete
- [ ] Production deployment ready

---

**Next Steps After Completion:**

1. Production deployment
2. User onboarding and training
3. Monitor system performance
4. Collect user feedback
5. Plan P2 enhancements (optional)

---

**Document Version:** 1.0
**Last Updated:** November 10, 2025
**Status:** APPROVED - Ready for Execution
