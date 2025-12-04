/**
 * Todo Instruction Provider
 *
 * Generates embedded instructions based on the current todo list state.
 * Provides task reminders to help AI agents stay focused on their objectives.
 *
 * @since v11.3.0
 */

import crypto from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  type TodoItem,
  type TodoListState
} from './types.js';

/**
 * Configuration for TodoInstructionProvider
 */
export interface TodoProviderConfig {
  /** Whether the provider is enabled */
  enabled: boolean;
  /** How often to include full todo reminders (every N turns) */
  reminderFrequency: number;
  /** Whether to use compact format */
  compactMode: boolean;
  /** Maximum number of items to show in compact mode */
  maxCompactItems: number;
  /** Include completed items in the reminder */
  showCompleted: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_TODO_CONFIG: TodoProviderConfig = {
  enabled: true,
  reminderFrequency: 3,
  compactMode: false,
  maxCompactItems: 5,
  showCompleted: false
};

/**
 * Todo Instruction Provider
 *
 * Generates task-focused instructions based on the todo list state.
 * Uses hash-based change detection to avoid redundant instructions.
 */
export class TodoInstructionProvider implements InstructionProvider {
  readonly name = 'todo';

  private config: TodoProviderConfig;
  private lastStateHash: string = '';
  private lastReminderTurn: number = 0;

  constructor(config?: Partial<TodoProviderConfig>) {
    this.config = {
      ...DEFAULT_TODO_CONFIG,
      ...config
    };

    logger.debug('TodoInstructionProvider initialized', {
      enabled: this.config.enabled,
      reminderFrequency: this.config.reminderFrequency
    });
  }

  /**
   * Check if provider should generate instructions
   */
  shouldGenerate(context: OrchestrationContext): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // No todos means nothing to remind about
    if (!context.todos || context.todos.length === 0) {
      return false;
    }

    // Check if state changed
    const currentHash = this.computeStateHash(context.todos);
    const stateChanged = currentHash !== this.lastStateHash;

    // Check if it's time for a reminder
    const turnsSinceReminder = context.turnCount - this.lastReminderTurn;
    const reminderDue = turnsSinceReminder >= this.config.reminderFrequency;

    return stateChanged || reminderDue;
  }

  /**
   * Generate instructions based on todo state
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    const instructions: EmbeddedInstruction[] = [];

    if (!context.todos || context.todos.length === 0) {
      return instructions;
    }

    const currentHash = this.computeStateHash(context.todos);
    const stateChanged = currentHash !== this.lastStateHash;

    // Get active todos (pending + in_progress)
    const activeTodos = context.todos.filter(
      todo => todo.status !== 'completed' || this.config.showCompleted
    );

    // Get current in-progress task
    const inProgressTasks = activeTodos.filter(todo => todo.status === 'in_progress');
    const pendingTasks = activeTodos.filter(todo => todo.status === 'pending');
    const completedTasks = context.todos.filter(todo => todo.status === 'completed');

    // Generate instruction content
    let content: string;
    let priority: EmbeddedInstruction['priority'];

    if (stateChanged) {
      // Full update when state changes
      content = this.formatFullTodoList(inProgressTasks, pendingTasks, completedTasks);
      priority = 'high';
    } else if (this.config.compactMode) {
      // Compact reminder
      content = this.formatCompactReminder(inProgressTasks, pendingTasks);
      priority = 'normal';
    } else {
      // Standard reminder
      content = this.formatStandardReminder(inProgressTasks, pendingTasks);
      priority = 'normal';
    }

    instructions.push({
      type: 'task',
      priority,
      content,
      source: 'automatosx',
      createdAt: Date.now(),
      expiresAfter: this.config.reminderFrequency + 1,
      id: `todo-${currentHash.substring(0, 8)}`
    });

    // Update state tracking
    this.lastStateHash = currentHash;
    this.lastReminderTurn = context.turnCount;

    logger.debug('Todo instructions generated', {
      inProgress: inProgressTasks.length,
      pending: pendingTasks.length,
      completed: completedTasks.length,
      stateChanged
    });

    return instructions;
  }

  /**
   * Format full todo list (used when state changes)
   */
  private formatFullTodoList(
    inProgress: TodoItem[],
    pending: TodoItem[],
    completed: TodoItem[]
  ): string {
    const lines: string[] = [
      '## Current Task List'
    ];

    // In progress (most important)
    if (inProgress.length > 0) {
      lines.push('');
      lines.push('### Currently Working On:');
      for (const task of inProgress) {
        lines.push(`- **${task.activeForm}**`);
      }
    }

    // Pending
    if (pending.length > 0) {
      lines.push('');
      lines.push('### Pending Tasks:');
      for (const task of pending) {
        lines.push(`- [ ] ${task.content}`);
      }
    }

    // Completed (if showing)
    if (this.config.showCompleted && completed.length > 0) {
      lines.push('');
      lines.push('### Completed:');
      for (const task of completed.slice(-3)) { // Show last 3 completed
        lines.push(`- [x] ${task.content}`);
      }
    }

    // Add guidance
    lines.push('');
    lines.push('**Remember:** Complete the current in-progress task before starting new ones.');
    lines.push('Mark tasks as completed as soon as they are done.');

    return lines.join('\n');
  }

