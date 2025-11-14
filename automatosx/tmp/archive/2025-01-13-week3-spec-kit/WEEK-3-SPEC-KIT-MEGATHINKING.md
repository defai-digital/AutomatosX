# 🧠 Week 3-4: Spec-Kit Auto-Generation - MEGATHINKING

**Date:** 2025-01-13
**Phase:** Week 3-4 of v8.0.0 → v8.1.0 Roadmap
**Features:** 5 Generators (Spec, Plan, DAG, Scaffold, Test)
**Timeline:** 10 days (2 weeks)
**Status:** Ready for Implementation

---

## 🎯 EXECUTIVE SUMMARY

### Mission

Implement **Spec-Kit Auto-Generation** to transform natural language into production-ready workflows, execution plans, dependency graphs, project scaffolds, and test suites.

### Impact

- **10x Productivity:** Generate workflows in 5 minutes vs 50 minutes manual authoring
- **Universal Access:** Non-technical users can create complex workflows
- **Quality Assurance:** AI follows best practices automatically
- **Rapid Iteration:** Refine workflows through natural language

### Success Criteria

```bash
✅ ax spec create "description" → generates valid YAML workflow
✅ ax gen plan workflow.yaml → execution plan with cost/time
✅ ax gen dag workflow.yaml → dependency graph visualization
✅ ax gen scaffold workflow.yaml → complete project structure
✅ ax gen tests workflow.yaml → comprehensive test suite
✅ >90% generated workflows execute successfully
```

---

## 📊 CURRENT STATE ANALYSIS

### What We Have (v8.0.0 + Recent Refinements)

**Infrastructure ✅ (Ready to Use):**
- ✅ ProviderRouterV2 (multi-provider AI)
- ✅ WorkflowParser (YAML parsing & validation)
- ✅ WorkflowEngineV2 (execution)
- ✅ AgentRegistry (21 agents)
- ✅ TemplateEngine (if exists, need to check)
- ✅ FileSystem utilities
- ✅ CLI framework (Commander.js)

**Recent Additions ✅:**
- ✅ IntentLearningSystem (can help with spec generation)
- ✅ ContextAware Classification (useful for understanding descriptions)
- ✅ IterateStrategies (can integrate with test generation)
- ✅ StrategyTelemetry (track spec generation success)

**Gaps ❌ (Need to Build):**
- ❌ SpecGenerator class
- ❌ PlanGenerator class
- ❌ DAGGenerator class
- ❌ ScaffoldGenerator class
- ❌ TestGenerator class
- ❌ CostEstimator class
- ❌ DependencyGraph utilities
- ❌ CLI commands (`ax spec`, `ax gen`)

---

## 🏗️ ARCHITECTURE DESIGN

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                 CLI Layer (User Interface)                   │
├─────────────────────────────────────────────────────────────┤
│  ax spec create <desc>                                       │
│  ax gen plan <workflow>                                      │
│  ax gen dag <workflow>                                       │
│  ax gen scaffold <workflow>                                  │
│  ax gen tests <workflow>                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│             Generator Layer (Core Logic)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     Spec     │  │     Plan     │  │      DAG     │      │
│  │  Generator   │  │  Generator   │  │  Generator   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ┌──────┴───────┐  ┌──────┴───────┐          │              │
│  │   Scaffold   │  │     Test     │          │              │
│  │  Generator   │  │  Generator   │          │              │
│  └──────────────┘  └──────────────┘          │              │
└───────────┬────────────────────┬──────────────┼─────────────┘
            │                    │              │
            ▼                    ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│           Utility Layer (Shared Services)                    │
├─────────────────────────────────────────────────────────────┤
│  DependencyGraph  │  CostEstimator  │  TemplateRegistry     │
│  ValidationEngine │  SchemaValidator │  FileSystemHelper    │
└───────────┬───────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│         Foundation Layer (Existing v8.0.0)                   │
├─────────────────────────────────────────────────────────────┤
│  ProviderRouterV2  │  WorkflowParser  │  AgentRegistry      │
│  WorkflowEngineV2  │  FileSystem      │  CLI Framework      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (Natural Language Description)
          │
          ▼
    SpecGenerator
    ├─ Parse description
    ├─ Call ProviderRouter (AI generation)
    ├─ Validate YAML
    └─ Write to file
          │
          ▼
    Generated Workflow YAML
          │
          ├──────────┬──────────┬──────────┬──────────┐
          ▼          ▼          ▼          ▼          ▼
    PlanGenerator  DAGGenerator  ScaffoldGen  TestGen
    │              │              │            │
    ▼              ▼              ▼            ▼
