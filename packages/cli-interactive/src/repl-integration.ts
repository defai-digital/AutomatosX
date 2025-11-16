/**
 * REPL Integration Module
 *
 * Integrates P0 features into the REPL:
 * - Intent classification (natural language → commands)
 * - Command palette (contextual suggestions)
 * - Progressive help
 * - Onboarding
 *
 * To integrate into existing repl.ts:
 * 1. Import this module
 * 2. Call enhanceREPLWithP0Features()
 * 3. Use handleInputWithIntent() instead of direct command routing
 */

import { classifyIntent, detectConfirmation } from './intent-classifier.js';
import {
  generateQuickActions,
  renderQuickActions,
  detectPaletteContext
} from './command-palette.js';
import {
  renderProgressiveHelp,
  renderCategoryHelp,
  getContextualHelp
} from './progressive-help.js';
import {
  runOnboardingWizard,
  hasCompletedOnboarding,
  showQuickTipsBanner
} from './onboarding.js';
import type { CommandContext, Conversation } from './types.js';
import { routeCommand, getAllCommands } from './commands.js';
import chalk from 'chalk';

/**
 * Enhanced input handler with intent classification
 */
export async function handleInputWithIntent(
  input: string,
  context: CommandContext
): Promise<{
  handled: boolean;
  isCommand: boolean;
  originalCommand?: string;
  detectedIntent?: string;
}> {
  const trimmed = input.trim();

  // Empty input
  if (!trimmed) {
    return { handled: false, isCommand: false };
  }

  // 1. Check for slash commands (traditional mode)
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    if (!command) {
      return {
        handled: false,
        isCommand: false
      };
    }

    await routeCommand(command, args, context);

    return {
      handled: true,
      isCommand: true,
      originalCommand: command
    };
  }

  // 2. Check for confirmation responses (approval workflow)
  const confirmation = detectConfirmation(trimmed);
  if (confirmation !== null) {
    // Return confirmation for approval system to handle
    return {
      handled: false, // Let caller handle this
      isCommand: false
    };
  }

  // 3. Try intent classification (natural language)
  const intent = classifyIntent(trimmed);

  if (intent) {
    // Display what we detected
    console.log(chalk.dim(`  → Detected: ${intent.reason}`));
    console.log('');

    // Route to command handler
    await routeCommand(intent.command, intent.args, context);

    return {
      handled: true,
      isCommand: true,
      originalCommand: intent.command,
      detectedIntent: trimmed
    };
  }

  // 4. No intent detected - treat as natural conversation
  return {
    handled: false,
    isCommand: false
  };
}

/**
 * Show command palette after AI responses
 */
export function showCommandPalette(conversation: Conversation): void {
  const paletteContext = detectPaletteContext(conversation.messages);
  const actions = generateQuickActions(paletteContext);

  if (actions.length > 0) {
    const rendered = renderQuickActions(actions);
    console.log(rendered);
  }
}

/**
 * Show contextual help based on recent activity
 */
export function showContextualHelp(context: {
  lastCommand?: string;
  lastError?: string;
  messageCount: number;
}): void {
  const tip = getContextualHelp(context);
  if (tip) {
    console.log(tip);
  }
}

/**
 * Enhanced help command that uses progressive disclosure
 */
export async function handleEnhancedHelp(
  args: string[],
  _context: CommandContext
): Promise<void> {
  const allCommands = getAllCommands();

  if (args.length === 0) {
    // Show main progressive help
    const helpText = renderProgressiveHelp(allCommands);
    console.log(helpText);
  } else {
    // Show category-specific help
    const category = args.join(' ');
    const categoryHelp = renderCategoryHelp(category, allCommands);
    console.log(categoryHelp);
  }
}

/**
 * Check and run onboarding for first-time users
 */
export async function checkAndRunOnboarding(): Promise<void> {
  if (!hasCompletedOnboarding()) {
    await runOnboardingWizard();
  } else {
    // Show quick tips for returning users
    showQuickTipsBanner();
  }
}

/**
 * Main enhancement function - call this when initializing REPL
 */
export async function enhanceREPLWithP0Features(): Promise<void> {
  // Check and run onboarding for first-time users
  await checkAndRunOnboarding();
}

/**
 * Usage example for integration into repl.ts:
 *
 * ```typescript
 * import {
 *   handleInputWithIntent,
 *   showCommandPalette,
 *   showContextualHelp,
 *   enhanceREPLWithP0Features
 * } from './repl-integration.js';
 *
 * // In REPLManager.start():
 * async start(): Promise<void> {
 *   // Run P0 enhancements
 *   await enhanceREPLWithP0Features();
 *
 *   // ... rest of start logic
 * }
 *
 * // In setupHandlers(), modify line handler:
 * this.rl.on('line', async (input: string) => {
 *   const trimmed = input.trim();
 *
 *   if (!trimmed) {
 *     this.rl.prompt();
 *     return;
 *   }
 *
 *   // Use enhanced handler with intent detection
 *   const context = this.getCommandContext();
 *   const result = await handleInputWithIntent(trimmed, context);
 *
 *   if (result.handled) {
 *     // Command was executed
 *     if (result.originalCommand) {
 *       this.lastCommand = result.originalCommand;
 *     }
 *
 *     // Show command palette after commands
 *     showCommandPalette(this.conversation);
 *   } else {
 *     // Not a command - treat as conversation
 *     await this.handlePrompt(trimmed);
 *
 *     // Show command palette after AI response
 *     showCommandPalette(this.conversation);
 *   }
 *
 *   // Show contextual help
 *   showContextualHelp({
 *     lastCommand: this.lastCommand,
 *     lastError: this.lastError,
 *     messageCount: this.conversation.messages.length
 *   });
 *
 *   this.rl.prompt();
 * });
 * ```
 */

/**
 * Type-safe command context getter helper
 */
export function createCommandContext(
  conversation: Conversation,
  currentProvider: string,
  conversationManager?: any
): CommandContext {
  return {
    conversation,
    currentProvider,
    conversationManager
  };
}

/**
 * Integration status checker - validates P0 features are available
 */
export function checkP0Integration(): {
  intentClassifier: boolean;
  commandPalette: boolean;
  progressiveHelp: boolean;
  onboarding: boolean;
} {
  return {
    intentClassifier: typeof classifyIntent === 'function',
    commandPalette: typeof generateQuickActions === 'function',
    progressiveHelp: typeof renderProgressiveHelp === 'function',
    onboarding: typeof runOnboardingWizard === 'function'
  };
}

/**
 * Get integration stats for debugging
 */
export function getP0Stats(): string {
  const status = checkP0Integration();
  const lines: string[] = [];

  lines.push(chalk.bold.cyan('P0 Feature Status:'));
  lines.push('');

  lines.push(`${status.intentClassifier ? chalk.green('✓') : chalk.red('✗')} Intent Classifier`);
  lines.push(`${status.commandPalette ? chalk.green('✓') : chalk.red('✗')} Command Palette`);
  lines.push(`${status.progressiveHelp ? chalk.green('✓') : chalk.red('✗')} Progressive Help`);
  lines.push(`${status.onboarding ? chalk.green('✓') : chalk.red('✗')} Onboarding`);

  return lines.join('\n');
}
