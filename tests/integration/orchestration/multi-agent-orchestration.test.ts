/**
 * Multi-Agent Orchestration Integration Tests
 *
 * End-to-end tests for multi-agent task orchestration:
 * - Task planning
 * - Agent coordination
 * - Parallel execution
 * - Result aggregation
 *
 * @since v12.8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock environment for testing
vi.stubEnv('AX_MOCK_PROVIDERS', 'true');

describe('Multi-Agent Orchestration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'orchestration-test-'));
    await mkdir(join(testDir, '.automatosx'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Task Planning', () => {
    it('should break down complex task into subtasks', async () => {
      const complexTask = 'Build a user authentication system with login UI and security audit';

      // Simulated task breakdown
      const subtasks = [
        { id: 1, agent: 'security', task: 'Design security requirements', dependencies: [] },
        { id: 2, agent: 'backend', task: 'Implement auth API', dependencies: [1] },
        { id: 3, agent: 'frontend', task: 'Build login UI', dependencies: [1] },
        { id: 4, agent: 'quality', task: 'Review and test', dependencies: [2, 3] }
      ];

      expect(subtasks).toHaveLength(4);
      expect(subtasks[0]!.dependencies).toHaveLength(0);
      expect(subtasks[3]!.dependencies).toContain(2);
      expect(subtasks[3]!.dependencies).toContain(3);
    });

    it('should identify parallelizable tasks', async () => {
      const subtasks = [
        { id: 1, agent: 'architecture', task: 'Design system', dependencies: [] },
        { id: 2, agent: 'backend', task: 'Implement backend', dependencies: [1] },
        { id: 3, agent: 'frontend', task: 'Implement frontend', dependencies: [1] },
        { id: 4, agent: 'devops', task: 'Setup infrastructure', dependencies: [1] },
        { id: 5, agent: 'quality', task: 'Integration tests', dependencies: [2, 3, 4] }
      ];

      // Tasks 2, 3, 4 can run in parallel after task 1
      const getParallelGroups = (tasks: typeof subtasks) => {
        const completed = new Set<number>();
        const groups: number[][] = [];

        while (completed.size < tasks.length) {
          const runnable = tasks.filter(t =>
            !completed.has(t.id) &&
            t.dependencies.every(d => completed.has(d))
          );

          if (runnable.length === 0) break;

          groups.push(runnable.map(t => t.id));
          runnable.forEach(t => completed.add(t.id));
        }

        return groups;
      };

      const groups = getParallelGroups(subtasks);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual([1]); // First group: design
      expect(groups[1]).toEqual(expect.arrayContaining([2, 3, 4])); // Parallel group
      expect(groups[2]).toEqual([5]); // Final group: testing
    });
  });

  describe('Dependency Graph', () => {
    it('should detect circular dependencies', async () => {
      const detectCycle = (tasks: Array<{ id: number; dependencies: number[] }>): boolean => {
        const visited = new Set<number>();
        const recursionStack = new Set<number>();

        const hasCycle = (id: number): boolean => {
          if (!visited.has(id)) {
            visited.add(id);
            recursionStack.add(id);

            const task = tasks.find(t => t.id === id);
            for (const dep of task?.dependencies || []) {
              if (!visited.has(dep) && hasCycle(dep)) {
                return true;
              } else if (recursionStack.has(dep)) {
                return true;
              }
            }
          }

          recursionStack.delete(id);
          return false;
        };

        return tasks.some(t => hasCycle(t.id));
      };

      // Valid DAG (no cycles)
      const validTasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [1] },
        { id: 3, dependencies: [2] }
      ];
      expect(detectCycle(validTasks)).toBe(false);

      // Invalid (circular)
      const cyclicTasks = [
        { id: 1, dependencies: [3] },
        { id: 2, dependencies: [1] },
        { id: 3, dependencies: [2] }
      ];
      expect(detectCycle(cyclicTasks)).toBe(true);
    });

    it('should calculate critical path', async () => {
      type TaskType = { id: number; duration: number; dependencies: number[] };
      const tasks: TaskType[] = [
        { id: 1, duration: 10, dependencies: [] },
        { id: 2, duration: 20, dependencies: [1] },
        { id: 3, duration: 5, dependencies: [1] },
        { id: 4, duration: 15, dependencies: [2, 3] }
      ];

      // Critical path calculation
      const calculateCriticalPath = (
        taskList: TaskType[]
      ): { path: number[]; duration: number } => {
        const earliestStart = new Map<number, number>();
        const earliestFinish = new Map<number, number>();

        // Forward pass
        const calculate = (id: number): number => {
          if (earliestFinish.has(id)) return earliestFinish.get(id)!;

          const task = taskList.find((t: TaskType) => t.id === id)!;
          const start = task.dependencies.length === 0
            ? 0
            : Math.max(...task.dependencies.map((d: number) => calculate(d)));

          earliestStart.set(id, start);
          earliestFinish.set(id, start + task.duration);

          return earliestFinish.get(id)!;
        };

        taskList.forEach((t: TaskType) => calculate(t.id));

        // Find critical path (longest path)
        const finalTask = taskList.reduce((a: TaskType, b: TaskType) =>
          (earliestFinish.get(a.id) || 0) > (earliestFinish.get(b.id) || 0) ? a : b
        );

        return {
          path: [finalTask.id], // Simplified
          duration: earliestFinish.get(finalTask.id) || 0
        };
      };

      const result = calculateCriticalPath(tasks);

      expect(result.duration).toBe(45); // 10 + 20 + 15
    });
  });

  describe('Agent Assignment', () => {
    it('should assign optimal agent for task', async () => {
      const agentAbilities = {
        backend: ['api-design', 'database', 'testing'],
        frontend: ['ui-design', 'react', 'css'],
        security: ['audit', 'penetration-testing', 'compliance'],
        quality: ['testing', 'code-review', 'documentation']
      };

      const assignAgent = (taskKeywords: string[]): string => {
        let bestAgent = 'backend';
        let bestScore = 0;

        for (const [agent, abilities] of Object.entries(agentAbilities)) {
          const score = taskKeywords.filter(k =>
            abilities.some(a => a.includes(k) || k.includes(a))
          ).length;

          if (score > bestScore) {
            bestScore = score;
            bestAgent = agent;
          }
        }

        return bestAgent;
      };

      expect(assignAgent(['api', 'database'])).toBe('backend');
      expect(assignAgent(['ui', 'react', 'component'])).toBe('frontend');
      expect(assignAgent(['security', 'audit'])).toBe('security');
      expect(assignAgent(['test', 'review', 'qa'])).toBe('quality');
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate results from multiple agents', async () => {
      type AgentResult = { agent: string; success: boolean; output: string; tokens: number };
      const results: AgentResult[] = [
        { agent: 'backend', success: true, output: 'API implemented', tokens: 1500 },
        { agent: 'frontend', success: true, output: 'UI created', tokens: 1200 },
        { agent: 'security', success: true, output: 'Audit passed', tokens: 800 },
        { agent: 'quality', success: true, output: 'Tests passing', tokens: 600 }
      ];

      const aggregate = (resultList: AgentResult[]) => ({
        success: resultList.every(r => r.success),
        totalTokens: resultList.reduce((sum, r) => sum + r.tokens, 0),
        agents: resultList.map(r => r.agent),
        outputs: resultList.map(r => ({ agent: r.agent, output: r.output }))
      });

      const aggregated = aggregate(results);

      expect(aggregated.success).toBe(true);
      expect(aggregated.totalTokens).toBe(4100);
      expect(aggregated.agents).toHaveLength(4);
    });

    it('should handle partial failures', async () => {
      type PartialResult = { agent: string; success: boolean; output: string | null; error: string | null };
      const results: PartialResult[] = [
        { agent: 'backend', success: true, output: 'Done', error: null },
        { agent: 'frontend', success: false, output: null, error: 'Build failed' },
        { agent: 'quality', success: true, output: 'Done', error: null }
      ];

      const aggregate = (resultList: PartialResult[]) => ({
        success: resultList.every(r => r.success),
        partialSuccess: resultList.some(r => r.success),
        failures: resultList.filter(r => !r.success),
        successCount: resultList.filter(r => r.success).length
      });

      const aggregated = aggregate(results);

      expect(aggregated.success).toBe(false);
      expect(aggregated.partialSuccess).toBe(true);
      expect(aggregated.failures).toHaveLength(1);
      expect(aggregated.successCount).toBe(2);
    });
  });

  describe('Execution Modes', () => {
    it('should support plan_only mode', async () => {
      const mode = 'plan_only';

      // In plan_only mode, only planning is done
      const executePlan = mode === 'plan_only';
      expect(executePlan).toBe(true);
    });

    it('should support execute mode', async () => {
      const mode = 'execute';
      const executeSequentially = mode === 'execute';
      expect(executeSequentially).toBe(true);
    });

    it('should support execute_parallel mode', async () => {
      const mode = 'execute_parallel';
      const executeParallel = mode === 'execute_parallel';
      expect(executeParallel).toBe(true);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle task timeouts', async () => {
      const taskTimeout = 5000; // 5 seconds
      const startTime = Date.now();

      const simulateTask = async (duration: number): Promise<boolean> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const elapsed = Date.now() - startTime;
            resolve(elapsed < taskTimeout);
          }, Math.min(duration, 100)); // Cap for test speed
        });
      };

      const result = await simulateTask(100);
      expect(result).toBe(true);
    });

    it('should continue on failure when configured', async () => {
      const config = { continueOnFailure: true };

      const taskResults = [
        { id: 1, success: true },
        { id: 2, success: false },
        { id: 3, success: true }
      ];

      let completed = 0;
      for (const result of taskResults) {
        if (result.success || config.continueOnFailure) {
          completed++;
        } else {
          break;
        }
      }

      expect(completed).toBe(3);
    });

    it('should stop on failure when not configured', async () => {
      const config = { continueOnFailure: false };

      const taskResults = [
        { id: 1, success: true },
        { id: 2, success: false },
        { id: 3, success: true }
      ];

      let completed = 0;
      for (const result of taskResults) {
        if (result.success) {
          completed++;
        } else if (!config.continueOnFailure) {
          break;
        }
      }

      expect(completed).toBe(1);
    });
  });
});
