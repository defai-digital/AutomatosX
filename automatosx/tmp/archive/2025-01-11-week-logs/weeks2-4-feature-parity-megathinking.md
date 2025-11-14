# AutomatosX v8.0.0 - Weeks 2-4 Feature Parity Megathinking Analysis

**Date:** 2025-11-12
**Status:** Comprehensive Strategic Analysis
**Scope:** Week 2 (Interactive CLI Completion) + Weeks 3-4 (Spec-Kit Auto-Generation)
**Timeline:** 15 working days
**Objective:** Achieve v7.6.1 Feature Parity (P0 Critical Gaps)

---

## 🧠 Executive Megathinking: Strategic Context

### The Parity Paradox

**Current Reality:**
- v8.0.0 has **superior technical foundations**: 45-language parsing, SQLite FTS5, 21 agents, multi-provider
- v8.0.0 has **inferior user experience**: Expert-only CLI, manual YAML authoring, no conversational interface
- v7.6.1 had **better UX accessibility** despite simpler architecture

**Strategic Imperative:**
Close the 4 critical UX gaps (P0/P1) to make v8.0.0 accessible to non-expert users while maintaining technical superiority.

```
v7.6.1: Great UX + Simple Architecture = Accessible to 95% of users
v8.0.0 Today: Poor UX + Advanced Architecture = Accessible to 5% of users
v8.0.0 Target: Great UX + Advanced Architecture = Accessible to 100% of users
```

### The Week 1 Foundation

**Current Implementation Status (from Sprint 2):**

✅ **Interactive CLI Foundation Complete:**
- REPLSession.ts (200 LOC) - Readline interface, input routing, autocomplete
- SlashCommandRegistry.ts (300 LOC) - Command registration and execution
- 13 Slash Commands (~1,100 LOC) - All commands implemented
- ConversationContext.ts (200 LOC) - Context state management
- StreamingHandler.ts (150 LOC) - Token streaming with ora spinners

✅ **Integration Complete:**
- CLI entry point (`ax cli` command)
- Database persistence (ConversationDAO, MessageDAO)
- Provider routing (ProviderRouterV2)
- Agent integration (AgentRegistry)

✅ **Testing & Documentation:**
- 40+ unit tests passing
- User guide complete (960 lines)
- All slash commands functional

❌ **Missing for Week 2:**
- NaturalLanguageRouter (intent classification and routing)
- Integration testing (end-to-end REPL flows)
- Performance optimization (streaming enhancements)
- Final documentation polish

❌ **Missing for Weeks 3-4:**
- All 5 Spec-Kit generators (0/5 implemented)
- CLI commands for generators (0/5 implemented)
- Integration testing for generation pipeline
- Documentation for Spec-Kit

### Philosophical Analysis: Three Layers of Accessibility

**Layer 0: Expert CLI (Complete)**
```
ax workflow run security-audit.yaml --config config.json
```
- Target: Expert users
- Barrier: Exact syntax, parameter knowledge
- Coverage: 5% of potential users

**Layer 1: Interactive CLI (Week 1 Foundation Complete, Week 2 Completes)**
```
ax cli
> /agent SecurityAgent
> how do I secure my API endpoints?
```
- Target: Intermediate users
- Barrier: Understanding slash commands
- Coverage: 30% of potential users

**Layer 2: Spec-Kit Auto-Generation (Weeks 3-4)**
```
ax spec create "run comprehensive security audit with CVE scanning"
→ Generates workflow.yaml automatically
ax gen plan workflow.yaml
→ Shows execution plan with costs
```
- Target: All users
- Barrier: None (natural language)
- Coverage: 95% of potential users

**Key Insight:** Each layer builds on the previous. Without Layer 1, Layer 2 has no conversational foundation. Without Layer 2, users still need YAML expertise.

---

## 🔍 Deep Dive: What We Have vs What We Need

### Week 2: Interactive CLI - Gap Analysis

**✅ Completed Components:**

1. **REPLSession** - Core REPL engine with readline
   - Input routing (slash commands vs natural language)
   - Autocomplete for commands
   - Session lifecycle management
   - **Status:** Production ready

2. **SlashCommandRegistry** - Command management
   - Registration with conflict detection
   - Alias support
   - Execution delegation
   - **Status:** Production ready

3. **13 Slash Commands** - All commands implemented
   - `/help`, `/agents`, `/agent`, `/memory`, `/workflow`
   - `/context`, `/clear`, `/history`, `/save`, `/load`
   - `/config`, `/status`, `/exit`
   - **Status:** Production ready

4. **ConversationContext** - State management
   - In-memory message storage
   - SQLite persistence (auto-save every 5 messages)
   - Agent/workflow state tracking
   - Context variables
   - Snapshot/restore
   - **Status:** Production ready

5. **StreamingHandler** - Visual feedback
   - ora spinners with "Thinking..."
   - Progress indicators
   - Success/error states
   - **Status:** Basic implementation, needs enhancement

**❌ Missing Components (Week 2 Scope):**

#### 1. **NaturalLanguageRouter** (`src/cli/interactive/NaturalLanguageRouter.ts`)

**Purpose:** Route natural language input to appropriate AutomatosX system

**Why Critical:** Without this, users can only use slash commands. This is the bridge between conversational input and system capabilities.

**Architecture:**
```typescript
export class NaturalLanguageRouter {
  constructor(
    private memoryService: MemoryService,
    private workflowEngine: WorkflowEngineV2,
    private agentRuntime: AgentRuntime,
    private providerRouter: ProviderRouterV2
  ) {}

  async route(input: string, context: ConversationContext): Promise<RouteResult> {
    // 1. Classify intent (fast pattern matching first)
    const intent = this.classifyIntent(input);

    // 2. Route to appropriate system
    switch (intent.type) {
      case 'memory-search':
        return this.routeToMemoryService(input, intent);
      case 'workflow-execute':
        return this.routeToWorkflowEngine(input, intent);
      case 'agent-delegate':
        return this.routeToAgentRuntime(input, intent);
      case 'chat':
      default:
        return this.routeToProviderRouter(input, context);
    }
  }

  private classifyIntent(input: string): Intent {
    // Pattern matching (fast path, 80% coverage, <100ms)
    const patterns = {
      'memory-search': /\b(find|search|show|get|locate)\b.*\b(code|function|class|file)\b/i,
      'workflow-execute': /\b(run|execute|start)\b.*\b(workflow|audit|test)\b/i,
      'agent-delegate': /\b(use|ask|delegate to)\b.*\b(agent|Backend|Frontend)\b/i
    };

    for (const [type, regex] of Object.entries(patterns)) {
      if (regex.test(input)) {
        return { type as IntentType, confidence: 0.9, method: 'pattern' };
      }
    }

    // LLM fallback (slow path, 20% coverage, <5s) - for ambiguous queries
    return this.classifyWithLLM(input);
  }

  private async classifyWithLLM(input: string): Promise<Intent> {
    const prompt = `Classify user intent:
"${input}"

Options:
- memory-search: User wants to search code/files
- workflow-execute: User wants to run a workflow
- agent-delegate: User wants to use a specific agent
- chat: General conversation

Respond with just the intent type.`;

    const response = await this.providerRouter.route({
      messages: [{ role: 'user', content: prompt }],
      preferredProvider: 'claude',
      temperature: 0.1,
      maxTokens: 10
    });

    return {
      type: response.content.trim() as IntentType,
      confidence: 0.7,
      method: 'llm'
    };
  }

  private async routeToMemoryService(
    input: string,
    intent: Intent
  ): Promise<RouteResult> {
    // Extract search query
    const query = this.extractSearchQuery(input);

    // Execute memory search
    const results = await this.memoryService.search(query, { limit: 10 });

    return {
      source: 'memory-service',
      results,
      displayFormat: 'search-results'
    };
  }

  private async routeToWorkflowEngine(
    input: string,
    intent: Intent
  ): Promise<RouteResult> {
    // Extract workflow name
    const workflowName = this.extractWorkflowName(input);

    // Find workflow file
    const workflowPath = await this.findWorkflowPath(workflowName);

    if (!workflowPath) {
      return {
        source: 'error',
        error: `Workflow "${workflowName}" not found`,
        displayFormat: 'error'
      };
    }

    // Execute workflow
    const execution = await this.workflowEngine.execute(workflowPath);

    return {
      source: 'workflow-engine',
      workflowId: execution.id,
      status: 'started',
      displayFormat: 'workflow-status'
    };
  }

  private async routeToAgentRuntime(
    input: string,
    intent: Intent
  ): Promise<RouteResult> {
    // Extract agent name
    const agentName = this.extractAgentName(input);

    // Get agent
    const agent = this.agentRuntime.getAgent(agentName);

    if (!agent) {
      return {
        source: 'error',
        error: `Agent "${agentName}" not found`,
        displayFormat: 'error'
      };
    }

    // Delegate to agent
    const response = await agent.handleRequest(input);

    return {
      source: 'agent-runtime',
      agent: agentName,
      response,
      displayFormat: 'agent-response'
    };
  }

  private async routeToProviderRouter(
    input: string,
    context: ConversationContext
  ): Promise<RouteResult> {
    // Add user message to context
    context.addMessage('user', input);

    // Get recent messages for context
    const messages = context.getRecentMessages(5);

    // Call AI provider
    const response = await this.providerRouter.route({
      messages,
      preferredProvider: context.activeAgent ? 'claude' : 'auto',
      temperature: 0.7,
      maxTokens: 2000
    });

    // Add assistant response to context
    context.addMessage('assistant', response.content);

    return {
      source: 'provider-router',
      content: response.content,
      displayFormat: 'chat-response'
    };
  }
}
```

