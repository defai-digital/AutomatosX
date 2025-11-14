/**
 * Plugin Debugger MVP
 * Sprint 5 Day 47: Simple debugger for plugin development
 */

import { EventEmitter } from 'events'

/**
 * Breakpoint
 */
export interface Breakpoint {
  id: string
  pluginName: string
  location: string
  condition?: string
  enabled: boolean
  hitCount: number
}

/**
 * Debug session
 */
export interface DebugSession {
  id: string
  pluginName: string
  startTime: number
  breakpoints: Breakpoint[]
  variables: Map<string, any>
  callStack: string[]
  paused: boolean
}

/**
 * Debug event
 */
export interface DebugEvent {
  type: 'breakpoint' | 'step' | 'exception' | 'log'
  sessionId: string
  data: any
  timestamp: number
}

/**
 * Plugin debugger
 */
export class PluginDebugger extends EventEmitter {
  private sessions = new Map<string, DebugSession>()
  private breakpoints = new Map<string, Breakpoint>()
  private enabled: boolean = true

  /**
   * Create debug session
   */
  createSession(pluginName: string): string {
    const sessionId = this.generateId()

    const session: DebugSession = {
      id: sessionId,
      pluginName,
      startTime: Date.now(),
      breakpoints: [],
      variables: new Map(),
      callStack: [],
      paused: false,
    }

    this.sessions.set(sessionId, session)
    this.emit('session-created', { sessionId, pluginName })

    return sessionId
  }

  /**
   * End debug session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this.sessions.delete(sessionId)
    this.emit('session-ended', { sessionId })
  }

  /**
   * Set breakpoint
   */
  setBreakpoint(
    sessionId: string,
    location: string,
    condition?: string
  ): Breakpoint | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const breakpointId = this.generateId()
    const breakpoint: Breakpoint = {
      id: breakpointId,
      pluginName: session.pluginName,
      location,
      condition,
      enabled: true,
      hitCount: 0,
    }

    this.breakpoints.set(breakpointId, breakpoint)
    session.breakpoints.push(breakpoint)

    this.emit('breakpoint-set', { sessionId, breakpoint })

    return breakpoint
  }

  /**
   * Remove breakpoint
   */
  removeBreakpoint(breakpointId: string): boolean {
    const breakpoint = this.breakpoints.get(breakpointId)
    if (!breakpoint) return false

    this.breakpoints.delete(breakpointId)

    // Remove from sessions
    for (const session of this.sessions.values()) {
      const index = session.breakpoints.findIndex((bp) => bp.id === breakpointId)
      if (index >= 0) {
        session.breakpoints.splice(index, 1)
      }
    }

    this.emit('breakpoint-removed', { breakpointId })

    return true
  }

  /**
   * Enable/disable breakpoint
   */
  toggleBreakpoint(breakpointId: string): boolean {
    const breakpoint = this.breakpoints.get(breakpointId)
    if (!breakpoint) return false

    breakpoint.enabled = !breakpoint.enabled

    this.emit('breakpoint-toggled', {
      breakpointId,
      enabled: breakpoint.enabled,
    })

    return breakpoint.enabled
  }

  /**
   * Check breakpoint hit
   */
  checkBreakpoint(sessionId: string, location: string): boolean {
    if (!this.enabled) return false

    const session = this.sessions.get(sessionId)
    if (!session) return false

    for (const breakpoint of session.breakpoints) {
      if (breakpoint.enabled && breakpoint.location === location) {
        breakpoint.hitCount++

        // Check condition if specified
        if (breakpoint.condition) {
          try {
            // Simple condition evaluation (production would use safer eval)
            const conditionMet = this.evaluateCondition(
              breakpoint.condition,
              session.variables
            )
            if (!conditionMet) continue
          } catch {
            continue
          }
        }

        session.paused = true

        this.emit('breakpoint-hit', {
          sessionId,
          breakpoint,
          hitCount: breakpoint.hitCount,
        })

        return true
      }
    }

    return false
  }

  /**
   * Set variable
   */
  setVariable(sessionId: string, name: string, value: any): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.variables.set(name, value)

    this.emit('variable-set', { sessionId, name, value })
  }

  /**
   * Get variable
   */
  getVariable(sessionId: string, name: string): any {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined

    return session.variables.get(name)
  }

  /**
   * Get all variables
   */
  getVariables(sessionId: string): Record<string, any> {
    const session = this.sessions.get(sessionId)
    if (!session) return {}

    return Object.fromEntries(session.variables)
  }

  /**
   * Push to call stack
   */
  pushCallStack(sessionId: string, functionName: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.callStack.push(functionName)

    this.emit('call-stack-push', { sessionId, functionName })
  }

  /**
   * Pop from call stack
   */
  popCallStack(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined

    const functionName = session.callStack.pop()

    if (functionName) {
      this.emit('call-stack-pop', { sessionId, functionName })
    }

    return functionName
  }

  /**
   * Get call stack
   */
  getCallStack(sessionId: string): string[] {
    const session = this.sessions.get(sessionId)
    if (!session) return []

    return [...session.callStack]
  }

  /**
   * Continue execution
   */
  continue(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.paused = false

    this.emit('continue', { sessionId })
  }

  /**
   * Pause execution
   */
  pause(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.paused = true

    this.emit('pause', { sessionId })
  }

  /**
   * Check if paused
   */
  isPaused(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    return session ? session.paused : false
  }

  /**
   * Log debug message
   */
  log(sessionId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this.emit('log', {
      sessionId,
      message,
      level,
      timestamp: Date.now(),
    })
  }

  /**
   * Get session
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all sessions
   */
  getSessions(): DebugSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get breakpoints for session
   */
  getBreakpoints(sessionId: string): Breakpoint[] {
    const session = this.sessions.get(sessionId)
    return session ? [...session.breakpoints] : []
  }

  /**
   * Enable debugging
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Disable debugging
   */
  disable(): void {
    this.enabled = false
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(
    condition: string,
    variables: Map<string, any>
  ): boolean {
    // Simple condition evaluation
    // Production would use a safe expression evaluator
    try {
      // Replace variable names with values
      let expression = condition
      for (const [name, value] of variables.entries()) {
        expression = expression.replace(
          new RegExp(`\\b${name}\\b`, 'g'),
          JSON.stringify(value)
        )
      }

      // Simple eval (UNSAFE - for MVP only)
      return eval(expression) === true
    } catch {
      return false
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `debug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}

/**
 * Create plugin debugger
 */
export function createPluginDebugger(): PluginDebugger {
  return new PluginDebugger()
}

/**
 * Global debugger instance
 */
let globalDebugger: PluginDebugger | null = null

/**
 * Get global debugger
 */
export function getGlobalDebugger(): PluginDebugger {
  if (!globalDebugger) {
    globalDebugger = createPluginDebugger()
  }
  return globalDebugger
}

/**
 * Reset global debugger
 */
export function resetGlobalDebugger(): void {
  globalDebugger = null
}
