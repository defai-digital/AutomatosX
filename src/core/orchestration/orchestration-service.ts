/**
 * Orchestration Service
 *
 * Central service that coordinates all embedded instruction providers
 * and integrates with the agent execution pipeline.
 *
 * @since v11.3.0
 */

import { logger } from '../../shared/logging/logger.js';
import {
  type OrchestrationContext,
  type EmbeddedInstruction,
  type OrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG
} from './types.js';
import { OrchestrationInstructionInjector } from './instruction-injector.js';
import { TodoInstructionProvider } from './todo-instruction-provider.js';
import { MemoryInstructionProvider, type MemorySearchProvider } from './memory-instruction-provider.js';
import { SessionInstructionProvider, type SessionStateProvider } from './session-instruction-provider.js';
import { WorkflowModeManager, isValidWorkflowMode } from '../workflow/index.js';
import { AgentInstructionInjector, type AgentInjectorConfig } from '../../agents/agent-instruction-injector.js';
import type { TodoItem } from './types.js';

/**
 * Orchestration service configuration
 */
export interface OrchestrationServiceConfig extends Partial<OrchestrationConfig> {
  /** Memory search provider for context injection */
  memorySearchProvider?: MemorySearchProvider;
  /** Session state provider for multi-agent context */
  sessionStateProvider?: SessionStateProvider;
  /** Current agent domain for agent-specific instructions */
  agentDomain?: string;
}

/**
 * Result of instruction injection (service-level)
 */
export interface ServiceInjectionResult {
  /** Formatted instructions to inject */
  content: string;
  /** Individual instructions generated */
  instructions: EmbeddedInstruction[];
  /** Token count estimation */
  tokenCount: number;
  /** Whether injection was applied */
  applied: boolean;
}

/**
 * Orchestration Service
 *
 * Provides a unified interface for managing embedded instructions
 * across the entire agent execution pipeline.
 */
export class OrchestrationService {
  private config: OrchestrationConfig;
  private injector: OrchestrationInstructionInjector;
  private workflowModeManager: WorkflowModeManager;
  private agentInjector: AgentInstructionInjector;

  private todoProvider?: TodoInstructionProvider;
  private memoryProvider?: MemoryInstructionProvider;
  private sessionProvider?: SessionInstructionProvider;

  private turnCount: number = 0;
  private currentTodos: TodoItem[] = [];

  constructor(serviceConfig: OrchestrationServiceConfig = {}) {
    this.config = {
      ...DEFAULT_ORCHESTRATION_CONFIG,
      ...serviceConfig
    };

    // Initialize core components
    this.injector = new OrchestrationInstructionInjector(this.config);
    this.workflowModeManager = new WorkflowModeManager();
    this.agentInjector = new AgentInstructionInjector({
      enabled: this.config.agentTemplates?.enabled ?? true,
      reminderFrequency: this.config.agentTemplates?.reminderFrequency ?? 5
    });

    // Initialize providers based on config
    this.initializeProviders(serviceConfig);

    logger.debug('OrchestrationService initialized', {
      todoEnabled: this.config.todoIntegration?.enabled,
      memoryEnabled: this.config.memoryIntegration?.enabled,
      sessionEnabled: this.config.sessionIntegration?.enabled,
      agentTemplatesEnabled: this.config.agentTemplates?.enabled
    });
  }

  /**
   * Initialize instruction providers
   */
  private initializeProviders(serviceConfig: OrchestrationServiceConfig): void {
    // Todo provider
    if (this.config.todoIntegration?.enabled !== false) {
      this.todoProvider = new TodoInstructionProvider({
        enabled: true,
        reminderFrequency: this.config.todoIntegration?.reminderFrequency ?? 3,
        compactMode: this.config.todoIntegration?.compactMode ?? false
      });
      this.injector.registerProvider(this.todoProvider);
    }

    // Memory provider
    if (this.config.memoryIntegration?.enabled !== false && serviceConfig.memorySearchProvider) {
      this.memoryProvider = new MemoryInstructionProvider(
        serviceConfig.memorySearchProvider,
        {
          enabled: true,
          maxEntries: this.config.memoryIntegration?.maxEntries ?? 5,
          minRelevance: this.config.memoryIntegration?.minRelevance ?? 0.5
        }
      );
      this.injector.registerProvider(this.memoryProvider);
    }

    // Session provider
    if (this.config.sessionIntegration?.enabled !== false) {
      this.sessionProvider = new SessionInstructionProvider(
        serviceConfig.sessionStateProvider,
        {
          enabled: true,
          showCollaboration: this.config.sessionIntegration?.showCollaboration ?? true,
          showProgress: true,
          reminderFrequency: 5,
          showHandoffContext: true
        }
      );
      this.injector.registerProvider(this.sessionProvider);
    }

    // Agent instruction injector (register as provider)
    if (this.config.agentTemplates?.enabled !== false) {
      if (serviceConfig.agentDomain) {
        this.agentInjector.setDomain(serviceConfig.agentDomain);
      }
      this.injector.registerProvider(this.agentInjector);
    }
  }

