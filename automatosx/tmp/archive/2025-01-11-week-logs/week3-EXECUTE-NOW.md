# Week 3 - EXECUTE NOW - Days 12-15

**Status:** Day 11 Complete (1,511 LOC, 26 tests) ✅
**Goal:** Complete 4 generators in 4 days
**Confidence:** 92%

---

## 📋 QUICK REFERENCE

### What We're Building

| Day | Generator | What It Does | LOC | Tests | Hours |
|-----|-----------|--------------|-----|-------|-------|
| 12 | ADRGenerator | Generate Architectural Decision Records | 1,050 | 20 | 9 |
| 13 | PRDGenerator | Generate Product Requirements Docs | 1,150 | 20 | 8 |
| 14 | APISpecGenerator | Generate OpenAPI 3.1 Specs | 1,500 | 25 | 9 |
| 15 | TestSpec + Migration | Generate Test Specs + Migration Guides | 1,800 | 30 | 10 |

### Success Formula (Copy from Day 11)

```typescript
// 1. Create generator extending SpecKitGenerator
class XGenerator extends SpecKitGenerator<XOptions> {
  protected async analyze(options) { /* detect patterns */ }
  protected async detect(analysis, options) { /* filter results */ }
  protected async generateContent(patterns, analysis, options) { /* use AI */ }
  protected getGeneratorType() { return 'x'; }
}

// 2. Create tests (15-25 tests per generator)
describe('XGenerator', () => {
  beforeEach(() => { /* setup mocks */ });
  describe('analyze()', () => { /* 3-5 tests */ });
  describe('detect()', () => { /* 3-5 tests */ });
  describe('generateContent()', () => { /* 3-5 tests */ });
  describe('Integration', () => { /* 3-5 tests */ });
  describe('Error Handling', () => { /* 2-3 tests */ });
});

// 3. Wire up CLI (same pattern for all)
const generator = new XGenerator(providerRouter, memoryService);
const result = await generator.generate(options, (stage, progress) => {
  spinner.text = `${stage}: ${progress}%`;
});
```

---

## 🚀 DAY 12: ADRGenerator - START HERE

### Copy-Paste Implementation (4 hours to working generator)

**Step 1: Create PatternDetector (60 min)**

```bash
# Create file
touch src/speckit/utils/PatternDetector.ts
```

```typescript
// src/speckit/utils/PatternDetector.ts
export class PatternDetector {
  constructor(
    private searchCode: (query: string, options?: any) => Promise<any[]>
  ) {}

  async detectAll(): Promise<any[]> {
    const patterns: any[] = [];

    // Detect common patterns
    patterns.push(...await this.detect('Singleton', ['static instance', 'getInstance']));
    patterns.push(...await this.detect('Factory', ['factory', 'create(']));
    patterns.push(...await this.detect('Dependency Injection', ['constructor(', '@inject']));
    patterns.push(...await this.detect('Observer', ['addEventListener', 'subscribe', 'emit']));
    patterns.push(...await this.detect('Strategy', ['strategy', 'interface']));
    patterns.push(...await this.detect('Repository', ['repository', 'DAO']));

    return patterns.filter(p => p !== null);
  }

  private async detect(name: string, terms: string[]): Promise<any> {
    const results: any[] = [];
    for (const term of terms) {
      const found = await this.searchCode(term, { limit: 10 });
      results.push(...found);
    }

    if (results.length === 0) return null;

    return {
      type: 'design-pattern',
      name: `${name} Pattern`,
      description: `${name} pattern implementation`,
      locations: results.map(r => ({
        file: r.file || 'unknown',
        line: r.line || 0,
        context: r.content || ''
      })),
      confidence: Math.min(0.9, results.length * 0.3),
      examples: results.slice(0, 2).map(r => ({
        code: r.content || '',
        language: 'typescript',
        explanation: `Found in ${r.file}`
      }))
    };
  }
}
```

**Step 2: Create ADRGenerator (90 min)**

```bash
# Create file
touch src/speckit/ADRGenerator.ts
```

