export const runtimeStates = {
  bootstrapping: 'Bootstrapping',
  idle: 'Idle',
  preparing: 'Preparing',
  waitingOnDependency: 'WaitingOnDependency',
  executing: 'Executing',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
} as const

export const runtimeEvents = {
  dependenciesReady: 'DependenciesReady',
  retryTrigger: 'RetryTrigger',
  telemetryFlushed: 'TelemetryFlushed',
  taskSubmitted: (payload: { taskId: string; manifestVersion: string }) => ({
    TAG: 'TaskSubmitted',
    _0: payload,
  }),
  ruleViolation: (code: string) => ({
    TAG: 'RuleViolation',
    _0: code,
  }),
  timeout: (ms: number) => ({
    TAG: 'Timeout',
    _0: ms,
  }),
  cancelRequest: (requestedBy: string) => ({
    TAG: 'CancelRequest',
    _0: { requestedBy },
  }),
} as const
