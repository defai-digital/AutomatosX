import {
  getDefaultAgentCatalogEntry,
  getStableAgentEntry,
  listStableAgentCapabilities,
  listStableAgentEntries,
  recommendStableAgents,
  type SharedRuntimeService,
} from '@defai.digital/shared-runtime';
import type { MpcToolResult } from './surface-types.js';
import {
  asInput,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalReviewFocus,
  asOptionalRole,
  asOptionalString,
  asParallelAggregation,
  asParallelFailureStrategy,
  asParallelTasks,
  asString,
  asStringArray,
  isRecord,
} from './tool-argument-parsers.js';

export interface RuntimeOrchestrationToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createRuntimeOrchestrationToolService(config: {
  runtimeService: SharedRuntimeService;
}): RuntimeOrchestrationToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'workflow_run':
          return {
            success: true,
            data: await config.runtimeService.runWorkflow({
              workflowId: asString(args.workflowId, 'workflowId'),
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              workflowDir: asOptionalString(args.workflowDir),
              basePath: asOptionalString(args.basePath),
              provider: asOptionalString(args.provider),
              input: asInput(args.input),
              surface: 'mcp',
            }),
          };
        case 'workflow_list':
          return {
            success: true,
            data: await config.runtimeService.listWorkflows({
              workflowDir: asOptionalString(args.workflowDir),
              basePath: asOptionalString(args.basePath),
            }),
          };
        case 'workflow_describe':
          return {
            success: true,
            data: await config.runtimeService.describeWorkflow({
              workflowId: asString(args.workflowId, 'workflowId'),
              workflowDir: asOptionalString(args.workflowDir),
              basePath: asOptionalString(args.basePath),
            }),
          };
        case 'trace_get':
          return {
            success: true,
            data: await config.runtimeService.getTrace(asString(args.traceId, 'traceId')),
          };
        case 'trace_list':
          return {
            success: true,
            data: await config.runtimeService.listTraces(asOptionalNumber(args.limit)),
          };
        case 'trace_analyze':
          return {
            success: true,
            data: await config.runtimeService.analyzeTrace(asString(args.traceId, 'traceId')),
          };
        case 'trace_by_session':
          return {
            success: true,
            data: await config.runtimeService.listTracesBySession(
              asString(args.sessionId, 'sessionId'),
              asOptionalNumber(args.limit),
            ),
          };
        case 'trace_close_stuck':
          return {
            success: true,
            data: await config.runtimeService.closeStuckTraces(asOptionalNumber(args.maxAgeMs)),
          };
        case 'trace_tree':
          return {
            success: true,
            data: await config.runtimeService.getTraceTree(asString(args.traceId, 'traceId')),
          };
        case 'agent_register':
          return {
            success: true,
            data: await config.runtimeService.registerAgent({
              agentId: asString(args.agentId, 'agentId'),
              name: asString(args.name, 'name'),
              capabilities: asStringArray(args.capabilities),
              metadata: asInput(args.metadata),
            }),
          };
        case 'agent_get':
          return {
            success: true,
            data: getStableAgentEntry(
              asString(args.agentId, 'agentId'),
              await config.runtimeService.getAgent(asString(args.agentId, 'agentId')),
            ),
          };
        case 'agent_list':
          return {
            success: true,
            data: listStableAgentEntries(await config.runtimeService.listAgents()),
          };
        case 'agent_remove':
          return {
            success: true,
            data: { removed: await config.runtimeService.removeAgent(asString(args.agentId, 'agentId')) },
          };
        case 'agent_capabilities':
          return {
            success: true,
            data: listStableAgentCapabilities(await config.runtimeService.listAgents()),
          };
        case 'agent_run': {
          const agentId = asString(args.agentId, 'agentId');
          const result = await config.runtimeService.runAgent({
            agentId,
            task: asOptionalString(args.task),
            input: asInput(args.input),
            traceId: asOptionalString(args.traceId),
            sessionId: asOptionalString(args.sessionId),
            basePath: asOptionalString(args.basePath),
            provider: asOptionalString(args.provider),
            model: asOptionalString(args.model),
            timeoutMs: asOptionalNumber(args.timeoutMs),
            parentTraceId: asOptionalString(args.parentTraceId),
            rootTraceId: asOptionalString(args.rootTraceId),
            surface: 'mcp',
          });
          const stableCatalogEntry = result.success ? undefined : getDefaultAgentCatalogEntry(agentId);
          const stableAgentEntry = result.success ? undefined : getStableAgentEntry(agentId);
          const stableWorkflowCommands = Array.isArray(stableAgentEntry?.metadata?.recommendedCommands)
            ? stableAgentEntry.metadata.recommendedCommands
                .filter((command): command is string => typeof command === 'string' && command.startsWith('ax '))
            : [];
          return {
            success: true,
            data: stableCatalogEntry === undefined || result.error?.code !== 'AGENT_NOT_FOUND'
              ? result
              : {
                ...result,
                warnings: [
                  ...result.warnings,
                  'This built-in agent is part of the stable catalog, but direct agent execution requires runtime registration via "ax setup".',
                  ...(stableWorkflowCommands.length === 0 ? [] : [`Stable workflow commands: ${stableWorkflowCommands.join(', ')}`]),
                ],
              },
          };
        }
        case 'agent_recommend':
          {
            const task = asString(args.task, 'task');
            const requiredCapabilities = asStringArray(args.requiredCapabilities);
            const limit = asOptionalNumber(args.limit);
            const team = asOptionalString(args.team);
            const recommendations = await config.runtimeService.recommendAgents({
              task,
              requiredCapabilities,
              limit,
              team,
            });
            return {
              success: true,
              data: recommendations.length > 0
                ? recommendations
                : recommendStableAgents({
                  agents: await config.runtimeService.listAgents(),
                  task,
                  requiredCapabilities,
                  limit,
                  team,
                }),
            };
          }
        case 'discuss_run':
          return {
            success: true,
            data: await config.runtimeService.runDiscussion({
              topic: asString(args.topic, 'topic'),
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              basePath: asOptionalString(args.basePath),
              provider: asOptionalString(args.provider),
              surface: 'mcp',
              pattern: asOptionalString(args.pattern),
              rounds: asOptionalNumber(args.rounds),
              providers: asStringArray(args.providers),
              consensusMethod: asOptionalString(args.consensusMethod),
              context: asOptionalString(args.context),
              minProviders: asOptionalNumber(args.minProviders),
              verbose: asOptionalBoolean(args.verbose),
            }),
          };
        case 'discuss_quick':
          return {
            success: true,
            data: await config.runtimeService.runDiscussionQuick({
              topic: asString(args.topic, 'topic'),
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              basePath: asOptionalString(args.basePath),
              provider: asOptionalString(args.provider),
              surface: 'mcp',
              pattern: asOptionalString(args.pattern),
              providers: asStringArray(args.providers),
              consensusMethod: asOptionalString(args.consensusMethod),
              context: asOptionalString(args.context),
              minProviders: asOptionalNumber(args.minProviders),
              verbose: asOptionalBoolean(args.verbose),
            }),
          };
        case 'discuss_recursive': {
          const subtopics = asStringArray(args.subtopics);
          if (subtopics === undefined || subtopics.length === 0) {
            throw new Error('subtopics is required and must be a non-empty array');
          }
          return {
            success: true,
            data: await config.runtimeService.runDiscussionRecursive({
              topic: asString(args.topic, 'topic'),
              subtopics,
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              basePath: asOptionalString(args.basePath),
              provider: asOptionalString(args.provider),
              surface: 'mcp',
              pattern: asOptionalString(args.pattern),
              rounds: asOptionalNumber(args.rounds),
              providers: asStringArray(args.providers),
              consensusMethod: asOptionalString(args.consensusMethod),
              context: asOptionalString(args.context),
              minProviders: asOptionalNumber(args.minProviders),
              verbose: asOptionalBoolean(args.verbose),
            }),
          };
        }
        case 'session_create':
          return {
            success: true,
            data: await config.runtimeService.createSession({
              sessionId: asOptionalString(args.sessionId),
              task: asString(args.task, 'task'),
              initiator: asString(args.initiator, 'initiator'),
              workspace: asOptionalString(args.workspace),
              metadata: asInput(args.metadata),
            }),
          };
        case 'session_get':
          return {
            success: true,
            data: await config.runtimeService.getSession(asString(args.sessionId, 'sessionId')),
          };
        case 'session_list':
          return {
            success: true,
            data: await config.runtimeService.listSessions(),
          };
        case 'session_join':
          return {
            success: true,
            data: await config.runtimeService.joinSession({
              sessionId: asString(args.sessionId, 'sessionId'),
              agentId: asString(args.agentId, 'agentId'),
              role: asOptionalRole(args.role),
            }),
          };
        case 'session_leave':
          return {
            success: true,
            data: await config.runtimeService.leaveSession(
              asString(args.sessionId, 'sessionId'),
              asString(args.agentId, 'agentId'),
            ),
          };
        case 'session_complete':
          return {
            success: true,
            data: await config.runtimeService.completeSession(
              asString(args.sessionId, 'sessionId'),
              asOptionalString(args.summary),
            ),
          };
        case 'session_fail':
          return {
            success: true,
            data: await config.runtimeService.failSession(
              asString(args.sessionId, 'sessionId'),
              asString(args.message, 'message'),
            ),
          };
        case 'session_close_stuck':
          return {
            success: true,
            data: await config.runtimeService.closeStuckSessions(asOptionalNumber(args.maxAgeMs)),
          };
        case 'review_analyze':
          return {
            success: true,
            data: await config.runtimeService.analyzeReview({
              paths: asStringArray(args.paths) ?? [],
              focus: asOptionalReviewFocus(args.focus),
              maxFiles: asOptionalNumber(args.maxFiles),
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              basePath: asOptionalString(args.basePath),
              surface: 'mcp',
            }),
          };
        case 'review_list':
          return {
            success: true,
            data: await config.runtimeService.listReviewTraces(asOptionalNumber(args.limit)),
          };
        case 'parallel_plan':
          return {
            success: true,
            data: await config.runtimeService.planParallel({
              tasks: asParallelTasks(args.tasks),
            }),
          };
        case 'parallel_run':
          return {
            success: true,
            data: await config.runtimeService.runParallel({
              tasks: asParallelTasks(args.tasks),
              traceId: asOptionalString(args.traceId),
              sessionId: asOptionalString(args.sessionId),
              maxConcurrent: asOptionalNumber(args.maxConcurrent),
              failureStrategy: asParallelFailureStrategy(args.failureStrategy),
              resultAggregation: asParallelAggregation(args.resultAggregation),
              surface: 'mcp',
            }),
          };
        default:
          return undefined;
      }
    },
  };
}
