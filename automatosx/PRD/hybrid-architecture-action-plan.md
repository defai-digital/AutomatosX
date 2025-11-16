# Multi-Phase Action Plan: Hybrid Architecture Restoration

**Document Type**: Engineering Action Plan
**Version**: 1.0
**Date**: 2025-11-15
**Related PRD**: `hybrid-architecture-restoration-prd.md`
**Status**: Ready for Implementation

---

## Executive Summary

This action plan details the **4-phase restoration** of v7.6.1 agent orchestration features into the v8.x code intelligence platform, creating a hybrid architecture.

**Total Effort**: 35-48 hours (5-6 working days)
**Timeline**: 4 weeks (1 week per phase)
**Team Size**: 1-2 developers
**Risk Level**: Medium (backward compatibility critical)

---

## Phase Overview

| Phase | Focus | Effort | Duration | Dependencies |
|-------|-------|--------|----------|--------------|
| **Phase 1** | Project Setup | 4.5-6h | Week 1 | None |
| **Phase 2** | Agent Execution | 16-23h | Week 2 | Phase 1 |
| **Phase 3** | Advanced Features | 8-11h | Week 3 | Phase 2 |
| **Phase 4** | Integration & Release | 6-8h | Week 4 | Phase 3 |
| **Total** | | **35-48h** | **4 weeks** | |

---

# Phase 1: Project Setup Foundation

**Goal**: Restore `ax setup` command and example resources
**Effort**: 4.5-6 hours
**Duration**: Week 1 (5 working days)

---

## Phase 1.1: Setup Command Core (2 hours)

### Tasks

#### Task 1.1.1: Copy setup.ts from v7.6.1 (30 min)
**Owner**: Engineer
**Priority**: P0

**Steps**:
```bash
# 1. Checkout v7.6.1 version
git show v7.6.1:src/cli/commands/setup.ts > /tmp/setup-v7.6.1.ts

# 2. Copy to v8.x
cp /tmp/setup-v7.6.1.ts src/cli/commands/setup.ts

# 3. Review file structure
wc -l src/cli/commands/setup.ts  # Should be ~1,297 lines
```

**Verification**:
- [ ] File exists at `src/cli/commands/setup.ts`
- [ ] File contains 1,200+ lines
- [ ] No Git conflicts

---

#### Task 1.1.2: Update imports for v8.x (45 min)
**Owner**: Engineer
**Priority**: P0

**Required Changes**:

```typescript
// OLD v7.6.1 imports (remove these)
import { DEFAULT_CONFIG } from '../../types/config.js';
import { AutomatosXConfig } from '../../types/config.js';

// NEW v8.x imports (add these)
import { defaultConfig } from '../../config/default.js';
import type { Config } from '../../types/schemas/config.schema.js';

// Check if these utilities exist in v8.x, otherwise implement
import { logger } from '../../utils/logger.js';
import { printError } from '../../utils/error-formatter.js';
```

**Steps**:
1. Search for all `import` statements
2. Map each to v8.x equivalent
3. Create mapping table for changed modules
4. Update all imports systematically
5. Handle missing utilities (implement or stub)

**Verification**:
- [ ] No TypeScript import errors
- [ ] All dependencies resolve
- [ ] `pnpm run build:typescript` succeeds

---

#### Task 1.1.3: Fix TypeScript compilation errors (45 min)
**Owner**: Engineer
**Priority**: P0

**Common Issues**:
1. **Config type changes**: v7.6.1 `AutomatosXConfig` → v8.x `Config`
2. **Missing utilities**: Implement stubbed versions
3. **Path changes**: Update relative imports
4. **Type incompatibilities**: Add type assertions

**Steps**:
```bash
# Build and capture errors
pnpm run build:typescript 2>&1 | tee /tmp/setup-errors.txt

# Fix errors iteratively
# Check error count after each fix
grep "error TS" /tmp/setup-errors.txt | wc -l
```

**Verification**:
- [ ] Zero TypeScript errors
- [ ] `pnpm run build:typescript` succeeds
- [ ] No type assertions marked as `@ts-ignore`

---

## Phase 1.2: Example Resources (1.5 hours)

### Tasks

#### Task 1.2.1: Copy examples/ directory (15 min)
**Owner**: Engineer
**Priority**: P0

**Steps**:
```bash
# 1. Extract entire examples/ directory from v7.6.1
git archive v7.6.1 examples/ | tar -x

# 2. Verify structure
tree examples/ -L 2

# Expected output:
# examples/
# ├── agents/       (21 YAML files)
# ├── abilities/    (60+ markdown files)
# ├── teams/        (5 YAML files)
# ├── templates/    (9 YAML files)
# └── [integration dirs]

# 3. Count files
find examples/ -type f | wc -l  # Should be 95+
```

**Verification**:
- [ ] `examples/agents/` contains 21 YAML files
- [ ] `examples/abilities/` contains 60+ markdown files
- [ ] `examples/teams/` contains 5 YAML files
- [ ] `examples/templates/` contains 9 YAML files

---

#### Task 1.2.2: Verify example file integrity (30 min)
**Owner**: Engineer
**Priority**: P1

**Verification Steps**:

1. **Validate YAML syntax**:
```bash
# Install YAML linter
npm install -g yaml-validator

# Validate all agent files
for file in examples/agents/*.yaml; do
  yaml-validator "$file" || echo "ERROR: $file"
done

# Validate all team files
for file in examples/teams/*.yaml; do
  yaml-validator "$file" || echo "ERROR: $file"
done
```

2. **Check ability references**:
```bash
# Extract ability references from agents
grep -r "abilities:" examples/agents/ | grep -o '\[.*\]' > /tmp/ability-refs.txt

# Check if referenced abilities exist
# (Manual review for now, automate later)
```

3. **Verify file completeness**:
```bash
# Check key agents exist
required_agents="backend frontend security quality devops"
for agent in $required_agents; do
  [ -f "examples/agents/$agent.yaml" ] || echo "MISSING: $agent"
done
```

**Verification**:
- [ ] All YAML files parse without errors
- [ ] All ability references valid
- [ ] All required agents present
- [ ] No broken links or missing dependencies

---

#### Task 1.2.3: Update setup.ts copy functions (45 min)
**Owner**: Engineer
**Priority**: P0

**Functions to Update**:

```typescript
// Update these functions to use correct paths
async function copyExampleAgents(targetDir: string, packageRoot: string): Promise<number> {
  const sourcePath = join(packageRoot, 'examples/agents');
  const targetPath = join(targetDir, 'agents');
  // ... copy logic
}

async function copyExampleAbilities(targetDir: string, packageRoot: string): Promise<number> {
  const sourcePath = join(packageRoot, 'examples/abilities');
  const targetPath = join(targetDir, 'abilities');
  // ... copy logic
}

async function copyExampleTeams(targetDir: string, packageRoot: string): Promise<number> {
  const sourcePath = join(packageRoot, 'examples/teams');
  const targetPath = join(targetDir, 'teams');
  // ... copy logic
}

async function copyExampleTemplates(targetDir: string, packageRoot: string): Promise<number> {
  const sourcePath = join(packageRoot, 'examples/templates');
  const targetPath = join(targetDir, 'templates');
  // ... copy logic
}
```

**Verification**:
- [ ] Copy functions work correctly
- [ ] File permissions preserved
- [ ] No copy errors or warnings

---

## Phase 1.3: Integration Files Setup (1 hour)

### Tasks

#### Task 1.3.1: Extract integration file creation functions (30 min)
**Owner**: Engineer
**Priority**: P1

**Functions to Verify**:

```typescript
// Ensure these functions work in v8.x context
async function setupClaudeIntegration(projectDir: string, packageRoot: string): Promise<void>;
async function setupGeminiIntegration(projectDir: string, packageRoot: string): Promise<void>;
async function setupProjectClaudeMd(projectDir: string, packageRoot: string, force: boolean): Promise<void>;
async function setupProjectGeminiMd(projectDir: string, packageRoot: string, force: boolean): Promise<void>;
async function setupProjectAgentsMd(projectDir: string, packageRoot: string, force: boolean): Promise<void>;
```

**Steps**:
1. Review each function implementation
2. Update file paths for v8.x
3. Test file creation
4. Verify content accuracy

**Verification**:
- [ ] `.claude/mcp/` directory created
- [ ] `.gemini/` directory created (if applicable)
- [ ] `CLAUDE.md` created with correct content
- [ ] `GEMINI.md` created with correct content
- [ ] `AGENTS.md` created with agent catalog

---

#### Task 1.3.2: Test integration file generation (30 min)
**Owner**: Engineer
**Priority**: P1

