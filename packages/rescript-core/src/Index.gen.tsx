/* TypeScript file generated from Index.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as IndexJS from './Index.bs.js';

import type {t as DependencyGraph_t} from './DependencyGraph.gen';

import type {t as ExecutionResult_t} from './ExecutionResult.gen';

import type {t as StepDefinition_t} from './StepDefinition.gen';

import type {t as StepType_t} from './StepType.gen';

import type {t as WorkflowDefinition_t} from './WorkflowDefinition.gen';

import type {t as WorkflowMetadata_t} from './WorkflowMetadata.gen';

export type Hello_person = { readonly name: string; readonly age: number };

export type WorkflowTypes_stepType = StepType_t;

export type WorkflowTypes_stepDefinition = StepDefinition_t;

export type WorkflowTypes_workflowMetadata = WorkflowMetadata_t;

export type WorkflowTypes_workflowDefinition = WorkflowDefinition_t;

export type WorkflowTypes_dependencyGraph = DependencyGraph_t;

export type WorkflowTypes_executionResult = ExecutionResult_t;

export type Hello_person = Hello_person;

export type WorkflowTypes_stepType = WorkflowTypes_stepType;

export type WorkflowTypes_stepDefinition = WorkflowTypes_stepDefinition;

export type WorkflowTypes_workflowMetadata = WorkflowTypes_workflowMetadata;

export type WorkflowTypes_workflowDefinition = WorkflowTypes_workflowDefinition;

export type WorkflowTypes_dependencyGraph = WorkflowTypes_dependencyGraph;

export type WorkflowTypes_executionResult = WorkflowTypes_executionResult;

export const version: string = IndexJS.version as any;

export const name: string = IndexJS.name as any;

export const makeStateMachine: (_1:string, _2:string) => StateMachineV2_Machine_t = IndexJS.makeStateMachine as any;

export const transitionStateMachine: (_1:StateMachineV2_Machine_t, _2:string, _3:string) => 
    { TAG: "Ok"; _0: StateMachineV2_Machine_t }
  | { TAG: "Error"; _0: string } = IndexJS.transitionStateMachine as any;

export const getCurrentState: (_1:StateMachineV2_Machine_t) => string = IndexJS.getCurrentState as any;

export const canTransition: (_1:StateMachineV2_Machine_t, _2:string, _3:string) => boolean = IndexJS.canTransition as any;

export const setContextData: (_1:StateMachineV2_Machine_t, _2:string, _3:string) => StateMachineV2_Machine_t = IndexJS.setContextData as any;

export const getContextData: (_1:StateMachineV2_Machine_t, _2:string) => (undefined | string) = IndexJS.getContextData as any;

export const createCheckpoint: (_1:StateMachineV2_Machine_t) => StateMachineV2_Machine_checkpoint = IndexJS.createCheckpoint as any;

export const restoreFromCheckpoint: (_1:StateMachineV2_Machine_t, _2:StateMachineV2_Machine_checkpoint) => StateMachineV2_Machine_t = IndexJS.restoreFromCheckpoint as any;
