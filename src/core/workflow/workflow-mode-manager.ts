/**
 * Workflow Mode Manager
 *
 * Manages workflow mode state, transitions, and tool filtering.
 * Supports mode stacking for nested workflows.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type WorkflowMode,
  type WorkflowModeConfig,
  getWorkflowModeConfig,
  isToolAllowedInMode,
  WORKFLOW_MODE_CONFIGS
} from './workflow-mode.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext,
  INSTRUCTION_SOURCE
} from '../orchestration/types.js';

/**
 * Mode stack entry
 */
interface ModeStackEntry {
  /** The workflow mode */
  mode: WorkflowMode;
  /** When the mode was entered */
  enteredAt: number;
  /** Turn count when mode was entered */
  enteredAtTurn: number;
  /** Optional custom configuration overrides */
  customConfig?: Partial<WorkflowModeConfig>;
  /** Reason for entering this mode */
  reason?: string;
}

/**
 * Mode transition event
 */
export interface ModeTransitionEvent {
  /** Previous mode */
  from: WorkflowMode;
  /** New mode */
  to: WorkflowMode;
  /** Transition type */
  type: 'push' | 'pop' | 'replace';
  /** Timestamp */
  timestamp: number;
  /** Reason for transition */
  reason?: string;
}

/**
 * Mode transition listener
 */
export type ModeTransitionListener = (event: ModeTransitionEvent) => void;

/**
 * Workflow Mode Manager
 *
 * Manages the current workflow mode and provides mode-based
 * tool filtering and instruction injection.
 */
export class WorkflowModeManager implements InstructionProvider {
  readonly name = 'workflow-mode';

  private modeStack: ModeStackEntry[] = [];
  private transitionListeners: Set<ModeTransitionListener> = new Set();
  private turnCount: number = 0;

  constructor(initialMode: WorkflowMode = 'default') {
    this.modeStack.push({
      mode: initialMode,
      enteredAt: Date.now(),
      enteredAtTurn: 0,
      reason: 'initial'
    });

    logger.debug('WorkflowModeManager initialized', {
      initialMode
    });
  }

  /**
   * Get the top entry from the mode stack (private helper to reduce repetition)
   */
  private getTopEntry(): ModeStackEntry | undefined {
    return this.modeStack[this.modeStack.length - 1];
  }

  /**
   * Get the current active mode
   */
  getCurrentMode(): WorkflowMode {
    return this.getTopEntry()?.mode ?? 'default';
  }

  /**
   * Get the current mode configuration
   */
  getCurrentModeConfig(): WorkflowModeConfig {
    const mode = this.getCurrentMode();
    const entry = this.getTopEntry();
    const baseConfig = getWorkflowModeConfig(mode);

    // Merge custom config if present
    if (entry?.customConfig) {
      const mergedAutoExit = entry.customConfig.autoExitConditions || baseConfig.autoExitConditions
        ? {
            ...(baseConfig.autoExitConditions ?? {}),
            ...(entry.customConfig.autoExitConditions ?? {})
          }
        : undefined;

      return {
        ...baseConfig,
        ...entry.customConfig,
        // Deep merge for nested objects
        autoExitConditions: mergedAutoExit
      };
    }

    return baseConfig;
  }

  /**
   * Get the full mode stack
   */
  getModeStack(): ReadonlyArray<ModeStackEntry> {
    return [...this.modeStack];
  }

  /**
   * Get the current stack depth
   */
  getStackDepth(): number {
    return this.modeStack.length;
  }

