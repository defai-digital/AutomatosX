/**
 * AutomatosX v8.0.0 - Workflow Command
 *
 * Delegate to existing `ax workflow run` command
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { SlashCommand, CommandContext } from '../types.js';
import type { ConversationContext } from '../ConversationContext.js';

/**
 * Workflow Command
 *
 * Delegates to the existing workflow execution functionality
 * Usage:
 *   /workflow <path>          - Run a workflow
 *   /workflow list            - List available workflows
 */
export class WorkflowCommand implements SlashCommand {
  name = 'workflow';
  description = 'Run a workflow';
  usage = '/workflow <path>';
  aliases = ['wf'];

  // ConversationContext will be injected by REPLSession
  private conversationContext?: ConversationContext;

  setConversationContext(context: ConversationContext): void {
    this.conversationContext = context;
  }

  async execute(args: string[], context: CommandContext): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('\n❌ Missing workflow path\n'));
      console.log(chalk.gray('Usage: /workflow <path>'));
      console.log(chalk.gray('Examples:'));
      console.log(chalk.gray('  /workflow ./workflows/analyze.yaml'));
      console.log(chalk.gray('  /workflow list\n'));
      return;
    }

    const subcommand = args[0];

    // Handle list subcommand
    if (subcommand === 'list') {
      await this.listWorkflows();
      return;
    }

    // Validate workflow file exists
    const workflowPath = args.join(' '); // Support paths with spaces
    const absolutePath = resolve(workflowPath);

    if (!existsSync(absolutePath)) {
      console.log(chalk.red(`\n❌ Workflow file not found: ${absolutePath}\n`));
      return;
    }

    // Set as active workflow in context
    if (this.conversationContext) {
      this.conversationContext.setActiveWorkflow(absolutePath);
    }

    // Build command arguments
    const command = 'npm';
    const commandArgs = ['run', 'cli', '--', 'workflow', 'run', absolutePath];

    console.log(chalk.cyan(`\n⚙️  Running workflow: ${chalk.bold(workflowPath)}\n`));

    // Execute command
    await this.executeCommand(command, commandArgs);
  }

  /**
   * List available workflows
   */
  private async listWorkflows(): Promise<void> {
    const command = 'npm';
    const commandArgs = ['run', 'cli', '--', 'workflow', 'list'];

    console.log(chalk.cyan('\n📋 Available Workflows\n'));

    await this.executeCommand(command, commandArgs);
  }

  /**
   * Execute external command and stream output
   */
  private executeCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        console.log(); // Blank line after output
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        console.log(chalk.red(`\n❌ Failed to execute command: ${error.message}\n`));
        reject(error);
      });
    });
  }
}
