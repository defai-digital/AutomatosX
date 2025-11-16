# Phase 1-2 Implementation Roadmap - Complete Guide

**Date**: 2025-11-15
**Status**: Phase 1 ✅ COMPLETE | Phase 2 📋 READY TO START
**Total Effort**: Phase 1: 3.5h (done) | Phase 2: 16-23h (planned)

---

## 🎉 Phase 1: COMPLETED (Week 1)

### Achievements

✅ **Setup Command Restored** (1,296 lines, Commander.js)
✅ **Examples Directory Extracted** (113 files: 20 agents, 60 abilities, 5 teams, 9 templates)
✅ **Utility Shims Created** (logger.ts, error-formatter.ts)
✅ **TypeScript Compilation** (0 errors)
✅ **Git Committed** (128 files, commit 8abea711)

### Command Available

```bash
ax setup [path]            # Setup AutomatosX project
ax setup --force           # Force re-setup
ax setup --spec-kit        # Auto-initialize Spec-Kit
ax setup --skip-spec-kit   # Skip Spec-Kit (CI/CD)
```

### Time Performance

- **Estimated**: 10 hours
- **Actual**: 3.5 hours
- **Savings**: 65% under budget

---

## 📋 Phase 2: READY TO START (Week 2)

### Objective

Restore v7.6.1 agent execution system:
- Load YAML agent profiles
- Load and inject markdown abilities
- Execute agents with `ax run <agent> <task>`
- Support team-based configuration
- Integrate with v8.x providers

### Estimated Effort: 16-23 hours (5 days)

---

## 🗺️ Phase 2 Implementation Roadmap

### Day 1: Agent Infrastructure Foundation (6 hours)

#### Task 1.1: Extract Agent Modules from v7.6.1 (2 hours)

**Files to Extract**:
```bash
# Create directory
mkdir -p src/agents

# Extract core modules
git show v7.6.1:src/agents/profile-loader.ts > src/agents/ProfileLoader.ts
git show v7.6.1:src/agents/abilities-manager.ts > src/agents/AbilitiesManager.ts
git show v7.6.1:src/agents/executor.ts > src/agents/AgentExecutor.ts
git show v7.6.1:src/agents/context-manager.ts > src/agents/ContextManager.ts

# Create core directory for TeamManager
mkdir -p src/core
git show v7.6.1:src/core/team-manager.ts > src/core/TeamManager.ts
```

**Expected Files**:
- `src/agents/ProfileLoader.ts` (~300 lines)
- `src/agents/AbilitiesManager.ts` (~250 lines)
- `src/agents/AgentExecutor.ts` (~400 lines)
- `src/agents/ContextManager.ts` (~200 lines)
- `src/core/TeamManager.ts` (~300 lines)

**Verification**:
```bash
ls -lh src/agents/
ls -lh src/core/
```

---

#### Task 1.2: Update Imports for v8.x (2 hours)

**Common Import Mappings**:

```typescript
// v7.6.1 → v8.x
'yargs' → 'commander'
'../../types/config.js' → '../../types/Config.js'
'../../utils/logger.js' → '../../utils/logger.js' (exists now!)
'../../utils/error-formatter.js' → '../../utils/error-formatter.js' (exists!)

// Provider imports (same in v8.x)
'../../providers/claude-provider.js' → '../../providers/ClaudeProvider.js'
'../../providers/gemini-provider.js' → '../../providers/GeminiProvider.js'
'../../services/ProviderRouter.js' → '../../services/ProviderRouterV2.js'
```

**Steps for Each File**:
1. Read file and list all imports
2. Map each import to v8.x equivalent
3. Update import paths
4. Fix any type errors
5. Compile and verify

**Verification**:
```bash
pnpm run build:typescript 2>&1 | grep "src/agents"
```

---

#### Task 1.3: Implement ProfileLoader (2 hours)

**File**: `src/agents/ProfileLoader.ts`