**Test Script**:
```bash
# Create test directory
mkdir -p /tmp/ax-test-setup
cd /tmp/ax-test-setup

# Run setup (from v8.x build)
ax setup

# Verify integration files
[ -d ".claude/mcp" ] && echo "✓ Claude MCP dir" || echo "✗ Claude MCP missing"
[ -f "CLAUDE.md" ] && echo "✓ CLAUDE.md" || echo "✗ CLAUDE.md missing"
[ -f "GEMINI.md" ] && echo "✓ GEMINI.md" || echo "✗ GEMINI.md missing"
[ -f "AGENTS.md" ] && echo "✓ AGENTS.md" || echo "✗ AGENTS.md missing"

# Verify content
grep -q "AutomatosX" CLAUDE.md && echo "✓ CLAUDE.md content" || echo "✗ Invalid content"
```

**Verification**:
- [ ] All integration files created
- [ ] File content accurate and complete
- [ ] Claude Code can read CLAUDE.md
- [ ] Gemini CLI can read GEMINI.md

---

## Phase 1.4: CLI Registration & Testing (1 hour)

### Tasks

#### Task 1.4.1: Register setup command in CLI (15 min)
**Owner**: Engineer
**Priority**: P0

**Update**: `src/cli/index.ts`

```typescript
// Add import
import { setupCommand } from './commands/setup.js';

// Add command registration (find the pattern in v8.x)
// Typically in yargs command registration or Commander.js registration
program
  .command(setupCommand.command)
  .description(setupCommand.describe)
  .action(setupCommand.handler);
```

**Verification**:
- [ ] `ax setup --help` shows help text
- [ ] No CLI registration errors
- [ ] Command appears in `ax --help` output

---

#### Task 1.4.2: End-to-end setup test (30 min)
**Owner**: Engineer
**Priority**: P0

**Test Procedure**:

```bash
# Test 1: Fresh directory setup
mkdir -p /tmp/test-fresh && cd /tmp/test-fresh
ax setup

# Verify directory structure
tree .automatosx/ -L 2

# Expected:
# .automatosx/
# ├── agents/ (21 files)
# ├── abilities/ (60+ files)
# ├── teams/ (5 files)
# ├── templates/ (9 files)
# ├── memory/
# ├── sessions/
# └── logs/

# Test 2: Force mode (re-run setup)
ax setup --force

# Verify no errors

# Test 3: Spec-kit mode
mkdir -p /tmp/test-speckit && cd /tmp/test-speckit
ax setup --spec-kit

# Verify .specify/ directory created

# Test 4: Home directory protection
cd ~ && ax setup
# Should error with helpful message
```

**Verification**:
- [ ] Fresh setup succeeds
- [ ] Force mode works
- [ ] Spec-kit mode works
- [ ] Home directory protection works
- [ ] All files copied correctly
- [ ] Config file valid JSON

---

#### Task 1.4.3: Write automated tests (15 min)
**Owner**: Engineer
**Priority**: P1

**Test File**: `src/cli/commands/__tests__/setup.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupCommand } from '../setup.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

describe('setup command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'ax-setup-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create .automatosx directory structure', async () => {
    await setupCommand.handler({ path: testDir });

    expect(existsSync(join(testDir, '.automatosx'))).toBe(true);
    expect(existsSync(join(testDir, '.automatosx/agents'))).toBe(true);
    expect(existsSync(join(testDir, '.automatosx/abilities'))).toBe(true);
    expect(existsSync(join(testDir, '.automatosx/teams'))).toBe(true);
    expect(existsSync(join(testDir, '.automatosx/templates'))).toBe(true);
  });

  it('should copy 21 agent profiles', async () => {
    await setupCommand.handler({ path: testDir });

    const agentFiles = await readdir(join(testDir, '.automatosx/agents'));
    expect(agentFiles.length).toBeGreaterThanOrEqual(21);
  });

  it('should create integration files', async () => {
    await setupCommand.handler({ path: testDir });

    expect(existsSync(join(testDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(testDir, 'GEMINI.md'))).toBe(true);
    expect(existsSync(join(testDir, 'AGENTS.md'))).toBe(true);
  });

  it('should prevent setup in home directory', async () => {
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    await expect(
      setupCommand.handler({ path: homeDir })
    ).rejects.toThrow();
  });

  it('should support force mode', async () => {
    // First setup
    await setupCommand.handler({ path: testDir });

    // Second setup with force
    await expect(
      setupCommand.handler({ path: testDir, force: true })
    ).resolves.not.toThrow();
  });
});
```

**Verification**:
- [ ] All tests pass
- [ ] Coverage ≥80% for setup.ts
- [ ] Edge cases covered

---

## Phase 1.5: Documentation (1 hour)

### Tasks

#### Task 1.5.1: Update README.md (30 min)
**Owner**: Engineer
**Priority**: P1

**Sections to Add**:

```markdown
## Quick Start

### 1. Install AutomatosX

\`\`\`bash
npm install -g @defai.digital/automatosx@8.1.0
\`\`\`

### 2. Setup Your Project

\`\`\`bash
cd your-project/
ax setup
\`\`\`

This creates:
- `.automatosx/` with agents, abilities, teams, templates
- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` integration guides
- `.claude/mcp/` for Claude Code integration
- `automatosx.config.json` configuration

### 3. Use AutomatosX

**Code Intelligence** (v8.x features):
\`\`\`bash
ax find "authentication"        # Search code
ax def getUserById              # Find definition
ax speckit generate adr "topic" # Generate specs
\`\`\`

**Agent Orchestration** (v7.6.1 features):
\`\`\`bash
ax run backend "create REST API"   # Run AI agent
ax run security "audit code"       # Security review
ax list agents                     # List available agents
\`\`\`

## Features

### Code Intelligence (v8.x)
- 🔍 **Code Search**: Tree-sitter parsing for 45+ languages
- 📊 **SQLite FTS5**: Full-text search with BM25 ranking
- 🚀 **LSP Server**: Editor integration via Language Server Protocol
- 🎨 **Web UI**: Dashboard for code metrics and dependencies
- 📝 **SpecKit**: Auto-generate ADRs, PRDs, API specs

### Agent Orchestration (v7.6.1 + v8.1.0)
- 🤖 **21 AI Agents**: Backend, frontend, security, DevOps, etc.
- 📄 **YAML Profiles**: Customize agents without coding
- 🧠 **60+ Abilities**: Domain expertise injection
- 👥 **Teams**: Collaborative multi-agent workflows
- 🔌 **Multi-Provider**: Claude, Gemini, OpenAI support
```

**Verification**:
- [ ] README updated
- [ ] Examples tested
- [ ] Links valid

---

#### Task 1.5.2: Create setup command guide (30 min)
**Owner**: Engineer
**Priority**: P1

**New File**: `docs/guides/setup-command.md`

```markdown
# Setup Command Guide

## Overview

The `ax setup` command initializes AutomatosX in your project directory.

## Usage

\`\`\`bash
ax setup [path] [options]
\`\`\`

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `path` | Project directory | Current directory |
| `--force` | Re-run setup even if .automatosx exists | false |
| `--spec-kit` | Initialize GitHub Spec-Kit | Interactive prompt |
| `--skip-spec-kit` | Skip Spec-Kit initialization | false |

## What Gets Created

### Directory Structure

\`\`\`
.automatosx/
├── agents/          # 21 YAML agent profiles
├── abilities/       # 60+ markdown expertise files
├── teams/           # 5 team configurations
├── templates/       # 9 agent templates
├── memory/          # Agent memory storage
├── sessions/        # Multi-agent sessions
└── logs/            # Execution logs
\`\`\`

### Integration Files

- `CLAUDE.md` - Claude Code integration guide
- `GEMINI.md` - Gemini CLI integration guide
- `AGENTS.md` - Agent catalog and usage examples
- `.claude/mcp/` - MCP tools configuration
- `.gitignore` - Updated with AutomatosX entries

### Configuration

- `automatosx.config.json` - Project configuration

## Examples

### Basic Setup

\`\`\`bash
cd my-project/
ax setup
\`\`\`

### Force Re-setup

\`\`\`bash
ax setup --force
\`\`\`

### Setup with Spec-Kit

\`\`\`bash
ax setup --spec-kit
\`\`\`

### Setup in Specific Directory

\`\`\`bash
ax setup /path/to/project
\`\`\`

## Troubleshooting

### Error: "Cannot set up AutomatosX in home directory"

**Cause**: You're trying to run `ax setup` in your home directory.

**Solution**: Create a project directory first:
\`\`\`bash
mkdir ~/projects/my-project
cd ~/projects/my-project
ax setup
\`\`\`

### Error: "AutomatosX is already set up"

**Cause**: `.automatosx/` directory already exists.

**Solution**: Use `--force` flag to re-run setup:
\`\`\`bash
ax setup --force
\`\`\`

## Next Steps

After setup:
1. Review `automatosx.config.json`
2. List agents: `ax list agents`
3. Run an agent: `ax run backend "Hello!"`
4. Customize agents: Edit `.automatosx/agents/backend.yaml`
```

**Verification**:
- [ ] Guide complete
- [ ] Examples work
- [ ] Troubleshooting helpful

---

## Phase 1 Deliverables Checklist

