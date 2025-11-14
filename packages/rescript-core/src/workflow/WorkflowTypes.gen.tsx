/* TypeScript file generated from WorkflowTypes.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as WorkflowTypesJS from './WorkflowTypes.bs.js';

export type StepType_t = 
    "AgentTask"
  | "HttpRequest"
  | "FileOperation"
  | "DatabaseQuery"
  | "SemanticSearch"
  | "Transform"
  | "Conditional"
  | "Parallel"
  | "Sequential";

export type StepConfig_agentTask = {
  readonly agent: string; 
  readonly task: string; 
  readonly context: (undefined | {[id: string]: string})
};

export type StepConfig_httpRequest = {
  readonly method: string; 
  readonly url: string; 
  readonly headers: (undefined | {[id: string]: string}); 
  readonly body: (undefined | string); 
  readonly timeout: (undefined | number)
};

export type StepConfig_fileOperation = {
  readonly operation: string; 
  readonly path: string; 
  readonly content: (undefined | string); 
  readonly encoding: (undefined | string)
};

export type StepConfig_databaseQuery = {
  readonly query: string; 
  readonly params: (undefined | string[]); 
  readonly database: (undefined | string)
};

export type StepConfig_semanticSearch = {
  readonly query: string; 
  readonly mode: string; 
  readonly limit: (undefined | number); 
  readonly filters: (undefined | {[id: string]: string})
};

export type StepConfig_transform = {
  readonly input: string; 
  readonly function: string; 
  readonly code: (undefined | string)
};

export type StepConfig_conditional = {
  readonly condition: string; 
  readonly thenSteps: string[]; 
  readonly elseSteps: (undefined | string[])
};

export type StepConfig_parallel = { readonly steps: string[]; readonly maxConcurrency: (undefined | number) };

export type StepConfig_sequential = { readonly steps: string[] };

export type StepConfig_t = 
    { TAG: "AgentTask"; _0: StepConfig_agentTask }
  | { TAG: "HttpRequest"; _0: StepConfig_httpRequest }
  | { TAG: "FileOperation"; _0: StepConfig_fileOperation }
  | { TAG: "DatabaseQuery"; _0: StepConfig_databaseQuery }
  | { TAG: "SemanticSearch"; _0: StepConfig_semanticSearch }
  | { TAG: "Transform"; _0: StepConfig_transform }
  | { TAG: "Conditional"; _0: StepConfig_conditional }
  | { TAG: "Parallel"; _0: StepConfig_parallel }
  | { TAG: "Sequential"; _0: StepConfig_sequential };

export type StepDefinition_t = {
  readonly id: string; 
  readonly name: string; 
  readonly stepType: StepType_t; 
  readonly config: StepConfig_t; 
  readonly dependsOn: string[]; 
  readonly timeout: (undefined | number); 
  readonly retries: (undefined | number); 
  readonly continueOnError: boolean
};

export type WorkflowMetadata_t = {
  readonly name: string; 
  readonly description: (undefined | string); 
  readonly version: (undefined | string); 
  readonly author: (undefined | string); 
  readonly tags: string[]; 
  readonly createdAt: (undefined | number); 
  readonly updatedAt: (undefined | number)
};

export type VariableDefinition_varType = 
    "String"
  | "Number"
  | "Boolean"
  | "Object"
  | "Array";

export type VariableDefinition_t = {
  readonly name: string; 
  readonly varType: VariableDefinition_varType; 
  readonly defaultValue: (undefined | string); 
  readonly required: boolean; 
  readonly description: (undefined | string)
};

export type WorkflowDefinition_t = {
  readonly id: string; 
  readonly metadata: WorkflowMetadata_t; 
  readonly variables: VariableDefinition_t[]; 
  readonly steps: StepDefinition_t[]; 
  readonly onSuccess: (undefined | string[]); 
  readonly onFailure: (undefined | string[]); 
  readonly onCancel: (undefined | string[])
};

export type DependencyGraph_node = {
  readonly stepId: string; 
  readonly dependencies: string[]; 
  readonly dependents: string[]; 
  readonly level: number
};

export type DependencyGraph_t = { readonly nodes: DependencyGraph_node[]; readonly levels: Array<string[]> };

export type ExecutionResult_status = 
    "Success"
  | "Failure"
  | "Skipped"
  | "Cancelled";

export type ExecutionResult_t = {
  readonly stepId: string; 
  readonly status: ExecutionResult_status; 
  readonly output: (undefined | {[id: string]: string}); 
  readonly error: (undefined | string); 
  readonly startedAt: number; 
  readonly completedAt: (undefined | number); 
  readonly duration: (undefined | number); 
  readonly retryCount: number
};

export type stepType = StepType_t;

export type stepDefinition = StepDefinition_t;

export type workflowMetadata = WorkflowMetadata_t;

export type workflowDefinition = WorkflowDefinition_t;

export type dependencyGraph = DependencyGraph_t;

export type executionResult = ExecutionResult_t;

export const makeStepDefinition: (id:string, name:string, stepType:StepType_t, config:StepConfig_t, dependsOn:(undefined | string[]), timeout:(undefined | number), retries:(undefined | number), continueOnError:(undefined | boolean), _9:void) => StepDefinition_t = WorkflowTypesJS.makeStepDefinition as any;

export const makeWorkflowMetadata: (name:string, description:(undefined | string), version:(undefined | string), author:(undefined | string), tags:(undefined | string[]), _6:void) => WorkflowMetadata_t = WorkflowTypesJS.makeWorkflowMetadata as any;

export const makeWorkflowDefinition: (id:string, metadata:WorkflowMetadata_t, variables:(undefined | VariableDefinition_t[]), steps:StepDefinition_t[], onSuccess:(undefined | string[]), onFailure:(undefined | string[]), onCancel:(undefined | string[]), _8:void) => WorkflowDefinition_t = WorkflowTypesJS.makeWorkflowDefinition as any;

export const makeDependencyGraph: (_1:StepDefinition_t[]) => DependencyGraph_t = WorkflowTypesJS.makeDependencyGraph as any;

export const makeExecutionResult: (stepId:string, startedAt:number) => ExecutionResult_t = WorkflowTypesJS.makeExecutionResult as any;
