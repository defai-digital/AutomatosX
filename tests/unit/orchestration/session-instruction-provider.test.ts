/**
 * Session Instruction Provider Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionInstructionProvider,
  createMockSessionProvider,
  createMockSessionState,
  type SessionState,
  type OrchestrationContext
} from '../../../src/core/orchestration/index.js';

describe('SessionInstructionProvider', () => {
  let provider: SessionInstructionProvider;
  let defaultContext: OrchestrationContext;
  let mockSession: SessionState;

  beforeEach(() => {
    mockSession = createMockSessionState({
      id: 'test-session-123',
      participants: ['backend', 'security'],
      activeAgent: 'backend',
      completedTasks: 3,
      remainingTasks: 2
    });

    const mockProvider = createMockSessionProvider({
      'test-session-123': mockSession
    });

    provider = new SessionInstructionProvider(mockProvider);
    provider.reset();

    defaultContext = {
      todos: [],
      turnCount: 0,
      workflowMode: 'default',
      sessionId: 'test-session-123'
    };
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const config = provider.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.showCollaboration).toBe(true);
      expect(config.showProgress).toBe(true);
    });

    it('should accept custom config', () => {
      const customProvider = new SessionInstructionProvider(undefined, {
        showCollaboration: false,
        reminderFrequency: 10
      });
      const config = customProvider.getConfig();
      expect(config.showCollaboration).toBe(false);
      expect(config.reminderFrequency).toBe(10);
    });

    it('should work without state provider', () => {
      const noProviderInstance = new SessionInstructionProvider();
      expect(noProviderInstance.hasStateProvider()).toBe(false);
    });
  });

  describe('setStateProvider', () => {
    it('should set the state provider', () => {
      const noProviderInstance = new SessionInstructionProvider();
      expect(noProviderInstance.hasStateProvider()).toBe(false);

      noProviderInstance.setStateProvider(createMockSessionProvider({}));
      expect(noProviderInstance.hasStateProvider()).toBe(true);
    });
  });

  describe('shouldGenerate', () => {
    it('should return false when disabled', () => {
      const disabledProvider = new SessionInstructionProvider(undefined, {
        enabled: false
      });
      expect(disabledProvider.shouldGenerate(defaultContext)).toBe(false);
    });

    it('should return false when no session ID and no provider', () => {
      const noProviderInstance = new SessionInstructionProvider();
      const noSessionContext: OrchestrationContext = {
        todos: [],
        turnCount: 5,
        workflowMode: 'default'
      };
      expect(noProviderInstance.shouldGenerate(noSessionContext)).toBe(false);
    });

    it('should return true when reminder is due', () => {
      const laterContext: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      expect(provider.shouldGenerate(laterContext)).toBe(true);
    });
  });

  describe('getInstructions', () => {
    it('should return session instructions', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await provider.getInstructions(context);

      expect(instructions).toHaveLength(1);
      expect(instructions[0]?.type).toBe('session');
    });

    it('should include collaboration status', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await provider.getInstructions(context);
      const content = instructions[0]?.content || '';

      expect(content).toContain('Multi-Agent Collaboration');
      expect(content).toContain('backend');
      expect(content).toContain('security');
    });

    it('should include session progress', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await provider.getInstructions(context);
      const content = instructions[0]?.content || '';

      expect(content).toContain('Session Progress');
      expect(content).toContain('3/5'); // 3 completed out of 5 total
      expect(content).toContain('60%');
    });

    it('should hide collaboration when disabled', async () => {
      const noCollabProvider = new SessionInstructionProvider(
        createMockSessionProvider({ 'test-session-123': mockSession }),
        { showCollaboration: false }
      );

      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await noCollabProvider.getInstructions(context);
      const content = instructions[0]?.content || '';

      expect(content).not.toContain('Multi-Agent Collaboration');
    });

    it('should hide progress when disabled', async () => {
      const noProgressProvider = new SessionInstructionProvider(
        createMockSessionProvider({ 'test-session-123': mockSession }),
        { showProgress: false }
      );

      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await noProgressProvider.getInstructions(context);
      const content = instructions[0]?.content || '';

      expect(content).not.toContain('Session Progress');
    });

    it('should include handoff context when delegated', async () => {
      const delegatedContext: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5,
        parentAgent: 'architecture',
        currentTask: 'Review API design'
      };
      const instructions = await provider.getInstructions(delegatedContext);
      const content = instructions[0]?.content || '';

      expect(content).toContain('Delegation Context');
      expect(content).toContain('architecture');
      expect(content).toContain('Review API design');
    });

    it('should return empty when no meaningful content', async () => {
      const singleAgentSession = createMockSessionState({
        id: 'single-agent',
        participants: ['backend'],
        completedTasks: 0,
        remainingTasks: 0
      });

      const singleProvider = new SessionInstructionProvider(
        createMockSessionProvider({ 'single-agent': singleAgentSession }),
        { showCollaboration: true, showProgress: true }
      );

      const context: OrchestrationContext = {
        todos: [],
        turnCount: 5,
        workflowMode: 'default',
        sessionId: 'single-agent'
      };

      const instructions = await singleProvider.getInstructions(context);
      // May be empty if no multi-agent collaboration and no progress
    });
  });

  describe('caching', () => {
    it('should cache session state', async () => {
      const spyProvider = createMockSessionProvider({
        'test-session-123': mockSession
      });
      const spyGetState = vi.spyOn(spyProvider, 'getSessionState');

      const cachedProvider = new SessionInstructionProvider(spyProvider);

      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };

      // First call
      await cachedProvider.getInstructions(context);
      expect(spyGetState).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      const context2 = { ...context, turnCount: 10 };
      await cachedProvider.getInstructions(context2);
      expect(spyGetState).toHaveBeenCalledTimes(1);
    });

    it('should clear cache on clearCache()', async () => {
      const spyProvider = createMockSessionProvider({
        'test-session-123': mockSession
      });
      const spyGetState = vi.spyOn(spyProvider, 'getSessionState');

      const cachedProvider = new SessionInstructionProvider(spyProvider);

      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };

      // First call
      await cachedProvider.getInstructions(context);

      // Clear cache
      cachedProvider.clearCache();

      // Second call (should fetch again)
      const context2 = { ...context, turnCount: 10 };
      await cachedProvider.getInstructions(context2);
      expect(spyGetState).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      provider.updateConfig({ showProgress: false });
      const config = provider.getConfig();
      expect(config.showProgress).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };

      // First call
      await provider.getInstructions(context);

      // Reset
      provider.reset();

      // Should work again after reset
      const instructions = await provider.getInstructions(context);
      expect(instructions.length).toBeGreaterThan(0);
    });
  });
});

describe('createMockSessionProvider', () => {
  it('should create a mock provider', () => {
    const provider = createMockSessionProvider({});
    expect(provider).toBeDefined();
    expect(provider.getSessionState).toBeDefined();
    expect(provider.getActiveSessions).toBeDefined();
  });

  it('should return session by ID', async () => {
    const session = createMockSessionState({ id: 'test-123' });
    const provider = createMockSessionProvider({ 'test-123': session });

    const result = await provider.getSessionState('test-123');
    expect(result).toBeDefined();
    expect(result?.id).toBe('test-123');
  });

  it('should return null for unknown session', async () => {
    const provider = createMockSessionProvider({});
    const result = await provider.getSessionState('unknown');
    expect(result).toBeNull();
  });

  it('should return active session IDs', async () => {
    const provider = createMockSessionProvider({
      'session-1': createMockSessionState({ id: 'session-1' }),
      'session-2': createMockSessionState({ id: 'session-2' })
    });

    const sessions = await provider.getActiveSessions();
    expect(sessions).toContain('session-1');
    expect(sessions).toContain('session-2');
  });
});

describe('createMockSessionState', () => {
  it('should create default session state', () => {
    const state = createMockSessionState();
    expect(state.id).toBeDefined();
    expect(state.participants).toBeDefined();
    expect(state.completedTasks).toBe(0);
    expect(state.remainingTasks).toBe(0);
  });

  it('should accept overrides', () => {
    const state = createMockSessionState({
      id: 'custom-id',
      participants: ['frontend', 'backend', 'security'],
      completedTasks: 5
    });

    expect(state.id).toBe('custom-id');
    expect(state.participants).toHaveLength(3);
    expect(state.completedTasks).toBe(5);
  });
});
