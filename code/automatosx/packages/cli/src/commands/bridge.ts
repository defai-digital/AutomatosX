import type { CLIOptions, CommandResult } from '../types.js';
import { formatPrettyJsonBlock } from '../json-file-write.js';
import {
  discoverBridgeDefinitions,
  installBridgeDefinition,
  resolveBridgeReference,
  type BridgeLoadResult,
  type BridgeLoadSuccess,
} from '../bridge-registry.js';
import { executeBridge } from '../bridge-runtime.js';
import {
  failure,
  success,
  usageError,
  resolveCliBasePath,
} from '../utils/formatters.js';
import { parseCommandArgs } from '../utils/command-args.js';

export async function bridgeCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const basePath = resolveCliBasePath(options);

  switch (subcommand) {
    case 'list': {
      if (args[1] !== undefined) {
        return usageError('ax bridge list');
      }

      const discovered = await discoverBridgeDefinitions(basePath);
      const limited = typeof options.limit === 'number' && options.limit > 0
        ? discovered.slice(0, options.limit)
        : discovered;

      if (limited.length === 0) {
        return success('No bridge definitions found under .automatosx/bridges/.', []);
      }

      return success(formatBridgeList(limited), {
        bridges: limited,
        total: discovered.length,
      });
    }
    case 'inspect': {
      const reference = args[1];
      if (reference === undefined || reference.length === 0) {
        return usageError('ax bridge inspect <bridge-id|path>');
      }
      if (args[2] !== undefined) {
        return usageError('ax bridge inspect <bridge-id|path>');
      }

      try {
        const bridge = await resolveBridgeReference(basePath, reference);
        return success(formatBridgeInspect(bridge), bridge);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to inspect bridge.');
      }
    }
    case 'install': {
      const parsed = parseBridgeInstallArgs(args.slice(1));
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      if (parsed.sourcePath === undefined) {
        return usageError('ax bridge install <path> [--require-trusted]');
      }

      try {
        const installed = await installBridgeDefinition(
          basePath,
          parsed.sourcePath,
          parsed.requireTrusted ? { requireTrusted: true } : undefined,
        );
        return success(formatBridgeInstall(installed), installed);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to install bridge.');
      }
    }
    case 'validate': {
      if (args[2] !== undefined) {
        return usageError('ax bridge validate [bridge-id|path]');
      }

      if (args[1] !== undefined) {
        try {
          const bridge = await resolveBridgeReference(basePath, args[1]);
          return success(`Bridge definition is valid: ${bridge.definition.bridgeId}\nPath: ${bridge.relativePath}`, bridge);
        } catch (error) {
          return failure(error instanceof Error ? error.message : 'Failed to validate bridge.');
        }
      }

      const discovered = await discoverBridgeDefinitions(basePath);
      const invalid = discovered.filter((entry) => !entry.success);
      if (discovered.length === 0) {
        return success('No bridge definitions found to validate.', {
          valid: [],
          invalid: [],
        });
      }
      if (invalid.length > 0) {
        return failure(formatBridgeValidationFailure(discovered), {
          valid: discovered.filter((entry): entry is BridgeLoadSuccess => entry.success),
          invalid,
        });
      }
      const valid = discovered.filter((entry): entry is BridgeLoadSuccess => entry.success);
      return success(formatBridgeValidationSuccess(valid), {
        valid,
        invalid: [],
      });
    }
    case 'run': {
      const reference = args[1];
      if (reference === undefined || reference.length === 0) {
        return usageError('ax bridge run <bridge-id|path> [args...]');
      }

      try {
        const bridge = await resolveBridgeReference(basePath, reference);
        const execution = await executeBridge(basePath, bridge, args.slice(2));
        if (execution.exitCode !== 0) {
          return failure(formatBridgeRunFailure(bridge, execution), execution);
        }
        return success(formatBridgeRunSuccess(bridge, execution), execution);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to run bridge.');
      }
    }
    default:
      return usageError('ax bridge [list|inspect|install|validate|run]');
  }
}

