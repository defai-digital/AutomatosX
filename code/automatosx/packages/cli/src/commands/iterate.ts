import type { CLIOptions, CommandResult } from '../types.js';
import { executeIterateCommand } from '../cli-iterate.js';

export async function iterateCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  return executeIterateCommand(args, options);
}
