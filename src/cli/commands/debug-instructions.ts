/**
 * Debug Instructions Command - Show current embedded instructions state
 *
 * @since v11.3.0
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { logger } from '../../shared/logging/logger.js';
import { OrchestrationService } from '../../core/orchestration/orchestration-service.js';
import { TokenBudgetManager } from '../../core/orchestration/token-budget.js';
import { WORKFLOW_MODES, type WorkflowMode } from '../../core/workflow/index.js';
import { AGENT_TEMPLATES, type AgentDomain } from '../../agents/instruction-templates.js';

interface DebugInstructionsOptions {
  tokens?: boolean;
  providers?: boolean;
  templates?: boolean;
  agent?: string;
  verbose?: boolean;
}

export const debugInstructionsCommand: CommandModule<Record<string, unknown>, DebugInstructionsOptions> = {
  command: 'debug:instructions',
  describe: 'Show current embedded instructions state (v11.3.0)',

  builder: (yargs) => {
    return yargs
      .option('tokens', {
        alias: 't',
        describe: 'Show token budget details',
        type: 'boolean',
        default: false
      })
      .option('providers', {
        alias: 'p',
        describe: 'Show registered instruction providers',
        type: 'boolean',
        default: false
      })
      .option('templates', {
        describe: 'Show available agent templates',
        type: 'boolean',
        default: false
      })
      .option('agent', {
        alias: 'a',
        describe: 'Show template for specific agent domain',
        type: 'string'
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show verbose output',
        type: 'boolean',
        default: false
      })
      .example('$0 debug:instructions', 'Show overall instruction state')
      .example('$0 debug:instructions --tokens', 'Show token budget details')
      .example('$0 debug:instructions --providers', 'List instruction providers')
      .example('$0 debug:instructions --templates', 'List agent templates')
      .example('$0 debug:instructions --agent backend', 'Show backend agent template');
  },

  handler: async (argv) => {
    try {
      // Show token budget details
      if (argv.tokens) {
        displayTokenBudget(argv.verbose);
        return;
      }

      // Show providers
      if (argv.providers) {
        displayProviders(argv.verbose);
        return;
      }

      // Show agent templates
      if (argv.templates) {
        displayAgentTemplates(argv.verbose);
        return;
      }

      // Show specific agent template
      if (argv.agent) {
        displayAgentTemplate(argv.agent, argv.verbose);
        return;
      }

      // Default: show overall state
      displayOverallState(argv.verbose);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Error: ${err.message}\n`));
      logger.error('Debug instructions command failed', { error: err.message });
      process.exit(1);
    }
  }
};

/**
 * Display overall orchestration state
 */