### Code Deliverables
- [ ] `src/cli/commands/setup.ts` (1,200+ lines)
- [ ] `examples/agents/` (21 YAML files)
- [ ] `examples/abilities/` (60+ markdown files)
- [ ] `examples/teams/` (5 YAML files)
- [ ] `examples/templates/` (9 YAML files)
- [ ] Integration templates (CLAUDE.md, GEMINI.md, AGENTS.md)

### Test Deliverables
- [ ] `src/cli/commands/__tests__/setup.test.ts`
- [ ] All tests passing
- [ ] Coverage ≥80%

### Documentation Deliverables
- [ ] README.md updated
- [ ] `docs/guides/setup-command.md` created
- [ ] Examples validated

### Acceptance Criteria
- [ ] `ax setup` command works end-to-end
- [ ] All example files copied correctly
- [ ] Integration files created
- [ ] Tests passing
- [ ] No breaking changes to v8.x
- [ ] Documentation complete

---

# Phase 2: Agent Execution System

**Goal**: Restore `ax run` command and agent infrastructure
**Effort**: 16-23 hours
**Duration**: Week 2 (5 working days)

---

## Phase 2.1: Agent Infrastructure (6-8 hours)

### Tasks

#### Task 2.1.1: Copy agent core modules (2 hours)
**Owner**: Engineer
**Priority**: P0

**Modules to Copy**:

```bash
# Extract from v7.6.1
git show v7.6.1:src/agents/profile-loader.ts > src/agents/profile-loader.ts
git show v7.6.1:src/agents/abilities-manager.ts > src/agents/abilities-manager.ts
git show v7.6.1:src/agents/executor.ts > src/agents/executor.ts
git show v7.6.1:src/agents/context-manager.ts > src/agents/context-manager.ts

# Create directory if needed
mkdir -p src/agents
```

**Files**:
1. **profile-loader.ts** (~300 lines) - YAML profile parsing and validation
2. **abilities-manager.ts** (~250 lines) - Ability loading and injection
3. **executor.ts** (~400 lines) - Agent execution engine
4. **context-manager.ts** (~200 lines) - Context management

**Verification**:
- [ ] All files copied
- [ ] Files compile (may have errors, fixed in next task)

---

#### Task 2.1.2: Update agent module imports (2 hours)
**Owner**: Engineer
**Priority**: P0

**Common Import Mappings**:

```typescript
// v7.6.1 → v8.x mappings
'../../types/agent.js' → '../../types/schemas/agent.schema.js'
'../../types/config.js' → '../../types/schemas/config.schema.js'
'../../providers/claude-provider.js' → '../../providers/claude-provider.js' // Same
'../../providers/gemini-provider.js' → '../../providers/gemini-provider.js' // Same
'../../providers/openai-provider.js' → '../../providers/openai-provider.js' // Same
'../utils/logger.js' → '../../utils/logger.js' // Path may differ
```

**Steps for Each File**:
1. List all imports
2. Check if module exists in v8.x
3. Map to v8.x equivalent or create stub
4. Update import paths
5. Compile and fix errors

**Verification**:
- [ ] profile-loader.ts compiles
- [ ] abilities-manager.ts compiles
- [ ] executor.ts compiles
- [ ] context-manager.ts compiles

---

#### Task 2.1.3: Implement ProfileLoader (2-3 hours)
**Owner**: Engineer
**Priority**: P0

**Class**: `ProfileLoader`

**Key Methods**:
```typescript
export class ProfileLoader {
  /**
   * Load agent profile from YAML file
   */
  async loadProfile(agentName: string): Promise<AgentProfile> {
    const profilePath = this.resolveProfilePath(agentName);
    const yamlContent = await fs.readFile(profilePath, 'utf-8');
    const profile = yaml.parse(yamlContent);
    this.validateProfile(profile);
    return profile;
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<string[]> {
    const agentsDir = join(this.projectRoot, '.automatosx/agents');
    const files = await fs.readdir(agentsDir);
    return files.filter(f => f.endsWith('.yaml')).map(f => f.replace('.yaml', ''));
  }

  /**
   * Validate profile schema
   */
  private validateProfile(profile: unknown): asserts profile is AgentProfile {
    // Use Zod or manual validation
    if (!profile.name) throw new Error('Agent profile missing name');
    if (!profile.description) throw new Error('Agent profile missing description');
    // ... more validation
  }
}
```

**Testing**:
```typescript
describe('ProfileLoader', () => {
  it('should load backend agent profile', async () => {
    const loader = new ProfileLoader();
    const profile = await loader.loadProfile('backend');

    expect(profile.name).toBe('backend');
    expect(profile.persona.name).toBe('Bob');
    expect(profile.providers.default).toBeDefined();
  });

  it('should list all available agents', async () => {
    const loader = new ProfileLoader();
    const agents = await loader.listAgents();

    expect(agents).toContain('backend');
    expect(agents).toContain('frontend');
    expect(agents.length).toBeGreaterThanOrEqual(21);
  });

  it('should validate profile schema', async () => {
    const loader = new ProfileLoader();

    await expect(
      loader.loadProfile('invalid-agent')
    ).rejects.toThrow();
  });
});
```

**Verification**:
- [ ] ProfileLoader loads YAML files
- [ ] Validation works
- [ ] Tests pass

---

#### Task 2.1.4: Implement AbilitiesManager (1.5-2 hours)
**Owner**: Engineer
**Priority**: P0

**Class**: `AbilitiesManager`

**Key Methods**:
```typescript
export class AbilitiesManager {
  /**
   * Load abilities referenced in agent profile
   */
  async loadAbilities(abilityRefs: Record<string, string[]>): Promise<string[]> {
    const abilities: string[] = [];

    for (const [category, refs] of Object.entries(abilityRefs)) {
      for (const ref of refs) {
        const content = await this.loadAbility(ref);
        abilities.push(content);
      }
    }

    return abilities;
  }

  /**
   * Load single ability markdown file
   */
  private async loadAbility(abilityName: string): Promise<string> {
    const abilityPath = join(
      this.projectRoot,
      '.automatosx/abilities',
      `${abilityName}.md`
    );

    if (!existsSync(abilityPath)) {
      this.logger.warn(`Ability not found: ${abilityName}`);
      return '';
    }

    return await fs.readFile(abilityPath, 'utf-8');
  }

  /**
   * Select abilities based on task keywords
   */
  selectAbilitiesForTask(task: string, availableAbilities: string[]): string[] {
    // Simple keyword matching (can be enhanced with ML later)
    const keywords = task.toLowerCase().split(/\s+/);
    const selected: string[] = [];

    for (const ability of availableAbilities) {
      if (keywords.some(kw => ability.toLowerCase().includes(kw))) {
        selected.push(ability);
      }
    }

    return selected;
  }
}
```

**Testing**:
```typescript
describe('AbilitiesManager', () => {
  it('should load ability markdown files', async () => {
    const manager = new AbilitiesManager();
    const abilities = await manager.loadAbilities({
      api: ['api-design', 'rest-best-practices']
    });

    expect(abilities).toHaveLength(2);
    expect(abilities[0]).toContain('API Design');
  });

  it('should handle missing abilities gracefully', async () => {
    const manager = new AbilitiesManager();
    const abilities = await manager.loadAbilities({
      api: ['non-existent-ability']
    });

    // Should not throw, just log warning
    expect(abilities).toBeDefined();
  });

  it('should select abilities based on task keywords', () => {
    const manager = new AbilitiesManager();
    const selected = manager.selectAbilitiesForTask(
      'create REST API',
      ['api-design', 'database', 'security']
    );

    expect(selected).toContain('api-design');
  });
});
```

**Verification**:
- [ ] Ability loading works
- [ ] Task-based selection works
- [ ] Tests pass

---

## Phase 2.2: Agent Execution (4-6 hours)

### Tasks

#### Task 2.2.1: Implement AgentExecutor (3-4 hours)
**Owner**: Engineer
**Priority**: P0

**Class**: `AgentExecutor`

