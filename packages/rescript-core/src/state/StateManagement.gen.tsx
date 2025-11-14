/* TypeScript file generated from StateManagement.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as StateManagementJS from './StateManagement.bs.js';

import type {ref as PervasivesU_ref} from './PervasivesU.gen';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type state<s> = {
  readonly current: s; 
  readonly previous: (undefined | s); 
  readonly enteredAt: number
};

export type transition<s,e> = {
  readonly from: s; 
  readonly event: e; 
  readonly to: s; 
  readonly guard: (undefined | (() => boolean))
};

export type stateMachine<s,e> = {
  readonly initial: s; 
  readonly current: PervasivesU_ref<state<s>>; 
  readonly transitions: transition<s,e>[]; 
  readonly onEnter: (undefined | ((_1:s, _2:s) => void)); 
  readonly onExit: (undefined | ((_1:s, _2:s) => void))
};

export type taskState = 
    "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type taskEvent = 
    "start"
  | "complete"
  | "fail"
  | "cancel"
  | "retry";

export type connectionState = 
    "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

export type connectionEvent = 
    "connect"
  | "connected"
  | "disconnect"
  | "error"
  | "retry";

export type requestState = "idle" | "loading" | "success" | "error";

export type requestEvent = "fetch" | "success" | "error" | "reset";

export type historyEntry<s> = {
  readonly state: s; 
  readonly enteredAt: number; 
  readonly exitedAt: (undefined | number)
};

export type stateMachineWithHistory<s,e> = { readonly machine: stateMachine<s,e>; readonly history: PervasivesU_ref<historyEntry<s>[]> };

export const createStateMachine: <e,s>(initial:s, transitions:transition<s,e>[], onEnter:(undefined | (undefined | (((_1:s, _2:s) => void)))), onExit:(undefined | (undefined | (((_1:s, _2:s) => void))))) => stateMachine<s,e> = StateManagementJS.createStateMachine as any;

export const getCurrentState: <e,s>(machine:stateMachine<s,e>) => s = StateManagementJS.getCurrentState as any;

export const getPreviousState: <e,s>(machine:stateMachine<s,e>) => (undefined | s) = StateManagementJS.getPreviousState as any;

export const getTimeInState: <e,s>(machine:stateMachine<s,e>) => number = StateManagementJS.getTimeInState as any;

export const isInState: <e,s>(machine:stateMachine<s,e>, state:s) => boolean = StateManagementJS.isInState as any;

export const findTransition: <e,s>(machine:stateMachine<s,e>, event:e) => (undefined | transition<s,e>) = StateManagementJS.findTransition as any;

export const canTransition: <e,s>(machine:stateMachine<s,e>, event:e) => boolean = StateManagementJS.canTransition as any;

export const getValidTransitions: <e,s>(machine:stateMachine<s,e>) => transition<s,e>[] = StateManagementJS.getValidTransitions as any;

export const makeTransition: <e,s>(machine:stateMachine<s,e>, event:e) => ErrorHandling_result<s,string> = StateManagementJS.makeTransition as any;

export const reset: <e,s>(machine:stateMachine<s,e>) => void = StateManagementJS.reset as any;

export const createTaskStateMachine: () => stateMachine<taskState,taskEvent> = StateManagementJS.createTaskStateMachine as any;

export const createConnectionStateMachine: () => stateMachine<connectionState,connectionEvent> = StateManagementJS.createConnectionStateMachine as any;

export const createRequestStateMachine: () => stateMachine<requestState,requestEvent> = StateManagementJS.createRequestStateMachine as any;

export const createWithHistory: <e,s>(machine:stateMachine<s,e>) => stateMachineWithHistory<s,e> = StateManagementJS.createWithHistory as any;

export const makeTransitionWithHistory: <e,s>(sm:stateMachineWithHistory<s,e>, event:e) => ErrorHandling_result<s,string> = StateManagementJS.makeTransitionWithHistory as any;

export const getHistory: <e,s>(sm:stateMachineWithHistory<s,e>) => historyEntry<s>[] = StateManagementJS.getHistory as any;

export const stateToString: <a>(state:a) => string = StateManagementJS.stateToString as any;

export const isValidTransition: <e,s>(machine:stateMachine<s,e>, fromState:s, event:e) => boolean = StateManagementJS.isValidTransition as any;
