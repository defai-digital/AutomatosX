/**
 * LLM Refactor Service Tests
 *
 * @module tests/unit/core/refactor/llm-refactor/refactor-service
 * @since v12.10.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { LLMRefactorService, createRefactorService } from '../../../../../src/core/refactor/llm-refactor/refactor-service.js';
import { DEFAULT_LLM_REFACTOR_CONFIG, AUTO_APPLY_SAFETY_RULES } from '../../../../../src/core/refactor/llm-refactor/constants.js';
import type { RefactorFinding } from '../../../../../src/core/refactor/types.js';
import type { Router } from '../../../../../src/core/router/router.js';

// Mock finding factory
function createMockFinding(overrides: Partial<RefactorFinding> = {}): RefactorFinding {
  return {
    id: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    file: 'src/example.ts',
    lineStart: 1,
    lineEnd: 1,
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

// Mock router factory
function createMockRouter(response?: string): Router {
  return {
    execute: vi.fn().mockResolvedValue({
      success: true,
      content: response || JSON.stringify({
        refactorings: [{
          id: 'finding-1',
          success: true,
          refactoredCode: 'const TIMEOUT_MS = 3000;',
          explanation: 'Extracted to constant',
          confidence: 0.95,
          safeToAutoApply: true,
        }],
      }),
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
    selectProvider: vi.fn().mockResolvedValue({ name: 'claude', available: true }),
    isAvailable: vi.fn().mockReturnValue(true),
  } as unknown as Router;
}

describe('LLMRefactorService', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `llm-refactor-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });
    await mkdir(join(testDir, '.automatosx', 'refactor-backups'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor and configuration', () => {
    it('should create service with default config', () => {
      const service = new LLMRefactorService({});

      expect(service).toBeDefined();
      expect(service.getMetrics()).toBeDefined();
    });

    it('should create service with custom config', () => {
      const service = new LLMRefactorService({
        config: {
          provider: 'gemini',
          maxRequestsPerRun: 5,
        },
      });

      expect(service).toBeDefined();
    });

    it('should accept router parameter', () => {
      const router = createMockRouter();
      const service = new LLMRefactorService({ router });

      expect(service).toBeDefined();
    });
  });

  describe('createRefactorService factory', () => {
    it('should create service using factory function', () => {
      const router = createMockRouter();
      const service = createRefactorService(router);

      expect(service).toBeInstanceOf(LLMRefactorService);
    });

    it('should pass config to service', () => {
      const router = createMockRouter();
      const service = createRefactorService(router, { maxRequestsPerRun: 10 });

      expect(service).toBeDefined();
    });
  });

  describe('refactor', () => {
    it('should return empty results for empty findings', async () => {
      const service = new LLMRefactorService({
        router: createMockRouter(),
      });

      const results = await service.refactor([], testDir);

      expect(results).toEqual([]);
    });

    it('should skip findings when router not available', async () => {
      const service = new LLMRefactorService({});
      const finding = createMockFinding();

      const results = await service.refactor([finding], testDir);

      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toContain('router');
    });

    it('should process findings with router', async () => {
      const finding = createMockFinding({ id: 'finding-1' });
      const fileContent = 'const timeout = 3000;';
      await writeFile(join(testDir, 'src', 'example.ts'), fileContent);

      const router = createMockRouter();
      const service = new LLMRefactorService({ router });

      const results = await service.refactor([finding], testDir);

      expect(results).toHaveLength(1);
      expect(router.execute).toHaveBeenCalled();
    });

    it('should batch findings by file', async () => {
      const findings = [
        createMockFinding({ id: 'f1', file: 'src/a.ts' }),
        createMockFinding({ id: 'f2', file: 'src/a.ts' }),
        createMockFinding({ id: 'f3', file: 'src/b.ts' }),
      ];

      await writeFile(join(testDir, 'src', 'a.ts'), 'const a = 1;');
      await writeFile(join(testDir, 'src', 'b.ts'), 'const b = 2;');

      const router = createMockRouter(JSON.stringify({
        refactorings: [
          { id: 'f1', success: true, refactoredCode: 'x', confidence: 0.9, safeToAutoApply: true },
          { id: 'f2', success: true, refactoredCode: 'y', confidence: 0.9, safeToAutoApply: true },
        ],
      }));
      const service = new LLMRefactorService({ router });

      await service.refactor(findings, testDir);

      // Should make at least 2 requests (one per file)
      expect(router.execute).toHaveBeenCalled();
    });

    it('should track metrics during processing', async () => {
      const finding = createMockFinding({ id: 'finding-1' });
      await writeFile(join(testDir, 'src', 'example.ts'), 'const x = 1;');

      const router = createMockRouter();
      const service = new LLMRefactorService({ router });

      await service.refactor([finding], testDir);

      const metrics = service.getMetrics();
      expect(metrics.findingsTotal).toBeGreaterThan(0);
      expect(metrics.llmRequests).toBeGreaterThan(0);
    });
  });

  describe('checkAutoApplySafety', () => {
    it('should mark safe types as safe to auto-apply', async () => {
      const finding = createMockFinding({
        id: 'f1',
        type: 'dead_code', // Safe type
        context: 'const unused = 1;',
      });
      await writeFile(join(testDir, 'src', 'example.ts'), 'const unused = 1;');

      const router = createMockRouter(JSON.stringify({
        refactorings: [{
          id: 'f1',
          success: true,
          refactoredCode: '// Removed unused variable', // Non-empty refactored code
          confidence: 0.95,
          safeToAutoApply: true,
        }],
      }));

      const service = new LLMRefactorService({ router });
      const results = await service.refactor([finding], testDir);

      // High confidence + safe type should be safe
      expect(results[0]!.safeToAutoApply).toBe(true);
    });

    it('should require manual review for low confidence', async () => {
      const finding = createMockFinding({ id: 'f1' });
      await writeFile(join(testDir, 'src', 'example.ts'), 'const x = 1;');

      const router = createMockRouter(JSON.stringify({
        refactorings: [{
          id: 'f1',
          success: true,
          refactoredCode: 'const X = 1;',
          confidence: 0.5, // Below threshold
          safeToAutoApply: true,
        }],
      }));

      const service = new LLMRefactorService({ router });
      const results = await service.refactor([finding], testDir);

      expect(results[0]!.safeToAutoApply).toBe(false);
      expect(results[0]!.manualReviewReason).toContain('Confidence');
    });

    it('should require manual review for large changes', async () => {
      const largeCode = 'const x = 1;\n'.repeat(30); // More than MAX_LINES_CHANGED
      const finding = createMockFinding({
        id: 'f1',
        context: largeCode,
        lineStart: 1,
        lineEnd: 30,
      });
      await writeFile(join(testDir, 'src', 'example.ts'), largeCode);

      const router = createMockRouter(JSON.stringify({
        refactorings: [{
          id: 'f1',
          success: true,
          refactoredCode: largeCode,
          confidence: 0.95,
          safeToAutoApply: true,
        }],
      }));

      const service = new LLMRefactorService({ router });
      const results = await service.refactor([finding], testDir);

      expect(results[0]!.safeToAutoApply).toBe(false);
      expect(results[0]!.manualReviewReason).toContain('lines');
    });

    it('should require manual review for export patterns', async () => {
      const finding = createMockFinding({
        id: 'f1',
        context: 'export function processData() { return 1; }',
      });
      await writeFile(join(testDir, 'src', 'example.ts'), finding.context);

      const router = createMockRouter(JSON.stringify({
        refactorings: [{
          id: 'f1',
          success: true,
          refactoredCode: 'export function processData() { return 2; }',
          confidence: 0.95,
          safeToAutoApply: true,
        }],
      }));

      const service = new LLMRefactorService({ router });
      const results = await service.refactor([finding], testDir);

      expect(results[0]!.safeToAutoApply).toBe(false);
      expect(results[0]!.manualReviewReason).toContain('manual review');
    });
  });

  describe('createBackup', () => {
    it('should create backup file', async () => {
      const filePath = join(testDir, 'src', 'backup-test.ts');
      await writeFile(filePath, 'original content');

      const service = new LLMRefactorService({});
      const backupPath = await service.createBackup('src/backup-test.ts', testDir);

      expect(backupPath).not.toBeNull();
      expect(backupPath).toContain('.bak');
    });

    it('should preserve original content in backup', async () => {
      const originalContent = 'const original = true;';
      const filePath = join(testDir, 'src', 'preserve.ts');
      await writeFile(filePath, originalContent);

      const service = new LLMRefactorService({});
      const backupPath = await service.createBackup('src/preserve.ts', testDir);

      expect(backupPath).not.toBeNull();
      const backupContent = await readFile(backupPath!, 'utf-8');
      expect(backupContent).toBe(originalContent);
    });

    it('should return null for non-existent file', async () => {
      const service = new LLMRefactorService({});
      const backupPath = await service.createBackup('nonexistent.ts', testDir);

      expect(backupPath).toBeNull();
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore file from backup', async () => {
      const originalContent = 'original';
      const modifiedContent = 'modified';
      const filePath = join(testDir, 'src', 'restore.ts');

      await writeFile(filePath, originalContent);

      const service = new LLMRefactorService({});
      const backupPath = await service.createBackup('src/restore.ts', testDir);

      // Modify the file
      await writeFile(filePath, modifiedContent);

      // Restore
      const restored = await service.restoreFromBackup(backupPath!, filePath);

      expect(restored).toBe(true);
      const restoredContent = await readFile(filePath, 'utf-8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should return false for non-existent backup', async () => {
      const service = new LLMRefactorService({});
      const restored = await service.restoreFromBackup(
        '/nonexistent/backup.bak',
        '/some/file.ts'
      );

      expect(restored).toBe(false);
    });
  });

  describe('applyRefactoring', () => {
    it('should apply refactoring to file', async () => {
      const originalContent = 'const timeout = 3000;';
      const filePath = join(testDir, 'src', 'apply.ts');
      await writeFile(filePath, originalContent);

      const service = new LLMRefactorService({});
      const result = await service.applyRefactoring(
        {
          findingId: 'f1',
          success: true,
          refactoredCode: 'const TIMEOUT_MS = 3000;',
          originalCode: originalContent,
          lineStart: 1,
          lineEnd: 1,
          confidence: 0.9,
          safeToAutoApply: true,
        },
        'src/apply.ts',
        testDir
      );

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();

      const newContent = await readFile(filePath, 'utf-8');
      expect(newContent).toBe('const TIMEOUT_MS = 3000;');
    });

    it('should reject when content mismatch detected', async () => {
      const originalContent = 'const x = 1;';
      const filePath = join(testDir, 'src', 'mismatch.ts');
      await writeFile(filePath, originalContent);

      const service = new LLMRefactorService({});
      const result = await service.applyRefactoring(
        {
          findingId: 'f1',
          success: true,
          refactoredCode: 'const Y = 2;',
          originalCode: 'const different = 999;', // Doesn't match file content
          lineStart: 1,
          lineEnd: 1,
          confidence: 0.9,
          safeToAutoApply: true,
        },
        'src/mismatch.ts',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match');

      // File should be unchanged
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe(originalContent);
    });

    it('should reject when line numbers out of bounds', async () => {
      const content = 'line1\nline2';
      const filePath = join(testDir, 'src', 'bounds.ts');
      await writeFile(filePath, content);

      const service = new LLMRefactorService({});
      const result = await service.applyRefactoring(
        {
          findingId: 'f1',
          success: true,
          refactoredCode: 'new code',
          originalCode: 'line1',
          lineStart: 1,
          lineEnd: 100, // Out of bounds
          confidence: 0.9,
          safeToAutoApply: true,
        },
        'src/bounds.ts',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid line range');
    });

    it('should reject when no refactored code provided', async () => {
      const service = new LLMRefactorService({});
      const result = await service.applyRefactoring(
        {
          findingId: 'f1',
          success: false, // No refactored code
          originalCode: 'x',
          lineStart: 1,
          lineEnd: 1,
          confidence: 0.9,
          safeToAutoApply: false,
        },
        'src/test.ts',
        testDir
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No refactored code');
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', () => {
      const service = new LLMRefactorService({});

      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('findingsTotal');
      expect(metrics).toHaveProperty('findingsRefactored');
      expect(metrics).toHaveProperty('findingsSkipped');
      expect(metrics).toHaveProperty('findingsFailed');
      expect(metrics).toHaveProperty('llmRequests');
      expect(metrics).toHaveProperty('llmTokensUsed');
      expect(metrics).toHaveProperty('llmCostEstimateUsd');
      expect(metrics).toHaveProperty('durationMs');
    });

    it('should initialize metrics to zero', () => {
      const service = new LLMRefactorService({});

      const metrics = service.getMetrics();

      expect(metrics.findingsTotal).toBe(0);
      expect(metrics.findingsRefactored).toBe(0);
      expect(metrics.llmRequests).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', async () => {
      const finding = createMockFinding({ id: 'f1' });
      await writeFile(join(testDir, 'src', 'example.ts'), 'const x = 1;');

      const router = createMockRouter();
      const service = new LLMRefactorService({ router });

      // Process some findings
      await service.refactor([finding], testDir);

      // Reset
      service.resetMetrics();

      const metrics = service.getMetrics();
      expect(metrics.findingsTotal).toBe(0);
      expect(metrics.llmRequests).toBe(0);
    });
  });
});

describe('AUTO_APPLY_SAFETY_RULES', () => {
  it('should have safe types defined', () => {
    expect(AUTO_APPLY_SAFETY_RULES.SAFE_TYPES).toContain('dead_code');
    expect(AUTO_APPLY_SAFETY_RULES.SAFE_TYPES).toContain('type_safety');
    expect(AUTO_APPLY_SAFETY_RULES.SAFE_TYPES).toContain('hardcoded_values');
  });

  it('should have reasonable line limit', () => {
    expect(AUTO_APPLY_SAFETY_RULES.MAX_LINES_CHANGED).toBeGreaterThan(0);
    expect(AUTO_APPLY_SAFETY_RULES.MAX_LINES_CHANGED).toBeLessThan(100);
  });

  it('should have confidence threshold between 0 and 1', () => {
    expect(AUTO_APPLY_SAFETY_RULES.MIN_CONFIDENCE).toBeGreaterThan(0);
    expect(AUTO_APPLY_SAFETY_RULES.MIN_CONFIDENCE).toBeLessThanOrEqual(1);
  });

  it('should have manual review patterns defined', () => {
    expect(Array.isArray(AUTO_APPLY_SAFETY_RULES.MANUAL_REVIEW_PATTERNS)).toBe(true);
    expect(AUTO_APPLY_SAFETY_RULES.MANUAL_REVIEW_PATTERNS.length).toBeGreaterThan(0);
  });
});

describe('DEFAULT_LLM_REFACTOR_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_LLM_REFACTOR_CONFIG.enabled).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.provider).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.maxRequestsPerRun).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.timeoutMs).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.batchSize).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.temperature).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.maxTokens).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.requireVerification).toBeDefined();
    expect(DEFAULT_LLM_REFACTOR_CONFIG.fallbackBehavior).toBeDefined();
  });

  it('should have sensible defaults', () => {
    expect(DEFAULT_LLM_REFACTOR_CONFIG.enabled).toBe(true);
    expect(DEFAULT_LLM_REFACTOR_CONFIG.maxRequestsPerRun).toBeGreaterThan(0);
    expect(DEFAULT_LLM_REFACTOR_CONFIG.timeoutMs).toBeGreaterThan(0);
    expect(DEFAULT_LLM_REFACTOR_CONFIG.temperature).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_LLM_REFACTOR_CONFIG.temperature).toBeLessThanOrEqual(1);
  });
});