  /**
   * Format standard reminder
   */
  private formatStandardReminder(
    inProgress: TodoItem[],
    pending: TodoItem[]
  ): string {
    const lines: string[] = [];

    if (inProgress.length > 0) {
      lines.push(`**Current Task:** ${inProgress[0]!.activeForm}`);
    }

    if (pending.length > 0) {
      lines.push(`**Next:** ${pending[0]!.content}`);
      if (pending.length > 1) {
        lines.push(`(${pending.length - 1} more tasks pending)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format compact reminder (minimal tokens)
   */
  private formatCompactReminder(
    inProgress: TodoItem[],
    pending: TodoItem[]
  ): string {
    const parts: string[] = [];

    if (inProgress.length > 0) {
      parts.push(`Doing: ${inProgress[0]!.activeForm}`);
    }

    if (pending.length > 0) {
      const count = Math.min(pending.length, this.config.maxCompactItems);
      parts.push(`Next: ${pending.slice(0, count).map(t => t.content).join(', ')}`);
    }

    return parts.join(' | ');
  }

  /**
   * Compute hash of todo state for change detection
   */
  private computeStateHash(todos: TodoItem[]): string {
    // Create a deterministic string representation
    const stateString = todos
      .map(t => `${t.id}:${t.status}:${t.content}`)
      .sort()
      .join('|');

    return crypto
      .createHash('sha256')
      .update(stateString)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Get current configuration
   */
  getConfig(): TodoProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TodoProviderConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    logger.debug('TodoInstructionProvider config updated', {
      enabled: this.config.enabled,
      compactMode: this.config.compactMode
    });
  }

  /**
   * Reset state tracking (useful for testing)
   */
  reset(): void {
    this.lastStateHash = '';
    this.lastReminderTurn = 0;
    logger.debug('TodoInstructionProvider state reset');
  }
}

/**
 * Helper to create a TodoListState from an array of items
 */
export function createTodoListState(items: TodoItem[]): TodoListState {
  const hash = crypto
    .createHash('sha256')
    .update(items.map(t => `${t.id}:${t.status}`).join('|'))
    .digest('hex')
    .substring(0, 16);

  return {
    items,
    stateHash: hash,
    lastUpdated: Date.now()
  };
}

/**
 * Helper to create a TodoItem
 */
export function createTodoItem(
  content: string,
  activeForm: string,
  status: TodoItem['status'] = 'pending',
  id?: string
): TodoItem {
  return {
    id: id || crypto.randomUUID(),
    content,
    activeForm,
    status,
    createdAt: Date.now()
  };
}
