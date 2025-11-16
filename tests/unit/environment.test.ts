/**
 * Unit tests for Environment Detection (src/utils/environment.ts)
 *
 * Tests environment detection logic for AI IDEs and mock provider decisions.
 * Addresses QA review requirement for v5.3.5 release.
 *
 * @see tmp/QA-REVIEW-WINDOWS-FIX.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isClaudeCodeEnvironment,
  isCursorEnvironment,
  isVSCodeCopilotEnvironment,
  isAIIDEEnvironment,
  getEnvironmentName,
  shouldAutoEnableMockProviders,
  getProviderSuggestion
} from '@/utils/environment.js';

describe('Environment Detection', () => {
  // Store original env to restore after each test
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isClaudeCodeEnvironment', () => {
    it('should detect CLAUDE_CODE=true', () => {
      process.env.CLAUDE_CODE = 'true';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should detect CLAUDE_DESKTOP=true', () => {
      process.env.CLAUDE_DESKTOP = 'true';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should detect MCP_SERVER=true', () => {
      process.env.MCP_SERVER = 'true';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should detect claude in parent process name (Unix)', () => {
      process.env._ = '/usr/local/bin/claude-desktop';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should detect Claude in parent process name (case insensitive)', () => {
      process.env._ = '/Applications/Claude.app/Contents/MacOS/Claude';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    // REMOVED (v6.5.12 Bug #125): ANTHROPIC_API_KEY is NOT a reliable indicator
    // This was causing false positives - API key can be set in any environment

    it('should return false when no indicators present', () => {
      delete process.env.CLAUDE_CODE;
      delete process.env.CLAUDE_DESKTOP;
      delete process.env.MCP_SERVER;
      delete process.env._;
      delete process.env.ComSpec;
      delete process.env.ANTHROPIC_API_KEY;
      expect(isClaudeCodeEnvironment()).toBe(false);
    });

    it('should handle undefined environment variables gracefully', () => {
      process.env = {};
      expect(() => isClaudeCodeEnvironment()).not.toThrow();
      expect(isClaudeCodeEnvironment()).toBe(false);
    });

    it('should handle ComSpec on Windows', () => {
      process.env.ComSpec = 'C:\\Windows\\System32\\cmd.exe';
      // This should NOT match (ComSpec typically doesn't contain 'claude')
      expect(isClaudeCodeEnvironment()).toBe(false);
    });
  });

  describe('isCursorEnvironment', () => {
    it('should detect CURSOR=true', () => {
      process.env.CURSOR = 'true';
      expect(isCursorEnvironment()).toBe(true);
    });

    it('should detect CURSOR_IDE=true', () => {
      process.env.CURSOR_IDE = 'true';
      expect(isCursorEnvironment()).toBe(true);
    });

    it('should detect cursor in parent process name', () => {
      process.env._ = '/Applications/Cursor.app/Contents/MacOS/Cursor';
      expect(isCursorEnvironment()).toBe(true);
    });

    it('should return false when no indicators present', () => {
      delete process.env.CURSOR;
      delete process.env.CURSOR_IDE;
      delete process.env._;
      expect(isCursorEnvironment()).toBe(false);
    });
  });

  describe('isVSCodeCopilotEnvironment', () => {
    it('should detect VS Code with Copilot (VSCODE_PID + GITHUB_COPILOT)', () => {
      process.env.VSCODE_PID = '12345';
      process.env.GITHUB_COPILOT = 'true';
      expect(isVSCodeCopilotEnvironment()).toBe(true);
    });

    it('should detect COPILOT=true alone', () => {
      process.env.COPILOT = 'true';
      expect(isVSCodeCopilotEnvironment()).toBe(true);
    });

    it('should return false with only VSCODE_PID (no Copilot)', () => {
      process.env.VSCODE_PID = '12345';
      delete process.env.GITHUB_COPILOT;
      delete process.env.COPILOT;
      expect(isVSCodeCopilotEnvironment()).toBe(false);
    });

    it('should return false when no indicators present', () => {
      delete process.env.VSCODE_PID;
      delete process.env.GITHUB_COPILOT;
      delete process.env.COPILOT;
      expect(isVSCodeCopilotEnvironment()).toBe(false);
    });
  });

  describe('isAIIDEEnvironment', () => {
    it('should return true for Claude Code', () => {
      process.env.CLAUDE_CODE = 'true';
      expect(isAIIDEEnvironment()).toBe(true);
    });

    it('should return true for Cursor', () => {
      process.env.CURSOR = 'true';
      expect(isAIIDEEnvironment()).toBe(true);
    });

    it('should return true for VS Code + Copilot', () => {
      process.env.COPILOT = 'true';
      expect(isAIIDEEnvironment()).toBe(true);
    });

    it('should return false for standalone CLI', () => {
      delete process.env.CLAUDE_CODE;
      delete process.env.CLAUDE_DESKTOP;
      delete process.env.MCP_SERVER;
      delete process.env.CURSOR;
      delete process.env.CURSOR_IDE;
      delete process.env.COPILOT;
      delete process.env.VSCODE_PID;
      delete process.env._;
      delete process.env.ANTHROPIC_API_KEY;
      expect(isAIIDEEnvironment()).toBe(false);
    });

    it('should handle multiple environment indicators (priority)', () => {
      process.env.CLAUDE_CODE = 'true';
      process.env.CURSOR = 'true';
      // Should detect as AI IDE regardless of which one
      expect(isAIIDEEnvironment()).toBe(true);
    });
  });

  describe('getEnvironmentName', () => {
    it('should return "Claude Code" for Claude environment', () => {
      process.env.CLAUDE_CODE = 'true';
      expect(getEnvironmentName()).toBe('Claude Code');
    });

    it('should return "Cursor" for Cursor environment', () => {
      process.env.CURSOR = 'true';
      expect(getEnvironmentName()).toBe('Cursor');
    });

    it('should return "VS Code + Copilot" for VS Code environment', () => {
      process.env.COPILOT = 'true';
      expect(getEnvironmentName()).toBe('VS Code + Copilot');
    });

    it('should return "Standalone CLI" for no AI IDE detected', () => {
      delete process.env.CLAUDE_CODE;
      delete process.env.CURSOR;
      delete process.env.COPILOT;
      delete process.env._;
      delete process.env.ANTHROPIC_API_KEY;
      expect(getEnvironmentName()).toBe('Standalone CLI');
    });

    it('should prioritize Claude Code over others', () => {
      process.env.CLAUDE_CODE = 'true';
      process.env.CURSOR = 'true';
      process.env.COPILOT = 'true';
      // Claude Code should be returned first
      expect(getEnvironmentName()).toBe('Claude Code');
    });
  });

  describe('shouldAutoEnableMockProviders', () => {
    it('should return true when AUTOMATOSX_MOCK_PROVIDERS=true', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
      delete process.env.CLAUDE_CODE;
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should return true when AUTOMATOSX_MOCK_PROVIDERS=1', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = '1';
      delete process.env.CLAUDE_CODE;
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should return false when AUTOMATOSX_MOCK_PROVIDERS=false', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'false';
      process.env.CLAUDE_CODE = 'true'; // Even in AI IDE
      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    it('should return false when AUTOMATOSX_MOCK_PROVIDERS=0', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = '0';
      process.env.CLAUDE_CODE = 'true'; // Even in AI IDE
      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    it('should auto-enable in Claude Code environment (no explicit value)', () => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
      process.env.CLAUDE_CODE = 'true';
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should auto-enable in Cursor environment (no explicit value)', () => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
      process.env.CURSOR = 'true';
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should auto-enable in VS Code + Copilot environment (no explicit value)', () => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
      process.env.COPILOT = 'true';
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should return false in standalone CLI mode (no explicit value)', () => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
      delete process.env.CLAUDE_CODE;
      delete process.env.CURSOR;
      delete process.env.COPILOT;
      delete process.env._;
      delete process.env.ANTHROPIC_API_KEY;
      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    it('should prioritize explicit false over auto-detection', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'false';
      process.env.CLAUDE_CODE = 'true';
      process.env.CURSOR = 'true';
      process.env.COPILOT = 'true';
      // User explicitly disabled, respect their choice
      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    it('should prioritize explicit true over standalone mode', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
      delete process.env.CLAUDE_CODE;
      delete process.env.CURSOR;
      delete process.env.COPILOT;
      delete process.env._;
      // User explicitly enabled, respect their choice
      expect(shouldAutoEnableMockProviders()).toBe(true);
    });
  });

  describe('getProviderSuggestion', () => {
    it('should provide AI IDE suggestions in Claude Code', () => {
      process.env.CLAUDE_CODE = 'true';
      const suggestion = getProviderSuggestion('claude');

      expect(suggestion).toContain('Running inside Claude Code');
      expect(suggestion).toContain('set AUTOMATOSX_MOCK_PROVIDERS=true');
      expect(suggestion).toContain('$env:AUTOMATOSX_MOCK_PROVIDERS="true"');
      expect(suggestion).not.toContain('npm install');
    });

    it('should provide AI IDE suggestions in Cursor', () => {
      process.env.CURSOR = 'true';
      const suggestion = getProviderSuggestion('gemini');

      expect(suggestion).toContain('Running inside Cursor');
      expect(suggestion).toContain('mock providers');
    });

    it('should provide installation instructions in standalone mode', () => {
      delete process.env.CLAUDE_CODE;
      delete process.env.CURSOR;
      delete process.env.COPILOT;
      delete process.env._;
      delete process.env.ANTHROPIC_API_KEY;

      const suggestion = getProviderSuggestion('claude');

      expect(suggestion).toContain('Install claude CLI');
      expect(suggestion).toContain('npm install -g @anthropic-ai/claude-cli');
      expect(suggestion).toContain('npm install -g @google-ai/gemini-cli');
      expect(suggestion).toContain('npm install -g @openai/codex-cli');
      expect(suggestion).not.toContain('Running inside');
    });

    it('should include provider name in installation instructions', () => {
      delete process.env.CLAUDE_CODE;
      const suggestion = getProviderSuggestion('gemini');

      expect(suggestion).toContain('gemini');
    });

    it('should suggest mock providers as fallback in standalone', () => {
      delete process.env.CLAUDE_CODE;
      const suggestion = getProviderSuggestion('claude');

      expect(suggestion).toContain('mock providers for testing');
      expect(suggestion).toContain('set AUTOMATOSX_MOCK_PROVIDERS=true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty environment object', () => {
      process.env = {};
      expect(() => {
        isClaudeCodeEnvironment();
        isCursorEnvironment();
        isVSCodeCopilotEnvironment();
        isAIIDEEnvironment();
        getEnvironmentName();
        shouldAutoEnableMockProviders();
        getProviderSuggestion('claude');
      }).not.toThrow();
    });

    it('should handle partial string matches in parent process', () => {
      // Should match 'claude' substring
      process.env._ = '/usr/bin/myclaude-script.sh';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should handle mixed case environment variables', () => {
      process.env._ = '/Applications/CLAUDE.app/Contents/MacOS/CLAUDE';
      expect(isClaudeCodeEnvironment()).toBe(true);
    });

    it('should handle truthy but non-"true" values', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'yes';
      // Should not match (only 'true' or '1' are valid)
      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    // REMOVED (v6.5.12 Bug #125): ANTHROPIC_API_KEY tests removed
    // API key is not a reliable environment indicator
  });

  describe('Priority System', () => {
    it('should respect explicit false over AI IDE detection', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'false';
      process.env.CLAUDE_CODE = 'true';

      expect(shouldAutoEnableMockProviders()).toBe(false);
    });

    it('should respect explicit true over standalone detection', () => {
      process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
      delete process.env.CLAUDE_CODE;
      delete process.env._;

      expect(shouldAutoEnableMockProviders()).toBe(true);
    });

    it('should auto-enable only when no explicit value and AI IDE detected', () => {
      delete process.env.AUTOMATOSX_MOCK_PROVIDERS;
      process.env.CLAUDE_CODE = 'true';

      expect(shouldAutoEnableMockProviders()).toBe(true);
    });
  });
});
