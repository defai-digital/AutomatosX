# PRD: AutomatosX Hybrid Architecture Restoration

**Document Type**: Product Requirements Document
**Version**: 1.0
**Date**: 2025-11-15
**Status**: Draft
**Authors**: AutomatosX Engineering Team
**Stakeholders**: Engineering, Product, Users

---

## Executive Summary

### Problem Statement

AutomatosX v8.x represents a significant architectural shift from v7.6.1, transitioning from an **agent-centric AI orchestration platform** to a **code intelligence platform**. This pivot resulted in the loss of critical user-facing features:

- **Lost**: `ax setup` command for project initialization
- **Lost**: YAML-based agent profiles (user-customizable without code)
- **Lost**: `ax run <agent> <task>` execution interface
- **Lost**: 60+ expertise ability files
- **Lost**: Multi-agent team collaboration system
- **Lost**: Provider integration auto-configuration (Claude, Gemini, OpenAI)

**Impact**: Users upgrading from v7.6.1 to v8.x lose their primary workflow and cannot customize agents without TypeScript knowledge.

### Proposed Solution

Implement a **hybrid architecture** that combines:
1. **v8.x innovations**: Tree-sitter parsing, SQLite FTS5 search, LSP server, Web UI, SpecKit
2. **v7.6.1 features**: YAML agents, `ax setup`, `ax run`, abilities, teams

This approach provides:
- **Backward compatibility**: v7.6.1 users can upgrade without workflow disruption
- **Forward compatibility**: New users benefit from both code intelligence and agent orchestration
- **Maximum value**: Best-of-both-worlds architecture

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature Restoration Rate | 95% | (Restored Features / Lost Features) × 100 |
| Setup Success Rate | 99% | Successful `ax setup` executions |
| Agent Execution Success | 98% | Successful `ax run` completions |
| User Satisfaction | 4.5/5 | Post-migration survey |
| Breaking Changes | 0 | v8.x features remain functional |
| Test Coverage | 85% | Restored code coverage |

---

## Product Vision

### Mission

Enable developers to combine **code intelligence** with **AI agent orchestration** in a single unified platform.

### User Personas

#### Persona 1: "Legacy Leo" (v7.6.1 User)
- **Background**: Using AutomatosX v7.6.1 for 6+ months
- **Workflow**: `ax setup` → customize YAML agents → `ax run` for daily tasks
- **Pain**: Cannot upgrade to v8.x without losing entire workflow
- **Need**: Seamless migration path with zero workflow disruption

#### Persona 2: "New Nina" (Fresh User)
- **Background**: Just discovered AutomatosX
- **Workflow**: Wants both code search and AI agents
- **Pain**: Confused by v7.6.1 vs v8.x feature differences
- **Need**: One platform with all features

#### Persona 3: "Enterprise Ethan" (Team Lead)
- **Background**: Managing 10+ developers
- **Workflow**: Team collaboration with shared agents
- **Pain**: Cannot customize agents for team without coding
- **Need**: YAML-based configuration for easy team customization

### Value Proposition

**"AutomatosX: The only platform that combines code intelligence with customizable AI agent orchestration"**

- Search 45+ languages with Tree-sitter precision
- Auto-generate specs with SpecKit
- Run customizable AI agents for any task
- Team collaboration with shared abilities
- No coding required for agent customization

---

## Product Requirements

### Functional Requirements

#### FR-1: Project Setup Automation
**Priority**: P0 (Critical)
**User Story**: As a user, I want to run `ax setup` to automatically configure my project

**Acceptance Criteria**:
- [ ] `ax setup` command exists and runs without errors
- [ ] Creates `.automatosx/` directory structure (agents, abilities, teams, templates)
- [ ] Copies 21 example agent YAML files
- [ ] Copies 60+ ability markdown files
- [ ] Copies 5 team configuration files
- [ ] Copies 9 agent templates
- [ ] Creates `automatosx.config.json` with defaults
- [ ] Creates CLAUDE.md, GEMINI.md, AGENTS.md integration files
- [ ] Configures Claude Code MCP integration (.claude/mcp/)
- [ ] Configures Gemini CLI integration (.gemini/)
- [ ] Initializes git repository if not present
- [ ] Updates .gitignore with AutomatosX entries
- [ ] Provides clear next-steps instructions
- [ ] Supports `--force` flag to re-run setup
- [ ] Supports `--spec-kit` flag for spec-driven development
- [ ] Prevents installation in home directory with helpful error

