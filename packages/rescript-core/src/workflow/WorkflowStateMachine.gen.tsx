/* TypeScript file generated from WorkflowStateMachine.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as WorkflowStateMachineJS from './WorkflowStateMachine.bs.js';

export type State_t = 
    "Idle"
  | "Parsing"
  | "Validating"
  | "Executing"
  | "Paused"
  | "Completed"
  | "Failed"
  | "Cancelled";

export type Event_t = 
    "Start"
  | "Parse"
  | "Validate"
  | "Execute"
  | "Pause"
  | "Resume"
  | "Complete"
  | "Cancel"
  | { TAG: "Fail"; readonly error: string };

export type StepState_status = 
    "Pending"
  | "Running"
  | "Completed"
  | "Failed"
  | "Skipped";

export type StepState_t = {
  readonly id: string; 
  readonly status: StepState_status; 
  readonly startedAt: (undefined | number); 
  readonly completedAt: (undefined | number); 
  readonly error: (undefined | string); 
  readonly result: (undefined | {[id: string]: string})
};

export type Context_t = {
  readonly workflowId: string; 
  readonly workflowName: string; 
  readonly variables: {[id: string]: string}; 
  readonly steps: StepState_t[]; 
  readonly currentStepIndex: number; 
  readonly history: State_t[]; 
  readonly error: (undefined | string); 
  readonly startedAt: (undefined | number); 
  readonly completedAt: (undefined | number); 
  readonly pausedAt: (undefined | number)
};

export abstract class Machine_t { protected opaque!: any }; /* simulate opaque types */

export const make: (workflowId:string, workflowName:string, steps:string[]) => Machine_t = WorkflowStateMachineJS.make as any;

export const getState: (_1:Machine_t) => State_t = WorkflowStateMachineJS.getState as any;

export const getContext: (_1:Machine_t) => Context_t = WorkflowStateMachineJS.getContext as any;

export const transition: (_1:Machine_t, _2:Event_t) => 
    { TAG: "Ok"; _0: Machine_t }
  | { TAG: "Error"; _0: string } = WorkflowStateMachineJS.transition as any;

export const canTransition: (_1:Machine_t, _2:Event_t) => boolean = WorkflowStateMachineJS.canTransition as any;

export const setVariable: (_1:Machine_t, _2:string, _3:string) => Machine_t = WorkflowStateMachineJS.setVariable as any;

export const getVariable: (_1:Machine_t, _2:string) => (undefined | string) = WorkflowStateMachineJS.getVariable as any;

export const updateStep: (_1:Machine_t, _2:string, _3:((_1:StepState_t) => StepState_t)) => Machine_t = WorkflowStateMachineJS.updateStep as any;

export const getCurrentStep: (_1:Machine_t) => (undefined | StepState_t) = WorkflowStateMachineJS.getCurrentStep as any;

export const getCompletedSteps: (_1:Machine_t) => StepState_t[] = WorkflowStateMachineJS.getCompletedSteps as any;

export const getFailedSteps: (_1:Machine_t) => StepState_t[] = WorkflowStateMachineJS.getFailedSteps as any;

export const getPendingSteps: (_1:Machine_t) => StepState_t[] = WorkflowStateMachineJS.getPendingSteps as any;

export const serialize: (_1:Machine_t) => {[id: string]: string} = WorkflowStateMachineJS.serialize as any;

export const deserialize: (_1:{[id: string]: string}) => (undefined | Machine_t) = WorkflowStateMachineJS.deserialize as any;

export const stateIdle: State_t = WorkflowStateMachineJS.stateIdle as any;

export const stateParsing: State_t = WorkflowStateMachineJS.stateParsing as any;

export const stateValidating: State_t = WorkflowStateMachineJS.stateValidating as any;

export const stateExecuting: State_t = WorkflowStateMachineJS.stateExecuting as any;

export const statePaused: State_t = WorkflowStateMachineJS.statePaused as any;

export const stateCompleted: State_t = WorkflowStateMachineJS.stateCompleted as any;

export const stateFailed: State_t = WorkflowStateMachineJS.stateFailed as any;

export const stateCancelled: State_t = WorkflowStateMachineJS.stateCancelled as any;

export const eventStart: Event_t = WorkflowStateMachineJS.eventStart as any;

export const eventParse: Event_t = WorkflowStateMachineJS.eventParse as any;

export const eventValidate: Event_t = WorkflowStateMachineJS.eventValidate as any;

export const eventExecute: Event_t = WorkflowStateMachineJS.eventExecute as any;

export const eventPause: Event_t = WorkflowStateMachineJS.eventPause as any;

export const eventResume: Event_t = WorkflowStateMachineJS.eventResume as any;

export const eventComplete: Event_t = WorkflowStateMachineJS.eventComplete as any;

export const eventCancel: Event_t = WorkflowStateMachineJS.eventCancel as any;

export const eventFail: (error:string) => Event_t = WorkflowStateMachineJS.eventFail as any;
