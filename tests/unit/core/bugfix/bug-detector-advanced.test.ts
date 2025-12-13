/**
 * Advanced Bug Detector Tests - Production-Level Coverage
 *
 * Tests edge cases, AST analysis, complex patterns, and error handling
 * for the BugDetector module.
 *
 * @module tests/unit/core/bugfix/bug-detector-advanced.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BugDetector, createDefaultBugfixConfig } from '@/core/bugfix/bug-detector.js';
import type { BugfixConfig, BugFinding, BugType } from '@/core/bugfix/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TIMER_LEAK_CODE = `
// Timer leak - uncaptured setInterval
setInterval(() => {
  console.log('tick');
}, 1000);
`;

const TIMER_LEAK_WITH_CLEANUP = `
// Timer with proper cleanup
class Service {
  private interval: NodeJS.Timeout;

  start() {
    this.interval = setInterval(() => {
      console.log('tick');
    }, 1000);
  }

  destroy() {
    clearInterval(this.interval);
  }
}
`;

const TIMER_LEAK_CHAINED_UNREF = `
// Timer with chained unref - not a leak
setInterval(() => {
  console.log('tick');
}, 1000).unref();
`;

const TIMER_LEAK_VARIABLE_UNREF = `
// Timer with variable unref - not a leak
const timer = setInterval(() => {
  console.log('tick');
}, 1000);
timer.unref();
`;

const EVENTEMITTER_WITHOUT_DESTROY = `
import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    this.on('data', () => {});
  }
}
`;

const EVENTEMITTER_WITH_DESTROY = `
import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
  constructor() {
    super();
    this.on('data', () => {});
  }

  destroy() {
    this.removeAllListeners();
  }
}
`;

const PROMISE_TIMEOUT_LEAK = `
// Promise with setTimeout that may leak
async function fetchWithTimeout(url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Timeout'));
    }, 5000);

    fetch(url).then(resolve).catch(reject);
  });
}
`;

const PROMISE_TIMEOUT_WITH_CLEANUP = `
// Promise with proper timeout cleanup
async function fetchWithTimeout(url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 5000);

    fetch(url)
      .then((response) => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
`;

const IGNORE_COMMENT_INLINE = `
// ax-ignore
setInterval(() => console.log('ignored'), 1000);
`;

const IGNORE_COMMENT_TYPED = `
// ax-ignore timer_leak
setInterval(() => console.log('ignored'), 1000);

// This should still be detected
setInterval(() => console.log('not ignored'), 1000);
`;

const IGNORE_COMMENT_BLOCK = `
// ax-ignore-start
setInterval(() => console.log('ignored 1'), 1000);
setInterval(() => console.log('ignored 2'), 1000);
// ax-ignore-end

// This should be detected
setInterval(() => console.log('not ignored'), 1000);
`;

const COMPLEX_CLASS_HIERARCHY = `
import { EventEmitter } from 'events';
import { Disposable } from './disposable';

// Should not flag - extends Disposable which has destroy
class ServiceA extends Disposable {
  private timer: NodeJS.Timeout;

  start() {
    this.timer = setInterval(() => {}, 1000);
  }
}

// Should flag - extends EventEmitter without destroy
class ServiceB extends EventEmitter {
  constructor() {
    super();
  }
}

// Should not flag - has custom cleanup method
class ServiceC extends EventEmitter {
  cleanup() {
    this.removeAllListeners();
  }
}
`;

const NESTED_CALLBACKS_TIMER = `
function setup() {
  const outer = setInterval(() => {
    const inner = setInterval(() => {
      console.log('nested');
    }, 500);
    // inner timer is leaked
  }, 1000);
  outer.unref();
}
`;

const MULTIPLE_BUGS_SAME_FILE = `
import { EventEmitter } from 'events';

// Bug 1: Timer leak
setInterval(() => console.log('leak 1'), 1000);

// Bug 2: EventEmitter without destroy
class Emitter extends EventEmitter {}

// Bug 3: Another timer leak
setInterval(() => console.log('leak 2'), 2000);

// Bug 4: Promise timeout leak
async function doSomething() {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), 5000);
    Promise.resolve().then(resolve);
  });
}
`;

const TYPESCRIPT_SPECIFIC_PATTERNS = `
import { EventEmitter } from 'events';

// Generic class extending EventEmitter
class GenericEmitter<T> extends EventEmitter {
  private data: T[] = [];

  emit(event: string, data: T): boolean {
    return super.emit(event, data);
  }
}

// Interface implementation
interface IDisposable {
  dispose(): void;
}

class DisposableEmitter extends EventEmitter implements IDisposable {
  dispose() {
    this.removeAllListeners();
  }
}
`;

const EDGE_CASE_EMPTY_FILE = ``;

const EDGE_CASE_COMMENTS_ONLY = `
// This is a comment
/* Multi-line
   comment */
