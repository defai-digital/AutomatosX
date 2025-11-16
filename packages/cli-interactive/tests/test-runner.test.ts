/**
 * Tests for TestRunner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestRunner } from '../src/test-runner.js';
import { existsSync } from 'fs';
import { join } from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

describe('TestRunner', () => {
  let testRunner: TestRunner;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    testRunner = new TestRunner(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Framework Detection', () => {
    it('should detect Vitest when vitest is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          vitest: '^1.0.0'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('vitest');
      expect(framework?.command).toBe('vitest');
    });

    it('should detect Jest when jest is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          jest: '^29.0.0'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('jest');
      expect(framework?.command).toBe('jest');
    });

    it('should detect Mocha when mocha is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          mocha: '^10.0.0'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('mocha');
      expect(framework?.command).toBe('mocha');
    });

    it('should detect AVA when ava is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          ava: '^5.0.0'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('ava');
      expect(framework?.command).toBe('ava');
    });

    it('should detect Node.js native test from test script', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        scripts: {
          test: 'node --test'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('node');
      expect(framework?.command).toBe('node');
    });

    it('should return null when no test framework is found', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {},
        devDependencies: {}
      }));

      const framework = await testRunner.detectFramework();

      expect(framework).toBeNull();
    });

    it('should return null when package.json does not exist', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      const framework = await testRunner.detectFramework();

      expect(framework).toBeNull();
    });

    it('should return null when package.json is invalid JSON', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json{');

      const framework = await testRunner.detectFramework();

      expect(framework).toBeNull();
    });

    it('should prioritize Vitest over Jest', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          vitest: '^1.0.0',
          jest: '^29.0.0'
        }
      }));

      const framework = await testRunner.detectFramework();

      expect(framework?.name).toBe('vitest');
    });
  });

  describe('Test Output Parsing', () => {
    it('should parse Jest test output correctly', () => {
      const output = `
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        2.5 s
      `.trim();

      const results = testRunner['parseTestOutput'](output, 'jest');

      expect(results.framework).toBe('jest');
      expect(results.passed).toBe(15);
      expect(results.failed).toBe(0);
      expect(results.skipped).toBe(0);
      expect(results.total).toBe(15);
      expect(results.duration).toBeCloseTo(2.5);
    });

    it('should parse Vitest test output correctly', () => {
      const output = `
Test Files  4 passed (4)
     Tests  23 passed (23)
  Start at  12:34:56
  Duration  1.8s
      `.trim();

      const results = testRunner['parseTestOutput'](output, 'vitest');

      expect(results.framework).toBe('vitest');
      expect(results.passed).toBe(23);
      expect(results.total).toBe(23);
      expect(results.duration).toBeCloseTo(1.8);
    });

    it('should parse Mocha test output correctly', () => {
      const output = `
  25 passing (450ms)
  3 pending
      `.trim();

      const results = testRunner['parseTestOutput'](output, 'mocha');

      expect(results.framework).toBe('mocha');
      expect(results.passed).toBe(25);
      expect(results.skipped).toBe(3);
      expect(results.total).toBe(28);
      expect(results.duration).toBeCloseTo(0.45);
    });

    it('should parse test failures correctly', () => {
      const output = `
Tests:       10 passed, 5 failed, 15 total
      `.trim();

      const results = testRunner['parseTestOutput'](output, 'jest');

      expect(results.passed).toBe(10);
      expect(results.failed).toBe(5);
      expect(results.total).toBe(15);
    });

    it('should parse skipped tests correctly', () => {
      const output = `
Tests:       10 passed, 2 failed, 3 skipped, 15 total
      `.trim();

      const results = testRunner['parseTestOutput'](output, 'jest');

      expect(results.passed).toBe(10);
      expect(results.failed).toBe(2);
      expect(results.skipped).toBe(3);
      expect(results.total).toBe(15);
    });

    it('should handle output with no test results', () => {
      const output = 'No tests found';

      const results = testRunner['parseTestOutput'](output, 'jest');

      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.total).toBe(0);
    });
  });

  describe('Coverage Output Parsing', () => {
    it('should parse Istanbul/c8 coverage output correctly', () => {
      const output = `
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   85.5  |   78.2   |   92.1  |   86.3  |
 src/               |   90.0  |   82.5   |   95.0  |   91.2  |
  index.ts          |   88.5  |   80.0   |   90.0  |   89.0  | 45-52,67
--------------------|---------|----------|---------|---------|-------------------

Statements   : 85.5% ( 1234/1443 )
Branches     : 78.2% ( 456/583 )
Functions    : 92.1% ( 234/254 )
Lines        : 86.3% ( 1198/1388 )
      `.trim();

      const results = testRunner['parseCoverageOutput'](output, 'jest');

      expect(results.statements.percentage).toBeCloseTo(85.5);
      expect(results.statements.covered).toBe(1234);
      expect(results.statements.total).toBe(1443);

      expect(results.branches.percentage).toBeCloseTo(78.2);
      expect(results.branches.covered).toBe(456);
      expect(results.branches.total).toBe(583);

      expect(results.functions.percentage).toBeCloseTo(92.1);
      expect(results.functions.covered).toBe(234);
      expect(results.functions.total).toBe(254);

      expect(results.lines.percentage).toBeCloseTo(86.3);
      expect(results.lines.covered).toBe(1198);
      expect(results.lines.total).toBe(1388);
    });

    it('should handle coverage output with no coverage data', () => {
      const output = 'No coverage data available';

      const results = testRunner['parseCoverageOutput'](output, 'jest');

      expect(results.statements.percentage).toBe(0);
      expect(results.branches.percentage).toBe(0);
      expect(results.functions.percentage).toBe(0);
      expect(results.lines.percentage).toBe(0);
    });

    it('should parse coverage with 100% coverage', () => {
      const output = `
Statements   : 100% ( 500/500 )
Branches     : 100% ( 200/200 )
Functions    : 100% ( 100/100 )
Lines        : 100% ( 450/450 )
      `.trim();

      const results = testRunner['parseCoverageOutput'](output, 'jest');

      expect(results.statements.percentage).toBe(100);
      expect(results.statements.covered).toBe(500);
      expect(results.statements.total).toBe(500);
    });

    it('should parse coverage with low coverage', () => {
      const output = `
Statements   : 42.5% ( 100/235 )
Branches     : 35.0% ( 50/143 )
Functions    : 50.0% ( 25/50 )
Lines        : 45.2% ( 95/210 )
      `.trim();

      const results = testRunner['parseCoverageOutput'](output, 'jest');

      expect(results.statements.percentage).toBeCloseTo(42.5);
      expect(results.branches.percentage).toBeCloseTo(35.0);
      expect(results.functions.percentage).toBeCloseTo(50.0);
      expect(results.lines.percentage).toBeCloseTo(45.2);
    });
  });

  describe('Build Test Arguments', () => {
    it('should build Vitest arguments correctly', () => {
      const options = {
        files: ['src/test.ts'],
        watch: false,
        coverage: true,
        filter: 'auth'
      };

      const args = testRunner['buildTestArgs']({ name: 'vitest', command: 'vitest' }, options);

      expect(args).toContain('run');
      expect(args).toContain('--coverage');
      expect(args).toContain('--grep');
      expect(args).toContain('auth');
      expect(args).toContain('src/test.ts');
      expect(args).not.toContain('--watch');
    });

    it('should build Jest arguments correctly with watch mode', () => {
      const options = {
        watch: true,
        verbose: true
      };

      const args = testRunner['buildTestArgs']({ name: 'jest', command: 'jest' }, options);

      expect(args).toContain('--watch');
      expect(args).toContain('--verbose');
    });

    it('should build Mocha arguments correctly', () => {
      const options = {
        filter: 'login',
        files: ['test/auth.test.js']
      };

      const args = testRunner['buildTestArgs']({ name: 'mocha', command: 'mocha' }, options);

      expect(args).toContain('--grep');
      expect(args).toContain('login');
      expect(args).toContain('test/auth.test.js');
    });

    it('should build Node.js test arguments correctly', () => {
      const options = {};

      const args = testRunner['buildTestArgs']({ name: 'node', command: 'node' }, options);

      expect(args).toContain('--test');
    });
  });

  describe('Build Coverage Arguments', () => {
    it('should build Vitest coverage arguments correctly', () => {
      const options = { files: ['src/'] };

      const args = testRunner['buildCoverageArgs']({ name: 'vitest', command: 'vitest' }, options);

      expect(args).toContain('run');
      expect(args).toContain('--coverage');
      expect(args).toContain('src/');
    });

    it('should build Jest coverage arguments correctly', () => {
      const options = {};

      const args = testRunner['buildCoverageArgs']({ name: 'jest', command: 'jest' }, options);

      expect(args).toContain('--coverage');
    });

    it('should include files in coverage arguments', () => {
      const options = { files: ['src/utils/', 'src/core/'] };

      const args = testRunner['buildCoverageArgs']({ name: 'jest', command: 'jest' }, options);

      expect(args).toContain('src/utils/');
      expect(args).toContain('src/core/');
    });
  });
});
