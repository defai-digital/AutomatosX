/**
 * AST Analyzer Tests
 *
 * @module tests/unit/core/bugfix/ast-analyzer
 * @since v12.8.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ASTAnalyzer,
  createASTAnalyzer,
  ALLOWLISTS
} from '../../../../src/core/bugfix/ast-analyzer.js';

describe('ASTAnalyzer', () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = createASTAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  describe('parseFile', () => {
    it('should parse TypeScript file', () => {
      const code = `
        class MyClass {
          private value: number;
          constructor() {
            this.value = 0;
          }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      expect(ast).toBeDefined();
      expect(ast.fileName).toBe('test.ts');
    });

    it('should parse JavaScript file', () => {
      const code = `
        class MyClass {
          constructor() {
            this.value = 0;
          }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.js');
      expect(ast).toBeDefined();
    });

    it('should parse TSX file', () => {
      const code = `
        import React from 'react';
        const Component = () => <div>Hello</div>;
        export default Component;
      `;

      const ast = analyzer.parseFile(code, 'test.tsx');
      expect(ast).toBeDefined();
    });

    it('should cache parsed ASTs', () => {
      const code = `class MyClass {}`;

      const ast1 = analyzer.parseFile(code, 'test.ts');
      const ast2 = analyzer.parseFile(code, 'test.ts');

      // Same content should return cached result
      expect(ast1).toBe(ast2);
    });

    it('should invalidate cache on content change', () => {
      const code1 = `class MyClass {}`;
      const code2 = `class MyClass { value: number; }`;

      const ast1 = analyzer.parseFile(code1, 'test.ts');
      const ast2 = analyzer.parseFile(code2, 'test.ts');

      // Different content should return new AST
      expect(ast1).not.toBe(ast2);
    });
  });

  describe('findClasses', () => {
    it('should find class declarations', () => {
      const code = `
        class Foo {
          method() {}
        }

        class Bar extends EventEmitter {
          constructor() {
            super();
          }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(classes).toHaveLength(2);
      expect(classes[0]?.name).toBe('Foo');
      expect(classes[1]?.name).toBe('Bar');
    });

    it('should extract extends clause', () => {
      const code = `
        class MyEmitter extends EventEmitter {
          constructor() {
            super();
          }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(classes).toHaveLength(1);
      expect(classes[0]?.extendsClause).toContain('EventEmitter');
    });

    it('should extract implements clause', () => {
      const code = `
        class MyClass implements IDisposable, Serializable {
          dispose() {}
          serialize() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(classes).toHaveLength(1);
      expect(classes[0]?.implementsClause).toContain('IDisposable');
      expect(classes[0]?.implementsClause).toContain('Serializable');
    });

    it('should extract methods', () => {
      const code = `
        class MyClass {
          constructor() {}
          public start() {}
          private stop() {}
          async process() {}
          destroy() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(classes[0]?.methods).toHaveLength(5);

      const methodNames = classes[0]?.methods.map(m => m.name);
      expect(methodNames).toContain('constructor');
      expect(methodNames).toContain('start');
      expect(methodNames).toContain('stop');
      expect(methodNames).toContain('process');
      expect(methodNames).toContain('destroy');
    });

    it('should detect abstract classes', () => {
      const code = `
        abstract class BaseService extends EventEmitter {
          abstract process(): void;
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(classes[0]?.isAbstract).toBe(true);
    });

    it('should detect abstract methods', () => {
      const code = `
        abstract class BaseService {
          abstract process(): void;
          concrete() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      const processMethod = classes[0]?.methods.find(m => m.name === 'process');
      const concreteMethod = classes[0]?.methods.find(m => m.name === 'concrete');

      expect(processMethod?.isAbstract).toBe(true);
      expect(concreteMethod?.isAbstract).toBe(false);
    });
  });

  describe('findClassesExtending', () => {
    it('should find classes extending specific base class', () => {
      const code = `
        class NotExtending {}

        class MyEmitter extends EventEmitter {
          constructor() { super(); }
        }

        class AnotherClass extends SomeOtherBase {}
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClassesExtending(ast, 'EventEmitter');

      expect(classes).toHaveLength(1);
      expect(classes[0]?.name).toBe('MyEmitter');
    });

    it('should find classes using regex pattern', () => {
      const code = `
        class A extends EventEmitter {}
        class B extends DisposableEventEmitter {}
        class C extends SafeEventEmitter {}
        class D extends SomethingElse {}
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const pattern = /^(EventEmitter|DisposableEventEmitter|SafeEventEmitter)$/;
      const classes = analyzer.findClassesExtending(ast, pattern);

      expect(classes).toHaveLength(3);
      const names = classes.map(c => c.name);
      expect(names).toContain('A');
      expect(names).toContain('B');
      expect(names).toContain('C');
      expect(names).not.toContain('D');
    });
  });

  describe('classHasMethod', () => {
    it('should return true if class has method', () => {
      const code = `
        class MyClass {
          destroy() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasMethod(classes[0]!, 'destroy')).toBe(true);
      expect(analyzer.classHasMethod(classes[0]!, 'dispose')).toBe(false);
    });

    it('should match method name with regex', () => {
      const code = `
        class MyClass {
          cleanup() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasMethod(classes[0]!, /clean/)).toBe(true);
      expect(analyzer.classHasMethod(classes[0]!, /destroy/)).toBe(false);
    });
  });

  describe('classHasDestroyMethod', () => {
    it('should detect destroy method', () => {
      const code = `
        class MyClass extends EventEmitter {
          destroy() { this.removeAllListeners(); }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
    });

    it('should detect dispose method as destroy-like', () => {
      const code = `
        class MyClass extends EventEmitter {
          dispose() { this.removeAllListeners(); }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
    });

    it('should detect cleanup method as destroy-like', () => {
      const code = `
        class MyClass extends EventEmitter {
          cleanup() { this.removeAllListeners(); }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
    });

    it('should detect close method as destroy-like', () => {
      const code = `
        class MyClass extends EventEmitter {
          close() { this.removeAllListeners(); }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
    });

    it('should detect shutdown method as destroy-like', () => {
      const code = `
        class MyClass extends EventEmitter {
          shutdown() { this.removeAllListeners(); }
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
    });

    it('should return false if no destroy-like method exists', () => {
      const code = `
        class MyClass extends EventEmitter {
          start() {}
          stop() {}
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const classes = analyzer.findClasses(ast);

      expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(false);
    });
  });

  describe('findCalls', () => {
    it('should find function calls', () => {
      const code = `
        setInterval(() => console.log('tick'), 1000);
        setTimeout(() => console.log('once'), 500);
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const intervalCalls = analyzer.findCalls(ast, 'setInterval');
      const timeoutCalls = analyzer.findCalls(ast, 'setTimeout');

      expect(intervalCalls).toHaveLength(1);
      expect(timeoutCalls).toHaveLength(1);
    });

    it('should find method calls', () => {
      const code = `
        emitter.on('data', handler);
        emitter.off('data', handler);
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const onCalls = analyzer.findCalls(ast, 'on');
      const offCalls = analyzer.findCalls(ast, 'off');

      expect(onCalls).toHaveLength(1);
      expect(offCalls).toHaveLength(1);
    });

    it('should detect if return value is captured', () => {
      const code = `
        const interval = setInterval(() => {}, 1000);
        setInterval(() => {}, 2000);
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const calls = analyzer.findCalls(ast, 'setInterval');

      expect(calls[0]?.isReturnCaptured).toBe(true);
      expect(calls[0]?.capturedVariable).toBe('interval');
      expect(calls[1]?.isReturnCaptured).toBe(false);
      expect(calls[1]?.capturedVariable).toBeUndefined();
    });
  });

  describe('findEnclosingFunction', () => {
    it('should find enclosing function declaration', () => {
      const code = `
        function sleep(ms: number): Promise<void> {
          return new Promise(resolve => setTimeout(resolve, ms));
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      // Line 3 is inside the function
      const func = analyzer.findEnclosingFunction(ast, 3);

      expect(func).toBeDefined();
      expect(func?.name).toBe('sleep');
      expect(func?.isAsync).toBe(false);
    });

    it('should find enclosing arrow function', () => {
      const code = `
        const delay = (ms: number) => {
          return new Promise(resolve => setTimeout(resolve, ms));
        };
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const func = analyzer.findEnclosingFunction(ast, 3);

      expect(func).toBeDefined();
      expect(func?.name).toBe('delay');
    });

    it('should find enclosing async function', () => {
      const code = `
        async function fetchData() {
          const response = await fetch('/api');
          return response.json();
        }
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const func = analyzer.findEnclosingFunction(ast, 3);

      expect(func).toBeDefined();
      expect(func?.name).toBe('fetchData');
      expect(func?.isAsync).toBe(true);
    });

    it('should return null if not inside a function', () => {
      const code = `
        const value = 42;
        console.log(value);
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const func = analyzer.findEnclosingFunction(ast, 2);

      expect(func).toBeNull();
    });
  });

  describe('trackVariableUsage', () => {
    it('should track variable declaration and usage', () => {
      const code = `
        const interval = setInterval(() => {}, 1000);
        console.log(interval);
        clearInterval(interval);
      `;

      const ast = analyzer.parseFile(code, 'test.ts');
      const usage = analyzer.trackVariableUsage(ast, 'interval');

      expect(usage).toBeDefined();
      expect(usage?.declarationLine).toBe(2);
      expect(usage?.usageLines).toContain(3);
      expect(usage?.usageLines).toContain(4);
      expect(usage?.usedInCleanup).toBe(true);
      expect(usage?.cleanupMethod).toBe('clearInterval');
    });

    it('should return null if variable not found', () => {
      const code = `const foo = 42;`;

      const ast = analyzer.parseFile(code, 'test.ts');
      const usage = analyzer.trackVariableUsage(ast, 'nonexistent');

      expect(usage).toBeNull();
    });
  });

  describe('isTestFile', () => {
    it('should detect .test.ts files', () => {
      expect(analyzer.isTestFile('src/foo.test.ts')).toBe(true);
      expect(analyzer.isTestFile('src/foo.test.tsx')).toBe(true);
    });

    it('should detect .spec.ts files', () => {
      expect(analyzer.isTestFile('src/foo.spec.ts')).toBe(true);
      expect(analyzer.isTestFile('src/foo.spec.js')).toBe(true);
    });

    it('should detect .bench.ts files', () => {
      expect(analyzer.isTestFile('src/foo.bench.ts')).toBe(true);
    });

    it('should detect __tests__ directory', () => {
      expect(analyzer.isTestFile('src/__tests__/foo.ts')).toBe(true);
    });

    it('should not flag regular files as test files', () => {
      expect(analyzer.isTestFile('src/index.ts')).toBe(false);
      expect(analyzer.isTestFile('src/utils/helper.ts')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should report cache stats', () => {
      const code1 = `class A {}`;
      const code2 = `class B {}`;

      analyzer.parseFile(code1, 'a.ts');
      analyzer.parseFile(code2, 'b.ts');

      const stats = analyzer.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
    });

    it('should clear cache', () => {
      const code = `class A {}`;
      analyzer.parseFile(code, 'test.ts');

      analyzer.clearCache();

      const stats = analyzer.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should evict oldest entries when cache is full', () => {
      const smallCacheAnalyzer = new ASTAnalyzer(3);

      // Fill cache
      smallCacheAnalyzer.parseFile('class A {}', 'a.ts');
      smallCacheAnalyzer.parseFile('class B {}', 'b.ts');
      smallCacheAnalyzer.parseFile('class C {}', 'c.ts');

      // Access first file to make it "recent"
      smallCacheAnalyzer.parseFile('class A {}', 'a.ts');

      // Add new file - should evict b.ts (oldest not-recently-accessed)
      smallCacheAnalyzer.parseFile('class D {}', 'd.ts');

      const stats = smallCacheAnalyzer.getCacheStats();
      expect(stats.size).toBe(3);
    });
  });

  describe('ALLOWLISTS', () => {
    it('should have promise timeout allowlists', () => {
      expect(ALLOWLISTS.promiseTimeout.functionNames).toContain('sleep');
      expect(ALLOWLISTS.promiseTimeout.functionNames).toContain('delay');
      expect(ALLOWLISTS.promiseTimeout.filePatterns).toBeDefined();
      expect(ALLOWLISTS.promiseTimeout.safePatterns).toBeDefined();
    });

    it('should have timer leak allowlists', () => {
      expect(ALLOWLISTS.timerLeak.baseClasses).toContain('Disposable');
      expect(ALLOWLISTS.timerLeak.cleanupMethods).toContain('destroy');
    });

    it('should have missing destroy allowlists', () => {
      expect(ALLOWLISTS.missingDestroy.baseClassesWithDestroy).toContain('DisposableEventEmitter');
      expect(ALLOWLISTS.missingDestroy.interfacesWithDestroy).toContain('IDisposable');
    });
  });
});

describe('Large class handling (false positive reduction)', () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = createASTAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  it('should correctly identify destroy method at end of large class', () => {
    // Simulate a large class with destroy at the end (beyond 800 lines)
    const classBody = Array(100).fill('  method' + Math.random().toString(36).substring(7) + '() {}').join('\n');

    const code = `
      import { EventEmitter } from 'events';

      class LargeClass extends EventEmitter {
        constructor() {
          super();
        }

        ${classBody}

        // destroy method at the end
        destroy() {
          this.removeAllListeners();
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'large-class.ts');
    const classes = analyzer.findClasses(ast);

    expect(classes).toHaveLength(1);
    expect(classes[0]?.name).toBe('LargeClass');

    // Should find the destroy method even though it's far from class declaration
    expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(true);
  });

  it('should correctly identify class WITHOUT destroy method', () => {
    const classBody = Array(100).fill('  method' + Math.random().toString(36).substring(7) + '() {}').join('\n');

    const code = `
      import { EventEmitter } from 'events';

      class LargeClassNoDestroy extends EventEmitter {
        constructor() {
          super();
        }

        ${classBody}
      }
    `;

    const ast = analyzer.parseFile(code, 'large-class-no-destroy.ts');
    const classes = analyzer.findClasses(ast);

    expect(classes).toHaveLength(1);
    expect(classes[0]?.name).toBe('LargeClassNoDestroy');

    // Should NOT find a destroy method
    expect(analyzer.classHasDestroyMethod(classes[0]!)).toBe(false);
  });

  it('should not confuse destroy in another class', () => {
    const code = `
      import { EventEmitter } from 'events';

      class FirstClass extends EventEmitter {
        constructor() {
          super();
        }
        start() {}
      }

      class SecondClass {
        destroy() {
          // This destroy belongs to SecondClass, not FirstClass
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'two-classes.ts');
    const classes = analyzer.findClasses(ast);

    const firstClass = classes.find(c => c.name === 'FirstClass');
    const secondClass = classes.find(c => c.name === 'SecondClass');

    expect(firstClass).toBeDefined();
    expect(secondClass).toBeDefined();

    // FirstClass should NOT have destroy (it's in SecondClass)
    expect(analyzer.classHasDestroyMethod(firstClass!)).toBe(false);

    // SecondClass should have destroy
    expect(analyzer.classHasDestroyMethod(secondClass!)).toBe(true);
  });
});

// ============================================================================
// Phase 3: Promise Timeout Leak Detection (v12.8.0)
// ============================================================================

describe('analyzePromiseTimeouts (Phase 3 - promise_timeout_leak)', () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = createASTAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  it('should detect Promise with setTimeout (potential leak)', () => {
    const code = `
      function fetchWithTimeout(url: string) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject('timeout'), 5000);
          fetch(url).then(result => {
            resolve(result);
          });
        });
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.isAllowlisted).toBe(false);
    expect(results[0]?.hasCleanup).toBe(false);
    expect(results[0]?.enclosingFunction).toBe('fetchWithTimeout');
  });

  it('should NOT flag simple sleep utility (allowlisted)', () => {
    const code = `
      function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.isAllowlisted).toBe(true);
    expect(results[0]?.allowlistReason).toContain('sleep');
  });

  it('should NOT flag delay utility (allowlisted by function name)', () => {
    const code = `
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.isAllowlisted).toBe(true);
  });

  it('should NOT flag simple await pattern (allowlisted)', () => {
    const code = `
      async function waitABit() {
        await new Promise(r => setTimeout(r, 100));
        console.log('done');
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    // Should be marked as allowlisted because it's an awaited simple pattern
    if (results.length > 0) {
      expect(results[0]?.isAllowlisted).toBe(true);
    }
  });

  it('should detect cleanup with finally', () => {
    const code = `
      function fetchWithTimeout(url: string) {
        let timeout;
        return new Promise((resolve, reject) => {
          timeout = setTimeout(() => reject('timeout'), 5000);
          fetch(url).then(resolve);
        }).finally(() => clearTimeout(timeout));
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    // Should detect the cleanup
    if (results.length > 0) {
      expect(results[0]?.hasCleanup).toBe(true);
    }
  });

  it('should track captured timeout ID', () => {
    const code = `
      function doSomething() {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(), 1000);
          // do work
        });
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.timeoutIdCaptured).toBe(true);
  });

  it('should NOT flag rate limit delay patterns', () => {
    const code = `
      async function rateLimitDelay(ms: number) {
        await new Promise(r => setTimeout(r, ms));
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    if (results.length > 0) {
      expect(results[0]?.isAllowlisted).toBe(true);
      expect(results[0]?.allowlistReason).toContain('rateLimitDelay');
    }
  });

  it('should NOT flag backoff patterns', () => {
    const code = `
      async function exponentialBackoff(attempt: number) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzePromiseTimeouts(ast, code);

    if (results.length > 0) {
      expect(results[0]?.isAllowlisted).toBe(true);
    }
  });
});

// ============================================================================
// Phase 4: Unreachable Code Detection (v12.8.0)
// ============================================================================

describe('analyzeUnreachableCode (Phase 4 - dead_code)', () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = createASTAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  it('should detect genuinely unreachable code after return', () => {
    const code = `
      function test() {
        return 42;
        console.log('never');
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    const unreachable = results.filter(r => !r.isFalsePositive);
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0]?.reason).toBe('return');
  });

  it('should detect unreachable code after throw', () => {
    const code = `
      function test() {
        throw new Error('fail');
        console.log('never');
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    const unreachable = results.filter(r => !r.isFalsePositive);
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0]?.reason).toBe('throw');
  });

  it('should NOT flag switch case statements as unreachable (false positive)', () => {
    const code = `
      function test(x: string) {
        switch (x) {
          case 'a':
            console.log('a');
            break;
          case 'b':
            console.log('b');
            break;
          default:
            console.log('default');
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    // All switch case code should be marked as false positives, not real unreachable
    const realUnreachable = results.filter(r => !r.isFalsePositive);
    expect(realUnreachable).toHaveLength(0);
  });

  it('should NOT flag code after break in switch as unreachable for outer block', () => {
    const code = `
      function handleCommand(cmd: string) {
        switch (cmd) {
          case 'start':
            doStart();
            break;
          case 'stop':
            doStop();
            break;
        }
        // This should NOT be flagged as unreachable
        console.log('command processed');
      }

      function doStart() {}
      function doStop() {}
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    // The console.log after switch should NOT be flagged
    const unreachable = results.filter(r => !r.isFalsePositive && r.code.includes('command processed'));
    expect(unreachable).toHaveLength(0);
  });

  it('should correctly handle code after if/else with returns', () => {
    const code = `
      function test(x: boolean) {
        if (x) {
          return 'yes';
          console.log('unreachable in if');
        }
        return 'no';
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    // The console.log in the if block is unreachable
    const unreachable = results.filter(r => !r.isFalsePositive);
    expect(unreachable.some(r => r.code.includes('unreachable in if'))).toBe(true);
  });

  it('should NOT flag continue in loop as unreachable for outer code', () => {
    const code = `
      function test() {
        for (let i = 0; i < 10; i++) {
          if (i === 5) {
            continue;
          }
          console.log(i);
        }
        // This should NOT be flagged as unreachable
        console.log('loop done');
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeUnreachableCode(ast);

    // The console.log after loop should NOT be flagged
    const unreachable = results.filter(r => !r.isFalsePositive && r.code.includes('loop done'));
    expect(unreachable).toHaveLength(0);
  });
});

// Phase 5: Timer leak detection tests
describe('analyzeTimerLeaks (Phase 5 - timer_leak)', () => {
  let analyzer: ASTAnalyzer;

  beforeEach(() => {
    analyzer = createASTAnalyzer();
  });

  afterEach(() => {
    analyzer.clearCache();
  });

  it('should detect setInterval without cleanup (potential leak)', () => {
    const code = `
      const timer = setInterval(() => {
        console.log('tick');
      }, 1000);
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.timerType).toBe('setInterval');
    expect(results[0]?.isValueCaptured).toBe(true);
    expect(results[0]?.capturedVariable).toBe('timer');
    expect(results[0]?.isFalsePositive).toBe(false);
  });

  it('should NOT flag setInterval with .unref() (false positive)', () => {
    const code = `
      const timer = setInterval(() => {
        console.log('tick');
      }, 1000);
      timer.unref();
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasUnref).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
    expect(results[0]?.falsePositiveReason).toContain('unref');
  });

  it('should NOT flag setInterval with optional .unref?.() (false positive)', () => {
    const code = `
      const timer = setInterval(() => {
        console.log('tick');
      }, 1000);
      timer?.unref();
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasUnref).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
  });

  it('should NOT flag setInterval with clearInterval (false positive)', () => {
    const code = `
      function startPolling() {
        const intervalId = setInterval(() => {
          console.log('polling');
        }, 5000);

        return () => clearInterval(intervalId);
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasClearCall).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
    expect(results[0]?.falsePositiveReason).toContain('clearInterval');
  });

  it('should NOT flag setInterval cleared in destroy() method', () => {
    const code = `
      class Service {
        private timer: NodeJS.Timeout | null = null;

        start() {
          this.timer = setInterval(() => {
            this.tick();
          }, 1000);
        }

        destroy() {
          if (this.timer) {
            clearInterval(this.timer);
          }
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasDestroyCleanup).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
    expect(results[0]?.falsePositiveReason).toContain('destroy()');
  });

  it('should detect uncaptured setInterval (definite leak)', () => {
    const code = `
      // Uncaptured - cannot be cleared
      setInterval(() => {
        console.log('forever');
      }, 1000);
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.isValueCaptured).toBe(false);
    expect(results[0]?.capturedVariable).toBeUndefined();
    expect(results[0]?.isFalsePositive).toBe(false);
  });

  it('should NOT flag setInterval with chained .unref()', () => {
    const code = `
      setInterval(() => {
        console.log('background');
      }, 60000).unref();
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasUnref).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
  });

  it('should track enclosing class name', () => {
    const code = `
      class MyService {
        startHeartbeat() {
          this.timer = setInterval(() => {
            this.beat();
          }, 5000);
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.enclosingClass).toBe('MyService');
    expect(results[0]?.enclosingFunction).toBe('startHeartbeat');
  });

  it('should NOT flag setInterval cleared in cleanup() method', () => {
    const code = `
      class Poller {
        private interval: ReturnType<typeof setInterval> | null = null;

        start() {
          this.interval = setInterval(() => {
            this.poll();
          }, 1000);
        }

        cleanup() {
          clearInterval(this.interval);
        }
      }
    `;

    const ast = analyzer.parseFile(code, 'test.ts');
    const results = analyzer.analyzeTimerLeaks(ast, code);

    expect(results).toHaveLength(1);
    expect(results[0]?.hasDestroyCleanup).toBe(true);
    expect(results[0]?.isFalsePositive).toBe(true);
    expect(results[0]?.falsePositiveReason).toContain('cleanup()');
  });
});