function displayOverallState(verbose?: boolean): void {
  console.log(chalk.blue.bold('\n🔍 Embedded Instructions Debug Info\n'));
  console.log(chalk.dim('═'.repeat(60)));

  // Orchestration service info
  const service = new OrchestrationService();
  const debugInfo = service.getDebugInfo();

  console.log(chalk.cyan('\n📊 Current State'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  Turn count: ${chalk.yellow(debugInfo.turnCount)}`);
  console.log(`  Workflow mode: ${chalk.cyan(debugInfo.workflowMode)}`);
  console.log(`  Active todos: ${chalk.yellow(debugInfo.todoCount)}`);
  console.log(`  Registered providers: ${chalk.green(debugInfo.providers.length)}`);

  // Token budget
  console.log(chalk.cyan('\n💰 Token Budget'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  Used: ${chalk.yellow(debugInfo.tokenBudget.used)} / ${debugInfo.tokenBudget.total}`);
  const usagePercent = Math.round((debugInfo.tokenBudget.used / debugInfo.tokenBudget.total) * 100);
  const barLength = 30;
  const filledLength = Math.round((usagePercent / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  const barColor = usagePercent > 80 ? chalk.red : usagePercent > 50 ? chalk.yellow : chalk.green;
  console.log(`  ${barColor(bar)} ${usagePercent}%`);

  // Providers list
  if (debugInfo.providers.length > 0) {
    console.log(chalk.cyan('\n🔌 Active Providers'));
    console.log(chalk.dim('─'.repeat(40)));
    debugInfo.providers.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${chalk.green(provider)}`);
    });
  }

  // Workflow modes
  console.log(chalk.cyan('\n🔄 Workflow Modes'));
  console.log(chalk.dim('─'.repeat(40)));
  Object.keys(WORKFLOW_MODES).forEach(mode => {
    const isCurrent = mode === debugInfo.workflowMode;
    const prefix = isCurrent ? chalk.green('►') : ' ';
    const modeText = isCurrent ? chalk.green.bold(mode) : chalk.gray(mode);
    console.log(`  ${prefix} ${modeText}`);
  });

  console.log(chalk.dim('\n' + '═'.repeat(60)));
  console.log(chalk.gray('\nUse --tokens, --providers, or --templates for detailed info.\n'));
}

/**
 * Display token budget details
 */
function displayTokenBudget(verbose?: boolean): void {
  console.log(chalk.blue.bold('\n💰 Token Budget Details\n'));
  console.log(chalk.dim('─'.repeat(50)));

  const budgetManager = new TokenBudgetManager();
  const config = budgetManager.getConfig();

  console.log(`\n  Total budget: ${chalk.cyan(config.maxTotal)} tokens`);
  console.log(`  Critical reserve: ${chalk.yellow(config.criticalReserve)} tokens`);
  console.log(`  Available: ${chalk.green(config.maxTotal - config.criticalReserve)} tokens`);

  // Per-type budgets
  console.log(chalk.cyan('\n  Per-Type Allocations:'));
  const typeAllocations = [
    { type: 'task', budget: 500, description: 'Todo/task reminders' },
    { type: 'memory', budget: 400, description: 'Memory context' },
    { type: 'session', budget: 300, description: 'Session state' },
    { type: 'delegation', budget: 300, description: 'Agent delegation hints' },
    { type: 'mode', budget: 200, description: 'Workflow mode instructions' }
  ];

  typeAllocations.forEach(({ type, budget, description }) => {
    console.log(`    • ${chalk.cyan(type)}: ${budget} tokens`);
    if (verbose) {
      console.log(chalk.gray(`      ${description}`));
    }
  });

  // Estimation info
  console.log(chalk.cyan('\n  Token Estimation:'));
  console.log(chalk.gray('    ~4 characters = 1 token (approximation)'));
  console.log(chalk.gray('    Actual usage may vary by content'));

  console.log(chalk.dim('\n─'.repeat(50)));
  console.log();
}

/**
 * Display registered providers
 */
function displayProviders(verbose?: boolean): void {
  console.log(chalk.blue.bold('\n🔌 Instruction Providers\n'));
  console.log(chalk.dim('─'.repeat(50)));

  const providers = [
    {
      name: 'TodoInstructionProvider',
      description: 'Generates task reminders from todo list',
      triggers: 'Todo state changes, periodic reminders',
      priority: 'high'
    },
    {
      name: 'MemoryInstructionProvider',
      description: 'Injects relevant context from memory',
      triggers: 'Task keywords, memory relevance',
      priority: 'normal'
    },
    {
      name: 'SessionInstructionProvider',
      description: 'Shows multi-agent collaboration state',
      triggers: 'Session changes, periodic reminders',
      priority: 'normal'
    },
    {
      name: 'AgentInstructionInjector',
      description: 'Domain-specific reminders and delegation hints',
      triggers: 'Agent domain, task keywords',
      priority: 'normal'
    },
    {
      name: 'WorkflowModeManager',
      description: 'Mode-specific instructions and tool filtering',
      triggers: 'Mode changes',
      priority: 'high'
    }
  ];

  providers.forEach((provider, index) => {
    console.log(`\n  ${index + 1}. ${chalk.cyan.bold(provider.name)}`);
    console.log(chalk.gray(`     ${provider.description}`));
    if (verbose) {
      console.log(`     Triggers: ${chalk.yellow(provider.triggers)}`);
      console.log(`     Priority: ${chalk.green(provider.priority)}`);
    }
  });

  console.log(chalk.dim('\n─'.repeat(50)));
  console.log();
}

/**
 * Display available agent templates
 */
function displayAgentTemplates(verbose?: boolean): void {
  console.log(chalk.blue.bold('\n📋 Agent Instruction Templates\n'));
  console.log(chalk.dim('─'.repeat(50)));

  for (const [domain, template] of Object.entries(AGENT_TEMPLATES)) {
    console.log(`\n  ${chalk.cyan.bold(template.displayName)} (${domain})`);

    if (verbose) {
      console.log(chalk.gray(`    Reminders: ${template.domainReminders.length}`));
      console.log(chalk.gray(`    Checklist items: ${template.qualityChecklist.length}`));
      console.log(chalk.gray(`    Delegation triggers: ${template.delegationTriggers.length}`));
      console.log(chalk.gray(`    Anti-patterns: ${template.antiPatterns.length}`));
      console.log(chalk.gray(`    Best practices: ${template.bestPractices.length}`));
    }
  }

  console.log(chalk.dim('\n─'.repeat(50)));
  console.log(chalk.gray('\nUse --agent <domain> to see template details.\n'));
}

/**
 * Display specific agent template
 */
function displayAgentTemplate(domain: string, verbose?: boolean): void {
  const template = AGENT_TEMPLATES[domain as AgentDomain];

  if (!template) {
    console.error(chalk.red.bold(`\n❌ Unknown agent domain: ${domain}\n`));
    console.log(chalk.gray('Available domains:'));
    Object.keys(AGENT_TEMPLATES).forEach(d => {
      console.log(chalk.cyan(`  • ${d}`));
    });
    console.log();
    process.exit(1);
  }

  console.log(chalk.blue.bold(`\n📋 ${template.displayName} Agent Template\n`));
  console.log(chalk.dim('═'.repeat(60)));

  // Domain reminders
  console.log(chalk.cyan('\n🔔 Domain Reminders:'));
  template.domainReminders.forEach((reminder, i) => {
    console.log(`  ${i + 1}. ${reminder}`);
  });

  // Quality checklist
  console.log(chalk.cyan('\n✅ Quality Checklist:'));
  template.qualityChecklist.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item}`);
  });

  // Delegation triggers
  if (template.delegationTriggers.length > 0) {
    console.log(chalk.cyan('\n🔀 Delegation Triggers:'));
    template.delegationTriggers.forEach((trigger, i) => {
      console.log(`  ${i + 1}. → ${chalk.yellow(trigger.suggestedAgent)}`);
      console.log(chalk.gray(`     Keywords: ${trigger.keywords.join(', ')}`));
      if (verbose) {
        console.log(chalk.gray(`     Reason: ${trigger.reason}`));
      }
    });
  }

  // Anti-patterns
  if (verbose && template.antiPatterns.length > 0) {
    console.log(chalk.red('\n⚠️  Anti-Patterns to Avoid:'));
    template.antiPatterns.forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern}`);
    });
  }

  // Best practices
  if (verbose && template.bestPractices.length > 0) {
    console.log(chalk.green('\n✨ Best Practices:'));
    template.bestPractices.forEach((practice, i) => {
      console.log(`  ${i + 1}. ${practice}`);
    });
  }

  console.log(chalk.dim('\n═'.repeat(60)));
  console.log();
}
