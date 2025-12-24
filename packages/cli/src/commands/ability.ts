/**
 * Ability Command
 *
 * CLI command for managing abilities - reusable knowledge modules for agents.
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createAbilityRegistry,
  createAbilityLoader,
  createAbilityManager,
  DEFAULT_ABILITY_DOMAIN_CONFIG,
} from '@automatosx/ability-domain';
import { LIMIT_ABILITY_TOKENS_AGENT } from '@automatosx/contracts';

// Singleton registry for demo purposes
const registry = createAbilityRegistry();
const manager = createAbilityManager(registry);
let loaded = false;

/**
 * Ensure abilities are loaded from the default directory
 */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;

  try {
    const loader = createAbilityLoader({
      abilitiesDir: DEFAULT_ABILITY_DOMAIN_CONFIG.abilitiesDir,
    });
    const abilities = await loader.loadAll();
    for (const ability of abilities) {
      await registry.register(ability);
    }
    loaded = true;
  } catch {
    // Directory may not exist
    loaded = true;
  }
}

/**
 * Handles the 'ability' command - manage abilities
 *
 * Subcommands:
 *   ability list           - List all abilities
 *   ability get <id>       - Get ability details
 *   ability inject         - Preview ability injection for an agent/task
 *   ability load <dir>     - Load abilities from a directory
 */
export async function abilityCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const subArgs = args.slice(1);

  // Ensure abilities are loaded for most commands
  if (subcommand !== 'load') {
    await ensureLoaded();
  }

  switch (subcommand) {
    case 'list':
      return listAbilities(options);
    case 'get':
      return getAbility(subArgs, options);
    case 'inject':
      return injectAbilities(options);
    case 'load':
      return loadAbilities(subArgs, options);
    default:
      return {
        success: false,
        message: `Unknown ability subcommand: ${subcommand}\nAvailable: list, get, inject, load`,
        data: undefined,
        exitCode: 1,
      };
  }
}

/**
 * List all abilities
 */
async function listAbilities(options: CLIOptions): Promise<CommandResult> {
  try {
    // Build filter from options
    const filter: { category?: string; tags?: string[]; enabled?: boolean } = {};
    if (options.category !== undefined) {
      filter.category = options.category;
    }
    if (options.tags !== undefined && options.tags.length > 0) {
      filter.tags = options.tags;
    }

    const abilities = await registry.list(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    if (abilities.length === 0) {
      return {
        success: true,
        message: 'No abilities found.',
        data: [],
        exitCode: 0,
      };
    }

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? abilities.slice(0, options.limit)
      : abilities;

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: limited,
        exitCode: 0,
      };
    }

    // Format as text table
    const header = 'Ability ID           | Category       | Priority | Enabled | Tags';
    const separator = '-'.repeat(header.length);
    const rows = limited.map((a) =>
      `${(a.abilityId ?? '').padEnd(20)} | ${(a.category ?? '-').padEnd(14)} | ${String(a.priority ?? 50).padEnd(8)} | ${a.enabled ? 'Yes' : 'No '.padEnd(7)} | ${(a.tags?.slice(0, 3).join(', ') ?? '-')}`
    );

    return {
      success: true,
      message: [header, separator, ...rows, '', `Total: ${abilities.length} abilities`].join('\n'),
      data: limited,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list abilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Get ability details by ID
 */
async function getAbility(args: string[], options: CLIOptions): Promise<CommandResult> {
  const abilityId = args[0];

  if (abilityId === undefined) {
    return {
      success: false,
      message: 'Usage: ax ability get <ability-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const ability = await registry.get(abilityId);

    if (ability === undefined) {
      return {
        success: false,
        message: `Ability not found: ${abilityId}`,
        data: undefined,
        exitCode: 1,
      };
    }

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: ability,
        exitCode: 0,
      };
    }

    // Format as text
    const lines = [
      `Ability: ${ability.abilityId}`,
      `Display Name: ${ability.displayName ?? ability.abilityId}`,
      `Category: ${ability.category ?? 'N/A'}`,
      `Priority: ${ability.priority ?? 50}`,
      `Enabled: ${ability.enabled ? 'Yes' : 'No'}`,
      `Tags: ${ability.tags?.join(', ') ?? 'N/A'}`,
      `Version: ${ability.version ?? 'N/A'}`,
      `Author: ${ability.author ?? 'N/A'}`,
      '',
      `Content (${ability.content.length} chars):`,
      '---',
      ability.content.length > 500
        ? ability.content.slice(0, 500) + '\n... (truncated)'
        : ability.content,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: ability,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get ability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Preview ability injection for an agent/task
 */
async function injectAbilities(options: CLIOptions): Promise<CommandResult> {
  try {
    const agentId = options.agent ?? 'default-agent';
    const task = options.task ?? options.input ?? 'general task';
    const coreAbilities = options.core !== undefined
      ? options.core.split(',').map((s) => s.trim())
      : undefined;
    const maxAbilities = options.limit ?? 10;
    const maxTokens = options.maxTokens ?? LIMIT_ABILITY_TOKENS_AGENT;

    const result = await manager.injectAbilities(
      agentId,
      task,
      coreAbilities,
      {
        maxAbilities,
        maxTokens,
        includeMetadata: true,
      }
    );

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: result,
        exitCode: 0,
      };
    }

    // Format as text
    const lines = [
      `Ability Injection Preview`,
      `-------------------------`,
      `Agent: ${result.agentId}`,
      `Task: ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}`,
      ``,
      `Injected Abilities (${result.injectedAbilities.length}):`,
      ...result.injectedAbilities.map((id, i) => `  ${i + 1}. ${id}`),
      ``,
      `Token Count: ${result.tokenCount ?? 'N/A'}`,
      `Truncated: ${result.truncated ? 'Yes' : 'No'}`,
      ``,
      `Combined Content Preview (${result.combinedContent.length} chars):`,
      '---',
      result.combinedContent.length > 1000
        ? result.combinedContent.slice(0, 1000) + '\n... (truncated)'
        : result.combinedContent,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: result,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to inject abilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Load abilities from a directory
 */
async function loadAbilities(args: string[], options: CLIOptions): Promise<CommandResult> {
  const directory = args[0] ?? DEFAULT_ABILITY_DOMAIN_CONFIG.abilitiesDir;

  try {
    const loader = createAbilityLoader({ abilitiesDir: directory });
    const abilities = await loader.loadAll();

    // Register all loaded abilities
    for (const ability of abilities) {
      await registry.register(ability);
    }
    loaded = true;

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: {
          directory,
          loaded: abilities.length,
          abilities: abilities.map((a) => a.abilityId),
        },
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Loaded ${abilities.length} abilities from ${directory}`,
      data: { directory, loaded: abilities.length },
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to load abilities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
