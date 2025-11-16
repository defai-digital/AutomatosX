# Implementation Checklist: Hybrid Architecture Restoration

**Version**: 1.0
**Date**: 2025-11-15
**Related Documents**:
- PRD: `hybrid-architecture-restoration-prd.md`
- Action Plan: `hybrid-architecture-action-plan.md`

---

## Quick Start Guide

### For Implementation Team

1. **Read Documents**:
   - [ ] Read PRD (15 min)
   - [ ] Read Action Plan (30 min)
   - [ ] Review v7.6.1 vs v8.x comparison report

2. **Setup Environment**:
   - [ ] Clone repository
   - [ ] Install dependencies: `pnpm install`
   - [ ] Run tests to ensure baseline: `pnpm test`
   - [ ] Build to ensure baseline: `pnpm run build`

3. **Begin Phase 1**:
   - [ ] Create feature branch: `git checkout -b feature/hybrid-architecture`
   - [ ] Follow Phase 1 checklist below

---

## Phase 1: Project Setup Foundation ✅

**Deadline**: End of Week 1
**Effort**: 4.5-6 hours

### Prerequisites
- [ ] v7.6.1 tag accessible in git repository
- [ ] examples/ directory structure understood
- [ ] TypeScript compilation working

### Tasks

#### Setup Command Core (2h)
- [ ] Copy setup.ts from v7.6.1 → `src/cli/commands/setup.ts`
- [ ] Review file structure (should be ~1,297 lines)
- [ ] Update all import statements for v8.x
- [ ] Replace `AutomatosXConfig` → `Config` type
- [ ] Replace `DEFAULT_CONFIG` → `defaultConfig`
- [ ] Fix path references
- [ ] Build: `pnpm run build:typescript` succeeds
- [ ] Zero TypeScript errors

#### Example Resources (1.5h)
- [ ] Extract examples/ from v7.6.1: `git archive v7.6.1 examples/ | tar -x`
- [ ] Verify 21 agents in `examples/agents/`
- [ ] Verify 60+ abilities in `examples/abilities/`
- [ ] Verify 5 teams in `examples/teams/`
- [ ] Verify 9 templates in `examples/templates/`
- [ ] Validate all YAML files parse correctly
- [ ] Update `copyExampleAgents()` function paths
- [ ] Update `copyExampleAbilities()` function paths
- [ ] Update `copyExampleTeams()` function paths
- [ ] Update `copyExampleTemplates()` function paths

#### Integration Files (1h)
- [ ] Verify `setupClaudeIntegration()` function works
- [ ] Verify `setupGeminiIntegration()` function works
- [ ] Verify `setupProjectClaudeMd()` creates correct file
- [ ] Verify `setupProjectGeminiMd()` creates correct file
- [ ] Verify `setupProjectAgentsMd()` creates correct file
- [ ] Test file generation in `/tmp/test-setup`

#### CLI Registration (1h)
- [ ] Add import in `src/cli/index.ts`
- [ ] Register setup command
- [ ] Test: `ax setup --help` shows help
- [ ] Test: `ax --help` lists setup command
- [ ] End-to-end test in clean directory
- [ ] Test force mode: `ax setup --force`
- [ ] Test spec-kit mode: `ax setup --spec-kit`
- [ ] Test home directory protection works

#### Testing
- [ ] Create `src/cli/commands/__tests__/setup.test.ts`
- [ ] Test: directory structure created
- [ ] Test: 21 agents copied
- [ ] Test: integration files created
- [ ] Test: home directory protection
- [ ] Test: force mode
- [ ] All tests pass
- [ ] Coverage ≥80% for setup.ts

#### Documentation
- [ ] Update README.md with setup command
- [ ] Create `docs/guides/setup-command.md`
- [ ] Add examples
- [ ] Add troubleshooting section

### Phase 1 Success Criteria
- [ ] `ax setup` command fully functional
- [ ] All example files copied correctly
- [ ] Integration files (CLAUDE.md, GEMINI.md, etc.) created
- [ ] Tests passing
- [ ] Documentation complete
- [ ] No breaking changes to v8.x
- [ ] Git commit: "Phase 1: Restore setup command"

---

## Phase 2: Agent Execution System ✅

**Deadline**: End of Week 2
**Effort**: 16-23 hours

