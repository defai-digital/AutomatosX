import type { ref as PervasivesU_ref } from './PervasivesU.gen';
import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type state<s> = {
    readonly current: s;
    readonly previous: (undefined | s);
    readonly enteredAt: number;
};
export type transition<s, e> = {
    readonly from: s;
    readonly event: e;
    readonly to: s;
    readonly guard: (undefined | (() => boolean));
};
export type stateMachine<s, e> = {
    readonly initial: s;
    readonly current: PervasivesU_ref<state<s>>;
    readonly transitions: transition<s, e>[];
    readonly onEnter: (undefined | ((_1: s, _2: s) => void));
    readonly onExit: (undefined | ((_1: s, _2: s) => void));
};
export type taskState = "pending" | "running" | "completed" | "failed" | "cancelled";
export type taskEvent = "start" | "complete" | "fail" | "cancel" | "retry";
export type connectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";
export type connectionEvent = "connect" | "connected" | "disconnect" | "error" | "retry";
export type requestState = "idle" | "loading" | "success" | "error";
export type requestEvent = "fetch" | "success" | "error" | "reset";
export type historyEntry<s> = {
    readonly state: s;
    readonly enteredAt: number;
    readonly exitedAt: (undefined | number);
};
export type stateMachineWithHistory<s, e> = {
    readonly machine: stateMachine<s, e>;
    readonly history: PervasivesU_ref<historyEntry<s>[]>;
};
export declare const createStateMachine: <e, s>(initial: s, transitions: transition<s, e>[], onEnter: (undefined | (undefined | (((_1: s, _2: s) => void)))), onExit: (undefined | (undefined | (((_1: s, _2: s) => void))))) => stateMachine<s, e>;
export declare const getCurrentState: <e, s>(machine: stateMachine<s, e>) => s;
export declare const getPreviousState: <e, s>(machine: stateMachine<s, e>) => (undefined | s);
export declare const getTimeInState: <e, s>(machine: stateMachine<s, e>) => number;
export declare const isInState: <e, s>(machine: stateMachine<s, e>, state: s) => boolean;
export declare const findTransition: <e, s>(machine: stateMachine<s, e>, event: e) => (undefined | transition<s, e>);
export declare const canTransition: <e, s>(machine: stateMachine<s, e>, event: e) => boolean;
export declare const getValidTransitions: <e, s>(machine: stateMachine<s, e>) => transition<s, e>[];
export declare const makeTransition: <e, s>(machine: stateMachine<s, e>, event: e) => ErrorHandling_result<s, string>;
export declare const reset: <e, s>(machine: stateMachine<s, e>) => void;
export declare const createTaskStateMachine: () => stateMachine<taskState, taskEvent>;
export declare const createConnectionStateMachine: () => stateMachine<connectionState, connectionEvent>;
export declare const createRequestStateMachine: () => stateMachine<requestState, requestEvent>;
export declare const createWithHistory: <e, s>(machine: stateMachine<s, e>) => stateMachineWithHistory<s, e>;
export declare const makeTransitionWithHistory: <e, s>(sm: stateMachineWithHistory<s, e>, event: e) => ErrorHandling_result<s, string>;
export declare const getHistory: <e, s>(sm: stateMachineWithHistory<s, e>) => historyEntry<s>[];
export declare const stateToString: <a>(state: a) => string;
export declare const isValidTransition: <e, s>(machine: stateMachine<s, e>, fromState: s, event: e) => boolean;
//# sourceMappingURL=StateManagement.gen.d.ts.map