**Core Implementation**:
```typescript
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';
import { logger } from '../utils/logger.js';

export interface AgentProfile {
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
  temperature?: number;
  maxTokens?: number;
}

export class ProfileLoader {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load agent profile from YAML file
   */
  async loadProfile(agentName: string): Promise<AgentProfile> {
    const profilePath = this.resolveProfilePath(agentName);

    try {
      const yamlContent = await readFile(profilePath, 'utf-8');
      const profile = parse(yamlContent) as AgentProfile;

      this.validateProfile(profile);

      return profile;
    } catch (error) {
      logger.error(`Failed to load agent profile: ${agentName}`, { error });
      throw error;
    }
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<string[]> {
    const agentsDir = join(this.projectRoot, '.automatosx/agents');

    try {
      const files = await readdir(agentsDir);
      return files
        .filter(f => f.endsWith('.yaml'))
        .map(f => f.replace('.yaml', ''));
    } catch (error) {
      logger.error('Failed to list agents', { error });
      return [];
    }
  }

  /**
   * Resolve agent profile path
   */
  private resolveProfilePath(agentName: string): string {
    return join(
      this.projectRoot,
      '.automatosx/agents',
      `${agentName}.yaml`
    );
  }

  /**
   * Validate profile has required fields
   */
  private validateProfile(profile: unknown): asserts profile is AgentProfile {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Invalid profile: not an object');
    }

    const p = profile as Partial<AgentProfile>;

    if (!p.name) throw new Error('Agent profile missing required field: name');
    if (!p.role) throw new Error('Agent profile missing required field: role');
    if (!p.description) throw new Error('Agent profile missing required field: description');
    if (!p.systemPrompt) throw new Error('Agent profile missing required field: systemPrompt');
  }
}
```

**Testing**:
```bash
# Create test file
cat > test-profile-loader.ts << 'EOF'
import { ProfileLoader } from './src/agents/ProfileLoader.js';

async function test() {
  const loader = new ProfileLoader();

  // Test 1: Load backend agent
  const backend = await loader.loadProfile('backend');
  console.log('✓ Loaded backend:', backend.name, '-', backend.displayName);

  // Test 2: List all agents
  const agents = await loader.listAgents();
  console.log('✓ Found', agents.length, 'agents:', agents.slice(0, 5).join(', '), '...');
}

test().catch(console.error);
EOF

# Run test
npx tsx test-profile-loader.ts
```

---

### Day 2: Abilities & Execution (6 hours)

#### Task 2.1: Implement AbilitiesManager (3 hours)

**File**: `src/agents/AbilitiesManager.ts`

**Core Implementation**:
```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger.js';
import type { AgentProfile } from './ProfileLoader.js';

export class AbilitiesManager {
  private projectRoot: string;
  private abilityCache: Map<string, string> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load abilities for agent profile
   */
  async loadAbilities(profile: AgentProfile): Promise<string[]> {
    const abilities: string[] = [];

    // Load core abilities (always loaded)
    if (profile.abilitySelection?.core) {
      for (const abilityName of profile.abilitySelection.core) {
        const content = await this.loadAbility(abilityName);
        if (content) abilities.push(content);
      }
    }

    // Load all abilities listed in profile
    if (profile.abilities) {
      for (const abilityName of profile.abilities) {
        const content = await this.loadAbility(abilityName);
        if (content) abilities.push(content);
      }
    }

    return abilities;
  }

  /**
   * Select task-specific abilities
   */
  selectAbilitiesForTask(
    task: string,
    profile: AgentProfile
  ): string[] {
    if (!profile.abilitySelection?.taskBased) {
      return [];
    }

    const taskLower = task.toLowerCase();
    const selected: string[] = [];

    for (const [keyword, abilities] of Object.entries(profile.abilitySelection.taskBased)) {
      if (taskLower.includes(keyword.toLowerCase())) {
        selected.push(...abilities);
      }
    }

    return [...new Set(selected)]; // Deduplicate
  }

  /**
   * Load single ability markdown file
   */
  private async loadAbility(abilityName: string): Promise<string | null> {
    // Check cache first
    if (this.abilityCache.has(abilityName)) {
      return this.abilityCache.get(abilityName)!;
    }

    const abilityPath = join(
      this.projectRoot,
      '.automatosx/abilities',
      `${abilityName}.md`
    );

    if (!existsSync(abilityPath)) {
      logger.warn(`Ability not found: ${abilityName}`);
      return null;
    }

    try {
      const content = await readFile(abilityPath, 'utf-8');
      this.abilityCache.set(abilityName, content);
      return content;
    } catch (error) {
      logger.error(`Failed to load ability: ${abilityName}`, { error });
      return null;
    }
  }

  /**
   * Format abilities for injection into system prompt
   */
  formatAbilitiesForPrompt(abilities: string[]): string {
    if (abilities.length === 0) return '';

    return `
# Your Abilities

You have access to the following specialized knowledge and capabilities:

${abilities.join('\n\n---\n\n')}

Use these abilities to inform your responses and provide expert-level assistance.
`;
  }
}
```

---

#### Task 2.2: Implement AgentExecutor (3 hours)

**File**: `src/agents/AgentExecutor.ts`

