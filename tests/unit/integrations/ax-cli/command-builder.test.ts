/**
 * Unit tests for AxCliCommandBuilder (v10.0.0)
 *
 * Updated for v11.3.3: Tests now use ANSI-C quoting ($'...') format
 */

import { describe, it, expect } from 'vitest';
import { AxCliCommandBuilder } from '../../../../src/integrations/ax-cli/command-builder.js';

describe('AxCliCommandBuilder', () => {
  const builder = new AxCliCommandBuilder();

  describe('build', () => {
    it('should build basic command with prompt', () => {
      const result = builder.build('test prompt', {});

      expect(result.command).toBe('ax-cli');
      expect(result.args).toContain('-p');
      expect(result.args).toContain("$'test prompt'");  // ANSI-C quoting
      expect(result.fullCommand).toContain("ax-cli -p $'test prompt'");
    });

    it('should include model flag when provided', () => {
      const result = builder.build('test', { model: 'glm-4.6' });

      expect(result.args).toContain('--model');
      expect(result.args).toContain("$'glm-4.6'");  // ANSI-C quoting
    });

    it('should include API key when provided', () => {
      const result = builder.build('test', { apiKey: 'test-key-123' });

      expect(result.args).toContain('--api-key');
      expect(result.args).toContain("$'test-key-123'");  // ANSI-C quoting
    });

    it('should include base URL when provided', () => {
      const result = builder.build('test', { baseUrl: 'https://api.example.com' });

      expect(result.args).toContain('--base-url');
      expect(result.args).toContain("$'https://api.example.com'");  // ANSI-C quoting
    });

    it('should include directory when provided', () => {
      const result = builder.build('test', { directory: '/path/to/dir' });

      expect(result.args).toContain('--directory');
      expect(result.args).toContain("$'/path/to/dir'");  // ANSI-C quoting
    });

    it('should include max tool rounds when provided', () => {
      const result = builder.build('test', { maxToolRounds: 100 });

      expect(result.args).toContain('--max-tool-rounds');
      expect(result.args).toContain('100');
    });

    it('should build command with all options', () => {
      const result = builder.build('complex prompt', {
        model: 'grok-2',
        apiKey: 'key-123',
        baseUrl: 'https://api.x.ai',
        directory: '/workspace',
        maxToolRounds: 200
      });

      expect(result.args).toContain('-p');
      expect(result.args).toContain('--model');
      expect(result.args).toContain('--api-key');
      expect(result.args).toContain('--base-url');
      expect(result.args).toContain('--directory');
      expect(result.args).toContain('--max-tool-rounds');
    });

    it('should escape single quotes in prompt (ANSI-C quoting)', () => {
      const result = builder.build("prompt with 'quotes'", {});

      // In ANSI-C quoting, single quotes become \'
      expect(result.args[1]).toContain("\\'");
    });

    it('should escape backslashes in prompt', () => {
      const result = builder.build('path\\to\\file', {});

      expect(result.args[1]).toContain('\\\\');
    });

    it('should not escape dollar signs in ANSI-C quoting', () => {
      // In ANSI-C quoting ($'...'), dollar signs don't need escaping
      // (they're not interpreted as variable expansion)
      const result = builder.build('variable $HOME', {});

      // Dollar sign preserved as-is in ANSI-C quoting
      expect(result.args[1]).toContain('$HOME');
    });

    it('should not escape backticks in ANSI-C quoting', () => {
      // In ANSI-C quoting ($'...'), backticks don't need escaping
      const result = builder.build('command `ls`', {});

      // Backticks preserved as-is
      expect(result.args[1]).toContain('`ls`');
    });

    it('should handle empty prompt', () => {
      const result = builder.build('', {});

      expect(result.args).toContain('-p');
      expect(result.args).toContain("$''");  // ANSI-C empty string
    });

    it('should handle multiline prompts with escaped newlines', () => {
      const result = builder.build('line 1\nline 2\nline 3', {});

      // Newlines are escaped to \\n in ANSI-C quoting
      expect(result.args[1]).toContain('line 1\\nline 2\\nline 3');
    });
  });

  describe('v2.5.1+ IDE integration features', () => {
    it('should include --json flag when json option is true', () => {
      const result = builder.build('test', { json: true });

      expect(result.args).toContain('--json');
    });

    it('should not include --json flag when json option is false', () => {
      const result = builder.build('test', { json: false });

      expect(result.args).not.toContain('--json');
    });

    it('should include --file flag with path when file option provided', () => {
      const result = builder.build('test', { file: 'src/app.ts' });

      expect(result.args).toContain('--file');
      expect(result.args).toContain("$'src/app.ts'");  // ANSI-C quoting
    });

    it('should include --selection flag with escaped text when selection provided', () => {
      const result = builder.build('test', { selection: "const foo = 'bar'" });

      expect(result.args).toContain('--selection');
      // In ANSI-C quoting, single quotes are escaped
      const selectionIndex = result.args.indexOf('--selection');
      expect(result.args[selectionIndex + 1]).toContain("\\'");
    });

    it('should include --line-range flag when lineRange provided', () => {
      const result = builder.build('test', { lineRange: '10-20' });

      expect(result.args).toContain('--line-range');
      expect(result.args).toContain("$'10-20'");  // ANSI-C quoting
    });

    it('should include --git-diff flag when gitDiff is true', () => {
      const result = builder.build('test', { gitDiff: true });

      expect(result.args).toContain('--git-diff');
    });

    it('should not include --git-diff flag when gitDiff is false', () => {
      const result = builder.build('test', { gitDiff: false });

      expect(result.args).not.toContain('--git-diff');
    });

    it('should include --vscode flag when vscode is true', () => {
      const result = builder.build('test', { vscode: true });

      expect(result.args).toContain('--vscode');
    });

    it('should build command with all v2.5.1 IDE features', () => {
      const result = builder.build('analyze code', {
        model: 'grok-2',
        json: true,
        file: 'src/components/App.tsx',
        selection: 'const [state, setState] = useState()',
        lineRange: '42-56',
        gitDiff: true,
        vscode: true
      });

      expect(result.args).toContain('--model');
      expect(result.args).toContain("$'grok-2'");  // ANSI-C quoting
      expect(result.args).toContain('--json');
      expect(result.args).toContain('--file');
      expect(result.args).toContain("$'src/components/App.tsx'");  // ANSI-C quoting
      expect(result.args).toContain('--selection');
      expect(result.args).toContain('--line-range');
      expect(result.args).toContain("$'42-56'");  // ANSI-C quoting
      expect(result.args).toContain('--git-diff');
      expect(result.args).toContain('--vscode');
    });

    it('should escape special characters in selection text (ANSI-C quoting)', () => {
      const result = builder.build('test', {
        selection: "const path = 'C:\\Users\\test'; const x = 'foo'"
      });

      const selectionIndex = result.args.indexOf('--selection');
      const escapedSelection = result.args[selectionIndex + 1];

      expect(escapedSelection).toContain('\\\\'); // Escaped backslashes
      expect(escapedSelection).toContain("\\'");  // Escaped single quotes (ANSI-C quoting)
    });
  });

  // Bug #11 fix: Prompt length validation
  describe('prompt length validation', () => {
    it('should reject prompts exceeding MAX_PROMPT_LENGTH', () => {
      // Create a prompt longer than 1MB (MAX_PROMPT_LENGTH)
      const longPrompt = 'x'.repeat(1024 * 1024 + 1);

      // Should throw error about prompt being too long
      expect(() => builder.build(longPrompt, {})).toThrow(/Prompt too long/);
    });

    it('should accept prompts at exactly MAX_PROMPT_LENGTH', () => {
      // Create a prompt at exactly 1MB
      const maxPrompt = 'x'.repeat(1024 * 1024);

      // Should build successfully
      const result = builder.build(maxPrompt, {});
      expect(result.command).toBe('ax-cli');
    });

    it('should accept normal-length prompts', () => {
      const prompt = 'This is a normal prompt with reasonable length';

      const result = builder.build(prompt, {});
      expect(result.args).toContain('-p');
    });
  });

  describe('buildEnv', () => {
    it('should return empty object when no options provided', () => {
      const env = builder.buildEnv({});

      expect(env).toBeNull();
    });

    it('should set YOUR_API_KEY when apiKey provided', () => {
      const env = builder.buildEnv({ apiKey: 'test-key' });

      expect(env).not.toBeNull();
      expect(env!.YOUR_API_KEY).toBe('test-key');
    });

    it('should set AI_BASE_URL when baseUrl provided', () => {
      const env = builder.buildEnv({ baseUrl: 'https://api.test.com' });

      expect(env).not.toBeNull();
      expect(env!.AI_BASE_URL).toBe('https://api.test.com');
    });

    it('should set AI_MODEL when model provided', () => {
      const env = builder.buildEnv({ model: 'grok-2' });

      expect(env).not.toBeNull();
      expect(env!.AI_MODEL).toBe('grok-2');
    });

    it('should set all env vars when all options provided', () => {
      const env = builder.buildEnv({
        apiKey: 'key-123',
        baseUrl: 'https://api.test.com',
        model: 'glm-4.6'
      });

      expect(env).not.toBeNull();
      expect(env!.YOUR_API_KEY).toBe('key-123');
      expect(env!.AI_BASE_URL).toBe('https://api.test.com');
      expect(env!.AI_MODEL).toBe('glm-4.6');
    });
  });
});
