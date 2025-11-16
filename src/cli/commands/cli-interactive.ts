/**
 * Interactive CLI Command (ax-cli)
 *
 * Launches the conversational REPL interface
 * MVP v0.1.0
 */

import type { CommandModule } from 'yargs';

interface InteractiveArgs {
  debug?: boolean;
}

export const cliInteractiveCommand: CommandModule<{}, InteractiveArgs> = {
  command: 'cli',
  aliases: ['interactive', 'chat'],
  describe: 'Start interactive conversational CLI (ax-cli)',
  builder: (yargs) => {
    return yargs
      .example('$0 cli', 'Start interactive mode')
      .example('$0 interactive', 'Alternative command')
      .example('$0 chat', 'Another alias');
  },
  handler: async (argv) => {
    try {
      // Dynamic import to avoid loading interactive CLI unless needed
      const { startInteractiveCLI } = await import('../../../packages/cli-interactive/src/index.js');

      // Start the interactive REPL
      await startInteractiveCLI();

    } catch (error) {
      console.error('Failed to start interactive CLI:', error);
      process.exit(1);
    }
  }
};
