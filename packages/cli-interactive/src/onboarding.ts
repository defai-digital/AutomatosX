/**
 * Onboarding System
 *
 * Interactive wizard for first-time users
 * Phase 2 P0: Help new users get started quickly
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface OnboardingProgress {
  completed: boolean;
  skipped: boolean;
  timestamp: Date;
  steps: {
    welcome: boolean;
    naturalLanguage: boolean;
    commands: boolean;
    agents: boolean;
    memory: boolean;
  };
}

const ONBOARDING_FILE = '.automatosx/.cli-onboarding.json';

/**
 * Check if user has completed onboarding
 */
export function hasCompletedOnboarding(): boolean {
  try {
    if (!existsSync(ONBOARDING_FILE)) {
      return false;
    }

    const data = JSON.parse(require('fs').readFileSync(ONBOARDING_FILE, 'utf-8'));
    return data.completed || data.skipped;
  } catch {
    return false;
  }
}

/**
 * Save onboarding progress
 */
function saveOnboardingProgress(progress: OnboardingProgress): void {
  try {
    const dir = join(process.cwd(), '.automatosx');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(
      ONBOARDING_FILE,
      JSON.stringify(progress, null, 2),
      'utf-8'
    );
  } catch (error) {
    // Fail silently - onboarding is optional
    console.error('Failed to save onboarding progress:', error);
  }
}

/**
 * Run interactive onboarding wizard
 */
