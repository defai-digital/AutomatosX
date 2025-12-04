/**
 * Todo Instruction Provider Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TodoInstructionProvider,
  createTodoItem,
  createTodoListState,
  type OrchestrationContext,
  type TodoItem
} from '../../../src/core/orchestration/index.js';

describe('TodoInstructionProvider', () => {
  let provider: TodoInstructionProvider;
  let defaultContext: OrchestrationContext;

  beforeEach(() => {
    provider = new TodoInstructionProvider();
    provider.reset(); // Reset state between tests
    defaultContext = {
      todos: [],
      turnCount: 0,
      workflowMode: 'default'
    };
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const config = provider.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.reminderFrequency).toBe(3);
      expect(config.compactMode).toBe(false);
    });

    it('should accept custom config', () => {
      const customProvider = new TodoInstructionProvider({
        reminderFrequency: 5,
        compactMode: true
      });
      const config = customProvider.getConfig();
      expect(config.reminderFrequency).toBe(5);
      expect(config.compactMode).toBe(true);
    });
  });

  describe('shouldGenerate', () => {
    it('should return false when disabled', () => {
      const disabledProvider = new TodoInstructionProvider({ enabled: false });
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Test', 'Testing')]
      };
      expect(disabledProvider.shouldGenerate(context)).toBe(false);
    });

    it('should return false when no todos', () => {
      expect(provider.shouldGenerate(defaultContext)).toBe(false);
    });

    it('should return true when todos exist and state changes', () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Test', 'Testing')]
      };
      expect(provider.shouldGenerate(context)).toBe(true);
    });

    it('should return true when reminder is due', async () => {
      const todo = createTodoItem('Test', 'Testing');
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [todo],
        turnCount: 0
      };

      // First call generates instructions
      await provider.getInstructions(context);

      // Advance turns past reminder frequency
      const laterContext: OrchestrationContext = {
        ...context,
        turnCount: 4 // Past default frequency of 3
      };

      expect(provider.shouldGenerate(laterContext)).toBe(true);
    });
  });

  describe('getInstructions', () => {
    it('should return empty array for no todos', async () => {
      const instructions = await provider.getInstructions(defaultContext);
      expect(instructions).toHaveLength(0);
    });

    it('should generate task instruction for todos', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Implement feature', 'Implementing feature', 'in_progress')]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions).toHaveLength(1);
      expect(instructions[0]?.type).toBe('task');
      expect(instructions[0]?.source).toBe('automatosx');
    });

    it('should include in-progress tasks prominently', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Task 1', 'Doing task 1', 'in_progress'),
          createTodoItem('Task 2', 'Doing task 2', 'pending')
        ]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions[0]?.content).toContain('Currently Working On');
      expect(instructions[0]?.content).toContain('Doing task 1');
    });

    it('should include pending tasks', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Pending task', 'Doing pending task', 'pending')
        ]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions[0]?.content).toContain('Pending Tasks');
      expect(instructions[0]?.content).toContain('Pending task');
    });

    it('should set high priority on state change', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task', 'Doing task', 'pending')]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions[0]?.priority).toBe('high');
    });

    it('should include guidance text', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task', 'Doing task', 'pending')]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions[0]?.content).toContain('Remember:');
    });

    it('should set expiration based on reminder frequency', async () => {
      const customProvider = new TodoInstructionProvider({
        reminderFrequency: 5
      });

      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task', 'Doing task', 'pending')]
      };

      const instructions = await customProvider.getInstructions(context);
      expect(instructions[0]?.expiresAfter).toBe(6); // frequency + 1
    });
  });

  describe('compact mode', () => {
    it('should use compact format when enabled', async () => {
      const compactProvider = new TodoInstructionProvider({
        compactMode: true
      });

      // Generate first to set state, then generate again for compact reminder
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Task 1', 'Doing task 1', 'in_progress'),
          createTodoItem('Task 2', 'Doing task 2', 'pending')
        ],
        turnCount: 0
      };

      // First generation (full format due to state change)
      await compactProvider.getInstructions(context);

      // Advance turns for reminder (but not state change)
      const laterContext: OrchestrationContext = {
        ...context,
        turnCount: 4
      };

      const instructions = await compactProvider.getInstructions(laterContext);
      expect(instructions[0]?.content).toContain('Doing:');
      expect(instructions[0]?.content).toContain('Next:');
    });

    it('should limit items in compact mode', async () => {
      const compactProvider = new TodoInstructionProvider({
        compactMode: true,
        maxCompactItems: 2
      });

      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Task 1', 'Doing 1', 'pending'),
          createTodoItem('Task 2', 'Doing 2', 'pending'),
          createTodoItem('Task 3', 'Doing 3', 'pending'),
          createTodoItem('Task 4', 'Doing 4', 'pending')
        ],
        turnCount: 0
      };

      // First generation
      await compactProvider.getInstructions(context);

      // Trigger reminder
      const laterContext = { ...context, turnCount: 4 };
      const instructions = await compactProvider.getInstructions(laterContext);

      // Should only include first 2 items
      const content = instructions[0]?.content || '';
      const taskMatches = content.match(/Task \d/g) || [];
      expect(taskMatches.length).toBeLessThanOrEqual(2);
    });
  });

  describe('showCompleted', () => {
    it('should hide completed tasks by default', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Completed task', 'Done task', 'completed'),
          createTodoItem('Pending task', 'Doing task', 'pending')
        ]
      };

      const instructions = await provider.getInstructions(context);
      expect(instructions[0]?.content).not.toContain('Completed:');
    });

    it('should show completed tasks when enabled', async () => {
      const showCompletedProvider = new TodoInstructionProvider({
        showCompleted: true
      });

      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Completed task', 'Done task', 'completed'),
          createTodoItem('Pending task', 'Doing task', 'pending')
        ]
      };

      const instructions = await showCompletedProvider.getInstructions(context);
      expect(instructions[0]?.content).toContain('Completed:');
    });
  });

  describe('state tracking', () => {
    it('should detect state changes via hash', async () => {
      const context1: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task 1', 'Doing 1', 'pending')],
        turnCount: 0
      };

      // First generation
      await provider.getInstructions(context1);
      expect(provider.shouldGenerate(context1)).toBe(false); // Same state

      // Change state
      const context2: OrchestrationContext = {
        ...defaultContext,
        todos: [
          createTodoItem('Task 1', 'Doing 1', 'completed'), // Changed status
          createTodoItem('Task 2', 'Doing 2', 'pending')
        ],
        turnCount: 1
      };

      expect(provider.shouldGenerate(context2)).toBe(true); // State changed
    });

    it('should track last reminder turn', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task', 'Doing', 'pending')],
        turnCount: 0
      };

      await provider.getInstructions(context);

      // Same state, not enough turns
      const laterContext: OrchestrationContext = {
        ...context,
        turnCount: 2
      };

      expect(provider.shouldGenerate(laterContext)).toBe(false);
    });

    it('should reset state tracking', async () => {
      const context: OrchestrationContext = {
        ...defaultContext,
        todos: [createTodoItem('Task', 'Doing', 'pending')],
        turnCount: 0
      };

      await provider.getInstructions(context);
      provider.reset();

      // Should generate again after reset
      expect(provider.shouldGenerate(context)).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should update config', () => {
      provider.updateConfig({ reminderFrequency: 10 });
      const config = provider.getConfig();
      expect(config.reminderFrequency).toBe(10);
    });
  });
});

describe('createTodoItem', () => {
  it('should create todo item with defaults', () => {
    const item = createTodoItem('Test content', 'Testing');
    expect(item.content).toBe('Test content');
    expect(item.activeForm).toBe('Testing');
    expect(item.status).toBe('pending');
    expect(item.id).toBeDefined();
    expect(item.createdAt).toBeGreaterThan(0);
  });

  it('should accept custom status', () => {
    const item = createTodoItem('Test', 'Testing', 'in_progress');
    expect(item.status).toBe('in_progress');
  });

  it('should accept custom id', () => {
    const item = createTodoItem('Test', 'Testing', 'pending', 'custom-id');
    expect(item.id).toBe('custom-id');
  });
});

describe('createTodoListState', () => {
  it('should create state with hash', () => {
    const items: TodoItem[] = [
      createTodoItem('Task 1', 'Doing 1', 'pending', 'id-1'),
      createTodoItem('Task 2', 'Doing 2', 'in_progress', 'id-2')
    ];

    const state = createTodoListState(items);
    expect(state.items).toHaveLength(2);
    expect(state.stateHash).toBeDefined();
    expect(state.stateHash.length).toBe(16);
    expect(state.lastUpdated).toBeGreaterThan(0);
  });

  it('should generate consistent hash for same items', () => {
    const items: TodoItem[] = [
      createTodoItem('Task', 'Doing', 'pending', 'id-1')
    ];

    const state1 = createTodoListState(items);
    const state2 = createTodoListState(items);

    expect(state1.stateHash).toBe(state2.stateHash);
  });

  it('should generate different hash for different items', () => {
    const items1: TodoItem[] = [
      createTodoItem('Task 1', 'Doing 1', 'pending', 'id-1')
    ];
    const items2: TodoItem[] = [
      createTodoItem('Task 2', 'Doing 2', 'pending', 'id-2')
    ];

    const state1 = createTodoListState(items1);
    const state2 = createTodoListState(items2);

    expect(state1.stateHash).not.toBe(state2.stateHash);
  });
});