  /**
   * Push a new mode onto the stack
   */
  pushMode(
    mode: WorkflowMode,
    options?: {
      customConfig?: Partial<WorkflowModeConfig>;
      reason?: string;
    }
  ): boolean {
    const currentConfig = this.getCurrentModeConfig();

    // Check if nesting is allowed
    if (!currentConfig.allowNesting) {
      logger.warn('Cannot push mode: current mode does not allow nesting', {
        currentMode: this.getCurrentMode(),
        attemptedMode: mode
      });
      return false;
    }

    // Check nesting depth
    const maxDepth = currentConfig.maxNestingDepth ?? 3;
    if (this.modeStack.length >= maxDepth) {
      logger.warn('Cannot push mode: max nesting depth reached', {
        currentDepth: this.modeStack.length,
        maxDepth
      });
      return false;
    }

    const previousMode = this.getCurrentMode();

    this.modeStack.push({
      mode,
      enteredAt: Date.now(),
      enteredAtTurn: this.turnCount,
      customConfig: options?.customConfig,
      reason: options?.reason
    });

    this.emitTransition({
      from: previousMode,
      to: mode,
      type: 'push',
      timestamp: Date.now(),
      reason: options?.reason
    });

    logger.info('Pushed workflow mode', {
      from: previousMode,
      to: mode,
      stackDepth: this.modeStack.length,
      reason: options?.reason
    });

    return true;
  }

  /**
   * Pop the current mode from the stack
   */
  popMode(reason?: string): WorkflowMode | null {
    // Cannot pop if only one mode on stack
    if (this.modeStack.length <= 1) {
      logger.warn('Cannot pop mode: at base level');
      return null;
    }

    const popped = this.modeStack.pop();
    const newMode = this.getCurrentMode();

    if (popped) {
      this.emitTransition({
        from: popped.mode,
        to: newMode,
        type: 'pop',
        timestamp: Date.now(),
        reason
      });

      logger.info('Popped workflow mode', {
        from: popped.mode,
        to: newMode,
        stackDepth: this.modeStack.length,
        reason
      });
    }

    return popped?.mode ?? null;
  }

  /**
   * Replace the current mode (pop then push)
   */
  replaceMode(
    mode: WorkflowMode,
    options?: {
      customConfig?: Partial<WorkflowModeConfig>;
      reason?: string;
    }
  ): boolean {
    const previousMode = this.getCurrentMode();

    // If at base level, just replace
    if (this.modeStack.length === 1) {
      this.modeStack[0] = {
        mode,
        enteredAt: Date.now(),
        enteredAtTurn: this.turnCount,
        customConfig: options?.customConfig,
        reason: options?.reason
      };
    } else {
      this.modeStack.pop();
      this.modeStack.push({
        mode,
        enteredAt: Date.now(),
        enteredAtTurn: this.turnCount,
        customConfig: options?.customConfig,
        reason: options?.reason
      });
    }

    this.emitTransition({
      from: previousMode,
      to: mode,
      type: 'replace',
      timestamp: Date.now(),
      reason: options?.reason
    });

    logger.info('Replaced workflow mode', {
      from: previousMode,
      to: mode,
      reason: options?.reason
    });

    return true;
  }

  /**
   * Set mode directly (clears stack and sets new base mode)
   */
  setMode(
    mode: WorkflowMode,
    options?: {
      customConfig?: Partial<WorkflowModeConfig>;
      reason?: string;
    }
  ): void {
    const previousMode = this.getCurrentMode();

    this.modeStack = [{
      mode,
      enteredAt: Date.now(),
      enteredAtTurn: this.turnCount,
      customConfig: options?.customConfig,
      reason: options?.reason
    }];

    this.emitTransition({
      from: previousMode,
      to: mode,
      type: 'replace',
      timestamp: Date.now(),
      reason: options?.reason
    });

    logger.info('Set workflow mode', {
      from: previousMode,
      to: mode,
      reason: options?.reason
    });
  }

  /**
   * Check if a tool is allowed in the current mode
   */
  isToolAllowed(tool: string): boolean {
    return isToolAllowedInMode(tool, this.getCurrentMode());
  }

  /**
   * Get list of blocked tools in current mode
   */
  getBlockedTools(): string[] {
    const config = this.getCurrentModeConfig();
    return config.blockedTools || [];
  }

  /**
   * Filter a list of tools based on current mode
   */
  filterTools<T extends { name: string }>(tools: T[]): T[] {
    return tools.filter(tool => this.isToolAllowed(tool.name));
  }