**Dependencies**: None
**Effort**: 4.5-6 hours

---

#### FR-2: YAML Agent Profiles
**Priority**: P0 (Critical)
**User Story**: As a user, I want to customize agents by editing YAML files

**Acceptance Criteria**:
- [ ] Agent profiles stored in `.automatosx/agents/*.yaml`
- [ ] ProfileLoader reads and validates YAML files
- [ ] Supports all v7.6.1 YAML schema fields:
  - `name`, `description`, `persona`, `providers`, `abilities`, `orchestration`, `systemPrompt`
- [ ] Provider configuration with model selection (Claude, Gemini, OpenAI)
- [ ] Ability references load corresponding markdown files
- [ ] Team inheritance for shared configuration
- [ ] Validation errors show helpful messages
- [ ] Hot-reload on YAML file changes (no restart required)
- [ ] 21 example agents work out-of-box

**Example YAML**:
```yaml
name: backend
description: Senior Backend Engineer
persona:
  name: Bob
  role: Senior Backend Engineer
  expertise: [api-design, database, security]
providers:
  default: claude
  models:
    claude: claude-sonnet-4
abilities:
  api: [api-design, rest-best-practices]
systemPrompt: |
  You are Bob, a Senior Backend Engineer...
```

**Dependencies**: FR-1 (setup creates files)
**Effort**: 6-8 hours

---

#### FR-3: Agent Execution Interface
**Priority**: P0 (Critical)
**User Story**: As a user, I want to run `ax run <agent> <task>` to execute AI agents

**Acceptance Criteria**:
- [ ] `ax run <agent> <task>` command exists
- [ ] Loads agent profile from YAML
- [ ] Injects relevant abilities into prompt
- [ ] Executes with configured provider (Claude/Gemini/OpenAI)
- [ ] Supports all v7.6.1 flags:
  - `--provider` (override default)
  - `--model` (override default)
  - `--memory` (inject memory context)
  - `--save-memory` (persist result)
  - `--verbose` (detailed output)
  - `--format` (text/json/markdown)
  - `--save` (save to file)
  - `--timeout` (execution timeout)
  - `--iterate` (autonomous multi-iteration)
  - `--interactive` (checkpoint mode)
- [ ] Displays formatted output with agent persona
- [ ] Shows provider and model used
- [ ] Handles errors gracefully
- [ ] Supports streaming output
- [ ] Works with all 21 example agents

**Example Usage**:
```bash
ax run backend "create REST API for user management"
ax run security "audit authentication code" --verbose
ax run frontend "build dashboard component" --iterate
```

**Dependencies**: FR-2 (agent profiles)
**Effort**: 8-10 hours

---

#### FR-4: Abilities System
**Priority**: P0 (Critical)
**User Story**: As a user, I want agents to load domain expertise from markdown files

**Acceptance Criteria**:
- [ ] Abilities stored in `.automatosx/abilities/*.md`
- [ ] AbilitiesManager loads and caches abilities
- [ ] Task-based ability selection (keywords → abilities)
- [ ] Ability content injected into system prompt
- [ ] 60+ example abilities included:
  - Engineering: clean-code, testing, refactoring, etc.
  - Backend: api-design, db-modeling, sql-optimization, etc.
  - Security: security-audit, threat-modeling, etc.
  - Specialized: quantum-algorithms, aerospace-missions, etc.
- [ ] Users can create custom abilities (markdown files)
- [ ] Abilities categorized by domain
- [ ] Hot-reload on ability file changes

**Example Ability** (`.automatosx/abilities/api-design.md`):
```markdown
# API Design Best Practices

## RESTful Principles
- Use nouns for resources (GET /users, not /getUsers)
- Use HTTP verbs correctly (GET/POST/PUT/DELETE)
- Return appropriate status codes
...
```

**Dependencies**: FR-1 (setup creates files)
**Effort**: 4-5 hours

---

#### FR-5: Teams System
**Priority**: P1 (High)
**User Story**: As a team lead, I want to organize agents into teams with shared configuration

**Acceptance Criteria**:
- [ ] Teams stored in `.automatosx/teams/*.yaml`
- [ ] TeamManager loads and validates team configs
- [ ] 5 example teams included:
  - engineering.yaml (backend, frontend, fullstack, mobile, devops)
  - design.yaml (design, writer)
  - core.yaml (product, security, quality)
  - business.yaml (ceo, cto, creative-marketer)
  - research.yaml (researcher, data-scientist, quantum-engineer, aerospace-scientist)