Execution Plan  Dependency Graph  Project Files  Test Suite
```

---

## 📋 IMPLEMENTATION PLAN - 10 DAYS

### Week 3: Days 1-5 (Core Generation)

#### Day 1: Foundation & SpecGenerator Core

**Morning (4 hours):**
1. **Create directory structure** (30 min)
   ```bash
   mkdir -p src/speckit
   mkdir -p src/speckit/__tests__
   mkdir -p src/speckit/utils
   ```

2. **Create shared types** (1 hour)
   ```typescript
   // src/speckit/types.ts
   export interface SpecOptions {
     outputPath?: string;
     projectName?: string;
     verbosity?: 'minimal' | 'normal' | 'detailed';
     agents?: string[];
     maxSteps?: number;
     includeTests?: boolean;
   }

   export interface GeneratedSpec {
     yaml: string;
     definition: WorkflowDefinition;
     outputPath: string;
     metadata: SpecMetadata;
   }

   export interface SpecMetadata {
     generatedAt: Date;
     description: string;
     stepsCount: number;
     estimatedDuration: number;
     estimatedCost: number;
   }
   ```

3. **Implement SpecGenerator (core)** (2.5 hours)
   ```typescript
   // src/speckit/SpecGenerator.ts
   export class SpecGenerator {
     constructor(
       private providerRouter: ProviderRouterV2,
       private agentRegistry: AgentRegistry,
       private workflowParser: WorkflowParser
     ) {}

     async generateSpec(
       description: string,
       options: SpecOptions = {}
     ): Promise<GeneratedSpec> {
       // 1. Build AI prompt
       const prompt = this.buildPrompt(description, options);

       // 2. Call AI provider
       const response = await this.providerRouter.route({
         messages: [{ role: 'user', content: prompt }],
         provider: 'claude', // Best for structured output
         temperature: 0.3   // Lower for deterministic YAML
       });

       // 3. Extract YAML from response
       const yaml = this.extractYAML(response.content);

       // 4. Parse and validate
       const definition = this.parseYAML(yaml);
       const validation = await this.validateSpec(definition);

       if (!validation.valid) {
         throw new Error(`Invalid spec: ${validation.errors.join(', ')}`);
       }

       // 5. Enrich with metadata
       const metadata = this.generateMetadata(definition, description);

       // 6. Write to file
       const outputPath = await this.writeSpec(yaml, options);

       return {
         yaml,
         definition,
         outputPath,
         metadata
       };
     }

     private buildPrompt(
       description: string,
       options: SpecOptions
     ): string {
       const agents = this.agentRegistry.list()
         .filter(a => !options.agents || options.agents.includes(a.name))
         .map(a => `- ${a.name}: ${a.description}`)
         .join('\n');

       return `You are a workflow architect for AutomatosX v8.0.0.

Generate a YAML workflow for:
"""
${description}
"""

Available Agents:
${agents}

YAML Schema:
\`\`\`yaml
name: "Workflow Name"
version: "1.0.0"
description: "Description"

steps:
  - id: "step-id"
    name: "Step Name"
    agent: "agent-name"
    action: "action-name"
    config:
      key: value
    dependsOn: []
    retryConfig:
      maxRetries: 3
      backoffMs: 1000
    timeout: 300000
\`\`\`

Requirements:
1. Use appropriate agents
2. Define clear dependencies
3. Include error handling
4. Add reasonable timeouts
5. ${options.maxSteps ? `Maximum ${options.maxSteps} steps` : 'Optimize step count'}

Output ONLY valid YAML:`;
     }

     private extractYAML(response: string): string {
       // Extract YAML from markdown code blocks
       const yamlMatch = response.match(/```ya?ml\n([\s\S]*?)\n```/);
       if (yamlMatch) {
         return yamlMatch[1];
       }

       // If no code block, assume entire response is YAML
       return response.trim();
     }

     private parseYAML(yaml: string): WorkflowDefinition {
       try {
         return this.workflowParser.parse(yaml);
       } catch (error) {
         throw new Error(`YAML parsing failed: ${(error as Error).message}`);
       }
     }

     private async validateSpec(
       definition: WorkflowDefinition
     ): Promise<ValidationResult> {
       const errors: string[] = [];

       // Validate required fields
       if (!definition.name) errors.push('Missing workflow name');
       if (!definition.version) errors.push('Missing version');
       if (!definition.steps || definition.steps.length === 0) {
         errors.push('No steps defined');
       }

       // Validate each step
       definition.steps?.forEach((step, index) => {
         if (!step.id) errors.push(`Step ${index}: missing id`);
         if (!step.agent) errors.push(`Step ${step.id}: missing agent`);
         if (!step.action) errors.push(`Step ${step.id}: missing action`);

         // Validate dependencies exist
         step.dependsOn?.forEach(depId => {
           if (!definition.steps?.some(s => s.id === depId)) {
             errors.push(`Step ${step.id}: invalid dependency ${depId}`);
           }
         });

         // Validate agent exists
         if (!this.agentRegistry.get(step.agent)) {
           errors.push(`Step ${step.id}: unknown agent ${step.agent}`);
         }
       });

       return {
         valid: errors.length === 0,
         errors
       };
     }

     private generateMetadata(
       definition: WorkflowDefinition,
       description: string
     ): SpecMetadata {
       return {
         generatedAt: new Date(),
         description,
         stepsCount: definition.steps?.length || 0,
         estimatedDuration: this.estimateDuration(definition),
         estimatedCost: this.estimateCost(definition)
       };
     }

     private estimateDuration(definition: WorkflowDefinition): number {
       // Simple heuristic: 5s per step
       return (definition.steps?.length || 0) * 5000;
     }

     private estimateCost(definition: WorkflowDefinition): number {
       // Simple heuristic: $0.01 per step
       return (definition.steps?.length || 0) * 0.01;
     }

     private async writeSpec(
       yaml: string,
       options: SpecOptions
     ): Promise<string> {
       const timestamp = new Date().toISOString().split('T')[0];
       const filename = options.projectName
         ? `${options.projectName}.yaml`
         : `workflow-${timestamp}.yaml`;

       const dir = options.outputPath || 'workflows';
       const path = join(dir, filename);

       await fs.mkdir(dir, { recursive: true });
       await fs.writeFile(path, yaml, 'utf-8');

       return path;
     }
   }
   ```

**Afternoon (4 hours):**
4. **Write tests for SpecGenerator** (2 hours)
   ```typescript
   // src/speckit/__tests__/SpecGenerator.test.ts
   describe('SpecGenerator', () => {
     it('should generate valid workflow from description', async () => {
       const spec = await generator.generateSpec(
         'Scan dependencies for vulnerabilities'
       );

       expect(spec.definition.name).toBeDefined();
       expect(spec.definition.steps.length).toBeGreaterThan(0);
       expect(spec.yaml).toContain('name:');
     });

     it('should validate agent exists', async () => {
       await expect(
         generator.generateSpec('Use invalid-agent')
       ).rejects.toThrow('unknown agent');
     });

     it('should detect circular dependencies', async () => {
       // Test with malformed YAML
     });
   });
   ```

5. **Create CLI command `ax spec create`** (2 hours)
   ```typescript
   // src/cli/commands/spec.ts
   export function createSpecCommand(): Command {
     const cmd = new Command('spec');

     cmd
       .command('create <description>')
       .description('Generate workflow from natural language')
       .option('-o, --output <path>', 'Output directory', 'workflows')
       .option('-n, --name <name>', 'Project name')
       .option('--agents <agents>', 'Restrict to specific agents')
       .option('--max-steps <number>', 'Maximum steps', parseInt)
       .action(async (description, options) => {
         try {
           const db = getDatabase();
           const providerRouter = new ProviderRouterV2();
           const agentRegistry = new AgentRegistry();
           const workflowParser = new WorkflowParser();

           const generator = new SpecGenerator(
             providerRouter,
             agentRegistry,
             workflowParser
           );

           console.log(chalk.cyan('\n🔨 Generating workflow spec...\n'));

           const spec = await generator.generateSpec(description, {
             outputPath: options.output,
             projectName: options.name,
             agents: options.agents?.split(','),
             maxSteps: options.maxSteps
           });

           console.log(chalk.green(`✅ Generated: ${spec.outputPath}`));
           console.log(chalk.gray(`   Steps: ${spec.metadata.stepsCount}`));
           console.log(chalk.gray(`   Est. Duration: ~${formatDuration(spec.metadata.estimatedDuration)}`));
           console.log(chalk.gray(`   Est. Cost: ~$${spec.metadata.estimatedCost.toFixed(2)}\n`));

         } catch (error) {
           console.error(chalk.red('❌ Spec generation failed:'), (error as Error).message);
           process.exit(1);
         }
       });

     return cmd;
   }
   ```

**End of Day 1:**
- ✅ SpecGenerator implemented and tested
- ✅ `ax spec create` command working
- ✅ Can generate workflows from natural language

---

#### Day 2: PlanGenerator & CostEstimator

**Morning (4 hours):**
1. **Create CostEstimator** (1.5 hours)
   ```typescript
   // src/speckit/utils/CostEstimator.ts
   export class CostEstimator {
     private pricing = {
       claude: {
         input: 0.008 / 1000,  // per 1K tokens
         output: 0.024 / 1000
       },
       gemini: {
         input: 0.00025 / 1000,
         output: 0.000125 / 1000
       },
       openai: {
         input: 0.01 / 1000,
         output: 0.03 / 1000
       }
     };

     estimate(params: {
       agent: string;
       action: string;
       inputTokens?: number;
       outputTokens?: number;
     }): number {
       const provider = this.getProviderForAgent(params.agent);
       const pricing = this.pricing[provider] || this.pricing.claude;

       const inputCost = (params.inputTokens || 1000) * pricing.input;
       const outputCost = (params.outputTokens || 500) * pricing.output;

       return inputCost + outputCost;
     }

     private getProviderForAgent(agent: string): 'claude' | 'gemini' | 'openai' {
       // Default to Claude for most agents
       return 'claude';
     }
   }
   ```

2. **Create DependencyGraph utility** (1.5 hours)
   ```typescript
   // src/speckit/utils/DependencyGraph.ts
   export class DependencyGraph {
     private graph = new Map<string, Set<string>>();
     private reverseGraph = new Map<string, Set<string>>();

     constructor(steps: Step[]) {
       this.buildGraph(steps);
     }

     private buildGraph(steps: Step[]): void {
       steps.forEach(step => {
         this.graph.set(step.id, new Set(step.dependsOn || []));

         (step.dependsOn || []).forEach(depId => {
           if (!this.reverseGraph.has(depId)) {
             this.reverseGraph.set(depId, new Set());
           }
           this.reverseGraph.get(depId)!.add(step.id);
         });
       });
     }

     topologicalSort(): string[][] {
       const levels: string[][] = [];
       const inDegree = new Map<string, number>();

       // Calculate in-degrees
       this.graph.forEach((deps, id) => {
         inDegree.set(id, deps.size);
       });

       // Process levels
       while (inDegree.size > 0) {
         const level: string[] = [];

         inDegree.forEach((degree, id) => {
           if (degree === 0) {
             level.push(id);
           }
         });

         if (level.length === 0) {
           throw new Error('Circular dependency detected');
         }

         levels.push(level);

         // Remove processed nodes
         level.forEach(id => {
           inDegree.delete(id);
           this.reverseGraph.get(id)?.forEach(depId => {
             inDegree.set(depId, inDegree.get(depId)! - 1);
           });
         });
       }

       return levels;
     }

     findCriticalPath(stepDurations: Map<string, number>): string[] {
       // Longest path in DAG
       const distances = new Map<string, number>();
       const predecessors = new Map<string, string>();

       const sorted = this.topologicalSort().flat();

       sorted.forEach(id => {
         let maxDistance = 0;
         let maxPred: string | undefined;

         this.graph.get(id)?.forEach(depId => {
           const dist = (distances.get(depId) || 0) + (stepDurations.get(depId) || 0);
           if (dist > maxDistance) {
             maxDistance = dist;
             maxPred = depId;
           }
         });

         distances.set(id, maxDistance);
         if (maxPred) {
           predecessors.set(id, maxPred);
         }
       });

       // Backtrack to find path
       const path: string[] = [];
       let current = sorted[sorted.length - 1];

       while (current) {
         path.unshift(current);
         current = predecessors.get(current)!;
       }

       return path;
     }

     detectCycles(): string[][] {
       const cycles: string[][] = [];
       const visited = new Set<string>();
       const recursionStack = new Set<string>();

       const dfs = (node: string, path: string[]): void => {
         visited.add(node);
         recursionStack.add(node);
         path.push(node);

         this.graph.get(node)?.forEach(neighbor => {
           if (!visited.has(neighbor)) {
             dfs(neighbor, [...path]);
           } else if (recursionStack.has(neighbor)) {
             const cycleStart = path.indexOf(neighbor);
             cycles.push(path.slice(cycleStart));
           }
         });

         recursionStack.delete(node);
       };

       this.graph.forEach((_, node) => {
         if (!visited.has(node)) {
           dfs(node, []);
         }
       });

       return cycles;
     }
   }
   ```

3. **Implement PlanGenerator (core)** (1 hour)
   ```typescript
   // src/speckit/PlanGenerator.ts
   export class PlanGenerator {
     constructor(
       private workflowParser: WorkflowParser,
       private costEstimator: CostEstimator
     ) {}

     async generatePlan(workflowPath: string): Promise<ExecutionPlan> {
       const definition = await this.workflowParser.parseFile(workflowPath);
       const graph = new DependencyGraph(definition.steps);

       // Detect cycles first
       const cycles = graph.detectCycles();
       if (cycles.length > 0) {
         throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' → ')).join(', ')}`);
       }

       const levels = graph.topologicalSort();
       const phases = this.createPhases(levels, definition.steps);

       const stepDurations = new Map(
         definition.steps.map(s => [s.id, this.estimateStepDuration(s)])
       );

       return {
         phases,
         totalSteps: definition.steps.length,
         totalDuration: this.calculateTotalDuration(phases),
         totalCost: this.calculateTotalCost(phases),
         parallelizationRatio: this.calculateParallelization(phases),
         criticalPath: graph.findCriticalPath(stepDurations)
       };
     }

     private createPhases(
       levels: string[][],
       steps: Step[]
     ): ExecutionPhase[] {
       return levels.map((stepIds, index) => {
         const phaseSteps = stepIds.map(id => {
           const step = steps.find(s => s.id === id)!;
           return this.createPlanStep(step);
         });

         const duration = Math.max(...phaseSteps.map(s => s.estimatedDuration));
         const cost = phaseSteps.reduce((sum, s) => sum + s.estimatedCost, 0);

         return {
           phaseNumber: index + 1,
           name: `Phase ${index + 1}`,
           steps: phaseSteps,
           duration,
           cost,
           canParallelize: stepIds.length > 1
         };
       });
     }

     private createPlanStep(step: Step): PlanStep {
       return {
         id: step.id,
         name: step.name,
         agent: step.agent,
         estimatedDuration: this.estimateStepDuration(step),
         estimatedCost: this.costEstimator.estimate({
           agent: step.agent,
           action: step.action
         }),
         dependencies: step.dependsOn || [],
         risks: this.identifyRisks(step)
       };
     }

     private estimateStepDuration(step: Step): number {
       const baseTime = 5000; // 5s
       const multipliers = {
         security: 3.0,
         quality: 2.5,
         testing: 2.0,
         default: 1.5
       };

       const multiplier = multipliers[step.agent as keyof typeof multipliers]
         || multipliers.default;

       return (step.timeout || baseTime) * multiplier;
     }

     private identifyRisks(step: Step): string[] {
       const risks: string[] = [];

       if (!step.retryConfig) {
         risks.push('No retry configured');
       }

       if (step.timeout && step.timeout > 300000) {
         risks.push('Long timeout (>5min)');
       }

       if (step.continueOnError) {
         risks.push('Continues on error');
       }

       return risks;
     }

     private calculateTotalDuration(phases: ExecutionPhase[]): number {
       return phases.reduce((sum, p) => sum + p.duration, 0);
     }

     private calculateTotalCost(phases: ExecutionPhase[]): number {
       return phases.reduce((sum, p) => sum + p.cost, 0);
     }

     private calculateParallelization(phases: ExecutionPhase[]): number {
       const parallelSteps = phases
         .filter(p => p.canParallelize)
         .reduce((sum, p) => sum + p.steps.length, 0);

       const totalSteps = phases.reduce((sum, p) => sum + p.steps.length, 0);

       return totalSteps > 0 ? parallelSteps / totalSteps : 0;
     }
   }
   ```