**Key Methods**:
```typescript
export class AgentExecutor {
  constructor(
    private profileLoader: ProfileLoader,
    private abilitiesManager: AbilitiesManager,
    private contextManager: ContextManager
  ) {}

  /**
   * Execute agent with task
   */
  async execute(agentName: string, task: string, options: RunOptions): Promise<ExecutionResult> {
    // 1. Load agent profile
    const profile = await this.profileLoader.loadProfile(agentName);

    // 2. Load abilities
    const abilities = await this.abilitiesManager.loadAbilities(profile.abilities || {});

    // 3. Build context
    const context = await this.contextManager.buildContext(task, options);

    // 4. Select provider
    const provider = await this.selectProvider(profile, options);

    // 5. Build system prompt
    const systemPrompt = this.buildSystemPrompt(profile, abilities, task);

    // 6. Execute with provider
    const result = await provider.complete({
      systemPrompt,
      userMessage: task,
      context,
      ...options
    });

    // 7. Format result
    return this.formatResult(result, profile, options);
  }

  /**
   * Select provider based on profile and options
   */
  private async selectProvider(
    profile: AgentProfile,
    options: RunOptions
  ): Promise<Provider> {
    const providerName = options.provider || profile.providers?.default || 'claude';

    switch (providerName) {
      case 'claude':
        return new ClaudeProvider(/* config */);
      case 'gemini':
        return new GeminiProvider(/* config */);
      case 'openai':
        return await createOpenAIProviderSync(/* config */);
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }

  /**
   * Build system prompt with abilities
   */
  private buildSystemPrompt(
    profile: AgentProfile,
    abilities: string[],
    task: string
  ): string {
    let prompt = profile.systemPrompt || '';

    // Add persona
    if (profile.persona) {
      prompt += `\n\nYou are ${profile.persona.name}, ${profile.persona.role}.`;
    }

    // Add abilities
    if (abilities.length > 0) {
      prompt += '\n\n## Domain Expertise\n\n';
      prompt += abilities.join('\n\n---\n\n');
    }

    return prompt;
  }

  /**
   * Format execution result
   */
  private formatResult(
    result: ProviderResponse,
    profile: AgentProfile,
    options: RunOptions
  ): ExecutionResult {
    const formatted: ExecutionResult = {
      agent: profile.name,
      persona: profile.persona?.name,
      provider: result.provider,
      model: result.model,
      content: result.content,
      metadata: result.metadata
    };

    if (options.format === 'json') {
      return formatted;
    } else if (options.format === 'markdown') {
      return this.formatAsMarkdown(formatted);
    } else {
      return this.formatAsText(formatted);
    }
  }
}
```

**Testing**:
```typescript
describe('AgentExecutor', () => {
  it('should execute backend agent with task', async () => {
    const executor = new AgentExecutor(
      profileLoader,
      abilitiesManager,
      contextManager
    );

    const result = await executor.execute('backend', 'create REST API');

    expect(result.agent).toBe('backend');
    expect(result.persona).toBe('Bob');
    expect(result.content).toBeDefined();
  });

  it('should use specified provider', async () => {
    const executor = new AgentExecutor(/* deps */);

    const result = await executor.execute('backend', 'task', {
      provider: 'gemini'
    });

    expect(result.provider).toBe('gemini');
  });

  it('should inject abilities into prompt', async () => {
    // Test that abilities are included in system prompt
  });
});
```

**Verification**:
- [ ] AgentExecutor works end-to-end
- [ ] Provider selection works
- [ ] Ability injection works
- [ ] Tests pass

---

#### Task 2.2.2: Copy and update run.ts command (2 hours)
**Owner**: Engineer
**Priority**: P0

**Steps**:
```bash
# 1. Copy run.ts from v7.6.1
git show v7.6.1:src/cli/commands/run.ts > src/cli/commands/run.ts

# 2. Update imports (similar to setup.ts)
# 3. Wire up AgentExecutor
# 4. Test compilation
```

**Key Updates**:
```typescript
// In run.ts handler
export const runCommand: CommandModule<Record<string, unknown>, RunOptions> = {
  command: 'run <agent> <task>',
  describe: 'Run an agent with a specific task',

  handler: async (argv) => {
    // Initialize components
    const profileLoader = new ProfileLoader();
    const abilitiesManager = new AbilitiesManager();
    const contextManager = new ContextManager();
    const executor = new AgentExecutor(
      profileLoader,
      abilitiesManager,
      contextManager
    );

    // Execute
    const result = await executor.execute(
      argv.agent,
      argv.task,
      {
        provider: argv.provider,
        model: argv.model,
        memory: argv.memory,
        verbose: argv.verbose,
        format: argv.format,
        // ... other options
      }
    );

    // Display result
    console.log(formatOutput(result, argv.format));

    // Save if requested
    if (argv.save) {
      await fs.writeFile(argv.save, formatForSave(result, argv.format));
    }
  }
};
```

**Verification**:
- [ ] run.ts compiles
- [ ] Command registered in CLI
- [ ] Basic execution works

---

## Phase 2.3: Supporting Infrastructure (3-5 hours)

### Tasks

#### Task 2.3.1: Implement ContextManager (1.5-2 hours)
**Owner**: Engineer
**Priority**: P1

**Class**: `ContextManager`

**Key Methods**:
```typescript
export class ContextManager {
  /**
   * Build execution context from task and options
   */
  async buildContext(task: string, options: RunOptions): Promise<Context> {
    const context: Context = {
      task,
      timestamp: new Date(),
      cwd: process.cwd(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Add memory if requested
    if (options.memory) {
      context.memory = await this.loadMemory(task);
    }

    // Add session context if in session
    if (options.session) {
      context.session = await this.loadSession(options.session);
    }

    return context;
  }

  /**
   * Load relevant memory for task
   */
  private async loadMemory(task: string): Promise<MemoryEntry[]> {
    // Use v8.x MemoryService
    const memoryService = new MemoryService();
    return await memoryService.search(task, { limit: 10 });
  }

  /**
   * Load session context
   */
  private async loadSession(sessionId: string): Promise<SessionContext> {
    // Implementation deferred to Phase 3
    return null;
  }
}
```

**Verification**:
- [ ] Context building works
- [ ] Memory integration works (if MemoryService available)
- [ ] Tests pass

---

#### Task 2.3.2: Copy team-manager.ts (1 hour)
**Owner**: Engineer
**Priority**: P1

**Steps**:
```bash
# Copy from v7.6.1
git show v7.6.1:src/core/team-manager.ts > src/core/team-manager.ts

# Update imports
# Test compilation
```

**Class**: `TeamManager`

**Key Methods**:
```typescript
export class TeamManager {
  /**
   * Load team configuration
   */
  async loadTeam(teamName: string): Promise<TeamConfig> {
    const teamPath = join(
      this.projectRoot,
      '.automatosx/teams',
      `${teamName}.yaml`
    );

    const yamlContent = await fs.readFile(teamPath, 'utf-8');
    return yaml.parse(yamlContent);
  }

  /**
   * Get agent's team
   */
  async getAgentTeam(agentName: string): Promise<TeamConfig | null> {
    const teams = await this.listTeams();

    for (const team of teams) {
      if (team.members?.includes(agentName)) {
        return team;
      }
    }

    return null;
  }

  /**
   * Merge agent profile with team config
   */
  mergeWithTeam(
    agentProfile: AgentProfile,
    teamConfig: TeamConfig
  ): AgentProfile {
    return {
      ...agentProfile,
      providers: {
        ...teamConfig.sharedProviders,
        ...agentProfile.providers
      },
      abilities: {
        ...this.mergeAbilities(teamConfig.sharedAbilities, agentProfile.abilities)
      }
    };
  }
}
```

**Verification**:
- [ ] TeamManager loads team configs
- [ ] Profile merging works
- [ ] Tests pass

---

#### Task 2.3.3: Integration with ProfileLoader (30-45 min)
**Owner**: Engineer
**Priority**: P1

**Update**: `ProfileLoader.loadProfile()`

```typescript
async loadProfile(agentName: string): Promise<AgentProfile> {
  // Load agent profile
  const profilePath = this.resolveProfilePath(agentName);
  const yamlContent = await fs.readFile(profilePath, 'utf-8');
  let profile = yaml.parse(yamlContent);

  // Load team config if agent belongs to team
  const teamManager = new TeamManager();
  const team = await teamManager.getAgentTeam(agentName);

  if (team) {
    profile = teamManager.mergeWithTeam(profile, team);
  }

  this.validateProfile(profile);
  return profile;
}
```

**Verification**:
- [ ] Team inheritance works
- [ ] Shared providers applied
- [ ] Shared abilities applied

---

## Phase 2.4: Testing & Refinement (3-4 hours)

### Tasks

#### Task 2.4.1: End-to-end execution testing (2 hours)
**Owner**: Engineer
**Priority**: P0

**Test Cases**:

```bash
# Test 1: Basic execution
ax run backend "create a hello world function"

# Expected output:
# 🤖 Bob (Senior Backend Engineer) via Claude Sonnet 4
#
# Here's a hello world function in TypeScript:
# ...

# Test 2: With verbose flag
ax run backend "task" --verbose

# Expected: Detailed output with timing, tokens, etc.

# Test 3: Different providers
ax run backend "task" --provider gemini
ax run backend "task" --provider openai

# Test 4: Output formats
ax run backend "task" --format json
ax run backend "task" --format markdown

# Test 5: Save to file
ax run backend "task" --save /tmp/result.md

# Test 6: All 21 agents
for agent in backend frontend security quality devops; do
  ax run $agent "hello"
done

# Test 7: Ability loading
ax run backend "create REST API"
# Should include api-design ability

# Test 8: Team inheritance
ax run backend "task"
# Should use engineering team's shared config
```

**Verification**:
- [ ] All test cases pass
- [ ] No errors or warnings
- [ ] Output formatted correctly
- [ ] Performance acceptable (<500ms startup)

