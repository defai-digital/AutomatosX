/**
 * LLM Refactor Prompt Builder Tests
 *
 * @module tests/unit/core/refactor/llm-refactor/prompt-builder
 * @since v12.10.0
 */

import { describe, it, expect } from 'vitest';
import {
  buildRefactorPrompt,
  buildSingleFindingPrompt,
  estimateTokens,
} from '../../../../../src/core/refactor/llm-refactor/prompt-builder.js';
import type { RefactorFinding } from '../../../../../src/core/refactor/types.js';
import type { RefactorBatch } from '../../../../../src/core/refactor/llm-refactor/types.js';

// Helper to create mock findings
function createMockFinding(overrides: Partial<RefactorFinding> = {}): RefactorFinding {
  return {
    id: 'test-finding-1',
    file: 'src/example.ts',
    lineStart: 10,
    lineEnd: 15,
    type: 'hardcoded_values',
    severity: 'medium',
    message: 'Magic number detected',
    context: 'const timeout = 3000;',
    confidence: 0.9,
    detectionMethod: 'static',
    ruleId: 'hardcode-magic-number',
    detectedAt: new Date().toISOString(),
    estimatedImpact: {},
    ...overrides,
  };
}

// Helper to create mock batch
function createMockBatch(findings: RefactorFinding[], fileContent: string = ''): RefactorBatch {
  return {
    batchId: 'batch-1',
    file: 'src/example.ts',
    fileContent: fileContent || `// File content\n${findings.map(f => f.context).join('\n')}`,
    findings,
  };
}

