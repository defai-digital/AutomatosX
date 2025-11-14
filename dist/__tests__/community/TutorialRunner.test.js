/**
 * Tutorial Runner Tests
 * Sprint 5 Day 48: Tutorial system tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorialRunner, createTutorialRunner, getGlobalRunner, resetGlobalRunner, } from '../../community/TutorialRunner.js';
describe('TutorialRunner', () => {
    let runner;
    const sampleTutorial = {
        id: 'test-tutorial',
        title: 'Test Tutorial',
        description: 'A test tutorial',
        difficulty: 'beginner',
        estimatedTime: 10,
        tags: ['test', 'beginner'],
        steps: [
            {
                id: 'step1',
                title: 'Step 1',
                description: 'First step',
                instructions: 'Do this',
            },
            {
                id: 'step2',
                title: 'Step 2',
                description: 'Second step',
                instructions: 'Do that',
            },
        ],
    };
    beforeEach(() => {
        runner = createTutorialRunner();
    });
    describe('Registration', () => {
        it('should register a tutorial', () => {
            runner.register(sampleTutorial);
            expect(runner.getTutorial('test-tutorial')).toEqual(sampleTutorial);
        });
        it('should emit tutorial-registered event', () => {
            const listener = vi.fn();
            runner.on('tutorial-registered', listener);
            runner.register(sampleTutorial);
            expect(listener).toHaveBeenCalledWith({
                tutorialId: 'test-tutorial',
            });
        });
        it('should list all tutorials', () => {
            const tutorial2 = {
                ...sampleTutorial,
                id: 'tutorial2',
            };
            runner.register(sampleTutorial);
            runner.register(tutorial2);
            const tutorials = runner.listTutorials();
            expect(tutorials).toHaveLength(2);
            expect(tutorials[0].id).toBe('test-tutorial');
            expect(tutorials[1].id).toBe('tutorial2');
        });
        it('should unregister a tutorial', () => {
            runner.register(sampleTutorial);
            const removed = runner.unregister('test-tutorial');
            expect(removed).toBe(true);
            expect(runner.getTutorial('test-tutorial')).toBeUndefined();
        });
        it('should return false when unregistering non-existent tutorial', () => {
            const removed = runner.unregister('non-existent');
            expect(removed).toBe(false);
        });
    });
    describe('Starting Tutorials', () => {
        beforeEach(() => {
            runner.register(sampleTutorial);
        });
        it('should start a tutorial', async () => {
            const progress = await runner.startTutorial('test-tutorial');
            expect(progress).toMatchObject({
                tutorialId: 'test-tutorial',
                currentStep: 0,
                completedSteps: [],
                completed: false,
            });
            expect(progress.startTime).toBeGreaterThan(0);
        });
        it('should emit tutorial-started event', async () => {
            const listener = vi.fn();
            runner.on('tutorial-started', listener);
            await runner.startTutorial('test-tutorial');
            expect(listener).toHaveBeenCalledWith({
                tutorialId: 'test-tutorial',
                tutorial: sampleTutorial,
            });
        });
        it('should throw when starting non-existent tutorial', async () => {
            await expect(runner.startTutorial('non-existent')).rejects.toThrow('Tutorial "non-existent" not found');
        });
        it('should throw when starting tutorial while another is running', async () => {
            const tutorial2 = {
                ...sampleTutorial,
                id: 'tutorial2',
            };
            runner.register(tutorial2);
            await runner.startTutorial('test-tutorial');
            await expect(runner.startTutorial('tutorial2')).rejects.toThrow('Already running tutorial');
        });
        it('should mark tutorial as active', async () => {
            await runner.startTutorial('test-tutorial');
            expect(runner.isRunning('test-tutorial')).toBe(true);
            expect(runner.isRunning()).toBe(true);
        });
    });
    describe('Step Management', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
        });
        it('should get current step', () => {
            const step = runner.getCurrentStep('test-tutorial');
            expect(step).toMatchObject({
                id: 'step1',
                title: 'Step 1',
            });
        });
        it('should complete current step', async () => {
            const completed = await runner.completeStep('test-tutorial');
            expect(completed).toBe(true);
            const progress = runner.getProgress('test-tutorial');
            expect(progress?.completedSteps).toContain('step1');
            expect(progress?.currentStep).toBe(1);
        });
        it('should emit step-completed event', async () => {
            const listener = vi.fn();
            runner.on('step-completed', listener);
            await runner.completeStep('test-tutorial');
            expect(listener).toHaveBeenCalledWith({
                tutorialId: 'test-tutorial',
                stepId: 'step1',
                stepNumber: 1,
                totalSteps: 2,
            });
        });
        it('should validate step before completing', async () => {
            // Stop current tutorial first
            runner.stopTutorial('test-tutorial');
            const tutorial = {
                ...sampleTutorial,
                id: 'validation-tutorial',
                steps: [
                    {
                        id: 'step1',
                        title: 'Step 1',
                        description: 'Test',
                        instructions: 'Test',
                        validation: async () => false,
                    },
                ],
            };
            runner.register(tutorial);
            await runner.startTutorial('validation-tutorial');
            const completed = await runner.completeStep('validation-tutorial');
            expect(completed).toBe(false);
        });
        it('should emit step-validation-failed event', async () => {
            // Create new runner to avoid conflict
            const testRunner = createTutorialRunner();
            const tutorial = {
                ...sampleTutorial,
                id: 'validation-tutorial',
                steps: [
                    {
                        id: 'step1',
                        title: 'Step 1',
                        description: 'Test',
                        instructions: 'Test',
                        validation: async () => false,
                    },
                ],
            };
            testRunner.register(tutorial);
            await testRunner.startTutorial('validation-tutorial');
            const listener = vi.fn();
            testRunner.on('step-validation-failed', listener);
            await testRunner.completeStep('validation-tutorial');
            expect(listener).toHaveBeenCalled();
        });
        it('should skip current step', () => {
            runner.skipStep('test-tutorial');
            const progress = runner.getProgress('test-tutorial');
            expect(progress?.currentStep).toBe(1);
            expect(progress?.completedSteps).toHaveLength(0);
        });
        it('should emit step-skipped event', () => {
            const listener = vi.fn();
            runner.on('step-skipped', listener);
            runner.skipStep('test-tutorial');
            expect(listener).toHaveBeenCalledWith({
                tutorialId: 'test-tutorial',
                stepId: 'step1',
            });
        });
    });
    describe('Tutorial Completion', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
        });
        it('should complete tutorial after all steps', async () => {
            await runner.completeStep('test-tutorial');
            await runner.completeStep('test-tutorial');
            const progress = runner.getProgress('test-tutorial');
            expect(progress?.completed).toBe(true);
        });
        it('should emit tutorial-completed event', async () => {
            const listener = vi.fn();
            runner.on('tutorial-completed', listener);
            await runner.completeStep('test-tutorial');
            await runner.completeStep('test-tutorial');
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                tutorialId: 'test-tutorial',
                completed: true,
                stepsCompleted: 2,
                totalSteps: 2,
            }));
        });
        it('should mark completed if all steps skipped', () => {
            runner.skipStep('test-tutorial');
            runner.skipStep('test-tutorial');
            const progress = runner.getProgress('test-tutorial');
            expect(progress?.completed).toBe(true);
        });
        it('should not mark as fully completed if steps skipped', () => {
            const listener = vi.fn();
            runner.on('tutorial-completed', listener);
            runner.skipStep('test-tutorial');
            runner.skipStep('test-tutorial');
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                completed: false, // Not fully completed
                stepsCompleted: 0,
            }));
        });
    });
    describe('Stopping Tutorials', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
        });
        it('should stop tutorial', () => {
            const result = runner.stopTutorial('test-tutorial');
            expect(result).toMatchObject({
                tutorialId: 'test-tutorial',
                completed: false,
                stepsCompleted: 0,
                totalSteps: 2,
            });
        });
        it('should emit tutorial-stopped event', () => {
            const listener = vi.fn();
            runner.on('tutorial-stopped', listener);
            runner.stopTutorial('test-tutorial');
            expect(listener).toHaveBeenCalled();
        });
        it('should clear active tutorial', () => {
            runner.stopTutorial('test-tutorial');
            expect(runner.isRunning()).toBe(false);
        });
        it('should throw when stopping non-existent tutorial', () => {
            expect(() => runner.stopTutorial('non-existent')).toThrow();
        });
    });
    describe('Progress Management', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
        });
        it('should get progress', () => {
            const progress = runner.getProgress('test-tutorial');
            expect(progress).toMatchObject({
                tutorialId: 'test-tutorial',
                currentStep: 0,
                completedSteps: [],
            });
        });
        it('should get all progress', async () => {
            const tutorial2 = {
                ...sampleTutorial,
                id: 'tutorial2',
            };
            runner.register(tutorial2);
            runner.stopTutorial('test-tutorial');
            await runner.startTutorial('tutorial2');
            const allProgress = runner.getAllProgress();
            expect(allProgress).toHaveLength(2);
        });
        it('should reset progress', async () => {
            await runner.completeStep('test-tutorial');
            runner.resetProgress('test-tutorial');
            const progress = runner.getProgress('test-tutorial');
            expect(progress).toBeUndefined();
        });
        it('should emit progress-reset event', () => {
            const listener = vi.fn();
            runner.on('progress-reset', listener);
            runner.resetProgress('test-tutorial');
            expect(listener).toHaveBeenCalledWith({
                tutorialId: 'test-tutorial',
            });
        });
    });
    describe('Active Tutorial', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
        });
        it('should get active tutorial', () => {
            const active = runner.getActiveTutorial();
            expect(active?.id).toBe('test-tutorial');
        });
        it('should return null when no active tutorial', () => {
            runner.stopTutorial('test-tutorial');
            const active = runner.getActiveTutorial();
            expect(active).toBeNull();
        });
    });
    describe('Statistics', () => {
        beforeEach(async () => {
            runner.register(sampleTutorial);
            await runner.startTutorial('test-tutorial');
            await runner.completeStep('test-tutorial');
            await runner.completeStep('test-tutorial');
        });
        it('should get statistics', () => {
            const stats = runner.getStatistics();
            expect(stats).toMatchObject({
                totalTutorials: 1,
                completedTutorials: 1,
                inProgressTutorials: 0,
            });
            expect(stats.averageCompletionTime).toBeGreaterThanOrEqual(0);
        });
        it('should track multiple tutorial completions', async () => {
            const tutorial2 = {
                ...sampleTutorial,
                id: 'tutorial2',
            };
            runner.register(tutorial2);
            await runner.startTutorial('tutorial2');
            await runner.completeStep('tutorial2');
            await runner.completeStep('tutorial2');
            const stats = runner.getStatistics();
            expect(stats.totalTutorials).toBe(2);
            expect(stats.completedTutorials).toBe(2);
        });
    });
    describe('Global Runner', () => {
        beforeEach(() => {
            resetGlobalRunner();
        });
        it('should get global runner', () => {
            const globalRunner = getGlobalRunner();
            expect(globalRunner).toBeInstanceOf(TutorialRunner);
        });
        it('should return same instance', () => {
            const runner1 = getGlobalRunner();
            const runner2 = getGlobalRunner();
            expect(runner1).toBe(runner2);
        });
        it('should reset global runner', () => {
            const runner1 = getGlobalRunner();
            resetGlobalRunner();
            const runner2 = getGlobalRunner();
            expect(runner2).not.toBe(runner1);
        });
    });
    describe('Edge Cases', () => {
        it('should handle loading tutorials from directory', () => {
            const listener = vi.fn();
            runner.on('tutorials-loaded', listener);
            runner.loadFromDirectory('/path/to/tutorials');
            expect(listener).toHaveBeenCalledWith({
                directoryPath: '/path/to/tutorials',
            });
        });
        it('should return null for current step when tutorial not started', () => {
            runner.register(sampleTutorial);
            const step = runner.getCurrentStep('test-tutorial');
            expect(step).toBeNull();
        });
        it('should throw when completing step of non-existent tutorial', async () => {
            await expect(runner.completeStep('non-existent')).rejects.toThrow();
        });
        it('should throw when skipping step of non-existent tutorial', () => {
            expect(() => runner.skipStep('non-existent')).toThrow();
        });
    });
});
//# sourceMappingURL=TutorialRunner.test.js.map