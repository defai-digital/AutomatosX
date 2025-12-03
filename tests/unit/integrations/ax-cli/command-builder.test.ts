/**
 * Unit tests for AxCliCommandBuilder (v10.0.0)
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
      expect(result.args).toContain('"test prompt"');
      expect(result.fullCommand).toContain('ax-cli -p "test prompt"');
    });

    it('should include model flag when provided', () => {
      const result = builder.build('test', { model: 'glm-4.6' });

      expect(result.args).toContain('--model');
      expect(result.args).toContain('"glm-4.6"');  // Now escaped for shell safety
    });

    it('should include API key when provided', () => {
      const result = builder.build('test', { apiKey: 'test-key-123' });

      expect(result.args).toContain('--api-key');
      expect(result.args).toContain('"test-key-123"');  // Now escaped for shell safety
    });

    it('should include base URL when provided', () => {
      const result = builder.build('test', { baseUrl: 'https://api.example.com' });

      expect(result.args).toContain('--base-url');
      expect(result.args).toContain('"https://api.example.com"');  // Now escaped for shell safety
    });

    it('should include directory when provided', () => {
      const result = builder.build('test', { directory: '/path/to/dir' });

      expect(result.args).toContain('--directory');
      expect(result.args).toContain('"/path/to/dir"');  // Escaped
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

    it('should escape double quotes in prompt', () => {
      const result = builder.build('prompt with "quotes"', {});

      expect(result.args[1]).toContain('\\"');
      expect(result.args[1]).not.toContain('with "quotes"');
    });

    it('should escape backslashes in prompt', () => {
      const result = builder.build('path\\to\\file', {});

      expect(result.args[1]).toContain('\\\\');
    });

    it('should escape dollar signs in prompt', () => {
      const result = builder.build('variable $HOME', {});

      expect(result.args[1]).toContain('\\$');
    });

    it('should escape backticks in prompt', () => {
      const result = builder.build('command `ls`', {});

      expect(result.args[1]).toContain('\\`');
    });

    it('should handle empty prompt', () => {
      const result = builder.build('', {});

      expect(result.args).toContain('-p');
      expect(result.args).toContain('""');
    });

    it('should handle multiline prompts', () => {
      const result = builder.build('line 1\nline 2\nline 3', {});

      expect(result.args[1]).toContain('line 1');
      expect(result.args[1]).toContain('line 2');
      expect(result.args[1]).toContain('line 3');
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
      expect(result.args).toContain('"src/app.ts"');  // Escaped
    });

    it('should include --selection flag with escaped text when selection provided', () => {
      const result = builder.build('test', { selection: 'const foo = "bar"' });

      expect(result.args).toContain('--selection');
      // Should be escaped
      const selectionIndex = result.args.indexOf('--selection');
      expect(result.args[selectionIndex + 1]).toContain('\\"');
    });

    it('should include --line-range flag when lineRange provided', () => {
      const result = builder.build('test', { lineRange: '10-20' });

      expect(result.args).toContain('--line-range');
      expect(result.args).toContain('"10-20"');  // Now escaped for shell safety
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
      expect(result.args).toContain('"grok-2"');  // Now escaped for shell safety
      expect(result.args).toContain('--json');
      expect(result.args).toContain('--file');
      expect(result.args).toContain('"src/components/App.tsx"');  // Escaped
      expect(result.args).toContain('--selection');
      expect(result.args).toContain('--line-range');
      expect(result.args).toContain('"42-56"');  // Now escaped for shell safety
      expect(result.args).toContain('--git-diff');
      expect(result.args).toContain('--vscode');
    });

    it('should escape special characters in selection text', () => {
      const result = builder.build('test', {
        selection: 'const path = "C:\\Users\\test"; const cmd = `echo $HOME`'
      });

      const selectionIndex = result.args.indexOf('--selection');
      const escapedSelection = result.args[selectionIndex + 1];

      expect(escapedSelection).toContain('\\\\'); // Escaped backslashes
      expect(escapedSelection).toContain('\\"');  // Escaped quotes
      expect(escapedSelection).toContain('\\`');  // Escaped backticks
      expect(escapedSelection).toContain('\\$');  // Escaped dollar signs
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

      expect(env).toEqual({});
    });

    it('should set YOUR_API_KEY when apiKey provided', () => {
      const env = builder.buildEnv({ apiKey: 'test-key' });

      expect(env.YOUR_API_KEY).toBe('test-key');
    });

    it('should set AI_BASE_URL when baseUrl provided', () => {
      const env = builder.buildEnv({ baseUrl: 'https://api.test.com' });

      expect(env.AI_BASE_URL).toBe('https://api.test.com');
    });

    it('should set AI_MODEL when model provided', () => {
      const env = builder.buildEnv({ model: 'grok-2' });

      expect(env.AI_MODEL).toBe('grok-2');
    });

    it('should set all env vars when all options provided', () => {
      const env = builder.buildEnv({
        apiKey: 'key-123',
        baseUrl: 'https://api.test.com',
        model: 'glm-4.6'
      });

      expect(env.YOUR_API_KEY).toBe('key-123');
      expect(env.AI_BASE_URL).toBe('https://api.test.com');
      expect(env.AI_MODEL).toBe('glm-4.6');
    });
  });
});