function formatBridgeList(entries: BridgeLoadResult[]): string {
  return [
    'Bridge definitions:',
    ...entries.map((entry) => (
      entry.success
        ? `- ${entry.definition.bridgeId} [${entry.definition.kind}] v${entry.definition.version} - ${entry.definition.description}`
        : `- INVALID ${entry.relativePath} - ${entry.error}`
    )),
  ].join('\n');
}

function formatBridgeInspect(entry: BridgeLoadSuccess): string {
  return [
    `Bridge: ${entry.definition.bridgeId}`,
    `Path: ${entry.relativePath}`,
    `Kind: ${entry.definition.kind}`,
    `Version: ${entry.definition.version}`,
    `Entrypoint: ${entry.definition.entrypoint.type}`,
    '',
    formatPrettyJsonBlock(entry.definition),
  ].join('\n');
}

function formatBridgeValidationSuccess(entries: BridgeLoadSuccess[]): string {
  return [
    `Validated ${entries.length} bridge definition${entries.length === 1 ? '' : 's'}.`,
    ...entries.map((entry) => `- ${entry.definition.bridgeId} (${entry.relativePath})`),
  ].join('\n');
}

function formatBridgeValidationFailure(entries: BridgeLoadResult[]): string {
  return [
    'Bridge validation failed.',
    ...entries.map((entry) => (
      entry.success
        ? `- OK ${entry.definition.bridgeId} (${entry.relativePath})`
        : `- ERROR ${entry.relativePath}: ${entry.error}`
    )),
  ].join('\n');
}

function formatBridgeInstall(installed: {
  definition: { bridgeId: string };
  relativePath: string;
  trust: { state: string };
  warnings: string[];
}): string {
  const lines = [
    `Installed bridge: ${installed.definition.bridgeId}`,
    `Path: ${installed.relativePath}`,
    `Trust: ${installed.trust.state}`,
  ];

  for (const warning of installed.warnings) {
    lines.push(`Warning: ${warning}`);
  }

  return lines.join('\n');
}

function parseBridgeInstallArgs(args: string[]): {
  sourcePath?: string;
  requireTrusted: boolean;
  error?: string;
} {
  const parsed = parseCommandArgs<{ requireTrusted: boolean }>({
    args,
    initial: {
      requireTrusted: false,
    },
    flags: {
      'require-trusted': {
        kind: 'boolean',
        apply: (state) => {
          state.requireTrusted = true;
        },
      },
    },
    unknownFlagMessage: (token) => `Unknown bridge flag: ${token}`,
  });

  if (parsed.error !== undefined) {
    return {
      requireTrusted: parsed.value.requireTrusted,
      error: parsed.error,
    };
  }

  if (parsed.positionals.length !== 1) {
    return {
      requireTrusted: parsed.value.requireTrusted,
      error: 'Usage: ax bridge install <path> [--require-trusted]',
    };
  }

  return {
    sourcePath: parsed.positionals[0],
    requireTrusted: parsed.value.requireTrusted,
  };
}

function formatBridgeRunSuccess(
  bridge: BridgeLoadSuccess,
  execution: {
    command: string;
    args: string[];
    stdout: string;
    stderr: string;
  },
): string {
  const lines = [
    `Bridge executed: ${bridge.definition.bridgeId}`,
    `Command: ${[execution.command, ...execution.args].join(' ')}`,
  ];

  const stdout = execution.stdout.trim();
  const stderr = execution.stderr.trim();

  if (stdout.length > 0) {
    lines.push('', stdout);
  }
  if (stderr.length > 0) {
    lines.push('', 'stderr:', stderr);
  }

  return lines.join('\n');
}

function formatBridgeRunFailure(
  bridge: BridgeLoadSuccess,
  execution: {
    command: string;
    args: string[];
    exitCode: number;
    stdout: string;
    stderr: string;
  },
): string {
  const lines = [
    `Bridge execution failed: ${bridge.definition.bridgeId}`,
    `Command: ${[execution.command, ...execution.args].join(' ')}`,
    `Exit code: ${execution.exitCode}`,
  ];

  const stdout = execution.stdout.trim();
  const stderr = execution.stderr.trim();

  if (stdout.length > 0) {
    lines.push('', 'stdout:', stdout);
  }
  if (stderr.length > 0) {
    lines.push('', 'stderr:', stderr);
  }

  return lines.join('\n');
}
