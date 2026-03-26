import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';
import { setupCommand } from './setup.js';

const DEPRECATION_NOTE = 'Note: ax init is deprecated. Use ax setup.';

export async function initCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const result = await setupCommand(args, options);

  if (options.format === 'json' || result.message === undefined) {
    return result;
  }

  const message = `${result.message}\n\n${DEPRECATION_NOTE}`;
  return result.success ? success(message, result.data) : failure(message, result.data);
}
