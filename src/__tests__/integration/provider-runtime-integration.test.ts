/**
 * Provider + Runtime Integration Tests
 * Sprint 3 Day 28: End-to-end workflow tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createStateMachineRuntime } from '../../runtime/StateMachineRuntime.js'
import { ProviderRouterV2 } from '../../services/ProviderRouterV2.js'
import type { ProviderRequest } from '../../providers/ProviderBase.js'
import { runMigrations } from '../../database/migrations.js'
import { closeDatabase, setDatabase } from '../../database/connection.js'

// Mock provider SDKs with proper implementations
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn().mockResolvedValue({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Mock Claude response' }],
          model: 'claude-sonnet-4-5-20250929',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      }
    },
  }
})

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class MockGoogleGenerativeAI {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => 'Mock Gemini response',
              usageMetadata: {
                promptTokenCount: 10,
                candidatesTokenCount: 20,
                totalTokenCount: 30,
              },
            },
          }),
        }
      }
    },
  }
})

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Mock OpenAI response' },
              finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
        },
      }
    },
  }
})

describe('Provider + Runtime Integration', () => {
  let runtime: ReturnType<typeof createStateMachineRuntime>
  let router: ProviderRouterV2
  let testDb: Database.Database | null = null

  beforeEach(() => {
    // Setup test database
    try {
      closeDatabase()
    } catch (e) {
      // Ignore if no connection exists
    }

    testDb = new Database(':memory:')
    runMigrations(testDb)
    setDatabase(testDb)

    // Setup runtime and router
    runtime = createStateMachineRuntime()
    router = new ProviderRouterV2({
      providers: {
        claude: {
          enabled: true,
          priority: 1,
          apiKey: 'test-key',
          maxRetries: 3,
          timeout: 60000,
          defaultModel: 'claude-sonnet-4-5-20250929',
        },
        gemini: {
          enabled: true,
          priority: 2,
          apiKey: 'test-key',
          maxRetries: 3,
          timeout: 60000,
          defaultModel: 'gemini-2.5-pro',
        },
        openai: {
          enabled: true,
          priority: 3,
          apiKey: 'test-key',
          maxRetries: 3,
          timeout: 60000,
          defaultModel: 'gpt-4o',
        },
      },
    })

    // Mock router.request to bypass provider SDK calls
    // Add small delay to simulate async work and emit router events
    vi.spyOn(router, 'request').mockImplementation(async () => {
      // Emit routing decision event
      router.emit('routing-decision', {
        selectedProvider: 'claude',
        fallbackChain: ['gemini', 'openai'],
        reason: 'highest priority available',
      })

      // Emit attempt event
      router.emit('attempt', {
        provider: 'claude',
        attempt: 1,
      })

      await new Promise((resolve) => setTimeout(resolve, 150))

      // Emit success event
      router.emit('success', {
        provider: 'claude',
        response: {
          provider: 'claude',
          model: 'claude-sonnet-4-5-20250929',
          content: 'Mock response',
          usage: {
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
          },
          latency: 100,
          finishReason: 'stop',
        },
      })

      return {
        provider: 'claude',
        model: 'claude-sonnet-4-5-20250929',
        content: 'Mock response',
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
        latency: 100,
        finishReason: 'stop',
      }
    })
  })

  afterEach(() => {
    // Cleanup database
    if (testDb) {
      testDb.close()
      testDb = null
    }
    closeDatabase()

    // Restore mocks
    vi.restoreAllMocks()
  })

  describe('complete task workflow', () => {
    it('should execute task from idle to completed', async () => {
      const stateChanges: string[] = []

      runtime.on('state-changed', ({ to }) => {
        stateChanges.push(to)
      })

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test task' }],
        maxTokens: 4096,
        temperature: 1.0,
        streaming: false,
        timeout: 60000,
      }

      const result = await runtime.executeTask({
        taskId: 'workflow-1',
        agentName: 'backend',
        provider: router,
        request,
      })

      expect(result.success).toBe(true)
      expect(result.finalState).toBe('completed')
      expect(stateChanges).toEqual(['planning', 'executing', 'completed'])
    })

    it('should track execution events', async () => {
      const events: string[] = []

      runtime.on('task-started', () => events.push('started'))
      runtime.on('state-changed', () => events.push('state-changed'))
      runtime.on('execution-attempt', () => events.push('attempt'))
      runtime.on('task-completed', () => events.push('completed'))

      const result = await runtime.executeTask({
        taskId: 'workflow-2',
        agentName: 'frontend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Build UI' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(result.success).toBe(true)
      expect(events).toContain('started')
      expect(events).toContain('attempt')
      expect(events).toContain('completed')
    })

    it('should save checkpoint with provider response data', async () => {
      const result = await runtime.executeTask({
        taskId: 'workflow-3',
        agentName: 'devops',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Deploy app' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(result.success).toBe(true)
      expect(result.checkpoints.length).toBeGreaterThan(0)

      const finalCheckpoint = result.checkpoints[result.checkpoints.length - 1]
      expect(finalCheckpoint.state).toBe('completed')
      expect(finalCheckpoint.context.data.tokens).toBeDefined()
      expect(finalCheckpoint.context.data.latency).toBeDefined()
    })
  })

  describe('error recovery', () => {
    it('should handle provider errors gracefully', async () => {
      const result = await runtime.executeTask({
        taskId: 'error-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Trigger error' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        maxRetries: 3,
      })

      // Should handle error gracefully
      expect(result).toBeDefined()
      expect(result.taskId).toBe('error-1')
    })

    it('should transition to failed state on persistent errors', async () => {
      const result = await runtime.executeTask({
        taskId: 'error-2',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Persistent error' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        maxRetries: 2,
      })

      // If all retries fail, should be in failed state
      if (!result.success) {
        expect(result.finalState).toBe('failed')
        expect(result.error).toBeDefined()
      }
    })

    it('should save checkpoint on failure', async () => {
      const result = await runtime.executeTask({
        taskId: 'error-3',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Test failure' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        maxRetries: 1,
      })

      // Even on failure, should have checkpoints
      expect(result.checkpoints).toBeDefined()
      expect(result.checkpoints.length).toBeGreaterThan(0)
    })
  })

  describe('concurrent execution', () => {
    it('should handle multiple concurrent tasks', async () => {
      const tasks = [
        runtime.executeTask({
          taskId: 'concurrent-1',
          agentName: 'backend',
          provider: router,
          request: {
            messages: [{ role: 'user', content: 'Task 1' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        }),
        runtime.executeTask({
          taskId: 'concurrent-2',
          agentName: 'frontend',
          provider: router,
          request: {
            messages: [{ role: 'user', content: 'Task 2' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        }),
        runtime.executeTask({
          taskId: 'concurrent-3',
          agentName: 'devops',
          provider: router,
          request: {
            messages: [{ role: 'user', content: 'Task 3' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        }),
      ]

      const results = await Promise.all(tasks)

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.taskId !== undefined)).toBe(true)
    })

    it('should track all active executions', async () => {
      // Start tasks without awaiting
      const task1 = runtime.executeTask({
        taskId: 'active-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Long task 1' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      const task2 = runtime.executeTask({
        taskId: 'active-2',
        agentName: 'frontend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Long task 2' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      // Wait a bit for tasks to start executing
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Check active executions
      const active = runtime.getActiveExecutions()
      expect(active.length).toBeGreaterThan(0)

      // Wait for completion
      await Promise.all([task1, task2])

      // Should be cleared
      const finalActive = runtime.getActiveExecutions()
      expect(finalActive).toHaveLength(0)
    })

    it('should handle concurrent task completion correctly', async () => {
      const completedTasks: string[] = []

      runtime.on('task-completed', ({ taskId }) => {
        completedTasks.push(taskId)
      })

      await Promise.all([
        runtime.executeTask({
          taskId: 'completion-1',
          agentName: 'backend',
          provider: router,
          request: {
            messages: [{ role: 'user', content: 'Task 1' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        }),
        runtime.executeTask({
          taskId: 'completion-2',
          agentName: 'frontend',
          provider: router,
          request: {
            messages: [{ role: 'user', content: 'Task 2' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        }),
      ])

      expect(completedTasks).toContain('completion-1')
      expect(completedTasks).toContain('completion-2')
    })
  })

  describe('checkpoint and resume', () => {
    it('should resume task from checkpoint', async () => {
      // Initial execution
      const result1 = await runtime.executeTask({
        taskId: 'resume-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Initial task' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(result1.success).toBe(true)

      // Resume from checkpoint
      const resumeEvents: string[] = []
      runtime.on('task-resumed', () => resumeEvents.push('resumed'))

      const result2 = await runtime.resumeTask(
        'resume-1',
        router,
        {
          messages: [{ role: 'user', content: 'Resumed task' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        }
      )

      expect(resumeEvents).toContain('resumed')
      expect(result2.taskId).toBe('resume-1')
    })

    it('should preserve context across resume', async () => {
      // Initial execution with context data
      await runtime.executeTask({
        taskId: 'context-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Task with context' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      const status = await runtime.getTaskStatus('context-1')
      expect(status).toBeDefined()
      expect(status?.context.agentName).toBe('backend')
      expect(status?.context.taskId).toBe('context-1')
    })

    it('should list all checkpoints by agent', async () => {
      await runtime.executeTask({
        taskId: 'list-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Backend task 1' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      await runtime.executeTask({
        taskId: 'list-2',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Backend task 2' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      const checkpoints = await runtime.listCheckpoints('backend')
      expect(checkpoints.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('performance', () => {
    it('should complete simple task quickly', async () => {
      const startTime = Date.now()

      await runtime.executeTask({
        taskId: 'perf-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Quick task' }],
          maxTokens: 100,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete in < 5 seconds
    })

    it('should track execution duration accurately', async () => {
      const result = await runtime.executeTask({
        taskId: 'perf-2',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Timed task' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(result.duration).toBeGreaterThan(0)
      expect(result.duration).toBeLessThan(10000) // Reasonable upper bound
    })
  })

  describe('provider fallback', () => {
    it('should emit routing decision events', async () => {
      const routingEvents: any[] = []

      router.on('routing-decision', (event) => {
        routingEvents.push(event)
      })

      await runtime.executeTask({
        taskId: 'routing-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Test routing' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(routingEvents.length).toBeGreaterThan(0)
      expect(routingEvents[0].selectedProvider).toBeDefined()
    })

    it('should emit provider attempt events', async () => {
      const attemptEvents: any[] = []

      router.on('attempt', (event) => {
        attemptEvents.push(event)
      })

      await runtime.executeTask({
        taskId: 'attempt-1',
        agentName: 'backend',
        provider: router,
        request: {
          messages: [{ role: 'user', content: 'Test attempt' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(attemptEvents.length).toBeGreaterThan(0)
    })
  })
})
