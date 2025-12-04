/**
 * Agent Instruction Injector Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentInstructionInjector
} from '../../../src/agents/agent-instruction-injector.js';
import {
  type OrchestrationContext,
  createTodoItem
} from '../../../src/core/orchestration/index.js';

describe('AgentInstructionInjector', () => {
  let injector: AgentInstructionInjector;
  let defaultContext: OrchestrationContext;

  beforeEach(() => {
    injector = new AgentInstructionInjector();
    injector.reset();
    defaultContext = {
      todos: [],
      turnCount: 0,
      workflowMode: 'default',
      agentName: 'backend'
    };
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const config = injector.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.reminderFrequency).toBe(5);
      expect(config.delegationDetection).toBe(true);
    });

    it('should accept custom config', () => {
      const customInjector = new AgentInstructionInjector({
        reminderFrequency: 10,
        delegationDetection: false
      });
      const config = customInjector.getConfig();
      expect(config.reminderFrequency).toBe(10);
      expect(config.delegationDetection).toBe(false);
    });
  });

  describe('setDomain', () => {
    it('should set valid domain', () => {
      injector.setDomain('frontend');
      expect(injector.getDomain()).toBe('frontend');
    });

    it('should fallback to standard for invalid domain', () => {
      injector.setDomain('invalid-domain');
      expect(injector.getDomain()).toBe('standard');
    });
  });

  describe('shouldGenerate', () => {
    it('should return false when disabled', () => {
      const disabledInjector = new AgentInstructionInjector({ enabled: false });
      expect(disabledInjector.shouldGenerate(defaultContext)).toBe(false);
    });

    it('should return false when no domain', () => {
      const noDomainContext: OrchestrationContext = {
        todos: [],
        turnCount: 5,
        workflowMode: 'default'
      };
      expect(injector.shouldGenerate(noDomainContext)).toBe(false);
    });

    it('should return true when reminder is due', () => {
      const laterContext: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      expect(injector.shouldGenerate(laterContext)).toBe(true);
    });

    it('should return true when delegation triggers present', () => {
      const securityContext: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'implement security authentication'
      };
      expect(injector.shouldGenerate(securityContext)).toBe(true);
    });
  });

  describe('getInstructions', () => {
    it('should return empty array when no domain', async () => {
      const noDomainContext: OrchestrationContext = {
        todos: [],
        turnCount: 5,
        workflowMode: 'default'
      };
      const instructions = await injector.getInstructions(noDomainContext);
      expect(instructions).toHaveLength(0);
    });

    it('should generate domain reminders', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await injector.getInstructions(context);

      expect(instructions.length).toBeGreaterThan(0);
      const reminder = instructions.find(i => i.id?.includes('reminder'));
      expect(reminder).toBeDefined();
      expect(reminder?.content).toContain('Backend');
    });

    it('should include quality checklist periodically', async () => {
      const laterContext: OrchestrationContext = {
        ...defaultContext,
        turnCount: 10
      };
      const instructions = await injector.getInstructions(laterContext);

      const checklist = instructions.find(i => i.id?.includes('quality'));
      expect(checklist).toBeDefined();
      expect(checklist?.content).toContain('Quality Checklist');
    });

    it('should detect delegation triggers', async () => {
      const securityContext: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'implement security authentication OWASP',
        turnCount: 5
      };
      const instructions = await injector.getInstructions(securityContext);

      const delegation = instructions.find(i => i.id?.includes('delegation'));
      expect(delegation).toBeDefined();
      expect(delegation?.content).toContain('security');
      expect(delegation?.priority).toBe('high');
    });

    it('should not repeat delegation for same task', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'implement security authentication',
        turnCount: 5
      };

      // First call
      await injector.getInstructions(context);

      // Second call with same task
      const context2 = { ...context, turnCount: 6 };
      const instructions = await injector.getInstructions(context2);

      // Should not have delegation instruction (same task text)
      const delegation = instructions.find(i => i.id?.includes('delegation'));
      expect(delegation).toBeUndefined();
    });

    it('should use agentName from context', async () => {
      const frontendContext: OrchestrationContext = {
        ...defaultContext,
        agentName: 'frontend',
        turnCount: 5
      };
      const instructions = await injector.getInstructions(frontendContext);

      const reminder = instructions.find(i => i.id?.includes('reminder'));
      expect(reminder?.content).toContain('Frontend');
    });

    it('should use todos for task text', async () => {
      const todoContext: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Fix security vulnerability', 'Fixing security', 'in_progress')
        ],
        turnCount: 5
      };
      const instructions = await injector.getInstructions(todoContext);

      const delegation = instructions.find(i => i.id?.includes('delegation'));
      expect(delegation).toBeDefined();
    });
  });

  describe('domain reminders content', () => {
    it('should include anti-patterns when enabled', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await injector.getInstructions(context);

      const reminder = instructions.find(i => i.id?.includes('reminder'));
      expect(reminder?.content).toContain('Avoid');
    });

    it('should exclude anti-patterns when disabled', async () => {
      const noAntiPatternInjector = new AgentInstructionInjector({
        includeAntiPatterns: false
      });
      noAntiPatternInjector.setDomain('backend');

      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await noAntiPatternInjector.getInstructions(context);

      const reminder = instructions.find(i => i.id?.includes('reminder'));
      expect(reminder?.content).not.toContain('Avoid:');
    });
  });

  describe('delegation detection', () => {
    it('should respect minDelegationKeywords config', async () => {
      const strictInjector = new AgentInstructionInjector({
        minDelegationKeywords: 3
      });
      strictInjector.setDomain('backend');

      // Only one keyword
      const context: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'fix security issue',
        turnCount: 5
      };
      const instructions = await strictInjector.getInstructions(context);

      // Should not trigger with only 1 keyword when minimum is 3
      const delegation = instructions.find(i => i.id?.includes('delegation'));
      expect(delegation).toBeUndefined();
    });

    it('should be disabled when delegationDetection is false', async () => {
      const noDelegationInjector = new AgentInstructionInjector({
        delegationDetection: false
      });
      noDelegationInjector.setDomain('backend');

      const context: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'security authentication OWASP',
        turnCount: 5
      };
      const instructions = await noDelegationInjector.getInstructions(context);

      const delegation = instructions.find(i => i.id?.includes('delegation'));
      expect(delegation).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      injector.updateConfig({ reminderFrequency: 15 });
      const config = injector.getConfig();
      expect(config.reminderFrequency).toBe(15);
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        currentTask: 'security task',
        turnCount: 5
      };

      // First call
      await injector.getInstructions(context);

      // Reset
      injector.reset();

      // Should generate again after reset
      const instructions = await injector.getInstructions(context);
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe('instruction types', () => {
    it('should use delegation type for all instructions', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 10,
        currentTask: 'security task'
      };
      const instructions = await injector.getInstructions(context);

      for (const instruction of instructions) {
        expect(instruction.type).toBe('delegation');
      }
    });

    it('should set appropriate expiration', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        turnCount: 5
      };
      const instructions = await injector.getInstructions(context);

      const reminder = instructions.find(i => i.id?.includes('reminder'));
      expect(reminder?.expiresAfter).toBe(5); // reminderFrequency
    });
  });
});