---

#### Task 2.4.2: Write comprehensive tests (1.5-2 hours)
**Owner**: Engineer
**Priority**: P0

**Test Files**:

1. **`src/agents/__tests__/profile-loader.test.ts`**
```typescript
describe('ProfileLoader', () => {
  it('should load all 21 example agents', async () => {
    const loader = new ProfileLoader();
    const agents = await loader.listAgents();

    expect(agents.length).toBeGreaterThanOrEqual(21);

    // Test each agent loads
    for (const agentName of agents) {
      await expect(loader.loadProfile(agentName)).resolves.toBeDefined();
    }
  });

  it('should validate profile schema', () => {
    // Test validation rules
  });

  it('should merge team configuration', async () => {
    // Test team inheritance
  });
});
```

2. **`src/agents/__tests__/abilities-manager.test.ts`**
```typescript
describe('AbilitiesManager', () => {
  it('should load all ability files', async () => {
    const manager = new AbilitiesManager();
    // Test all 60+ abilities load
  });

  it('should select abilities based on task', () => {
    // Test keyword-based selection
  });
});
```

3. **`src/agents/__tests__/executor.test.ts`**
```typescript
describe('AgentExecutor', () => {
  it('should execute with mock provider', async () => {
    // Test execution flow
  });

  it('should format output correctly', () => {
    // Test formatters
  });
});
```

4. **`src/cli/commands/__tests__/run.test.ts`**
```typescript
describe('run command', () => {
  it('should execute agent via CLI', async () => {
    // Integration test
  });
});
```

**Verification**:
- [ ] All tests pass
- [ ] Coverage ≥85%
- [ ] No flaky tests

---

## Phase 2 Deliverables Checklist

### Code Deliverables
- [ ] `src/agents/profile-loader.ts` (~300 lines)
- [ ] `src/agents/abilities-manager.ts` (~250 lines)
- [ ] `src/agents/executor.ts` (~400 lines)
- [ ] `src/agents/context-manager.ts` (~200 lines)
- [ ] `src/core/team-manager.ts` (~200 lines)
- [ ] `src/cli/commands/run.ts` (1,000+ lines)

### Test Deliverables
- [ ] `src/agents/__tests__/*.test.ts` (4+ files)
- [ ] `src/cli/commands/__tests__/run.test.ts`
- [ ] Coverage ≥85%
- [ ] All tests passing

### Documentation Deliverables
- [ ] `docs/guides/run-command.md`
- [ ] `docs/guides/agent-profiles.md`
- [ ] `docs/guides/abilities-system.md`
- [ ] README updated with `ax run` examples

### Acceptance Criteria
- [ ] `ax run <agent> <task>` works end-to-end
- [ ] All 21 example agents execute successfully
- [ ] Abilities inject into prompts
- [ ] Teams inheritance works
- [ ] Multiple providers supported
- [ ] Output formatting works
- [ ] Tests passing
- [ ] No breaking changes to v8.x

---

# Phase 3: Advanced Features

**Goal**: Restore sessions, templates, delegation, and supporting commands
**Effort**: 8-11 hours
**Duration**: Week 3 (5 working days)

---

## Phase 3.1: Session Management (3-4 hours)

### Tasks

#### Task 3.1.1: Copy session-manager.ts (1 hour)
**Owner**: Engineer
**Priority**: P1

**Steps**:
```bash
git show v7.6.1:src/core/session-manager.ts > src/core/session-manager.ts
# Update imports
# Test compilation
```

**Class**: `SessionManager`

**Key Methods**:
```typescript
export class SessionManager {
  async createSession(
    name: string,
    agents: string[],
    description?: string
  ): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      name,
      agents,
      description,
      created: new Date(),
      state: 'active',
      history: []
    };

    await this.saveSession(session);
    return session;
  }

  async joinSession(sessionId: string, agentName: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session.agents.includes(agentName)) {
      session.agents.push(agentName);
      await this.saveSession(session);
    }
  }

  async addToHistory(
    sessionId: string,
    entry: SessionHistoryEntry
  ): Promise<void> {
    const session = await this.loadSession(sessionId);
    session.history.push(entry);
    await this.saveSession(session);
  }

  private async saveSession(session: Session): Promise<void> {
    const sessionPath = join(
      this.projectRoot,
      '.automatosx/sessions',
      `${session.id}.json`
    );
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  private async loadSession(sessionId: string): Promise<Session> {
    const sessionPath = join(
      this.projectRoot,
      '.automatosx/sessions',
      `${sessionId}.json`
    );
    const content = await fs.readFile(sessionPath, 'utf-8');
    return JSON.parse(content);
  }

  async listSessions(): Promise<Session[]> {
    const sessionsDir = join(this.projectRoot, '.automatosx/sessions');
    const files = await fs.readdir(sessionsDir);

    const sessions: Session[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const session = await this.loadSession(file.replace('.json', ''));
        sessions.push(session);
      }
    }

    return sessions;
  }
}
```

**Verification**:
- [ ] SessionManager compiles
- [ ] Sessions persist to disk
- [ ] List/create/join work

---

#### Task 3.1.2: Implement session.ts command (1.5 hours)
**Owner**: Engineer
**Priority**: P1

**File**: `src/cli/commands/session.ts`

```typescript
export const sessionCommand: CommandModule = {
  command: 'session <subcommand>',
  describe: 'Manage multi-agent sessions',

  builder: (yargs) => {
    return yargs
      .command('create <name> <agents...>', 'Create new session', {}, async (argv) => {
        const manager = new SessionManager();
        const session = await manager.createSession(
          argv.name as string,
          argv.agents as string[]
        );

        console.log(chalk.green(`✓ Session created: ${session.id}`));
        console.log(`  Name: ${session.name}`);
        console.log(`  Agents: ${session.agents.join(', ')}`);
      })
      .command('list', 'List all sessions', {}, async () => {
        const manager = new SessionManager();
        const sessions = await manager.listSessions();

        // Display table
        const table = new Table({
          head: ['ID', 'Name', 'Agents', 'Created', 'State']
        });

        for (const session of sessions) {
          table.push([
            session.id.substring(0, 8),
            session.name,
            session.agents.join(', '),
            session.created.toLocaleDateString(),
            session.state
          ]);
        }

        console.log(table.toString());
      })
      .command('show <id>', 'Show session details', {}, async (argv) => {
        const manager = new SessionManager();
        const session = await manager.loadSession(argv.id as string);

        console.log(chalk.bold(`\nSession: ${session.name}`));
        console.log(`ID: ${session.id}`);
        console.log(`Agents: ${session.agents.join(', ')}`);
        console.log(`Created: ${session.created}`);
        console.log(`State: ${session.state}`);
        console.log(`\nHistory (${session.history.length} entries):\n`);

        for (const entry of session.history.slice(-10)) {
          console.log(`[${entry.timestamp}] ${entry.agent}: ${entry.action}`);
        }
      })
      .command('close <id>', 'Close session', {}, async (argv) => {
        const manager = new SessionManager();
        const session = await manager.loadSession(argv.id as string);
        session.state = 'closed';
        await manager.saveSession(session);

        console.log(chalk.green(`✓ Session closed: ${session.id}`));
      })
      .demandCommand(1, 'Please specify a subcommand');
  },

  handler: () => {
    // Handled by subcommands
  }
};
```

**Verification**:
- [ ] `ax session create` works
- [ ] `ax session list` works
- [ ] `ax session show` works
- [ ] `ax session close` works

---

#### Task 3.1.3: Integrate sessions with run command (30-45 min)
**Owner**: Engineer
**Priority**: P2

**Update**: `src/cli/commands/run.ts`

```typescript
// Add --session flag support
.option('session', {
  describe: 'Join existing multi-agent session',
  type: 'string'
})

// In handler:
if (argv.session) {
  const sessionManager = new SessionManager();

  // Add execution to session history
  await sessionManager.addToHistory(argv.session, {
    timestamp: new Date(),
    agent: argv.agent,
    action: argv.task,
    result: result.content.substring(0, 200)
  });

  console.log(chalk.gray(`\n[Session: ${argv.session}]`));
}
```

**Verification**:
- [ ] `ax run` with `--session` flag works
- [ ] History persists

---

## Phase 3.2: Agent Templates (2-3 hours)

### Tasks

#### Task 3.2.1: Implement agent create command (2 hours)
**Owner**: Engineer
**Priority**: P2

**File**: `src/cli/commands/agent.ts` (Update existing or create new)

