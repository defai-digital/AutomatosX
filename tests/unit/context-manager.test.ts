/**
 * Context Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextManager } from '../../src/agents/context-manager.js';
import { ProfileLoader } from '../../src/agents/profile-loader.js';
import { AbilitiesManager } from '../../src/agents/abilities-manager.js';
import { MemoryManager } from '../../src/core/memory-manager.js';
import { Router } from '../../src/core/router.js';
import { PathResolver } from '../../src/core/path-resolver.js';
import { ClaudeProvider } from '../../src/providers/claude-provider.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { normalizePath } from '../../src/utils/path-utils.js';

describe('ContextManager', () => {
  let testDir: string;
  let manager: ContextManager;
  let profileLoader: ProfileLoader;
  let abilitiesManager: AbilitiesManager;
  let memoryManager: MemoryManager;
  let router: Router;
  let pathResolver: PathResolver;

  beforeEach(async () => {
    // Create temp directory
    testDir = join(tmpdir(), `automatosx-context-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, 'agents'), { recursive: true });
    await mkdir(join(testDir, 'abilities'), { recursive: true });

    // Create test agent profile
    const profileYaml = `
name: Test Agent
role: tester
description: A test agent
systemPrompt: You are a test agent
abilities:
  - test-ability
provider: claude
temperature: 0.7
    `;
    await writeFile(join(testDir, 'agents', 'test.yaml'), profileYaml);

    // Create test ability
    await writeFile(
      join(testDir, 'abilities', 'test-ability.md'),
      '# Test Ability\n\nThis is a test ability.'
    );

    // Initialize components
    profileLoader = new ProfileLoader(join(testDir, 'agents'));
    abilitiesManager = new AbilitiesManager(join(testDir, 'abilities'));
    memoryManager = await MemoryManager.create({
      dbPath: join(testDir, 'memory.db')
    });

    const claudeProvider = new ClaudeProvider({
      name: 'claude',
      enabled: true,
      priority: 1,
      timeout: 30000,
      command: 'claude'
    });

    router = new Router({
      providers: [claudeProvider],
      fallbackEnabled: true
    });

    pathResolver = new PathResolver({
      projectDir: testDir,
      workingDir: testDir,
      agentWorkspace: join(testDir, 'workspace')
    });

    // Create context manager
    manager = new ContextManager({
      profileLoader,
      abilitiesManager,
      memoryManager,
      router,
      pathResolver
    });
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('createContext', () => {
    it('should create complete execution context', async () => {
      const context = await manager.createContext('test', 'Hello world');

      // Name is filename, displayName is the human-friendly name
      expect(context.agent.name).toBe('test');
      expect(context.agent.displayName).toBe('Test Agent');
      expect(context.task).toBe('Hello world');
      expect(context.provider).toBeDefined();
      expect(context.provider.name).toBe('claude');
      expect(context.projectDir).toBeDefined();
      expect(context.workingDir).toBeDefined();
      expect(context.agentWorkspace).toBeDefined();
      expect(context.abilities).toContain('Test Ability');
      expect(context.createdAt).toBeInstanceOf(Date);
    });

    it('should load agent profile', async () => {
      const context = await manager.createContext('test', 'Task');

      // Name is filename, displayName is the human-friendly name
      expect(context.agent.name).toBe('test');
      expect(context.agent.displayName).toBe('Test Agent');
      expect(context.agent.role).toBe('tester');
      expect(context.agent.description).toBe('A test agent');
      expect(context.agent.systemPrompt).toBe('You are a test agent');
    });

    it('should load abilities', async () => {
      const context = await manager.createContext('test', 'Task');

      expect(context.abilities).toContain('## Ability: test-ability');
      expect(context.abilities).toContain('This is a test ability');
    });

    it('should select provider from agent preference', async () => {
      const context = await manager.createContext('test', 'Task');

      expect(context.provider.name).toBe('claude');
    });

    it('should override provider from options', async () => {
      const context = await manager.createContext('test', 'Task', {
        provider: 'claude'
      });

      expect(context.provider.name).toBe('claude');
    });

    it('should detect project directory', async () => {
      const context = await manager.createContext('test', 'Task');

      expect(context.projectDir).toBeDefined();
      expect(typeof context.projectDir).toBe('string');
    });

    it('should set working directory to process.cwd()', async () => {
      const context = await manager.createContext('test', 'Task');

      expect(context.workingDir).toBe(process.cwd());
    });

    it('should create agent workspace', async () => {
      const context = await manager.createContext('test', 'Task');

      expect(context.agentWorkspace).toBeDefined();
      expect(normalizePath(context.agentWorkspace)).toContain('.automatosx/workspaces');
      expect(normalizePath(context.agentWorkspace)).toContain('test'); // Agent name from filename
    });

    it('should inject memory by default', async () => {
      const context = await manager.createContext('test', 'testing');

      // Memory is an array (might be empty if no matches)
      expect(Array.isArray(context.memory)).toBe(true);
    });

    it('should skip memory if requested', async () => {
      const context = await manager.createContext('test', 'Task', {
        skipMemory: true
      });

      expect(context.memory).toEqual([]);
    });
  });

  describe('injectMemory', () => {
    it('should search memory by task', async () => {
      const context = await manager.createContext('test', 'Task', {
        skipMemory: true
      });

      await manager.injectMemory(context, 'testing', 5);

      expect(Array.isArray(context.memory)).toBe(true);
    });

    it('should limit memory entries', async () => {
      const context = await manager.createContext('test', 'Task', {
        skipMemory: true
      });

      await manager.injectMemory(context, 'testing', 3);

      expect(context.memory.length).toBeLessThanOrEqual(3);
    });

    it('should handle memory search errors gracefully', async () => {
      const context = await manager.createContext('test', 'Task', {
        skipMemory: true
      });

      // Should not throw even if search fails
      await expect(
        manager.injectMemory(context, 'some query', 5)
      ).resolves.not.toThrow();

      expect(context.memory).toEqual([]);
    });
  });

  describe('selectProvider', () => {
    it('should select provider by name', async () => {
      const provider = await manager.selectProvider('claude');

      expect(provider.name).toBe('claude');
    });

    it('should fallback to router if preference not available', async () => {
      const provider = await manager.selectProvider('nonexistent');

      expect(provider).toBeDefined();
      expect(provider.name).toBe('claude'); // Falls back to available provider
    });

    it('should use router when no preference given', async () => {
      const provider = await manager.selectProvider();

      expect(provider).toBeDefined();
      expect(provider.name).toBe('claude');
    });

    it('should throw error when no providers available', async () => {
      // Create router with no providers
      const emptyRouter = new Router({
        providers: [],
        fallbackEnabled: true
      });

      const emptyManager = new ContextManager({
        profileLoader,
        abilitiesManager,
        memoryManager,
        router: emptyRouter,
        pathResolver
      });

      await expect(
        emptyManager.selectProvider()
      ).rejects.toThrow('No AI providers are available');
    });
  });

  describe('cleanup', () => {
    it('should cleanup context', async () => {
      const context = await manager.createContext('test', 'Task');

      await expect(
        manager.cleanup(context)
      ).resolves.not.toThrow();
    });
  });
});