**Afternoon (4 hours):**
4. **Write tests** (2 hours)
5. **Create CLI command `ax gen plan`** (2 hours)

**End of Day 2:**
- ✅ PlanGenerator implemented
- ✅ CostEstimator working
- ✅ DependencyGraph utility complete
- ✅ `ax gen plan` command functional

---

#### Day 3: DAGGenerator

**Morning (4 hours):**
1. **Implement DAGGenerator** (3 hours)
   - ASCII art output
   - DOT format output
   - Mermaid format output

2. **Create CLI command `ax gen dag`** (1 hour)

**Afternoon (4 hours):**
3. **Write tests** (2 hours)
4. **Integration testing** (2 hours)

**End of Day 3:**
- ✅ DAGGenerator complete
- ✅ Multiple output formats
- ✅ `ax gen dag` command working

---

#### Day 4: ScaffoldGenerator

**Morning (4 hours):**
1. **Implement ScaffoldGenerator** (3 hours)
   - Project structure generation
   - Config file creation
   - Scripts generation
   - README generation

2. **Create templates** (1 hour)

**Afternoon (4 hours):**
3. **Write tests** (2 hours)
4. **Create CLI command `ax gen scaffold`** (2 hours)

**End of Day 4:**
- ✅ ScaffoldGenerator complete
- ✅ `ax gen scaffold` working

