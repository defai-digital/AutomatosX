import type { SharedRuntimeService } from '@defai.digital/shared-runtime';
import type { MpcToolResult } from './surface-types.js';
import {
  asOptionalBoolean,
  asOptionalFloat,
  asOptionalNumber,
  asOptionalReviewFocus,
  asOptionalString,
  asRecordArray,
  asInput,
  asString,
  asStringArray,
} from './tool-argument-parsers.js';

export interface RuntimeStateToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createRuntimeStateToolService(config: {
  runtimeService: SharedRuntimeService;
}): RuntimeStateToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'memory_retrieve':
          return {
            success: true,
            data: await config.runtimeService.getMemory(
              asString(args.key, 'key'),
              asOptionalString(args.namespace),
            ),
          };
        case 'memory_search':
          return {
            success: true,
            data: await config.runtimeService.searchMemory(
              asString(args.query, 'query'),
              asOptionalString(args.namespace),
            ),
          };
        case 'memory_delete':
          return {
            success: true,
            data: {
              deleted: await config.runtimeService.deleteMemory(
                asString(args.key, 'key'),
                asOptionalString(args.namespace),
              ),
            },
          };
        case 'memory_store':
          return {
            success: true,
            data: await config.runtimeService.storeMemory({
              key: asString(args.key, 'key'),
              namespace: asOptionalString(args.namespace),
              value: args.value,
            }),
          };
        case 'memory_list':
          return {
            success: true,
            data: await config.runtimeService.listMemory(asOptionalString(args.namespace)),
          };
        case 'semantic_store':
          return {
            success: true,
            data: await config.runtimeService.storeSemantic({
              key: asString(args.key, 'key'),
              namespace: asOptionalString(args.namespace),
              content: asString(args.content, 'content'),
              tags: asStringArray(args.tags),
              metadata: asInput(args.metadata),
            }),
          };
        case 'semantic_search':
          return {
            success: true,
            data: await config.runtimeService.searchSemantic(asString(args.query, 'query'), {
              namespace: asOptionalString(args.namespace),
              filterTags: asStringArray(args.filterTags),
              topK: asOptionalNumber(args.topK),
              minSimilarity: asOptionalFloat(args.minSimilarity),
            }),
          };
        case 'semantic_get':
          return {
            success: true,
            data: await config.runtimeService.getSemantic(
              asString(args.key, 'key'),
              asOptionalString(args.namespace),
            ),
          };
        case 'semantic_list':
          return {
            success: true,
            data: await config.runtimeService.listSemantic({
              namespace: asOptionalString(args.namespace),
              keyPrefix: asOptionalString(args.keyPrefix),
              filterTags: asStringArray(args.filterTags),
              limit: asOptionalNumber(args.limit),
            }),
          };
        case 'semantic_delete':
          return {
            success: true,
            data: {
              deleted: await config.runtimeService.deleteSemantic(
                asString(args.key, 'key'),
                asOptionalString(args.namespace),
              ),
            },
          };
        case 'semantic_stats':
          return {
            success: true,
            data: await config.runtimeService.semanticStats(asOptionalString(args.namespace)),
          };
        case 'semantic_clear':
          if (args.confirm !== true) {
            throw new Error('semantic.clear requires confirm=true');
          }
          return {
            success: true,
            data: {
              cleared: await config.runtimeService.clearSemantic(
                asString(args.namespace, 'namespace'),
              ),
            },
          };
        case 'feedback_submit':
          return {
            success: true,
            data: await config.runtimeService.submitFeedback({
              selectedAgent: asString(args.selectedAgent, 'selectedAgent'),
              recommendedAgent: asOptionalString(args.recommendedAgent),
              rating: asOptionalNumber(args.rating),
              feedbackType: asOptionalString(args.feedbackType),
              taskDescription: asString(args.taskDescription, 'taskDescription'),
              userComment: asOptionalString(args.userComment),
              outcome: asOptionalString(args.outcome),
              durationMs: asOptionalNumber(args.durationMs),
              sessionId: asOptionalString(args.sessionId),
              metadata: asInput(args.metadata),
            }),
          };
        case 'feedback_history':
          return {
            success: true,
            data: await config.runtimeService.listFeedbackHistory({
              agentId: asOptionalString(args.agentId),
              limit: asOptionalNumber(args.limit),
              since: asOptionalString(args.since),
            }),
          };
        case 'feedback_stats':
          return {
            success: true,
            data: await config.runtimeService.getFeedbackStats(asString(args.agentId, 'agentId')),
          };
        case 'feedback_overview':
          return {
            success: true,
            data: await config.runtimeService.getFeedbackOverview(),
          };
        case 'feedback_adjustments':
          return {
            success: true,
            data: await config.runtimeService.getFeedbackAdjustments(
              asString(args.agentId, 'agentId'),
            ),
          };
        case 'ability_list':
          return {
            success: true,
            data: await config.runtimeService.listAbilities({
              category: asOptionalString(args.category),
              tags: asStringArray(args.tags),
            }),
          };
        case 'ability_inject':
          return {
            success: true,
            data: await config.runtimeService.injectAbilities({
              task: asString(args.task, 'task'),
              requiredAbilities: asStringArray(args.requiredAbilities),
              category: asOptionalString(args.category),
              tags: asStringArray(args.tags),
              maxAbilities: asOptionalNumber(args.maxAbilities),
              includeMetadata: asOptionalBoolean(args.includeMetadata),
            }),
          };
        case 'config_get':
          return {
            success: true,
            data: await config.runtimeService.getConfig(asString(args.path, 'path')),
          };
        case 'config_set':
          return {
            success: true,
            data: await config.runtimeService.setConfig(
              asString(args.path, 'path'),
              args.value,
            ),
          };
        case 'config_show':
          return {
            success: true,
            data: await config.runtimeService.showConfig(),
          };
        case 'memory_export': {
          const entries = await config.runtimeService.listMemory(asOptionalString(args.namespace));
          return {
            success: true,
            data: { entries, count: entries.length },
          };
        }
        case 'memory_import': {
          const rawEntries = asRecordArray(args.entries) ?? [];
          const overwrite = args.overwrite === true;
          let imported = 0;
          let skipped = 0;
          for (const entry of rawEntries) {
            const key = asOptionalString(entry['key']);
            if (key === undefined) {
              skipped++;
              continue;
            }
            if (!overwrite) {
              const existing = await config.runtimeService.getMemory(
                key,
                asOptionalString(entry['namespace']),
              );
              if (existing !== undefined) {
                skipped++;
                continue;
              }
            }
            await config.runtimeService.storeMemory({
              key,
              namespace: asOptionalString(entry['namespace']),
              value: entry['value'],
            });
            imported++;
          }
          return {
            success: true,
            data: { imported, skipped },
          };
        }
        case 'memory_stats': {
          const entries = await config.runtimeService.listMemory(asOptionalString(args.namespace));
          const byNamespace: Record<string, number> = {};
          for (const entry of entries) {
            const namespace = entry.namespace ?? 'default';
            byNamespace[namespace] = (byNamespace[namespace] ?? 0) + 1;
          }
          return {
            success: true,
            data: {
              stats: Object.entries(byNamespace).map(([namespace, count]) => ({ namespace, count })),
            },
          };
        }
        case 'memory_clear': {
          const namespace = asString(args.namespace, 'namespace');
          const entries = await config.runtimeService.listMemory(namespace);
          let deleted = 0;
          for (const entry of entries) {
            if (await config.runtimeService.deleteMemory(entry.key, namespace)) {
              deleted++;
            }
          }
          return {
            success: true,
            data: { namespace, deleted },
          };
        }
        case 'memory_bulk_delete': {
          const keys = asStringArray(args.keys) ?? [];
          const namespace = asOptionalString(args.namespace);
          let deleted = 0;
          for (const key of keys) {
            if (await config.runtimeService.deleteMemory(key, namespace)) {
              deleted++;
            }
          }
          return {
            success: true,
            data: { deleted, requested: keys.length },
          };
        }
        case 'ability_get': {
          const abilityId = asString(args.abilityId, 'abilityId');
          const entry = await config.runtimeService.getSemantic(abilityId, 'ax.abilities');
          if (entry === undefined) {
            return {
              success: false,
              error: `Ability "${abilityId}" not found`,
            };
          }
          return {
            success: true,
            data: entry.metadata ?? { abilityId, content: entry.content },
          };
        }
        case 'ability_register': {
          const abilityId = asString(args.abilityId, 'abilityId');
          return {
            success: true,
            data: await config.runtimeService.storeSemantic({
              key: abilityId,
              namespace: 'ax.abilities',
              content: asString(args.content, 'content'),
              tags: asStringArray(args.tags) ?? [],
              metadata: {
                abilityId,
                displayName: asString(args.displayName, 'displayName'),
                description: asString(args.description, 'description'),
                category: asOptionalString(args.category),
                enabled: asOptionalBoolean(args.enabled) ?? true,
                registeredAt: new Date().toISOString(),
              },
            }),
          };
        }
        case 'ability_remove': {
          const abilityId = asString(args.abilityId, 'abilityId');
          const removed = await config.runtimeService.deleteSemantic(abilityId, 'ax.abilities');
          return {
            success: true,
            data: { abilityId, removed },
          };
        }
        default:
          return undefined;
      }
    },
  };
}
