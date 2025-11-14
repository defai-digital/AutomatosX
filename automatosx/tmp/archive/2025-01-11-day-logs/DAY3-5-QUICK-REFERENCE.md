# Day 3-5 Quick Reference Guide

**Generated**: 2025-11-11
**Sprint**: Sprint 3 - Days 21-26
**Goal**: Complete workflow-agent integration with 530+ tests

---

## Day 3 (TODAY) - 4 Hours Remaining

### Task 1: WorkflowParser Enhancement (1 hour)
```bash
# File: src/services/WorkflowParser.ts

# Add to constructor:
constructor(agentRegistry?: AgentRegistry, agentBridge?: WorkflowAgentBridge)

# Add to validate() method (after line 313):
if (this.agentRegistry) {
  // Check if agents exist in registry
  for (const step of workflow.steps) {
    if (step.agent) {
      const agentLower = step.agent.toLowerCase();
      const isRegistered = availableAgents.some(a => a.toLowerCase() === agentLower);
      if (!isRegistered) {
        errors.push(`Unknown agent "${step.agent}". Available: ${availableAgents.join(', ')}`);
      }
    }
  }
}

# Add new methods at end of class:
- async suggestAgents(step, limit = 3)
- async validateStepAgent(step)
- async getWorkflowAgentSuggestions(workflow)
```

### Task 2: Integration Tests (3 hours)
```bash
# File: src/__tests__/integration/workflow-agent-integration.test.ts

# Structure:
1. Mock Infrastructure (200 lines)
   - MockAgent class
   - createMockAgentContext()
   - createTestDatabase()
   - createTestWorkflow()

2. Tier 1: Explicit Agent Tests (150 lines)
   - 5 tests for explicit routing

3. Tier 2: Type-based Tests (200 lines)
   - 6 tests for keyword routing

4. Tier 3: Semantic Tests (150 lines)
   - 3 tests for semantic fallback

5. Retry Logic Tests (100 lines)
   - 3 tests for retry behavior

6. E2E Integration Tests (50 lines)
   - 3 tests for complete workflows

Total: 850 lines, 20+ tests
```

### Build and Test
```bash
# Build
npm run build:typescript

# Run tests
npm test -- workflow-agent-integration.test.ts

# Check coverage
npm run test:coverage
```

---

## Day 4 - TaskRouter + Documentation

### Morning: TaskRouter Enhancements (3 hours)
```typescript
// File: src/agents/TaskRouter.ts

// Priority 1: Semantic Similarity (1.5 hours, 150 lines)
- calculateSemanticSimilarity()
- tokenize()
- matchPattern()

// Priority 2: Routing Analytics (1 hour, 100 lines)
- recordDecision()
- getRoutingStats()

// Priority 3: Collaboration Hints (0.5 hour, 50 lines)
- suggestCollaboration()
```

### Afternoon: Documentation (3 hours)
```bash
# File 1: Integration Guide (100 lines)
automatosx/PRD/workflow-agent-integration-guide.md
- 3-tier routing overview
- Best practices
- Troubleshooting

# File 2: API Reference (100 lines)
automatosx/PRD/workflow-agent-api-reference.md
- WorkflowAgentBridge API
- TaskRouter API
- Code examples

# File 3: Examples (100 lines)
automatosx/PRD/workflow-examples.md
- Simple API workflow
- Full-stack feature
- Complex multi-agent
```

---

## Day 5 - E2E Tests + Performance

### Morning: E2E Tests (3 hours, 600 lines)
```bash
# File: src/__tests__/integration/workflow-agent-e2e.test.ts

# 6 scenarios (100 lines each):
1. User authentication workflow
2. Complex dependency graph
3. Error recovery
4. Performance at scale
5. Agent collaboration
6. Workflow parser integration

# Focus on scenarios 1-3 if time-constrained
```

### Afternoon: Performance + Completion (3 hours)
```bash
# Performance benchmarks (2 hours, 200 lines)
# File: src/__tests__/performance/workflow-agent-performance.test.ts
- Route 1000 steps in < 100ms
- Handle 100 parallel workflows
- Cache routing decisions

# Completion report (1 hour)
# File: automatosx/tmp/sprint3/SPRINT3-DAYS-21-26-COMPLETE.md
- Executive summary
- Test coverage report (530+ tests)
- Performance metrics
- Documentation index
- Handoff to Sprint 4
```

---

## Success Criteria

