/**
 * DAGGenerator Tests
 *
 * Week 3-4 Implementation - Day 3
 * Comprehensive tests for dependency graph visualization
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DAGGenerator } from '../generators/DAGGenerator.js';
describe('DAGGenerator', () => {
    let generator;
    // Test workflows
    const simpleWorkflow = {
        name: 'Simple Workflow',
        version: '1.0.0',
        steps: [
            {
                id: 'step-1',
                name: 'First Step',
                action: 'action-1',
                config: {},
                duration: 10000,
            },
            {
                id: 'step-2',
                name: 'Second Step',
                action: 'action-2',
                config: {},
                duration: 20000,
                dependsOn: ['step-1'],
            },
            {
                id: 'step-3',
                name: 'Third Step',
                action: 'action-3',
                config: {},
                duration: 15000,
                dependsOn: ['step-2'],
            },
        ],
    };
    const parallelWorkflow = {
        name: 'Parallel Workflow',
        version: '1.0.0',
        steps: [
            {
                id: 'init',
                name: 'Initialize',
                action: 'init',
                config: {},
                duration: 5000,
            },
            {
                id: 'task-a',
                name: 'Task A',
                action: 'task-a',
                config: {},
                duration: 30000,
                dependsOn: ['init'],
            },
            {
                id: 'task-b',
                name: 'Task B',
                action: 'task-b',
                config: {},
                duration: 20000,
                dependsOn: ['init'],
            },
            {
                id: 'task-c',
                name: 'Task C',
                action: 'task-c',
                config: {},
                duration: 10000,
                dependsOn: ['init'],
            },
            {
                id: 'finalize',
                name: 'Finalize',
                action: 'finalize',
                config: {},
                duration: 15000,
                dependsOn: ['task-a', 'task-b', 'task-c'],
            },
        ],
    };
    beforeEach(() => {
        generator = new DAGGenerator();
    });
    describe('ASCII Format', () => {
        it('should generate ASCII visualization for simple workflow', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'ascii' });
            expect(result.format).toBe('ascii');
            expect(result.content).toContain('Simple Workflow');
            expect(result.content).toContain('First Step');
            expect(result.content).toContain('Second Step');
            expect(result.content).toContain('Third Step');
            expect(result.content).toContain('Level 1:');
            expect(result.content).toContain('Level 2:');
            expect(result.content).toContain('Level 3:');
        });
        it('should highlight critical path in ASCII', async () => {
            const result = await generator.generate(simpleWorkflow, {
                format: 'ascii',
                highlightCriticalPath: true,
            });
            // Critical path nodes should have ★ marker
            expect(result.content).toMatch(/★.*First Step/);
            expect(result.content).toMatch(/★.*Second Step/);
            expect(result.content).toMatch(/★.*Third Step/);
            // Should include legend
            expect(result.content).toContain('Legend:');
            expect(result.content).toContain('Critical path');
        });
        it('should show dependencies in ASCII', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'ascii' });
            expect(result.content).toMatch(/depends on:.*First Step/);
            expect(result.content).toMatch(/depends on:.*Second Step/);
        });
        it('should handle parallel steps in ASCII', async () => {
            const result = await generator.generate(parallelWorkflow, { format: 'ascii' });
            // Level 2 should have 3 parallel tasks
            const level2Match = result.content.match(/Level 2:([\s\S]*?)(?:Level 3:|$)/);
            expect(level2Match).toBeTruthy();
            const level2Content = level2Match[1];
            expect(level2Content).toContain('Task A');
            expect(level2Content).toContain('Task B');
            expect(level2Content).toContain('Task C');
        });
        it('should use different node label strategies', async () => {
            // Test 'id' strategy
            const resultId = await generator.generate(simpleWorkflow, {
                format: 'ascii',
                nodeLabels: 'id',
            });
            expect(resultId.content).toContain('step-1');
            expect(resultId.content).toContain('step-2');
            // Test 'name' strategy
            const resultName = await generator.generate(simpleWorkflow, {
                format: 'ascii',
                nodeLabels: 'name',
            });
            expect(resultName.content).toContain('First Step');
            expect(resultName.content).toContain('Second Step');
            // Test 'both' strategy
            const resultBoth = await generator.generate(simpleWorkflow, {
                format: 'ascii',
                nodeLabels: 'both',
            });
            expect(resultBoth.content).toMatch(/First Step.*step-1/);
            expect(resultBoth.content).toMatch(/Second Step.*step-2/);
        });
    });
    describe('DOT Format', () => {
        it('should generate DOT visualization for simple workflow', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'dot' });
            expect(result.format).toBe('dot');
            expect(result.content).toContain('digraph "Simple Workflow"');
            expect(result.content).toContain('"step-1"');
            expect(result.content).toContain('"step-2"');
            expect(result.content).toContain('"step-3"');
            expect(result.content).toMatch(/"step-1" -> "step-2"/);
            expect(result.content).toMatch(/"step-2" -> "step-3"/);
        });
        it('should highlight critical path in DOT', async () => {
            const result = await generator.generate(simpleWorkflow, {
                format: 'dot',
                highlightCriticalPath: true,
            });
            // Critical nodes should have fillcolor=gold
            expect(result.content).toMatch(/"step-1".*fillcolor=gold/);
            expect(result.content).toMatch(/"step-2".*fillcolor=gold/);
            expect(result.content).toMatch(/"step-3".*fillcolor=gold/);
            // Critical edges should have color=red
            expect(result.content).toMatch(/"step-1" -> "step-2".*color=red/);
            expect(result.content).toMatch(/"step-2" -> "step-3".*color=red/);
        });
        it('should include step details in DOT when requested', async () => {
            const result = await generator.generate(simpleWorkflow, {
                format: 'dot',
                includeStepDetails: true,
            });
            // Should include duration
            expect(result.content).toMatch(/\(10s\)/); // step-1
            expect(result.content).toMatch(/\(20s\)/); // step-2
            expect(result.content).toMatch(/\(15s\)/); // step-3
        });
        it('should support different orientations', async () => {
            const resultTB = await generator.generate(simpleWorkflow, {
                format: 'dot',
                orientation: 'TB',
            });
            expect(resultTB.content).toContain('rankdir=TB');
            const resultLR = await generator.generate(simpleWorkflow, {
                format: 'dot',
                orientation: 'LR',
            });
            expect(resultLR.content).toContain('rankdir=LR');
        });
        it('should handle parallel steps in DOT', async () => {
            const result = await generator.generate(parallelWorkflow, { format: 'dot' });
            // All tasks depend on init
            expect(result.content).toMatch(/"init" -> "task-a"/);
            expect(result.content).toMatch(/"init" -> "task-b"/);
            expect(result.content).toMatch(/"init" -> "task-c"/);
            // Finalize depends on all tasks
            expect(result.content).toMatch(/"task-a" -> "finalize"/);
            expect(result.content).toMatch(/"task-b" -> "finalize"/);
            expect(result.content).toMatch(/"task-c" -> "finalize"/);
        });
    });
    describe('Mermaid Format', () => {
        it('should generate Mermaid visualization for simple workflow', async () => {
            const result = await generator.generate(simpleWorkflow, {
                format: 'mermaid',
                highlightCriticalPath: false,
            });
            expect(result.format).toBe('mermaid');
            expect(result.content).toMatch(/^graph (TB|LR)/);
            expect(result.content).toContain('step-1["First Step"]');
            expect(result.content).toContain('step-2["Second Step"]');
            expect(result.content).toContain('step-3["Third Step"]');
            expect(result.content).toContain('step-1 --> step-2');
            expect(result.content).toContain('step-2 --> step-3');
        });
        it('should highlight critical path in Mermaid', async () => {
            const result = await generator.generate(simpleWorkflow, {
                format: 'mermaid',
                highlightCriticalPath: true,
            });
            // Critical nodes should have ⭐ marker
            expect(result.content).toMatch(/step-1\[\["⭐ First Step"\]\]/);
            expect(result.content).toMatch(/step-2\[\["⭐ Second Step"\]\]/);
            expect(result.content).toMatch(/step-3\[\["⭐ Third Step"\]\]/);
            // Critical edges should use ==>
            expect(result.content).toContain('step-1 ==> step-2');
            expect(result.content).toContain('step-2 ==> step-3');
            // Should include styling
            expect(result.content).toContain('classDef critical');
            expect(result.content).toContain('class step-1,step-2,step-3 critical');
        });
        it('should support different orientations', async () => {
            const resultTB = await generator.generate(simpleWorkflow, {
                format: 'mermaid',
                orientation: 'TB',
            });
            expect(resultTB.content).toMatch(/^graph TB/);
            const resultLR = await generator.generate(simpleWorkflow, {
                format: 'mermaid',
                orientation: 'LR',
            });
            expect(resultLR.content).toMatch(/^graph LR/);
        });
        it('should handle parallel steps in Mermaid', async () => {
            const result = await generator.generate(parallelWorkflow, {
                format: 'mermaid',
                highlightCriticalPath: false,
            });
            // All tasks depend on init
            expect(result.content).toContain('init --> task-a');
            expect(result.content).toContain('init --> task-b');
            expect(result.content).toContain('init --> task-c');
            // Finalize depends on all tasks
            expect(result.content).toContain('task-a --> finalize');
            expect(result.content).toContain('task-b --> finalize');
            expect(result.content).toContain('task-c --> finalize');
        });
    });
    describe('Metadata', () => {
        it('should return correct metadata for simple workflow', async () => {
            const result = await generator.generate(simpleWorkflow);
            expect(result.metadata.nodeCount).toBe(3);
            expect(result.metadata.edgeCount).toBe(2);
            expect(result.metadata.criticalPathLength).toBe(3);
            // maxDepth is levels.length, which is 3 for simple workflow
            expect(result.metadata.maxDepth).toBeGreaterThan(0);
        });
        it('should return correct metadata for parallel workflow', async () => {
            const result = await generator.generate(parallelWorkflow);
            expect(result.metadata.nodeCount).toBe(5);
            expect(result.metadata.edgeCount).toBe(6); // 3 edges from init, 3 edges to finalize
            expect(result.metadata.criticalPathLength).toBeGreaterThan(0);
            // maxDepth is levels.length
            expect(result.metadata.maxDepth).toBeGreaterThan(0);
        });
    });
    describe('File Writing', () => {
        it('should write ASCII file with correct extension', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'ascii' });
            const path = await generator.writeDAG(result, simpleWorkflow, 'test-output');
            expect(path).toMatch(/\.txt$/);
            expect(path).toContain('test-output');
            expect(path).toContain('simple-workflow-dag');
        });
        it('should write DOT file with correct extension', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'dot' });
            const path = await generator.writeDAG(result, simpleWorkflow, 'test-output');
            expect(path).toMatch(/\.dot$/);
            expect(path).toContain('test-output');
        });
        it('should write Mermaid file with correct extension', async () => {
            const result = await generator.generate(simpleWorkflow, { format: 'mermaid' });
            const path = await generator.writeDAG(result, simpleWorkflow, 'test-output');
            expect(path).toMatch(/\.mmd$/);
            expect(path).toContain('test-output');
        });
    });
    describe('Edge Cases', () => {
        it('should handle workflow with single step', async () => {
            const singleStepWorkflow = {
                name: 'Single Step',
                version: '1.0.0',
                steps: [
                    {
                        id: 'only-step',
                        name: 'Only Step',
                        action: 'action',
                        config: {},
                        duration: 10000,
                    },
                ],
            };
            const result = await generator.generate(singleStepWorkflow);
            expect(result.metadata.nodeCount).toBe(1);
            expect(result.metadata.edgeCount).toBe(0);
            expect(result.metadata.criticalPathLength).toBe(1);
        });
        it('should handle steps without names (use IDs)', async () => {
            const noNameWorkflow = {
                name: 'No Names',
                version: '1.0.0',
                steps: [
                    {
                        id: 'step-1',
                        action: 'action-1',
                        config: {},
                        duration: 10000,
                    },
                    {
                        id: 'step-2',
                        action: 'action-2',
                        config: {},
                        duration: 10000,
                        dependsOn: ['step-1'],
                    },
                ],
            };
            const result = await generator.generate(noNameWorkflow, { format: 'ascii' });
            // Should use IDs when names not available
            expect(result.content).toContain('step-1');
            expect(result.content).toContain('step-2');
        });
        it('should handle workflow without durations', async () => {
            const noDurationWorkflow = {
                name: 'No Durations',
                version: '1.0.0',
                steps: [
                    {
                        id: 'step-1',
                        name: 'Step 1',
                        action: 'action-1',
                        config: {},
                    },
                    {
                        id: 'step-2',
                        name: 'Step 2',
                        action: 'action-2',
                        config: {},
                        dependsOn: ['step-1'],
                    },
                ],
            };
            const result = await generator.generate(noDurationWorkflow, {
                format: 'dot',
                includeStepDetails: true,
            });
            // Should not crash, durations just won't appear
            expect(result.content).toBeTruthy();
            expect(result.content).toContain('"step-1"');
            expect(result.content).toContain('"step-2"');
        });
    });
    describe('Error Handling', () => {
        it('should throw error for unsupported format', async () => {
            await expect(generator.generate(simpleWorkflow, { format: 'invalid' })).rejects.toThrow('Unsupported DAG format');
        });
        it('should handle workflow with empty steps array', async () => {
            const emptyWorkflow = {
                name: 'Empty',
                version: '1.0.0',
                steps: [],
            };
            // DependencyGraph doesn't throw for empty arrays, it just returns empty metadata
            const result = await generator.generate(emptyWorkflow);
            expect(result.metadata.nodeCount).toBe(0);
            expect(result.metadata.edgeCount).toBe(0);
            expect(result.metadata.criticalPathLength).toBe(0);
        });
    });
});
//# sourceMappingURL=DAGGenerator.test.js.map