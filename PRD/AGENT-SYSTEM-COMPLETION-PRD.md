# Agent System Completion PRD

## Executive Summary

The AutomatosX agent system has significant implementation gaps that prevent agents from executing meaningful work. This PRD outlines the comprehensive plan to make agents fully functional.

**Current State:**
- 80% of agents (16/20) have NO workflows defined
- 2 agents with workflows have empty `config.prompt` fields (timeout on execution)
- Analysis tools (bugfix_scan, refactor_scan) are placeholder implementations
- No validation prevents malformed agent configurations

**Target State:**
- All agents have complete, executable workflows
- All workflow steps have proper prompt templates
- Analysis tools perform real code analysis
- Validation prevents deployment of broken agents

---

## Problem Analysis

### Issue 1: Missing Workflows (Critical)

**Affected Agents (16):**
| Agent | Role | Missing Workflow |
|-------|------|-----------------|
| quality | QA Engineer | Yes |
| architecture | System Architect | Yes |
| devops | DevOps Engineer | Yes |
| mobile | Mobile Developer | Yes |
| cto | CTO Strategist | Yes |
| ceo | CEO Strategist | Yes |
| data-scientist | Data Scientist | Yes |
| fullstack | Full-stack Engineer | Yes |
| product | Product Manager | Yes |
| researcher | Research Specialist | Yes |
| blockchain-developer | Blockchain Dev | Yes |
| quantum-engineer | Quantum Engineer | Yes |
| aerospace-scientist | Aerospace Specialist | Yes |
| standard | General Assistant | Yes* |
| writer | Technical Writer | Yes* |
| backend | Backend Engineer | Yes* |

*Note: standard, writer, backend were updated but changes not persisted properly

**Impact:** Agents return immediately with "no workflow steps defined" message.

### Issue 2: Empty Prompt Configurations (Critical)

**Affected Agents:**
- `ml-engineer`: 3 steps with `config: {}`
- `creative-marketer`: 3 steps with `config: {}`

**Impact:** Execution hangs for 120 seconds then times out.

### Issue 3: Placeholder Analysis Tools (Major)

**Affected Tools:**
- `bugfix_scan`: Returns empty bugs array
- `refactor_scan`: Returns empty opportunities array

**Impact:** Code quality analysis features are non-functional.

### Issue 4: No Configuration Validation (Major)

**Missing Validation:**
- No check for empty workflows
- No check for empty prompt configs
- No check for invalid step types

**Impact:** Broken agents can be registered and cause runtime failures.

---

## Solution Architecture

### Phase 1: Agent Workflow Templates (Priority: P0)

Create standardized workflow templates for each agent type:

#### Template: Analysis Agent
```json
{
  "workflow": [
    {
      "stepId": "understand",
      "name": "Understand Context",
      "type": "prompt",
      "config": {
        "prompt": "As ${agent.role}, analyze the following request:\n\n${input}\n\nFirst, summarize your understanding of:\n1. What is being asked\n2. The scope and constraints\n3. Key considerations for your domain"
      }
    },
    {
      "stepId": "analyze",
      "name": "Deep Analysis",
      "type": "prompt",
      "config": {
        "prompt": "Based on your understanding:\n\n${previousOutputs.understand.content}\n\nProvide detailed analysis covering:\n1. Key findings\n2. Potential issues or concerns\n3. Recommendations\n4. Trade-offs to consider"
      },
      "dependencies": ["understand"]
    },
    {
      "stepId": "recommend",
      "name": "Actionable Recommendations",
      "type": "prompt",
      "config": {
        "prompt": "Based on your analysis:\n\n${previousOutputs.analyze.content}\n\nProvide:\n1. Prioritized action items\n2. Quick wins\n3. Long-term improvements\n4. Specific next steps"
      },
      "dependencies": ["analyze"]
    }
  ]
}
```

