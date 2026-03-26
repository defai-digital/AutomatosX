import type { StepGuardPolicy } from '@defai.digital/contracts';
import type { DashboardService } from '@defai.digital/monitoring';
import type { SharedRuntimeService } from '@defai.digital/shared-runtime';
import type { MpcToolResult } from './surface-types.js';
import {
  asInput,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asString,
  asStringArray,
  isRecord,
} from './tool-argument-parsers.js';

export interface RuntimeSupportToolService {
  invokeTool(toolName: string, args: Record<string, unknown>): Promise<MpcToolResult | undefined>;
}

export function createRuntimeSupportToolService(config: {
  runtimeService: SharedRuntimeService;
  dashboardService: DashboardService;
}): RuntimeSupportToolService {
  return {
    async invokeTool(toolName, args) {
      switch (toolName) {
        case 'git_status':
          return {
            success: true,
            data: await config.runtimeService.gitStatus({
              basePath: asOptionalString(args.basePath),
            }),
          };
        case 'git_diff':
          return {
            success: true,
            data: await config.runtimeService.gitDiff({
              basePath: asOptionalString(args.basePath),
              paths: asStringArray(args.paths),
              staged: asOptionalBoolean(args.staged),
              commit: asOptionalString(args.commit),
              stat: asOptionalBoolean(args.stat),
            }),
          };
        case 'commit_prepare':
          return {
            success: true,
            data: await config.runtimeService.commitPrepare({
              basePath: asOptionalString(args.basePath),
              paths: asStringArray(args.paths),
              stageAll: asOptionalBoolean(args.stageAll),
              type: asOptionalString(args.type),
              scope: asOptionalString(args.scope),
            }),
          };
        case 'pr_review':
          return {
            success: true,
            data: await config.runtimeService.reviewPullRequest({
              basePath: asOptionalString(args.basePath),
              base: asOptionalString(args.base),
              head: asOptionalString(args.head),
            }),
          };
        case 'pr_create':
          return {
            success: true,
            data: await config.runtimeService.createPullRequest({
              title: asString(args.title, 'title'),
              body: asOptionalString(args.body),
              base: asOptionalString(args.base),
              head: asOptionalString(args.head),
              draft: asOptionalBoolean(args.draft),
              basePath: asOptionalString(args.basePath),
            }),
          };
        case 'guard_list':
          return {
            success: true,
            data: await config.runtimeService.listGuardPolicies(),
          };
        case 'guard_apply':
          return {
            success: true,
            data: await config.runtimeService.applyGuardPolicy({
              policyId: asOptionalString(args.policyId),
              definition: isRecord(args.definition)
                ? args.definition as StepGuardPolicy
                : undefined,
              enabled: asOptionalBoolean(args.enabled),
            }),
          };
        case 'guard_check':
          return {
            success: true,
            data: await config.runtimeService.checkGuards({
              policyId: asOptionalString(args.policyId),
              position: args.position === 'after' ? 'after' : 'before',
              agentId: asOptionalString(args.agentId),
              executionId: asOptionalString(args.executionId),
              sessionId: asOptionalString(args.sessionId),
              workflowId: asOptionalString(args.workflowId),
              stepId: asString(args.stepId, 'stepId'),
              stepType: asString(args.stepType, 'stepType'),
              stepIndex: asOptionalNumber(args.stepIndex),
              totalSteps: asOptionalNumber(args.totalSteps),
              previousOutputs: asInput(args.previousOutputs),
              stepConfig: asInput(args.stepConfig),
            }),
          };
        case 'policy_register':
          return {
            success: true,
            data: await config.runtimeService.registerPolicy({
              policyId: asString(args.policyId, 'policyId'),
              name: asString(args.name, 'name'),
              enabled: asOptionalBoolean(args.enabled) ?? true,
              metadata: isRecord(args.metadata) ? args.metadata : undefined,
            }),
          };
        case 'policy_list':
          return {
            success: true,
            data: await config.runtimeService.listPolicies(),
          };
        case 'dashboard_list':
          return {
            success: true,
            data: await config.dashboardService.listWorkflowExecutions(asOptionalNumber(args.limit)),
          };
        default:
          return undefined;
      }
    },
  };
}
