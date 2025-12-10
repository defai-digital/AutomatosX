/**
 * Mode Command - Manage workflow modes for embedded instructions
 *
 * @since v11.3.0
 * @updated v11.3.1 - Added mode persistence
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { logger } from '../../shared/logging/logger.js';
import {
  WORKFLOW_MODES,
  type WorkflowMode,
  isValidWorkflowMode,
  saveModeState,
  loadModeState,
  isModePersistenceEnabled
} from '../../core/workflow/index.js';

interface ModeOptions {
  mode?: string;
  list?: boolean;
  status?: boolean;
}

export const modeCommand: CommandModule<Record<string, unknown>, ModeOptions> = {
  command: 'mode [mode]',
  describe: 'Manage workflow modes for embedded instructions (v11.3.0)',

  builder: (yargs) => {
    return yargs
      .positional('mode', {
        describe: 'Workflow mode to set (default, plan, iterate, review)',
        type: 'string'
      })
      .option('list', {
        alias: 'l',
        describe: 'List available workflow modes',
        type: 'boolean',
        default: false
      })
      .option('status', {
        alias: 's',
        describe: 'Show current workflow mode status',
        type: 'boolean',
        default: false
      })
      .example('$0 mode plan', 'Enter plan mode (restricts code-modifying tools)')
      .example('$0 mode iterate', 'Enter iterate mode (for autonomous execution)')
      .example('$0 mode default', 'Return to default mode')
      .example('$0 mode --list', 'List all available modes')
      .example('$0 mode --status', 'Show current mode status');
  },

  handler: async (argv) => {
    try {
      // List available modes
      if (argv.list) {
        displayModeList();
        return;
      }

      // Show status
      if (argv.status || !argv.mode) {
        await displayModeStatus();
        return;
      }

      // Set mode
      const modeName = argv.mode.toLowerCase();

      if (!isValidWorkflowMode(modeName)) {
        console.error(chalk.red.bold(`\n❌ Invalid workflow mode: ${argv.mode}\n`));
        console.log(chalk.gray('Available modes:'));
        Object.keys(WORKFLOW_MODES).forEach(mode => {
          console.log(chalk.cyan(`  • ${mode}`));
        });
        console.log();
        process.exit(1);
      }

      // Display mode change
      const modeConfig = WORKFLOW_MODES[modeName];

      // v11.3.1: Persist mode to disk
      if (isModePersistenceEnabled()) {
        const saved = await saveModeState(modeName, {
          setBy: 'cli',
          reason: `ax mode ${modeName}`
        });

        if (saved) {
          console.log(chalk.green.bold(`\n✅ Workflow mode set to: ${modeName}\n`));
          console.log(chalk.gray(`Description: ${modeConfig.description}`));
        } else {
          console.log(chalk.yellow.bold(`\n⚠️  Mode set to: ${modeName} (not persisted)\n`));
          console.log(chalk.gray(`Description: ${modeConfig.description}`));
        }
      } else {
        console.log(chalk.green.bold(`\n✅ Workflow mode set to: ${modeName}\n`));
        console.log(chalk.gray(`Description: ${modeConfig.description}`));
        console.log(chalk.gray('(Mode persistence disabled via AX_DISABLE_MODE_PERSISTENCE)'));
      }

      if (modeConfig.blockedTools && modeConfig.blockedTools.length > 0) {
        console.log(chalk.yellow('\nRestricted tools in this mode:'));
        modeConfig.blockedTools.forEach(tool => {
          console.log(chalk.yellow(`  • ${tool}`));
        });
      }

      if (modeConfig.allowedTools && modeConfig.allowedTools.length > 0) {
        console.log(chalk.cyan('\nAllowed tools in this mode:'));
        modeConfig.allowedTools.forEach(tool => {
          console.log(chalk.cyan(`  • ${tool}`));
        });
      }

      console.log();

      // Show helpful usage info
      if (modeName === 'iterate') {
        console.log(chalk.cyan('💡 Tip: Use `ax run <agent> "task"` and it will auto-use iterate mode'));
      } else if (modeName === 'plan') {
        console.log(chalk.cyan('💡 Tip: Use `ax run <agent> "task"` and it will auto-use plan mode'));
        console.log(chalk.gray('   The mode will persist until you run `ax mode default`'));
      }
      console.log();

      logger.info('Workflow mode set', { mode: modeName, persisted: isModePersistenceEnabled() });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(chalk.red.bold(`\n❌ Error: ${err.message}\n`));
      logger.error('Mode command failed', { error: err.message });
      process.exit(1);
    }
  }
};

/**
 * Display list of available workflow modes
 */
function displayModeList(): void {
  console.log(chalk.blue.bold('\n📋 Available Workflow Modes\n'));
  console.log(chalk.dim('─'.repeat(60)));

  for (const [name, config] of Object.entries(WORKFLOW_MODES)) {
    console.log();
    console.log(chalk.cyan.bold(`  ${name}`));
    console.log(chalk.gray(`    ${config.description}`));

    if (config.blockedTools && config.blockedTools.length > 0) {
      console.log(chalk.yellow(`    Blocked: ${config.blockedTools.join(', ')}`));
    }

    if (config.maxNestingDepth !== undefined) {
      console.log(chalk.gray(`    Max nesting depth: ${config.maxNestingDepth}`));
    }
  }

  console.log();
  console.log(chalk.dim('─'.repeat(60)));
  console.log(chalk.gray('\nUsage: ax mode <mode-name>'));
  console.log(chalk.gray('Example: ax mode plan\n'));
}

/**
 * Display current workflow mode status
 */
async function displayModeStatus(): Promise<void> {
  // v11.3.1: Read from persisted state
  const modeState = await loadModeState();
  const currentMode = modeState?.mode ?? 'default';
  const modeConfig = WORKFLOW_MODES[currentMode as WorkflowMode];

  console.log(chalk.blue.bold('\n📊 Workflow Mode Status\n'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  Current mode: ${chalk.cyan.bold(currentMode)}`);
  console.log(`  Description: ${chalk.gray(modeConfig.description)}`);

  if (modeState) {
    const setAt = new Date(modeState.setAt);
    const expiresAt = modeState.expiresAt ? new Date(modeState.expiresAt) : null;
    console.log(`  Set at: ${chalk.gray(setAt.toLocaleString())}`);
    if (expiresAt) {
      const remainingMs = expiresAt.getTime() - Date.now();
      const remainingMins = Math.round(remainingMs / 60000);
      if (remainingMs > 0) {
        console.log(`  Expires in: ${chalk.gray(`${remainingMins} minutes`)}`);
      } else {
        console.log(`  Status: ${chalk.yellow('expired (will use default)')}`);
      }
    }
  }

  if (modeConfig.blockedTools && modeConfig.blockedTools.length > 0) {
    console.log(`  Blocked tools: ${chalk.yellow(modeConfig.blockedTools.join(', '))}`);
  } else {
    console.log(`  Blocked tools: ${chalk.green('none')}`);
  }

  console.log(chalk.dim('─'.repeat(50)));
  console.log();
  console.log(chalk.gray('To change mode: ax mode <mode-name>'));
  console.log(chalk.gray('To list modes: ax mode --list\n'));
}