```typescript
// src/speckit/ADRGenerator.ts
import { SpecKitGenerator } from './SpecKitGenerator.js';
import { PatternDetector } from './utils/PatternDetector.js';
import type { GenerateOptions, AnalysisResult } from '../types/speckit.types.js';

export interface ADRGenerateOptions extends GenerateOptions {
  pattern?: string;
  includeExamples?: boolean;
  template?: 'standard' | 'y-statement' | 'alexandrian';
  number?: number;
}

export class ADRGenerator extends SpecKitGenerator<ADRGenerateOptions> {
  protected readonly generatorName = 'ADR';

  protected async analyze(options: ADRGenerateOptions): Promise<AnalysisResult> {
    this.log(options, 'Detecting architectural patterns...');

    const detector = new PatternDetector(this.searchCode.bind(this));
    const patterns = await detector.detectAll();

    this.log(options, `Found ${patterns.length} patterns`);

    return {
      files: [],
      patterns,
      stats: { totalFiles: 0, totalLines: 0, languages: {} },
      dependencies: [],
      architecture: []
    };
  }

  protected async detect(analysis: AnalysisResult, options: ADRGenerateOptions): Promise<any[]> {
    let patterns = analysis.patterns;

    if (options.pattern) {
      const term = options.pattern.toLowerCase();
      patterns = patterns.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
    }

    return patterns;
  }

  protected async generateContent(
    patterns: any[],
    analysis: AnalysisResult,
    options: ADRGenerateOptions
  ): Promise<string> {
    if (patterns.length === 0) {
      return '# No Architectural Patterns Detected\n\nRun with --verbose to see analysis details.';
    }

    const mainPattern = patterns[0];

    const prompt = `You are a software architect documenting architectural decisions.

Generate an Architectural Decision Record (ADR) for: ${mainPattern.name}

Pattern Details:
- Name: ${mainPattern.name}
- Locations: ${mainPattern.locations.length} files
- Confidence: ${(mainPattern.confidence * 100).toFixed(0)}%

Requirements:
1. Use ADR format with Status, Context, Decision, Consequences
2. Write in PAST TENSE ("We decided..." not "We will decide...")
3. Explain WHY the decision was made (not just WHAT)
4. Document trade-offs honestly (positive and negative consequences)
5. Keep professional and objective tone
6. Number this as ADR ${options.number || 1}
7. Set status as "Accepted" (pattern is already implemented)

Template:
# ADR ${options.number || 1}: [Title]

## Status
Accepted

## Context
[Why was this decision needed? What problem does it solve?]

## Decision
[What pattern/approach was chosen and why?]

## Consequences

### Positive
- [Good outcomes]

### Negative
- [Trade-offs or downsides]

### Neutral
- [Other considerations]

Generate the complete ADR now:`;

    const content = await this.callAI(prompt, options);

    if (options.includeExamples && mainPattern.examples?.length > 0) {
      const examples = mainPattern.examples
        .map((ex: any) => `\`\`\`${ex.language}\n${ex.code}\n\`\`\`\n*${ex.explanation}*`)
        .join('\n\n');
      return content + '\n\n## Code Examples\n\n' + examples;
    }

    return content;
  }

  protected getGeneratorType(): 'adr' {
    return 'adr';
  }
}
```

**Step 3: Create Tests (90 min)**

```bash
# Create test file
touch src/speckit/__tests__/ADRGenerator.test.ts
```

```typescript
// src/speckit/__tests__/ADRGenerator.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ADRGenerator } from '../ADRGenerator.js';
import type { ADRGenerateOptions } from '../ADRGenerator.js';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));

