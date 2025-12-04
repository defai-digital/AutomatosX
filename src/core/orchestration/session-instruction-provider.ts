/**
 * Session Instruction Provider
 *
 * Generates embedded instructions based on session state.
 * Provides context about multi-agent collaboration and session progress.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext
} from './types.js';

/**
 * Session state information
 */
export interface SessionState {
  /** Session ID */
  id: string;
  /** Agents that have participated */
  participants: string[];
  /** Current active agent */
  activeAgent?: string;
  /** Tasks completed in this session */
  completedTasks: number;
  /** Tasks remaining */
  remainingTasks: number;
  /** Session start time */
  startedAt: number;
  /** Last activity time */
  lastActivityAt: number;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session state provider interface
 */
export interface SessionStateProvider {
  /**
   * Get current session state
   */
  getSessionState(sessionId: string): Promise<SessionState | null>;

  /**
   * Get list of active sessions
   */
  getActiveSessions(): Promise<string[]>;
}

/**
 * Configuration for SessionInstructionProvider
 */
export interface SessionProviderConfig {
  /** Whether the provider is enabled */
  enabled: boolean;
  /** Whether to show collaboration status */
  showCollaboration: boolean;
  /** Whether to show session progress */
  showProgress: boolean;
  /** How often to include session reminders (every N turns) */
  reminderFrequency: number;
  /** Whether to show handoff context */
  showHandoffContext: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_SESSION_CONFIG: SessionProviderConfig = {
  enabled: true,
  showCollaboration: true,
  showProgress: true,
  reminderFrequency: 5,
  showHandoffContext: true
};

/**
 * Session Instruction Provider
 *
 * Generates instructions based on the current session state,
 * including multi-agent collaboration context.
 */
export class SessionInstructionProvider implements InstructionProvider {
  readonly name = 'session';

  private config: SessionProviderConfig;
  private stateProvider?: SessionStateProvider;
  private lastReminderTurn: number = 0;
  private cachedState?: SessionState;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    stateProvider?: SessionStateProvider,
    config?: Partial<SessionProviderConfig>
  ) {
    this.config = {
      ...DEFAULT_SESSION_CONFIG,
      ...config
    };
    this.stateProvider = stateProvider;

    logger.debug('SessionInstructionProvider initialized', {
      enabled: this.config.enabled,
      hasStateProvider: !!stateProvider
    });
  }

  /**
   * Set the session state provider
   */
  setStateProvider(provider: SessionStateProvider): void {
    this.stateProvider = provider;
    this.clearCache();
    logger.debug('Session state provider set');
  }

  /**
   * Check if provider should generate instructions
   */
  shouldGenerate(context: OrchestrationContext): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Need either a session ID or a state provider
    if (!context.sessionId && !this.stateProvider) {
      return false;
    }

    // Check if reminder is due
    const turnsSinceReminder = context.turnCount - this.lastReminderTurn;
    return turnsSinceReminder >= this.config.reminderFrequency;
  }

  /**
   * Generate instructions based on session state
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    const instructions: EmbeddedInstruction[] = [];

    // Get session state
    const state = await this.getSessionState(context);

    if (!state && !context.sessionId) {
      return instructions;
    }

    const content = this.formatSessionContext(context, state);

    if (content) {
      instructions.push({
        type: 'session',
        priority: 'normal',
        content,
        source: 'automatosx',
        createdAt: Date.now(),
        expiresAfter: this.config.reminderFrequency,
        id: `session-${context.sessionId || 'default'}-${Date.now()}`
      });
    }

    this.lastReminderTurn = context.turnCount;

    logger.debug('Session instructions generated', {
      sessionId: context.sessionId,
      hasState: !!state
    });

    return instructions;
  }

  /**
   * Get session state from provider or cache
   */
  private async getSessionState(
    context: OrchestrationContext
  ): Promise<SessionState | null> {
    if (!context.sessionId) {
      return null;
    }

    // Check cache
    if (this.cachedState &&
        this.cachedState.id === context.sessionId &&
        Date.now() < this.cacheExpiry) {
      return this.cachedState;
    }

    // Fetch from provider
    if (!this.stateProvider) {
      return null;
    }

    try {
      const state = await this.stateProvider.getSessionState(context.sessionId);
      if (state) {
        this.cachedState = state;
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
      }
      return state;
    } catch (error) {
      logger.error('Failed to get session state', {
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Format session context into instruction content
   */
  private formatSessionContext(
    context: OrchestrationContext,
    state: SessionState | null
  ): string | null {
    const lines: string[] = [];

    // Session header
    if (context.sessionId) {
      lines.push('## Session Context');
      lines.push('');
    }

    // Collaboration status
    if (this.config.showCollaboration && state && state.participants.length > 1) {
      lines.push('### Multi-Agent Collaboration');
      lines.push(`- **Session:** ${state.id.substring(0, 8)}...`);
      lines.push(`- **Participants:** ${state.participants.join(', ')}`);
      if (state.activeAgent) {
        lines.push(`- **Currently Active:** ${state.activeAgent}`);
      }
      lines.push('');
    }

    // Progress
    if (this.config.showProgress && state) {
      const totalTasks = state.completedTasks + state.remainingTasks;
      if (totalTasks > 0) {
        const progress = Math.round((state.completedTasks / totalTasks) * 100);
        lines.push('### Session Progress');
        lines.push(`- Completed: ${state.completedTasks}/${totalTasks} (${progress}%)`);
        if (state.remainingTasks > 0) {
          lines.push(`- Remaining: ${state.remainingTasks} task(s)`);
        }
        lines.push('');
      }
    }

    // Handoff context
    if (this.config.showHandoffContext && context.parentAgent) {
      lines.push('### Delegation Context');
      lines.push(`- **Delegated from:** ${context.parentAgent}`);
      if (context.currentTask) {
        lines.push(`- **Task:** ${context.currentTask}`);
      }
      lines.push('');
      lines.push('**Note:** Complete this task and return control to the parent agent.');
      lines.push('');
    }

    // Agent name reminder
    if (context.agentName && !context.parentAgent) {
      lines.push(`**Current Agent:** ${context.agentName}`);
      lines.push('');
    }

    if (lines.length <= 2) {
      return null; // No meaningful content
    }

    return lines.join('\n');
  }

  /**
   * Clear cached state
   */
  clearCache(): void {
    this.cachedState = undefined;
    this.cacheExpiry = 0;
    logger.debug('Session cache cleared');
  }

  /**
   * Get current configuration
   */
  getConfig(): SessionProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SessionProviderConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    logger.debug('SessionInstructionProvider config updated', {
      enabled: this.config.enabled
    });
  }

  /**
   * Reset state
   */
  reset(): void {
    this.lastReminderTurn = 0;
    this.clearCache();
    logger.debug('SessionInstructionProvider reset');
  }

  /**
   * Check if state provider is configured
   */
  hasStateProvider(): boolean {
    return !!this.stateProvider;
  }
}

/**
 * Create a mock session state provider for testing
 */
export function createMockSessionProvider(
  sessions: Record<string, SessionState> = {}
): SessionStateProvider {
  return {
    async getSessionState(sessionId: string): Promise<SessionState | null> {
      return sessions[sessionId] || null;
    },

    async getActiveSessions(): Promise<string[]> {
      return Object.keys(sessions);
    }
  };
}

/**
 * Create a mock session state for testing
 */
export function createMockSessionState(
  overrides?: Partial<SessionState>
): SessionState {
  return {
    id: 'test-session-' + Date.now(),
    participants: ['backend'],
    completedTasks: 0,
    remainingTasks: 0,
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides
  };
}
