import type { CLIOptions, CommandResult } from '../types.js';
import { formatPrettyJsonBlock } from '../json-file-write.js';
import {
  discoverSkillDefinitions,
  exportSkillDocument,
  importSkillDocument,
  resolveSkillReference,
  scoreSkillAgainstQuery,
  type SkillLoadResult,
  type SkillLoadSuccess,
} from '../skill-registry.js';
import {
  createRuntime,
  failure,
  resolveCliBasePath,
  success,
  usageError,
} from '../utils/formatters.js';
import { parseCommandArgs } from '../utils/command-args.js';

export async function skillCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const basePath = resolveCliBasePath(options);

  switch (subcommand) {
    case 'list': {
      if (args[1] !== undefined) {
        return usageError('ax skill list');
      }

      const discovered = await discoverSkillDefinitions(basePath);
      const limited = typeof options.limit === 'number' && options.limit > 0
        ? discovered.slice(0, options.limit)
        : discovered;

      if (limited.length === 0) {
        return success('No skill definitions found under .automatosx/skills/.', []);
      }

      return success(formatSkillList(limited), {
        skills: limited,
        total: discovered.length,
      });
    }
    case 'inspect': {
      const reference = args[1];
      if (reference === undefined || reference.length === 0) {
        return usageError('ax skill inspect <skill-id|path>');
      }
      if (args[2] !== undefined) {
        return usageError('ax skill inspect <skill-id|path>');
      }

      try {
        const skill = await resolveSkillReference(basePath, reference);
        return success(formatSkillInspect(skill), skill);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to inspect skill.');
      }
    }
    case 'import': {
      const parsed = parseSkillImportArgs(args.slice(1));
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      if (parsed.sourcePath === undefined) {
        return usageError('ax skill import <path> [--require-trusted]');
      }
      if (/^[a-z]+:\/\//i.test(parsed.sourcePath)) {
        return failure('Remote skill import is not implemented yet. Use a local SKILL.md path.');
      }

      try {
        const imported = await importSkillDocument(
          basePath,
          parsed.sourcePath,
          parsed.requireTrusted ? { requireTrusted: true } : undefined,
        );
        return success(formatSkillImport(imported), imported);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to import skill.');
      }
    }
    case 'export': {
      const reference = args[1];
      const outputPath = args[2];
      if (reference === undefined || reference.length === 0 || outputPath === undefined || outputPath.length === 0) {
        return usageError('ax skill export <skill-id|path> <output-path>');
      }
      if (args[3] !== undefined) {
        return usageError('ax skill export <skill-id|path> <output-path>');
      }

      try {
        const exported = await exportSkillDocument(basePath, reference, outputPath);
        return success([
          `Exported skill: ${exported.definition.skillId}`,
          `Path: ${exported.relativePath}`,
        ].join('\n'), exported);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to export skill.');
      }
    }
    case 'run': {
      const reference = args[1];
      if (reference === undefined || reference.length === 0) {
        return usageError('ax skill run <skill-id|path> [args...]');
      }

      try {
        const runtime = createRuntime(options);
        const result = await runtime.runSkill({
          reference,
          args: args.slice(2),
          task: options.task,
          provider: options.provider,
          traceId: options.traceId,
          sessionId: options.sessionId,
          basePath,
          surface: 'cli',
        });

        return result.success
          ? success(formatSkillRunSuccess(result), result)
          : failure(formatSkillRunFailure(result), result);
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Failed to run skill.');
      }
    }
    case 'validate': {
      if (args[2] !== undefined) {
        return usageError('ax skill validate [skill-id|path]');
      }

      if (args[1] !== undefined) {
        try {
          const skill = await resolveSkillReference(basePath, args[1]);
          return success(`Skill definition is valid: ${skill.definition.skillId}\nPath: ${skill.relativePath}`, skill);
        } catch (error) {
          return failure(error instanceof Error ? error.message : 'Failed to validate skill.');
        }
      }

      const discovered = await discoverSkillDefinitions(basePath);
      const invalid = discovered.filter((entry) => !entry.success);
      if (discovered.length === 0) {
        return success('No skill definitions found to validate.', {
          valid: [],
          invalid: [],
        });
      }
      if (invalid.length > 0) {
        return failure(formatSkillValidationFailure(discovered), {
          valid: discovered.filter((entry): entry is SkillLoadSuccess => entry.success),
          invalid,
        });
      }
      const valid = discovered.filter((entry): entry is SkillLoadSuccess => entry.success);
      return success(formatSkillValidationSuccess(valid), {
        valid,
        invalid: [],
      });
    }
    case 'resolve': {
      const query = args[1];
      if (query === undefined || query.length === 0) {
        return usageError('ax skill resolve <query>');
      }
      if (args[2] !== undefined) {
        return usageError('ax skill resolve <query>');
      }

      const discovered = await discoverSkillDefinitions(basePath);
      const matches = discovered
        .filter((entry): entry is SkillLoadSuccess => entry.success)
        .map((entry) => ({
          ...entry,
          score: scoreSkillAgainstQuery(entry.definition, query),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.definition.skillId.localeCompare(right.definition.skillId));

      const limited = typeof options.limit === 'number' && options.limit > 0
        ? matches.slice(0, options.limit)
        : matches.slice(0, 10);

      if (limited.length === 0) {
        return success(`No skills matched query: ${query}`, {
          query,
          matches: [],
        });
      }

      return success(formatSkillResolve(query, limited), {
        query,
        matches: limited,
      });
    }
    default:
      return usageError('ax skill [list|inspect|import|export|run|validate|resolve]');
  }
}

function formatSkillList(entries: SkillLoadResult[]): string {
  return [
    'Skill definitions:',
    ...entries.map((entry) => (
      entry.success
        ? `- ${entry.definition.skillId} [${entry.definition.dispatch}] - ${entry.definition.description ?? 'No description'}`
        : `- INVALID ${entry.relativePath} - ${entry.error}`
    )),
  ].join('\n');
}

function formatSkillInspect(entry: SkillLoadSuccess): string {
  return [
    `Skill: ${entry.definition.skillId}`,
    `Path: ${entry.relativePath}`,
    `Dispatch: ${entry.definition.dispatch}`,
    `Source: ${entry.sourceKind}`,
    '',
    formatPrettyJsonBlock(entry.definition),
  ].join('\n');
}

function formatSkillImport(imported: {
  definition: { skillId: string };
  relativePath: string;
  trust: { state: string };
  warnings: string[];
}): string {
  const lines = [
    `Imported skill: ${imported.definition.skillId}`,
    `Path: ${imported.relativePath}`,
    `Trust: ${imported.trust.state}`,
  ];

  for (const warning of imported.warnings) {
    lines.push(`Warning: ${warning}`);
  }

  return lines.join('\n');
}

function parseSkillImportArgs(args: string[]): {
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
    unknownFlagMessage: (token) => `Unknown skill flag: ${token}`,
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
      error: 'Usage: ax skill import <path> [--require-trusted]',
    };
  }

  return {
    sourcePath: parsed.positionals[0],
    requireTrusted: parsed.value.requireTrusted,
  };
}