- [ ] Team config defines:
  - Shared providers and models
  - Shared abilities
  - Delegation guidelines
  - Collaboration patterns
- [ ] Agents inherit team configuration
- [ ] Agent-specific config overrides team defaults
- [ ] Users can create custom teams

**Example Team** (`.automatosx/teams/engineering.yaml`):
```yaml
name: engineering
description: Engineering team
members:
  - backend
  - frontend
  - fullstack
sharedProviders:
  default: claude
  fallback: [gemini, openai]
sharedAbilities:
  - clean-code
  - testing
  - code-review
```

**Dependencies**: FR-2 (agent profiles)
**Effort**: 4-6 hours

---

#### FR-6: Multi-Agent Delegation
**Priority**: P1 (High)
**User Story**: As a user, I want agents to delegate sub-tasks to other agents

**Acceptance Criteria**:
- [ ] Agents can delegate to other agents via YAML config
- [ ] `maxDelegationDepth` limits recursion
- [ ] `canDelegateTo` whitelist controls delegation
- [ ] Delegation context preserved across calls
- [ ] Results aggregated and returned to parent
- [ ] Delegation chain visible in output
- [ ] Prevents circular delegation
- [ ] Works with team-based delegation patterns

**Example**:
```yaml
orchestration:
  maxDelegationDepth: 2
  canDelegateTo: [backend, frontend, security]
```

**Dependencies**: FR-3 (agent execution)
**Effort**: 6-8 hours

---

#### FR-7: Provider Integration Setup
**Priority**: P1 (High)
**User Story**: As a user, I want `ax setup` to auto-configure Claude, Gemini, and OpenAI integrations

**Acceptance Criteria**:
- [ ] Creates `.claude/mcp/` directory with MCP config
- [ ] Creates `.gemini/` directory for Gemini CLI
- [ ] Creates `CLAUDE.md` with integration instructions
- [ ] Creates `GEMINI.md` with integration instructions
- [ ] Creates `AGENTS.md` with agent catalog
- [ ] MCP tools registered for Claude Code:
  - `ax_run_agent` - Run AutomatosX agent
  - `ax_list_agents` - List available agents
  - `ax_memory_search` - Search agent memory
- [ ] Gemini CLI can invoke `ax run` via shell
- [ ] OpenAI Codex compatibility verified
- [ ] Integration examples in docs

**Dependencies**: FR-1 (setup command)
**Effort**: 4-5 hours

---

#### FR-8: Session Management
**Priority**: P2 (Medium)
**User Story**: As a user, I want to create multi-agent sessions for complex tasks

**Acceptance Criteria**:
- [ ] `ax session create <name> <agents...>` command
- [ ] `ax session list` shows active sessions
- [ ] `ax session join <id>` adds agent to session
- [ ] `ax session show <id>` displays session state
- [ ] `ax session close <id>` ends session
- [ ] Sessions persist to `.automatosx/sessions/`
- [ ] Context shared across agents in session
- [ ] Session history tracked

**Example**:
```bash
ax session create "build-api" backend frontend security
ax session show abc123
ax session close abc123
```

**Dependencies**: FR-3 (agent execution)
**Effort**: 5-7 hours

---

#### FR-9: Execution History & Resume
**Priority**: P2 (Medium)
**User Story**: As a user, I want to view execution history and resume from checkpoints

**Acceptance Criteria**:
- [ ] `ax runs list` shows recent executions
- [ ] `ax runs show <id>` displays run details
- [ ] `ax resume <id>` resumes from checkpoint
- [ ] Checkpoints saved with `--resumable` flag
- [ ] Interactive checkpoints with `--interactive` flag
- [ ] Checkpoint storage in `.automatosx/checkpoints/`
- [ ] Checkpoint includes full context and state

**Example**:
```bash
ax run backend "complex task" --resumable
ax runs list
ax resume abc123
```

**Dependencies**: FR-3 (agent execution)
**Effort**: 4-6 hours

---

#### FR-10: Agent Templates
**Priority**: P2 (Medium)
**User Story**: As a user, I want to create custom agents from templates

**Acceptance Criteria**:
- [ ] `ax agent create <name> --template <type>` command
- [ ] 9 built-in templates:
  - basic-agent, developer, code-reviewer, designer
  - qa-specialist, analyst, assistant, debugger, fullstack-developer
- [ ] Template includes YAML scaffold with best practices
- [ ] Created agent added to `.automatosx/agents/`
- [ ] User guided to customize YAML fields
- [ ] Templates follow v7.6.1 structure

