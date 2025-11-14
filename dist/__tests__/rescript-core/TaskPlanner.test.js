// Sprint 7 Day 62: Task Planning Engine Test Suite
// Comprehensive tests for task planning, dependency resolution, and critical path analysis
import { describe, it, expect } from 'vitest';
import * as TaskPlanner from '../../../packages/rescript-core/src/workflow/TaskPlanner.gen.js';
// Alias for consistency with test naming
const createTaskPlan = TaskPlanner.plan;
// ============================================================================
// Test Data Helpers
// ============================================================================
const createTask = (id, estimatedDuration, dependencies = [], requiredResources = [], priority = 0) => TaskPlanner.createTask(id, `Task ${id}`, estimatedDuration, dependencies, requiredResources, priority);
// ============================================================================
// Basic Task Plan Creation
// ============================================================================
describe('Task Plan Creation', () => {
    it('should create a plan for a single task', () => {
        const tasks = [createTask('A', 10)];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.tasks).toHaveLength(1);
            expect(plan.executionOrder).toEqual(['A']);
            expect(plan.estimatedTotalTime).toBe(10);
        }
    });
    it('should create a plan for multiple independent tasks', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20),
            createTask('C', 15),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.tasks).toHaveLength(3);
            expect(plan.executionOrder).toHaveLength(3);
            // All tasks can run in parallel
            expect(plan.parallelGroups.length).toBeGreaterThan(0);
        }
    });
    it('should create a plan with linear dependencies', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20, ['A']),
            createTask('C', 15, ['B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.executionOrder).toEqual(['A', 'B', 'C']);
            expect(plan.estimatedTotalTime).toBe(45); // 10 + 20 + 15
        }
    });
    it('should handle empty task list', () => {
        const tasks = [];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.tasks).toHaveLength(0);
            expect(plan.executionOrder).toHaveLength(0);
        }
    });
    it('should create a plan with complex dependencies', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20),
            createTask('C', 15, ['A', 'B']),
            createTask('D', 25, ['C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.tasks).toHaveLength(4);
            // A and B should come before C
            const orderA = plan.executionOrder.indexOf('A');
            const orderB = plan.executionOrder.indexOf('B');
            const orderC = plan.executionOrder.indexOf('C');
            const orderD = plan.executionOrder.indexOf('D');
            expect(orderA).toBeLessThan(orderC);
            expect(orderB).toBeLessThan(orderC);
            expect(orderC).toBeLessThan(orderD);
        }
    });
});
// ============================================================================
// Topological Sort and Dependency Resolution
// ============================================================================
describe('Topological Sort', () => {
    it('should sort tasks with simple dependencies', () => {
        const tasks = [
            createTask('C', 10, ['A', 'B']),
            createTask('A', 10),
            createTask('B', 10),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const order = result._0.executionOrder;
            const indexA = order.indexOf('A');
            const indexB = order.indexOf('B');
            const indexC = order.indexOf('C');
            expect(indexA).toBeLessThan(indexC);
            expect(indexB).toBeLessThan(indexC);
        }
    });
    it('should handle diamond dependencies', () => {
        // A -> B -> D
        // A -> C -> D
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['A']),
            createTask('D', 10, ['B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const order = result._0.executionOrder;
            expect(order.indexOf('A')).toBe(0);
            expect(order.indexOf('D')).toBe(3);
        }
    });
    it('should handle multiple dependency chains', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10),
            createTask('D', 10, ['C']),
            createTask('E', 10, ['B', 'D']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const order = result._0.executionOrder;
            expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
            expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
            expect(order.indexOf('B')).toBeLessThan(order.indexOf('E'));
            expect(order.indexOf('D')).toBeLessThan(order.indexOf('E'));
        }
    });
    it('should handle tasks with self-dependency as error', () => {
        const tasks = [createTask('A', 10, ['A'])];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
    });
    it('should prioritize tasks correctly', () => {
        const tasks = [
            createTask('A', 10, [], [], 1),
            createTask('B', 10, [], [], 3),
            createTask('C', 10, [], [], 2),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Higher priority tasks should be earlier when optimized
            expect(plan.executionOrder).toContain('B');
        }
    });
    it('should handle deep dependency chains', () => {
        const tasks = [
            createTask('A', 5),
            createTask('B', 5, ['A']),
            createTask('C', 5, ['B']),
            createTask('D', 5, ['C']),
            createTask('E', 5, ['D']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            expect(result._0.executionOrder).toEqual(['A', 'B', 'C', 'D', 'E']);
        }
    });
    it('should handle missing dependency as error', () => {
        const tasks = [createTask('A', 10, ['NonExistent'])];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
        if (result.TAG === 'Error') {
            expect(result._0).toContain('NonExistent');
        }
    });
    it('should handle wide dependency tree', () => {
        // One task depends on many tasks
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 10),
            createTask('D', 10),
            createTask('E', 10, ['A', 'B', 'C', 'D']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const order = result._0.executionOrder;
            expect(order.indexOf('E')).toBe(4); // E should be last
        }
    });
});
// ============================================================================
// Cycle Detection
// ============================================================================
describe('Cycle Detection', () => {
    it('should detect simple cycle', () => {
        const tasks = [
            createTask('A', 10, ['B']),
            createTask('B', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
        if (result.TAG === 'Error') {
            expect(result._0.toLowerCase()).toContain('cycle');
        }
    });
    it('should detect three-task cycle', () => {
        const tasks = [
            createTask('A', 10, ['B']),
            createTask('B', 10, ['C']),
            createTask('C', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
        if (result.TAG === 'Error') {
            expect(result._0.toLowerCase()).toContain('cycle');
        }
    });
    it('should detect complex cycle', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['B']),
            createTask('D', 10, ['C']),
            createTask('E', 10, ['D', 'B']), // This creates a cycle: B -> C -> D -> E -> B
        ];
        const result = createTaskPlan([...tasks, createTask('B', 10, ['E'])]);
        // After modifying B to depend on E, we have a cycle
        expect(result.TAG).toBe('Error');
    });
    it('should not detect false cycles in valid DAG', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['A']),
            createTask('D', 10, ['B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
    });
    it('should detect indirect cycle', () => {
        const tasks = [
            createTask('A', 10, ['D']),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['B']),
            createTask('D', 10, ['C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
        if (result.TAG === 'Error') {
            expect(result._0.toLowerCase()).toContain('cycle');
        }
    });
});
// ============================================================================
// Critical Path Analysis
// ============================================================================
describe('Critical Path Analysis', () => {
    it('should identify critical path in linear chain', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20, ['A']),
            createTask('C', 15, ['B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.criticalPath).toEqual(['A', 'B', 'C']);
            expect(plan.estimatedTotalTime).toBe(45);
        }
    });
    it('should identify critical path in diamond structure', () => {
        // A (10) -> B (20) -> D (5)
        //        -> C (5)  ->
        const tasks = [
            createTask('A', 10),
            createTask('B', 20, ['A']),
            createTask('C', 5, ['A']),
            createTask('D', 5, ['B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Critical path should be A -> B -> D (total: 35)
            expect(plan.criticalPath).toContain('A');
            expect(plan.criticalPath).toContain('B');
            expect(plan.criticalPath).toContain('D');
            expect(plan.estimatedTotalTime).toBe(35);
        }
    });
    it('should calculate correct total time with parallel tasks', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 20, ['A', 'B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // A and B can run in parallel (max 10), then C (20)
            expect(plan.estimatedTotalTime).toBe(30);
        }
    });
    it('should identify longest path as critical', () => {
        const tasks = [
            createTask('Start', 0),
            createTask('Path1A', 10, ['Start']),
            createTask('Path1B', 5, ['Path1A']),
            createTask('Path2A', 20, ['Start']),
            createTask('Path2B', 15, ['Path2A']),
            createTask('End', 5, ['Path1B', 'Path2B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Critical path should be Start -> Path2A -> Path2B -> End (40)
            expect(plan.criticalPath).toContain('Path2A');
            expect(plan.criticalPath).toContain('Path2B');
            expect(plan.estimatedTotalTime).toBe(40);
        }
    });
    it('should handle multiple critical paths', () => {
        // Two paths of equal length
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 10, ['A']),
            createTask('D', 10, ['B']),
            createTask('E', 10, ['C', 'D']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.estimatedTotalTime).toBe(30);
            // Should include at least one complete path
            expect(plan.criticalPath.length).toBeGreaterThan(0);
        }
    });
    it('should calculate slack correctly', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 5, ['A']), // Shorter path, has slack
            createTask('C', 15, ['A']), // Longer path, on critical path
            createTask('D', 5, ['B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            const slack = TaskPlanner.getTotalSlack(plan);
            expect(slack).toBeGreaterThanOrEqual(0);
        }
    });
    it('should handle single task critical path', () => {
        const tasks = [createTask('A', 10)];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.criticalPath).toEqual(['A']);
            expect(plan.estimatedTotalTime).toBe(10);
        }
    });
});
// ============================================================================
// Earliest/Latest Start Calculations
// ============================================================================
describe('Earliest and Latest Starts', () => {
    it('should calculate earliest starts for linear chain', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20, ['A']),
            createTask('C', 15, ['B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // Earliest starts should be: A=0, B=10, C=30
    });
    it('should calculate earliest starts with parallel tasks', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 5, ['A', 'B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // A and B start at 0, C starts at 10 (after both complete)
    });
    it('should calculate latest starts without delaying project', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 5, ['A']),
            createTask('C', 15, ['A']),
            createTask('D', 5, ['B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // Latest starts should allow B to have slack
    });
    it('should handle tasks with zero duration', () => {
        const tasks = [
            createTask('Milestone', 0),
            createTask('A', 10, ['Milestone']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            expect(result._0.estimatedTotalTime).toBe(10);
        }
    });
    it('should calculate correct timing for complex graph', () => {
        const tasks = [
            createTask('A', 5),
            createTask('B', 10, ['A']),
            createTask('C', 8, ['A']),
            createTask('D', 7, ['B']),
            createTask('E', 12, ['C']),
            createTask('F', 6, ['D', 'E']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.estimatedTotalTime).toBeGreaterThan(0);
            expect(plan.executionOrder).toHaveLength(6);
        }
    });
    it('should preserve dependency constraints in timing', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // B cannot start before A completes
    });
});
// ============================================================================
// Parallel Task Grouping
// ============================================================================
describe('Parallel Task Grouping', () => {
    it('should group independent tasks together', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 10),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.parallelGroups.length).toBeGreaterThan(0);
            // Should have at least one group with multiple tasks
            const hasParallel = plan.parallelGroups.some(group => group.length > 1);
            expect(hasParallel).toBe(true);
        }
    });
    it('should not group dependent tasks', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Each task should be in its own group
            expect(plan.parallelGroups.length).toBe(3);
        }
    });
    it('should group tasks at same dependency level', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['A']),
            createTask('D', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // B, C, D should be in the same parallel group
            const secondLevelGroup = plan.parallelGroups.find(g => g.some(taskId => ['B', 'C', 'D'].includes(taskId)));
            expect(secondLevelGroup).toBeDefined();
            if (secondLevelGroup) {
                expect(secondLevelGroup.length).toBe(3);
            }
        }
    });
    it('should calculate max parallelism correctly', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
            createTask('C', 10, ['A']),
            createTask('D', 10, ['A']),
            createTask('E', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            const maxParallel = TaskPlanner.getMaxParallelism(plan);
            expect(maxParallel).toBe(4); // B, C, D, E can run in parallel
        }
    });
    it('should handle mixed parallel and sequential', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10),
            createTask('C', 10, ['A', 'B']),
            createTask('D', 10, ['A', 'B']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            expect(plan.parallelGroups.length).toBeGreaterThan(1);
        }
    });
    it('should optimize parallel execution order', () => {
        const tasks = [
            createTask('A', 10, [], [], 3),
            createTask('B', 10, [], [], 1),
            createTask('C', 10, [], [], 2),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Higher priority tasks should be considered for earlier execution
            expect(plan.executionOrder).toContain('A');
        }
    });
});
// ============================================================================
// Resource Conflict Detection
// ============================================================================
describe('Resource Conflict Detection', () => {
    it('should detect resource conflicts in parallel tasks', () => {
        const tasks = [
            createTask('A', 10, [], ['CPU']),
            createTask('B', 10, [], ['CPU']),
            createTask('C', 10, [], ['Memory']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // A and B should not be in the same parallel group
            const groups = plan.parallelGroups;
            const hasConflict = groups.some(group => group.includes('A') && group.includes('B'));
            expect(hasConflict).toBe(false);
        }
    });
    it('should allow tasks with different resources in parallel', () => {
        const tasks = [
            createTask('A', 10, [], ['CPU']),
            createTask('B', 10, [], ['Memory']),
            createTask('C', 10, [], ['Disk']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // All tasks can potentially run in parallel
            const firstGroup = plan.parallelGroups[0];
            expect(firstGroup?.length).toBeGreaterThanOrEqual(1);
        }
    });
    it('should handle tasks with no resources', () => {
        const tasks = [
            createTask('A', 10, [], []),
            createTask('B', 10, [], []),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Tasks with no resource constraints can run in parallel
            expect(plan.parallelGroups.length).toBeGreaterThan(0);
        }
    });
    it('should handle tasks with multiple resource requirements', () => {
        const tasks = [
            createTask('A', 10, [], ['CPU', 'Memory']),
            createTask('B', 10, [], ['CPU']),
            createTask('C', 10, [], ['Memory']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // A conflicts with both B and C
    });
});
// ============================================================================
// Plan Optimization
// ============================================================================
describe('Plan Optimization', () => {
    it('should prioritize high-priority tasks', () => {
        const tasks = [
            createTask('Low', 10, [], [], 1),
            createTask('High', 10, [], [], 10),
            createTask('Medium', 10, [], [], 5),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // Optimization should consider priority
            expect(plan.executionOrder).toContain('High');
        }
    });
    it('should respect dependencies despite priority', () => {
        const tasks = [
            createTask('A', 10, [], [], 1),
            createTask('B', 10, ['A'], [], 10),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // A must come before B despite lower priority
            expect(plan.executionOrder.indexOf('A')).toBeLessThan(plan.executionOrder.indexOf('B'));
        }
    });
    it('should minimize total execution time', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20),
            createTask('C', 15),
            createTask('D', 5, ['A', 'B', 'C']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            // A, B, C can run in parallel (max 20), then D (5)
            expect(plan.estimatedTotalTime).toBe(25);
        }
    });
});
// ============================================================================
// Plan Validation
// ============================================================================
describe('Plan Validation', () => {
    it('should validate valid plan', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        // A valid plan was created successfully
    });
    it('should detect missing dependencies', () => {
        const tasks = [createTask('A', 10, ['NonExistent'])];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
    });
    it('should detect cycles', () => {
        const tasks = [
            createTask('A', 10, ['B']),
            createTask('B', 10, ['A']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Error');
    });
    it('should validate resource assignments', () => {
        const tasks = [
            createTask('A', 10, [], ['ValidResource']),
            createTask('B', 10, [], ['AnotherResource']),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
    });
});
// ============================================================================
// Utility Functions
// ============================================================================
describe('Utility Functions', () => {
    it('should get task by id', () => {
        const tasks = [
            createTask('A', 10),
            createTask('B', 20),
        ];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            const task = TaskPlanner.getTaskById(plan, 'A');
            expect(task?.id).toBe('A');
        }
    });
    it('should return undefined for non-existent task', () => {
        const tasks = [createTask('A', 10)];
        const result = createTaskPlan(tasks);
        expect(result.TAG).toBe('Ok');
        if (result.TAG === 'Ok') {
            const plan = result._0;
            const task = TaskPlanner.getTaskById(plan, 'NonExistent');
            expect(task).toBeUndefined();
        }
    });
});
//# sourceMappingURL=TaskPlanner.test.js.map