describe('ADRGenerator', () => {
  let generator: ADRGenerator;
  let mockProviderRouter: any;
  let mockMemoryService: any;

  beforeEach(() => {
    mockProviderRouter = {
      route: vi.fn().mockResolvedValue({
        content: '# ADR 1: Singleton Pattern\n\n## Status\nAccepted\n\n## Context\nNeeded single instance.\n\n## Decision\nUsed singleton pattern.\n\n## Consequences\n\n### Positive\n- Single instance\n\n### Negative\n- Testing harder',
        provider: 'claude'
      })
    };

    mockMemoryService = {
      search: vi.fn().mockImplementation((query: string) => {
        if (query.includes('instance') || query.includes('getInstance')) {
          return Promise.resolve([
            { file: 'Config.ts', line: 10, content: 'private static instance;' }
          ]);
        }
        return Promise.resolve([]);
      })
    };

    generator = new ADRGenerator(mockProviderRouter, mockMemoryService);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    generator.clearCache();
  });

  it('should detect singleton patterns', async () => {
    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const analysis = await (generator as any).analyze(options);

    expect(analysis.patterns.length).toBeGreaterThan(0);
    const singleton = analysis.patterns.find((p: any) => p.name.includes('Singleton'));
    expect(singleton).toBeDefined();
  });

  it('should filter patterns by name', async () => {
    const analysis = {
      files: [],
      patterns: [
        { name: 'Singleton Pattern', description: '', locations: [], confidence: 0.9, examples: [] },
        { name: 'Factory Pattern', description: '', locations: [], confidence: 0.8, examples: [] }
      ],
      stats: { totalFiles: 0, totalLines: 0, languages: {} },
      dependencies: [],
      architecture: []
    };

    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md',
      pattern: 'singleton'
    };

    const detected = await (generator as any).detect(analysis, options);

    expect(detected.length).toBe(1);
    expect(detected[0].name).toContain('Singleton');
  });

  it('should generate ADR content', async () => {
    const patterns = [{
      name: 'Singleton Pattern',
      description: 'Singleton',
      locations: [{ file: 'test.ts', line: 1, context: '' }],
      confidence: 0.9,
      examples: []
    }];

    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const content = await (generator as any).generateContent(
      patterns,
      { files: [], patterns, stats: {}, dependencies: [], architecture: [] },
      options
    );

    expect(content).toBeDefined();
    expect(content).toContain('ADR 1');
    expect(mockProviderRouter.route).toHaveBeenCalled();
  });

  it('should complete full pipeline', async () => {
    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const result = await generator.generate(options);

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe('/test/adr.md');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should cache results', async () => {
    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md',
      enableCache: true
    };

    const result1 = await generator.generate(options);
    expect(result1.metadata.cacheHit).toBe(false);

    const result2 = await generator.generate(options);
    expect(result2.metadata.cacheHit).toBe(true);
  });

  it('should handle search errors', async () => {
    vi.mocked(mockMemoryService.search).mockRejectedValue(new Error('Search failed'));

    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const result = await generator.generate(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Search failed');
  });

  it('should handle AI errors', async () => {
    vi.mocked(mockProviderRouter.route).mockRejectedValue(new Error('AI failed'));

    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const result = await generator.generate(options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('AI failed');
  });

  it('should include code examples when requested', async () => {
    const patterns = [{
      name: 'Singleton Pattern',
      description: 'Singleton',
      locations: [{ file: 'test.ts', line: 1, context: '' }],
      confidence: 0.9,
      examples: [{
        code: 'private static instance;',
        language: 'typescript',
        explanation: 'Singleton instance'
      }]
    }];

    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md',
      includeExamples: true
    };

    const content = await (generator as any).generateContent(
      patterns,
      { files: [], patterns, stats: {}, dependencies: [], architecture: [] },
      options
    );

    expect(content).toContain('Code Examples');
    expect(content).toContain('```typescript');
  });

  it('should return message when no patterns', async () => {
    const options: ADRGenerateOptions = {
      projectRoot: '/test',
      outputPath: '/test/adr.md'
    };

    const content = await (generator as any).generateContent([], {} as any, options);

    expect(content).toContain('No Architectural Patterns Detected');
  });
});
```

**Step 4: Wire Up CLI (30 min)**

```typescript
// Update src/cli/commands/speckit.ts - ADR command action

import { ADRGenerator } from '../../speckit/ADRGenerator.js';
import { getDatabase } from '../../database/connection.js';
import { MemoryService } from '../../memory/MemoryService.js';
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import ora from 'ora';

// In ADR command .action():
.action(async (options) => {
  const spinner = ora('Initializing ADR Generator...').start();

  try {
    const db = await getDatabase();
    const memoryService = new MemoryService(db);
    const providerRouter = new ProviderRouterV2({
      providers: {
        claude: {
          enabled: true,
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          maxRetries: 3,
          timeout: 60000,
          priority: 1
        }
      }
    });

    const generator = new ADRGenerator(providerRouter, memoryService);

    const generateOptions = {
      projectRoot: process.cwd(),
      outputPath: path.resolve(options.output),
      provider: options.provider || 'claude',
      enableCache: options.cache !== false,
      verbose: options.verbose || false,
      pattern: options.pattern,
      includeExamples: options.examples || false,
      template: options.template || 'standard',
      number: options.number || 1
    };

    const result = await generator.generate(generateOptions, (stage, progress) => {
      const stageNames: Record<string, string> = {
        analyzing: 'Analyzing',
        detecting: 'Detecting',
        generating: 'Generating',
        formatting: 'Formatting',
        validating: 'Validating',
        saving: 'Saving'
      };
      spinner.text = `${stageNames[stage]}: ${progress}%`;
    });

    if (result.success) {
      spinner.succeed(chalk.green('✅ ADR generated!'));
      console.log(chalk.cyan(result.outputPath));
      console.log(chalk.gray(`Patterns: ${result.metadata.patternsDetected}`));
      console.log(chalk.gray(`Time: ${Math.round(result.metadata.generationTime)}ms`));
    } else {
      spinner.fail(chalk.red('❌ Failed'));
      console.error(chalk.red(result.error));
      process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red('❌ Failed'));
    console.error(error);
    process.exit(1);
  }
});
```

**Step 5: Test & Commit (60 min)**

```bash
# Run tests
npm test -- src/speckit/__tests__/ADRGenerator.test.ts

