/* TypeScript file generated from StateMachine.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as StateMachineJS from './StateMachine.bs.js';

export type state<s> = 
    "Idle"
  | { TAG: "Running"; _0: s }
  | { TAG: "Paused"; _0: s }
  | { TAG: "Completed"; _0: s }
  | { TAG: "Failed"; _0: string };

export type event<e> = {
  readonly id: string; 
  readonly timestamp: number; 
  readonly data: e; 
  readonly metadata: (undefined | {[id: string]: string})
};

export type transition<s,e> = {
  readonly from: state<s>; 
  readonly event: e; 
  readonly to: state<s>; 
  readonly guard: (undefined | ((_1:s) => boolean)); 
  readonly action: (undefined | ((_1:s) => Promise<void>))
};

export type stateMachine<s,e> = {
  currentState: state<s>; 
  readonly transitions: transition<s,e>[]; 
  history: historyEntry<s,e>[]; 
  readonly config: machineConfig
};

export type historyEntry<s,e> = {
  readonly from: state<s>; 
  readonly to: state<s>; 
  readonly event: event<e>; 
  readonly timestamp: number; 
  readonly success: boolean; 
  readonly error: (undefined | string)
};

export type machineConfig = {
  readonly maxHistorySize: number; 
  readonly enableLogging: boolean; 
  readonly strict: boolean
};

export type statistics = {
  readonly totalTransitions: number; 
  readonly successfulTransitions: number; 
  readonly failedTransitions: number; 
  readonly guardBlockedTransitions: number; 
  readonly actionFailedTransitions: number
};

export const createEvent: <e>(id:string, data:e, metadata:(undefined | {[id: string]: string}), param:void) => event<e> = StateMachineJS.createEvent as any;

export const create: <e,s>(initialState:state<s>, transitions:transition<s,e>[], config:(undefined | machineConfig), param:void) => stateMachine<s,e> = StateMachineJS.create as any;

export const transition: <e,s>(machine:stateMachine<s,e>, event:event<e>) => Promise<
    { TAG: "Ok"; _0: state<s> }
  | { TAG: "Error"; _0: string }> = StateMachineJS.transition as any;

export const getCurrentState: <e,s>(machine:stateMachine<s,e>) => state<s> = StateMachineJS.getCurrentState as any;

export const getHistory: <e,s>(machine:stateMachine<s,e>) => historyEntry<s,e>[] = StateMachineJS.getHistory as any;

export const getHistoryLength: <e,s>(machine:stateMachine<s,e>) => number = StateMachineJS.getHistoryLength as any;

export const isIdle: <e,s>(machine:stateMachine<s,e>) => boolean = StateMachineJS.isIdle as any;

export const isRunning: <e,s>(machine:stateMachine<s,e>) => boolean = StateMachineJS.isRunning as any;

export const isPaused: <e,s>(machine:stateMachine<s,e>) => boolean = StateMachineJS.isPaused as any;

export const isCompleted: <e,s>(machine:stateMachine<s,e>) => boolean = StateMachineJS.isCompleted as any;

export const isFailed: <e,s>(machine:stateMachine<s,e>) => boolean = StateMachineJS.isFailed as any;

export const getFailureReason: <e,s>(machine:stateMachine<s,e>) => (undefined | string) = StateMachineJS.getFailureReason as any;

export const reset: <e,s>(machine:stateMachine<s,e>, initialState:state<s>) => void = StateMachineJS.reset as any;

export const canTransition: <e,s>(machine:stateMachine<s,e>, eventData:e) => boolean = StateMachineJS.canTransition as any;

export const getPossibleTransitions: <e,s>(machine:stateMachine<s,e>) => transition<s,e>[] = StateMachineJS.getPossibleTransitions as any;

export const getStatistics: <e,s>(machine:stateMachine<s,e>) => statistics = StateMachineJS.getStatistics as any;
