/**
 * Plugin Debugger Tests
 * Sprint 5 Day 47: Plugin debugger tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  PluginDebugger,
  createPluginDebugger,
  getGlobalDebugger,
  resetGlobalDebugger,
} from '../../plugins/PluginDebugger.js'

describe('PluginDebugger', () => {
  let dbg: PluginDebugger

  beforeEach(() => {
    dbg = createPluginDebugger()
  })

  describe('Session Management', () => {
    it('should create debug session', () => {
      const sessionId = dbg.createSession('test-plugin')

      expect(sessionId).toBeTruthy()
      expect(dbg.getSessions()).toHaveLength(1)
    })

    it('should emit session-created event', () => {
      const listener = vi.fn()
      dbg.on('session-created', listener)

      const sessionId = dbg.createSession('test-plugin')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        pluginName: 'test-plugin',
      })
    })

    it('should end debug session', () => {
      const sessionId = dbg.createSession('test-plugin')

      dbg.endSession(sessionId)

      expect(dbg.getSessions()).toHaveLength(0)
    })

    it('should emit session-ended event', () => {
      const listener = vi.fn()
      dbg.on('session-ended', listener)

      const sessionId = dbg.createSession('test-plugin')
      dbg.endSession(sessionId)

      expect(listener).toHaveBeenCalledWith({ sessionId })
    })

    it('should get session', () => {
      const sessionId = dbg.createSession('test-plugin')

      const session = dbg.getSession(sessionId)

      expect(session).toMatchObject({
        id: sessionId,
        pluginName: 'test-plugin',
        startTime: expect.any(Number),
        breakpoints: [],
        paused: false,
      })
    })

    it('should return undefined for non-existent session', () => {
      const session = dbg.getSession('non-existent')

      expect(session).toBeUndefined()
    })

    it('should list all sessions', () => {
      const id1 = dbg.createSession('plugin1')
      const id2 = dbg.createSession('plugin2')

      const sessions = dbg.getSessions()

      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe(id1)
      expect(sessions[1].id).toBe(id2)
    })
  })

  describe('Breakpoint Management', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should set breakpoint', () => {
      const breakpoint = dbg.setBreakpoint(sessionId, 'processData')

      expect(breakpoint).toMatchObject({
        id: expect.any(String),
        pluginName: 'test-plugin',
        location: 'processData',
        enabled: true,
        hitCount: 0,
      })
    })

    it('should set conditional breakpoint', () => {
      const breakpoint = dbg.setBreakpoint(
        sessionId,
        'processData',
        'count > 10'
      )

      expect(breakpoint?.condition).toBe('count > 10')
    })

    it('should emit breakpoint-set event', () => {
      const listener = vi.fn()
      dbg.on('breakpoint-set', listener)

      const breakpoint = dbg.setBreakpoint(sessionId, 'test')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        breakpoint,
      })
    })

    it('should return null for invalid session', () => {
      const breakpoint = dbg.setBreakpoint('invalid', 'test')

      expect(breakpoint).toBeNull()
    })

    it('should remove breakpoint', () => {
      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!

      const removed = dbg.removeBreakpoint(breakpoint.id)

      expect(removed).toBe(true)
      expect(dbg.getBreakpoints(sessionId)).toHaveLength(0)
    })

    it('should emit breakpoint-removed event', () => {
      const listener = vi.fn()
      dbg.on('breakpoint-removed', listener)

      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!
      dbg.removeBreakpoint(breakpoint.id)

      expect(listener).toHaveBeenCalledWith({
        breakpointId: breakpoint.id,
      })
    })

    it('should return false when removing non-existent breakpoint', () => {
      const removed = dbg.removeBreakpoint('non-existent')

      expect(removed).toBe(false)
    })

    it('should toggle breakpoint', () => {
      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!

      expect(breakpoint.enabled).toBe(true)

      dbg.toggleBreakpoint(breakpoint.id)
      const updated = dbg.getBreakpoints(sessionId)[0]

      expect(updated.enabled).toBe(false)
    })

    it('should emit breakpoint-toggled event', () => {
      const listener = vi.fn()
      dbg.on('breakpoint-toggled', listener)

      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!
      dbg.toggleBreakpoint(breakpoint.id)

      expect(listener).toHaveBeenCalledWith({
        breakpointId: breakpoint.id,
        enabled: false,
      })
    })

    it('should list breakpoints for session', () => {
      dbg.setBreakpoint(sessionId, 'func1')
      dbg.setBreakpoint(sessionId, 'func2')

      const breakpoints = dbg.getBreakpoints(sessionId)

      expect(breakpoints).toHaveLength(2)
    })
  })

  describe('Breakpoint Checking', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should check breakpoint hit', () => {
      dbg.setBreakpoint(sessionId, 'processData')

      const hit = dbg.checkBreakpoint(sessionId, 'processData')

      expect(hit).toBe(true)
      expect(dbg.isPaused(sessionId)).toBe(true)
    })

    it('should increment hit count', () => {
      dbg.setBreakpoint(sessionId, 'processData')

      dbg.checkBreakpoint(sessionId, 'processData')
      dbg.checkBreakpoint(sessionId, 'processData')

      const breakpoints = dbg.getBreakpoints(sessionId)
      expect(breakpoints[0].hitCount).toBe(2)
    })

    it('should emit breakpoint-hit event', () => {
      const listener = vi.fn()
      dbg.on('breakpoint-hit', listener)

      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!
      dbg.checkBreakpoint(sessionId, 'test')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        breakpoint: expect.objectContaining({ id: breakpoint.id }),
        hitCount: 1,
      })
    })

    it('should not hit disabled breakpoint', () => {
      const breakpoint = dbg.setBreakpoint(sessionId, 'test')!
      dbg.toggleBreakpoint(breakpoint.id) // Disable

      const hit = dbg.checkBreakpoint(sessionId, 'test')

      expect(hit).toBe(false)
    })

    it('should check conditional breakpoint', () => {
      dbg.setBreakpoint(sessionId, 'test', 'true')

      const hit = dbg.checkBreakpoint(sessionId, 'test')

      expect(hit).toBe(true)
    })

    it('should not hit when condition fails', () => {
      dbg.setBreakpoint(sessionId, 'test', 'false')

      const hit = dbg.checkBreakpoint(sessionId, 'test')

      expect(hit).toBe(false)
    })

    it('should not check when debugger disabled', () => {
      dbg.disable()
      dbg.setBreakpoint(sessionId, 'test')

      const hit = dbg.checkBreakpoint(sessionId, 'test')

      expect(hit).toBe(false)
    })
  })

  describe('Variable Management', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should set variable', () => {
      dbg.setVariable(sessionId, 'count', 42)

      expect(dbg.getVariable(sessionId, 'count')).toBe(42)
    })

    it('should emit variable-set event', () => {
      const listener = vi.fn()
      dbg.on('variable-set', listener)

      dbg.setVariable(sessionId, 'test', 'value')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        name: 'test',
        value: 'value',
      })
    })

    it('should get all variables', () => {
      dbg.setVariable(sessionId, 'a', 1)
      dbg.setVariable(sessionId, 'b', 2)

      const variables = dbg.getVariables(sessionId)

      expect(variables).toEqual({ a: 1, b: 2 })
    })

    it('should return undefined for non-existent variable', () => {
      const value = dbg.getVariable(sessionId, 'missing')

      expect(value).toBeUndefined()
    })

    it('should return empty object for invalid session', () => {
      const variables = dbg.getVariables('invalid')

      expect(variables).toEqual({})
    })
  })

  describe('Call Stack', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should push to call stack', () => {
      dbg.pushCallStack(sessionId, 'function1')

      const stack = dbg.getCallStack(sessionId)

      expect(stack).toEqual(['function1'])
    })

    it('should emit call-stack-push event', () => {
      const listener = vi.fn()
      dbg.on('call-stack-push', listener)

      dbg.pushCallStack(sessionId, 'func')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        functionName: 'func',
      })
    })

    it('should pop from call stack', () => {
      dbg.pushCallStack(sessionId, 'func1')
      dbg.pushCallStack(sessionId, 'func2')

      const popped = dbg.popCallStack(sessionId)

      expect(popped).toBe('func2')
      expect(dbg.getCallStack(sessionId)).toEqual(['func1'])
    })

    it('should emit call-stack-pop event', () => {
      const listener = vi.fn()
      dbg.on('call-stack-pop', listener)

      dbg.pushCallStack(sessionId, 'func')
      dbg.popCallStack(sessionId)

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        functionName: 'func',
      })
    })

    it('should return undefined when popping empty stack', () => {
      const popped = dbg.popCallStack(sessionId)

      expect(popped).toBeUndefined()
    })

    it('should track nested calls', () => {
      dbg.pushCallStack(sessionId, 'main')
      dbg.pushCallStack(sessionId, 'helper')
      dbg.pushCallStack(sessionId, 'util')

      const stack = dbg.getCallStack(sessionId)

      expect(stack).toEqual(['main', 'helper', 'util'])
    })
  })

  describe('Execution Control', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should start not paused', () => {
      expect(dbg.isPaused(sessionId)).toBe(false)
    })

    it('should pause execution', () => {
      dbg.pause(sessionId)

      expect(dbg.isPaused(sessionId)).toBe(true)
    })

    it('should emit pause event', () => {
      const listener = vi.fn()
      dbg.on('pause', listener)

      dbg.pause(sessionId)

      expect(listener).toHaveBeenCalledWith({ sessionId })
    })

    it('should continue execution', () => {
      dbg.pause(sessionId)
      dbg.continue(sessionId)

      expect(dbg.isPaused(sessionId)).toBe(false)
    })

    it('should emit continue event', () => {
      const listener = vi.fn()
      dbg.on('continue', listener)

      dbg.continue(sessionId)

      expect(listener).toHaveBeenCalledWith({ sessionId })
    })
  })

  describe('Logging', () => {
    let sessionId: string

    beforeEach(() => {
      sessionId = dbg.createSession('test-plugin')
    })

    it('should log info message', () => {
      const listener = vi.fn()
      dbg.on('log', listener)

      dbg.log(sessionId, 'Test message')

      expect(listener).toHaveBeenCalledWith({
        sessionId,
        message: 'Test message',
        level: 'info',
        timestamp: expect.any(Number),
      })
    })

    it('should log warning message', () => {
      const listener = vi.fn()
      dbg.on('log', listener)

      dbg.log(sessionId, 'Warning', 'warn')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'warn' })
      )
    })

    it('should log error message', () => {
      const listener = vi.fn()
      dbg.on('log', listener)

      dbg.log(sessionId, 'Error', 'error')

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error' })
      )
    })
  })

  describe('Enable/Disable', () => {
    it('should start enabled', () => {
      expect(dbg.isEnabled()).toBe(true)
    })

    it('should disable debugger', () => {
      dbg.disable()

      expect(dbg.isEnabled()).toBe(false)
    })

    it('should enable debugger', () => {
      dbg.disable()
      dbg.enable()

      expect(dbg.isEnabled()).toBe(true)
    })
  })

  describe('Global Debugger', () => {
    afterEach(() => {
      resetGlobalDebugger()
    })

    it('should get global debugger', () => {
      const globalDbg = getGlobalDebugger()

      expect(globalDbg).toBeInstanceOf(PluginDebugger)
    })

    it('should return same instance', () => {
      const globalDbg1 = getGlobalDebugger()
      const globalDbg2 = getGlobalDebugger()

      expect(globalDbg1).toBe(globalDbg2)
    })

    it('should reset global debugger', () => {
      const globalDbg1 = getGlobalDebugger()

      resetGlobalDebugger()

      const globalDbg2 = getGlobalDebugger()

      expect(globalDbg2).not.toBe(globalDbg1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle operations on invalid session', () => {
      expect(() => dbg.setVariable('invalid', 'x', 1)).not.toThrow()
      expect(() => dbg.pushCallStack('invalid', 'func')).not.toThrow()
      expect(() => dbg.pause('invalid')).not.toThrow()
      expect(() => dbg.continue('invalid')).not.toThrow()
    })

    it('should handle multiple sessions', () => {
      const session1 = dbg.createSession('plugin1')
      const session2 = dbg.createSession('plugin2')

      dbg.setVariable(session1, 'x', 1)
      dbg.setVariable(session2, 'x', 2)

      expect(dbg.getVariable(session1, 'x')).toBe(1)
      expect(dbg.getVariable(session2, 'x')).toBe(2)
    })

    it('should isolate breakpoints between sessions', () => {
      const session1 = dbg.createSession('plugin1')
      const session2 = dbg.createSession('plugin2')

      dbg.setBreakpoint(session1, 'func')

      expect(dbg.getBreakpoints(session1)).toHaveLength(1)
      expect(dbg.getBreakpoints(session2)).toHaveLength(0)
    })
  })
})