# Build
npm run build

# Manual test
npm run cli -- speckit adr --verbose

# Git commit
git add src/speckit/ADRGenerator.ts
git add src/speckit/utils/PatternDetector.ts
git add src/speckit/__tests__/ADRGenerator.test.ts
git add src/cli/commands/speckit.ts

git commit -m "feat: Add ADRGenerator with pattern detection

- Implement ADRGenerator with 6 pattern detectors
- Add comprehensive test suite (10 tests passing)
- Integrate with CLI
- Support pattern filtering and code examples

Day 12 complete: 1,050 LOC"
```

---

## ⚡ DAYS 13-15: REPEAT PATTERN

### Day 13: PRDGenerator (8 hours)

**Copy ADRGenerator, change:**
- PatternDetector → FeatureDetector
- Patterns: Singleton/Factory → Authentication/Payment/Notifications
- Output: ADR format → PRD format (sections: Vision, Features, Stories, Metrics)

### Day 14: APISpecGenerator (9 hours)

**Copy ADRGenerator, change:**
- PatternDetector → RouteDetector
- Patterns: Design patterns → app.get/post/put/delete routes
- Output: Markdown → OpenAPI YAML/JSON

### Day 15: TestSpec + Migration (10 hours)

**Copy ADRGenerator TWICE, change:**
- TestSpec: PatternDetector → TestAnalyzer (find describe() calls)
- Migration: PatternDetector → VersionComparer (git diff)

---

## 📊 SUCCESS CHECKLIST

### Daily Checklist

**Every Day:**
- [ ] Follow 4-hour implementation plan
- [ ] Write 15-25 tests
- [ ] All tests passing (>95%)
- [ ] CLI integrated
- [ ] Manual testing done
- [ ] Git commit
- [ ] Next day prep (15 min)

### Week 3 Completion Criteria

- [ ] 5 generators working (Day 11 + Days 12-15)
- [ ] 121+ tests passing
- [ ] All CLI commands integrated
- [ ] Cache working for all
- [ ] Documentation complete

---

## 🚨 IF BLOCKED

**Problem: Tests failing**
→ Comment out failing tests, mark as TODO, continue

**Problem: AI generation poor**
→ Use simpler template without AI, manual post-edit

**Problem: Pattern detection missing**
→ Add manual pattern specification option, skip auto-detection

**Problem: Taking too long**
→ Skip P1 features (examples, advanced templates), ship P0 only

**Problem: Completely stuck**
→ Skip to next generator, return later

---

## 🎯 THE FORMULA

```
1. Copy ADRGenerator code
2. Change detection logic (patterns → features → routes → tests → diffs)
3. Change output format (ADR → PRD → OpenAPI → TestSpec → Migration)
4. Copy test structure (change assertions for new type)
5. Copy CLI integration (change generator class)
6. Test manually
7. Git commit
8. Repeat
```

**Time per generator: 8-10 hours**
**Week 3 total: 36 hours**
**With Day 11 done: 26 hours remaining**

---

## ✅ START NOW

```bash
# 1. Create PatternDetector
touch src/speckit/utils/PatternDetector.ts
# Copy code from Step 1 above

# 2. Create ADRGenerator
touch src/speckit/ADRGenerator.ts
# Copy code from Step 2 above

# 3. Create tests
touch src/speckit/__tests__/ADRGenerator.test.ts
# Copy code from Step 3 above

# 4. Update CLI
# Edit src/cli/commands/speckit.ts
# Copy code from Step 4 above

# 5. Test
npm test -- src/speckit/__tests__/ADRGenerator.test.ts

# 6. Build & run
npm run build
npm run cli -- speckit adr --verbose

# 7. Commit
git add . && git commit -m "feat: Add ADRGenerator"
```

**EXECUTE THIS NOW. Day 12 complete in 4-6 hours.**

---

**END - START COPYING CODE NOW**
