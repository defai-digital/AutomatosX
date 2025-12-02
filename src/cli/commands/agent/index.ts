/**
 * Agent Command - Manage agents
 * @since v5.0.0
 */

import type { CommandModule } from 'yargs';
import { templatesCommand } from './templates.js';
import { createCommand } from './create.js';
import { listCommand } from './list.js';
import { showCommand } from './show.js';
import { removeCommand } from './remove.js';
import { suggestCommand } from './suggest.js';

export const agentCommand: CommandModule = {
  command: 'agent <command>',
  describe: 'Manage agents',

  builder: (yargs) => {
    return yargs
      .command(templatesCommand)
      .command(createCommand)
      .command(listCommand)
      .command(showCommand)
      .command(removeCommand)
      .command(suggestCommand)
      .demandCommand(1, 'You must provide a valid subcommand')
      .help();
  },

  handler: () => {
    // This will never be called because we have subcommands
    // Yargs will handle showing help automatically
  }
};