---

#### Day 5: TestGenerator & Gate Review

**Morning (4 hours):**
1. **Implement TestGenerator** (3 hours)
   - Unit test generation
   - Integration test generation
   - Test utilities

2. **Create CLI command `ax gen tests`** (1 hour)

**Afternoon (4 hours):**
3. **Integration testing** (2 hours)
4. **Gate Review Prep** (2 hours)
   - Documentation
   - Examples
   - Demo preparation

**End of Day 5:**
- ✅ TestGenerator complete
- ✅ All 5 generators working
- ✅ GATE REVIEW READY

---

### Week 4: Days 6-10 (Polish & Integration)

#### Day 6-7: Polish & Bug Fixes

**Tasks:**
- Fix bugs found in Gate Review
- Performance optimization
- Error handling improvements
- UX polish

#### Day 8-9: Documentation & Examples

**Tasks:**
- User guide for Spec-Kit
- API reference
- 10+ example workflows
- Tutorial videos (screen recordings)

#### Day 10: Final Gate Review

**Tasks:**
- E2E testing
- Performance benchmarks
- Final documentation review
- Launch preparation

---

## 📊 SUCCESS METRICS

### Functional Requirements

- [ ] `ax spec create` generates valid YAML
- [ ] `ax gen plan` shows accurate estimates
- [ ] `ax gen dag` visualizes dependencies
- [ ] `ax gen scaffold` creates complete project
- [ ] `ax gen tests` generates passing tests
- [ ] >90% generated workflows execute successfully
- [ ] <5s average generation time
- [ ] <$0.10 average generation cost