```typescript
// Add create subcommand
.command('create <name>', 'Create new agent from template', (yargs) => {
  return yargs
    .positional('name', {
      describe: 'Agent name',
      type: 'string'
    })
    .option('template', {
      alias: 't',
      describe: 'Template type',
      type: 'string',
      choices: [
        'basic-agent',
        'developer',
        'code-reviewer',
        'designer',
        'qa-specialist',
        'analyst',
        'assistant',
        'debugger',
        'fullstack-developer'
      ],
      default: 'basic-agent'
    })
    .option('description', {
      alias: 'd',
      describe: 'Agent description',
      type: 'string'
    });
}, async (argv) => {
  // Load template
  const templatePath = join(
    getPackageRoot(),
    'examples/templates',
    `${argv.template}.yaml`
  );

  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = yaml.parse(templateContent);

  // Customize template
  template.name = argv.name;
  if (argv.description) {
    template.description = argv.description;
  }

  // Save to project
  const agentPath = join(
    process.cwd(),
    '.automatosx/agents',
    `${argv.name}.yaml`
  );

  await fs.writeFile(agentPath, yaml.stringify(template));

  console.log(chalk.green(`✓ Agent created: ${argv.name}`));
  console.log(chalk.gray(`  Path: ${agentPath}`));
  console.log(chalk.gray(`  Template: ${argv.template}`));
  console.log(chalk.cyan(`\nNext steps:`));
  console.log(chalk.white(`  1. Edit: ${agentPath}`));
  console.log(chalk.white(`  2. Customize persona, abilities, providers`));
  console.log(chalk.white(`  3. Run: ax run ${argv.name} "task"`));
})
```

**Verification**:
- [ ] `ax agent create` works
- [ ] Template loaded correctly
- [ ] Agent file created
- [ ] Custom agent runs successfully

---

#### Task 3.2.2: Add templates to setup command (30 min)
**Owner**: Engineer
**Priority**: P2

**Verify**: `copyExampleTemplates()` in `setup.ts` works correctly

**Test**:
```bash
ax setup
ls -l .automatosx/templates/

# Should show:
# basic-agent.yaml
# developer.yaml
# code-reviewer.yaml
# designer.yaml
# qa-specialist.yaml
# analyst.yaml
# assistant.yaml
# debugger.yaml
# fullstack-developer.yaml
```

**Verification**:
- [ ] All 9 templates copied
- [ ] Templates valid YAML
- [ ] Can create agents from each template

---

## Phase 3.3: Multi-Agent Delegation (2-3 hours)

### Tasks

#### Task 3.3.1: Implement delegation in AgentExecutor (1.5-2 hours)
**Owner**: Engineer
**Priority**: P2

**Update**: `src/agents/executor.ts`

```typescript
export class AgentExecutor {
  private delegationDepth = 0;

  async execute(
    agentName: string,
    task: string,
    options: RunOptions
  ): Promise<ExecutionResult> {
    // Load profile
    const profile = await this.profileLoader.loadProfile(agentName);

    // Check delegation depth
    const maxDepth = profile.orchestration?.maxDelegationDepth ?? 0;
    if (this.delegationDepth > maxDepth) {
      throw new Error(`Max delegation depth exceeded: ${maxDepth}`);
    }

    // ... existing execution logic

    // Check if delegation needed (extract from response)
    const delegations = this.extractDelegations(result.content, profile);

    if (delegations.length > 0) {
      const delegationResults = await this.executeDelegations(
        delegations,
        profile,
        options
      );

      // Aggregate results
      result.delegations = delegationResults;
    }

    return result;
  }

  /**
   * Extract delegation requests from response
   */
  private extractDelegations(
    content: string,
    profile: AgentProfile
  ): Delegation[] {
    // Parse response for delegation markers
    // Example: "[DELEGATE to: backend, task: implement API]"
    const regex = /\[DELEGATE to: (\w+), task: ([^\]]+)\]/g;
    const delegations: Delegation[] = [];

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, targetAgent, task] = match;

      // Check if delegation allowed
      const canDelegate = profile.orchestration?.canDelegateTo?.includes(targetAgent);
      if (canDelegate) {
        delegations.push({ agent: targetAgent, task });
      } else {
        this.logger.warn(`Delegation to ${targetAgent} not allowed for ${profile.name}`);
      }
    }

    return delegations;
  }

  /**
   * Execute delegated tasks
   */
  private async executeDelegations(
    delegations: Delegation[],
    profile: AgentProfile,
    options: RunOptions
  ): Promise<DelegationResult[]> {
    const results: DelegationResult[] = [];

    for (const delegation of delegations) {
      // Increment delegation depth
      this.delegationDepth++;

      try {
        const result = await this.execute(
          delegation.agent,
          delegation.task,
          options
        );

        results.push({
          agent: delegation.agent,
          task: delegation.task,
          result
        });
      } finally {
        // Decrement depth
        this.delegationDepth--;
      }
    }

    return results;
  }
}
```

**Testing**:
```typescript
describe('AgentExecutor delegation', () => {
  it('should delegate to allowed agents', async () => {
    // Mock response with delegation marker
    const mockProvider = {
      complete: vi.fn().mockResolvedValue({
        content: '[DELEGATE to: backend, task: implement API]'
      })
    };

    // ... test execution with delegation
  });

  it('should prevent delegation beyond max depth', async () => {
    // Test max depth enforcement
  });

  it('should reject delegation to disallowed agents', async () => {
    // Test canDelegateTo whitelist
  });
});
```

**Verification**:
- [ ] Delegation extraction works
- [ ] Delegation execution works
- [ ] Depth limit enforced
- [ ] Whitelist enforced

---

## Phase 3.4: Supporting Commands (1-2 hours)

### Tasks

#### Task 3.4.1: Implement list command (1 hour)
**Owner**: Engineer
**Priority**: P1

**File**: `src/cli/commands/list.ts`

```typescript
export const listCommand: CommandModule = {
  command: 'list <resource>',
  describe: 'List agents, teams, abilities, or templates',

  builder: (yargs) => {
    return yargs
      .positional('resource', {
        describe: 'Resource type',
        type: 'string',
        choices: ['agents', 'teams', 'abilities', 'templates']
      })
      .option('format', {
        describe: 'Output format',
        type: 'string',
        choices: ['table', 'json', 'list'],
        default: 'table'
      });
  },

  handler: async (argv) => {
    switch (argv.resource) {
      case 'agents':
        await listAgents(argv.format);
        break;
      case 'teams':
        await listTeams(argv.format);
        break;
      case 'abilities':
        await listAbilities(argv.format);
        break;
      case 'templates':
        await listTemplates(argv.format);
        break;
    }
  }
};

async function listAgents(format: string) {
  const loader = new ProfileLoader();
  const agents = await loader.listAgents();

  if (format === 'json') {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  if (format === 'list') {
    agents.forEach(a => console.log(a));
    return;
  }

  // Table format
  const table = new Table({
    head: ['Agent', 'Description', 'Team', 'Provider']
  });

  for (const agentName of agents) {
    const profile = await loader.loadProfile(agentName);
    table.push([
      profile.name,
      profile.description || '-',
      (await getAgentTeam(agentName)) || '-',
      profile.providers?.default || 'claude'
    ]);
  }

  console.log(chalk.bold('\nAvailable Agents:\n'));
  console.log(table.toString());
  console.log(chalk.gray(`\nTotal: ${agents.length} agents\n`));
}

async function listAbilities(format: string) {
  const abilitiesDir = join(process.cwd(), '.automatosx/abilities');
  const files = await fs.readdir(abilitiesDir);
  const abilities = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));

  if (format === 'json') {
    console.log(JSON.stringify(abilities, null, 2));
    return;
  }

  if (format === 'list') {
    abilities.forEach(a => console.log(a));
    return;
  }

  // Group by category
  const categories = groupAbilitiesByCategory(abilities);

  console.log(chalk.bold('\nAvailable Abilities:\n'));

  for (const [category, items] of Object.entries(categories)) {
    console.log(chalk.cyan(`\n${category}:`));
    items.forEach(item => console.log(`  • ${item}`));
  }

  console.log(chalk.gray(`\nTotal: ${abilities.length} abilities\n`));
}

// Similar for listTeams() and listTemplates()
```

**Verification**:
- [ ] `ax list agents` works
- [ ] `ax list teams` works
- [ ] `ax list abilities` works
- [ ] `ax list templates` works
- [ ] All formats work (table, json, list)

---

#### Task 3.4.2: Implement runs and resume commands (1 hour)
**Owner**: Engineer
**Priority**: P2

**Files**:
- `src/cli/commands/runs.ts`
- `src/cli/commands/resume.ts`

**runs.ts**:
```typescript
export const runsCommand: CommandModule = {
  command: 'runs <subcommand>',
  describe: 'View agent execution history',

  builder: (yargs) => {
    return yargs
      .command('list', 'List recent runs', {}, async () => {
        const runs = await loadRecentRuns();

        const table = new Table({
          head: ['ID', 'Agent', 'Task', 'Status', 'Timestamp']
        });

        for (const run of runs) {
          table.push([
            run.id.substring(0, 8),
            run.agent,
            run.task.substring(0, 40),
            run.status,
            run.timestamp.toLocaleString()
          ]);
        }

        console.log(table.toString());
      })
      .command('show <id>', 'Show run details', {}, async (argv) => {
        const run = await loadRun(argv.id as string);

        console.log(chalk.bold(`\nRun: ${run.id}`));
        console.log(`Agent: ${run.agent}`);
        console.log(`Task: ${run.task}`);
        console.log(`Status: ${run.status}`);
        console.log(`Timestamp: ${run.timestamp}`);
        console.log(`\nResult:\n`);
        console.log(run.result);

        if (run.checkpoint) {
          console.log(chalk.cyan(`\n✓ Checkpoint available`));
          console.log(chalk.gray(`Resume with: ax resume ${run.id}`));
        }
      })
      .demandCommand(1);
  },

  handler: () => {}
};
```

