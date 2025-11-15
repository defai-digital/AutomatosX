/**
 * Sprint 3 Day 26: State Machine Runtime Integration
 *
 * Integrates StateMachineBridge with ProviderRouterV2 for complete workflow execution.
 * Adds checkpoint persistence, task orchestration, and provider coordination.
 */
import { EventEmitter } from 'events';
import { type MachineState, type MachineCheckpoint } from './StateMachineBridge.js';
import type { IProvider, ProviderRequest as SDKProviderRequest, ProviderResponse as SDKProviderResponse } from '../providers/ProviderBase.js';
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
type Provider = IProvider | ProviderRouterV2;
interface ProviderRequest extends SDKProviderRequest {
}
/**
 * Task execution context
 */
export interface TaskContext {
    taskId: string;
    agentName: string;
    provider: Provider;
    request: ProviderRequest;
    checkpointInterval?: number;
    maxRetries?: number;
}
/**
 * Task execution result
 */
type ProviderResponse = SDKProviderResponse;
export interface TaskResult {
    taskId: string;
    success: boolean;
    finalState: MachineState;
    response?: ProviderResponse;
    error?: string;
    checkpoints: MachineCheckpoint[];
    duration: number;
}
/**
 * Checkpoint storage interface
 */
export interface CheckpointStorage {
    save(taskId: string, checkpoint: MachineCheckpoint): Promise<void>;
    load(taskId: string): Promise<MachineCheckpoint | null>;
    list(agentName?: string): Promise<Array<{
        taskId: string;
        timestamp: number;
    }>>;
    delete(taskId: string): Promise<void>;
}
/**
 * SQLite checkpoint storage implementation
 */
export declare class SQLiteCheckpointStorage implements CheckpointStorage {
    private db;
    constructor();
    private initializeSchema;
    save(taskId: string, checkpoint: MachineCheckpoint): Promise<void>;
    load(taskId: string): Promise<MachineCheckpoint | null>;
    list(agentName?: string): Promise<Array<{
        taskId: string;
        timestamp: number;
    }>>;
    delete(taskId: string): Promise<void>;
}
/**
 * State Machine Runtime - Orchestrates task execution with state management
 */
export declare class StateMachineRuntime extends EventEmitter {
    private orchestrator;
    private storage;
    private activeExecutions;
    constructor(storage?: CheckpointStorage);
    /**
     * Execute a task with state machine orchestration
     */
    executeTask(context: TaskContext): Promise<TaskResult>;
    /**
     * Resume a task from checkpoint
     */
    resumeTask(taskId: string, provider: Provider, request: ProviderRequest): Promise<TaskResult>;
    /**
     * Pause a running task
     */
    pauseTask(taskId: string): Promise<void>;
    /**
     * Cancel a task
     */
    cancelTask(taskId: string): Promise<void>;
    /**
     * Get task status
     */
    getTaskStatus(taskId: string): Promise<{
        state: MachineState;
        context: any;
        isActive: boolean;
        duration?: number;
    } | null>;
    /**
     * List all checkpoints
     */
    listCheckpoints(agentName?: string): Promise<Array<{
        taskId: string;
        timestamp: number;
    }>>;
    /**
     * Delete checkpoint
     */
    deleteCheckpoint(taskId: string): Promise<void>;
    /**
     * Get active executions
     */
    getActiveExecutions(): Array<{
        taskId: string;
        state: MachineState;
        duration: number;
    }>;
    private delay;
}
/**
 * Factory function to create runtime
 */
export declare function createStateMachineRuntime(storage?: CheckpointStorage): StateMachineRuntime;
export {};
//# sourceMappingURL=StateMachineRuntime.d.ts.map