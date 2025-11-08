type GuardVerdictConfig = {
    kind: 'allow';
} | {
    kind: 'block';
    reason?: string;
};
export type GuardContextOverrides = {
    dependenciesReady?: boolean;
    telemetryPending?: boolean;
    cancellationRequested?: boolean;
    guardVerdict?: GuardVerdictConfig;
};
export declare const buildGuardContext: (overrides?: GuardContextOverrides) => any;
export {};
//# sourceMappingURL=guardFixtureFactory.d.ts.map