import {
  type DiscussionResultLike,
  type DiscussStepConfigLike,
  type StepGuardPolicy,
} from '@defai.digital/workflow-engine';
import type { StateStore } from '@defai.digital/state-store';
import type { TraceStore } from '@defai.digital/trace-store';
import { createRuntimeProviderCallService } from './runtime-provider-call-service.js';
import { createRuntimeWorkflowRunnerService } from './runtime-workflow-runner-service.js';
import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';
import type {
  SharedRuntimeService,
} from './runtime-service-types.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

interface DiscussionCoordinatorLike {
  run(request: {
    traceId: string;
    provider?: string;
    config: DiscussStepConfigLike;
  }): Promise<DiscussionResultLike>;
}

export interface RuntimeExecutionServiceConfig {
  basePath: string;
  traceStore: TraceStore;
  stateStore: StateStore;
  resolveProviderBridge(requestBasePath?: string): ProviderBridgeLike;
  resolveDiscussionCoordinator(requestBasePath?: string): DiscussionCoordinatorLike;
  resolveWorkflowDir(
    explicitWorkflowDir: string | undefined,
    requestBasePath: string | undefined,
    defaultBasePath: string,
  ): string;
  resolveGuardPolicies(): Promise<StepGuardPolicy[]>;
  tokenize(value: string): number;
  createTraceId(): string;
  runAgent(request: import('./runtime-service-types.js').RuntimeAgentRunRequest): Promise<import('./runtime-service-types.js').RuntimeAgentRunResponse>;
}

type RuntimeExecutionService = Pick<
  SharedRuntimeService,
  'callProvider' | 'runWorkflow'
>;

export function createRuntimeExecutionService(
  config: RuntimeExecutionServiceConfig,
): RuntimeExecutionService {
  const {
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    resolveWorkflowDir,
    resolveGuardPolicies,
    tokenize,
    createTraceId,
    runAgent,
  } = config;

  const providerCallService = createRuntimeProviderCallService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    tokenize,
    createTraceId,
  });
  const workflowRunnerService = createRuntimeWorkflowRunnerService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
    resolveWorkflowDir,
    resolveGuardPolicies,
    tokenize,
    createTraceId,
    runAgent,
  });

  return {
    ...providerCallService,
    ...workflowRunnerService,
  };
}
