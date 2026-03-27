import {
  createRuntimeBridgeService,
  scoreSkillAgainstQuery,
  type SkillLoadSuccess,
} from '@defai.digital/shared-runtime/bridge';
import {
  buildDeniedImportedSkillAggregate,
  buildRuntimeGovernanceAggregate,
} from '@defai.digital/shared-runtime/governance';
import {
  type SharedRuntimeService,
} from '@defai.digital/shared-runtime';
import type { MpcToolResult } from './surface-types.js';
import {
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asString,
} from './tool-argument-parsers.js';

export interface RuntimeBridgeToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createRuntimeBridgeToolService(config: {
  basePath: string;
  runtimeService: SharedRuntimeService;
}): RuntimeBridgeToolService {
  return {
    async invokeTool(toolName, args) {
      const basePath = asOptionalString(args.basePath) ?? config.basePath;
      const bridgeService = createRuntimeBridgeService({ basePath });

      switch (toolName) {
        case 'bridge_list': {
          const discovered = await bridgeService.discoverBridgeDefinitions();
          const limit = asOptionalNumber(args.limit);
          const limited = typeof limit === 'number' && limit > 0
            ? discovered.slice(0, limit)
            : discovered;
          return {
            success: true,
            data: {
              bridges: limited,
              total: discovered.length,
            },
          };
        }
        case 'governance_get': {
          const limit = asOptionalNumber(args.limit) ?? 50;
          const [status, deniedImportedSkills] = await Promise.all([
            config.runtimeService.getStatus({ limit }),
            buildDeniedImportedSkillAggregate(basePath),
          ]);
          return {
            success: true,
            data: buildRuntimeGovernanceAggregate(status.recentFailedTraces, {
              deniedImportedSkills,
            }),
          };
        }
        case 'bridge_inspect':
          return {
            success: true,
            data: await bridgeService.resolveBridgeReference(asString(args.reference, 'reference')),
          };
        case 'bridge_install':
          return {
            success: true,
            data: await bridgeService.installBridgeDefinition(asString(args.sourcePath, 'sourcePath'), {
              requireTrusted: asOptionalBoolean(args.requireTrusted),
            }),
          };
        case 'bridge_run': {
          const bridge = await bridgeService.resolveBridgeReference(asString(args.reference, 'reference'));
          const execution = await bridgeService.executeBridge(bridge, normalizeStringArray(args.args));
          return execution.exitCode === 0
            ? {
              success: true,
              data: {
                bridge,
                execution,
              },
            }
            : {
              success: false,
              error: `Bridge "${bridge.definition.bridgeId}" exited with code ${String(execution.exitCode)}.`,
              data: {
                bridge,
                execution,
              },
            };
        }
        case 'skill_list': {
          const discovered = await bridgeService.discoverSkillDefinitions();
          const limit = asOptionalNumber(args.limit);
          const limited = typeof limit === 'number' && limit > 0
            ? discovered.slice(0, limit)
            : discovered;
          return {
            success: true,
            data: {
              skills: limited,
              total: discovered.length,
            },
          };
        }
        case 'skill_resolve': {
          const query = asString(args.query, 'query');
          const discovered = await bridgeService.discoverSkillDefinitions();
          const matches = discovered
            .filter((entry): entry is SkillLoadSuccess => entry.success)
            .map((entry) => ({
              ...entry,
              score: scoreSkillAgainstQuery(entry.definition, query),
            }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => right.score - left.score || left.definition.skillId.localeCompare(right.definition.skillId));
          const limit = asOptionalNumber(args.limit);
          const limited = typeof limit === 'number' && limit > 0
            ? matches.slice(0, limit)
            : matches.slice(0, 10);
          return {
            success: true,
            data: {
              query,
              matches: limited,
            },
          };
        }
        case 'skill_run': {
          const result = await config.runtimeService.runSkill({
            reference: asString(args.reference, 'reference'),
            args: normalizeStringArray(args.args),
            task: asOptionalString(args.task),
            traceId: asOptionalString(args.traceId),
            sessionId: asOptionalString(args.sessionId),
            basePath,
            provider: asOptionalString(args.provider),
            model: asOptionalString(args.model),
            surface: 'mcp',
          });
          return result.success
            ? {
              success: true,
              data: result,
            }
            : {
              success: false,
              error: result.error?.message ?? `Skill "${result.skillId}" failed.`,
              data: result,
            };
        }
        default:
          return undefined;
      }
    },
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry))
    : [];
}
