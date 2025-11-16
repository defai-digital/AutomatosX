/**
 * Tests for LintFormatter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LintFormatter } from '../src/lint-formatter.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

describe('LintFormatter', () => {
  let lintFormatter: LintFormatter;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    lintFormatter = new LintFormatter(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Linter Detection', () => {
    it('should detect ESLint when eslint is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          eslint: '^8.0.0'
        }
      }));

      const linter = await lintFormatter.detectLinter();

      expect(linter).toBeDefined();
      expect(linter?.name).toBe('eslint');
      expect(linter?.command).toBe('eslint');
    });

    it('should detect StandardJS when standard is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          standard: '^17.0.0'
        }
      }));

      const linter = await lintFormatter.detectLinter();

      expect(linter).toBeDefined();
      expect(linter?.name).toBe('standard');
      expect(linter?.command).toBe('standard');
    });

    it('should find ESLint config file', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.endsWith('package.json') || pathStr.endsWith('.eslintrc.js');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          eslint: '^8.0.0'
        }
      }));

      const linter = await lintFormatter.detectLinter();

      expect(linter?.configFile).toBe('.eslintrc.js');
    });

    it('should return null when no linter is found', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {},
        devDependencies: {}
      }));

      const linter = await lintFormatter.detectLinter();

      expect(linter).toBeNull();
    });

    it('should return null when package.json does not exist', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      const linter = await lintFormatter.detectLinter();

      expect(linter).toBeNull();
    });
  });

  describe('Formatter Detection', () => {
    it('should detect Prettier when prettier is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          prettier: '^3.0.0'
        }
      }));

      const formatter = await lintFormatter.detectFormatter();

      expect(formatter).toBeDefined();
      expect(formatter?.name).toBe('prettier');
      expect(formatter?.command).toBe('prettier');
    });

    it('should detect dprint when dprint is in dependencies', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path.toString().endsWith('package.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          dprint: '^0.40.0'
        }
      }));

      const formatter = await lintFormatter.detectFormatter();

      expect(formatter).toBeDefined();
      expect(formatter?.name).toBe('dprint');
      expect(formatter?.command).toBe('dprint');
    });

    it('should find Prettier config file', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        const pathStr = path.toString();
        return pathStr.endsWith('package.json') || pathStr.endsWith('.prettierrc');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        devDependencies: {
          prettier: '^3.0.0'
        }
      }));

      const formatter = await lintFormatter.detectFormatter();

      expect(formatter?.configFile).toBe('.prettierrc');
    });

    it('should return null when no formatter is found', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        dependencies: {},
        devDependencies: {}
      }));

      const formatter = await lintFormatter.detectFormatter();

      expect(formatter).toBeNull();
    });
  });

  describe('Lint Output Parsing', () => {
    it('should parse ESLint JSON output correctly', () => {
      const output = JSON.stringify([
        {
          filePath: '/src/index.ts',
          errorCount: 2,
          warningCount: 1,
          messages: [
            {
              line: 10,
              column: 5,
              severity: 2,
              message: 'Unexpected var, use let or const instead',
              ruleId: 'no-var'
            },
            {
              line: 15,
              column: 10,
              severity: 1,
              message: 'Missing semicolon',
              ruleId: 'semi'
            },
            {
              line: 20,
              column: 3,
              severity: 2,
              message: 'Unused variable',
              ruleId: 'no-unused-vars'
            }
          ]
        }
      ]);

      const results = lintFormatter['parseLintOutput'](output, 'eslint');

      expect(results.linter).toBe('eslint');
      expect(results.totalErrors).toBe(2);
      expect(results.totalWarnings).toBe(1);
      expect(results.files).toHaveLength(1);
      expect(results.files[0]?.file).toBe('/src/index.ts');
      expect(results.files[0]?.messages).toHaveLength(3);
      expect(results.files[0]?.messages[0]?.severity).toBe('error');
      expect(results.files[0]?.messages[1]?.severity).toBe('warning');
    });

    it('should parse ESLint output with multiple files', () => {
      const output = JSON.stringify([
        {
          filePath: '/src/index.ts',
          errorCount: 1,
          warningCount: 0,
          messages: [
            {
              line: 5,
              column: 1,
              severity: 2,
              message: 'Error 1',
              ruleId: 'rule-1'
            }
          ]
        },
        {
          filePath: '/src/utils.ts',
          errorCount: 0,
          warningCount: 2,
          messages: [
            {
              line: 10,
              column: 5,
              severity: 1,
              message: 'Warning 1',
              ruleId: 'rule-2'
            },
            {
              line: 15,
              column: 3,
              severity: 1,
              message: 'Warning 2',
              ruleId: 'rule-3'
            }
          ]
        }
      ]);

      const results = lintFormatter['parseLintOutput'](output, 'eslint');

      expect(results.totalErrors).toBe(1);
      expect(results.totalWarnings).toBe(2);
      expect(results.files).toHaveLength(2);
    });

    it('should handle files with no errors or warnings', () => {
      const output = JSON.stringify([
        {
          filePath: '/src/index.ts',
          errorCount: 0,
          warningCount: 0,
          messages: []
        }
      ]);

      const results = lintFormatter['parseLintOutput'](output, 'eslint');

      expect(results.totalErrors).toBe(0);
      expect(results.totalWarnings).toBe(0);
      expect(results.files).toHaveLength(0); // Files with no issues are not included
    });

    it('should handle invalid JSON gracefully', () => {
      const output = 'Invalid JSON output';

      const results = lintFormatter['parseLintOutput'](output, 'eslint');

      expect(results.totalErrors).toBe(0);
      expect(results.totalWarnings).toBe(0);
      expect(results.files).toHaveLength(0);
    });

    it('should parse text-based lint output', () => {
      const output = `
/src/index.ts
  10:5  error  Unexpected var, use let or const instead  no-var
  15:10 warning Missing semicolon  semi

✖ 2 problems (1 error, 1 warning)
      `.trim();

      const results = lintFormatter['parseLintOutput'](output, 'eslint');

      // Should extract error and warning counts from text
      expect(results.totalErrors).toBe(1);
      expect(results.totalWarnings).toBe(1);
    });
  });

  describe('Format Output Parsing', () => {
    it('should parse Prettier check mode output correctly', () => {
      const output = `
Checking formatting...
src/index.ts
src/utils.ts
      `.trim();

      const results = lintFormatter['parseFormatOutput'](output, 'prettier', true);

      expect(results.formatted).toContain('src/index.ts');
      expect(results.formatted).toContain('src/utils.ts');
      expect(results.formatted).toHaveLength(2);
    });

    it('should parse Prettier write mode output correctly', () => {
      const output = `
src/index.ts 200ms
src/utils.ts 150ms
      `.trim();

      const results = lintFormatter['parseFormatOutput'](output, 'prettier', false);

      expect(results.formatted).toContain('src/index.ts 200ms');
      expect(results.formatted).toContain('src/utils.ts 150ms');
    });

    it('should handle empty format output', () => {
      const output = 'All matched files use Prettier code style!';

      const results = lintFormatter['parseFormatOutput'](output, 'prettier', true);

      expect(results.formatted).toHaveLength(0);
      expect(results.unchanged).toHaveLength(0);
    });
  });

  describe('Build Lint Arguments', () => {
    it('should build ESLint arguments correctly', () => {
      const options = {
        files: ['src/'],
        fix: false,
        quiet: false
      };

      const args = lintFormatter['buildLintArgs']({ name: 'eslint', command: 'eslint' }, options);

      expect(args).toContain('src/');
      expect(args).toContain('--format');
      expect(args).toContain('json');
      expect(args).not.toContain('--fix');
      expect(args).not.toContain('--quiet');
    });

    it('should build ESLint arguments with fix option', () => {
      const options = {
        fix: true,
        quiet: true
      };

      const args = lintFormatter['buildLintArgs']({ name: 'eslint', command: 'eslint' }, options);

      expect(args).toContain('--fix');
      expect(args).toContain('--quiet');
    });

    it('should build StandardJS arguments correctly', () => {
      const options = {
        fix: true
      };

      const args = lintFormatter['buildLintArgs']({ name: 'standard', command: 'standard' }, options);

      expect(args).toContain('--fix');
    });

    it('should replace dot with specific files', () => {
      const options = {
        files: ['src/index.ts', 'src/utils.ts']
      };

      const args = lintFormatter['buildLintArgs']({ name: 'eslint', command: 'eslint' }, options);

      expect(args).not.toContain('.');
      expect(args).toContain('src/index.ts');
      expect(args).toContain('src/utils.ts');
    });
  });

  describe('Build Format Arguments', () => {
    it('should build Prettier arguments for check mode', () => {
      const options = {
        check: true
      };

      const args = lintFormatter['buildFormatArgs']({ name: 'prettier', command: 'prettier' }, options);

      expect(args).toContain('--check');
      expect(args).not.toContain('--write');
      expect(args).toContain('.');
    });

    it('should build Prettier arguments for write mode', () => {
      const options = {
        write: true
      };

      const args = lintFormatter['buildFormatArgs']({ name: 'prettier', command: 'prettier' }, options);

      expect(args).toContain('--write');
      expect(args).not.toContain('--check');
    });

    it('should build dprint arguments for check mode', () => {
      const options = {
        check: true
      };

      const args = lintFormatter['buildFormatArgs']({ name: 'dprint', command: 'dprint' }, options);

      expect(args).toContain('check');
      expect(args).not.toContain('fmt');
    });

    it('should build dprint arguments for format mode', () => {
      const options = {
        check: false
      };

      const args = lintFormatter['buildFormatArgs']({ name: 'dprint', command: 'dprint' }, options);

      expect(args).toContain('fmt');
      expect(args).not.toContain('check');
    });

    it('should replace dot with specific files for Prettier', () => {
      const options = {
        files: ['src/index.ts', 'src/utils.ts'],
        write: true
      };

      const args = lintFormatter['buildFormatArgs']({ name: 'prettier', command: 'prettier' }, options);

      expect(args).not.toContain('.');
      expect(args).toContain('src/index.ts');
      expect(args).toContain('src/utils.ts');
    });
  });
});
