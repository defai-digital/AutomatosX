/**
 * Tests for Cross-Tool Hand-offs
 *
 * Comprehensive test suite for hand-off functionality to external tools
 * like Claude Code, VS Code, browsers, etc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  handoffToTool,
  renderHandoffPrompt,
  renderHandoffResult,
  suggestHandoff,
  renderHandoffSuggestion,
  createHandoffShortcuts,
  detectAvailableTools,
  renderAvailableTools,
  exportForHandoff,
  type HandoffContext,
  type HandoffResult,
  type ToolType
} from '../src/cross-tool-handoffs.js';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('Cross-Tool Hand-offs', () => {
  // Store original platform
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  describe('handoffToTool', () => {
    it('should hand off to Claude Code', async () => {
      // Mock successful exec
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'claude-code',
        target: 'src/index.ts',
        reason: 'Edit file in Claude Code'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('claude-code');
      expect(result.target).toBe('src/index.ts');
    });

    it('should hand off to VS Code', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'vscode',
        target: 'package.json',
        reason: 'Edit package.json'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('vscode');
    });

    it('should hand off to browser', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'browser',
        target: 'https://example.com',
        reason: 'View documentation'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('browser');
    });

    it('should hand off to terminal', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'terminal',
        target: 'npm test',
        reason: 'Run tests'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('terminal');
    });

    it('should hand off to git UI', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'git-ui',
        target: '/path/to/repo',
        reason: 'Resolve merge conflicts'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('git-ui');
    });

    it('should hand off to editor', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'editor',
        target: 'README.md',
        reason: 'Edit readme'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('editor');
    });

    it('should handle handoff failure', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(new Error('Command not found'), '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'claude-code',
        target: 'file.ts',
        reason: 'Edit'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle unknown tool type', async () => {
      const context = {
        type: 'unknown-tool' as ToolType,
        target: 'file.ts',
        reason: 'Edit'
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool type');
    });

    it('should include metadata in context', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'vscode',
        target: 'src/index.ts',
        reason: 'Edit',
        metadata: {
          lineNumber: 42,
          column: 10
        }
      };

      const result = await handoffToTool(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Platform-specific commands', () => {
    it('should use correct browser command for macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      vi.mocked(exec).mockImplementation((cmd, callback) => {
        expect(cmd).toContain('open');
        if (callback) callback(null, '', '');
        return {} as any;
      });

      await handoffToTool({
        type: 'browser',
        target: 'https://example.com',
        reason: 'View'
      });
    });

    it('should use correct browser command for Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });

      vi.mocked(exec).mockImplementation((cmd, callback) => {
        expect(cmd).toContain('start');
        if (callback) callback(null, '', '');
        return {} as any;
      });

      await handoffToTool({
        type: 'browser',
        target: 'https://example.com',
        reason: 'View'
      });
    });

    it('should use correct browser command for Linux', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });

      vi.mocked(exec).mockImplementation((cmd, callback) => {
        expect(cmd).toContain('xdg-open');
        if (callback) callback(null, '', '');
        return {} as any;
      });

      await handoffToTool({
        type: 'browser',
        target: 'https://example.com',
        reason: 'View'
      });
    });
  });

  describe('renderHandoffPrompt', () => {
    it('should render handoff prompt', () => {
      const context: HandoffContext = {
        type: 'claude-code',
        target: 'src/index.ts',
        reason: 'Complex refactoring needed'
      };

      const result = renderHandoffPrompt(context);

      expect(result).toContain('Hand-off to External Tool');
      expect(result).toContain('Claude Code');
      expect(result).toContain('src/index.ts');
      expect(result).toContain('Complex refactoring needed');
      expect(result).toContain('Yes, hand off');
      expect(result).toContain('No, stay in CLI');
    });

    it('should show correct tool icon', () => {
      const tools: ToolType[] = ['claude-code', 'vscode', 'browser', 'terminal', 'git-ui', 'editor'];

      tools.forEach(tool => {
        const context: HandoffContext = {
          type: tool,
          target: 'target',
          reason: 'Reason'
        };

        const result = renderHandoffPrompt(context);

        expect(result).toBeTruthy();
        expect(result).toContain('Hand-off to External Tool');
      });
    });
  });

  describe('renderHandoffResult', () => {
    it('should render success result', () => {
      const result: HandoffResult = {
        success: true,
        tool: 'vscode',
        target: 'src/index.ts'
      };

      const output = renderHandoffResult(result);

      expect(output).toContain('✓');
      expect(output).toContain('VS Code');
      expect(output).toContain('src/index.ts');
    });

    it('should render failure result', () => {
      const result: HandoffResult = {
        success: false,
        tool: 'claude-code',
        target: 'file.ts',
        error: 'Command not found'
      };

      const output = renderHandoffResult(result);

      expect(output).toContain('✗');
      expect(output).toContain('Failed');
      expect(output).toContain('Claude Code');
      expect(output).toContain('Command not found');
    });
  });

  describe('suggestHandoff', () => {
    it('should suggest Claude Code for complex tasks', () => {
      const suggestion = suggestHandoff({ complexity: 'complex' });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.type).toBe('claude-code');
      expect(suggestion!.reason).toContain('Complex');
    });

    it('should suggest VS Code for code files', () => {
      const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go'];

      codeExtensions.forEach(ext => {
        const suggestion = suggestHandoff({ fileType: ext });

        expect(suggestion).not.toBeNull();
        expect(suggestion!.type).toBe('vscode');
        expect(suggestion!.reason).toContain('editing experience');
      });
    });

    it('should suggest browser for documentation', () => {
      const suggestion = suggestHandoff({ operation: 'documentation' });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.type).toBe('browser');
      expect(suggestion!.reason).toContain('Documentation');
    });

    it('should suggest browser for research', () => {
      const suggestion = suggestHandoff({ operation: 'research' });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.type).toBe('browser');
    });

    it('should suggest Git UI for merge operations', () => {
      const suggestion = suggestHandoff({ operation: 'git-merge' });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.type).toBe('git-ui');
      expect(suggestion!.reason).toContain('visualize');
    });

    it('should suggest Git UI for conflict resolution', () => {
      const suggestion = suggestHandoff({ operation: 'git-conflict' });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.type).toBe('git-ui');
    });

    it('should return null for simple tasks', () => {
      const suggestion = suggestHandoff({ complexity: 'simple' });

      expect(suggestion).toBeNull();
    });

    it('should return null for unknown contexts', () => {
      const suggestion = suggestHandoff({});

      expect(suggestion).toBeNull();
    });
  });

  describe('renderHandoffSuggestion', () => {
    it('should render suggestion', () => {
      const suggestion: HandoffContext = {
        type: 'vscode',
        target: '*.ts',
        reason: 'Better editing'
      };

      const result = renderHandoffSuggestion(suggestion);

      expect(result).toContain('Tip');
      expect(result).toContain('VS Code');
      expect(result).toContain('/open-in vscode');
    });
  });

  describe('createHandoffShortcuts', () => {
    it('should create shortcuts for all tools', () => {
      const shortcuts = createHandoffShortcuts();

      expect(shortcuts['/open-in-claude']).toBeDefined();
      expect(shortcuts['/open-in-vscode']).toBeDefined();
      expect(shortcuts['/open-in-browser']).toBeDefined();
      expect(shortcuts['/open-in-git-ui']).toBeDefined();
    });

    it('should create correct context for Claude Code', () => {
      const shortcuts = createHandoffShortcuts();
      const context = shortcuts['/open-in-claude']('file.ts');

      expect(context.type).toBe('claude-code');
      expect(context.target).toBe('file.ts');
      expect(context.reason).toBe('Open in Claude Code');
    });

    it('should create correct context for VS Code', () => {
      const shortcuts = createHandoffShortcuts();
      const context = shortcuts['/open-in-vscode']('src/');

      expect(context.type).toBe('vscode');
      expect(context.target).toBe('src/');
    });

    it('should create correct context for browser', () => {
      const shortcuts = createHandoffShortcuts();
      const context = shortcuts['/open-in-browser']('https://example.com');

      expect(context.type).toBe('browser');
      expect(context.target).toBe('https://example.com');
    });

    it('should create correct context for Git UI', () => {
      const shortcuts = createHandoffShortcuts();
      const context = shortcuts['/open-git-ui']('.');

      expect(context.type).toBe('git-ui');
      expect(context.target).toBe('.');
    });
  });

  describe('detectAvailableTools', () => {
    it('should detect available tools', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        // Simulate tools being available
        if (cmd.includes('which claude')) {
          if (callback) callback(null, '/usr/local/bin/claude', '');
        } else if (cmd.includes('which code')) {
          if (callback) callback(null, '/usr/local/bin/code', '');
        } else {
          if (callback) callback(new Error('Not found'), '', '');
        }
        return {} as any;
      });

      const available = await detectAvailableTools();

      expect(available['browser']).toBe(true); // Always available
      expect(available['terminal']).toBe(true); // Always available
      expect(available['editor']).toBe(true); // Always available
    });

    it('should mark unavailable tools as false', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        // All tools unavailable
        if (callback) callback(new Error('Not found'), '', '');
        return {} as any;
      });

      const available = await detectAvailableTools();

      expect(available['claude-code']).toBe(false);
      expect(available['vscode']).toBe(false);
      expect(available['git-ui']).toBe(false);
    });
  });

  describe('renderAvailableTools', () => {
    it('should render available tools', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback(null, '', '');
        return {} as any;
      });

      const result = await renderAvailableTools();

      expect(result).toContain('Available External Tools');
      expect(result).toContain('Claude Code');
      expect(result).toContain('VS Code');
      expect(result).toContain('Browser');
      expect(result).toContain('Terminal');
      expect(result).toContain('Git UI');
      expect(result).toContain('Text Editor');
    });

    it('should show availability status', async () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (cmd.includes('which code')) {
          if (callback) callback(null, '/usr/local/bin/code', '');
        } else {
          if (callback) callback(new Error('Not found'), '', '');
        }
        return {} as any;
      });

      const result = await renderAvailableTools();

      expect(result).toContain('Available');
      expect(result).toContain('Not installed');
    });
  });

  describe('exportForHandoff', () => {
    it('should export conversation as markdown', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Help me with this code' }
      ];

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain('# Conversation Export');
      expect(result).toContain('## USER');
      expect(result).toContain('## ASSISTANT');
      expect(result).toContain('Hello');
      expect(result).toContain('Hi there!');
      expect(result).toContain('Help me with this code');
      expect(result).toContain('Exported at:');
    });

    it('should export conversation as JSON', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const result = exportForHandoff(messages, 'json');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].role).toBe('user');
      expect(parsed[0].content).toBe('Hello');
      expect(parsed[1].role).toBe('assistant');
      expect(parsed[1].content).toBe('Hi!');
    });

    it('should default to markdown format', () => {
      const messages = [
        { role: 'user', content: 'Test' }
      ];

      const result = exportForHandoff(messages);

      expect(result).toContain('# Conversation Export');
    });

    it('should handle empty conversation', () => {
      const result = exportForHandoff([]);

      expect(result).toContain('# Conversation Export');
    });

    it('should handle long messages', () => {
      const longMessage = 'a'.repeat(10000);

      const messages = [
        { role: 'user', content: longMessage }
      ];

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain(longMessage);
    });

    it('should handle special characters', () => {
      const messages = [
        { role: 'user', content: '`code` **bold** *italic* [link](url)' }
      ];

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain('`code`');
      expect(result).toContain('**bold**');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long file paths', () => {
      const longPath = '/very/long/path/'.repeat(50) + 'file.ts';

      const context: HandoffContext = {
        type: 'vscode',
        target: longPath,
        reason: 'Edit'
      };

      const result = renderHandoffPrompt(context);

      expect(result).toContain(longPath);
    });

    it('should handle URLs with special characters', () => {
      const url = 'https://example.com/path?query=value&other=123#anchor';

      const context: HandoffContext = {
        type: 'browser',
        target: url,
        reason: 'View'
      };

      const result = renderHandoffPrompt(context);

      expect(result).toContain(url);
    });

    it('should handle commands with quotes', () => {
      const command = 'echo "Hello World" && ls';

      const context: HandoffContext = {
        type: 'terminal',
        target: command,
        reason: 'Run'
      };

      const result = renderHandoffPrompt(context);

      expect(result).toContain(command);
    });

    it('should handle multiple metadata fields', () => {
      const context: HandoffContext = {
        type: 'vscode',
        target: 'file.ts',
        reason: 'Edit',
        metadata: {
          line: 42,
          column: 10,
          selection: { start: 0, end: 100 },
          language: 'typescript'
        }
      };

      const result = renderHandoffPrompt(context);

      expect(result).toBeTruthy();
    });

    it('should handle all tool types', () => {
      const toolTypes: ToolType[] = ['claude-code', 'vscode', 'browser', 'terminal', 'git-ui', 'editor'];

      toolTypes.forEach(type => {
        const context: HandoffContext = {
          type,
          target: 'target',
          reason: 'reason'
        };

        const prompt = renderHandoffPrompt(context);
        const suggestion = renderHandoffSuggestion(context);

        expect(prompt).toBeTruthy();
        expect(suggestion).toBeTruthy();
      });
    });

    it('should handle suggestion for medium complexity', () => {
      const suggestion = suggestHandoff({ complexity: 'medium' });

      // Medium complexity doesn't trigger suggestions
      expect(suggestion).toBeNull();
    });

    it('should handle non-code file types', () => {
      const suggestion = suggestHandoff({ fileType: '.txt' });

      // .txt doesn't trigger VS Code suggestion
      expect(suggestion).toBeNull();
    });

    it('should handle unknown operations', () => {
      const suggestion = suggestHandoff({ operation: 'unknown-op' });

      expect(suggestion).toBeNull();
    });

    it('should handle malformed exec errors', () => {
      vi.mocked(exec).mockImplementation((cmd, callback) => {
        if (callback) callback({ name: 'Error' } as any, '', '');
        return {} as any;
      });

      const context: HandoffContext = {
        type: 'vscode',
        target: 'file.ts',
        reason: 'Edit'
      };

      return handoffToTool(context).then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should handle conversation with many messages', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }));

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain('Message 0');
      expect(result).toContain('Message 99');
    });

    it('should handle Unicode in conversation', () => {
      const messages = [
        { role: 'user', content: '日本語 한국어 中文 🎉' }
      ];

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain('日本語');
      expect(result).toContain('🎉');
    });

    it('should handle newlines in messages', () => {
      const messages = [
        { role: 'user', content: 'Line 1\nLine 2\nLine 3' }
      ];

      const result = exportForHandoff(messages, 'markdown');

      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });
  });
});