  /**
   * Update turn count (for auto-exit tracking)
   */
  updateTurnCount(turn: number): void {
    this.turnCount = turn;
    this.checkAutoExit();
  }

  /**
   * Check and handle auto-exit conditions
   */
  private checkAutoExit(): void {
    const config = this.getCurrentModeConfig();
    const entry = this.getTopEntry();

    if (!config.autoExitConditions || !entry) return;

    // Check max turns
    if (config.autoExitConditions.maxTurns) {
      const turnsInMode = this.turnCount - entry.enteredAtTurn;
      if (turnsInMode >= config.autoExitConditions.maxTurns) {
        logger.info('Auto-exiting mode due to max turns', {
          mode: this.getCurrentMode(),
          turnsInMode,
          maxTurns: config.autoExitConditions.maxTurns
        });
        this.popMode('max_turns_reached');
      }
    }
  }

  /**
   * Notify that a tool was used (for auto-exit on tool use)
   */
  notifyToolUsed(tool: string): void {
    const config = this.getCurrentModeConfig();

    if (config.autoExitConditions?.onToolUse?.includes(tool)) {
      logger.info('Auto-exiting mode due to tool use', {
        mode: this.getCurrentMode(),
        tool
      });
      this.popMode(`tool_used:${tool}`);
    }
  }

  /**
   * Add a mode transition listener
   */
  onTransition(listener: ModeTransitionListener): () => void {
    this.transitionListeners.add(listener);
    return () => this.transitionListeners.delete(listener);
  }

  /**
   * Emit a transition event to all listeners
   */
  private emitTransition(event: ModeTransitionEvent): void {
    for (const listener of this.transitionListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Mode transition listener error', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  // InstructionProvider implementation

  /**
   * Check if mode instructions should be generated
   */
  shouldGenerate(context: OrchestrationContext): boolean {
    // Always generate mode instructions if not in default mode
    return this.getCurrentMode() !== 'default';
  }

  /**
   * Get mode-specific instructions
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    const config = this.getCurrentModeConfig();
    const instructions: EmbeddedInstruction[] = [];

    // Only inject if there are system instructions
    if (config.systemInstructions && config.systemInstructions.length > 0) {
      instructions.push({
        type: 'mode',
        priority: 'high',
        content: config.systemInstructions,
        source: INSTRUCTION_SOURCE,
        createdAt: Date.now(),
        id: `mode-${config.name}-${Date.now()}`
      });
    }

    // Add tool restriction reminder if tools are blocked
    if (config.blockedTools && config.blockedTools.length > 0) {
      instructions.push({
        type: 'mode',
        priority: 'critical',
        content: `**Tool Restrictions:** The following tools are NOT available in ${config.displayName}: ${config.blockedTools.join(', ')}`,
        source: INSTRUCTION_SOURCE,
        createdAt: Date.now(),
        id: `mode-blocked-tools-${Date.now()}`
      });
    }

    return instructions;
  }

  /**
   * Reset to default state
   */
  reset(): void {
    const previousMode = this.getCurrentMode();
    this.modeStack = [{
      mode: 'default',
      enteredAt: Date.now(),
      enteredAtTurn: 0,
      reason: 'reset'
    }];
    this.turnCount = 0;

    if (previousMode !== 'default') {
      this.emitTransition({
        from: previousMode,
        to: 'default',
        type: 'replace',
        timestamp: Date.now(),
        reason: 'reset'
      });
    }

    logger.debug('WorkflowModeManager reset');
  }

  /**
   * Get status information for debugging
   */
  getStatus(): {
    currentMode: WorkflowMode;
    stackDepth: number;
    stack: Array<{ mode: WorkflowMode; enteredAt: number; reason?: string }>;
    blockedTools: string[];
    turnCount: number;
  } {
    return {
      currentMode: this.getCurrentMode(),
      stackDepth: this.modeStack.length,
      stack: this.modeStack.map(entry => ({
        mode: entry.mode,
        enteredAt: entry.enteredAt,
        reason: entry.reason
      })),
      blockedTools: this.getBlockedTools(),
      turnCount: this.turnCount
    };
  }
}
