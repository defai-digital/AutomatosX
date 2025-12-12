/**
 * Codex Prompt Injector Unit Tests
 *
 * Tests for AGENTS.md content injection into Codex prompts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs/promises
const mockReadFile = vi.fn();
const mockAccess = vi.fn();

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  PromptInjector,
  getDefaultInjector,
} from '../../../../src/integrations/openai-codex/prompt-injector.js';

describe('PromptInjector', () => {
  const originalEnv = process.env;
  const projectRoot = '/test/project';
  const agentsMdContent = `# Project Agents

This project uses the following agents:

- **Backend**: Handles API development
- **Frontend**: Handles UI development

## Guidelines

Follow best practices for code quality.
`;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AUTOMATOSX_INJECT_AGENTS_MD;
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(agentsMdContent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create injector with default options', () => {
      const injector = new PromptInjector();
      expect(injector).toBeDefined();
      expect(injector.isEnabled()).toBe(true);
    });

    it('should create injector with custom options', () => {
      const injector = new PromptInjector({
        enabled: false,
        projectRoot: '/custom/path',
        cacheTTL: 30000,
      });
      expect(injector.isEnabled()).toBe(false);
    });

    it('should respect AUTOMATOSX_INJECT_AGENTS_MD=true env var', () => {
      process.env.AUTOMATOSX_INJECT_AGENTS_MD = 'true';
      const injector = new PromptInjector();
      expect(injector.isEnabled()).toBe(true);
    });

    it('should respect AUTOMATOSX_INJECT_AGENTS_MD=1 env var', () => {
      process.env.AUTOMATOSX_INJECT_AGENTS_MD = '1';
      const injector = new PromptInjector();
      expect(injector.isEnabled()).toBe(true);
    });

    it('should respect AUTOMATOSX_INJECT_AGENTS_MD=false env var', () => {
      process.env.AUTOMATOSX_INJECT_AGENTS_MD = 'false';
      const injector = new PromptInjector();
      expect(injector.isEnabled()).toBe(false);
    });

    it('should use explicit enabled option over env var', () => {
      process.env.AUTOMATOSX_INJECT_AGENTS_MD = 'false';
      const injector = new PromptInjector({ enabled: true });
      expect(injector.isEnabled()).toBe(true);
    });
  });

  describe('inject', () => {
    it('should inject AGENTS.md content into prompt', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
      });

      const userPrompt = 'Create a new API endpoint';
      const result = await injector.inject(userPrompt);

      expect(result).toContain('# Project Context (AGENTS.md)');
      expect(result).toContain(agentsMdContent);
      expect(result).toContain('---');
      expect(result).toContain('# User Request');
      expect(result).toContain(userPrompt);
    });

    it('should return original prompt when disabled', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: false,
      });

      const userPrompt = 'Create a new API endpoint';
      const result = await injector.inject(userPrompt);

      expect(result).toBe(userPrompt);
      expect(result).not.toContain('AGENTS.md');
    });

    it('should return original prompt when AGENTS.md not found', async () => {
      const notFoundError = new Error('ENOENT') as NodeJS.ErrnoException;
      notFoundError.code = 'ENOENT';
      mockAccess.mockRejectedValue(notFoundError);

      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
      });

      const userPrompt = 'Create a new API endpoint';
      const result = await injector.inject(userPrompt);

      expect(result).toBe(userPrompt);
    });

    it('should cache AGENTS.md content', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
        cacheTTL: 60000,
      });

      // First injection
      const result1 = await injector.inject('First prompt');
      expect(result1).toContain(agentsMdContent);

      // Modify mock to return different content
      mockReadFile.mockResolvedValue('Modified content');

      // Second injection should use cached content
      const result2 = await injector.inject('Second prompt');
      expect(result2).toContain(agentsMdContent);
      expect(result2).not.toContain('Modified content');

      // readFile should have been called only once
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expires', async () => {
      vi.useFakeTimers();

      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
        cacheTTL: 1000, // 1 second
      });

      // First injection
      const result1 = await injector.inject('First prompt');
      expect(result1).toContain(agentsMdContent);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      // Modify mock to return updated content
      const updatedContent = 'Updated content';
      mockReadFile.mockResolvedValue(updatedContent);

      // Second injection should get fresh content
      const result2 = await injector.inject('Second prompt');
      expect(result2).toContain(updatedContent);

      vi.useRealTimers();
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('Read error'));

      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
      });

      const userPrompt = 'Create a new API endpoint';
      const result = await injector.inject(userPrompt);

      // Should return original prompt on error
      expect(result).toBe(userPrompt);
    });
  });

  describe('clearCache', () => {
    it('should clear cached content', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
        cacheTTL: 60000, // Long TTL
      });

      // First injection - caches content
      await injector.inject('First prompt');

      // Update mock to return new content
      const newContent = 'New content';
      mockReadFile.mockResolvedValue(newContent);

      // Clear cache
      injector.clearCache();

      // Next injection should read fresh content
      const result = await injector.inject('Second prompt');
      expect(result).toContain(newContent);
    });
  });

  describe('setEnabled', () => {
    it('should enable injection', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: false,
      });

      expect(injector.isEnabled()).toBe(false);

      injector.setEnabled(true);

      expect(injector.isEnabled()).toBe(true);
      const result = await injector.inject('Test prompt');
      expect(result).toContain(agentsMdContent);
    });

    it('should disable injection', async () => {
      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
      });

      expect(injector.isEnabled()).toBe(true);

      injector.setEnabled(false);

      expect(injector.isEnabled()).toBe(false);
      const result = await injector.inject('Test prompt');
      expect(result).toBe('Test prompt');
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      const injector = new PromptInjector({ enabled: true });
      expect(injector.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const injector = new PromptInjector({ enabled: false });
      expect(injector.isEnabled()).toBe(false);
    });
  });

  describe('formatInjectedPrompt', () => {
    it('should format prompt with correct structure', async () => {
      mockReadFile.mockResolvedValue('Agent content');

      const injector = new PromptInjector({
        projectRoot,
        enabled: true,
      });

      const result = await injector.inject('User request');

      // Verify structure
      const lines = result.split('\n');
      expect(lines[0]).toBe('# Project Context (AGENTS.md)');
      expect(result).toContain('Agent content');
      expect(result).toContain('---');
      expect(result).toContain('# User Request');
      expect(result).toContain('User request');
    });
  });
});

describe('getDefaultInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    vi.resetModules();
  });

  it('should return a PromptInjector instance', async () => {
    const { getDefaultInjector, PromptInjector: PI } = await import(
      '../../../../src/integrations/openai-codex/prompt-injector.js'
    );
    const injector = getDefaultInjector();
    expect(injector).toBeInstanceOf(PI);
  });

  it('should return same instance on subsequent calls', async () => {
    const { getDefaultInjector } = await import(
      '../../../../src/integrations/openai-codex/prompt-injector.js'
    );
    const injector1 = getDefaultInjector();
    const injector2 = getDefaultInjector();
    expect(injector1).toBe(injector2);
  });

  it('should create new instance when options provided', async () => {
    const { getDefaultInjector } = await import(
      '../../../../src/integrations/openai-codex/prompt-injector.js'
    );
    const injector1 = getDefaultInjector();
    const injector2 = getDefaultInjector({ enabled: false });
    // With options, creates new instance
    expect(injector2.isEnabled()).toBe(false);
  });
});