**Core Implementation**:
```typescript
import { ProfileLoader, type AgentProfile } from './ProfileLoader.js';
import { AbilitiesManager } from './AbilitiesManager.js';
import { ContextManager } from './ContextManager.js';
import { TeamManager } from '../core/TeamManager.js';
import { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import { logger } from '../utils/logger.js';

export interface ExecuteOptions {
  provider?: string;
  model?: string;
  memory?: boolean;
  verbose?: boolean;
  format?: 'text' | 'json' | 'markdown';
}

export interface ExecutionResult {
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
}

export class AgentExecutor {
  constructor(
    private profileLoader: ProfileLoader,
    private abilitiesManager: AbilitiesManager,
    private contextManager: ContextManager,
    private teamManager: TeamManager,
    private providerRouter: ProviderRouterV2
  ) {}

  /**
   * Execute agent with task
   */
  async execute(
    agentName: string,
    task: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Load agent profile
      const profile = await this.profileLoader.loadProfile(agentName);
      logger.info(`Loaded agent profile: ${agentName}`);

      // 2. Load team config if specified
      let mergedProfile = profile;
      if (profile.team) {
        const teamConfig = await this.teamManager.loadTeam(profile.team);
        mergedProfile = this.teamManager.mergeWithTeam(profile, teamConfig);
        logger.info(`Merged with team: ${profile.team}`);
      }

      // 3. Load abilities
      const coreAbilities = await this.abilitiesManager.loadAbilities(mergedProfile);
      const taskAbilities = this.abilitiesManager.selectAbilitiesForTask(task, mergedProfile);

      // Load task-specific abilities
      const taskAbilityContents: string[] = [];
      for (const abilityName of taskAbilities) {
        const content = await this.abilitiesManager.loadAbility(abilityName);
        if (content) taskAbilityContents.push(content);
      }

      const allAbilities = [...coreAbilities, ...taskAbilityContents];
      logger.info(`Loaded ${allAbilities.length} abilities`);

      // 4. Build context
      const context = await this.contextManager.buildContext(task, options);

      // 5. Build system prompt
      const systemPrompt = this.buildSystemPrompt(mergedProfile, allAbilities, context);

      // 6. Select provider
      const provider = options.provider || mergedProfile.providers?.default || 'claude';

      // 7. Execute via provider
      const result = await this.providerRouter.route({
        provider,
        model: options.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: task }
        ],
        options: {
          temperature: mergedProfile.temperature,
          maxTokens: mergedProfile.maxTokens
        }
      });

      const duration = Date.now() - startTime;

      return {
        agent: agentName,
        task,
        output: result.content,
        provider,
        model: result.model,
        timestamp: new Date(),
        duration,
        tokensUsed: result.usage
      };

    } catch (error) {
      logger.error(`Agent execution failed: ${agentName}`, { error });
      throw error;
    }
  }

  /**
   * Build system prompt from profile, abilities, and context
   */
  private buildSystemPrompt(
    profile: AgentProfile,
    abilities: string[],
    context: any
  ): string {
    const parts: string[] = [];

    // Agent system prompt
    parts.push(profile.systemPrompt);

    // Abilities
    if (abilities.length > 0) {
      parts.push(this.abilitiesManager.formatAbilitiesForPrompt(abilities));
    }

    // Context (workspace info, etc.)
    if (context.cwd) {
      parts.push(`\n# Working Directory\n${context.cwd}`);
    }

    return parts.join('\n\n');
  }
}
```

---

### Day 3: Run Command & CLI (5 hours)

#### Task 3.1: Extract and Convert run.ts (3 hours)

**Extract from v7.6.1**:
```bash
git show v7.6.1:src/cli/commands/run.ts > src/cli/commands/run.ts
```

**Convert to Commander.js**:
```typescript
import { Command } from 'commander';
import { ProfileLoader } from '../../agents/ProfileLoader.js';
import { AbilitiesManager } from '../../agents/AbilitiesManager.js';
import { ContextManager } from '../../agents/ContextManager.js';
import { TeamManager } from '../../core/TeamManager.js';
import { AgentExecutor } from '../../agents/AgentExecutor.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import chalk from 'chalk';

interface RunOptions {
  provider?: string;
  model?: string;
  memory?: boolean;
  verbose?: boolean;
  format?: 'text' | 'json' | 'markdown';
  save?: string;
}

