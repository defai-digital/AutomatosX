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
  type OrchestrationContext,
  INSTRUCTION_SOURCE
} from '../core/orchestration/types.js';
import {
  type AgentDomain,
  type AgentInstructionTemplate,
  getAgentTemplate,
  getDelegationSuggestions,
  isValidAgentDomain
} from './instruction-templates.js';

/**
 * Context-aware keyword categories for boosting relevant instructions
 * @since v11.3.1
 */
export interface ContextKeywordCategory {
  /** Category name */
  name: string;
  /** Keywords that trigger this category */
  keywords: string[];
  /** Boost reminders from these domains */
  boostDomains: string[];
  /** Additional checklist items to inject */
  additionalChecklist: string[];
}

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
  /** v11.3.1: Enable context-aware instruction boosting */
  contextAwareBoosting: boolean;
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
  includeAntiPatterns: true,
  contextAwareBoosting: true
};

/**
 * Context keyword categories for boosting relevant instructions
 * @since v11.3.1
 */
const CONTEXT_KEYWORD_CATEGORIES: ContextKeywordCategory[] = [
  {
    name: 'security',
    keywords: ['auth', 'authentication', 'authorization', 'login', 'password', 'token', 'jwt', 'oauth', 'session', 'credential', 'encrypt', 'decrypt', 'hash', 'secret', 'permission', 'role', 'access control', 'csrf', 'xss', 'injection', 'sanitize', 'validate input'],
    boostDomains: ['security'],
    additionalChecklist: [
      'Validate all user input before processing',
      'Use parameterized queries to prevent injection',
      'Ensure sensitive data is not logged or exposed',
      'Implement proper session management',
      'Follow OWASP Top 10 guidelines'
    ]
  },
  {
    name: 'database',
    keywords: ['database', 'db', 'sql', 'query', 'migration', 'schema', 'table', 'index', 'transaction', 'orm', 'prisma', 'mongoose', 'postgresql', 'mysql', 'sqlite', 'redis', 'cache'],
    boostDomains: ['backend'],
    additionalChecklist: [
      'Use transactions for multi-step operations',
      'Add appropriate indexes for query performance',
      'Handle connection pooling properly',
      'Avoid N+1 query patterns',
      'Use prepared statements for security'
    ]
  },
  {
    name: 'api',
    keywords: ['api', 'endpoint', 'rest', 'graphql', 'request', 'response', 'http', 'status code', 'route', 'middleware', 'cors', 'rate limit'],
    boostDomains: ['backend'],
    additionalChecklist: [
      'Use appropriate HTTP status codes',
      'Validate request body and parameters',
      'Document API with clear examples',
      'Implement proper error responses',
      'Consider rate limiting for public endpoints'
    ]
  },
  {
    name: 'testing',
    keywords: ['test', 'testing', 'unit test', 'integration test', 'e2e', 'mock', 'stub', 'fixture', 'coverage', 'assert', 'expect', 'vitest', 'jest', 'cypress'],
    boostDomains: ['quality'],
    additionalChecklist: [
      'Test behavior, not implementation details',
      'Include edge cases and error scenarios',
      'Keep tests isolated and independent',
      'Use meaningful test descriptions',
      'Aim for high coverage on critical paths'
    ]
  },
  {
    name: 'performance',
    keywords: ['performance', 'optimize', 'slow', 'fast', 'latency', 'memory', 'cpu', 'bottleneck', 'profiling', 'benchmark', 'cache', 'lazy load', 'debounce', 'throttle'],
    boostDomains: ['backend', 'devops'],
    additionalChecklist: [
      'Profile before optimizing',
      'Consider caching for expensive operations',
      'Avoid premature optimization',
      'Measure impact of changes',
      'Watch for memory leaks'
    ]
  },
  {
    name: 'deployment',
    keywords: ['deploy', 'deployment', 'ci', 'cd', 'pipeline', 'docker', 'kubernetes', 'container', 'production', 'staging', 'environment', 'config', 'secret', 'infrastructure'],
    boostDomains: ['devops'],
    additionalChecklist: [
      'Never hardcode secrets or credentials',
      'Use environment variables for configuration',
      'Ensure rollback strategy exists',
      'Test in staging before production',
      'Monitor deployment health'
    ]
  },
  {
    name: 'frontend',
    keywords: ['ui', 'ux', 'component', 'react', 'vue', 'angular', 'css', 'style', 'responsive', 'accessibility', 'a11y', 'wcag', 'form', 'validation', 'state', 'render'],
    boostDomains: ['frontend'],
    additionalChecklist: [
      'Ensure accessibility (ARIA labels, keyboard nav)',
      'Handle loading and error states',
      'Optimize for performance (memo, lazy loading)',
      'Test across different screen sizes',
      'Validate forms with clear error messages'
    ]
  }
];

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

    const taskText = this.extractTaskText(context);

    // Check if reminder is due
    const turnsSinceReminder = context.turnCount - this.lastReminderTurn;
    const reminderDue = turnsSinceReminder >= this.config.reminderFrequency;

    // Check if quality check is due
    const turnsSinceQuality = context.turnCount - this.lastQualityCheckTurn;
    const qualityDue = this.config.includeQualityChecklist &&
      turnsSinceQuality >= this.config.qualityChecklistFrequency;

    // Check for delegation triggers
    const hasDelegationTriggers = this.config.delegationDetection &&
      taskText !== this.recentTaskText &&
      this.checkDelegationTriggers(context, domain, taskText);

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
        source: INSTRUCTION_SOURCE,
        createdAt: Date.now(),
        createdAtTurn: context.turnCount,
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
        source: INSTRUCTION_SOURCE,
        createdAt: Date.now(),
        createdAtTurn: context.turnCount,
        expiresAfter: this.config.qualityChecklistFrequency,
        id: `agent-quality-${domain}-${Date.now()}`
      });
      this.lastQualityCheckTurn = context.turnCount;
    }

    // Delegation suggestions
    const taskText = this.extractTaskText(context);
    if (this.config.delegationDetection) {
      if (taskText !== this.recentTaskText) {
        this.recentTaskText = taskText;
        const delegationContent = this.checkAndFormatDelegation(template, taskText);
        if (delegationContent) {
          instructions.push({
            type: 'delegation',
            priority: 'high',
            content: delegationContent,
            source: INSTRUCTION_SOURCE,
            createdAt: Date.now(),
            createdAtTurn: context.turnCount,
            expiresAfter: 3,
            id: `agent-delegation-${Date.now()}`
          });
        }
      }
    }

    // Context-aware instruction boosting (v11.3.1)
    if (this.config.contextAwareBoosting && taskText) {
      const detectedCategories = this.detectContextCategories(taskText);
      const contextBoostContent = this.formatContextBoost(detectedCategories);
      if (contextBoostContent) {
        instructions.push({
          type: 'context',
          priority: 'normal',
          content: contextBoostContent,
          source: INSTRUCTION_SOURCE,
          createdAt: Date.now(),
          createdAtTurn: context.turnCount,
          expiresAfter: 5,
          id: `agent-context-boost-${Date.now()}`
        });

        logger.debug('Context-aware boost applied', {
          categories: detectedCategories.map(c => c.name)
        });
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

    // Include in-progress todos (inline filter to avoid intermediate array)
    for (const todo of context.todos) {
      if (todo.status === 'in_progress') {
        parts.push(todo.content);
      }
    }

    return parts.join(' ');
  }

  /**
   * Check if delegation triggers are present
   */
  private checkDelegationTriggers(
    context: OrchestrationContext,
    domain?: AgentDomain,
    taskText?: string
  ): boolean {
    const resolvedDomain = domain ?? this.resolveDomain(context);
    if (!resolvedDomain) return false;

    const text = taskText ?? this.extractTaskText(context);
    if (!text) return false;

    const suggestions = getDelegationSuggestions(text, resolvedDomain);
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
   * Detect context categories from task text
   * @since v11.3.1
   */
  private detectContextCategories(taskText: string): ContextKeywordCategory[] {
    if (!taskText || !this.config.contextAwareBoosting) {
      return [];
    }

    const textLower = taskText.toLowerCase();
    const matchedCategories: ContextKeywordCategory[] = [];

    for (const category of CONTEXT_KEYWORD_CATEGORIES) {
      const matchCount = category.keywords.filter(kw =>
        textLower.includes(kw.toLowerCase())
      ).length;

      // Require at least 1 keyword match
      if (matchCount > 0) {
        matchedCategories.push(category);
      }
    }

    return matchedCategories;
  }

  /**
   * Format context-aware boosted instructions
   * @since v11.3.1
   */
  private formatContextBoost(categories: ContextKeywordCategory[]): string | null {
    if (categories.length === 0) {
      return null;
    }

    const lines: string[] = [];

    // Collect unique checklist items from matched categories
    const allChecklistItems = new Set<string>();
    const categoryNames: string[] = [];

    for (const category of categories) {
      categoryNames.push(category.name);
      for (const item of category.additionalChecklist.slice(0, 3)) {
        allChecklistItems.add(item);
      }
    }

    if (allChecklistItems.size === 0) {
      return null;
    }

    lines.push(`## Context-Aware Reminders (${categoryNames.join(', ')})`);
    lines.push('');
    lines.push('Based on task keywords, ensure you:');

    for (const item of Array.from(allChecklistItems).slice(0, 5)) {
      lines.push(`- ${item}`);
    }

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
