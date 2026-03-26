import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import { createRuntimeBridgeService } from './bridge-runtime-service.js';
import { createRuntimeSkillService } from './runtime-skill-service.js';
import type {
  RuntimeAgentRunRequest,
  RuntimeAgentRunResponse,
  RuntimeWorkflowRequest,
} from './runtime-service-types.js';

export interface RuntimeWorkflowToolExecutorConfig {
  basePath: string;
  traceId: string;
  sessionId?: string;
  surface: NonNullable<RuntimeWorkflowRequest['surface']>;
  provider?: string;
  model?: string;
  createTraceId(): string;
  traceStore: TraceStore;
  stateStore: StateStore;
  runAgent(request: RuntimeAgentRunRequest): Promise<RuntimeAgentRunResponse>;
}

export function createWorkflowToolExecutor(config: RuntimeWorkflowToolExecutorConfig) {
  const bridgeService = createRuntimeBridgeService({ basePath: config.basePath });
  const skillService = createRuntimeSkillService({
    basePath: config.basePath,
    traceStore: config.traceStore,
    stateStore: config.stateStore,
    createTraceId: config.createTraceId,
    runAgent: config.runAgent,
  });
  const builtinTools = new Set(['skill.run', 'bridge.run', 'bridge.install']);

  return {
    isToolAvailable: (toolName: string) => toolName.trim().length > 0,
    getAvailableTools: () => [...builtinTools],
    execute: async (toolName: string, args: Record<string, unknown>) => {
      switch (toolName) {
        case 'skill.run': {
          const reference = asRequiredString(args.reference, 'reference');
          const result = await skillService.runSkill({
            reference,
            args: asStringArray(args.args),
            task: asOptionalString(args.task),
            input: asOptionalRecord(args.input) ?? stripReservedToolKeys(args, ['reference', 'args', 'task', 'input']),
            traceId: config.createTraceId(),
            sessionId: config.sessionId,
            basePath: config.basePath,
            provider: asOptionalString(args.provider) ?? config.provider,
            model: asOptionalString(args.model) ?? config.model,
            timeoutMs: asOptionalNumber(args.timeoutMs),
            surface: config.surface,
            parentTraceId: config.traceId,
            rootTraceId: config.traceId,
          });

          return {
            success: result.success,
            output: result,
            durationMs: 0,
            error: result.error?.message,
            errorCode: result.error?.code,
            retryable: false,
          };
        }
        case 'bridge.run': {
          const reference = asRequiredString(args.reference, 'reference');
          const bridge = await bridgeService.resolveBridgeReference(reference);
          const execution = await bridgeService.executeBridge(bridge, asStringArray(args.args) ?? []);
          return {
            success: execution.exitCode === 0,
            output: {
              bridge,
              execution,
            },
            durationMs: 0,
            error: execution.exitCode === 0 ? undefined : `Bridge "${bridge.definition.bridgeId}" exited with code ${String(execution.exitCode)}.`,
            errorCode: execution.exitCode === 0 ? undefined : 'BRIDGE_EXECUTION_FAILED',
            retryable: false,
          };
        }
        case 'bridge.install': {
          const sourcePath = asRequiredString(args.sourcePath, 'sourcePath');
          const installed = await bridgeService.installBridgeDefinition(sourcePath, {
            requireTrusted: asOptionalBoolean(args.requireTrusted),
          });
          return {
            success: true,
            output: installed,
            durationMs: 0,
          };
        }
        default:
          return {
            success: true,
            output: {
              toolName,
              args,
              mode: 'shared-runtime-passthrough',
            },
            durationMs: 0,
          };
      }
    },
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRequiredString(value: unknown, field: string): string {
  const normalized = asOptionalString(value);
  if (normalized === undefined) {
    throw new Error(`${field} is required and must be a non-empty string`);
  }
  return normalized;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.map((entry) => String(entry))
    : undefined;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stripReservedToolKeys(
  value: Record<string, unknown>,
  reservedKeys: string[],
): Record<string, unknown> | undefined {
  const reserved = new Set(reservedKeys);
  const entries = Object.entries(value).filter(([key]) => !reserved.has(key));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