### Prerequisites
- [ ] Phase 1 complete
- [ ] .automatosx/ structure exists after setup
- [ ] Provider system (Claude/Gemini/OpenAI) functional in v8.x

### Tasks

#### Agent Infrastructure (6-8h)

**Core Modules (2h)**:
- [ ] Copy `src/agents/profile-loader.ts` from v7.6.1
- [ ] Copy `src/agents/abilities-manager.ts` from v7.6.1
- [ ] Copy `src/agents/executor.ts` from v7.6.1
- [ ] Copy `src/agents/context-manager.ts` from v7.6.1
- [ ] Create `src/agents/` directory if needed

**Import Updates (2h)**:
- [ ] Map v7.6.1 → v8.x type imports
- [ ] Update provider imports
- [ ] Update utility imports
- [ ] Fix relative path imports
- [ ] Build succeeds for all 4 modules

**ProfileLoader Implementation (2-3h)**:
- [ ] `loadProfile()` loads YAML files
- [ ] `listAgents()` returns agent names
- [ ] `validateProfile()` validates schema
- [ ] YAML parsing with `js-yaml` or similar
- [ ] Error messages helpful
- [ ] Tests pass

**AbilitiesManager Implementation (1.5-2h)**:
- [ ] `loadAbilities()` loads markdown files
- [ ] `selectAbilitiesForTask()` keyword matching
- [ ] Ability caching for performance
- [ ] Missing abilities handled gracefully
- [ ] Tests pass

#### Agent Execution (4-6h)

**AgentExecutor Implementation (3-4h)**:
- [ ] `execute()` orchestrates full flow
- [ ] `selectProvider()` chooses Claude/Gemini/OpenAI
- [ ] `buildSystemPrompt()` includes abilities
- [ ] `formatResult()` supports text/json/markdown
- [ ] Provider integration working
- [ ] Tests pass

**Run Command (2h)**:
- [ ] Copy `src/cli/commands/run.ts` from v7.6.1
- [ ] Update imports
- [ ] Wire up AgentExecutor
- [ ] Add all CLI flags (--provider, --model, --format, etc.)
- [ ] Register in CLI
- [ ] Build succeeds

#### Supporting Infrastructure (3-5h)

**ContextManager (1.5-2h)**:
- [ ] `buildContext()` creates execution context
- [ ] `loadMemory()` integrates with v8.x MemoryService
- [ ] `loadSession()` loads session data (stub for Phase 3)
- [ ] Tests pass

**TeamManager (1h)**:
- [ ] Copy `src/core/team-manager.ts` from v7.6.1
- [ ] `loadTeam()` loads team YAML
- [ ] `getAgentTeam()` finds agent's team
- [ ] `mergeWithTeam()` merges configs
- [ ] Tests pass

**ProfileLoader + TeamManager Integration (30-45 min)**:
- [ ] ProfileLoader uses TeamManager
- [ ] Team inheritance works
- [ ] Shared providers applied
- [ ] Shared abilities applied

#### Testing & Refinement (3-4h)

**End-to-End Testing (2h)**:
- [ ] Test: `ax run backend "create function"`
- [ ] Test: `ax run backend "task" --verbose`
- [ ] Test: `ax run backend "task" --provider gemini`
- [ ] Test: `ax run backend "task" --provider openai`
- [ ] Test: `ax run backend "task" --format json`
- [ ] Test: `ax run backend "task" --format markdown`
- [ ] Test: `ax run backend "task" --save /tmp/result.md`
- [ ] Test all 21 agents execute successfully
- [ ] Test ability injection (check prompt includes ability content)
- [ ] Test team inheritance (check shared config applied)
- [ ] Performance: startup <500ms

**Comprehensive Tests (1.5-2h)**:
- [ ] Create `src/agents/__tests__/profile-loader.test.ts`
- [ ] Create `src/agents/__tests__/abilities-manager.test.ts`
- [ ] Create `src/agents/__tests__/executor.test.ts`
- [ ] Create `src/cli/commands/__tests__/run.test.ts`
- [ ] All tests pass
- [ ] Coverage ≥85%

#### Documentation
- [ ] Create `docs/guides/run-command.md`
- [ ] Create `docs/guides/agent-profiles.md`
- [ ] Create `docs/guides/abilities-system.md`
- [ ] Update README with ax run examples