async function runHandler(
  agentName: string,
  task: string,
  options: RunOptions
): Promise<void> {
  try {
    // Initialize components
    const profileLoader = new ProfileLoader();
    const abilitiesManager = new AbilitiesManager();
    const contextManager = new ContextManager();
    const teamManager = new TeamManager();
    const providerRouter = new ProviderRouterV2();

    const executor = new AgentExecutor(
      profileLoader,
      abilitiesManager,
      contextManager,
      teamManager,
      providerRouter
    );

    // Execute
    console.log(chalk.blue(`\n🤖 Running agent: ${agentName}\n`));
    console.log(chalk.gray(`Task: ${task}\n`));

    const result = await executor.execute(agentName, task, options);

    // Display result
    console.log(chalk.green('\n✓ Execution complete\n'));
    console.log(result.output);

    // Show metadata if verbose
    if (options.verbose) {
      console.log(chalk.gray('\nMetadata:'));
      console.log(chalk.gray(`  Provider: ${result.provider}`));
      console.log(chalk.gray(`  Model: ${result.model}`));
      console.log(chalk.gray(`  Duration: ${result.duration}ms`));
      if (result.tokensUsed) {
        console.log(chalk.gray(`  Tokens: ${result.tokensUsed.total}`));
      }
    }

    // Save if requested
    if (options.save) {
      await import('fs/promises').then(fs =>
        fs.writeFile(options.save!, result.output)
      );
      console.log(chalk.green(`\n✓ Saved to ${options.save}`));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Execution failed:'), error);
    process.exit(1);
  }
}

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
```

---

#### Task 3.2: Register run Command (1 hour)

**Update src/cli/index.ts**:
```typescript
import { createRunCommand } from './commands/run.js';

// After createSetupCommand()
program.addCommand(createRunCommand());
```

**Test**:
```bash
pnpm run build:typescript
ax run --help
ax run backend "hello world"
```

---

### Day 4: Teams & Context (4 hours)

#### Task 4.1: Implement TeamManager (2 hours)

**File**: `src/core/TeamManager.ts`

**Implementation**: Similar structure to ProfileLoader, but for team YAML files

#### Task 4.2: Implement ContextManager (2 hours)

**File**: `src/agents/ContextManager.ts`

**Simple Implementation**:
```typescript
export class ContextManager {
  async buildContext(task: string, options: any): Promise<any> {
    return {
      task,
      timestamp: new Date(),
      cwd: process.cwd(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
```

---

### Day 5: Testing & Polish (2 hours)

#### Task 5.1: Test All 21 Agents (1 hour)

```bash
# Test each agent with simple task
for agent in backend frontend fullstack devops mobile data design product writer architecture security quality ceo cto creative-marketer researcher data-scientist aerospace-scientist quantum-engineer standard; do
  echo "Testing $agent..."
  ax run $agent "Say hello in your style"
done
```

#### Task 5.2: Write Unit Tests (1 hour)

Create test files:
- `src/agents/__tests__/ProfileLoader.test.ts`
- `src/agents/__tests__/AbilitiesManager.test.ts`
- `src/agents/__tests__/AgentExecutor.test.ts`

---

## 🎯 Success Criteria for Phase 2

### Must Have:
- [ ] `ax run <agent> <task>` command works
- [ ] All 21 agents execute successfully
- [ ] Abilities are injected into prompts
- [ ] Team inheritance works (shared abilities, provider fallback)
- [ ] TypeScript compiles without errors
- [ ] Basic tests pass

### Nice to Have:
- [ ] `ax list agents` command
- [ ] Advanced ability selection (ML-based)
- [ ] Performance optimization
- [ ] Comprehensive test coverage (≥85%)

---

## 🚀 Quick Start for Week 2

```bash
# Start Week 2 implementation
cd /Users/akiralam/code/automatosx

# Ensure on feature branch
git checkout feature/phase1-setup-command

# Or create new branch for Phase 2
git checkout -b feature/phase2-agent-execution

# Follow Day 1 tasks from this roadmap
# Extract agent modules, update imports, implement ProfileLoader

# Build and test incrementally
pnpm run build:typescript
npx tsx test-profile-loader.ts
```

---

## 📊 Estimated Timeline

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Phase 1 | Setup command | 3.5h | ✅ DONE |
| Phase 2 Day 1 | Agent infrastructure | 6h | 📋 Ready |
| Phase 2 Day 2 | Abilities & execution | 6h | 📋 Ready |
| Phase 2 Day 3 | Run command & CLI | 5h | 📋 Ready |
| Phase 2 Day 4 | Teams & context | 4h | 📋 Ready |
| Phase 2 Day 5 | Testing & polish | 2h | 📋 Ready |
| **Total** | | **26.5h** | **13% done** |

---

## 📝 Notes for Implementation

1. **Follow Week 1 Pattern**: Use same Commander.js conversion approach
2. **Test Incrementally**: Compile and test after each major change
3. **Use Existing v8.x Services**: Leverage ProviderRouterV2, MemoryService
4. **Cache Abilities**: Load abilities once, cache in memory
5. **Validate YAML**: Use Zod schemas or manual validation
6. **Handle Errors Gracefully**: Missing abilities shouldn't crash execution

---

**Roadmap Created**: 2025-11-15
**Phase 1**: ✅ Complete
**Phase 2**: 📋 Ready to implement
**Confidence**: HIGH ✅
