/**
 * File Reader Utilities Unit Tests
 *
 * Tests for Claude Code file reading and writing utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import {
  getGlobalConfigPath,
  getProjectConfigPath,
  getGlobalCommandsPath,
  getProjectCommandsPath,
  getProjectMCPPath,
  fileExists,
  readJsonFile,
  writeJsonFile,
  readMarkdownFile,
  extractMarkdownDescription,
} from '../../../../src/integrations/claude-code/utils/file-reader.js';
import { ClaudeCodeError, ClaudeCodeErrorType } from '../../../../src/integrations/claude-code/types.js';
import { homedir } from 'os';
import { join } from 'path';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('file-reader utilities', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('getGlobalConfigPath', () => {
    it('should return path to global config in home directory', () => {
      const path = getGlobalConfigPath();
      expect(path).toBe(join(homedir(), '.claude', 'config.json'));
    });
  });

  describe('getProjectConfigPath', () => {
    it('should return path relative to project directory', () => {
      const path = getProjectConfigPath('/my/project');
      expect(path).toBe(join('/my/project', '.claude', 'config.json'));
    });

    it('should use cwd when no project directory provided', () => {
      const path = getProjectConfigPath();
      expect(path).toBe(join(process.cwd(), '.claude', 'config.json'));
    });
  });

  describe('getGlobalCommandsPath', () => {
    it('should return path to global commands in home directory', () => {
      const path = getGlobalCommandsPath();
      expect(path).toBe(join(homedir(), '.claude', 'commands'));
    });
  });

  describe('getProjectCommandsPath', () => {
    it('should return path relative to project directory', () => {
      const path = getProjectCommandsPath('/my/project');
      expect(path).toBe(join('/my/project', '.claude', 'commands'));
    });

    it('should use cwd when no project directory provided', () => {
      const path = getProjectCommandsPath();
      expect(path).toBe(join(process.cwd(), '.claude', 'commands'));
    });
  });

  describe('getProjectMCPPath', () => {
    it('should return path relative to project directory', () => {
      const path = getProjectMCPPath('/my/project');
      expect(path).toBe(join('/my/project', '.claude', 'mcp'));
    });

    it('should use cwd when no project directory provided', () => {
      const path = getProjectMCPPath();
      expect(path).toBe(join(process.cwd(), '.claude', 'mcp'));
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      vol.fromJSON({
        '/test/file.txt': 'content',
      });

      const exists = await fileExists('/test/file.txt');
      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      vol.fromJSON({
        '/test': null,
      });

      const exists = await fileExists('/test/nonexistent.txt');
      expect(exists).toBe(false);
    });

    it('should return true for directories', async () => {
      vol.fromJSON({
        '/test/subdir/file.txt': 'content',
      });

      const exists = await fileExists('/test/subdir');
      expect(exists).toBe(true);
    });
  });

  describe('readJsonFile', () => {
    it('should read and parse valid JSON file', async () => {
      const data = { name: 'test', value: 42, nested: { key: 'value' } };
      vol.fromJSON({
        '/test/data.json': JSON.stringify(data),
      });

      const result = await readJsonFile('/test/data.json');
      expect(result).toEqual(data);
    });

    it('should throw ClaudeCodeError with INVALID_CONFIG for invalid JSON', async () => {
      vol.fromJSON({
        '/test/invalid.json': '{ invalid json }',
      });

      try {
        await readJsonFile('/test/invalid.json');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeCodeError);
        expect((error as ClaudeCodeError).type).toBe(ClaudeCodeErrorType.INVALID_CONFIG);
        expect((error as ClaudeCodeError).message).toContain('Invalid JSON');
      }
    });

    it('should throw ClaudeCodeError with FILE_ERROR for missing file', async () => {
      try {
        await readJsonFile('/nonexistent/file.json');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeCodeError);
        expect((error as ClaudeCodeError).type).toBe(ClaudeCodeErrorType.FILE_ERROR);
        expect((error as ClaudeCodeError).message).toContain('Failed to read file');
      }
    });

    it('should support generic type parameter', async () => {
      interface MyConfig {
        name: string;
        count: number;
      }

      vol.fromJSON({
        '/test/config.json': JSON.stringify({ name: 'test', count: 5 }),
      });

      const result = await readJsonFile<MyConfig>('/test/config.json');
      expect(result.name).toBe('test');
      expect(result.count).toBe(5);
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON with pretty formatting by default', async () => {
      vol.fromJSON({
        '/test': null,
      });

      const data = { key: 'value' };
      await writeJsonFile('/test/output.json', data);

      const content = vol.readFileSync('/test/output.json', 'utf-8');
      expect(content).toBe(JSON.stringify(data, null, 2));
    });

    it('should write compact JSON when pretty is false', async () => {
      vol.fromJSON({
        '/test': null,
      });

      const data = { key: 'value' };
      await writeJsonFile('/test/output.json', data, false);

      const content = vol.readFileSync('/test/output.json', 'utf-8');
      expect(content).toBe(JSON.stringify(data));
    });

    it('should throw ClaudeCodeError on write failure', async () => {
      // No directory exists - write should fail
      try {
        await writeJsonFile('/nonexistent/dir/file.json', { data: true });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeCodeError);
        expect((error as ClaudeCodeError).type).toBe(ClaudeCodeErrorType.FILE_ERROR);
        expect((error as ClaudeCodeError).message).toContain('Failed to write file');
      }
    });

    it('should overwrite existing file', async () => {
      vol.fromJSON({
        '/test/file.json': JSON.stringify({ old: true }),
      });

      await writeJsonFile('/test/file.json', { new: true });

      const content = JSON.parse(vol.readFileSync('/test/file.json', 'utf-8') as string);
      expect(content).toEqual({ new: true });
    });
  });

  describe('readMarkdownFile', () => {
    it('should read markdown file content', async () => {
      const markdown = '# Title\n\nThis is content.';
      vol.fromJSON({
        '/test/readme.md': markdown,
      });

      const content = await readMarkdownFile('/test/readme.md');
      expect(content).toBe(markdown);
    });

    it('should throw ClaudeCodeError for missing file', async () => {
      try {
        await readMarkdownFile('/nonexistent/file.md');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeCodeError);
        expect((error as ClaudeCodeError).type).toBe(ClaudeCodeErrorType.FILE_ERROR);
        expect((error as ClaudeCodeError).message).toContain('Failed to read markdown file');
      }
    });

    it('should preserve whitespace and formatting', async () => {
      const markdown = '  indented\n\ttabbed\n\nempty lines above';
      vol.fromJSON({
        '/test/file.md': markdown,
      });

      const content = await readMarkdownFile('/test/file.md');
      expect(content).toBe(markdown);
    });
  });

  describe('extractMarkdownDescription', () => {
    it('should extract H1 heading as description', () => {
      const content = '# My Title\n\nSome content here.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('My Title');
    });

    it('should trim whitespace from extracted heading', () => {
      const content = '#   Padded Title   \n\nContent.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('Padded Title');
    });

    it('should extract first paragraph when no H1 heading', () => {
      const content = 'This is the first paragraph.\n\nSecond paragraph.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('This is the first paragraph.');
    });

    it('should skip lines starting with triple backticks', () => {
      // Note: implementation only checks if line starts with ```, doesn't track code block state
      // Lines inside code blocks that don't start with ``` will be returned
      const content = '```\n```\n\nActual description.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('Actual description.');
    });

    it('should skip heading lines when looking for first paragraph', () => {
      const content = '## Not H1\n### Also not H1\nFirst actual content.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('First actual content.');
    });

    it('should return empty string for empty content', () => {
      const description = extractMarkdownDescription('');
      expect(description).toBe('');
    });

    it('should return empty string for only headings', () => {
      const content = '## H2\n### H3\n#### H4';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('');
    });

    it('should return empty string for only backtick lines', () => {
      // Only lines starting with ``` are skipped
      const content = '```\n```\n```';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('');
    });

    it('should return empty string for only whitespace', () => {
      const content = '   \n\n\t\t\n';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('');
    });

    it('should handle H1 at the start of multiline content', () => {
      const content = `# Main Title

Introduction paragraph.

## Section 1

Some section content.`;

      const description = extractMarkdownDescription(content);
      expect(description).toBe('Main Title');
    });

    it('should skip empty lines when looking for first paragraph', () => {
      const content = '\n\n\nFirst actual content.\n\nMore content.';
      const description = extractMarkdownDescription(content);
      expect(description).toBe('First actual content.');
    });
  });
});

describe('ClaudeCodeError', () => {
  it('should set error type correctly', () => {
    const error = new ClaudeCodeError(
      ClaudeCodeErrorType.FILE_ERROR,
      'Test message'
    );

    expect(error.type).toBe(ClaudeCodeErrorType.FILE_ERROR);
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('ClaudeCodeError');
  });

  it('should store details', () => {
    const error = new ClaudeCodeError(
      ClaudeCodeErrorType.INVALID_CONFIG,
      'Invalid config',
      { path: '/test', line: 42 }
    );

    expect(error.details).toEqual({ path: '/test', line: 42 });
  });

  it('should have stack trace', () => {
    const error = new ClaudeCodeError(
      ClaudeCodeErrorType.MCP_ERROR,
      'MCP failed'
    );

    expect(error.stack).toBeDefined();
  });

  it('should be instance of Error', () => {
    const error = new ClaudeCodeError(
      ClaudeCodeErrorType.VALIDATION_ERROR,
      'Validation failed'
    );

    expect(error).toBeInstanceOf(Error);
  });
});
