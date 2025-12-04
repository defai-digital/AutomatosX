/**
 * Agent Instruction Injector
 *
 * Provides domain-specific instructions for agents based on their specialization.
 * Detects delegation opportunities and injects quality reminders.
 *
 * @since v11.3.0
 */

import { logger } from '../shared/logging/logger.js';
import {
  type EmbeddedInstruction,
  type InstructionProvider,
  type OrchestrationContext
} from '../core/orchestration/types.js';
import {
  type AgentDomain,
  type AgentInstructionTemplate,
  getAgentTemplate,
  getDelegationSuggestions,
  isValidAgentDomain
} from './instruction-templates.js';

/**
 * Configuration for AgentInstructionInjector
 */
export interface AgentInjectorConfig {
  /** Whether the provider is enabled */
  enabled: boolean;
  /** How often to include domain reminders (every N turns) */
  reminderFrequency: number;
  /** Whether to detect and suggest delegation */
  delegationDetection: boolean;
  /** Minimum number of keywords to trigger delegation suggestion */
  minDelegationKeywords: number;
  /** Whether to include quality checklist */
  includeQualityChecklist: boolean;
  /** How often to include quality checklist (every N turns) */
  qualityChecklistFrequency: number;
  /** Whether to include anti-patterns warnings */
  includeAntiPatterns: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_AGENT_CONFIG: AgentInjectorConfig = {
  enabled: true,
  reminderFrequency: 5,
  delegationDetection: true,
  minDelegationKeywords: 1,
  includeQualityChecklist: true,
  qualityChecklistFrequency: 10,
  includeAntiPatterns: true
};

/**
 * Agent Instruction Injector
 *
 * Generates domain-specific instructions for agents.
 * Implements InstructionProvider interface for integration
 * with the orchestration system.
 */
export class AgentInstructionInjector implements InstructionProvider {
  readonly name = 'agent-template';

  private config: AgentInjectorConfig;
  private lastReminderTurn: number = 0;
  private lastQualityCheckTurn: number = 0;
  private currentDomain?: AgentDomain;
  private recentTaskText: string = '';

  constructor(config?: Partial<AgentInjectorConfig>) {
    this.config = {
      ...DEFAULT_AGENT_CONFIG,
      ...config
    };

    logger.debug('AgentInstructionInjector initialized', {
      enabled: this.config.enabled,
      reminderFrequency: this.config.reminderFrequency
    });
  }

  /**
   * Set the current agent domain
   */
  setDomain(domain: string): void {
    if (isValidAgentDomain(domain)) {
      this.currentDomain = domain;
      logger.debug('Agent domain set', { domain });
    } else {
      this.currentDomain = 'standard';
      logger.debug('Unknown domain, using standard', { domain });
    }
  }

  /**
   * Get the current domain
   */
  getDomain(): AgentDomain | undefined {
    return this.currentDomain;
  }

  /**
   * Check if provider should generate instructions
   */
  shouldGenerate(context: OrchestrationContext): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Determine domain from context or use current
    const domain = this.resolveDomain(context);
    if (!domain) {
      return false;
    }

    // Check if reminder is due
    const turnsSinceReminder = context.turnCount - this.lastReminderTurn;
    const reminderDue = turnsSinceReminder >= this.config.reminderFrequency;

    // Check if quality check is due
    const turnsSinceQuality = context.turnCount - this.lastQualityCheckTurn;
    const qualityDue = this.config.includeQualityChecklist &&
      turnsSinceQuality >= this.config.qualityChecklistFrequency;

    // Check for delegation triggers
    const hasDelegationTriggers = this.config.delegationDetection &&
      this.checkDelegationTriggers(context);

    return reminderDue || qualityDue || hasDelegationTriggers;
  }