### Phase 2 Success Criteria
- [ ] `ax run <agent> <task>` fully functional
- [ ] All 21 example agents execute
- [ ] Abilities inject into prompts
- [ ] Teams inheritance works
- [ ] Multiple providers supported (Claude, Gemini, OpenAI)
- [ ] Output formatting works (text, json, markdown)
- [ ] Tests passing (≥85% coverage)
- [ ] Documentation complete
- [ ] No breaking changes to v8.x
- [ ] Git commit: "Phase 2: Restore agent execution system"

---

## Phase 3: Advanced Features ✅

**Deadline**: End of Week 3
**Effort**: 8-11 hours

### Prerequisites
- [ ] Phase 2 complete
- [ ] Agent execution working
- [ ] All 21 agents functional

### Tasks

#### Session Management (3-4h)

**SessionManager (1h)**:
- [ ] Copy `src/core/session-manager.ts` from v7.6.1
- [ ] `createSession()` creates session
- [ ] `joinSession()` adds agent to session
- [ ] `addToHistory()` logs execution
- [ ] `saveSession()` persists to `.automatosx/sessions/`
- [ ] `loadSession()` loads from disk
- [ ] `listSessions()` returns all sessions
- [ ] Build succeeds

**Session Command (1.5h)**:
- [ ] Create `src/cli/commands/session.ts`
- [ ] `ax session create <name> <agents...>` works
- [ ] `ax session list` works
- [ ] `ax session show <id>` works
- [ ] `ax session close <id>` works
- [ ] Table formatting looks good
- [ ] Register in CLI

**Run Command Integration (30-45 min)**:
- [ ] Add `--session` flag to run command
- [ ] History persists to session
- [ ] Test: `ax run backend "task" --session <id>`

#### Agent Templates (2-3h)

**Agent Create Command (2h)**:
- [ ] Update `src/cli/commands/agent.ts` with create subcommand
- [ ] Load template from `examples/templates/`
- [ ] Customize template (name, description)
- [ ] Save to `.automatosx/agents/`
- [ ] All 9 templates work
- [ ] Test: `ax agent create my-backend --template developer`

**Setup Integration (30 min)**:
- [ ] Verify `copyExampleTemplates()` works in setup.ts
- [ ] Test: `ax setup` copies all 9 templates
- [ ] Templates valid YAML

#### Multi-Agent Delegation (2-3h)

**Delegation in AgentExecutor (1.5-2h)**:
- [ ] Add `delegationDepth` tracking
- [ ] `extractDelegations()` parses response
- [ ] `executeDelegations()` runs sub-tasks
- [ ] Max depth enforcement
- [ ] Whitelist enforcement (`canDelegateTo`)
- [ ] Circular delegation prevention
- [ ] Tests pass

**Delegation Testing (30-45 min)**:
- [ ] Mock response with delegation marker
- [ ] Test delegation extraction
- [ ] Test delegation execution
- [ ] Test depth limit
- [ ] Test whitelist enforcement

#### Supporting Commands (1-2h)

**List Command (1h)**:
- [ ] Create `src/cli/commands/list.ts`
- [ ] `ax list agents` works (table format)
- [ ] `ax list teams` works
- [ ] `ax list abilities` works
- [ ] `ax list templates` works
- [ ] `--format json` works
- [ ] `--format list` works
- [ ] Register in CLI

**Runs & Resume Commands (1h)**:
- [ ] Create `src/cli/commands/runs.ts`
- [ ] `ax runs list` shows recent executions
- [ ] `ax runs show <id>` shows details
- [ ] Create `src/cli/commands/resume.ts`
- [ ] `ax resume <id>` basic implementation
- [ ] Checkpoint storage in `.automatosx/checkpoints/`
- [ ] Register in CLI

### Phase 3 Success Criteria
- [ ] `ax session` commands functional
- [ ] `ax list` commands functional
- [ ] `ax agent create` functional
- [ ] `ax runs` and `ax resume` functional (basic)
- [ ] Delegation working
- [ ] Tests passing
- [ ] Documentation complete
- [ ] No breaking changes to v8.x
- [ ] Git commit: "Phase 3: Add advanced features (sessions, templates, delegation)"

---

## Phase 4: Integration & Release ✅

**Deadline**: End of Week 4
**Effort**: 6-8 hours