/**
 * JSDoc comment
 */
`;

const EDGE_CASE_SYNTAX_ERROR = `
class Broken {
  method() {
    if (true {  // syntax error
      console.log('broken');
    }
  }
}
`;

// ============================================================================
// Test Suite
// ============================================================================

describe('BugDetector Advanced Tests', () => {
  let testDir: string;
  let detector: BugDetector;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bugfix-advanced-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ============================================================================
  // Timer Leak Detection
  // ============================================================================

  describe('Timer Leak Detection', () => {
    it('should detect uncaptured setInterval', async () => {
      const filePath = join(testDir, 'timer-leak.ts');
      await writeFile(filePath, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some((f) => f.type === 'timer_leak')).toBe(true);
    });

    it('should NOT flag timer with proper cleanup in destroy()', async () => {
      const filePath = join(testDir, 'timer-cleanup.ts');
      await writeFile(filePath, TIMER_LEAK_WITH_CLEANUP);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // Should not flag because clearInterval is called in destroy()
      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBe(0);
    });

    it('should NOT flag timer with chained .unref()', async () => {
      const filePath = join(testDir, 'timer-unref-chained.ts');
      await writeFile(filePath, TIMER_LEAK_CHAINED_UNREF);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBe(0);
    });

    it('should NOT flag timer with variable .unref()', async () => {
      const filePath = join(testDir, 'timer-unref-variable.ts');
      await writeFile(filePath, TIMER_LEAK_VARIABLE_UNREF);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBe(0);
    });

    it('should detect nested timer leaks', async () => {
      const filePath = join(testDir, 'nested-timers.ts');
      await writeFile(filePath, NESTED_CALLBACKS_TIMER);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // Should detect the inner timer leak
      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // EventEmitter Detection
  // ============================================================================

  describe('EventEmitter Missing Destroy Detection', () => {
    it('should detect EventEmitter without destroy method', async () => {
      const filePath = join(testDir, 'emitter-no-destroy.ts');
      await writeFile(filePath, EVENTEMITTER_WITHOUT_DESTROY);

      const config = createDefaultBugfixConfig({
        bugTypes: ['missing_destroy'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.some((f) => f.type === 'missing_destroy')).toBe(true);
    });

    it('should NOT flag EventEmitter with destroy method', async () => {
      const filePath = join(testDir, 'emitter-with-destroy.ts');
      await writeFile(filePath, EVENTEMITTER_WITH_DESTROY);

      const config = createDefaultBugfixConfig({
        bugTypes: ['missing_destroy'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      const missingDestroy = findings.filter((f) => f.type === 'missing_destroy');
      expect(missingDestroy.length).toBe(0);
    });
  });

  // ============================================================================
  // Promise Timeout Detection
  // ============================================================================

  describe('Promise Timeout Leak Detection', () => {
    it('should detect setTimeout in Promise without cleanup', async () => {
      const filePath = join(testDir, 'promise-timeout-leak.ts');
      await writeFile(filePath, PROMISE_TIMEOUT_LEAK);

      const config = createDefaultBugfixConfig({
        bugTypes: ['promise_timeout_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.some((f) => f.type === 'promise_timeout_leak')).toBe(true);
    });

    it('should NOT flag Promise timeout with proper cleanup', async () => {
      const filePath = join(testDir, 'promise-timeout-clean.ts');
      await writeFile(filePath, PROMISE_TIMEOUT_WITH_CLEANUP);

      const config = createDefaultBugfixConfig({
        bugTypes: ['promise_timeout_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      const promiseLeaks = findings.filter((f) => f.type === 'promise_timeout_leak');
      expect(promiseLeaks.length).toBe(0);
    });
  });

  // ============================================================================
  // Ignore Comments
  // ============================================================================

  describe('Ignore Comment Handling', () => {
    it('should respect inline ignore comments', async () => {
      const filePath = join(testDir, 'ignore-inline.ts');
      await writeFile(filePath, IGNORE_COMMENT_INLINE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.filter((f) => f.type === 'timer_leak').length).toBe(0);
    });

    it('should respect type-specific ignore comments', async () => {
      const filePath = join(testDir, 'ignore-typed.ts');
      await writeFile(filePath, IGNORE_COMMENT_TYPED);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // Should only detect the non-ignored timer
      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBe(1);
    });

    it('should respect block ignore comments', async () => {
      const filePath = join(testDir, 'ignore-block.ts');
      await writeFile(filePath, IGNORE_COMMENT_BLOCK);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // Should only detect the timer outside the ignore block
      const timerLeaks = findings.filter((f) => f.type === 'timer_leak');
      expect(timerLeaks.length).toBe(1);
    });
  });

  // ============================================================================
  // Multiple Bugs Detection
  // ============================================================================

  describe('Multiple Bug Detection', () => {
    it('should detect multiple different bug types in same file', async () => {
      const filePath = join(testDir, 'multiple-bugs.ts');
      await writeFile(filePath, MULTIPLE_BUGS_SAME_FILE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak', 'missing_destroy', 'promise_timeout_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // Should find multiple bug types
      const types = new Set(findings.map((f) => f.type));
      expect(types.size).toBeGreaterThanOrEqual(2);
    });

    it('should detect all bugs (maxBugs enforced at controller level)', async () => {
      const filePath = join(testDir, 'many-bugs.ts');
      await writeFile(filePath, MULTIPLE_BUGS_SAME_FILE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak', 'missing_destroy', 'promise_timeout_leak'],
        maxBugs: 2, // Note: maxBugs is enforced by BugfixController, not BugDetector
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // BugDetector finds all bugs; BugfixController would limit fixes to maxBugs
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Confidence and Severity
  // ============================================================================

  describe('Confidence and Severity', () => {
    it('should assign appropriate confidence scores', async () => {
      const filePath = join(testDir, 'confidence-test.ts');
      await writeFile(filePath, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      findings.forEach((finding) => {
        expect(finding.confidence).toBeGreaterThanOrEqual(0);
        expect(finding.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should filter by minimum confidence', async () => {
      const filePath = join(testDir, 'confidence-filter.ts');
      await writeFile(filePath, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
        minConfidence: 0.95, // Very high threshold
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // All findings should meet minimum confidence
      findings.forEach((finding) => {
        expect(finding.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });

    it('should filter by severity threshold', async () => {
      const filePath = join(testDir, 'severity-filter.ts');
      await writeFile(filePath, MULTIPLE_BUGS_SAME_FILE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak', 'missing_destroy', 'promise_timeout_leak'],
        severityThreshold: 'high',
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      // All findings should be high severity or above
      findings.forEach((finding) => {
        expect(['high', 'critical']).toContain(finding.severity);
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      const filePath = join(testDir, 'empty.ts');
      await writeFile(filePath, EDGE_CASE_EMPTY_FILE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.length).toBe(0);
    });

    it('should handle files with only comments', async () => {
      const filePath = join(testDir, 'comments-only.ts');
      await writeFile(filePath, EDGE_CASE_COMMENTS_ONLY);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.length).toBe(0);
    });

    it('should handle files with syntax errors gracefully', async () => {
      const filePath = join(testDir, 'syntax-error.ts');
      await writeFile(filePath, EDGE_CASE_SYNTAX_ERROR);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      // Should not throw - just skip the file
      const findings = await detector.scan(testDir, [filePath]);
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, ['/non/existent/file.ts']);
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle very large files', async () => {
      const filePath = join(testDir, 'large-file.ts');

      // Generate a large file with many functions
      let content = '';
      for (let i = 0; i < 1000; i++) {
        content += `function func${i}() { console.log('${i}'); }\n`;
      }
      content += 'setInterval(() => {}, 1000);'; // One timer leak at the end

      await writeFile(filePath, content);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.some((f) => f.type === 'timer_leak')).toBe(true);
    });

    it('should handle files with unicode characters', async () => {
      const filePath = join(testDir, 'unicode.ts');
      const content = `
// 日本語コメント
const メッセージ = "こんにちは";
setInterval(() => console.log(メッセージ), 1000);
`;
      await writeFile(filePath, content);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      expect(findings.some((f) => f.type === 'timer_leak')).toBe(true);
    });
  });

  // ============================================================================
  // File Filtering
  // ============================================================================

  describe('File Filtering', () => {
    it('should respect exclude patterns', async () => {
      const srcDir = join(testDir, 'src');
      const nodeModulesDir = join(testDir, 'node_modules');

      await mkdir(srcDir, { recursive: true });
      await mkdir(nodeModulesDir, { recursive: true });

      await writeFile(join(srcDir, 'app.ts'), TIMER_LEAK_CODE);
      await writeFile(join(nodeModulesDir, 'lib.ts'), TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
        excludePatterns: ['node_modules'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir);

      // Should only find bug in src, not in node_modules
      expect(findings.every((f) => !f.file.includes('node_modules'))).toBe(true);
    });

    it('should skip test files by default', async () => {
      const srcFile = join(testDir, 'app.ts');
      const testFile = join(testDir, 'app.test.ts');

      await writeFile(srcFile, TIMER_LEAK_CODE);
      await writeFile(testFile, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
        excludePatterns: ['.test.ts', '.spec.ts'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir);

      // Should not flag test files
      expect(findings.every((f) => !f.file.includes('.test.ts'))).toBe(true);
    });

    it('should handle glob patterns in file filter', async () => {
      await writeFile(join(testDir, 'app.ts'), TIMER_LEAK_CODE);
      await writeFile(join(testDir, 'app.js'), TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      // Only scan .ts files
      const findings = await detector.scan(testDir, [join(testDir, 'app.ts')]);

      expect(findings.every((f) => f.file.endsWith('.ts'))).toBe(true);
    });
  });

  // ============================================================================
  // Finding Structure
  // ============================================================================

  describe('Finding Structure Validation', () => {
    it('should produce well-formed findings', async () => {
      const filePath = join(testDir, 'structure-test.ts');
      await writeFile(filePath, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      findings.forEach((finding) => {
        // Required fields
        expect(finding.id).toBeDefined();
        expect(typeof finding.id).toBe('string');
        expect(finding.file).toBeDefined();
        expect(finding.lineStart).toBeGreaterThan(0);
        expect(finding.lineEnd).toBeGreaterThanOrEqual(finding.lineStart);
        expect(finding.type).toBeDefined();
        expect(finding.severity).toBeDefined();
        expect(finding.message).toBeDefined();
        expect(finding.context).toBeDefined();
        expect(finding.confidence).toBeDefined();
        expect(finding.detectionMethod).toBeDefined();
        expect(finding.detectedAt).toBeDefined();

        // Validate enums
        expect(['low', 'medium', 'high', 'critical']).toContain(finding.severity);
        expect(['regex', 'ast', 'test', 'pattern', 'manual']).toContain(finding.detectionMethod);
      });
    });

    it('should include context snippet in findings', async () => {
      const filePath = join(testDir, 'context-test.ts');
      await writeFile(filePath, TIMER_LEAK_CODE);

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak'],
      });
      detector = new BugDetector(config);

      const findings = await detector.scan(testDir, [filePath]);

      findings.forEach((finding) => {
        expect(finding.context.length).toBeGreaterThan(0);
        // Context should contain relevant code
        expect(finding.context).toContain('setInterval');
      });
    });
  });

  // ============================================================================
  // Performance
  // ============================================================================

  describe('Performance', () => {
    it('should complete scan in reasonable time', async () => {
      // Create multiple files
      for (let i = 0; i < 10; i++) {
        await writeFile(join(testDir, `file${i}.ts`), TIMER_LEAK_CODE);
      }

      const config = createDefaultBugfixConfig({
        bugTypes: ['timer_leak', 'missing_destroy'],
      });
      detector = new BugDetector(config);

      const start = Date.now();
      await detector.scan(testDir);
      const duration = Date.now() - start;

      // Should complete in under 10 seconds for 10 files
      expect(duration).toBeLessThan(10000);
    });
  });
});