  /**
   * Generate instructions based on agent domain
   */
  async getInstructions(context: OrchestrationContext): Promise<EmbeddedInstruction[]> {
    const instructions: EmbeddedInstruction[] = [];

    const domain = this.resolveDomain(context);
    if (!domain) {
      return instructions;
    }

    const template = getAgentTemplate(domain);
    const turnsSinceReminder = context.turnCount - this.lastReminderTurn;
    const turnsSinceQuality = context.turnCount - this.lastQualityCheckTurn;

    // Domain reminders
    if (turnsSinceReminder >= this.config.reminderFrequency) {
      const reminderContent = this.formatDomainReminders(template);
      instructions.push({
        type: 'delegation',
        priority: 'normal',
        content: reminderContent,
        source: 'automatosx',
        createdAt: Date.now(),
        expiresAfter: this.config.reminderFrequency,
        id: `agent-reminder-${domain}-${Date.now()}`
      });
      this.lastReminderTurn = context.turnCount;
    }

    // Quality checklist
    if (this.config.includeQualityChecklist &&
        turnsSinceQuality >= this.config.qualityChecklistFrequency) {
      const checklistContent = this.formatQualityChecklist(template);
      instructions.push({
        type: 'delegation',
        priority: 'normal',
        content: checklistContent,
        source: 'automatosx',
        createdAt: Date.now(),
        expiresAfter: this.config.qualityChecklistFrequency,
        id: `agent-quality-${domain}-${Date.now()}`
      });
      this.lastQualityCheckTurn = context.turnCount;
    }

    // Delegation suggestions
    if (this.config.delegationDetection) {
      const taskText = this.extractTaskText(context);
      if (taskText !== this.recentTaskText) {
        this.recentTaskText = taskText;
        const delegationContent = this.checkAndFormatDelegation(template, taskText);
        if (delegationContent) {
          instructions.push({
            type: 'delegation',
            priority: 'high',
            content: delegationContent,
            source: 'automatosx',
            createdAt: Date.now(),
            expiresAfter: 3,
            id: `agent-delegation-${Date.now()}`
          });
        }
      }
    }

    logger.debug('Agent instructions generated', {
      domain,
      instructionCount: instructions.length
    });

    return instructions;
  }

  /**
   * Resolve domain from context or current setting
   */
  private resolveDomain(context: OrchestrationContext): AgentDomain | undefined {
    // Try context agent name first
    if (context.agentName && isValidAgentDomain(context.agentName)) {
      return context.agentName;
    }

    // Fall back to current domain
    return this.currentDomain;
  }

  /**
   * Extract task text from context for delegation detection
   */
  private extractTaskText(context: OrchestrationContext): string {
    const parts: string[] = [];

    if (context.currentTask) {
      parts.push(context.currentTask);
    }

    // Include in-progress todos
    for (const todo of context.todos.filter(t => t.status === 'in_progress')) {
      parts.push(todo.content);
    }

    return parts.join(' ');
  }

  /**
   * Check if delegation triggers are present
   */
  private checkDelegationTriggers(context: OrchestrationContext): boolean {
    const domain = this.resolveDomain(context);
    if (!domain) return false;

    const taskText = this.extractTaskText(context);
    if (!taskText) return false;

    const suggestions = getDelegationSuggestions(taskText, domain);
    return suggestions.some(s => s.keywords.length >= this.config.minDelegationKeywords);
  }

  /**
   * Format domain reminders
   */
  private formatDomainReminders(template: AgentInstructionTemplate): string {
    const lines = [
      `## ${template.displayName} Reminders`,
      ''
    ];

    for (const reminder of template.domainReminders) {
      lines.push(`- ${reminder}`);
    }

    if (this.config.includeAntiPatterns && template.antiPatterns.length > 0) {
      lines.push('');
      lines.push('**Avoid:**');
      for (const antiPattern of template.antiPatterns.slice(0, 3)) {
        lines.push(`- ${antiPattern}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format quality checklist
   */
  private formatQualityChecklist(template: AgentInstructionTemplate): string {
    const lines = [
      `## Quality Checklist (${template.displayName})`,
      '',
      'Before completing, verify:'
    ];

    for (const item of template.qualityChecklist) {
      lines.push(`- [ ] ${item}`);
    }

    return lines.join('\n');
  }

  /**
   * Check for delegation triggers and format suggestion
   */
  private checkAndFormatDelegation(
    template: AgentInstructionTemplate,
    taskText: string
  ): string | null {
    const suggestions = getDelegationSuggestions(taskText, template.domain);
    const relevantSuggestions = suggestions.filter(
      s => s.keywords.length >= this.config.minDelegationKeywords
    );

    if (relevantSuggestions.length === 0) {
      return null;
    }

    const lines = [
      '## Delegation Suggestion',
      ''
    ];

    for (const suggestion of relevantSuggestions) {
      lines.push(`**Consider delegating to @${suggestion.agent}**`);
      lines.push(`- Reason: ${suggestion.reason}`);
      lines.push(`- Triggered by: ${suggestion.keywords.join(', ')}`);
      lines.push('');
    }

    lines.push('Use `DELEGATE TO @agent: task` or `@agent task` syntax to delegate.');

    return lines.join('\n');
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentInjectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AgentInjectorConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };

    logger.debug('AgentInstructionInjector config updated', {
      enabled: this.config.enabled
    });
  }

  /**
   * Reset state
   */
  reset(): void {
    this.lastReminderTurn = 0;
    this.lastQualityCheckTurn = 0;
    this.recentTaskText = '';
    logger.debug('AgentInstructionInjector reset');
  }
}