  /**
   * Set the current agent domain for agent-specific instructions
   */
  setAgentDomain(domain: string): void {
    this.agentInjector.setDomain(domain);
    logger.debug('Agent domain set', { domain });
  }

  /**
   * Set the memory search provider
   */
  setMemoryProvider(provider: MemorySearchProvider): void {
    if (this.memoryProvider) {
      this.memoryProvider.setSearchProvider(provider);
    } else if (this.config.memoryIntegration?.enabled !== false) {
      this.memoryProvider = new MemoryInstructionProvider(provider, {
        enabled: true,
        maxEntries: this.config.memoryIntegration?.maxEntries ?? 5,
        minRelevance: this.config.memoryIntegration?.minRelevance ?? 0.5
      });
      this.injector.registerProvider(this.memoryProvider);
    }
  }

  /**
   * Set the session state provider
   */
  setSessionProvider(provider: SessionStateProvider): void {
    if (this.sessionProvider) {
      this.sessionProvider.setStateProvider(provider);
    }
  }

  /**
   * Update the current todo list
   */
  updateTodos(todos: TodoItem[]): void {
    this.currentTodos = todos;
  }

  /**
   * Set the workflow mode
   *
   * @throws Error if mode is not a valid WorkflowMode
   */
  setWorkflowMode(mode: string): void {
    if (!isValidWorkflowMode(mode)) {
      throw new Error(`Invalid workflow mode: ${mode}. Valid modes: default, plan, iterate, review`);
    }
    this.workflowModeManager.setMode(mode);
    logger.debug('Workflow mode set', { mode });
  }

  /**
   * Get current workflow mode
   */
  getWorkflowMode(): string {
    return this.workflowModeManager.getCurrentMode();
  }

  /**
   * Check if a tool is allowed in current workflow mode
   */
  isToolAllowed(toolName: string): boolean {
    return this.workflowModeManager.isToolAllowed(toolName);
  }

  /**
   * Filter tools based on current workflow mode
   */
  filterTools<T extends { name: string }>(tools: T[]): T[] {
    return this.workflowModeManager.filterTools(tools);
  }

  /**
   * Increment turn count (called after each agent response)
   */
  incrementTurn(): void {
    this.turnCount++;
    this.workflowModeManager.updateTurnCount(this.turnCount);
  }

  /**
   * Get current turn count
   */
  getTurnCount(): number {
    return this.turnCount;
  }

  /**
   * Generate and inject instructions for the current context
   */
  async injectInstructions(options: {
    task?: string;
    agentName?: string;
    sessionId?: string;
    parentAgent?: string;
  } = {}): Promise<ServiceInjectionResult> {
    const context: OrchestrationContext = {
      todos: this.currentTodos,
      turnCount: this.turnCount,
      workflowMode: this.workflowModeManager.getCurrentMode(),
      currentTask: options.task,
      agentName: options.agentName,
      sessionId: options.sessionId,
      parentAgent: options.parentAgent
    };

    const result = await this.injector.inject(context);

    logger.debug('Instructions injected', {
      instructionCount: result.instructions.length,
      tokensUsed: result.allocation.tokensUsed,
      hasInstructions: result.hasInstructions
    });

    return {
      content: result.formattedText,
      instructions: result.instructions,
      tokenCount: result.allocation.tokensUsed,
      applied: result.hasInstructions
    };
  }

