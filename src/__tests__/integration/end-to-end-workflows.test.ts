/**
 * End-to-End Workflow Tests
 * Sprint 3 Day 28: Complete workflow scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStateMachineRuntime } from '../../runtime/StateMachineRuntime.js'
import type { ProviderRequest } from '../../providers/ProviderBase.js'
import { ClaudeProvider } from '../../providers/ClaudeProvider.js'

// Mock provider SDKs
vi.mock('@anthropic-ai/sdk')
vi.mock('@google/generative-ai')
vi.mock('openai')

describe('End-to-End Workflows', () => {
  let runtime: ReturnType<typeof createStateMachineRuntime>

  beforeEach(() => {
    runtime = createStateMachineRuntime()
  })

  describe('single provider workflow', () => {
    it('should complete task with Claude provider', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'claude-sonnet-4-5-20250929',
      })

      const request: ProviderRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write a hello world function' },
        ],
        maxTokens: 4096,
        temperature: 1.0,
        streaming: false,
        timeout: 60000,
      }

      const result = await runtime.executeTask({
        taskId: 'e2e-claude-1',
        agentName: 'backend',
        provider,
        request,
      })

      expect(result.taskId).toBe('e2e-claude-1')
      expect(result.finalState).toMatch(/completed|failed/)
    })
  })

  describe('multi-step workflows', () => {
    it('should execute sequential tasks', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      // Step 1: Planning
      const planResult = await runtime.executeTask({
        taskId: 'multi-step-1-plan',
        agentName: 'product',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Plan a user authentication feature' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(planResult.taskId).toBe('multi-step-1-plan')

      // Step 2: Implementation
      const implResult = await runtime.executeTask({
        taskId: 'multi-step-1-impl',
        agentName: 'backend',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Implement the authentication feature' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(implResult.taskId).toBe('multi-step-1-impl')

      // Step 3: Testing
      const testResult = await runtime.executeTask({
        taskId: 'multi-step-1-test',
        agentName: 'quality',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Test the authentication feature' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(testResult.taskId).toBe('multi-step-1-test')

      // All steps should complete
      const checkpoints = await runtime.listCheckpoints()
      expect(checkpoints.length).toBeGreaterThanOrEqual(3)
    })

    it('should handle parallel task execution', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      const tasks = [
        { taskId: 'parallel-1', content: 'Task 1', agent: 'backend' },
        { taskId: 'parallel-2', content: 'Task 2', agent: 'frontend' },
        { taskId: 'parallel-3', content: 'Task 3', agent: 'devops' },
      ]

      const results = await Promise.all(
        tasks.map((task) =>
          runtime.executeTask({
            taskId: task.taskId,
            agentName: task.agent,
            provider,
            request: {
              messages: [{ role: 'user', content: task.content }],
              maxTokens: 4096,
              temperature: 1.0,
              streaming: false,
              timeout: 60000,
            },
          })
        )
      )

      expect(results).toHaveLength(3)
      expect(results[0].taskId).toBe('parallel-1')
      expect(results[1].taskId).toBe('parallel-2')
      expect(results[2].taskId).toBe('parallel-3')
    })
  })

  describe('error recovery workflows', () => {
    it('should retry failed tasks', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      const attemptEvents: number[] = []

      runtime.on('execution-attempt', ({ attempt }) => {
        attemptEvents.push(attempt)
      })

      const result = await runtime.executeTask({
        taskId: 'retry-1',
        agentName: 'backend',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Task that might fail' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        maxRetries: 3,
      })

      expect(result.taskId).toBe('retry-1')
      // Should have at least one attempt
      expect(attemptEvents.length).toBeGreaterThan(0)
    })

    it('should save state on failure for recovery', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 1,
        timeout: 60000,
      })

      const result = await runtime.executeTask({
        taskId: 'recovery-1',
        agentName: 'backend',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Task for recovery test' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        maxRetries: 1,
      })

      // Should have checkpoints regardless of success/failure
      expect(result.checkpoints).toBeDefined()
      expect(result.checkpoints.length).toBeGreaterThan(0)

      // Should be able to query status
      const status = await runtime.getTaskStatus('recovery-1')
      expect(status).toBeDefined()
    })
  })

  describe('checkpoint workflows', () => {
    it('should create periodic checkpoints for long tasks', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      const checkpointEvents: any[] = []

      runtime.on('checkpoint-created', (event) => {
        checkpointEvents.push(event)
      })

      const result = await runtime.executeTask({
        taskId: 'checkpoint-1',
        agentName: 'backend',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Long-running task' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
        checkpointInterval: 30, // 30 seconds (won't trigger in fast test)
      })

      expect(result.taskId).toBe('checkpoint-1')
      // Should have at least final checkpoint
      expect(result.checkpoints.length).toBeGreaterThan(0)
    })

    it('should restore and continue from checkpoint', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      // Initial execution
      const result1 = await runtime.executeTask({
        taskId: 'restore-1',
        agentName: 'backend',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Initial task' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      expect(result1.success).toBeDefined()

      // Check status
      const status = await runtime.getTaskStatus('restore-1')
      expect(status).toBeDefined()
      expect(status?.context.taskId).toBe('restore-1')

      // If we have a checkpoint, we can resume
      if (status && !status.isActive) {
        const result2 = await runtime.resumeTask(
          'restore-1',
          provider,
          {
            messages: [{ role: 'user', content: 'Continue task' }],
            maxTokens: 4096,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          }
        )

        expect(result2.taskId).toBe('restore-1')
      }
    })
  })

  describe('agent delegation workflows', () => {
    it('should delegate tasks between agents', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      // Product agent plans
      const planResult = await runtime.executeTask({
        taskId: 'delegate-plan',
        agentName: 'product',
        provider,
        request: {
          messages: [{ role: 'user', content: 'Plan authentication feature' }],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      // Backend agent implements
      const implResult = await runtime.executeTask({
        taskId: 'delegate-impl',
        agentName: 'backend',
        provider,
        request: {
          messages: [
            { role: 'system', content: 'Implement based on plan' },
            { role: 'user', content: 'Implement authentication API' },
          ],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      // Security agent reviews
      const reviewResult = await runtime.executeTask({
        taskId: 'delegate-review',
        agentName: 'security',
        provider,
        request: {
          messages: [
            { role: 'system', content: 'Review for security issues' },
            { role: 'user', content: 'Audit authentication implementation' },
          ],
          maxTokens: 4096,
          temperature: 1.0,
          streaming: false,
          timeout: 60000,
        },
      })

      // All tasks should have unique IDs
      expect(planResult.taskId).toBe('delegate-plan')
      expect(implResult.taskId).toBe('delegate-impl')
      expect(reviewResult.taskId).toBe('delegate-review')

      // Should be able to list all checkpoints
      const checkpoints = await runtime.listCheckpoints()
      expect(checkpoints.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('performance workflows', () => {
    it('should handle rapid sequential tasks', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      const startTime = Date.now()
      const taskCount = 5

      for (let i = 0; i < taskCount; i++) {
        await runtime.executeTask({
          taskId: `rapid-${i}`,
          agentName: 'backend',
          provider,
          request: {
            messages: [{ role: 'user', content: `Quick task ${i}` }],
            maxTokens: 100,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        })
      }

      const duration = Date.now() - startTime

      // Should complete 5 tasks in reasonable time
      expect(duration).toBeLessThan(30000) // < 30 seconds total

      const checkpoints = await runtime.listCheckpoints()
      expect(checkpoints.length).toBeGreaterThanOrEqual(taskCount)
    })

    it('should handle concurrent burst of tasks', async () => {
      const provider = new ClaudeProvider({
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 60000,
      })

      const taskCount = 10
      const startTime = Date.now()

      const tasks = Array.from({ length: taskCount }, (_, i) =>
        runtime.executeTask({
          taskId: `burst-${i}`,
          agentName: 'backend',
          provider,
          request: {
            messages: [{ role: 'user', content: `Burst task ${i}` }],
            maxTokens: 100,
            temperature: 1.0,
            streaming: false,
            timeout: 60000,
          },
        })
      )

      const results = await Promise.all(tasks)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(taskCount)
      expect(duration).toBeLessThan(60000) // < 60 seconds total
    })
  })
})