**resume.ts**:
```typescript
export const resumeCommand: CommandModule = {
  command: 'resume <id>',
  describe: 'Resume execution from checkpoint',

  handler: async (argv) => {
    const run = await loadRun(argv.id as string);

    if (!run.checkpoint) {
      console.log(chalk.red('✗ No checkpoint available for this run'));
      process.exit(1);
    }

    console.log(chalk.cyan(`Resuming run: ${run.id}`));
    console.log(chalk.gray(`Agent: ${run.agent}`));
    console.log(chalk.gray(`Task: ${run.task}\n`));

    // Resume execution from checkpoint
    const executor = new AgentExecutor(/* deps */);
    const result = await executor.resumeFromCheckpoint(run.checkpoint);

    console.log(formatOutput(result));
  }
};
```

**Verification**:
- [ ] `ax runs list` works
- [ ] `ax runs show` works
- [ ] `ax resume` works (basic implementation)

---

## Phase 3 Deliverables Checklist

### Code Deliverables
- [ ] `src/core/session-manager.ts`
- [ ] `src/cli/commands/session.ts`
- [ ] `src/cli/commands/list.ts`
- [ ] `src/cli/commands/runs.ts`
- [ ] `src/cli/commands/resume.ts`
- [ ] Agent delegation in `AgentExecutor`
- [ ] Agent templates in `agent.ts`

### Test Deliverables
- [ ] Session management tests
- [ ] Delegation tests
- [ ] List commands tests
- [ ] Coverage maintained ≥85%

### Documentation Deliverables
- [ ] `docs/guides/sessions.md`
- [ ] `docs/guides/delegation.md`
- [ ] `docs/guides/templates.md`
- [ ] Examples updated

### Acceptance Criteria
- [ ] `ax session` commands work
- [ ] `ax list` commands work
- [ ] `ax agent create` works
- [ ] `ax runs` and `ax resume` work (basic)
- [ ] Delegation functional
- [ ] Tests passing
- [ ] Documentation complete

---

# Phase 4: Integration & Release

**Goal**: Integration testing, documentation, and v8.1.0 release
**Effort**: 6-8 hours
**Duration**: Week 4 (5 working days)

---

## Phase 4.1: Integration Testing (3-4 hours)

### Tasks

#### Task 4.1.1: End-to-end hybrid workflow testing (2 hours)
**Owner**: QA Engineer / Developer
**Priority**: P0

**Test Scenarios**:

**Scenario 1: New User Onboarding**
```bash
# Install
npm install -g @defai.digital/automatosx@8.1.0

# Setup
mkdir ~/test-project && cd ~/test-project
ax setup

# Verify files created
tree .automatosx/ -L 2
cat CLAUDE.md
cat GEMINI.md

# Test code intelligence (v8.x)
ax find "function" --lang ts

# Test agent execution (v7.6.1 restored)
ax run backend "create a calculator class"
ax list agents
ax list abilities

# Success criteria:
# - Setup completes without errors
# - All files present
# - Both feature sets work
```

**Scenario 2: v7.6.1 Migration**
```bash
# Simulate v7.6.1 user with existing .automatosx/
# (Create test fixtures)

# Upgrade to v8.1.0
npm install -g @defai.digital/automatosx@8.1.0

# Test backward compatibility
ax run backend "task"  # Should still work
ax list agents         # Should show existing agents

# Test new features
ax find "code"         # New v8.x feature
ax speckit generate adr "topic"  # New v8.x feature

# Success criteria:
# - Existing agents work
# - Custom agents preserved
# - New features accessible
```

**Scenario 3: Hybrid Workflow**
```bash
# Use v8.x to find code
ax find "authentication" --lang ts

# Use v7.6.1 to refactor code
ax run backend "refactor the authentication code found above"

# Use v8.x to document changes
ax speckit generate adr "Use JWT for authentication"

# Create multi-agent session
ax session create "refactor-auth" backend security

# Run agents in session
ax run backend "implement changes" --session <id>
ax run security "review changes" --session <id>

# Success criteria:
# - Features work together seamlessly
# - Context preserved across commands
# - Session tracking works
```

**Scenario 4: Custom Agent Creation**
```bash
# Create custom agent
ax agent create my-backend --template developer

# Customize
vim .automatosx/agents/my-backend.yaml
# Edit: name, persona, abilities

# Run custom agent
ax run my-backend "hello world"

# Success criteria:
# - Agent created from template
# - Customizations applied
# - Custom agent executes
```

**Verification**:
- [ ] All scenarios pass
- [ ] No errors or warnings
- [ ] Performance acceptable
- [ ] User experience smooth

---

#### Task 4.1.2: Regression testing (v8.x features) (1 hour)
**Owner**: QA Engineer
**Priority**: P0

**Test v8.x Commands**:

```bash
# Code search
ax find "getUserById"
ax find "authentication" --lang ts

# Definitions
ax def getUserById

# Code analysis
ax analyze ./src

# SpecKit
ax speckit generate adr "Use PostgreSQL"
ax speckit generate prd "User authentication"

# LSP server (if applicable)
# Test editor integration

# Web UI (if applicable)
# Open localhost:3000 and verify

# Workflow
ax workflow list
ax workflow run test-workflow

# Memory
ax memory search "topic"

# Telemetry
ax telemetry stats

# Provider
ax provider list
```

**Verification**:
- [ ] All v8.x commands work unchanged
- [ ] No regressions introduced
- [ ] Performance maintained

---

#### Task 4.1.3: Cross-platform testing (1 hour)
**Owner**: QA Engineer
**Priority**: P1

**Platforms**:
- macOS (primary development platform)
- Linux (Ubuntu 24.04)
- Windows 11

**Test Each Platform**:
```bash
# Setup
ax setup

# Basic execution
ax run backend "task"
ax list agents

# File paths
# Verify paths work on Windows (backslashes)

# Integration
# Test Claude Code integration
# Test Gemini CLI integration
```

**Verification**:
- [ ] Setup works on all platforms
- [ ] Execution works on all platforms
- [ ] File paths correct
- [ ] Integrations work

---

## Phase 4.2: Documentation (2-3 hours)

### Tasks

#### Task 4.2.1: Complete user guides (1.5 hours)
**Owner**: Technical Writer / Developer
**Priority**: P0

**Documents to Complete**:

1. **Migration Guide** (`docs/migration/v7.6.1-to-v8.1.0.md`)
```markdown
# Migration Guide: v7.6.1 → v8.1.0

## Overview

AutomatosX v8.1.0 combines:
- **v8.x code intelligence**: Tree-sitter, LSP, Web UI, SpecKit
- **v7.6.1 agent orchestration**: YAML agents, setup, run

## Migration Steps

### For v7.6.1 Users

1. **Backup your customizations**
\`\`\`bash
cp -r .automatosx/ .automatosx.backup/
\`\`\`

2. **Upgrade**
\`\`\`bash
npm install -g @defai.digital/automatosx@8.1.0
\`\`\`

3. **Verify**
\`\`\`bash
ax --version  # Should show 8.1.0
ax list agents  # Should show your agents
ax run backend "test"  # Should work as before
\`\`\`

4. **Use new features**
\`\`\`bash
ax find "code"  # New code search
ax speckit generate adr "topic"  # New spec generation
\`\`\`

### For v8.x Users

1. **Add agent features**
\`\`\`bash
ax setup  # Adds agent system
\`\`\`

2. **Use agents**
\`\`\`bash
ax list agents
ax run backend "task"
\`\`\`

## Breaking Changes

**None** - v8.1.0 is fully backward compatible with both v7.6.1 and v8.x.

## New Features

### For v7.6.1 Users
- Code search with Tree-sitter
- LSP server for editor integration
- Web UI dashboard
- SpecKit auto-generation

### For v8.x Users
- YAML-based agent profiles
- `ax setup` for project initialization
- `ax run` for agent execution
- 60+ expertise abilities
- Multi-agent teams

## Troubleshooting

[Common issues and solutions]
```

2. **Feature Comparison** (`docs/features/hybrid-architecture.md`)
3. **API Reference** (`docs/api/agent-profiles.md`)
4. **Examples** (`docs/examples/hybrid-workflows.md`)

**Verification**:
- [ ] All guides complete
- [ ] Examples validated
- [ ] Links working

---

#### Task 4.2.2: Update README and CHANGELOG (1 hour)
**Owner**: Developer
**Priority**: P0

