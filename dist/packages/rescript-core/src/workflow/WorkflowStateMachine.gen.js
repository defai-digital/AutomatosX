/* TypeScript file generated from WorkflowStateMachine.res by genType. */
/* eslint-disable */
/* tslint:disable */
import * as WorkflowStateMachineJS from './WorkflowStateMachine.bs.js';
export class Machine_t {
    opaque;
}
; /* simulate opaque types */
export const make = WorkflowStateMachineJS.make;
export const getState = WorkflowStateMachineJS.getState;
export const getContext = WorkflowStateMachineJS.getContext;
export const transition = WorkflowStateMachineJS.transition;
export const canTransition = WorkflowStateMachineJS.canTransition;
export const setVariable = WorkflowStateMachineJS.setVariable;
export const getVariable = WorkflowStateMachineJS.getVariable;
export const updateStep = WorkflowStateMachineJS.updateStep;
export const getCurrentStep = WorkflowStateMachineJS.getCurrentStep;
export const getCompletedSteps = WorkflowStateMachineJS.getCompletedSteps;
export const getFailedSteps = WorkflowStateMachineJS.getFailedSteps;
export const getPendingSteps = WorkflowStateMachineJS.getPendingSteps;
export const serialize = WorkflowStateMachineJS.serialize;
export const deserialize = WorkflowStateMachineJS.deserialize;
export const stateIdle = WorkflowStateMachineJS.stateIdle;
export const stateParsing = WorkflowStateMachineJS.stateParsing;
export const stateValidating = WorkflowStateMachineJS.stateValidating;
export const stateExecuting = WorkflowStateMachineJS.stateExecuting;
export const statePaused = WorkflowStateMachineJS.statePaused;
export const stateCompleted = WorkflowStateMachineJS.stateCompleted;
export const stateFailed = WorkflowStateMachineJS.stateFailed;
export const stateCancelled = WorkflowStateMachineJS.stateCancelled;
export const eventStart = WorkflowStateMachineJS.eventStart;
export const eventParse = WorkflowStateMachineJS.eventParse;
export const eventValidate = WorkflowStateMachineJS.eventValidate;
export const eventExecute = WorkflowStateMachineJS.eventExecute;
export const eventPause = WorkflowStateMachineJS.eventPause;
export const eventResume = WorkflowStateMachineJS.eventResume;
export const eventComplete = WorkflowStateMachineJS.eventComplete;
export const eventCancel = WorkflowStateMachineJS.eventCancel;
export const eventFail = WorkflowStateMachineJS.eventFail;
//# sourceMappingURL=WorkflowStateMachine.gen.js.map