**Example**:
```bash
ax agent create my-backend --template developer
# Creates .automatosx/agents/my-backend.yaml
```

**Dependencies**: FR-2 (agent profiles)
**Effort**: 3-4 hours

---

#### FR-11: Supporting Commands
**Priority**: P2 (Medium)
**User Story**: As a user, I want commands to list and inspect agents/abilities/teams

**Acceptance Criteria**:
- [ ] `ax list agents` - List all agents with descriptions
- [ ] `ax list teams` - List all teams
- [ ] `ax list abilities` - List all abilities
- [ ] `ax agent show <name>` - Display agent YAML
- [ ] `ax team show <name>` - Display team config
- [ ] `ax ability show <name>` - Display ability content
- [ ] Output formatted with tables and colors
- [ ] Supports `--format json` for programmatic use

**Dependencies**: FR-1, FR-2, FR-4, FR-5
**Effort**: 3-4 hours

---

### Non-Functional Requirements

#### NFR-1: Backward Compatibility
**Priority**: P0 (Critical)

**Requirements**:
- All v8.x features continue working (no breaking changes)
- Existing v8.x configurations remain valid
- New features are additive only
- v8.x test suite passes 100%

**Verification**:
- Run full v8.x test suite
- Manual testing of all v8.x commands
- No TypeScript compilation errors

---

#### NFR-2: Performance
**Priority**: P1 (High)

**Requirements**:
- `ax setup` completes in <5 seconds
- `ax run` startup latency <500ms
- YAML parsing and validation <100ms
- Ability loading and caching <200ms
- Memory usage increase <50MB for agent system

**Verification**:
- Performance benchmarks
- Load testing with 100+ agents
- Memory profiling

---

#### NFR-3: Usability
**Priority**: P1 (High)

**Requirements**:
- Clear error messages with actionable guidance
- Help text for all commands (`--help`)
- Consistent CLI UX with v8.x patterns
- Examples in command descriptions
- Validation errors show line numbers (YAML)

**Verification**:
- User testing with 5+ users
- UX review of error messages
- Documentation completeness check

---

#### NFR-4: Maintainability
**Priority**: P1 (High)

**Requirements**:
- Code coverage ≥85% for new code
- TypeScript strict mode enabled
- ESLint rules passing
- Modular architecture (separation of concerns)
- Clear separation: agent system vs code intelligence

**Verification**:
- Coverage reports
- Static analysis
- Code review

---

#### NFR-5: Documentation
**Priority**: P1 (High)

**Requirements**:
- Migration guide: v7.6.1 → v8.1.0
- User guide: Hybrid architecture usage
- API reference: YAML schemas
- Examples: 10+ real-world scenarios
- Troubleshooting guide

**Verification**:
- Documentation review
- User feedback
- Example validation

---

## Technical Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                     AutomatosX v8.1.0                        │
│                   (Hybrid Architecture)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   v8.x Layer     │         │   v7.6.1 Layer   │          │
│  │  (Code Intel)    │         │  (Agent Orch)    │          │
│  ├──────────────────┤         ├──────────────────┤          │
│  │ • Tree-sitter    │         │ • ax setup       │          │
│  │ • SQLite FTS5    │         │ • ax run         │          │
│  │ • LSP Server     │         │ • YAML Agents    │          │
│  │ • Web UI         │         │ • Abilities      │          │
│  │ • SpecKit        │         │ • Teams          │          │
│  │ • NL Interface   │         │ • Sessions       │          │
│  └────────┬─────────┘         └─────────┬────────┘          │
│           │                             │                   │
│           └─────────┬───────────────────┘                   │
│                     │                                       │
│           ┌─────────▼─────────┐                            │
│           │   Shared Core     │                            │
│           ├───────────────────┤                            │
│           │ • Config System   │                            │
│           │ • Provider Router │                            │
│           │ • Memory Service  │                            │
│           │ • Telemetry       │                            │
│           └───────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── cli/
│   └── commands/
│       ├── setup.ts           # FR-1: Project setup (RESTORED)
│       ├── run.ts             # FR-3: Agent execution (RESTORED)
│       ├── list.ts            # FR-11: List commands (RESTORED)
│       ├── session.ts         # FR-8: Session management (RESTORED)
│       ├── agent.ts           # FR-10: Agent creation (NEW)
│       └── [v8.x commands]    # Existing commands
│
├── agents/                     # Agent system (RESTORED)
│   ├── profile-loader.ts      # FR-2: YAML loading
│   ├── abilities-manager.ts   # FR-4: Ability injection
│   ├── executor.ts            # FR-3: Execution engine
│   └── context-manager.ts     # Context handling
│
├── core/                       # Shared infrastructure
│   ├── team-manager.ts        # FR-5: Teams (RESTORED)
│   ├── session-manager.ts     # FR-8: Sessions (RESTORED)
│   ├── path-resolver.ts       # Path resolution
│   └── [v8.x core modules]    # Existing modules
│
├── providers/                  # Multi-provider support
│   ├── claude-provider.ts     # v8.x (existing)
│   ├── gemini-provider.ts     # v8.x (existing)
│   └── openai-provider.ts     # v8.x (existing)
│
└── [v8.x modules]              # Code intelligence (unchanged)
    ├── parser/                 # Tree-sitter parsing
    ├── database/               # SQLite + FTS5
    ├── lsp/                    # LSP server
    └── web/                    # Web UI

