/**
 * Bug Detector Tests
 *
 * @module tests/unit/core/bugfix/bug-detector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { BugDetector, createDefaultBugfixConfig } from '../../../../src/core/bugfix/bug-detector.js';

describe('BugDetector', () => {
  let testDir: string;
  let detector: BugDetector;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bugfix-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'src'), { recursive: true });

    const config = createDefaultBugfixConfig({
      bugTypes: ['timer_leak', 'missing_destroy', 'promise_timeout_leak', 'event_leak']
    });
    detector = new BugDetector(config);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('timer_leak detection', () => {
    it('should detect setInterval without unref', async () => {
      const code = `
const interval = setInterval(() => {
  console.log('tick');
}, 1000);
`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const findings = await detector.scan(testDir);

      expect(findings.length).toBeGreaterThan(0);
      const timerLeak = findings.find(f => f.type === 'timer_leak');
      expect(timerLeak).toBeDefined();
      expect(timerLeak?.severity).toBe('high');
    });

    it('should not flag setInterval with unref', async () => {
      const code = `
const interval = setInterval(() => {
  console.log('tick');
}, 1000);
interval.unref();
`;
      await writeFile(join(testDir, 'src', 'clean.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('clean.ts')
      );

      expect(timerLeaks.length).toBe(0);
    });

    it('should not flag setInterval with optional chaining unref', async () => {
      const code = `
const interval = setInterval(() => {
  console.log('tick');
}, 1000);
interval?.unref();
`;
      await writeFile(join(testDir, 'src', 'clean2.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('clean2.ts')
      );

      expect(timerLeaks.length).toBe(0);
    });

    it('should detect multiple timer leaks in same file', async () => {
      const code = `
const interval1 = setInterval(() => {}, 1000);
const interval2 = setInterval(() => {}, 2000);
const interval3 = setInterval(() => {}, 3000);
`;
      await writeFile(join(testDir, 'src', 'multi.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('multi.ts')
      );

      expect(timerLeaks.length).toBe(3);
    });
  });

  describe('missing_destroy detection', () => {
    it('should detect EventEmitter class without destroy method', async () => {
      const code = `
import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
  constructor() {
    super();
  }

  start() {
    this.emit('started');
  }
}
`;
      await writeFile(join(testDir, 'src', 'emitter.ts'), code);

      const findings = await detector.scan(testDir);
      const missingDestroy = findings.find(f =>
        f.type === 'missing_destroy' && f.file.includes('emitter.ts')
      );

      expect(missingDestroy).toBeDefined();
      expect(missingDestroy?.severity).toBe('high');
    });

    it('should not flag EventEmitter class with destroy method', async () => {
      const code = `
import { EventEmitter } from 'events';

class MyEmitter extends EventEmitter {
  constructor() {
    super();
  }

  destroy() {
    this.removeAllListeners();
  }
}
`;
      await writeFile(join(testDir, 'src', 'clean-emitter.ts'), code);

      const findings = await detector.scan(testDir);
      const missingDestroy = findings.filter(f =>
        f.type === 'missing_destroy' && f.file.includes('clean-emitter.ts')
      );

      expect(missingDestroy.length).toBe(0);
    });

    it('should detect DisposableEventEmitter class without destroy', async () => {
      const code = `
import { DisposableEventEmitter } from '@/shared/utils';

class MyService extends DisposableEventEmitter {
  constructor() {
    super();
  }
}
`;
      await writeFile(join(testDir, 'src', 'service.ts'), code);

      const findings = await detector.scan(testDir);
      const missingDestroy = findings.find(f =>
        f.type === 'missing_destroy' && f.file.includes('service.ts')
      );

      expect(missingDestroy).toBeDefined();
    });
  });

  describe('promise_timeout_leak detection', () => {
    it('should detect Promise with setTimeout but no clearTimeout', async () => {
      const code = `
function waitWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout'));
    }, ms);

    promise.then(resolve).catch(reject);
  });
}
`;
      await writeFile(join(testDir, 'src', 'timeout.ts'), code);

      const findings = await detector.scan(testDir);
      const timeoutLeak = findings.find(f =>
        f.type === 'promise_timeout_leak' && f.file.includes('timeout.ts')
      );

      expect(timeoutLeak).toBeDefined();
      expect(timeoutLeak?.severity).toBe('medium');
    });

    it('should not flag Promise with setTimeout and clearTimeout', async () => {
      const code = `
function waitWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout'));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}
`;
      await writeFile(join(testDir, 'src', 'clean-timeout.ts'), code);

      const findings = await detector.scan(testDir);
      const timeoutLeaks = findings.filter(f =>
        f.type === 'promise_timeout_leak' && f.file.includes('clean-timeout.ts')
      );

      expect(timeoutLeaks.length).toBe(0);
    });
  });

  describe('event_leak detection', () => {
    it('should detect .on() without corresponding .off()', async () => {
      const code = `
class MyHandler {
  constructor(emitter) {
    emitter.on('data', this.handleData);
    emitter.on('error', this.handleError);
  }

  handleData(data) {
    console.log(data);
  }

  handleError(err) {
    console.error(err);
  }
}
`;
      await writeFile(join(testDir, 'src', 'handler.ts'), code);

      const findings = await detector.scan(testDir);
      const eventLeaks = findings.filter(f =>
        f.type === 'event_leak' && f.file.includes('handler.ts')
      );

      expect(eventLeaks.length).toBeGreaterThan(0);
    });

    it('should not flag .on() with corresponding removeListener', async () => {
      const code = `
class MyHandler {
  constructor(emitter) {
    this.emitter = emitter;
    this.handleData = this.handleData.bind(this);
    emitter.on('data', this.handleData);
  }

  destroy() {
    this.emitter.removeListener('data', this.handleData);
  }

  handleData(data) {
    console.log(data);
  }
}
`;
      await writeFile(join(testDir, 'src', 'clean-handler.ts'), code);

      const findings = await detector.scan(testDir);
      const eventLeaks = findings.filter(f =>
        f.type === 'event_leak' && f.file.includes('clean-handler.ts')
      );

      expect(eventLeaks.length).toBe(0);
    });
  });

  describe('scan configuration', () => {
    it('should respect scope option', async () => {
      await mkdir(join(testDir, 'other'), { recursive: true });

      const srcCode = `const i = setInterval(() => {}, 1000);`;
      const otherCode = `const i = setInterval(() => {}, 1000);`;

      await writeFile(join(testDir, 'src', 'in-scope.ts'), srcCode);
      await writeFile(join(testDir, 'other', 'out-scope.ts'), otherCode);

      const config = createDefaultBugfixConfig({
        scope: 'src/',
        bugTypes: ['timer_leak']
      });
      const scopedDetector = new BugDetector(config);

      const findings = await scopedDetector.scan(testDir);

      const inScopeFindings = findings.filter(f => f.file.includes('in-scope.ts'));
      const outScopeFindings = findings.filter(f => f.file.includes('out-scope.ts'));

      expect(inScopeFindings.length).toBeGreaterThan(0);
      expect(outScopeFindings.length).toBe(0);
    });

    it('should respect excludePatterns', async () => {
      await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true });

      const srcCode = `const i = setInterval(() => {}, 1000);`;
      const nmCode = `const i = setInterval(() => {}, 1000);`;

      await writeFile(join(testDir, 'src', 'app.ts'), srcCode);
      await writeFile(join(testDir, 'node_modules', 'pkg', 'index.ts'), nmCode);

      const findings = await detector.scan(testDir);

      const nmFindings = findings.filter(f => f.file.includes('node_modules'));
      expect(nmFindings.length).toBe(0);
    });

    it('should filter by severity threshold', async () => {
      // Create bugs of different severities
      const highSeverityCode = `const i = setInterval(() => {}, 1000);`; // high
      const mediumSeverityCode = `
        function f() {
          return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(), 1000);
            Promise.resolve().then(resolve);
          });
        }
      `; // medium

      await writeFile(join(testDir, 'src', 'high.ts'), highSeverityCode);
      await writeFile(join(testDir, 'src', 'medium.ts'), mediumSeverityCode);

      const config = createDefaultBugfixConfig({
        severityThreshold: 'high',
        bugTypes: ['timer_leak', 'promise_timeout_leak']
      });
      const strictDetector = new BugDetector(config);

      const findings = await strictDetector.scan(testDir);

      // Should only include high severity bugs
      const highFindings = findings.filter(f => f.severity === 'high');
      const mediumFindings = findings.filter(f => f.severity === 'medium');

      expect(highFindings.length).toBeGreaterThan(0);
      expect(mediumFindings.length).toBe(0);
    });
  });

  describe('ignore comments (v12.6.0)', () => {
    it('should skip bugs marked with // ax-ignore', async () => {
      const code = `
// ax-ignore
const interval = setInterval(() => {}, 1000);
const interval2 = setInterval(() => {}, 1000);
`;
      await writeFile(join(testDir, 'src', 'ignored.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('ignored.ts')
      );

      // First setInterval should be ignored, second should be detected
      expect(timerLeaks.length).toBe(1);
      expect(timerLeaks[0]?.lineStart).toBeGreaterThan(3);
    });

    it('should skip specific bug type with // ax-ignore timer_leak', async () => {
      const code = `
// ax-ignore timer_leak
const interval = setInterval(() => {}, 1000);
`;
      await writeFile(join(testDir, 'src', 'typed-ignore.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('typed-ignore.ts')
      );

      expect(timerLeaks.length).toBe(0);
    });

    it('should not ignore different bug type when specific type is ignored', async () => {
      // event_leak has lower confidence but we're testing it's not ignored
      const code = `
// ax-ignore timer_leak
emitter.on('data', handler);
`;
      await writeFile(join(testDir, 'src', 'specific-ignore.ts'), code);

      const findings = await detector.scan(testDir);
      const eventLeaks = findings.filter(f =>
        f.type === 'event_leak' && f.file.includes('specific-ignore.ts')
      );

      // event_leak should still be detected (not ignored)
      expect(eventLeaks.length).toBe(1);
    });

    it('should skip bugs in // ax-ignore-start ... // ax-ignore-end block', async () => {
      const code = `
// ax-ignore-start
const interval1 = setInterval(() => {}, 1000);
const interval2 = setInterval(() => {}, 2000);
const interval3 = setInterval(() => {}, 3000);
// ax-ignore-end
const interval4 = setInterval(() => {}, 4000);
`;
      await writeFile(join(testDir, 'src', 'block-ignore.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('block-ignore.ts')
      );

      // Only the last setInterval should be detected
      expect(timerLeaks.length).toBe(1);
      expect(timerLeaks[0]?.lineStart).toBeGreaterThan(6);
    });

    it('should handle unclosed ignore block (ignores to end of file)', async () => {
      const code = `
const interval1 = setInterval(() => {}, 1000);
// ax-ignore-start
const interval2 = setInterval(() => {}, 2000);
const interval3 = setInterval(() => {}, 3000);
`;
      await writeFile(join(testDir, 'src', 'unclosed.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeaks = findings.filter(f =>
        f.type === 'timer_leak' && f.file.includes('unclosed.ts')
      );

      // Only the first setInterval should be detected
      expect(timerLeaks.length).toBe(1);
      expect(timerLeaks[0]?.lineStart).toBe(2);
    });
  });

  describe('file filter (git-aware scanning v12.6.0)', () => {
    it('should only scan files in the filter list', async () => {
      const code1 = `const i = setInterval(() => {}, 1000);`;
      const code2 = `const i = setInterval(() => {}, 1000);`;

      await writeFile(join(testDir, 'src', 'included.ts'), code1);
      await writeFile(join(testDir, 'src', 'excluded.ts'), code2);

      // Only scan 'included.ts'
      const findings = await detector.scan(testDir, ['src/included.ts']);

      const includedFindings = findings.filter(f => f.file.includes('included.ts'));
      const excludedFindings = findings.filter(f => f.file.includes('excluded.ts'));

      expect(includedFindings.length).toBeGreaterThan(0);
      expect(excludedFindings.length).toBe(0);
    });

    it('should handle absolute paths in filter', async () => {
      const code = `const i = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'absolute.ts'), code);

      const absolutePath = join(testDir, 'src', 'absolute.ts');
      const findings = await detector.scan(testDir, [absolutePath]);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.file).toContain('absolute.ts');
    });

    it('should return empty array if filter contains no scannable files', async () => {
      const findings = await detector.scan(testDir, ['README.md', 'package.json']);
      expect(findings.length).toBe(0);
    });
  });

  describe('finding properties', () => {
    it('should include all required properties in findings', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const findings = await detector.scan(testDir);
      const finding = findings[0];

      expect(finding).toBeDefined();
      expect(finding?.id).toBeDefined();
      expect(finding?.file).toBeDefined();
      expect(finding?.lineStart).toBeGreaterThan(0);
      expect(finding?.lineEnd).toBeGreaterThanOrEqual(finding?.lineStart || 0);
      expect(finding?.type).toBeDefined();
      expect(finding?.severity).toBeDefined();
      expect(finding?.message).toBeDefined();
      expect(finding?.context).toBeDefined();
      expect(finding?.confidence).toBeGreaterThan(0);
      expect(finding?.confidence).toBeLessThanOrEqual(1);
      expect(finding?.detectionMethod).toBeDefined();
      expect(finding?.detectedAt).toBeDefined();
    });

    it('should include fix strategy for auto-fixable bugs', async () => {
      const code = `const interval = setInterval(() => {}, 1000);`;
      await writeFile(join(testDir, 'src', 'test.ts'), code);

      const findings = await detector.scan(testDir);
      const timerLeak = findings.find(f => f.type === 'timer_leak');

      expect(timerLeak?.fixStrategy).toBeDefined();
    });

    it('should sort findings by severity then confidence', async () => {
      // Create multiple bugs
      const code = `
const i1 = setInterval(() => {}, 1000);
const i2 = setInterval(() => {}, 1000);

class E extends EventEmitter {
  constructor() { super(); }
}
`;
      await writeFile(join(testDir, 'src', 'multi.ts'), code);

      const findings = await detector.scan(testDir);

      // Verify sorting: critical > high > medium > low, then by confidence
      for (let i = 1; i < findings.length; i++) {
        const prev = findings[i - 1];
        const curr = findings[i];

        if (prev && curr) {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const prevSev = severityOrder[prev.severity];
          const currSev = severityOrder[curr.severity];

          if (prevSev === currSev) {
            expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
          } else {
            expect(prevSev).toBeLessThanOrEqual(currSev);
          }
        }
      }
    });
  });
});