  /**
   * Format instructions as system reminder tags
   */
  formatAsSystemReminder(content: string): string {
    if (!content || content.trim().length === 0) {
      return '';
    }
    return `<system-reminder>\n${content}\n</system-reminder>`;
  }

  /**
   * Get debug information about current orchestration state
   */
  getDebugInfo(): {
    turnCount: number;
    workflowMode: string;
    todoCount: number;
    providers: string[];
    tokenBudget: { used: number; total: number; remaining: number };
  } {
    const budgetConfig = this.injector.getBudgetManager().getConfig();
    const providers = this.injector.getProviders().map(p => p.name);

    return {
      turnCount: this.turnCount,
      workflowMode: this.workflowModeManager.getCurrentMode(),
      todoCount: this.currentTodos.length,
      providers,
      tokenBudget: {
        used: 0, // Would need to track this
        total: budgetConfig.maxTotal,
        remaining: budgetConfig.maxTotal
      }
    };
  }

  /**
   * Reset all state (for new conversations)
   */
  reset(): void {
    this.turnCount = 0;
    this.currentTodos = [];
    this.workflowModeManager.reset();
    this.agentInjector.reset();
    this.injector.clearCache();

    if (this.todoProvider) {
      this.todoProvider.reset();
    }
    if (this.memoryProvider) {
      this.memoryProvider.clearCache();
    }
    if (this.sessionProvider) {
      this.sessionProvider.reset();
    }

    logger.debug('OrchestrationService reset');
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestrationConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      tokenBudget: updates.tokenBudget
        ? { ...this.config.tokenBudget, ...updates.tokenBudget }
        : this.config.tokenBudget,
      todoIntegration: updates.todoIntegration
        ? { ...this.config.todoIntegration, ...updates.todoIntegration }
        : this.config.todoIntegration,
      memoryIntegration: updates.memoryIntegration
        ? { ...this.config.memoryIntegration, ...updates.memoryIntegration }
        : this.config.memoryIntegration,
      sessionIntegration: updates.sessionIntegration
        ? { ...this.config.sessionIntegration, ...updates.sessionIntegration }
        : this.config.sessionIntegration,
      agentTemplates: updates.agentTemplates
        ? { ...this.config.agentTemplates, ...updates.agentTemplates }
        : this.config.agentTemplates
    };

    // Update child components (injector handles its own tokenBudget updates)
    this.injector.updateConfig(updates);

    if (updates.todoIntegration && this.todoProvider) {
      const current = this.todoProvider.getConfig();
      this.todoProvider.updateConfig({
        enabled: updates.todoIntegration.enabled ?? current.enabled,
        reminderFrequency: updates.todoIntegration.reminderFrequency ?? current.reminderFrequency,
        compactMode: updates.todoIntegration.compactMode ?? current.compactMode
      });
    }

    if (updates.memoryIntegration && this.memoryProvider) {
      const current = this.memoryProvider.getConfig();
      this.memoryProvider.updateConfig({
        enabled: updates.memoryIntegration.enabled ?? current.enabled,
        maxEntries: updates.memoryIntegration.maxEntries ?? current.maxEntries,
        minRelevance: updates.memoryIntegration.minRelevance ?? current.minRelevance
      });
    }

    if (updates.sessionIntegration && this.sessionProvider) {
      const current = this.sessionProvider.getConfig();
      this.sessionProvider.updateConfig({
        enabled: updates.sessionIntegration.enabled ?? current.enabled,
        showCollaboration: updates.sessionIntegration.showCollaboration ?? current.showCollaboration
      });
    }

    if (updates.agentTemplates) {
      const agentUpdates: Partial<AgentInjectorConfig> = {};
      if (updates.agentTemplates.enabled !== undefined) {
        agentUpdates.enabled = updates.agentTemplates.enabled;
      }
      if (updates.agentTemplates.reminderFrequency !== undefined) {
        agentUpdates.reminderFrequency = updates.agentTemplates.reminderFrequency;
      }
      this.agentInjector.updateConfig(agentUpdates);
    }

    logger.debug('OrchestrationService config updated', { updates });
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestrationConfig {
    return { ...this.config };
  }
}

/**
 * Create a pre-configured orchestration service
 */
export function createOrchestrationService(
  config?: OrchestrationServiceConfig
): OrchestrationService {
  return new OrchestrationService(config);
}
