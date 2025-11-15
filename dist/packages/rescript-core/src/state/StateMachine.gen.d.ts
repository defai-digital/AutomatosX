export type state<s> = "Idle" | {
    TAG: "Running";
    _0: s;
} | {
    TAG: "Paused";
    _0: s;
} | {
    TAG: "Completed";
    _0: s;
} | {
    TAG: "Failed";
    _0: string;
};
export type event<e> = {
    readonly id: string;
    readonly timestamp: number;
    readonly data: e;
    readonly metadata: (undefined | {
        [id: string]: string;
    });
};
export type transition<s, e> = {
    readonly from: state<s>;
    readonly event: e;
    readonly to: state<s>;
    readonly guard: (undefined | ((_1: s) => boolean));
    readonly action: (undefined | ((_1: s) => Promise<void>));
};
export type stateMachine<s, e> = {
    currentState: state<s>;
    readonly transitions: transition<s, e>[];
    history: historyEntry<s, e>[];
    readonly config: machineConfig;
};
export type historyEntry<s, e> = {
    readonly from: state<s>;
    readonly to: state<s>;
    readonly event: event<e>;
    readonly timestamp: number;
    readonly success: boolean;
    readonly error: (undefined | string);
};
export type machineConfig = {
    readonly maxHistorySize: number;
    readonly enableLogging: boolean;
    readonly strict: boolean;
};
export type statistics = {
    readonly totalTransitions: number;
    readonly successfulTransitions: number;
    readonly failedTransitions: number;
    readonly guardBlockedTransitions: number;
    readonly actionFailedTransitions: number;
};
export declare const createEvent: <e>(id: string, data: e, metadata: (undefined | {
    [id: string]: string;
}), param: void) => event<e>;
export declare const create: <e, s>(initialState: state<s>, transitions: transition<s, e>[], config: (undefined | machineConfig), param: void) => stateMachine<s, e>;
export declare const transition: <e, s>(machine: stateMachine<s, e>, event: event<e>) => Promise<{
    TAG: "Ok";
    _0: state<s>;
} | {
    TAG: "Error";
    _0: string;
}>;
export declare const getCurrentState: <e, s>(machine: stateMachine<s, e>) => state<s>;
export declare const getHistory: <e, s>(machine: stateMachine<s, e>) => historyEntry<s, e>[];
export declare const getHistoryLength: <e, s>(machine: stateMachine<s, e>) => number;
export declare const isIdle: <e, s>(machine: stateMachine<s, e>) => boolean;
export declare const isRunning: <e, s>(machine: stateMachine<s, e>) => boolean;
export declare const isPaused: <e, s>(machine: stateMachine<s, e>) => boolean;
export declare const isCompleted: <e, s>(machine: stateMachine<s, e>) => boolean;
export declare const isFailed: <e, s>(machine: stateMachine<s, e>) => boolean;
export declare const getFailureReason: <e, s>(machine: stateMachine<s, e>) => (undefined | string);
export declare const reset: <e, s>(machine: stateMachine<s, e>, initialState: state<s>) => void;
export declare const canTransition: <e, s>(machine: stateMachine<s, e>, eventData: e) => boolean;
export declare const getPossibleTransitions: <e, s>(machine: stateMachine<s, e>) => transition<s, e>[];
export declare const getStatistics: <e, s>(machine: stateMachine<s, e>) => statistics;
//# sourceMappingURL=StateMachine.gen.d.ts.map