export async function runOnboardingWizard(): Promise<void> {
  console.clear();

  // Welcome screen
  console.log('');
  console.log(chalk.bold.cyan('╭─────────────────────────────────────────────╮'));
  console.log(chalk.bold.cyan('│   Welcome to AutomatosX Interactive CLI!    │'));
  console.log(chalk.bold.cyan('╰─────────────────────────────────────────────╯'));
  console.log('');
  console.log(chalk.white('Let\'s get you started with a quick tour! '));
  console.log(chalk.dim('(This will only take 60 seconds)'));
  console.log('');

  // Ask if they want the tour
  const { wantsTour } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'wantsTour',
      message: 'Would you like a quick tour?',
      default: true
    }
  ]);

  if (!wantsTour) {
    saveOnboardingProgress({
      completed: false,
      skipped: true,
      timestamp: new Date(),
      steps: {
        welcome: true,
        naturalLanguage: false,
        commands: false,
        agents: false,
        memory: false
      }
    });

    console.log('');
    console.log(chalk.cyan('No problem! Type /help anytime to learn more.'));
    console.log('');

    await sleep(1500);
    return;
  }

  const progress: OnboardingProgress = {
    completed: false,
    skipped: false,
    timestamp: new Date(),
    steps: {
      welcome: true,
      naturalLanguage: false,
      commands: false,
      agents: false,
      memory: false
    }
  };

  // Step 1: Natural Language
  console.clear();
  console.log('');
  console.log(chalk.bold.yellow('📝 Step 1: Talk Naturally'));
  console.log('');
  console.log(chalk.white('You can interact with ax using natural language:'));
  console.log('');
  console.log(chalk.dim('  Instead of memorizing commands, just say what you want:'));
  console.log('');
  console.log(`  ${chalk.cyan('You:')  } ${chalk.white('run tests')}`);
  console.log(`  ${chalk.cyan('ax:')   } ${chalk.dim('✓ Running test suite...')}`);
  console.log('');
  console.log(`  ${chalk.cyan('You:')  } ${chalk.white('show me the files')}`);
  console.log(`  ${chalk.cyan('ax:')   } ${chalk.dim('✓ Displaying file tree...')}`);
  console.log('');
  console.log(`  ${chalk.cyan('You:')  } ${chalk.white('search for TODO')}`);
  console.log(`  ${chalk.cyan('ax:')   } ${chalk.dim('✓ Searching codebase...')}`);
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
      default: ''
    }
  ]);

  progress.steps.naturalLanguage = true;

  // Step 2: Slash Commands
  console.clear();
  console.log('');
  console.log(chalk.bold.yellow('⚡ Step 2: Slash Commands (Optional)'));
  console.log('');
  console.log(chalk.white('You can also use traditional slash commands:'));
  console.log('');
  console.log(chalk.dim('  Slash commands give you more control:'));
  console.log('');
  console.log(`  ${chalk.cyan('/test')          } ${chalk.dim('→ Run tests')}`);
  console.log(`  ${chalk.cyan('/build')         } ${chalk.dim('→ Build project')}`);
  console.log(`  ${chalk.cyan('/search TODO')   } ${chalk.dim('→ Search code')}`);
  console.log(`  ${chalk.cyan('/help')          } ${chalk.dim('→ Show all commands')}`);
  console.log('');
  console.log(chalk.white('Both work the same way - use whichever feels natural!'));
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
      default: ''
    }
  ]);

  progress.steps.commands = true;

  // Step 3: Agent Delegation
  console.clear();
  console.log('');
  console.log(chalk.bold.yellow('🤖 Step 3: Agent Delegation'));
  console.log('');
  console.log(chalk.white('AutomatosX has 20 specialized AI agents:'));
  console.log('');
  console.log(chalk.dim('  Delegate tasks to experts:'));
  console.log('');
  console.log(`  ${chalk.cyan('@backend')  } ${chalk.dim('- Backend development (Go, Rust, APIs)')}`);
  console.log(`  ${chalk.cyan('@security') } ${chalk.dim('- Security auditing and threat modeling')}`);
  console.log(`  ${chalk.cyan('@quality')  } ${chalk.dim('- Testing and QA')}`);
  console.log(`  ${chalk.cyan('@frontend') } ${chalk.dim('- React, Next.js, UI development')}`);
  console.log('');
  console.log(chalk.dim('  Example delegation:'));
  console.log('');
  console.log(`  ${chalk.cyan('You:')      } ${chalk.white('@backend "implement JWT authentication"')}`);
  console.log(`  ${chalk.cyan('Backend:')  } ${chalk.dim('✓ Implementing authentication...')}`);
  console.log('');
  console.log(chalk.white('Type /agents to see all available agents'));
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
      default: ''
    }
  ]);

  progress.steps.agents = true;

  // Step 4: Memory & Context
  console.clear();
  console.log('');
  console.log(chalk.bold.yellow('🧠 Step 4: Memory & Context'));
  console.log('');
  console.log(chalk.white('ax remembers everything you discuss:'));
  console.log('');
  console.log(chalk.dim('  Conversations are automatically saved and searchable:'));
  console.log('');
  console.log(`  ${chalk.cyan('/memory search "auth"')  } ${chalk.dim('→ Find past auth discussions')}`);
  console.log(`  ${chalk.cyan('/history')               } ${chalk.dim('→ Show conversation history')}`);
  console.log(`  ${chalk.cyan('/save my-session')       } ${chalk.dim('→ Save current session')}`);
  console.log(`  ${chalk.cyan('/load my-session')       } ${chalk.dim('→ Resume saved session')}`);
  console.log('');
  console.log(chalk.white('Your AI assistant never forgets context!'));
  console.log('');

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...',
      default: ''
    }
  ]);

  progress.steps.memory = true;

  // Completion
  console.clear();
  console.log('');
  console.log(chalk.bold.green('✅ Tour Complete!'));
  console.log('');
  console.log(chalk.white('You\'re all set! Here are some things to try:'));
  console.log('');
  console.log(`  ${chalk.cyan('1.')} ${chalk.white('Say:')} ${chalk.dim('"run tests" or "/test"')}`);
  console.log(`  ${chalk.cyan('2.')} ${chalk.white('Ask:')} ${chalk.dim('"show me the files"')}`);
  console.log(`  ${chalk.cyan('3.')} ${chalk.white('Delegate:')} ${chalk.dim('@backend "implement feature"')}`);
  console.log(`  ${chalk.cyan('4.')} ${chalk.white('Help:')} ${chalk.dim('/help or "help"')}`);
  console.log('');
  console.log(chalk.dim('Quick Actions will appear after AI responses to guide you!'));
  console.log('');

  progress.completed = true;
  saveOnboardingProgress(progress);

  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to start...',
      default: ''
    }
  ]);

  console.clear();
}

/**
 * Show quick tips banner (for users who skip onboarding)
 */
export function showQuickTipsBanner(): void {
  console.log('');
  console.log(chalk.dim('╭─ Quick Tips ─────────────────────────────────╮'));
  console.log(chalk.dim('│ • Talk naturally: "run tests", "show files" │'));
  console.log(chalk.dim('│ • Use /commands: /test, /build, /help       │'));
  console.log(chalk.dim('│ • Delegate: @backend "implement feature"    │'));
  console.log(chalk.dim('│ • Type /help for full guide                 │'));
  console.log(chalk.dim('╰──────────────────────────────────────────────╯'));
  console.log('');
}

/**
 * Helper: Sleep function for pauses
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset onboarding (for testing or user request)
 */
export function resetOnboarding(): void {
  try {
    if (existsSync(ONBOARDING_FILE)) {
      require('fs').unlinkSync(ONBOARDING_FILE);
    }
  } catch {
    // Fail silently
  }
}