examples/                       # RESTORED from v7.6.1
├── agents/                     # 21 YAML profiles
│   ├── backend.yaml
│   ├── frontend.yaml
│   └── ...
├── abilities/                  # 60+ markdown files
│   ├── api-design.md
│   ├── db-modeling.md
│   └── ...
├── teams/                      # 5 team configs
│   ├── engineering.yaml
│   └── ...
└── templates/                  # 9 agent templates
    ├── basic-agent.yaml
    └── ...
```

---

## User Experience

### Setup Flow

```bash
# Step 1: Install
npm install -g @defai.digital/automatosx@8.1.0

# Step 2: Setup project
cd my-project/
ax setup

🤖 AutomatosX v8.1.0 - Hybrid Architecture Setup

✓ Creating directory structure...
✓ 21 agent profiles installed
✓ 60+ abilities installed
✓ 5 teams installed
✓ 9 templates installed
✓ Claude Code integration configured
✓ Gemini CLI integration configured
✓ Configuration created

✅ Setup complete!

Next steps:
  1. Try code intelligence: ax find "authentication"
  2. Try agent execution: ax run backend "create REST API"
  3. Customize agents: edit .automatosx/agents/backend.yaml

# Step 3: Use features
ax find "getUserById"              # v8.x code search
ax run backend "refactor auth"     # v7.6.1 agent execution
ax speckit generate adr "Use gRPC" # v8.x spec generation
```

---

### Agent Customization Flow

```bash
# List available agents
ax list agents

Available Agents (21):
  • backend       - Bob (Senior Backend Engineer)
  • frontend      - Frank (Senior Frontend Developer)
  • security      - Steve (Security Engineer)
  ...

# Create custom agent from template
ax agent create my-api-expert --template developer

Created: .automatosx/agents/my-api-expert.yaml

Edit the file to customize:
  - name: Your agent name
  - persona: Agent personality
  - providers: Claude/Gemini/OpenAI
  - abilities: Domain expertise

# Edit YAML file (no coding needed!)
vim .automatosx/agents/my-api-expert.yaml