### Quality Requirements

- [ ] Unit test coverage >80%
- [ ] All integration tests pass
- [ ] 0 P0 bugs
- [ ] <10 P1 bugs
- [ ] Code reviewed and approved
- [ ] Documentation complete

---

## 🎯 DELIVERABLES

### Code Files (20+ files)

**Core Generators:**
1. `src/speckit/SpecGenerator.ts`
2. `src/speckit/PlanGenerator.ts`
3. `src/speckit/DAGGenerator.ts`
4. `src/speckit/ScaffoldGenerator.ts`
5. `src/speckit/TestGenerator.ts`

**Utilities:**
6. `src/speckit/utils/CostEstimator.ts`
7. `src/speckit/utils/DependencyGraph.ts`
8. `src/speckit/utils/TemplateRegistry.ts`
9. `src/speckit/utils/ValidationEngine.ts`

**CLI Commands:**
10. `src/cli/commands/spec.ts`
11. `src/cli/commands/gen.ts`

**Tests:**
12-20. Test files for each generator

**Types:**
21. `src/speckit/types.ts`

### Documentation

- User guide: `docs/speckit-guide.md`
- API reference: `docs/speckit-api.md`
- Examples: `examples/speckit/`

---

## 💡 RECOMMENDATION

**Start Day 1 implementation immediately:**

1. ✅ Create directory structure
2. ✅ Implement SpecGenerator core
3. ✅ Create `ax spec create` command
4. ✅ Test with real descriptions

**Timeline:** 10 days to complete all 5 generators

**Confidence:** 90% (well-defined requirements, existing infrastructure)

**Would you like me to start implementing Day 1 now?**

---

**Megathinking Complete**
**Status:** Ready to Implement Week 3-4 Spec-Kit
**Next Action:** Begin Day 1 Implementation