**Complexity:** 250-300 LOC
**Integration Points:** 4 major systems (MemoryService, WorkflowEngine, AgentRuntime, ProviderRouter)
**Testing:** 15+ unit tests (intent classification, routing to each system, error handling)
**Effort:** 2 days (1 day implementation + 1 day testing/integration)

**Key Challenge:** Intent classification accuracy
- **Pattern matching (fast path):** 80% coverage, <100ms
- **LLM fallback (slow path):** 20% coverage, <5s
- **Target accuracy:** >85% overall

#### 2. **Integration Testing** (`src/cli/interactive/__tests__/integration/`)

**Purpose:** End-to-end REPL flow validation

**Why Critical:** Unit tests verify components in isolation. Integration tests verify the complete user journey works.

**Test Scenarios (15+):**

```typescript
describe('REPL Integration', () => {
  it('should launch REPL and execute slash command', async () => {
    const repl = new REPLSession();
    await repl.start();

    // Execute slash command
    await repl.handleInput('/agents');
    expect(output).toContain('21 agents available');

    await repl.stop();
  });

  it('should route natural language to MemoryService', async () => {
    const repl = new REPLSession();
    await repl.start();

    // Natural language query
    await repl.handleInput('find authentication logic');
    expect(output).toContain('MemoryService');
    expect(output).toMatch(/\d+ results found/);

    await repl.stop();
  });

  it('should preserve context across turns', async () => {
    const repl = new REPLSession();
    await repl.start();

    await repl.handleInput('set variable foo=bar');
    await repl.handleInput('show me variable foo');
    expect(output).toContain('bar');

    await repl.stop();
  });

  it('should persist conversation and restore', async () => {
    // Session 1: Create conversation
    const repl1 = new REPLSession();
    await repl1.start();
    await repl1.handleInput('hello world');
    await repl1.stop();

    // Session 2: Restore conversation
    const repl2 = new REPLSession();
    await repl2.start();
    await repl2.handleInput('/history');
    expect(output).toContain('hello world');
    await repl2.stop();
  });

  it('should handle errors gracefully', async () => {
    const repl = new REPLSession();
    await repl.start();

    await repl.handleInput('/workflow run nonexistent.yaml');
    expect(output).toContain('not found');
    expect(output).not.toContain('Error:'); // Should be user-friendly

    await repl.stop();
  });

  // ... 10+ more scenarios
});
```

**Complexity:** 300-400 LOC (15+ scenarios)
**Tooling:** Vitest + mock stdin/stdout
**Effort:** 1.5 days (1 day writing tests + 0.5 day fixing issues found)

#### 3. **Streaming Enhancements** (Improve `StreamingHandler.ts`)

**Purpose:** Better visual feedback and smooth streaming

**Current Issues:**
- Token buffering not smooth (flicker)
- Multi-line output not handled well
- Code blocks not formatted
- Errors not visually distinct

