/**
 * Bug Fixer Tests
 *
 * @module tests/unit/core/bugfix/bug-fixer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BugFixer } from '../../../../src/core/bugfix/bug-fixer.js';
import type { BugFinding } from '../../../../src/core/bugfix/types.js';

describe('BugFixer', () => {
  let testDir: string;
  let backupDir: string;
  let fixer: BugFixer;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bugfix-fixer-test-${Date.now()}`);
    backupDir = join(testDir, '.automatosx', 'backups');
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });

    fixer = new BugFixer(backupDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  function createFinding(overrides: Partial<BugFinding> = {}): BugFinding {
    return {
      id: 'test-bug-1',
      file: 'src/test.ts',
      lineStart: 1,
      lineEnd: 1,
      type: 'timer_leak',
      severity: 'high',
      message: 'setInterval without .unref()',
      context: 'const interval = setInterval(() => {}, 1000);',
      confidence: 0.9,
      detectionMethod: 'regex',
      detectedAt: new Date().toISOString(),
      fixStrategy: 'add_unref',
      ...overrides
    };
  }

  describe('applyFix - timer_leak', () => {
    it('should add .unref() after setInterval with variable assignment', async () => {
      const code = `const interval = setInterval(() => {
  console.log('tick');
}, 1000);
`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1,
        fixStrategy: 'add_unref'
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('applied');
      expect(result.diff).toContain('unref');

      const fixedContent = await readFile(filePath, 'utf-8');
      expect(fixedContent).toContain('interval.unref');
    });

    it('should create backup before applying fix', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      await fixer.applyFix(finding, testDir, false);

      // Check backup was created
      const backupDirStats = await stat(backupDir);
      expect(backupDirStats.isDirectory()).toBe(true);
    });

    it('should not modify file in dry-run mode', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      const result = await fixer.applyFix(finding, testDir, true);

      expect(result.status).toBe('applied');

      const unchangedContent = await readFile(filePath, 'utf-8');
      expect(unchangedContent).toBe(code);
    });

    it('should skip if unref already present', async () => {
      const code = `const interval = setInterval(() => {}, 1000);
interval.unref();
`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('skipped');
      expect(result.error).toContain('No changes needed');
    });
  });

  describe('applyFix - missing_destroy', () => {
    it('should add destroy method to EventEmitter class', async () => {
      const code = `import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
  constructor() {
    super();
  }

  start() {
    this.emit('started');
  }
}
`;
      const filePath = join(testDir, 'src', 'emitter.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/emitter.ts',
        lineStart: 3,
        type: 'missing_destroy',
        fixStrategy: 'add_destroy_method'
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('applied');

      const fixedContent = await readFile(filePath, 'utf-8');
      expect(fixedContent).toContain('destroy()');
      expect(fixedContent).toContain('removeAllListeners');
    });

    it('should use correct indentation for destroy method', async () => {
      const code = `import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
    constructor() {
        super();
    }
}
`;
      const filePath = join(testDir, 'src', 'emitter.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/emitter.ts',
        lineStart: 3,
        type: 'missing_destroy',
        fixStrategy: 'add_destroy_method'
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('applied');

      const fixedContent = await readFile(filePath, 'utf-8');
      // Should match 4-space indentation
      expect(fixedContent).toContain('    destroy()');
    });
  });

  describe('rollback', () => {
    it('should restore original file from backup', async () => {
      const originalCode = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, originalCode);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      await fixer.applyFix(finding, testDir, false);

      // Verify fix was applied
      const fixedContent = await readFile(filePath, 'utf-8');
      expect(fixedContent).toContain('unref');

      // Rollback
      const success = await fixer.rollback(filePath);

      expect(success).toBe(true);

      const restoredContent = await readFile(filePath, 'utf-8');
      expect(restoredContent).toBe(originalCode);
    });

    it('should return false if no backup exists', async () => {
      const filePath = join(testDir, 'src', 'nonexistent.ts');

      const success = await fixer.rollback(filePath);

      expect(success).toBe(false);
    });

    it('should remove backup file after rollback', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      await fixer.applyFix(finding, testDir, false);
      await fixer.rollback(filePath);

      // Second rollback should fail since backup was removed
      const success = await fixer.rollback(filePath);
      expect(success).toBe(false);
    });
  });

  describe('rollbackAll', () => {
    it('should rollback all applied fixes', async () => {
      const code1 = `const i1 = setInterval(() => {}, 1000);`;
      const code2 = `const i2 = setInterval(() => {}, 2000);`;

      const filePath1 = join(testDir, 'src', 'test1.ts');
      const filePath2 = join(testDir, 'src', 'test2.ts');

      await writeFile(filePath1, code1);
      await writeFile(filePath2, code2);

      const finding1 = createFinding({
        id: 'bug-1',
        file: 'src/test1.ts',
        lineStart: 1
      });

      const finding2 = createFinding({
        id: 'bug-2',
        file: 'src/test2.ts',
        lineStart: 1
      });

      await fixer.applyFix(finding1, testDir, false);
      await fixer.applyFix(finding2, testDir, false);

      const rolledBack = await fixer.rollbackAll();

      expect(rolledBack).toBe(2);

      const content1 = await readFile(filePath1, 'utf-8');
      const content2 = await readFile(filePath2, 'utf-8');

      expect(content1).toBe(code1);
      expect(content2).toBe(code2);
    });
  });

  describe('cleanupBackups', () => {
    it('should remove all backup files', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      await fixer.applyFix(finding, testDir, false);

      await fixer.cleanupBackups();

      // Rollback should fail since backups were cleaned up
      const success = await fixer.rollback(filePath);
      expect(success).toBe(false);
    });
  });

  describe('fix templates', () => {
    it('should have templates for common bug types', () => {
      const templates = fixer.getTemplates();

      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('add_unref');
      expect(templateIds).toContain('add_destroy_method');
      expect(templateIds).toContain('use_disposable_eventemitter');
      expect(templateIds).toContain('wrap_with_timeout');
    });

    it('should allow adding custom templates', () => {
      fixer.addTemplate({
        id: 'custom_fix',
        name: 'Custom Fix',
        description: 'A custom fix template',
        bugType: 'custom',
        template: '// custom fix code',
        confidence: 0.8
      });

      const templates = fixer.getTemplates();
      const customTemplate = templates.find(t => t.id === 'custom_fix');

      expect(customTemplate).toBeDefined();
      expect(customTemplate?.name).toBe('Custom Fix');
    });
  });

  describe('error handling', () => {
    it('should return failed status when file does not exist', async () => {
      const finding = createFinding({
        file: 'src/nonexistent.ts',
        lineStart: 1
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should return skipped status when no fix strategy available', async () => {
      const code = `console.log('test');`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1,
        type: 'custom',
        fixStrategy: undefined
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.status).toBe('skipped');
      expect(result.error).toContain('No automatic fix available');
    });
  });

  describe('fix attempt result', () => {
    it('should include all required fields', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.id).toBeDefined();
      expect(result.bugId).toBe(finding.id);
      expect(result.attemptNumber).toBe(1);
      expect(result.strategy).toBeDefined();
      expect(result.diff).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.attemptedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include diff for applied fixes', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      const filePath = join(testDir, 'src', 'test.ts');
      await writeFile(filePath, code);

      const finding = createFinding({
        file: 'src/test.ts',
        lineStart: 1
      });

      const result = await fixer.applyFix(finding, testDir, false);

      expect(result.diff).toContain('+');
      expect(result.diff).toContain('unref');
    });
  });
});
