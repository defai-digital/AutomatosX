export type State_t = "Idle" | "Parsing" | "Validating" | "Executing" | "Paused" | "Completed" | "Failed" | "Cancelled";
export type Event_t = "Start" | "Parse" | "Validate" | "Execute" | "Pause" | "Resume" | "Complete" | "Cancel" | {
    TAG: "Fail";
    readonly error: string;
};
export type StepState_status = "Pending" | "Running" | "Completed" | "Failed" | "Skipped";
export type StepState_t = {
    readonly id: string;
    readonly status: StepState_status;
    readonly startedAt: (undefined | number);
    readonly completedAt: (undefined | number);
    readonly error: (undefined | string);
    readonly result: (undefined | {
        [id: string]: string;
    });
};
export type Context_t = {
    readonly workflowId: string;
    readonly workflowName: string;
    readonly variables: {
        [id: string]: string;
    };
    readonly steps: StepState_t[];
    readonly currentStepIndex: number;
    readonly history: State_t[];
    readonly error: (undefined | string);
    readonly startedAt: (undefined | number);
    readonly completedAt: (undefined | number);
    readonly pausedAt: (undefined | number);
};
export declare abstract class Machine_t {
    protected opaque: any;
}
export declare const make: (workflowId: string, workflowName: string, steps: string[]) => Machine_t;
export declare const getState: (_1: Machine_t) => State_t;
export declare const getContext: (_1: Machine_t) => Context_t;
export declare const transition: (_1: Machine_t, _2: Event_t) => {
    TAG: "Ok";
    _0: Machine_t;
} | {
    TAG: "Error";
    _0: string;
};
export declare const canTransition: (_1: Machine_t, _2: Event_t) => boolean;
export declare const setVariable: (_1: Machine_t, _2: string, _3: string) => Machine_t;
export declare const getVariable: (_1: Machine_t, _2: string) => (undefined | string);
export declare const updateStep: (_1: Machine_t, _2: string, _3: ((_1: StepState_t) => StepState_t)) => Machine_t;
export declare const getCurrentStep: (_1: Machine_t) => (undefined | StepState_t);
export declare const getCompletedSteps: (_1: Machine_t) => StepState_t[];
export declare const getFailedSteps: (_1: Machine_t) => StepState_t[];
export declare const getPendingSteps: (_1: Machine_t) => StepState_t[];
export declare const serialize: (_1: Machine_t) => {
    [id: string]: string;
};
export declare const deserialize: (_1: {
    [id: string]: string;
}) => (undefined | Machine_t);
export declare const stateIdle: State_t;
export declare const stateParsing: State_t;
export declare const stateValidating: State_t;
export declare const stateExecuting: State_t;
export declare const statePaused: State_t;
export declare const stateCompleted: State_t;
export declare const stateFailed: State_t;
export declare const stateCancelled: State_t;
export declare const eventStart: Event_t;
export declare const eventParse: Event_t;
export declare const eventValidate: Event_t;
export declare const eventExecute: Event_t;
export declare const eventPause: Event_t;
export declare const eventResume: Event_t;
export declare const eventComplete: Event_t;
export declare const eventCancel: Event_t;
export declare const eventFail: (error: string) => Event_t;
//# sourceMappingURL=WorkflowStateMachine.gen.d.ts.map