**Enhancements:**
```typescript
export class StreamingHandler {
  private spinner: ora.Ora | null = null;
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  startThinking(message: string = 'Thinking...'): void {
    this.spinner = ora({
      text: chalk.cyan(message),
      color: 'cyan',
      spinner: 'dots'
    }).start();
  }

  // NEW: Buffered streaming for smooth output
  streamToken(token: string): void {
    this.buffer.push(token);

    // Flush buffer every 50ms for smooth display
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        if (this.buffer.length > 0) {
          const text = this.buffer.join('');
          this.buffer = [];
          process.stdout.write(text);
        }
      }, 50);
    }
  }

  // NEW: Multi-line support with proper formatting
  streamMultiline(text: string): void {
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) process.stdout.write('\n');
      process.stdout.write(line);
    });
  }

  // NEW: Code block formatting
  streamCodeBlock(code: string, language: string): void {
    const formatted = chalk.dim('```') + language + '\n' +
                     chalk.green(code) + '\n' +
                     chalk.dim('```');
    process.stdout.write(formatted);
  }

  // ENHANCED: Error highlighting
  stopError(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = null;
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // ENHANCED: Success with timing
  stopSuccess(message: string, elapsedMs?: number): void {
    if (this.spinner) {
      const msg = elapsedMs
        ? `${message} ${chalk.dim(`(${elapsedMs}ms)`)}`
        : message;
      this.spinner.succeed(chalk.green(msg));
      this.spinner = null;
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}
```

**Complexity:** 100 LOC additions
**Testing:** 5+ unit tests (buffering, multi-line, code blocks, error display)
**Effort:** 1 day (0.5 day implementation + 0.5 day testing)

#### 4. **Documentation Polish**

**Purpose:** Complete user and developer documentation

**Files to Update/Create:**

1. **docs/interactive-cli-guide.md** (User Guide)
   - Already exists (960 lines)
   - Add NaturalLanguageRouter examples
   - Add troubleshooting section
   - Add performance tips
   - **Additions:** ~200 lines

2. **docs/interactive-cli-architecture.md** (Developer Guide)
   - System architecture diagrams
   - Data flow patterns
   - Extension guide (adding commands)
   - Testing guide
   - **New:** ~500 lines

3. **README.md** (Project Root)
   - Add Interactive CLI section
   - Link to full documentation
   - Quick start example
   - **Additions:** ~120 lines

**Total Documentation:** ~820 lines
**Effort:** 1 day (writing + diagrams + review)

### Week 2 Total Effort Estimate

| Component | LOC | Tests | Effort |
|-----------|-----|-------|--------|
| NaturalLanguageRouter | 300 | 15 | 2.0d |
| Integration Testing | 400 | 15 | 1.5d |
| Streaming Enhancements | 100 | 5 | 1.0d |
| Documentation | 820 | 0 | 1.0d |
| **Week 2 Total** | **1,620** | **35** | **5.5d** |

**With 20% buffer:** 6.6 days → **7 days (1.4 weeks)**

**Recommendation:** Allocate full Week 2 (5 days) with remaining time for polish/testing.

---

### Weeks 3-4: Spec-Kit Auto-Generation - Complete Analysis

**Current Status:** 0/5 generators implemented

**Strategic Context:**
Spec-Kit transforms natural language → YAML workflows, eliminating the #1 barrier to workflow adoption (manual YAML authoring). This is v7.6.1's killer feature.

**Target User Journey:**
```bash
# 1. Generate workflow from description
$ ax spec create "Run security audit: scan dependencies for CVEs, analyze code for vulnerabilities"

✅ Generated: workflows/security-audit-20251112.yaml (15 steps)
📊 Estimated duration: ~12 minutes
💰 Estimated cost: ~$0.45

# 2. Review execution plan
$ ax gen plan workflows/security-audit-20251112.yaml

📊 Execution Plan:
├─ Phase 1: Setup (2 steps, 30s, $0.02)
├─ Phase 2: Scanning (6 steps, 5m, $0.15)
├─ Phase 3: Analysis (5 steps, 5m, $0.20)
└─ Phase 4: Reporting (2 steps, 1m, $0.08)

Total: 15 steps, ~11.5 minutes, ~$0.45

# 3. Visualize dependencies
$ ax gen dag workflows/security-audit-20251112.yaml --format dot

digraph "Security Audit" {
  "scan-deps" -> "analyze-code";
  "scan-deps" -> "check-secrets";
  "analyze-code" -> "generate-report";
  "check-secrets" -> "generate-report";
}

# 4. Create project structure
$ ax gen scaffold workflows/security-audit-20251112.yaml --output ./audit-project

✅ Created project:
  ./audit-project/
    ├── workflows/security-audit.yaml
    ├── configs/audit.config.json
    ├── scripts/run-audit.sh
    ├── docs/README.md
    └── tests/audit.test.ts

# 5. Generate tests
$ ax gen tests workflows/security-audit-20251112.yaml

✅ Generated: tests/workflows/security-audit.test.ts (42 tests)
```

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│                   Spec-Kit Layer                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SpecGenerator  →  PlanGenerator  →  DAGGenerator  │
│         ↓                ↓                ↓         │
│  ScaffoldGenerator  TestGenerator  TemplateRegistry│
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│         Existing v8.0.0 Infrastructure              │
├─────────────────────────────────────────────────────┤
│  WorkflowParser   WorkflowEngineV2   AgentRegistry │
│  ProviderRouterV2   FileSystem   Zod Validation    │
└─────────────────────────────────────────────────────┘
```

#### Generator 1: **SpecGenerator** (`src/services/SpecGenerator.ts`)

**Purpose:** Natural language description → Valid YAML workflow

**Why Critical:** This is the entry point. Without this, users still need YAML expertise.

**Implementation Strategy:**

**Phase 1: Prompt Engineering (Critical)**
```typescript
private buildPrompt(description: string, options: SpecOptions): string {
  return `You are a workflow generation assistant for AutomatosX v8.0.0.

AVAILABLE AGENTS (21 total):
${this.formatAgentRegistry()}

WORKFLOW SCHEMA:
\`\`\`yaml
name: "Workflow Name"
version: "1.0.0"
description: "Clear description"
steps:
  - id: "step-id"
    name: "Step Name"
    agent: "agent-name"  # Must be from registry
    action: "action-name"
    config: {}
    dependsOn: []  # Array of step IDs
    retry:
      maxAttempts: 3
      backoff: exponential
\`\`\`

HIGH-QUALITY EXAMPLES:

Example 1: Security Audit
\`\`\`yaml
name: "Security Audit"
version: "1.0.0"
description: "Comprehensive security analysis"
steps:
  - id: "scan-dependencies"
    name: "Scan Dependencies for CVEs"
    agent: "security"
    action: "scan-dependencies"
    config:
      severity: ["high", "critical"]
    dependsOn: []

  - id: "analyze-code"
    name: "Static Code Analysis"
    agent: "security"
    action: "static-analysis"
    dependsOn: ["scan-dependencies"]

  - id: "check-secrets"
    name: "Check for Secrets in Code"
    agent: "security"
    action: "check-secrets"
    dependsOn: ["scan-dependencies"]

  - id: "generate-report"
    name: "Generate Security Report"
    agent: "documentation"
    action: "generate-report"
    dependsOn: ["analyze-code", "check-secrets"]
\`\`\`

Example 2: CI/CD Pipeline
\`\`\`yaml
name: "CI/CD Pipeline"
version: "1.0.0"
description: "Test, build, and deploy"
steps:
  - id: "run-tests"
    name: "Run Test Suite"
    agent: "testing"
    action: "run-tests"
    dependsOn: []

  - id: "build"
    name: "Build Application"
    agent: "build"
    action: "compile"
    dependsOn: ["run-tests"]

  - id: "deploy"
    name: "Deploy to Production"
    agent: "deployment"
    action: "deploy-production"
    dependsOn: ["build"]
\`\`\`

Example 3: Code Review
\`\`\`yaml
name: "Code Review"
version: "1.0.0"
description: "Automated code review"
steps:
  - id: "lint"
    name: "Lint Code"
    agent: "quality"
    action: "lint"
    dependsOn: []

  - id: "complexity"
    name: "Check Complexity"
    agent: "quality"
    action: "check-complexity"
    dependsOn: []

  - id: "review"
    name: "AI Code Review"
    agent: "backend"
    action: "review-code"
    dependsOn: ["lint", "complexity"]

  - id: "suggestions"
    name: "Generate Suggestions"
    agent: "documentation"
    action: "generate-suggestions"
    dependsOn: ["review"]
\`\`\`

USER REQUEST:
"${description}"

REQUIREMENTS:
1. Use ONLY agents from the registry
2. Define clear dependencies (dependsOn)
3. Include retry logic (3 attempts, exponential backoff)
4. Use descriptive names and descriptions
5. Return ONLY the YAML workflow (no explanations)

Generate workflow YAML:`;
}

private formatAgentRegistry(): string {
  const agents = this.agentRegistry.list();
  return agents.map(a => `- ${a.name}: ${a.description} (actions: ${a.actions.join(', ')})`).join('\n');
}
```

**Phase 2: YAML Extraction & Validation**
```typescript
async generateSpec(description: string, options?: SpecOptions): Promise<GeneratedSpec> {
  // 1. Build prompt with examples
  const prompt = this.buildPrompt(description, options);

  // 2. Call LLM (Claude for best structured output)
  const response = await this.providerRouter.route({
    messages: [{ role: 'user', content: prompt }],
    preferredProvider: 'claude',
    temperature: 0.3,  // Low for consistency
    maxTokens: 4000
  });

  // 3. Extract YAML from response
  const yaml = this.extractYAML(response.content);

  // 4. Parse and validate
  const definition = this.workflowParser.parse(yaml);
  const validation = this.validateSpec(definition);

  if (!validation.valid) {
    // Retry once with error feedback
    return this.retryGeneration(description, validation.errors, options);
  }

  // 5. Optimize workflow
  const optimized = this.optimizeWorkflow(definition);

  // 6. Write to file
  const outputPath = await this.writeWorkflow(optimized, options);

  // 7. Return with metadata
  return {
    yaml: this.workflowParser.serialize(optimized),
    definition: optimized,
    outputPath,
    metadata: {
      generatedAt: new Date(),
      description,
      stepsCount: optimized.steps.length,
      estimatedDuration: this.estimateDuration(optimized),
      estimatedCost: this.estimateCost(optimized)
    }
  };
}

private extractYAML(response: string): string {
  // Extract YAML from markdown code blocks
  const match = response.match(/```ya?ml\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error('No YAML found in LLM response');
  }
  return match[1];
}

private validateSpec(definition: WorkflowDefinition): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!definition.name) errors.push('Missing workflow name');
  if (!definition.version) errors.push('Missing version');
  if (!definition.steps || definition.steps.length === 0) {
    errors.push('No steps defined');
  }

  // Validate each step
  definition.steps.forEach(step => {
    if (!step.id) errors.push(`Step missing id`);
    if (!step.agent) errors.push(`Step ${step.id} missing agent`);

    // Verify agent exists
    const agent = this.agentRegistry.get(step.agent);
    if (!agent) {
      errors.push(`Unknown agent: ${step.agent}`);
    }

    // Verify dependencies exist
    (step.dependsOn || []).forEach(depId => {
      if (!definition.steps.find(s => s.id === depId)) {
        errors.push(`Step ${step.id} depends on unknown step: ${depId}`);
      }
    });
  });

  // Check for cycles
  if (this.hasCycles(definition.steps)) {
    errors.push('Circular dependencies detected');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

private optimizeWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
  // 1. Infer missing dependencies (heuristics)
  // Example: "test" step should depend on "lint" if both exist
  const stepsWithDeps = this.inferMissingDependencies(definition.steps);

  // 2. Topological sort for optimal order
  const sorted = this.topologicalSort(stepsWithDeps);

  // 3. Add retry/fallback if missing
  const withRetry = sorted.map(step => ({
    ...step,
    retry: step.retry || {
      maxAttempts: 3,
      backoff: 'exponential' as const
    }
  }));

  return {
    ...definition,
    steps: withRetry
  };
}
```

**Complexity:** 350-400 LOC
**Testing:** 20+ tests
- Valid workflow generation
- YAML extraction
- Validation (missing fields, unknown agents, cycles)
- Optimization (dependency inference, topological sort)
- Error handling (invalid input, LLM failures)

**Effort:** 3 days
- Day 1: Prompt engineering + YAML extraction
- Day 2: Validation + optimization
- Day 3: Testing + refinement

**Success Criteria:**
- >95% generated workflows valid
- >90% dependencies correct
- <30s generation time

#### Generator 2: **PlanGenerator** (`src/services/PlanGenerator.ts`)

**Purpose:** Workflow → Execution plan with cost/time estimates

**Why Critical:** Users need to know upfront: "This will take 15 minutes and cost $0.50"

**Implementation:**
```typescript
export class PlanGenerator {
  async generatePlan(workflowPath: string): Promise<ExecutionPlan> {
    // 1. Load and parse workflow
    const yaml = await fs.readFile(workflowPath, 'utf-8');
    const definition = this.workflowParser.parse(yaml);

    // 2. Build dependency graph
    const graph = this.buildDependencyGraph(definition.steps);

    // 3. Compute execution phases (topological levels)
    const phases = this.computePhases(graph);

    // 4. Estimate cost and duration per phase
    const phasesWithEstimates = phases.map((phase, i) => ({
      phaseId: i + 1,
      steps: phase.steps,
      estimatedDuration: this.estimatePhaseDuration(phase),
      estimatedCost: this.estimatePhaseCost(phase),
      parallelism: phase.steps.length
    }));

    // 5. Aggregate totals
    const totalDuration = phasesWithEstimates.reduce((sum, p) => sum + p.estimatedDuration, 0);
    const totalCost = phasesWithEstimates.reduce((sum, p) => sum + p.estimatedCost, 0);

    return {
      workflow: definition.name,
      phases: phasesWithEstimates,
      totalSteps: definition.steps.length,
      totalDuration,
      totalCost,
      createdAt: new Date()
    };
  }

  private computePhases(graph: DependencyGraph): Phase[] {
    // Topological sort into levels
    // All nodes at level N can execute in parallel
    const phases: Phase[] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // Calculate in-degrees
    graph.nodes.forEach(node => {
      inDegree.set(node.id, graph.getIncomingEdges(node.id).length);
    });

    while (visited.size < graph.nodes.length) {
      // Find all nodes with in-degree 0
      const ready = graph.nodes.filter(
        node => !visited.has(node.id) && inDegree.get(node.id) === 0
      );

      if (ready.length === 0) {
        throw new Error('Circular dependency detected');
      }

      phases.push({
        id: phases.length + 1,
        steps: ready.map(n => n.data)
      });

      // Mark as visited and update in-degrees
      ready.forEach(node => {
        visited.add(node.id);
        graph.getOutgoingEdges(node.id).forEach(edge => {
          const target = edge.target;
          inDegree.set(target, inDegree.get(target)! - 1);
        });
      });
    }

    return phases;
  }

  private estimatePhaseDuration(phase: Phase): number {
    // Max duration among parallel steps
    return Math.max(...phase.steps.map(step => this.estimateStepDuration(step)));
  }

  private estimatePhaseCost(phase: Phase): number {
    // Sum of costs for parallel steps
    return phase.steps.reduce((sum, step) => sum + this.estimateStepCost(step), 0);
  }

  private estimateStepDuration(step: WorkflowStep): number {
    const agent = this.agentRegistry.get(step.agent);
    // Agent-specific estimates or heuristics
    if (agent?.estimatedDuration) return agent.estimatedDuration;

    // Heuristics based on action type
    const actionDurations: Record<string, number> = {
      'scan-dependencies': 60,     // 1 minute
      'static-analysis': 120,      // 2 minutes
      'run-tests': 180,            // 3 minutes
      'compile': 90,               // 1.5 minutes
      'deploy': 120,               // 2 minutes
      'default': 30                // 30 seconds
    };

    return actionDurations[step.action] || actionDurations['default'];
  }

  private estimateStepCost(step: WorkflowStep): number {
    const agent = this.agentRegistry.get(step.agent);
    if (agent?.estimatedCost) return agent.estimatedCost;

    // Heuristics: LLM-heavy actions cost more
    const actionCosts: Record<string, number> = {
      'review-code': 0.10,         // LLM-intensive
      'generate-report': 0.08,     // LLM-intensive
      'scan-dependencies': 0.02,   // Tool-based
      'run-tests': 0.01,           // Tool-based
      'default': 0.05              // Average
    };

    return actionCosts[step.action] || actionCosts['default'];
  }
}
```

**Complexity:** 350-400 LOC
**Testing:** 15+ tests
- Phase computation (topological sort)
- Parallelism detection
- Cost estimation accuracy (validate against real runs)
- Duration estimation accuracy
- Error handling (cycles, missing agents)

**Effort:** 2 days
- Day 1: Phase computation + estimation logic
- Day 2: Testing + calibration (compare estimates vs actual runs)

**Success Criteria:**
- Correct phase computation (topological sort)
- Cost estimates within ±30% of actual (validated post-launch)
- Duration estimates within ±40% of actual

#### Generator 3: **DAGGenerator** (`src/services/DAGGenerator.ts`)

**Purpose:** Workflow → Dependency graph visualization (ASCII, DOT, Mermaid)

**Why Critical:** Visual understanding of workflow structure helps users verify correctness.

**Implementation:**
```typescript
export class DAGGenerator {
  async generateDAG(
    workflowPath: string,
    format: 'ascii' | 'dot' | 'mermaid' = 'ascii'
  ): Promise<string> {
    const yaml = await fs.readFile(workflowPath, 'utf-8');
    const definition = this.workflowParser.parse(yaml);

    switch (format) {
      case 'ascii':
        return this.generateASCII(definition);
      case 'dot':
        return this.generateDOT(definition);
      case 'mermaid':
        return this.generateMermaid(definition);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  private generateASCII(definition: WorkflowDefinition): string {
    const lines: string[] = [];
    lines.push(`${definition.name} - Dependency Graph`);
    lines.push('');

    const graph = this.buildGraph(definition.steps);
    const roots = graph.nodes.filter(n => graph.getIncomingEdges(n.id).length === 0);

    roots.forEach(root => {
      this.renderASCIINode(graph, root, lines, '', true);
    });

    return lines.join('\n');
  }

  private renderASCIINode(
    graph: DependencyGraph,
    node: GraphNode,
    lines: string[],
    prefix: string,
    isLast: boolean
  ): void {
    const connector = isLast ? '└─' : '├─';
    lines.push(`${prefix}${connector} ${node.data.name} (${node.id})`);

    const children = graph.getOutgoingEdges(node.id).map(e =>
      graph.nodes.find(n => n.id === e.target)!
    );

    children.forEach((child, idx) => {
      const newPrefix = prefix + (isLast ? '  ' : '│ ');
      this.renderASCIINode(
        graph,
        child,
        lines,
        newPrefix,
        idx === children.length - 1
      );
    });
  }

  private generateDOT(definition: WorkflowDefinition): string {
    const lines: string[] = [];
    lines.push(`digraph "${definition.name}" {`);
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    // Nodes
    definition.steps.forEach(step => {
      lines.push(`  "${step.id}" [label="${step.name}"];`);
    });

    lines.push('');

    // Edges
    definition.steps.forEach(step => {
      (step.dependsOn || []).forEach(dep => {
        lines.push(`  "${dep}" -> "${step.id}";`);
      });
    });

    lines.push('}');
    return lines.join('\n');
  }

  private generateMermaid(definition: WorkflowDefinition): string {
    const lines: string[] = [];
    lines.push('graph TD');

    // Nodes
    definition.steps.forEach(step => {
      lines.push(`  ${step.id}["${step.name}"]`);
    });

    // Edges
    definition.steps.forEach(step => {
      (step.dependsOn || []).forEach(dep => {
        lines.push(`  ${dep} --> ${step.id}`);
      });
    });

    return lines.join('\n');
  }
}
```

**Complexity:** 250-300 LOC
**Testing:** 12+ tests
- ASCII format rendering
- DOT format rendering
- Mermaid format rendering
- Complex graphs (multiple roots, deep trees, wide branches)
- Edge cases (single node, no dependencies)

**Effort:** 1.5 days
- Day 1: Implementation (all 3 formats)
- Day 0.5: Testing + visual validation

**Success Criteria:**
- All 3 formats render correctly
- Compatible with Graphviz (DOT) and Mermaid tools
- ASCII readable in terminal

#### Generator 4: **ScaffoldGenerator** (`src/services/ScaffoldGenerator.ts`)

**Purpose:** Workflow → Complete project structure

**Why Critical:** Users get a ready-to-use project with config, scripts, docs, tests.

**Implementation:**
```typescript
export class ScaffoldGenerator {
  async generateScaffold(
    workflowPath: string,
    outputDir: string
  ): Promise<ScaffoldResult> {
    const yaml = await fs.readFile(workflowPath, 'utf-8');
    const definition = this.workflowParser.parse(yaml);

    // Create directory structure
    await fs.mkdir(outputDir, { recursive: true });

    const files: GeneratedFile[] = [];

    // 1. Copy workflow
    const workflowFile = path.join(outputDir, 'workflows', `${definition.name}.yaml`);
    await fs.mkdir(path.dirname(workflowFile), { recursive: true });
    await fs.copyFile(workflowPath, workflowFile);
    files.push({ path: workflowFile, type: 'workflow' });

    // 2. Generate config
    const configFile = path.join(outputDir, 'configs', 'workflow.config.json');
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    await fs.writeFile(
      configFile,
      JSON.stringify(this.generateConfig(definition), null, 2),
      'utf-8'
    );
    files.push({ path: configFile, type: 'config' });

    // 3. Generate execution script
    const scriptFile = path.join(outputDir, 'scripts', 'run-workflow.sh');
    await fs.mkdir(path.dirname(scriptFile), { recursive: true });
    await fs.writeFile(scriptFile, this.generateScript(definition), 'utf-8');
    await fs.chmod(scriptFile, 0o755);
    files.push({ path: scriptFile, type: 'script' });

    // 4. Generate README
    const readmeFile = path.join(outputDir, 'README.md');
    await fs.writeFile(readmeFile, this.generateReadme(definition), 'utf-8');
    files.push({ path: readmeFile, type: 'docs' });

    // 5. Generate tests (delegates to TestGenerator)
    const testFile = path.join(outputDir, 'tests', `${definition.name}.test.ts`);
    await fs.mkdir(path.dirname(testFile), { recursive: true });
    await fs.writeFile(testFile, this.generateTests(definition), 'utf-8');
    files.push({ path: testFile, type: 'test' });

    return {
      outputDir,
      files,
      workflow: definition.name,
      createdAt: new Date()
    };
  }

  private generateConfig(definition: WorkflowDefinition): any {
    return {
      workflow: definition.name,
      version: definition.version,
      settings: {
        maxConcurrency: 5,
        timeout: 3600,  // 1 hour
        retryPolicy: {
          maxAttempts: 3,
          backoff: 'exponential'
        }
      },
      agents: [...new Set(definition.steps.map(s => s.agent))]
    };
  }

  private generateScript(definition: WorkflowDefinition): string {
    return `#!/bin/bash
# Generated by AutomatosX ScaffoldGenerator
# Workflow: ${definition.name}

set -e

echo "Running workflow: ${definition.name}"
ax workflow run workflows/${definition.name}.yaml --config configs/workflow.config.json

echo "Workflow completed successfully"
`;
  }

  private generateReadme(definition: WorkflowDefinition): string {
    return `# ${definition.name}

${definition.description || 'Generated workflow project'}

## Structure

\`\`\`
.
├── workflows/          # Workflow definitions
├── configs/            # Configuration files
├── scripts/            # Execution scripts
├── tests/              # Test suites
└── README.md          # This file
\`\`\`

## Usage

\`\`\`bash
# Run workflow
./scripts/run-workflow.sh

# Or directly with ax
ax workflow run workflows/${definition.name}.yaml

# Run tests
npm test
\`\`\`

## Steps

${definition.steps.map((s, i) => `${i + 1}. **${s.name}** (${s.agent}): ${s.description || 'No description'}`).join('\n')}
`;
  }

  private generateTests(definition: WorkflowDefinition): string {
    // Delegates to TestGenerator (simplified version)
    return `import { describe, it, expect } from 'vitest';
import { WorkflowParser } from '../src/services/WorkflowParser';

describe('${definition.name} Workflow', () => {
  it('should parse workflow successfully', async () => {
    const parser = new WorkflowParser();
    const workflow = await parser.parseFile('workflows/${definition.name}.yaml');
    expect(workflow.name).toBe('${definition.name}');
    expect(workflow.steps).toHaveLength(${definition.steps.length});
  });

${definition.steps.map((step, i) => `
  it('should have step ${i + 1}: ${step.name}', async () => {
    const parser = new WorkflowParser();
    const workflow = await parser.parseFile('workflows/${definition.name}.yaml');
    const step = workflow.steps[${i}];
    expect(step.id).toBe('${step.id}');
    expect(step.agent).toBe('${step.agent}');
  });
`).join('\n')}
});
`;
  }
}
```

**Complexity:** 400-450 LOC
**Testing:** 10+ tests
- Directory creation
- File generation (all 5 file types)
- Script executable permissions
- Correct file contents
- Error handling (permissions, disk space)

**Effort:** 2 days
- Day 1: Implementation (all file generators)
- Day 2: Testing + polish

**Success Criteria:**
- Complete project structure generated
- All files valid and executable
- Scripts run successfully

#### Generator 5: **TestGenerator** (`src/services/TestGenerator.ts`)

**Purpose:** Workflow → Comprehensive test suite

**Why Critical:** Generated workflows need automated testing.

**Implementation:**
```typescript
export class TestGenerator {
  async generateTests(
    workflowPath: string,
    outputPath?: string
  ): Promise<GeneratedTests> {
    const yaml = await fs.readFile(workflowPath, 'utf-8');
    const definition = this.workflowParser.parse(yaml);

    const tests: TestSuite[] = [];

    // 1. Schema validation tests
    tests.push(this.generateSchemaTests(definition));

    // 2. Step execution tests
    tests.push(...this.generateStepTests(definition));

    // 3. Dependency tests
    tests.push(this.generateDependencyTests(definition));

    // 4. Error handling tests
    tests.push(this.generateErrorTests(definition));

    // 5. Integration tests
    tests.push(this.generateIntegrationTests(definition));

    const code = this.renderTestCode(tests);

    const output = outputPath || `tests/workflows/${definition.name}.test.ts`;
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, code, 'utf-8');

    return {
      outputPath: output,
      testCount: tests.reduce((sum, suite) => sum + suite.tests.length, 0),
      suites: tests.map(s => s.name),
      createdAt: new Date()
    };
  }

  private generateSchemaTests(definition: WorkflowDefinition): TestSuite {
    return {
      name: 'Schema Validation',
      tests: [
        {
          name: 'should have required fields',
          code: `expect(workflow.name).toBe('${definition.name}');
expect(workflow.version).toBe('${definition.version}');
expect(workflow.steps).toBeDefined();`
        },
        {
          name: 'should have valid steps',
          code: `expect(workflow.steps.length).toBeGreaterThan(0);
workflow.steps.forEach(step => {
  expect(step.id).toBeDefined();
  expect(step.agent).toBeDefined();
});`
        }
      ]
    };
  }

  private generateStepTests(definition: WorkflowDefinition): TestSuite[] {
    return definition.steps.map(step => ({
      name: `Step: ${step.name}`,
      tests: [
        {
          name: `should execute ${step.name}`,
          code: `const result = await engine.executeStep('${step.id}');
expect(result.status).toBe('completed');`
        }
      ]
    }));
  }

  // ... (similar methods for dependency, error, integration tests)

  private renderTestCode(suites: TestSuite[]): string {
    const lines: string[] = [];

    lines.push(`import { describe, it, expect, beforeEach } from 'vitest';`);
    lines.push(`import { WorkflowParser } from '../services/WorkflowParser';`);
    lines.push(`import { WorkflowEngineV2 } from '../services/WorkflowEngineV2';`);
    lines.push('');

    lines.push(`describe('Generated Workflow Tests', () => {`);
    lines.push(`  let parser: WorkflowParser;`);
    lines.push(`  let engine: WorkflowEngineV2;`);
    lines.push('');
    lines.push(`  beforeEach(() => {`);
    lines.push(`    parser = new WorkflowParser();`);
    lines.push(`    engine = new WorkflowEngineV2();`);
    lines.push(`  });`);
    lines.push('');

    suites.forEach(suite => {
      lines.push(`  describe('${suite.name}', () => {`);
      suite.tests.forEach(test => {
        lines.push(`    it('${test.name}', async () => {`);
        lines.push(`      ${test.code}`);
        lines.push(`    });`);
        lines.push('');
      });
      lines.push(`  });`);
      lines.push('');
    });

    lines.push(`});`);

    return lines.join('\n');
  }
}
```

**Complexity:** 300-350 LOC
**Testing:** 10+ tests
- Test generation for all categories
- Code rendering validity
- Generated tests runnable

**Effort:** 1.5 days
- Day 1: Implementation (all test categories)
- Day 0.5: Testing + validation

**Success Criteria:**
- Generated tests are valid TypeScript
- Generated tests runnable
- >30 tests per workflow (comprehensive)

#### CLI Commands (`src/cli/commands/spec.ts` and `gen.ts`)

**Purpose:** CLI interface for all generators

**Implementation:**
```typescript
// src/cli/commands/spec.ts
program
  .command('spec')
  .description('Workflow specification tools')
  .addCommand(
    program
      .createCommand('create')
      .description('Generate workflow from natural language')
      .argument('<description>', 'Workflow description')
      .option('-o, --output <path>', 'Output directory')
      .option('--agents <agents>', 'Comma-separated agent names to restrict')
      .action(async (description, options) => {
        const generator = new SpecGenerator(
          providerRouter,
          agentRegistry,
          workflowParser
        );

        console.log(chalk.cyan('Generating workflow...'));

        try {
          const result = await generator.generateSpec(description, options);

          console.log(chalk.green(`✅ Generated: ${result.outputPath}`));
          console.log(chalk.dim(`   Steps: ${result.metadata.stepsCount}`));
          console.log(chalk.dim(`   Duration: ~${result.metadata.estimatedDuration}s`));
          console.log(chalk.dim(`   Cost: ~$${result.metadata.estimatedCost.toFixed(2)}`));
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      })
  );

// src/cli/commands/gen.ts
program
  .command('gen')
  .description('Generation tools')
  .addCommand(
    program
      .createCommand('plan')
      .description('Generate execution plan')
      .argument('<workflow>', 'Path to workflow YAML')
      .action(async (workflowPath) => {
        const generator = new PlanGenerator(workflowParser, agentRegistry);

        try {
          const plan = await generator.generatePlan(workflowPath);

          console.log(chalk.cyan('📊 Execution Plan'));
          plan.phases.forEach((phase, i) => {
            console.log(chalk.dim(`├─ Phase ${i + 1}: ${phase.steps.length} steps, ` +
              `${phase.estimatedDuration}s, $${phase.estimatedCost.toFixed(2)}`));
          });
          console.log('');
          console.log(chalk.bold(`Total: ${plan.totalSteps} steps, ` +
            `~${plan.totalDuration}s, ~$${plan.totalCost.toFixed(2)}`));
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('dag')
      .description('Generate dependency graph')
      .argument('<workflow>', 'Path to workflow YAML')
      .option('-f, --format <format>', 'Output format (ascii, dot, mermaid)', 'ascii')
      .action(async (workflowPath, options) => {
        const generator = new DAGGenerator(workflowParser);

        try {
          const dag = await generator.generateDAG(workflowPath, options.format);
          console.log(dag);
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('scaffold')
      .description('Generate project structure')
      .argument('<workflow>', 'Path to workflow YAML')
      .option('-o, --output <dir>', 'Output directory', './workflow-project')
      .action(async (workflowPath, options) => {
        const generator = new ScaffoldGenerator(workflowParser, templateRegistry);

        console.log(chalk.cyan('Generating project structure...'));

        try {
          const result = await generator.generateScaffold(workflowPath, options.output);

          console.log(chalk.green(`✅ Created project: ${result.outputDir}`));
          result.files.forEach(file => {
            console.log(chalk.dim(`   ${path.relative(result.outputDir, file.path)}`));
          });
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      })
  )
  .addCommand(
    program
      .createCommand('tests')
      .description('Generate test suite')
      .argument('<workflow>', 'Path to workflow YAML')
      .option('-o, --output <path>', 'Output path')
      .action(async (workflowPath, options) => {
        const generator = new TestGenerator(workflowParser, agentRegistry);

        console.log(chalk.cyan('Generating test suite...'));

        try {
          const result = await generator.generateTests(workflowPath, options.output);

          console.log(chalk.green(`✅ Generated: ${result.outputPath}`));
          console.log(chalk.dim(`   Tests: ${result.testCount}`));
          console.log(chalk.dim(`   Suites: ${result.suites.join(', ')}`));
        } catch (error) {
          console.error(chalk.red(`Error: ${error.message}`));
          process.exit(1);
        }
      })
  );
```

**Complexity:** 350 LOC total
**Testing:** 10+ integration tests (CLI command execution)
**Effort:** 1.5 days
- Day 1: Implementation (all commands)
- Day 0.5: Testing + polish

### Weeks 3-4 Total Effort Estimate

| Component | LOC | Tests | Effort |
|-----------|-----|-------|--------|
| SpecGenerator | 400 | 20 | 3.0d |
| PlanGenerator | 400 | 15 | 2.0d |
| DAGGenerator | 300 | 12 | 1.5d |
| ScaffoldGenerator | 450 | 10 | 2.0d |
| TestGenerator | 350 | 10 | 1.5d |
| CLI Commands | 350 | 10 | 1.5d |
| Integration Testing | 400 | 10 | 1.5d |
| Documentation | 1500 | 0 | 1.0d |
| **Weeks 3-4 Total** | **4,150** | **87** | **14.0d** |

**With 20% buffer:** 16.8 days → **17 days (3.4 weeks)**

**Recommendation:** Allocate Weeks 3-4 (10 days) with understanding that may extend into Week 5.

---

## 📋 Implementation Plan: Day-by-Day Breakdown

### Week 2: Interactive CLI Completion (Days 6-10)

#### Day 6 (Monday): NaturalLanguageRouter - Foundation
**Goal:** Intent classification and routing logic

**Morning (4h):**
- Create `src/cli/interactive/NaturalLanguageRouter.ts`
- Define intent types (memory-search, workflow-execute, agent-delegate, chat)
- Implement pattern matching (80% coverage, <100ms)
- Add pattern library (~100 patterns)

**Afternoon (4h):**
- Implement LLM fallback (20% coverage, <5s)
- Add confidence scoring
- Write unit tests (10 tests: pattern matching accuracy, LLM fallback, confidence)

**Deliverables:**
- NaturalLanguageRouter.ts (~250 LOC)
- Pattern library (~50 LOC)
- Unit tests (~150 LOC)

**Success Criteria:**
- ✅ >85% intent classification accuracy
- ✅ Pattern matching <100ms
- ✅ LLM fallback <5s

---

#### Day 7 (Tuesday): NaturalLanguageRouter - Integration
**Goal:** Wire router to existing services

**Morning (4h):**
- Integrate with MemoryService (code search routing)
- Integrate with WorkflowEngine (workflow execution routing)
- Add query extraction logic

**Afternoon (4h):**
- Integrate with AgentRuntime (agent delegation routing)
- Integrate with ProviderRouter (chat fallback)
- Write integration tests (5 tests: each routing path)

**Deliverables:**
- Service integrations (~100 LOC additions)
- Integration tests (~150 LOC)

**Success Criteria:**
- ✅ All 4 routing paths functional
- ✅ Context passed correctly to each service
- ✅ Error handling graceful

---

#### Day 8 (Wednesday): Integration Testing + Streaming Enhancements
**Goal:** End-to-end REPL tests and improved streaming

**Morning (4h):**
- Create `src/cli/interactive/__tests__/integration/repl.test.ts`
- Write 15+ integration scenarios:
  - Launch → slash command → exit
  - Natural language → routing → response
  - Context persistence → restart → continuity
  - Error handling → recovery
  - Multi-turn conversations

**Afternoon (4h):**
- Enhance StreamingHandler:
  - Token buffering (smooth display)
  - Multi-line support
  - Code block formatting
  - Error highlighting
- Write unit tests (5 tests: buffering, multi-line, code blocks)

**Deliverables:**
- Integration tests (~300 LOC, 15 scenarios)
- StreamingHandler enhancements (~100 LOC)
- Unit tests (~100 LOC)

**Success Criteria:**
- ✅ All integration scenarios passing
- ✅ Smooth streaming <200ms latency
- ✅ No flaky tests

---

#### Day 9 (Thursday): Documentation
**Goal:** Complete user and developer documentation

**Morning (4h):**
- Update **docs/interactive-cli-guide.md**:
  - Add NaturalLanguageRouter examples
  - Add troubleshooting section
  - Add performance tips

**Afternoon (4h):**
- Create **docs/interactive-cli-architecture.md**:
  - System architecture diagrams
  - Data flow patterns
  - Extension guide
  - Testing guide

**Deliverables:**
- Updated interactive-cli-guide.md (+200 lines)
- New interactive-cli-architecture.md (~500 lines)

**Success Criteria:**
- ✅ All documentation complete
- ✅ Examples for all features
- ✅ Extension guide clear

---

#### Day 10 (Friday): Week 2 Gate Review + Polish
**Goal:** Pass quality gate and polish implementation

**Morning (3h):**
- Update **README.md**:
  - Add Interactive CLI section
  - Add quick start example
  - Link to full documentation

**Afternoon (4h):**
- Run quality gate checklist
- Fix any issues found
- Performance profiling (streaming latency, memory usage)
- Final testing pass

**Evening (1h):**
- Create Week 2 gate review report
- Document any deferred items

**Deliverables:**
- Updated README.md (+120 lines)
- Week 2 gate review report (~50 lines)
- Performance profile results

**Quality Gate Checklist:**
```markdown
# Week 2 Quality Gate

## Functionality
- [x] `ax cli` launches REPL
- [x] 13 slash commands functional
- [x] Natural language routing works
- [x] Token-by-token streaming <200ms
- [x] Context persists across sessions

## Testing
- [x] 40+ unit tests passing (existing)
- [x] 15+ integration tests passing (new)
- [x] >80% test coverage
- [x] Zero flaky tests
- [x] CI green on all platforms

## Performance
- [x] Streaming latency <200ms (P95)
- [x] Pattern matching <100ms (P95)
- [x] Memory usage <100MB

## Documentation
- [x] User guide complete
- [x] Architecture docs complete
- [x] README updated
- [x] Inline comments >80%

## Code Quality
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] Zod validation on all inputs
- [x] Error handling comprehensive

## Decision: PASS ✅
```

**Success Criteria:**
- ✅ All gate criteria met
- ✅ Documentation complete
- ✅ Ready for Weeks 3-4

---

### Week 3: Spec-Kit Generators 1-3 (Days 11-15)

#### Day 11 (Monday): SpecGenerator - Foundation
**Goal:** Prompt engineering and YAML extraction

**Morning (4h):**
- Create `src/services/SpecGenerator.ts`
- Implement prompt engineering:
  - Agent registry formatting
  - 3-5 high-quality example workflows
  - Schema enforcement
- Implement YAML extraction (regex + validation)

**Afternoon (4h):**
- Implement workflow validation:
  - Required fields check
  - Agent existence check
  - Dependency existence check
  - Cycle detection
- Write unit tests (10 tests: YAML extraction, validation)

**Deliverables:**
- SpecGenerator.ts (~350 LOC)
- Unit tests (~200 LOC)

**Success Criteria:**
- ✅ YAML extraction works with code blocks
- ✅ Validation catches all error types
- ✅ Cycle detection works

---

#### Day 12 (Tuesday): SpecGenerator - Optimization + Retry
**Goal:** Workflow optimization and retry logic

**Morning (4h):**
- Implement workflow optimization:
  - Infer missing dependencies (heuristics)
  - Topological sort
  - Add retry/fallback if missing
- Implement estimation:
  - Duration estimation (heuristics)
  - Cost estimation (heuristics)

**Afternoon (4h):**
- Implement retry logic (if first generation fails)
- Add file writing (output to workflows/)
- Write unit tests (10 tests: optimization, estimation, retry)

**Deliverables:**
- SpecGenerator optimization (~100 LOC additions)
- Unit tests (~150 LOC)

**Success Criteria:**
- ✅ Optimization improves workflow quality
- ✅ Estimations reasonable
- ✅ Retry handles validation failures

---

#### Day 13 (Wednesday): PlanGenerator
**Goal:** Execution plan with cost/time estimates

**Morning (4h):**
- Create `src/services/PlanGenerator.ts`
- Implement dependency graph building
- Implement phase computation (topological levels)

**Afternoon (4h):**
- Implement cost/duration estimation per phase
- Aggregate totals
- Write unit tests (15 tests: phase computation, estimation)

**Deliverables:**
- PlanGenerator.ts (~400 LOC)
- Unit tests (~250 LOC)

**Success Criteria:**
- ✅ Phase computation correct (topological sort)
- ✅ Parallelism detected correctly
- ✅ Estimations reasonable

---

#### Day 14 (Thursday): DAGGenerator
**Goal:** Dependency graph visualization

**Morning (4h):**
- Create `src/services/DAGGenerator.ts`
- Implement ASCII format (tree rendering)
- Implement DOT format (Graphviz)

**Afternoon (4h):**
- Implement Mermaid format
- Write unit tests (12 tests: all 3 formats, edge cases)

**Deliverables:**
- DAGGenerator.ts (~300 LOC)
- Unit tests (~200 LOC)

**Success Criteria:**
- ✅ All 3 formats render correctly
- ✅ Compatible with external tools (Graphviz, Mermaid)
- ✅ ASCII readable in terminal

---

#### Day 15 (Friday): CLI Integration + Testing
**Goal:** Wire SpecGenerator, PlanGenerator, DAGGenerator to CLI

**Morning (3h):**
- Create `src/cli/commands/spec.ts` (ax spec create)
- Create `src/cli/commands/gen.ts` (ax gen plan, ax gen dag)
- Register commands in `src/cli/index.ts`

**Afternoon (4h):**
- Write integration tests:
  - `ax spec create` end-to-end
  - `ax gen plan` end-to-end
  - `ax gen dag` end-to-end
  - Pipeline: create → plan → dag

**Evening (1h):**
- Week 3 checkpoint review
- Document any issues

**Deliverables:**
- spec.ts (~150 LOC)
- gen.ts (partial, ~100 LOC)
- Integration tests (~200 LOC)

**Success Criteria:**
- ✅ CLI commands functional
- ✅ Integration tests passing
- ✅ Generated workflows executable

---

### Week 4: Spec-Kit Generators 4-5 + Documentation (Days 16-20)

#### Day 16 (Monday): ScaffoldGenerator
**Goal:** Project structure generation

**Morning (4h):**
- Create `src/services/ScaffoldGenerator.ts`
- Implement directory structure creation
- Implement config file generation

**Afternoon (4h):**
- Implement script generation (run-workflow.sh)
- Implement README generation
- Implement basic test generation
- Write unit tests (10 tests: all file types)

**Deliverables:**
- ScaffoldGenerator.ts (~450 LOC)
- Unit tests (~150 LOC)

**Success Criteria:**
- ✅ Complete project structure generated
- ✅ All files valid
- ✅ Scripts executable

---

#### Day 17 (Tuesday): TestGenerator
**Goal:** Comprehensive test suite generation

**Morning (4h):**
- Create `src/services/TestGenerator.ts`
- Implement test suite generation:
  - Schema validation tests
  - Step execution tests
  - Dependency tests

**Afternoon (4h):**
- Implement remaining test types:
  - Error handling tests
  - Integration tests
- Implement test code rendering
- Write unit tests (10 tests: all test types)

**Deliverables:**
- TestGenerator.ts (~350 LOC)
- Unit tests (~150 LOC)

**Success Criteria:**
- ✅ Generated tests valid TypeScript
- ✅ Generated tests runnable
- ✅ >30 tests per workflow

---

#### Day 18 (Wednesday): CLI Integration + E2E Testing
**Goal:** Complete CLI integration and full pipeline testing

**Morning (4h):**
- Complete `src/cli/commands/gen.ts` (ax gen scaffold, ax gen tests)
- Register all commands

**Afternoon (4h):**
- Write integration tests:
  - `ax gen scaffold` end-to-end
  - `ax gen tests` end-to-end
  - Full pipeline: create → plan → dag → scaffold → tests
  - Validate generated workflow execution

**Deliverables:**
- gen.ts (complete, +150 LOC)
- Integration tests (~200 LOC)

**Success Criteria:**
- ✅ All CLI commands functional
- ✅ Full pipeline works end-to-end
- ✅ Generated workflows executable

---

#### Day 19 (Thursday): Documentation
**Goal:** Comprehensive Spec-Kit documentation

**Morning (4h):**
- Create **docs/spec-kit-guide.md** (User Guide):
  - Overview and motivation
  - Spec generation examples (5+ examples)
  - Plan and DAG generation
  - Scaffolding workflows
  - Test generation
  - Best practices

**Afternoon (4h):**
- Create **docs/spec-kit-api.md** (API Reference):
  - SpecGenerator API
  - PlanGenerator API
  - DAGGenerator API
  - ScaffoldGenerator API
  - TestGenerator API
  - Type definitions

**Deliverables:**
- spec-kit-guide.md (~1000 lines)
- spec-kit-api.md (~500 lines)

**Success Criteria:**
- ✅ User guide complete with examples
- ✅ API reference complete
- ✅ Best practices documented

---

#### Day 20 (Friday): Week 4 Gate Review + Polish
**Goal:** Pass quality gate and finalize Spec-Kit

**Morning (3h):**
- Update README.md (add Spec-Kit section)
- Update CLAUDE.md (add Spec-Kit commands)
- Add inline documentation (JSDoc)

**Afternoon (4h):**
- Run quality gate checklist
- Fix any issues found
- Performance profiling (generation time, memory usage)
- Final testing pass

**Evening (1h):**
- Create Week 4 gate review report
- Create Weeks 2-4 completion summary

**Deliverables:**
- Updated README.md (+150 lines)
- Updated CLAUDE.md (+100 lines)
- Week 4 gate review report
- Weeks 2-4 completion summary

**Quality Gate Checklist:**
```markdown
# Week 4 Quality Gate

## Functionality
- [x] SpecGenerator: NL → YAML workflow
- [x] PlanGenerator: Execution plan with estimates
- [x] DAGGenerator: 3 formats (ASCII, DOT, Mermaid)
- [x] ScaffoldGenerator: Complete project structure
- [x] TestGenerator: Comprehensive test suites

## CLI Commands
- [x] `ax spec create <description>` functional
- [x] `ax gen plan <workflow>` functional
- [x] `ax gen dag <workflow>` functional
- [x] `ax gen scaffold <workflow>` functional
- [x] `ax gen tests <workflow>` functional

## Testing
- [x] 50+ unit tests passing
- [x] 10+ integration tests passing
- [x] >80% test coverage
- [x] Zero flaky tests
- [x] CI green on all platforms

## Quality Metrics
- [x] >95% generated workflows valid
- [x] >90% generated workflows executable
- [x] Cost estimates within ±30% (post-launch validation)
- [x] Duration estimates within ±40%
- [x] Generated tests runnable

## Documentation
- [x] User guide complete (spec-kit-guide.md)
- [x] API reference complete (spec-kit-api.md)
- [x] Examples for all generators (5+ examples)
- [x] Inline comments >80%
- [x] README and CLAUDE.md updated

## Code Quality
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] Zod validation on all inputs
- [x] Error handling comprehensive

## Decision: PASS ✅
```

**Success Criteria:**
- ✅ All gate criteria met
- ✅ Documentation complete
- ✅ Ready for Week 5 (Iterate Mode)

---

## 📊 Effort Summary

### Week 2: Interactive CLI Completion

| Day | Tasks | LOC | Tests | Effort |
|-----|-------|-----|-------|--------|
| 6 | NaturalLanguageRouter foundation | 300 | 10 | 1.0d |
| 7 | NaturalLanguageRouter integration | 100 | 5 | 1.0d |
| 8 | Integration testing + streaming | 400 | 20 | 1.0d |
| 9 | Documentation | 700 | 0 | 1.0d |
| 10 | Gate review + polish | 120 | 0 | 1.0d |
| **Week 2 Total** | | **1,620** | **35** | **5.0d** |

### Weeks 3-4: Spec-Kit Auto-Generation

| Day | Tasks | LOC | Tests | Effort |
|-----|-------|-----|-------|--------|
| 11 | SpecGenerator foundation | 350 | 10 | 1.0d |
| 12 | SpecGenerator optimization | 100 | 10 | 1.0d |
| 13 | PlanGenerator | 400 | 15 | 1.0d |
| 14 | DAGGenerator | 300 | 12 | 1.0d |
| 15 | CLI integration + testing | 250 | 5 | 1.0d |
| 16 | ScaffoldGenerator | 450 | 10 | 1.0d |
| 17 | TestGenerator | 350 | 10 | 1.0d |
| 18 | CLI integration + E2E testing | 350 | 10 | 1.0d |
| 19 | Documentation | 1500 | 0 | 1.0d |
| 20 | Gate review + polish | 250 | 5 | 1.0d |
| **Weeks 3-4 Total** | | **4,300** | **87** | **10.0d** |

### Grand Total (Weeks 2-4)

| Metric | Week 2 | Weeks 3-4 | Total |
|--------|--------|-----------|-------|
| Production LOC | 920 | 2,800 | 3,720 |
| Test LOC | 700 | 1,500 | 2,200 |
| Total LOC | 1,620 | 4,300 | 5,920 |
| Test Cases | 35 | 87 | 122 |
| Documentation | 820 | 1,750 | 2,570 |
| Effort (days) | 5.0 | 10.0 | 15.0 |

**With 20% buffer:** 18 days → **4 weeks (20 working days)**

**Note:** This is aggressive but achievable given:
1. Week 1 foundation strong (Interactive CLI base complete)
2. Existing infrastructure robust (21 agents, multi-provider, workflows)
3. Clear scope and detailed plan
4. Sprint 2 track record: 370% delivery rate

---

## 🎯 Success Criteria

### Week 2: Interactive CLI Completion

**Functional:**
- ✅ `ax cli` launches REPL
- ✅ 13 slash commands functional
- ✅ Natural language routing to all 4 systems
- ✅ Context persists across sessions
- ✅ Token-by-token streaming <200ms

**Quality:**
- ✅ 40+ unit tests (existing) + 15+ integration tests (new)
- ✅ >80% test coverage
- ✅ Zero flaky tests
- ✅ CI green on all platforms

**Documentation:**
- ✅ User guide complete
- ✅ Architecture docs complete
- ✅ README updated

### Weeks 3-4: Spec-Kit Auto-Generation

**Functional:**
- ✅ SpecGenerator: NL → valid YAML workflow (>95%)
- ✅ PlanGenerator: Execution plan with cost/time (±30-40%)
- ✅ DAGGenerator: 3 graph formats (ASCII, DOT, Mermaid)
- ✅ ScaffoldGenerator: Complete project structure
- ✅ TestGenerator: Runnable test suites (>30 tests/workflow)

**Quality:**
- ✅ >95% generated workflows valid
- ✅ >90% generated workflows executable
- ✅ 50+ unit tests, 10+ integration tests
- ✅ >80% test coverage
- ✅ Zero flaky tests

**Documentation:**
- ✅ Comprehensive user guide (spec-kit-guide.md)
- ✅ Complete API reference (spec-kit-api.md)
- ✅ 5+ examples for each generator
- ✅ README and CLAUDE.md updated

---

## 🚨 Risk Management

### Risk 1: LLM Reliability (SpecGenerator)

**Risk:** Generated workflows may be invalid or incorrect (Target: >95% valid)

**Likelihood:** Medium (LLMs can hallucinate agents, create invalid YAML)

**Impact:** High (Blocks Spec-Kit adoption)

**Mitigation Strategies:**
1. **Extensive prompt engineering** with 5+ high-quality examples
2. **Schema validation** catches 95%+ structural errors
3. **Agent registry validation** catches 100% invalid agents
4. **Cycle detection** catches 100% circular dependencies
5. **Retry mechanism** with error feedback (one retry attempt)
6. **Conservative estimates** (overestimate by 20%)

**Contingency:**
- If <90% validity: Add more examples, tighten schema, improve prompts
- If <80% validity: Switch to template-based generation with LLM refinement
- If <70% validity: Fallback to manual YAML with LLM suggestions

**Monitoring:**
- Track validity rate in telemetry
- Log all validation failures for analysis
- Weekly review of failure patterns

### Risk 2: Performance (Natural Language Routing)

**Risk:** LLM calls for intent classification may be slow (>1s)

**Likelihood:** Low (pattern matching covers 80%, LLM fallback only 20%)

**Impact:** Medium (Poor UX for 20% of queries)

**Mitigation Strategies:**
1. **Pattern matching first** (fast path, 80% coverage, <100ms)
2. **LLM fallback** only for ambiguous queries (20%, <5s)
3. **Caching** for common intents (reduces LLM calls)
4. **Prefetching** based on conversation context
5. **Use Haiku** for LLM fallback (faster, cheaper than Sonnet)

**Contingency:**
- If pattern matching <70% accuracy: Expand pattern library (add 50+ patterns)
- If LLM fallback >5s: Switch to local embedding classification
- If overall >2s P95: Disable LLM fallback, rely solely on patterns

**Monitoring:**
- Track intent classification latency (P50, P95, P99)
- Track pattern vs LLM usage ratio (target: 80/20)
- Track classification accuracy (user corrections)

### Risk 3: Integration Complexity

**Risk:** Integrating 5 generators + routing may reveal unexpected issues

**Likelihood:** Medium (Many integration points, new code)

**Impact:** Medium (Delays delivery, requires debugging)

**Mitigation Strategies:**
1. **Incremental integration** (one generator at a time)
2. **Comprehensive integration tests** (15+ scenarios per component)
3. **Rollback plan** (feature flags for Interactive CLI and Spec-Kit)
4. **Staging environment** for validation before production

**Contingency:**
- If integration issues: Isolate problem component, fix, re-integrate
- If persistent bugs: Extend Week 4 by 2-3 days (buffer)
- If critical blocker: Ship Interactive CLI only, defer Spec-Kit to Week 5

**Monitoring:**
- Track integration test pass rate (target: 100%)
- Track bug reports during implementation
- Daily standup to surface blockers early

### Risk 4: Test Flakiness

**Risk:** New integration tests may be flaky (intermittent failures)

**Likelihood:** Low (Deterministic test fixtures, mock external dependencies)

**Impact:** High (Blocks CI/CD, wastes time debugging)

**Mitigation Strategies:**
1. **Deterministic test fixtures** (fixed inputs, mock LLM responses)
2. **Mock external dependencies** (LLM, file system, databases)
3. **Retry logic in CI** (max 3 retries for integration tests)
4. **Timeout tuning** (realistic timeouts, avoid false negatives)
5. **Parallel test isolation** (no shared state between tests)

**Contingency:**
- If flaky tests appear: Add explicit waits, improve mocking
- If persistent: Disable flaky tests temporarily, create bug tickets
- If widespread: Review test architecture, refactor for determinism

**Monitoring:**
- Track test failure rate in CI (target: 0% flaky)
- Track test duration (flag slow tests >30s)
- Weekly review of test reliability

### Risk 5: Scope Creep

**Risk:** Additional features requested during implementation

**Likelihood:** Medium (Stakeholders see progress, request enhancements)

**Impact:** High (Delays Week 2-4 delivery)

**Mitigation Strategies:**
1. **Strict scope adherence** (Week 2-4 plan is final)
2. **P2/P3 backlog** for deferred features
3. **Stakeholder communication** (manage expectations)
4. **Weekly updates** showing progress against plan

**Contingency:**
- If requests come in: Document as P2, defer to Week 5+
- If critical P0: Negotiate scope trade-offs (drop P1 feature)
- If stakeholder insists: Extend timeline transparently

**Monitoring:**
- Track feature requests (log all, prioritize later)
- Track scope changes (should be zero)
- Weekly scope review in standup

---

## 🔄 Daily Standup Template

**Format:** 15 minutes, asynchronous updates

**Template:**
```markdown
## Day X Update

### Completed ✅
- [ ] Task 1 (Component: LOC, Tests)
- [ ] Task 2

### In Progress 🚧
- [ ] Task 3 (ETA: EOD)

### Blocked 🚨
- [ ] Task 4 (Blocker: XYZ, Owner: ABC)

### Risks 🚨
- Risk 1: Description (Likelihood: Low, Impact: Medium, Mitigation: ABC)

### Metrics 📊
- LOC added today: X
- Tests added today: Y
- Test coverage: Z%
- CI status: Green/Red

### Next (Tomorrow) 📅
- [ ] Task 5
- [ ] Task 6
```

---

## 🎉 Definition of Done

### Week 2: Interactive CLI Completion

**Code:**
- [x] NaturalLanguageRouter implemented (250 LOC)
- [x] Integration tests complete (300 LOC, 15 scenarios)
- [x] StreamingHandler enhanced (100 LOC additions)
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] >80% test coverage

**Testing:**
- [x] All unit tests passing (40+ tests)
- [x] All integration tests passing (15+ tests)
- [x] Zero flaky tests
- [x] CI green on all platforms (macOS, Linux, Windows)

**Performance:**
- [x] Streaming latency <200ms (P95)
- [x] Pattern matching <100ms (P95)
- [x] Memory usage <100MB (after 50 messages)

**Documentation:**
- [x] User guide updated (interactive-cli-guide.md)
- [x] Architecture docs complete (interactive-cli-architecture.md)
- [x] README updated
- [x] Inline comments >80%
- [x] API docs generated (TypeDoc)

**Quality Gate:**
- [x] All functionality working
- [x] All tests passing
- [x] All documentation complete
- [x] Performance targets met
- [x] Ready for production

### Weeks 3-4: Spec-Kit Auto-Generation

**Code:**
- [x] SpecGenerator implemented (400 LOC)
- [x] PlanGenerator implemented (400 LOC)
- [x] DAGGenerator implemented (300 LOC)
- [x] ScaffoldGenerator implemented (450 LOC)
- [x] TestGenerator implemented (350 LOC)
- [x] CLI commands implemented (350 LOC)
- [x] No TypeScript errors
- [x] No ESLint warnings
- [x] >80% test coverage

**Testing:**
- [x] All unit tests passing (50+ tests)
- [x] All integration tests passing (10+ tests)
- [x] Zero flaky tests
- [x] CI green on all platforms

**Quality Metrics:**
- [x] >95% generated workflows valid
- [x] >90% generated workflows executable
- [x] Cost estimates within ±30%
- [x] Duration estimates within ±40%
- [x] Generated tests runnable

**Documentation:**
- [x] User guide complete (spec-kit-guide.md, 1000 lines)
- [x] API reference complete (spec-kit-api.md, 500 lines)
- [x] Examples for all generators (5+ examples)
- [x] README and CLAUDE.md updated
- [x] Inline comments >80%

**Quality Gate:**
- [x] All 5 generators working
- [x] All CLI commands working
- [x] All tests passing
- [x] Quality metrics met
- [x] All documentation complete
- [x] Ready for production

---

## 🚀 Next Steps (After Week 4)

### Week 5: Iterate Mode (Days 21-25)

**Scope:**
- IterateEngine: Retry loop orchestration
- StrategySelector: 5 builtin strategies
- FailureAnalyzer: Error classification
- SafetyEvaluator: 3 safety levels
- CLI: `ax run --iterate --safety normal`

**Effort:** 5 days
**Deliverables:** Autonomous retry loops with adaptive strategies

### Week 6: Natural Language Interface (Days 26-30)

**Scope:**
- IntentClassifier: 15 CLI command intents
- EntityExtractor: Parameter extraction
- CommandMapper: Intent → CLI command
- ClarificationHandler: Interactive prompts
- CLI: `ax "run security audit"`

**Effort:** 5 days
**Deliverables:** Natural language command execution

### Week 7-10: Production Rollout

**Week 7: Internal Alpha**
- Internal testing with engineering team
- Bug fixes and polish
- Performance tuning

**Week 8-9: External Beta**
- Beta program (50-100 users)
- Gather feedback
- Bug fixes
- Documentation refinement

**Week 10: General Availability**
- v8.0.0 GA release
- Marketing launch
- User onboarding
- Celebration! 🎉

---

## 🏁 Bottom Line

**Weeks 2-4 Mission:**
Complete Interactive CLI (Week 2) + implement Spec-Kit (Weeks 3-4) to achieve v7.6.1 P0 feature parity.

**Impact:**
- **Accessibility:** v8.0.0 becomes usable by non-expert users (5% → 95%)
- **Productivity:** 10x faster workflow creation (50 min → 5 min)
- **Quality:** AI-generated workflows with best practices baked in
- **Foundation:** Enables Week 5 (Iterate Mode) and Week 6 (Natural Language)

**Timeline:**
- Week 2: 5 days (Interactive CLI completion)
- Weeks 3-4: 10 days (Spec-Kit Auto-Generation)
- **Total:** 15 days (3 weeks)

**Effort:**
- Week 2: 1,620 LOC (920 production + 700 tests) + 820 lines docs
- Weeks 3-4: 4,300 LOC (2,800 production + 1,500 tests) + 1,750 lines docs
- **Total:** 5,920 LOC + 2,570 lines docs

**Confidence:** HIGH
- Week 1 foundation strong (Interactive CLI base complete)
- Existing infrastructure robust (21 agents, multi-provider, workflows)
- Clear scope with detailed day-by-day plan
- Sprint 2 track record: 370% delivery rate
- Realistic effort estimates with 20% buffer

**Status:** READY TO EXECUTE 🚀

**Recommendation:**
Proceed with Weeks 2-4 implementation as planned. This analysis provides:
1. Complete strategic context
2. Detailed component specifications
3. Day-by-day implementation plan
4. Comprehensive risk management
5. Clear success criteria

Execute with confidence. v8.0.0 feature parity is within reach!

---

**END OF MEGATHINKING ANALYSIS**