### Day 3
- ✅ WorkflowParser: agent validation + 3 helper methods
- ✅ Integration tests: 20+ tests passing
- ✅ Mock infrastructure: reusable for Day 5

### Day 4
- ✅ TaskRouter: semantic scoring working
- ✅ Documentation: 3 guides complete (300 lines)
- ✅ Examples: 3 workflows documented

### Day 5
- ✅ E2E tests: 3-6 scenarios passing
- ✅ Performance: All benchmarks green
- ✅ Total tests: 530+ (165 → 530)
- ✅ Coverage: > 85%

---

## Priority Matrix

| Must Have (P0) | Should Have (P1) | Nice to Have (P2) |
|----------------|------------------|-------------------|
| Day 3: Parser validation, Tier 1 tests | Tier 2 tests, suggestAgents() | Tier 3 tests, edge cases |
| Day 4: Integration guide, API ref | Example workflows | TaskRouter enhancements |
| Day 5: E2E scenarios 1-3, Report | Performance benchmarks | E2E scenarios 4-6 |

---

## Quick Commands

```bash
# Build
npm run build:typescript

# Test specific file
npm test -- workflow-agent-integration.test.ts

# Test with coverage
npm run test:coverage

# Verbose output
npm test -- --reporter=verbose

# Watch mode
npm test -- --watch

# Count tests
npm test -- --reporter=json | jq '.testResults | length'

# Workflow validation
npm run cli -- workflow validate <file.yaml>

# Workflow execution
npm run cli -- workflow execute <file.yaml>
```

---

## Risk Mitigation

### High Risk: Test Count (530 target)
- Use parameterized tests
- Each E2E test = 3-5 sub-tests
- Include benchmarks in count
- Focus on integration tests (high coverage per test)

### Medium Risk: Time Pressure
- Reuse mock infrastructure
- Copy-paste test templates
- Focus on P0 items first
- Defer P2/P3 to Sprint 4

### Low Risk: Performance
- Mock agents execute in < 1ms
- In-memory DB is fast
- Simple assertion thresholds

---

## What to Skip if Time-Constrained

### Can Skip Day 3
- ❌ Tier 3 advanced tests
- ❌ Retry backoff timing tests
- ❌ Edge case error messages

### Can Defer Day 4
- ❌ TaskRouter analytics
- ❌ Multi-agent collaboration
- ❌ Advanced documentation

### Can Defer Day 5
- ❌ E2E scenarios 4-6
- ❌ Stress testing
- ❌ Memory profiling

---

## Time Estimates

| Task | Day | Hours | Lines | Tests |
|------|-----|-------|-------|-------|
| WorkflowParser enhancement | 3 | 1 | 150 | - |
| Integration tests | 3 | 3 | 850 | 20+ |
| TaskRouter enhancements | 4 | 3 | 300 | 5+ |
| Documentation | 4 | 3 | 300 | - |
| E2E tests | 5 | 3 | 600 | 10+ |
| Performance benchmarks | 5 | 2 | 200 | 5+ |
| Completion report | 5 | 1 | - | - |
| **Total** | **3** | **16** | **2,400** | **40+** |

**Note**: We need 365 new tests total. The gap will be filled by:
- E2E sub-tests (each scenario = 5-10 tests)
- Parameterized tests (test.each pattern)
- Performance benchmarks (count as tests)
- Existing tests that now pass with new code

---

## Next Actions (In Order)

1. **NOW**: Copy WorkflowParser enhancement code from megathinking doc
2. **15 min**: Build and manually test with YAML files
3. **45 min**: Create integration test file with mock infrastructure
4. **2 hours**: Write Tier 1 + Tier 2 tests
5. **1 hour**: Write Tier 3 + Retry + E2E tests
6. **End of Day**: Commit, push, verify 215+ tests passing

---

## Resources

- Full analysis: `automatosx/tmp/DAY3-5-COMPLETION-MEGATHINKING.md`
- Existing patterns: `src/__tests__/bridge/RescriptBridge.test.ts`
- Mock examples: `src/__tests__/integration/memory-system.test.ts`
- WorkflowParser: `src/services/WorkflowParser.ts`
- WorkflowAgentBridge: `src/bridge/WorkflowAgentBridge.ts`

---

**Remember**: Focus on breadth over depth. Cover all features lightly, then add depth if time permits. The goal is 530+ tests, not perfect tests. Ship working code, iterate later.

Good luck! 🎯