#### Template: Implementation Agent
```json
{
  "workflow": [
    {
      "stepId": "plan",
      "name": "Implementation Plan",
      "type": "prompt",
      "config": {
        "prompt": "As ${agent.role}, create an implementation plan for:\n\n${input}\n\nProvide:\n1. Approach and architecture decisions\n2. Step-by-step implementation plan\n3. Potential challenges\n4. Testing strategy"
      }
    },
    {
      "stepId": "implement",
      "name": "Implementation",
      "type": "prompt",
      "config": {
        "prompt": "Following your plan:\n\n${previousOutputs.plan.content}\n\nProvide the implementation:\n1. Code or configuration\n2. Key design decisions\n3. Edge cases handled\n4. Documentation notes"
      },
      "dependencies": ["plan"]
    },
    {
      "stepId": "review",
      "name": "Self Review",
      "type": "prompt",
      "config": {
        "prompt": "Review your implementation:\n\n${previousOutputs.implement.content}\n\nCheck for:\n1. Correctness\n2. Best practices\n3. Security considerations\n4. Performance implications\n\nProvide final refined version."
      },
      "dependencies": ["implement"]
    }
  ]
}
```

#### Template: Review Agent
```json
{
  "workflow": [
    {
      "stepId": "review",
      "name": "Comprehensive Review",
      "type": "prompt",
      "config": {
        "prompt": "As ${agent.role}, review the following:\n\n${input}\n\nEvaluate:\n1. Quality and correctness\n2. Best practices adherence\n3. Potential issues\n4. Improvement opportunities\n\nProvide structured feedback with specific recommendations."
      }
    }
  ]
}
```

### Phase 2: Agent-Specific Workflows (Priority: P0)

Each agent gets a workflow tailored to their expertise:

| Agent | Workflow Type | Steps | Key Focus |
|-------|--------------|-------|-----------|
| quality | Review | 3 | Test coverage, patterns, gaps |
| architecture | Analysis | 3 | Structure, dependencies, scalability |
| security | Analysis | 3 | Threats, vulnerabilities, mitigations |
| devops | Implementation | 3 | Infrastructure, CI/CD, automation |
| frontend | Implementation | 3 | Components, UX, performance |
| backend | Implementation | 3 | APIs, data, security |
| mobile | Implementation | 3 | Platform, UX, offline |
| fullstack | Implementation | 3 | End-to-end, integration |
| data-scientist | Analysis | 3 | Data, models, metrics |
| ml-engineer | Implementation | 3 | ML systems, pipelines |
| product | Analysis | 2 | Requirements, prioritization |
| cto | Analysis | 3 | Strategy, technology, team |
| ceo | Analysis | 2 | Business, vision |
| writer | Review | 1 | Documentation quality |
| researcher | Analysis | 3 | Research, synthesis |
| standard | Analysis | 1 | General assistance |

### Phase 3: Analysis Tools Implementation (Priority: P1)

#### bugfix_scan Real Implementation

```typescript
// Strategy: Use TypeScript AST + pattern matching
interface BugDetector {
  // Resource leak detection
  detectResourceLeaks(ast: AST): Bug[];

  // Null/undefined checks
  detectNullReferences(ast: AST): Bug[];

  // Type errors (via tsc --noEmit)
  detectTypeErrors(file: string): Bug[];

  // Common patterns
  detectAntiPatterns(ast: AST): Bug[];
}
```

**Detection Categories:**
1. Resource leaks (file handles, connections, timers)
2. Null reference risks
3. Type mismatches
4. Async/await issues
5. Error handling gaps
6. Security anti-patterns

#### refactor_scan Real Implementation

```typescript
interface RefactorDetector {
  // Code duplication
  detectDuplication(files: string[]): Opportunity[];

  // Long functions
  detectLongFunctions(ast: AST): Opportunity[];

  // Complex conditions
  detectComplexConditions(ast: AST): Opportunity[];

  // Naming issues
  detectNamingIssues(ast: AST): Opportunity[];
}
```

