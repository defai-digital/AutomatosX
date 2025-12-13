/**
 * Design Stabilizer MCP Tools Tests
 *
 * @since v12.9.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the ax-core design-check module
vi.mock('@defai.digital/ax-core/design-check', () => ({
  runDesignCheck: vi.fn(),
  loadConfig: vi.fn(),
  getAvailableRules: vi.fn(),
  applyFixes: vi.fn(),
  writeFixedFile: vi.fn(),
  readFileSafe: vi.fn(),
  createBackup: vi.fn(),
  scanFiles: vi.fn(),
  runRules: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/shared/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock streaming notifier
vi.mock('../../../src/mcp/streaming-notifier.js', () => ({
  sendMcpProgress: vi.fn(),
  sendMcpProgressBegin: vi.fn().mockReturnValue('test-token'),
  sendMcpProgressEnd: vi.fn(),
}));

import {
  runDesignCheck,
  loadConfig,
  getAvailableRules,
  applyFixes,
  writeFixedFile,
  readFileSafe,
  createBackup,
} from '@defai.digital/ax-core/design-check';

import { createDesignCheckHandler } from '../../../src/mcp/tools/design-check.js';
import { createDesignCheckStreamHandler } from '../../../src/mcp/tools/design-check-stream.js';
import { createDesignRulesHandler } from '../../../src/mcp/tools/design-rules.js';
import { createDesignSuggestFixesHandler } from '../../../src/mcp/tools/design-suggest-fixes.js';
import { createDesignApplyFixesHandler } from '../../../src/mcp/tools/design-apply-fixes.js';

import { scanFiles, runRules } from '@defai.digital/ax-core/design-check';

// Helper to create mock config
const createMockConfig = (overrides = {}) => ({
  tokens: { colors: {}, spacing: {} },
  rules: {
    'no-hardcoded-colors': 'error' as const,
    'no-raw-spacing': 'warn' as const,
    'no-inline-styles': 'warn' as const,
    'missing-alt-text': 'error' as const,
    'missing-form-labels': 'error' as const,
  },
  include: ['**/*.tsx', '**/*.jsx'],
  ignore: ['node_modules/**'],
  ...overrides,
});

// Helper to create mock violation
const createMockViolation = (overrides = {}) => ({
  rule: 'no-hardcoded-colors',
  severity: 'error' as const,
  message: 'Hardcoded color found',
  file: '/test/file.tsx',
  line: 10,
  column: 5,
  found: '#ff0000',
  suggestion: 'theme.colors.error',
  fixable: true,
  ...overrides,
});

describe('Design Stabilizer MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('design_check', () => {
    it('should scan files for violations', async () => {
      const mockResult = {
        summary: {
          files: 2,
          filesWithViolations: 1,
          errors: 3,
          warnings: 2,
          skipped: 0,
        },
        results: [
          {
            file: '/test/file.tsx',
            violations: [createMockViolation()],
          },
        ],
        coverage: {
          colorCoverage: 80,
          spacingCoverage: 90,
          tokenizedColors: 80,
          tokenizedSpacing: 45,
          totalColors: 100,
          totalSpacing: 50,
          overallCoverage: 85,
        },
      };

      vi.mocked(runDesignCheck).mockResolvedValue(mockResult);
      vi.mocked(getAvailableRules).mockReturnValue([
        'no-hardcoded-colors',
        'no-raw-spacing',
      ]);

      const handler = createDesignCheckHandler();
      const result = await handler({ paths: ['src/**/*.tsx'] });

      expect(result.success).toBe(true);
      expect(result.summary.errors).toBe(3);
      expect(result.summary.warnings).toBe(2);
      expect(result.results).toHaveLength(1);
      expect(result.availableRules).toContain('no-hardcoded-colors');
      expect(runDesignCheck).toHaveBeenCalledWith(
        ['src/**/*.tsx'],
        expect.objectContaining({
          format: 'json',
          fix: false,
        })
      );
    });

    it('should throw error for empty paths', async () => {
      const handler = createDesignCheckHandler();

      await expect(handler({ paths: [] })).rejects.toThrow(
        'paths parameter is required'
      );
    });

    it('should apply limit to violations', async () => {
      const violations = Array.from({ length: 150 }, (_, i) =>
        createMockViolation({
          message: `Violation ${i}`,
          line: i + 1,
        })
      );

      vi.mocked(runDesignCheck).mockResolvedValue({
        summary: {
          files: 1,
          filesWithViolations: 1,
          errors: 150,
          warnings: 0,
          skipped: 0,
        },
        results: [{ file: '/test/file.tsx', violations }],
      });
      vi.mocked(getAvailableRules).mockReturnValue([]);

      const handler = createDesignCheckHandler();
      const result = await handler({ paths: ['src/**/*.tsx'], limit: 50 });

      expect(result.results[0]?.violations).toHaveLength(50);
    });
  });

  describe('design_rules', () => {
    it('should list available rules', async () => {
      vi.mocked(getAvailableRules).mockReturnValue([
        'no-hardcoded-colors',
        'no-raw-spacing',
        'missing-alt-text',
      ]);
      vi.mocked(loadConfig).mockResolvedValue(
        createMockConfig({
          rules: {
            'no-hardcoded-colors': 'error',
            'no-raw-spacing': 'warn',
            'no-inline-styles': 'warn',
            'missing-alt-text': 'off',
            'missing-form-labels': 'error',
          },
        })
      );

      const handler = createDesignRulesHandler();
      const result = await handler({});

      expect(result.total).toBe(3);
      expect(result.rules).toHaveLength(3);
      expect(result.rules[0]?.id).toBe('no-hardcoded-colors');
      expect(result.rules[0]?.currentSeverity).toBe('error');
    });

    it('should filter rules by substring', async () => {
      vi.mocked(getAvailableRules).mockReturnValue([
        'no-hardcoded-colors',
        'no-raw-spacing',
        'missing-alt-text',
      ]);
      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());

      const handler = createDesignRulesHandler();
      const result = await handler({ filter: 'color' });

      expect(result.total).toBe(1);
      expect(result.rules[0]?.id).toBe('no-hardcoded-colors');
    });
  });

  describe('design_suggest_fixes', () => {
    it('should generate fix patches without modifying files', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      const violation = createMockViolation();

      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(loadConfig).mockResolvedValue(
        createMockConfig({
          tokens: { colors: { error: '#ff0000' }, spacing: {} },
        })
      );
      vi.mocked(runDesignCheck).mockResolvedValue({
        summary: { files: 1, filesWithViolations: 1, errors: 1, warnings: 0, skipped: 0 },
        results: [{ file: '/test/file.tsx', violations: [violation] }],
      });
      vi.mocked(applyFixes).mockReturnValue({
        file: '/test/file.tsx',
        originalContent: 'color: "#ff0000"',
        fixedContent: 'color: theme.colors.error',
        fixes: [
          {
            violation,
            applied: true,
            replacement: 'theme.colors.error',
          },
        ],
        appliedCount: 1,
        skippedCount: 0,
      });

      const handler = createDesignSuggestFixesHandler();
      const result = await handler({ file: '/test/file.tsx' });

      expect(result.success).toBe(true);
      expect(result.wouldFix).toBe(1);
      expect(result.patches).toHaveLength(1);
      expect(result.patches[0]?.replacement).toBe('theme.colors.error');
      expect(applyFixes).toHaveBeenCalledWith(
        fileContent,
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should throw error for missing file', async () => {
      const handler = createDesignSuggestFixesHandler();

      await expect(handler({ file: '' })).rejects.toThrow(
        'file parameter is required'
      );
    });

    it('should throw error when file cannot be read', async () => {
      vi.mocked(readFileSafe).mockResolvedValue(null);
      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());

      const handler = createDesignSuggestFixesHandler();

      await expect(handler({ file: '/nonexistent.tsx' })).rejects.toThrow(
        'Cannot read file'
      );
    });
  });

  describe('design_apply_fixes', () => {
    it('should apply fixes and create backup', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      const violation = createMockViolation();

      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(loadConfig).mockResolvedValue(
        createMockConfig({
          tokens: { colors: { error: '#ff0000' }, spacing: {} },
        })
      );
      vi.mocked(createBackup).mockReturnValue('/test/file.tsx.ax-backup');
      vi.mocked(runDesignCheck)
        .mockResolvedValueOnce({
          summary: { files: 1, filesWithViolations: 1, errors: 1, warnings: 0, skipped: 0 },
          results: [{ file: '/test/file.tsx', violations: [violation] }],
        })
        .mockResolvedValueOnce({
          summary: { files: 1, filesWithViolations: 0, errors: 0, warnings: 0, skipped: 0 },
          results: [{ file: '/test/file.tsx', violations: [] }],
        });
      vi.mocked(applyFixes).mockReturnValue({
        file: '/test/file.tsx',
        originalContent: 'color: "#ff0000"',
        fixedContent: 'color: theme.colors.error',
        fixes: [
          {
            violation,
            applied: true,
            replacement: 'theme.colors.error',
          },
        ],
        appliedCount: 1,
        skippedCount: 0,
      });
      vi.mocked(writeFixedFile).mockReturnValue({ success: true });

      const handler = createDesignApplyFixesHandler();
      const result = await handler({ file: '/test/file.tsx' });

      expect(result.success).toBe(true);
      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.backupPath).toBe('/test/file.tsx.ax-backup');
      expect(result.verification?.beforeErrors).toBe(1);
      expect(result.verification?.afterErrors).toBe(0);
      expect(createBackup).toHaveBeenCalledWith('/test/file.tsx');
    });

    it('should skip backup when createBackup is false', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());
      vi.mocked(runDesignCheck).mockResolvedValue({
        summary: { files: 1, filesWithViolations: 0, errors: 0, warnings: 0, skipped: 0 },
        results: [{ file: '/test/file.tsx', violations: [] }],
      });

      const handler = createDesignApplyFixesHandler();
      const result = await handler({
        file: '/test/file.tsx',
        createBackup: false,
      });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
      expect(createBackup).not.toHaveBeenCalled();
    });

    it('should return early when no fixable violations', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'const x = 1;',
        lines: ['const x = 1;'],
      };

      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());
      vi.mocked(runDesignCheck).mockResolvedValue({
        summary: { files: 1, filesWithViolations: 0, errors: 0, warnings: 0, skipped: 0 },
        results: [{ file: '/test/file.tsx', violations: [] }],
      });

      const handler = createDesignApplyFixesHandler();
      const result = await handler({ file: '/test/file.tsx' });

      expect(result.success).toBe(true);
      expect(result.applied).toBe(0);
      expect(applyFixes).not.toHaveBeenCalled();
    });
  });

  describe('design_check_stream', () => {
    it('should process files in chunks with progress notifications', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());
      vi.mocked(scanFiles).mockResolvedValue([
        '/test/file1.tsx',
        '/test/file2.tsx',
        '/test/file3.tsx',
      ]);
      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(runRules).mockReturnValue([createMockViolation()]);

      const handler = createDesignCheckStreamHandler();
      const result = await handler({
        paths: ['src/**/*.tsx'],
        chunkSize: 2,
      });

      expect(result.success).toBe(true);
      expect(result.stoppedEarly).toBe(false);
      expect(result.summary.filesScanned).toBe(3);
      expect(result.summary.totalFiles).toBe(3);
      expect(result.summary.errors).toBe(3);
      expect(result.progressEvents).toBeGreaterThan(0);
    });

    it('should stop early when timeout reached', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());
      vi.mocked(scanFiles).mockResolvedValue(
        Array.from({ length: 1000 }, (_, i) => `/test/file${i}.tsx`)
      );
      vi.mocked(readFileSafe).mockImplementation(async () => {
        // Simulate slow processing
        await new Promise((r) => setTimeout(r, 10));
        return fileContent;
      });
      vi.mocked(runRules).mockReturnValue([]);

      const handler = createDesignCheckStreamHandler();
      const result = await handler({
        paths: ['src/**/*.tsx'],
        timeoutMs: 50, // Very short timeout
        chunkSize: 10,
      });

      expect(result.stoppedEarly).toBe(true);
      expect(result.stopReason).toBe('timeout');
      expect(result.summary.filesScanned).toBeLessThan(1000);
    });

    it('should stop early when max violations reached', async () => {
      const fileContent = {
        path: '/test/file.tsx',
        content: 'color: "#ff0000"',
        lines: ['color: "#ff0000"'],
      };

      vi.mocked(loadConfig).mockResolvedValue(createMockConfig());
      vi.mocked(scanFiles).mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => `/test/file${i}.tsx`)
      );
      vi.mocked(readFileSafe).mockResolvedValue(fileContent);
      vi.mocked(runRules).mockReturnValue([
        createMockViolation(),
        createMockViolation({ line: 2 }),
      ]);

      const handler = createDesignCheckStreamHandler();
      const result = await handler({
        paths: ['src/**/*.tsx'],
        maxViolations: 10,
        chunkSize: 10,
      });

      expect(result.stoppedEarly).toBe(true);
      expect(result.stopReason).toBe('max_violations');
    });

    it('should return error result for empty paths', async () => {
      const handler = createDesignCheckStreamHandler();
      const result = await handler({ paths: [] });

      expect(result.success).toBe(false);
      expect(result.stoppedEarly).toBe(true);
      expect(result.stopReason).toBe('cancelled');
    });
  });
});