### Prerequisites
- [ ] Phases 1, 2, 3 complete
- [ ] All features functional
- [ ] All tests passing

### Tasks

#### Integration Testing (3-4h)

**End-to-End Scenarios (2h)**:
- [ ] Scenario 1: New user onboarding
  - [ ] Install, setup, use both features
- [ ] Scenario 2: v7.6.1 migration
  - [ ] Upgrade, test backward compat, test new features
- [ ] Scenario 3: Hybrid workflow
  - [ ] Use v8.x + v7.6.1 features together
- [ ] Scenario 4: Custom agent creation
  - [ ] Create, customize, run custom agent

**Regression Testing (1h)**:
- [ ] Test all v8.x commands unchanged
  - [ ] ax find
  - [ ] ax def
  - [ ] ax analyze
  - [ ] ax speckit
  - [ ] ax workflow
  - [ ] ax memory
  - [ ] etc.

**Cross-Platform Testing (1h)**:
- [ ] Test on macOS
- [ ] Test on Linux (Ubuntu 24.04)
- [ ] Test on Windows 11
- [ ] Verify file paths work on Windows

#### Documentation (2-3h)

**User Guides (1.5h)**:
- [ ] Create `docs/migration/v7.6.1-to-v8.1.0.md`
- [ ] Create `docs/features/hybrid-architecture.md`
- [ ] Create `docs/api/agent-profiles.md`
- [ ] Create `docs/examples/hybrid-workflows.md`
- [ ] All examples validated

**README & CHANGELOG (1h)**:
- [ ] Update README.md
  - [ ] Version to 8.1.0
  - [ ] Hybrid architecture overview
  - [ ] Feature list updated
  - [ ] Examples for both features
- [ ] Update CHANGELOG.md
  - [ ] Add v8.1.0 section
  - [ ] List all restored features
  - [ ] Note backward compatibility
- [ ] Write release notes

#### Release Preparation (1h)

**Pre-Release Checklist (30 min)**:
- [ ] All deliverables complete
- [ ] All tests passing (745+ tests)
- [ ] Coverage ≥85%
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] README updated
- [ ] Migration guide ready
- [ ] Version bumped in package.json

**Build & Publish (30 min)**:
- [ ] Run: `pnpm run build`
- [ ] Run: `pnpm test` (all pass)
- [ ] Update version: `npm version 8.1.0`
- [ ] Commit: "Release v8.1.0: Hybrid Architecture"
- [ ] Tag: `git tag -a v8.1.0 -m "v8.1.0"`
- [ ] Push: `git push origin main && git push origin v8.1.0`
- [ ] Publish: `npm publish --access public`
- [ ] Create GitHub release

#### Post-Release (30 min)

**Announcements**:
- [ ] GitHub release notes published
- [ ] Social media posts made
- [ ] Documentation site updated
- [ ] Support channels ready

### Phase 4 Success Criteria
- [ ] v8.1.0 released and available on npm
- [ ] Documentation complete and published
- [ ] Migration guide tested
- [ ] User feedback channels open
- [ ] Support ready
- [ ] Git tag: v8.1.0
- [ ] GitHub release created

---

## Success Metrics Tracking

### Feature Restoration Metrics

| Feature | v7.6.1 | v8.1.0 | Status |
|---------|---------|---------|--------|
| ax setup | ✅ | [ ] | |
| YAML agents | ✅ | [ ] | |
| ax run | ✅ | [ ] | |
| Abilities (60+) | ✅ | [ ] | |
| Teams (5) | ✅ | [ ] | |
| Templates (9) | ✅ | [ ] | |
| Sessions | ✅ | [ ] | |
| Delegation | ✅ | [ ] | |
| ax list | ✅ | [ ] | |
| ax runs/resume | ✅ | [ ] | |
| **Total** | **10/10** | **0/10** | **0%** |

**Target**: 10/10 (100%)

### Test Coverage Metrics

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| setup.ts | ≥80% | 0% | [ ] |
| profile-loader.ts | ≥85% | 0% | [ ] |
| abilities-manager.ts | ≥85% | 0% | [ ] |
| executor.ts | ≥85% | 0% | [ ] |
| run.ts | ≥85% | 0% | [ ] |
| session-manager.ts | ≥80% | 0% | [ ] |
| **Overall** | **≥85%** | **~85%** | **[ ]** |