**README.md Updates**:
- Update version to 8.1.0
- Add hybrid architecture overview
- Update feature list
- Add examples for both v7.6.1 and v8.x features
- Update installation instructions

**CHANGELOG.md**:
```markdown
# Changelog

## [8.1.0] - 2025-XX-XX

### Added - Hybrid Architecture
- **Restored v7.6.1 agent orchestration features**:
  - `ax setup` command for project initialization
  - YAML-based agent profiles (21 example agents)
  - `ax run <agent> <task>` execution interface
  - 60+ expertise ability markdown files
  - Multi-agent team system (5 teams)
  - Multi-agent session management
  - Agent delegation with depth limits
  - Agent templates for custom agent creation
  - `ax list` command for agents/teams/abilities
  - `ax session` command for multi-agent workflows
  - `ax runs` and `ax resume` for execution history
  - Integration guides (CLAUDE.md, GEMINI.md, AGENTS.md)
  - Claude Code MCP integration
  - Gemini CLI integration

### Improved
- Documentation expanded with hybrid workflow examples
- Test coverage increased to 85%+
- Error messages more helpful

### Maintained - v8.x Code Intelligence
- All v8.x features remain unchanged:
  - Tree-sitter parsing (45 languages)
  - SQLite FTS5 search
  - LSP server
  - Web UI dashboard
  - SpecKit auto-generation
  - Natural language interface

### Migration
- **Backward compatible** with both v7.6.1 and v8.x
- No breaking changes
- See [Migration Guide](docs/migration/v7.6.1-to-v8.1.0.md)

## [8.0.x] - Previous Releases
[Existing v8.x changelog entries]

## [7.6.1] - 2024-XX-XX
[Existing v7.6.1 changelog]
```

**Verification**:
- [ ] README reflects hybrid architecture
- [ ] CHANGELOG complete
- [ ] Version numbers correct

---

## Phase 4.3: Release Preparation (1 hour)

### Tasks

#### Task 4.3.1: Pre-release checklist (30 min)
**Owner**: Release Manager
**Priority**: P0

**Checklist**:

- [ ] All Phase 1-3 deliverables complete
- [ ] All tests passing (745+ tests)
- [ ] Coverage ≥85%
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors
- [ ] Documentation complete
- [ ] CHANGELOG updated
- [ ] README updated
- [ ] Migration guide ready
- [ ] Integration tests passed
- [ ] Regression tests passed
- [ ] Cross-platform testing complete
- [ ] Version bumped to 8.1.0 in package.json
- [ ] Git tags created

---

#### Task 4.3.2: Build and publish (30 min)
**Owner**: Release Manager
**Priority**: P0

**Steps**:

```bash
# 1. Final build
pnpm run build

# Verify build succeeds
pnpm run test

# 2. Update version
npm version 8.1.0 --no-git-tag-version

# 3. Commit changes
git add .
git commit -m "Release v8.1.0: Hybrid Architecture

- Restore v7.6.1 agent orchestration features
- Maintain v8.x code intelligence features
- Full backward compatibility
- See CHANGELOG.md for details"

# 4. Create tag
git tag -a v8.1.0 -m "v8.1.0 - Hybrid Architecture Release"

# 5. Push
git push origin main
git push origin v8.1.0

# 6. Publish to npm
npm publish --access public

# 7. Create GitHub release
gh release create v8.1.0 \
  --title "v8.1.0 - Hybrid Architecture" \
  --notes-file automatosx/tmp/release-notes-8.1.0.md
```

**Verification**:
- [ ] npm package published
- [ ] GitHub release created
- [ ] Version accessible: `npm install -g @defai.digital/automatosx@8.1.0`

---

## Phase 4.4: Post-Release (30 min)

### Tasks

#### Task 4.4.1: Announcement and communication (30 min)
**Owner**: Product Manager
**Priority**: P1

**Communications**:

1. **Release Notes** (GitHub)
```markdown
# AutomatosX v8.1.0 - Hybrid Architecture 🎉

We're excited to announce **AutomatosX v8.1.0**, combining the best of both worlds:

## 🚀 What's New

### Restored v7.6.1 Agent Orchestration
- `ax setup` - One-command project initialization
- `ax run <agent> <task>` - Execute AI agents
- 21 pre-configured agents (backend, frontend, security, etc.)
- 60+ expertise abilities (API design, security, quantum computing, etc.)
- YAML-based customization (no coding required)
- Multi-agent teams and sessions

### Maintained v8.x Code Intelligence
- Tree-sitter parsing for 45+ languages
- SQLite FTS5 full-text search
- LSP server for editor integration
- Web UI dashboard
- SpecKit auto-generation

## 📦 Installation

\`\`\`bash
npm install -g @defai.digital/automatosx@8.1.0
\`\`\`

## 🎯 Quick Start

\`\`\`bash
# Setup
ax setup

# Code intelligence (v8.x)
ax find "authentication"
ax speckit generate adr "Use PostgreSQL"

# Agent execution (v7.6.1 restored)
ax run backend "create REST API"
ax list agents
\`\`\`

## 📚 Documentation

- [Migration Guide](docs/migration/v7.6.1-to-v8.1.0.md)
- [Hybrid Architecture Guide](docs/features/hybrid-architecture.md)
- [Full Changelog](CHANGELOG.md)

## 🙏 Feedback

We'd love to hear your thoughts! Please:
- Report issues: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- Join discussions: [GitHub Discussions](https://github.com/defai-digital/automatosx/discussions)

Happy coding! 🤖
```

2. **Social Media** (Twitter/X, LinkedIn)
3. **Discord/Slack** announcements (if applicable)
4. **Update website** (automatosx.com)

**Verification**:
- [ ] GitHub release notes published
- [ ] Social media posts made
- [ ] Documentation site updated

---

## Phase 4 Deliverables Checklist

### Documentation Deliverables
- [ ] Migration guide complete
- [ ] Feature comparison guide
- [ ] API reference
- [ ] Examples and tutorials
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Release notes written

### Release Deliverables
- [ ] v8.1.0 tagged in git
- [ ] npm package published
- [ ] GitHub release created
- [ ] Announcements made

### Quality Deliverables
- [ ] All tests passing
- [ ] Coverage ≥85%
- [ ] Integration tests passed
- [ ] Regression tests passed
- [ ] Cross-platform validation

### Acceptance Criteria
- [ ] v8.1.0 released and available
- [ ] Documentation complete
- [ ] Migration guide tested
- [ ] User feedback channels open
- [ ] Support ready

---

## Overall Project Summary

### Timeline Recap

| Phase | Week | Focus | Status |
|-------|------|-------|--------|
| Phase 1 | Week 1 | Project Setup | ✅ Planned |
| Phase 2 | Week 2 | Agent Execution | ✅ Planned |
| Phase 3 | Week 3 | Advanced Features | ✅ Planned |
| Phase 4 | Week 4 | Integration & Release | ✅ Planned |

### Total Effort

| Component | Effort Range |
|-----------|--------------|
| Phase 1 | 4.5-6h |
| Phase 2 | 16-23h |
| Phase 3 | 8-11h |
| Phase 4 | 6-8h |
| **Total** | **35-48h** |

### Success Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Feature Restoration | 95% | Track against PRD FR list |
| Test Coverage | ≥85% | Automated coverage reports |
| Setup Success Rate | 99% | Telemetry (if enabled) |
| Agent Execution Success | 98% | Telemetry (if enabled) |
| Zero Breaking Changes | 100% | Regression test suite |

---

## Risk Mitigation Summary

### High Risks Addressed

1. **Breaking v8.x Features**
   - **Mitigation**: Full regression test suite run before each phase completion
   - **Monitoring**: Automated tests in CI/CD

2. **Performance Degradation**
   - **Mitigation**: Performance benchmarks before/after
   - **Monitoring**: Track startup latency, memory usage

3. **YAML Schema Incompatibility**
   - **Mitigation**: Validate against v7.6.1 examples
   - **Monitoring**: Schema validation tests

---

## Appendix: Quick Reference

### Phase 1 Commands
```bash
ax setup                    # Initialize project
ax setup --force            # Re-run setup
ax setup --spec-kit         # With spec-kit
```

### Phase 2 Commands
```bash
ax run <agent> <task>       # Execute agent
ax run backend "task"       # Example
ax run backend "task" --provider gemini
ax run backend "task" --format json
ax run backend "task" --save result.md
```

### Phase 3 Commands
```bash
ax session create <name> <agents...>
ax session list
ax session show <id>
ax list agents
ax list teams
ax list abilities
ax agent create <name> --template <type>
ax runs list
ax resume <id>
```

### Phase 4 Commands
```bash
ax --version                # Check version
ax find "code"              # v8.x code search
ax speckit generate adr     # v8.x spec gen
```

---

**Document Status**: ✅ Ready for Implementation
**Approval Required**: Engineering Lead, Product Manager
**Implementation Start**: Upon approval
