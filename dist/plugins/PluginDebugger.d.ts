/**
 * Plugin Debugger MVP
 * Sprint 5 Day 47: Simple debugger for plugin development
 */
import { EventEmitter } from 'events';
/**
 * Breakpoint
 */
export interface Breakpoint {
    id: string;
    pluginName: string;
    location: string;
    condition?: string;
    enabled: boolean;
    hitCount: number;
}
/**
 * Debug session
 */
export interface DebugSession {
    id: string;
    pluginName: string;
    startTime: number;
    breakpoints: Breakpoint[];
    variables: Map<string, any>;
    callStack: string[];
    paused: boolean;
}
/**
 * Debug event
 */
export interface DebugEvent {
    type: 'breakpoint' | 'step' | 'exception' | 'log';
    sessionId: string;
    data: any;
    timestamp: number;
}
/**
 * Plugin debugger
 */
export declare class PluginDebugger extends EventEmitter {
    private sessions;
    private breakpoints;
    private enabled;
    /**
     * Create debug session
     */
    createSession(pluginName: string): string;
    /**
     * End debug session
     */
    endSession(sessionId: string): void;
    /**
     * Set breakpoint
     */
    setBreakpoint(sessionId: string, location: string, condition?: string): Breakpoint | null;
    /**
     * Remove breakpoint
     */
    removeBreakpoint(breakpointId: string): boolean;
    /**
     * Enable/disable breakpoint
     */
    toggleBreakpoint(breakpointId: string): boolean;
    /**
     * Check breakpoint hit
     */
    checkBreakpoint(sessionId: string, location: string): boolean;
    /**
     * Set variable
     */
    setVariable(sessionId: string, name: string, value: any): void;
    /**
     * Get variable
     */
    getVariable(sessionId: string, name: string): any;
    /**
     * Get all variables
     */
    getVariables(sessionId: string): Record<string, any>;
    /**
     * Push to call stack
     */
    pushCallStack(sessionId: string, functionName: string): void;
    /**
     * Pop from call stack
     */
    popCallStack(sessionId: string): string | undefined;
    /**
     * Get call stack
     */
    getCallStack(sessionId: string): string[];
    /**
     * Continue execution
     */
    continue(sessionId: string): void;
    /**
     * Pause execution
     */
    pause(sessionId: string): void;
    /**
     * Check if paused
     */
    isPaused(sessionId: string): boolean;
    /**
     * Log debug message
     */
    log(sessionId: string, message: string, level?: 'info' | 'warn' | 'error'): void;
    /**
     * Get session
     */
    getSession(sessionId: string): DebugSession | undefined;
    /**
     * Get all sessions
     */
    getSessions(): DebugSession[];
    /**
     * Get breakpoints for session
     */
    getBreakpoints(sessionId: string): Breakpoint[];
    /**
     * Enable debugging
     */
    enable(): void;
    /**
     * Disable debugging
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Evaluate condition
     */
    private evaluateCondition;
    /**
     * Generate unique ID
     */
    private generateId;
}
/**
 * Create plugin debugger
 */
export declare function createPluginDebugger(): PluginDebugger;
/**
 * Get global debugger
 */
export declare function getGlobalDebugger(): PluginDebugger;
/**
 * Reset global debugger
 */
export declare function resetGlobalDebugger(): void;
//# sourceMappingURL=PluginDebugger.d.ts.map