import type {
  DiscussionResultLike,
  DiscussStepConfigLike,
} from '@defai.digital/workflow-engine';

interface DiscussionCoordinatorLike {
  run(request: {
    traceId: string;
    provider?: string;
    config: DiscussStepConfigLike;
  }): Promise<DiscussionResultLike>;
}

export function createWorkflowDiscussionExecutor(
  traceId: string,
  provider: string | undefined,
  coordinator: DiscussionCoordinatorLike,
) {
  return {
    execute: async (config: DiscussStepConfigLike) => coordinator.run({
      traceId,
      provider,
      config,
    }),
  };
}