# Run custom agent
ax run my-api-expert "design GraphQL schema"
```

---

## Success Criteria

### Definition of Done

**Phase 1 Complete When**:
- [ ] `ax setup` creates all files successfully
- [ ] 21 agents, 60+ abilities, 5 teams copied
- [ ] Integration files created (CLAUDE.md, GEMINI.md, AGENTS.md)
- [ ] Test suite passes (setup command)
- [ ] Documentation updated

**Phase 2 Complete When**:
- [ ] `ax run <agent> <task>` executes successfully
- [ ] YAML agents load and validate correctly
- [ ] Abilities inject into prompts
- [ ] All 21 example agents work
- [ ] Test suite passes (agent execution)
- [ ] Performance benchmarks met

**Phase 3 Complete When**:
- [ ] Teams system functional
- [ ] Sessions system functional
- [ ] Templates system functional
- [ ] All supporting commands work
- [ ] Integration tests pass

**Phase 4 Complete When**:
- [ ] Full integration testing complete
- [ ] User acceptance testing passed
- [ ] Documentation complete
- [ ] Migration guide published
- [ ] Release notes written

### Acceptance Testing

**Test Scenarios**:

1. **New User Setup**
   - Fresh install → `ax setup` → verify all files created
   - Run example agent → verify execution
   - Customize agent → verify YAML changes applied

2. **v7.6.1 Migration**
   - Existing v7.6.1 project → upgrade to v8.1.0
   - Verify existing agents still work
   - Verify custom abilities preserved
   - Test both old and new features

3. **v8.x Compatibility**
   - Existing v8.x project → add agent features
   - Verify code search still works
   - Verify LSP server still works
   - Verify Web UI still works

4. **Hybrid Usage**
   - Use `ax find` to search code
   - Use `ax run` to refactor found code
   - Use `ax speckit` to document changes
   - Verify seamless integration

---

## Risk Assessment

### High Risks

#### Risk 1: Breaking v8.x Features
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Run full v8.x test suite after each change
- Manual testing of all v8.x commands
- Feature flags for gradual rollout
- Rollback plan prepared

#### Risk 2: Performance Degradation
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Performance benchmarks before/after
- Load testing with many agents
- Profiling and optimization
- Lazy loading of agents/abilities

#### Risk 3: YAML Schema Incompatibility
**Probability**: Low
**Impact**: High
**Mitigation**:
- Validate against v7.6.1 examples
- Schema validation tests
- Migration tool for schema changes
- Clear error messages

### Medium Risks

#### Risk 4: Documentation Lag
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Documentation written alongside code
- Examples validated automatically
- User testing before release

#### Risk 5: Provider API Changes
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Version pinning for providers
- Fallback handling
- Regular testing against latest APIs

---

## Timeline & Milestones

### Overall Timeline
**Total Duration**: 4-6 weeks
**Team Size**: 1-2 developers
**Total Effort**: 35-48 hours

### Milestones

**M1: Phase 1 Complete** (Week 1)
- `ax setup` functional
- Example files copied
- Basic integration testing

**M2: Phase 2 Complete** (Week 2)
- `ax run` functional
- Agent execution working
- Performance benchmarks met

**M3: Phase 3 Complete** (Week 3)
- Teams, sessions, templates working
- All supporting commands functional
- Integration testing complete

**M4: Release v8.1.0** (Week 4)
- Documentation complete
- User acceptance testing passed
- Release published

---

## Dependencies

### External Dependencies
- Node.js ≥24.x
- npm ≥10.x
- Git (for setup command)
- Claude Code (optional, for MCP integration)
- Gemini CLI (optional, for Gemini integration)

### Internal Dependencies
- v8.x codebase must be stable
- Provider system must support all 3 providers (Claude, Gemini, OpenAI)
- Configuration system must be extensible

---

## Open Questions

1. **Versioning Strategy**: Should this be v8.1.0 or v9.0.0?
   - **Recommendation**: v8.1.0 (additive, not breaking)

2. **Default Behavior**: Should `ax setup` be required or optional?
   - **Recommendation**: Optional (v8.x features work standalone)

3. **Agent Discovery**: Should agents auto-discover from git repositories?
   - **Recommendation**: Phase 2 feature, not MVP

4. **Template Marketplace**: Should we support community templates?
   - **Recommendation**: Future feature, not v8.1.0

5. **Provider Auto-Detection**: Should setup detect installed providers?
   - **Recommendation**: Yes, test API keys during setup

---

## Appendix

### A. YAML Schema Reference

**Agent Profile Schema**:
```yaml
# Required fields
name: string                    # Agent identifier
description: string             # Human-readable description

# Optional fields
persona:
  name: string                  # Agent persona name
  role: string                  # Role description
  expertise: string[]           # Areas of expertise

providers:
  default: string               # Default provider (claude/gemini/openai)
  models:
    claude: string              # Claude model
    gemini: string              # Gemini model
    openai: string              # OpenAI model
  fallback: string[]            # Fallback order

abilities:
  [category]: string[]          # Ability references by category

orchestration:
  maxDelegationDepth: number    # Max delegation levels
  canDelegateTo: string[]       # Allowed delegation targets
  canReadWorkspaces: string[]   # Workspace read access
  canWriteToShared: boolean     # Shared workspace write access

systemPrompt: string            # System prompt template
```

### B. Glossary

- **Agent**: AI entity with role, expertise, and configuration
- **Ability**: Domain expertise in markdown format
- **Team**: Group of agents with shared configuration
- **Template**: Scaffold for creating custom agents
- **Session**: Multi-agent collaboration context
- **Profile**: YAML configuration file for agent
- **Delegation**: Agent requesting help from another agent
- **Orchestration**: Multi-agent coordination rules

---

**Document Status**: Ready for Review
**Next Steps**: Create multi-phase action plan
**Approvers**: Engineering Lead, Product Manager