### Performance Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| ax setup time | <5s | - | [ ] |
| ax run startup | <500ms | - | [ ] |
| YAML parse time | <100ms | - | [ ] |
| Ability loading | <200ms | - | [ ] |
| Memory increase | <50MB | - | [ ] |

---

## Risk Monitoring

### Track These Risks

**Risk 1: Breaking v8.x Features** (High Impact)
- [ ] Run v8.x regression tests after each phase
- [ ] Monitor: All v8.x tests pass
- [ ] Mitigation: Feature flags if needed

**Risk 2: Performance Degradation** (Medium Impact)
- [ ] Benchmark before Phase 1
- [ ] Benchmark after each phase
- [ ] Monitor: Startup time, memory usage
- [ ] Mitigation: Lazy loading, caching

**Risk 3: YAML Schema Incompatibility** (High Impact)
- [ ] Validate against v7.6.1 examples
- [ ] Monitor: Schema validation tests pass
- [ ] Mitigation: Clear error messages, migration tool

**Risk 4: Documentation Lag** (Medium Impact)
- [ ] Write docs alongside code
- [ ] Monitor: Doc completion checklist
- [ ] Mitigation: Allocate time each phase

---

## Daily Standup Template

### What I Did Yesterday
- [ ] [List completed tasks]

### What I'm Doing Today
- [ ] [List planned tasks]

### Blockers
- [ ] [List any blockers]

### Metrics
- [ ] Features restored: X/10
- [ ] Tests passing: X/745+
- [ ] Coverage: X%
- [ ] Phase completion: X%

---

## Weekly Review Template

### Week 1 Review (Phase 1)
**Completed**:
- [ ] [List completed tasks]

**Not Completed**:
- [ ] [List incomplete tasks]

**Blockers**:
- [ ] [List blockers encountered]

**Next Week**:
- [ ] [List Phase 2 priorities]

**Metrics**:
- [ ] Features restored: X/10
- [ ] Tests passing: X/745+
- [ ] Coverage: X%

---

## Final Acceptance Checklist

### Before Marking "Complete"

**Functionality**:
- [ ] All 10 features restored from v7.6.1
- [ ] All v8.x features still working
- [ ] No breaking changes introduced

**Quality**:
- [ ] All 745+ tests passing
- [ ] Coverage ≥85%
- [ ] No TypeScript errors
- [ ] No ESLint warnings

**Documentation**:
- [ ] README complete
- [ ] CHANGELOG complete
- [ ] Migration guide complete
- [ ] API reference complete
- [ ] Examples validated

**Testing**:
- [ ] Integration tests pass
- [ ] Regression tests pass
- [ ] Cross-platform tests pass
- [ ] Performance benchmarks met

**Release**:
- [ ] Version 8.1.0 tagged
- [ ] npm package published
- [ ] GitHub release created
- [ ] Announcements made

---

## Quick Command Reference

### Development
```bash
# Install
pnpm install

# Build
pnpm run build
pnpm run build:typescript
pnpm run build:rescript

# Test
pnpm test
pnpm run test:coverage

# Lint
pnpm run lint

# Clean
pnpm run clean
```

### Testing Phases
```bash
# Phase 1
ax setup
tree .automatosx/

# Phase 2
ax run backend "hello"
ax list agents

# Phase 3
ax session create test backend frontend
ax agent create my-agent --template developer
ax list abilities

# Phase 4
ax find "code"
ax speckit generate adr "topic"
```

### Git Workflow
```bash
# Feature branch
git checkout -b feature/hybrid-architecture

# Commits
git commit -m "Phase 1: Restore setup command"
git commit -m "Phase 2: Restore agent execution"
git commit -m "Phase 3: Add advanced features"
git commit -m "Phase 4: Integration and docs"

# Release
git tag -a v8.1.0 -m "v8.1.0 - Hybrid Architecture"
git push origin main --tags
```

---

## Contact & Support

**Engineering Lead**: [Name]
**Product Manager**: [Name]
**Documentation**: [Name]

**Slack Channel**: #automatosx-hybrid-architecture
**GitHub Issues**: https://github.com/defai-digital/automatosx/issues
**Documentation**: https://automatosx.com/docs

---

**Document Status**: ✅ Ready for Use
**Last Updated**: 2025-11-15
**Version**: 1.0
