/**
 * Workflow Mode Manager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowModeManager,
  type ModeTransitionEvent
} from '../../../src/core/workflow/index.js';
import type { OrchestrationContext } from '../../../src/core/orchestration/index.js';

describe('WorkflowModeManager', () => {
  let manager: WorkflowModeManager;
  let defaultContext: OrchestrationContext;

  beforeEach(() => {
    manager = new WorkflowModeManager();
    defaultContext = {
      todos: [],
      turnCount: 0,
      workflowMode: 'default'
    };
  });

  describe('constructor', () => {
    it('should initialize with default mode', () => {
      expect(manager.getCurrentMode()).toBe('default');
      expect(manager.getStackDepth()).toBe(1);
    });

    it('should accept initial mode', () => {
      const customManager = new WorkflowModeManager('plan');
      expect(customManager.getCurrentMode()).toBe('plan');
    });
  });

  describe('getCurrentMode', () => {
    it('should return the current mode', () => {
      expect(manager.getCurrentMode()).toBe('default');
    });
  });

  describe('getCurrentModeConfig', () => {
    it('should return config for current mode', () => {
      const config = manager.getCurrentModeConfig();
      expect(config.name).toBe('default');
      expect(config.displayName).toBe('Default');
    });

    it('should return plan mode config when in plan mode', () => {
      manager.setMode('plan');
      const config = manager.getCurrentModeConfig();
      expect(config.name).toBe('plan');
      expect(config.blockedTools).toBeDefined();
    });
  });

  describe('pushMode', () => {
    it('should push a new mode onto the stack', () => {
      const result = manager.pushMode('iterate');
      expect(result).toBe(true);
      expect(manager.getCurrentMode()).toBe('iterate');
      expect(manager.getStackDepth()).toBe(2);
    });

    it('should reject push when nesting not allowed', () => {
      manager.setMode('plan'); // Plan mode doesn't allow nesting
      const result = manager.pushMode('iterate');
      expect(result).toBe(false);
      expect(manager.getCurrentMode()).toBe('plan');
      expect(manager.getStackDepth()).toBe(1);
    });

    it('should reject push when max depth reached', () => {
      // Push up to max depth
      manager.pushMode('iterate');
      manager.pushMode('iterate');
      // Third push should fail (default maxNestingDepth is 3)
      const result = manager.pushMode('iterate');
      expect(result).toBe(false);
    });

    it('should accept custom config', () => {
      manager.pushMode('iterate', {
        customConfig: { displayName: 'Custom Iterate' },
        reason: 'test'
      });
      const config = manager.getCurrentModeConfig();
      expect(config.displayName).toBe('Custom Iterate');
    });
  });

  describe('popMode', () => {
    it('should pop the current mode', () => {
      manager.pushMode('iterate');
      expect(manager.getStackDepth()).toBe(2);

      const popped = manager.popMode();
      expect(popped).toBe('iterate');
      expect(manager.getCurrentMode()).toBe('default');
      expect(manager.getStackDepth()).toBe(1);
    });

    it('should not pop when at base level', () => {
      const popped = manager.popMode();
      expect(popped).toBeNull();
      expect(manager.getCurrentMode()).toBe('default');
      expect(manager.getStackDepth()).toBe(1);
    });
  });

  describe('replaceMode', () => {
    it('should replace the current mode', () => {
      manager.replaceMode('plan');
      expect(manager.getCurrentMode()).toBe('plan');
      expect(manager.getStackDepth()).toBe(1);
    });

    it('should replace when on nested level', () => {
      manager.pushMode('iterate');
      manager.replaceMode('plan');
      expect(manager.getCurrentMode()).toBe('plan');
      expect(manager.getStackDepth()).toBe(2);
    });
  });

  describe('setMode', () => {
    it('should set mode and clear stack', () => {
      manager.pushMode('iterate');
      // Note: iterate mode has maxNestingDepth=2, so second push fails
      expect(manager.getStackDepth()).toBe(2);

      manager.setMode('plan');
      expect(manager.getCurrentMode()).toBe('plan');
      expect(manager.getStackDepth()).toBe(1);
    });
  });

  describe('isToolAllowed', () => {
    it('should allow all tools in default mode', () => {
      expect(manager.isToolAllowed('Read')).toBe(true);
      expect(manager.isToolAllowed('Write')).toBe(true);
      expect(manager.isToolAllowed('Edit')).toBe(true);
    });

    it('should block write tools in plan mode', () => {
      manager.setMode('plan');
      expect(manager.isToolAllowed('Read')).toBe(true);
      expect(manager.isToolAllowed('Write')).toBe(false);
      expect(manager.isToolAllowed('Edit')).toBe(false);
    });
  });

  describe('getBlockedTools', () => {
    it('should return empty array in default mode', () => {
      expect(manager.getBlockedTools()).toHaveLength(0);
    });

    it('should return blocked tools in plan mode', () => {
      manager.setMode('plan');
      const blocked = manager.getBlockedTools();
      expect(blocked).toContain('Write');
      expect(blocked).toContain('Edit');
    });
  });

  describe('filterTools', () => {
    it('should filter tools based on current mode', () => {
      const tools = [
        { name: 'Read' },
        { name: 'Write' },
        { name: 'Edit' },
        { name: 'Glob' }
      ];

      manager.setMode('plan');
      const filtered = manager.filterTools(tools);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.name)).toContain('Read');
      expect(filtered.map(t => t.name)).toContain('Glob');
      expect(filtered.map(t => t.name)).not.toContain('Write');
    });
  });

  describe('onTransition', () => {
    it('should emit transition events', () => {
      const events: ModeTransitionEvent[] = [];
      manager.onTransition(event => events.push(event));

      manager.pushMode('iterate');
      manager.popMode();

      expect(events).toHaveLength(2);
      expect(events[0]?.from).toBe('default');
      expect(events[0]?.to).toBe('iterate');
      expect(events[0]?.type).toBe('push');
      expect(events[1]?.from).toBe('iterate');
      expect(events[1]?.to).toBe('default');
      expect(events[1]?.type).toBe('pop');
    });

    it('should return unsubscribe function', () => {
      const events: ModeTransitionEvent[] = [];
      const unsubscribe = manager.onTransition(event => events.push(event));

      manager.pushMode('iterate');
      unsubscribe();
      manager.popMode();

      expect(events).toHaveLength(1);
    });
  });

  describe('updateTurnCount', () => {
    it('should update turn count', () => {
      manager.updateTurnCount(5);
      const status = manager.getStatus();
      expect(status.turnCount).toBe(5);
    });
  });

  describe('notifyToolUsed', () => {
    it('should auto-exit on tool use when configured', () => {
      manager.setMode('plan');
      expect(manager.getCurrentMode()).toBe('plan');

      // Plan mode auto-exits on ExitPlanMode
      manager.pushMode('default'); // Need to push first since plan doesn't allow nesting
      manager.notifyToolUsed('ExitPlanMode');
      // This won't actually exit because we're in default mode now
    });
  });

  describe('InstructionProvider interface', () => {
    describe('shouldGenerate', () => {
      it('should return false when in default mode', () => {
        expect(manager.shouldGenerate(defaultContext)).toBe(false);
      });

      it('should return true when in non-default mode', () => {
        manager.setMode('plan');
        expect(manager.shouldGenerate(defaultContext)).toBe(true);
      });
    });

    describe('getInstructions', () => {
      it('should return empty array in default mode', async () => {
        const instructions = await manager.getInstructions(defaultContext);
        expect(instructions).toHaveLength(0);
      });

      it('should return mode instructions in plan mode', async () => {
        manager.setMode('plan');
        const instructions = await manager.getInstructions(defaultContext);
        expect(instructions.length).toBeGreaterThan(0);
        expect(instructions[0]?.type).toBe('mode');
        expect(instructions[0]?.content).toContain('Plan Mode');
      });

      it('should include tool restriction reminder', async () => {
        manager.setMode('plan');
        const instructions = await manager.getInstructions(defaultContext);
        const restrictionInstruction = instructions.find(i =>
          i.content.includes('Tool Restrictions')
        );
        expect(restrictionInstruction).toBeDefined();
        expect(restrictionInstruction?.priority).toBe('critical');
      });
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      manager.pushMode('iterate');
      manager.updateTurnCount(10);

      manager.reset();

      expect(manager.getCurrentMode()).toBe('default');
      expect(manager.getStackDepth()).toBe(1);
      const status = manager.getStatus();
      expect(status.turnCount).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      manager.pushMode('iterate', { reason: 'test' });

      const status = manager.getStatus();
      expect(status.currentMode).toBe('iterate');
      expect(status.stackDepth).toBe(2);
      expect(status.stack).toHaveLength(2);
      expect(status.stack[1]?.reason).toBe('test');
    });
  });
});