describe('buildRefactorPrompt', () => {
  describe('basic functionality', () => {
    it('should build prompt with system and user parts', () => {
      const finding = createMockFinding();
      const batch = createMockBatch([finding]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.system).toBeDefined();
      expect(prompt.user).toBeDefined();
      expect(prompt.system.length).toBeGreaterThan(0);
      expect(prompt.user.length).toBeGreaterThan(0);
    });

    it('should include file path in user prompt', () => {
      const finding = createMockFinding({ file: 'src/utils/helpers.ts' });
      const batch = createMockBatch([finding]);
      batch.file = 'src/utils/helpers.ts';

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('src/utils/helpers.ts');
    });

    it('should include file content in user prompt', () => {
      const fileContent = 'const x = 1;\nconst y = 2;\nreturn x + y;';
      const batch = createMockBatch([createMockFinding()], fileContent);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain(fileContent);
    });

    it('should include finding details in user prompt', () => {
      const finding = createMockFinding({
        id: 'unique-finding-id',
        message: 'Test message for finding',
        lineStart: 42,
        lineEnd: 45,
      });
      const batch = createMockBatch([finding]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('unique-finding-id');
      expect(prompt.user).toContain('Test message for finding');
      expect(prompt.user).toContain('42');
      expect(prompt.user).toContain('45');
    });

    it('should include code context in user prompt', () => {
      const finding = createMockFinding({
        context: 'const MAGIC = 42;',
      });
      const batch = createMockBatch([finding]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('const MAGIC = 42;');
    });
  });

  describe('multiple findings', () => {
    it('should include all findings in prompt', () => {
      const findings = [
        createMockFinding({ id: 'finding-1', message: 'First issue' }),
        createMockFinding({ id: 'finding-2', message: 'Second issue' }),
        createMockFinding({ id: 'finding-3', message: 'Third issue' }),
      ];
      const batch = createMockBatch(findings);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('finding-1');
      expect(prompt.user).toContain('finding-2');
      expect(prompt.user).toContain('finding-3');
      expect(prompt.user).toContain('First issue');
      expect(prompt.user).toContain('Second issue');
      expect(prompt.user).toContain('Third issue');
    });

    it('should number findings correctly', () => {
      const findings = [
        createMockFinding({ id: 'f1' }),
        createMockFinding({ id: 'f2' }),
      ];
      const batch = createMockBatch(findings);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('Finding 1');
      expect(prompt.user).toContain('Finding 2');
    });
  });

  describe('finding types', () => {
    const findingTypes = [
      'dead_code',
      'type_safety',
      'conditionals',
      'hardcoded_values',
      'naming',
      'duplication',
      'readability',
      'performance',
    ] as const;

    findingTypes.forEach((type) => {
      it(`should include description for ${type} type`, () => {
        const finding = createMockFinding({ type });
        const batch = createMockBatch([finding]);

        const prompt = buildRefactorPrompt(batch);

        expect(prompt.user).toContain(type);
        // Should have some description after the type
        expect(prompt.user.length).toBeGreaterThan(type.length);
      });
    });
  });

  describe('suggested fix', () => {
    it('should include suggested fix when provided', () => {
      const finding = createMockFinding({
        suggestedFix: 'Extract to named constant',
      });
      const batch = createMockBatch([finding]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).toContain('Extract to named constant');
    });

    it('should not include suggested fix section when not provided', () => {
      const finding = createMockFinding({
        suggestedFix: undefined,
      });
      const batch = createMockBatch([finding]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.user).not.toContain('Suggested Approach');
    });
  });

  describe('system prompt content', () => {
    it('should include refactoring guidelines', () => {
      const batch = createMockBatch([createMockFinding()]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.system).toContain('Preserve Semantics');
      expect(prompt.system).toContain('Minimal Changes');
      expect(prompt.system).toContain('Conservative');
    });

    it('should include safety rules', () => {
      const batch = createMockBatch([createMockFinding()]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.system).toContain('MANUAL REVIEW');
      expect(prompt.system).toContain('exported');
      expect(prompt.system).toContain('onstructor'); // Matches 'Constructor' or 'constructor'
    });

    it('should include response format instructions', () => {
      const batch = createMockBatch([createMockFinding()]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.system).toContain('JSON');
      expect(prompt.system).toContain('refactorings');
      expect(prompt.system).toContain('confidence');
      expect(prompt.system).toContain('safeToAutoApply');
    });

    it('should include example response', () => {
      const batch = createMockBatch([createMockFinding()]);

      const prompt = buildRefactorPrompt(batch);

      expect(prompt.system).toContain('Example');
      expect(prompt.system).toContain('"success": true');
    });
  });

  describe('error handling', () => {
    it('should throw error for empty findings array', () => {
      const batch: RefactorBatch = {
        batchId: 'batch-1',
        file: 'test.ts',
        fileContent: 'code',
        findings: [],
      };

      expect(() => buildRefactorPrompt(batch)).toThrow('empty');
    });
  });

  describe('severity display', () => {
    const severities = ['low', 'medium', 'high', 'critical'] as const;

    severities.forEach((severity) => {
      it(`should include ${severity} severity`, () => {
        const finding = createMockFinding({ severity });
        const batch = createMockBatch([finding]);

        const prompt = buildRefactorPrompt(batch);

        expect(prompt.user).toContain(severity);
      });
    });
  });
});

describe('buildSingleFindingPrompt', () => {
  it('should build prompt for single finding', () => {
    const finding = createMockFinding({
      id: 'single-finding',
      message: 'Single finding message',
    });
    const fileContent = 'const x = 1;';
    const filePath = 'src/single.ts';

    const prompt = buildSingleFindingPrompt(finding, fileContent, filePath);

    expect(prompt.system).toBeDefined();
    expect(prompt.user).toBeDefined();
    expect(prompt.user).toContain('single-finding');
    expect(prompt.user).toContain('src/single.ts');
    expect(prompt.user).toContain('const x = 1;');
  });

  it('should use finding ID as batch ID', () => {
    const finding = createMockFinding({ id: 'my-finding-id' });

    const prompt = buildSingleFindingPrompt(finding, 'code', 'file.ts');

    expect(prompt.user).toContain('my-finding-id');
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens based on character count', () => {
    const prompt = {
      system: 'a'.repeat(100), // 100 chars
      user: 'b'.repeat(300), // 300 chars
    };

    const tokens = estimateTokens(prompt);

    // ~4 chars per token, so 400 chars ≈ 100 tokens
    expect(tokens).toBe(100);
  });

  it('should return positive number for non-empty prompt', () => {
    const prompt = {
      system: 'Hello',
      user: 'World',
    };

    const tokens = estimateTokens(prompt);

    expect(tokens).toBeGreaterThan(0);
  });

  it('should return 0 for empty prompt', () => {
    const prompt = {
      system: '',
      user: '',
    };

    const tokens = estimateTokens(prompt);

    expect(tokens).toBe(0);
  });

  it('should round up token estimate', () => {
    const prompt = {
      system: 'abc', // 3 chars
      user: 'de', // 2 chars
    };

    const tokens = estimateTokens(prompt);

    // 5 chars / 4 = 1.25, should round up to 2
    expect(tokens).toBe(2);
  });

  it('should handle real-world prompt size', () => {
    const finding = createMockFinding();
    const batch = createMockBatch([finding], 'const x = 1;\n'.repeat(100));

    const prompt = buildRefactorPrompt(batch);
    const tokens = estimateTokens(prompt);

    // Real prompts should have reasonable token counts
    expect(tokens).toBeGreaterThan(100);
    expect(tokens).toBeLessThan(50000);
  });
});
