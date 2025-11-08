export const runtimeStates = {
    bootstrapping: 'Bootstrapping',
    idle: 'Idle',
    preparing: 'Preparing',
    waitingOnDependency: 'WaitingOnDependency',
    executing: 'Executing',
    completed: 'Completed',
    failed: 'Failed',
    canceled: 'Canceled',
};
export const runtimeEvents = {
    dependenciesReady: 'DependenciesReady',
    retryTrigger: 'RetryTrigger',
    telemetryFlushed: 'TelemetryFlushed',
    taskSubmitted: (payload) => ({
        TAG: 'TaskSubmitted',
        _0: payload,
    }),
    ruleViolation: (code) => ({
        TAG: 'RuleViolation',
        _0: code,
    }),
    timeout: (ms) => ({
        TAG: 'Timeout',
        _0: ms,
    }),
    cancelRequest: (requestedBy) => ({
        TAG: 'CancelRequest',
        _0: { requestedBy },
    }),
};
//# sourceMappingURL=runtimeTestUtils.js.map