export declare const runtimeStates: {
    readonly bootstrapping: "Bootstrapping";
    readonly idle: "Idle";
    readonly preparing: "Preparing";
    readonly waitingOnDependency: "WaitingOnDependency";
    readonly executing: "Executing";
    readonly completed: "Completed";
    readonly failed: "Failed";
    readonly canceled: "Canceled";
};
export declare const runtimeEvents: {
    readonly dependenciesReady: "DependenciesReady";
    readonly retryTrigger: "RetryTrigger";
    readonly telemetryFlushed: "TelemetryFlushed";
    readonly taskSubmitted: (payload: {
        taskId: string;
        manifestVersion: string;
    }) => {
        TAG: string;
        _0: {
            taskId: string;
            manifestVersion: string;
        };
    };
    readonly ruleViolation: (code: string) => {
        TAG: string;
        _0: string;
    };
    readonly timeout: (ms: number) => {
        TAG: string;
        _0: number;
    };
    readonly cancelRequest: (requestedBy: string) => {
        TAG: string;
        _0: {
            requestedBy: string;
        };
    };
};
//# sourceMappingURL=runtimeTestUtils.d.ts.map