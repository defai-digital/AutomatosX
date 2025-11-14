// Index.res - Main entry point for ReScript core
// Re-exports all public modules

// Export Hello module
module Hello = Hello

// Export State Machine V2
module StateMachineV2 = StateMachineV2

// Export Workflow modules (Day 1 - 5-Day Plan)
module WorkflowStateMachine = WorkflowStateMachine
module WorkflowTypes = WorkflowTypes

// Version information
@genType
let version = "2.0.0-alpha.0"

@genType
let name = "AutomatosX v2 - ReScript Core"

// State Machine Factory Functions with @genType for TypeScript interop
@genType
let makeStateMachine = StateMachineV2.make

@genType
let transitionStateMachine = StateMachineV2.transition

@genType
let getCurrentState = StateMachineV2.getCurrentState

@genType
let canTransition = StateMachineV2.canTransition

@genType
let setContextData = StateMachineV2.setContextData

@genType
let getContextData = StateMachineV2.getContextData

@genType
let createCheckpoint = StateMachineV2.createCheckpoint

@genType
let restoreFromCheckpoint = StateMachineV2.restoreFromCheckpoint
