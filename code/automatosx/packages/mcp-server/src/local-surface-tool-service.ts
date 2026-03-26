import type { McpInProcessToolStateService } from './inprocess-tool-state-service.js';
import type { MpcToolResult } from './surface-types.js';
import type { McpSurfaceMetadataService } from './surface-metadata-service.js';
import {
  asInput,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asString,
  asStringArray,
} from './tool-argument-parsers.js';

export interface LocalSurfaceToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createLocalSurfaceToolService(config: {
  inProcessStateService: McpInProcessToolStateService;
  metadataService: McpSurfaceMetadataService;
}): LocalSurfaceToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'timer_start':
          return config.inProcessStateService.startTimer(asString(args.name, 'name'));
        case 'timer_stop':
          return config.inProcessStateService.stopTimer(asString(args.name, 'name'));
        case 'queue_create':
          return config.inProcessStateService.createQueue(
            asString(args.queueId, 'queueId'),
            asOptionalNumber(args.maxSize) ?? 1000,
          );
        case 'queue_list':
          return config.inProcessStateService.listQueues();
        case 'mcp_server_list':
          return config.inProcessStateService.listServers();
        case 'mcp_server_register':
          return config.inProcessStateService.registerServer({
            serverId: asString(args.serverId, 'serverId'),
            command: asString(args.command, 'command'),
            args: asStringArray(args.args) ?? [],
            description: asOptionalString(args.description) ?? '',
          });
        case 'mcp_server_unregister':
          return config.inProcessStateService.unregisterServer(asString(args.serverId, 'serverId'));
        case 'mcp_tools_list': {
          const prefix = asOptionalString(args.prefix);
          const tools = config.metadataService.listToolDefinitions()
            .filter((tool) => prefix === undefined || tool.name.startsWith(prefix))
            .map((tool) => ({ name: tool.name, description: tool.description }));
          return {
            success: true,
            data: { tools, count: tools.length },
          };
        }
        case 'mcp_tools_discover': {
          const query = asString(args.query, 'query').toLowerCase();
          const tools = config.metadataService.listToolDefinitions()
            .filter((tool) => {
              return tool.name.toLowerCase().includes(query)
                || tool.description.toLowerCase().includes(query);
            })
            .map((tool) => ({ name: tool.name, description: tool.description }));
          return {
            success: true,
            data: { query, tools, count: tools.length },
          };
        }
        case 'design_list':
          return config.inProcessStateService.listDesignArtifacts(asOptionalString(args.domain));
        case 'metrics_record':
          return config.inProcessStateService.recordMetric(
            asString(args.name, 'name'),
            typeof args.value === 'number' ? args.value : 0,
            asStringArray(args.tags) ?? [],
          );
        case 'metrics_increment':
          return config.inProcessStateService.incrementMetric(
            asString(args.name, 'name'),
            typeof args.amount === 'number' ? args.amount : 1,
            asStringArray(args.tags) ?? [],
          );
        case 'metrics_list':
          return config.inProcessStateService.listMetrics();
        case 'metrics_query':
          return config.inProcessStateService.queryMetric(asString(args.name, 'name'));
        case 'telemetry_summary':
          return config.inProcessStateService.summarizeMetrics();
        case 'task_submit':
          return config.inProcessStateService.submitTask({
            taskId: asString(args.taskId, 'taskId'),
            type: asString(args.type, 'type'),
            payload: asInput(args.payload) ?? {},
            priority: typeof args.priority === 'number' ? args.priority : 0,
          });
        case 'task_status':
          return config.inProcessStateService.getTask(asString(args.taskId, 'taskId'));
        case 'task_list':
          return config.inProcessStateService.listTasks(
            asOptionalString(args.status),
            asOptionalNumber(args.limit) ?? 50,
          );
        case 'task_cancel':
          return config.inProcessStateService.cancelTask(asString(args.taskId, 'taskId'));
        case 'task_retry':
          return config.inProcessStateService.retryTask(asString(args.taskId, 'taskId'));
        case 'scaffold_contract':
        case 'scaffold_domain':
        case 'scaffold_guard': {
          const subcommand = toolName.split('_')[1]!;
          const nameArg = asOptionalString(args.name ?? args.policyId);
          if (nameArg === undefined) {
            return {
              success: false,
              error: `scaffold_${subcommand}: "name" is required`,
            };
          }
          const subArgs = [subcommand, nameArg];
          if (args.description !== undefined) {
            subArgs.push('-d', asString(args.description, 'description'));
          }
          if (args.scope !== undefined) {
            subArgs.push('-s', asString(args.scope, 'scope'));
          }
          if (args.output !== undefined) {
            subArgs.push('-o', asString(args.output, 'output'));
          }
          if (args.domain !== undefined) {
            subArgs.push('-m', asString(args.domain, 'domain'));
          }
          if (args.gates !== undefined) {
            subArgs.push('-g', asString(args.gates, 'gates'));
          }
          if (args.radius !== undefined) {
            subArgs.push('-r', String(asOptionalNumber(args.radius) ?? 3));
          }
          if (asOptionalBoolean(args.noTests) === true) {
            subArgs.push('--no-tests');
          }
          if (asOptionalBoolean(args.noGuard) === true) {
            subArgs.push('--no-guard');
          }
          if (asOptionalBoolean(args.dryRun) === true) {
            subArgs.push('--dry-run');
          }
          return {
            success: true,
            data: {
              subcommand,
              args: subArgs,
              message: `Run: ax scaffold ${subArgs.join(' ')}`,
            },
          };
        }
        default:
          return undefined;
      }
    },
  };
}