**Detection Categories:**
1. Extract function opportunities
2. Rename suggestions
3. Simplify conditionals
4. Remove duplication
5. Improve types
6. Modernize syntax

### Phase 4: Validation Layer (Priority: P1)

Add validation at agent registration:

```typescript
function validateAgentProfile(profile: AgentProfile): ValidationResult {
  const errors: string[] = [];

  // Workflow validation
  if (profile.workflow && profile.workflow.length > 0) {
    for (const step of profile.workflow) {
      if (step.type === 'prompt') {
        // Must have non-empty prompt config
        if (!step.config?.prompt || step.config.prompt.trim() === '') {
          errors.push(`Step "${step.stepId}" has empty prompt config`);
        }
      }
      if (step.type === 'delegate') {
        // Must have targetAgentId
        if (!step.config?.targetAgentId) {
          errors.push(`Step "${step.stepId}" missing targetAgentId`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Phase 5: Improved Error Handling (Priority: P2)

1. **Configurable Timeouts**
```typescript
interface AgentRunOptions {
  timeout?: number;  // Per-execution timeout
  stepTimeout?: number;  // Per-step timeout
}
```

2. **Graceful Degradation**
```typescript
// If provider unavailable, try fallback
const fallbackProviders = ['claude', 'gemini', 'codex'];
```

3. **Better Error Messages**
```typescript
if (step.config?.prompt === undefined) {
  throw new Error(
    `Step "${step.stepId}" has no prompt template. ` +
    `Add config.prompt with a template using ${input} and ${previousOutputs}`
  );
}
```

---

## Implementation Plan

### Sprint 1: Core Workflows (Week 1)

**Day 1-2: Add workflows to all example agents**
- [ ] quality.json - Add 3-step review workflow
- [ ] architecture.json - Add 3-step analysis workflow
- [ ] devops.json - Add 3-step implementation workflow
- [ ] mobile.json - Add 3-step implementation workflow
- [ ] cto.json - Add 3-step strategic analysis workflow
- [ ] ceo.json - Add 2-step strategic analysis workflow
- [ ] data-scientist.json - Add 3-step analysis workflow
- [ ] fullstack.json - Add 3-step implementation workflow
- [ ] product.json - Add 2-step analysis workflow
- [ ] researcher.json - Add 3-step research workflow
- [ ] blockchain-developer.json - Add 3-step implementation workflow
- [ ] quantum-engineer.json - Add 3-step implementation workflow
- [ ] aerospace-scientist.json - Add 3-step analysis workflow

**Day 3: Fix empty prompt configs**
- [ ] ml-engineer.json - Add prompt templates to all 3 steps
- [ ] creative-marketer.json - Add prompt templates to all 3 steps

**Day 4-5: Validation layer**
- [ ] Add validateAgentWorkflow() function
- [ ] Integrate into agent registration
- [ ] Add clear error messages

### Sprint 2: Analysis Tools (Week 2)

**Day 1-3: bugfix_scan implementation**
- [ ] Integrate TypeScript compiler API
- [ ] Implement resource leak detection
- [ ] Implement null reference detection
- [ ] Implement type error surfacing

**Day 4-5: refactor_scan implementation**
- [ ] Implement code duplication detection
- [ ] Implement complexity analysis
- [ ] Implement naming analysis

### Sprint 3: Polish (Week 3)

**Day 1-2: Error handling**
- [ ] Configurable timeouts
- [ ] Provider fallback
- [ ] Better error messages

**Day 3-5: Testing & Documentation**
- [ ] Integration tests for all agents
- [ ] Update agent-guide MCP prompt
- [ ] User documentation

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agents with workflows | 4/20 (20%) | 20/20 (100%) |
| Workflows with prompts | 2/4 (50%) | 20/20 (100%) |
| Agent execution success rate | ~10% | >95% |
| bugfix_scan detections | 0 | Real results |
| refactor_scan detections | 0 | Real results |
| Avg execution time | 120s (timeout) | <30s |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM provider unavailable | High | Fallback to multiple providers |
| Prompt template errors | Medium | Validation at registration |
| Timeout on complex tasks | Medium | Configurable timeouts, streaming |
| Example agents out of sync | Low | Schema validation on load |

---

## Appendix: Workflow Templates for Each Agent

### quality.json Workflow
```json
{
  "workflow": [
    {
      "stepId": "assess",
      "name": "Quality Assessment",
      "type": "prompt",
      "config": {
        "prompt": "As a QA Engineer, assess the following for quality:\n\n${input}\n\nEvaluate:\n1. Test coverage and patterns\n2. Code quality indicators\n3. Technical debt\n4. Documentation completeness\n\nProvide a structured quality report."
      }
    },
    {
      "stepId": "identify",
      "name": "Issue Identification",
      "type": "prompt",
      "config": {
        "prompt": "Based on your assessment:\n\n${previousOutputs.assess.content}\n\nIdentify:\n1. Critical quality gaps\n2. Testing blind spots\n3. Risk areas\n4. Quick wins for improvement"
      },
      "dependencies": ["assess"]
    },
    {
      "stepId": "recommend",
      "name": "Recommendations",
      "type": "prompt",
      "config": {
        "prompt": "Based on identified issues:\n\n${previousOutputs.identify.content}\n\nProvide:\n1. Prioritized action items\n2. Testing strategies to implement\n3. Quality gates to add\n4. Metrics to track"
      },
      "dependencies": ["identify"]
    }
  ]
}
```

### architecture.json Workflow
```json
{
  "workflow": [
    {
      "stepId": "analyze",
      "name": "Architecture Analysis",
      "type": "prompt",
      "config": {
        "prompt": "As a System Architect, analyze the following:\n\n${input}\n\nExamine:\n1. Overall structure and organization\n2. Dependency management\n3. Separation of concerns\n4. Scalability patterns\n5. Integration points"
      }
    },
    {
      "stepId": "evaluate",
      "name": "Trade-off Evaluation",
      "type": "prompt",
      "config": {
        "prompt": "Based on your analysis:\n\n${previousOutputs.analyze.content}\n\nEvaluate:\n1. Architectural trade-offs made\n2. Technical debt implications\n3. Maintainability considerations\n4. Evolution paths"
      },
      "dependencies": ["analyze"]
    },
    {
      "stepId": "recommend",
      "name": "Architectural Recommendations",
      "type": "prompt",
      "config": {
        "prompt": "Based on your evaluation:\n\n${previousOutputs.evaluate.content}\n\nRecommend:\n1. Architectural improvements\n2. Refactoring priorities\n3. Pattern adoptions\n4. Risk mitigations"
      },
      "dependencies": ["evaluate"]
    }
  ]
}
```

### devops.json Workflow
```json
{
  "workflow": [
    {
      "stepId": "assess",
      "name": "Infrastructure Assessment",
      "type": "prompt",
      "config": {
        "prompt": "As a DevOps Engineer, assess the following:\n\n${input}\n\nEvaluate:\n1. CI/CD pipeline status\n2. Infrastructure patterns\n3. Deployment strategies\n4. Monitoring and observability\n5. Security posture"
      }
    },
    {
      "stepId": "plan",
      "name": "Improvement Plan",
      "type": "prompt",
      "config": {
        "prompt": "Based on your assessment:\n\n${previousOutputs.assess.content}\n\nCreate a plan for:\n1. Automation improvements\n2. Reliability enhancements\n3. Security hardening\n4. Performance optimization"
      },
      "dependencies": ["assess"]
    },
    {
      "stepId": "implement",
      "name": "Implementation Guide",
      "type": "prompt",
      "config": {
        "prompt": "Based on your plan:\n\n${previousOutputs.plan.content}\n\nProvide:\n1. Step-by-step implementation\n2. Configuration examples\n3. Rollback procedures\n4. Validation checks"
      },
      "dependencies": ["plan"]
    }
  ]
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-16 | AutomatosX Team | Initial PRD |
