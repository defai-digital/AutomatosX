/**
 * Plugin Debugger MVP
 * Sprint 5 Day 47: Simple debugger for plugin development
 */
import { EventEmitter } from 'events';
/**
 * Plugin debugger
 */
export class PluginDebugger extends EventEmitter {
    sessions = new Map();
    breakpoints = new Map();
    enabled = true;
    /**
     * Create debug session
     */
    createSession(pluginName) {
        const sessionId = this.generateId();
        const session = {
            id: sessionId,
            pluginName,
            startTime: Date.now(),
            breakpoints: [],
            variables: new Map(),
            callStack: [],
            paused: false,
        };
        this.sessions.set(sessionId, session);
        this.emit('session-created', { sessionId, pluginName });
        return sessionId;
    }
    /**
     * End debug session
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        this.sessions.delete(sessionId);
        this.emit('session-ended', { sessionId });
    }
    /**
     * Set breakpoint
     */
    setBreakpoint(sessionId, location, condition) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        const breakpointId = this.generateId();
        const breakpoint = {
            id: breakpointId,
            pluginName: session.pluginName,
            location,
            condition,
            enabled: true,
            hitCount: 0,
        };
        this.breakpoints.set(breakpointId, breakpoint);
        session.breakpoints.push(breakpoint);
        this.emit('breakpoint-set', { sessionId, breakpoint });
        return breakpoint;
    }
    /**
     * Remove breakpoint
     */
    removeBreakpoint(breakpointId) {
        const breakpoint = this.breakpoints.get(breakpointId);
        if (!breakpoint)
            return false;
        this.breakpoints.delete(breakpointId);
        // Remove from sessions
        for (const session of this.sessions.values()) {
            const index = session.breakpoints.findIndex((bp) => bp.id === breakpointId);
            if (index >= 0) {
                session.breakpoints.splice(index, 1);
            }
        }
        this.emit('breakpoint-removed', { breakpointId });
        return true;
    }
    /**
     * Enable/disable breakpoint
     */
    toggleBreakpoint(breakpointId) {
        const breakpoint = this.breakpoints.get(breakpointId);
        if (!breakpoint)
            return false;
        breakpoint.enabled = !breakpoint.enabled;
        this.emit('breakpoint-toggled', {
            breakpointId,
            enabled: breakpoint.enabled,
        });
        return breakpoint.enabled;
    }
    /**
     * Check breakpoint hit
     */
    checkBreakpoint(sessionId, location) {
        if (!this.enabled)
            return false;
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        for (const breakpoint of session.breakpoints) {
            if (breakpoint.enabled && breakpoint.location === location) {
                breakpoint.hitCount++;
                // Check condition if specified
                if (breakpoint.condition) {
                    try {
                        // Simple condition evaluation (production would use safer eval)
                        const conditionMet = this.evaluateCondition(breakpoint.condition, session.variables);
                        if (!conditionMet)
                            continue;
                    }
                    catch {
                        continue;
                    }
                }
                session.paused = true;
                this.emit('breakpoint-hit', {
                    sessionId,
                    breakpoint,
                    hitCount: breakpoint.hitCount,
                });
                return true;
            }
        }
        return false;
    }
    /**
     * Set variable
     */
    setVariable(sessionId, name, value) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.variables.set(name, value);
        this.emit('variable-set', { sessionId, name, value });
    }
    /**
     * Get variable
     */
    getVariable(sessionId, name) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        return session.variables.get(name);
    }
    /**
     * Get all variables
     */
    getVariables(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return {};
        return Object.fromEntries(session.variables);
    }
    /**
     * Push to call stack
     */
    pushCallStack(sessionId, functionName) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.callStack.push(functionName);
        this.emit('call-stack-push', { sessionId, functionName });
    }
    /**
     * Pop from call stack
     */
    popCallStack(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        const functionName = session.callStack.pop();
        if (functionName) {
            this.emit('call-stack-pop', { sessionId, functionName });
        }
        return functionName;
    }
    /**
     * Get call stack
     */
    getCallStack(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return [];
        return [...session.callStack];
    }
    /**
     * Continue execution
     */
    continue(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.paused = false;
        this.emit('continue', { sessionId });
    }
    /**
     * Pause execution
     */
    pause(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.paused = true;
        this.emit('pause', { sessionId });
    }
    /**
     * Check if paused
     */
    isPaused(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? session.paused : false;
    }
    /**
     * Log debug message
     */
    log(sessionId, message, level = 'info') {
        this.emit('log', {
            sessionId,
            message,
            level,
            timestamp: Date.now(),
        });
    }
    /**
     * Get session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Get all sessions
     */
    getSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Get breakpoints for session
     */
    getBreakpoints(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? [...session.breakpoints] : [];
    }
    /**
     * Enable debugging
     */
    enable() {
        this.enabled = true;
    }
    /**
     * Disable debugging
     */
    disable() {
        this.enabled = false;
    }
    /**
     * Check if enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Evaluate condition
     */
    evaluateCondition(condition, variables) {
        // Simple condition evaluation
        // Production would use a safe expression evaluator
        try {
            // Replace variable names with values
            let expression = condition;
            for (const [name, value] of variables.entries()) {
                expression = expression.replace(new RegExp(`\\b${name}\\b`, 'g'), JSON.stringify(value));
            }
            // Simple eval (UNSAFE - for MVP only)
            return eval(expression) === true;
        }
        catch {
            return false;
        }
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
}
/**
 * Create plugin debugger
 */
export function createPluginDebugger() {
    return new PluginDebugger();
}
/**
 * Global debugger instance
 */
let globalDebugger = null;
/**
 * Get global debugger
 */
export function getGlobalDebugger() {
    if (!globalDebugger) {
        globalDebugger = createPluginDebugger();
    }
    return globalDebugger;
}
/**
 * Reset global debugger
 */
export function resetGlobalDebugger() {
    globalDebugger = null;
}
//# sourceMappingURL=PluginDebugger.js.map