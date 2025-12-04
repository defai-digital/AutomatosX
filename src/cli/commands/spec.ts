/**
 * Spec Command - Spec file utilities
 *
 * v11.0.0: Simplified to documentation-only commands
 *
 * Commands:
 * - ax spec explain - Explain a spec file (kept for documentation value)
 *
 * DEPRECATED in v11.0.0:
 * - ax spec run/init/create/validate/status/graph
 *
 * Migration:
 * - Use "ax run <agent> --iterate" for workflow execution
 * - Use "ax gen plan/dag/scaffold/tests" for generation
 * - See: docs/migration/spec-kit-deprecation.md
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import { detectProjectRoot } from '../../shared/validation/path-resolver.js';
import { handleSpecExplain } from './spec/explain.js';

interface SpecOptions {
  // Subcommand
  subcommand?: string;

  // Explain options
  file?: string;
  format?: 'markdown' | 'text' | 'json';
  sections?: string;
}

export const specCommand: CommandModule<Record<string, unknown>, SpecOptions> = {
  command: 'spec <subcommand>',
  describe: 'Spec file utilities (explain)',

  builder: (yargs) => {
    return yargs
      .positional('subcommand', {
        describe: 'Subcommand (explain)',
        type: 'string',
        choices: ['explain'],
        demandOption: true
      })
      // Explain options
      .option('file', {
        describe: 'Spec file to explain',
        type: 'string'
      })
      .option('format', {
        describe: 'Output format (markdown, text, json)',
        type: 'string',
        choices: ['markdown', 'text', 'json'],
        default: 'markdown'
      })
      .option('sections', {
        describe: 'Sections to include (comma-separated)',
        type: 'string'
      })
      .example('$0 spec explain my-workflow.ax.yaml', 'Explain spec file')
      .example('$0 spec explain my-workflow.ax.yaml --format json', 'Explain in JSON format')
      .epilogue(
        chalk.yellow('\nNote: spec run/init/create/validate/status/graph were removed in v11.0.0.\n') +
        chalk.gray('Use "ax run <agent> --iterate" for workflow execution.\n') +
        chalk.gray('Use "ax gen plan/dag/scaffold/tests" for generation.\n') +
        chalk.gray('See: https://github.com/defai-digital/automatosx/blob/main/docs/migration/spec-kit-deprecation.md')
      );
  },

  handler: async (argv) => {
    try {
      const workspacePath = await detectProjectRoot(process.cwd());

      switch (argv.subcommand) {
        case 'explain':
          // Support: ax spec explain my-workflow.ax.yaml
          if (!argv.file && argv._.length > 1) {
            argv.file = String(argv._[1]);
          }
          if (!argv.file) {
            console.error(chalk.red('✗ Error: --file option required for explain subcommand'));
            console.error(chalk.gray('Usage: ax spec explain <file> [--format markdown|text|json]'));
            process.exit(1);
          }
          await handleSpecExplain(workspacePath, {
            file: argv.file,
            format: argv.format as 'markdown' | 'text' | 'json',
            sections: argv.sections?.split(',').map(s => s.trim())
          });
          break;
        default:
          console.error(chalk.red(`Unknown subcommand: ${argv.subcommand}`));
          console.error(chalk.yellow('\nSpec execution commands were removed in v11.0.0.'));
          console.error(chalk.gray('Use "ax run <agent> --iterate" for workflow execution.'));
          console.error(chalk.gray('Use "ax gen plan/dag/scaffold/tests" for generation.'));
          process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      process.exit(1);
    }
  }
};