function formatSkillValidationSuccess(entries: SkillLoadSuccess[]): string {
  return [
    `Validated ${entries.length} skill definition${entries.length === 1 ? '' : 's'}.`,
    ...entries.map((entry) => `- ${entry.definition.skillId} (${entry.relativePath})`),
  ].join('\n');
}

function formatSkillValidationFailure(entries: SkillLoadResult[]): string {
  return [
    'Skill validation failed.',
    ...entries.map((entry) => (
      entry.success
        ? `- OK ${entry.definition.skillId} (${entry.relativePath})`
        : `- ERROR ${entry.relativePath}: ${entry.error}`
    )),
  ].join('\n');
}

function formatSkillResolve(
  query: string,
  entries: Array<SkillLoadSuccess & { score: number }>,
): string {
  return [
    `Resolved skills for query: ${query}`,
    ...entries.map((entry) => (
      `- ${entry.definition.skillId} [score=${entry.score}] - ${entry.definition.description ?? 'No description'}`
    )),
  ].join('\n');
}

function formatSkillRunSuccess(result: {
  skillId: string;
  traceId: string;
  dispatch: 'prompt' | 'delegate' | 'bridge';
  bridgeId?: string;
  agentId?: string;
  execution?: {
    command: string;
    args: string[];
    stdout: string;
    stderr: string;
  };
  agentResult?: {
    traceId: string;
    provider: string;
    executionMode: string;
    content: string;
    warnings: string[];
  };
  warnings: string[];
}): string {
  const lines = [
    `Skill executed: ${result.skillId}`,
    `Trace: ${result.traceId}`,
    `Dispatch: ${result.dispatch}`,
  ];

  if (result.bridgeId !== undefined) {
    lines.push(`Bridge: ${result.bridgeId}`);
  }
  if (result.agentId !== undefined) {
    lines.push(`Agent: ${result.agentId}`);
  }
  if (result.execution !== undefined) {
    lines.push(`Command: ${[result.execution.command, ...result.execution.args].join(' ')}`);
    const stdout = result.execution.stdout.trim();
    const stderr = result.execution.stderr.trim();
    if (stdout.length > 0) {
      lines.push('', stdout);
    }
    if (stderr.length > 0) {
      lines.push('', 'stderr:', stderr);
    }
  }
  if (result.agentResult !== undefined) {
    lines.push(`Agent trace: ${result.agentResult.traceId}`);
    lines.push(`Provider: ${result.agentResult.provider}`);
    lines.push(`Mode: ${result.agentResult.executionMode}`);
    if (result.agentResult.content.trim().length > 0) {
      lines.push('', result.agentResult.content.trim());
    }
    for (const warning of result.agentResult.warnings) {
      lines.push(`Warning: ${warning}`);
    }
  }
  for (const warning of result.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  return lines.join('\n');
}

function formatSkillRunFailure(
  result: {
    skillId: string;
    traceId: string;
    dispatch: 'prompt' | 'delegate' | 'bridge';
    bridgeId?: string;
    agentId?: string;
    guidance?: string;
    execution?: {
      command: string;
      args: string[];
      exitCode: number;
      stdout: string;
      stderr: string;
    };
    agentResult?: {
      traceId: string;
      provider: string;
      executionMode: string;
      content: string;
      warnings: string[];
      error?: {
        message?: string;
      };
    };
    warnings: string[];
    error?: {
      message?: string;
    };
  },
): string {
  const lines = [
    `Skill execution failed: ${result.skillId}`,
    `Trace: ${result.traceId}`,
    `Dispatch: ${result.dispatch}`,
    result.error?.message,
  ];

  if (result.bridgeId !== undefined) {
    lines.push(`Bridge: ${result.bridgeId}`);
  }
  if (result.agentId !== undefined) {
    lines.push(`Agent: ${result.agentId}`);
  }
  if (result.execution !== undefined) {
    lines.push(`Command: ${[result.execution.command, ...result.execution.args].join(' ')}`);
    lines.push(`Exit code: ${result.execution.exitCode}`);
    const stdout = result.execution.stdout.trim();
    const stderr = result.execution.stderr.trim();
    if (stdout.length > 0) {
      lines.push('', 'stdout:', stdout);
    }
    if (stderr.length > 0) {
      lines.push('', 'stderr:', stderr);
    }
  }
  if (result.agentResult !== undefined) {
    lines.push(`Agent trace: ${result.agentResult.traceId}`);
    lines.push(`Provider: ${result.agentResult.provider}`);
    lines.push(`Mode: ${result.agentResult.executionMode}`);
    if (result.agentResult.content.trim().length > 0) {
      lines.push('', result.agentResult.content.trim());
    }
    if (result.agentResult.error?.message !== undefined) {
      lines.push(`Agent error: ${result.agentResult.error.message}`);
    }
    for (const warning of result.agentResult.warnings) {
      lines.push(`Warning: ${warning}`);
    }
  }
  if (result.guidance !== undefined) {
    lines.push('', 'Guidance:', result.guidance.trim());
  }
  for (const warning of result.warnings) {
    lines.push(`Warning: ${warning}`);
  }
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0).join('\n');
}
