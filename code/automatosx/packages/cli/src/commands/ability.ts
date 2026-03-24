import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { findUnexpectedFlag, splitCommaList } from '../utils/validation.js';

export async function abilityCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const runtime = createRuntime(options);

  switch (subcommand) {
    case 'list': {
      if (args[1] !== undefined) {
        return args[1].startsWith('--')
          ? failure(`Unknown ability flag: ${args[1]}.`)
          : usageError('ax ability list');
      }

      const abilities = await runtime.listAbilities({
        category: options.category,
        tags: options.tags,
      });
      if (abilities.length === 0) {
        return success('No abilities found.', abilities);
      }
      return success([
        'Abilities:',
        ...abilities.map((ability) => `- ${ability.abilityId}: ${ability.name} [${ability.category}] (${ability.tags.join(', ')})`),
      ].join('\n'), abilities);
    }
    case 'inject': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown ability flag: ${unexpectedFlag}.`);
      }

      const task = options.task ?? args.slice(1).join(' ').trim();
      if (task.length === 0) {
        return usageError('ax ability inject --task <text>');
      }

      const injection = await runtime.injectAbilities({
        task,
        requiredAbilities: options.core !== undefined ? splitCommaList(options.core) : undefined,
        category: options.category,
        tags: options.tags,
        maxAbilities: options.limit,
        includeMetadata: true,
      });

      return success([
        `Ability injection for: ${task}`,
        '',
        injection.content.length > 0 ? injection.content : 'No matching abilities.',
      ].join('\n'), injection);
    }
    default:
      return usageError('ax ability [list|inject]');
  }
}
