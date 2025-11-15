/**
 * Tutorial Runner
 * Sprint 5 Day 48: Interactive tutorial system for onboarding
 */
import { EventEmitter } from 'events';
/**
 * Tutorial runner
 */
export class TutorialRunner extends EventEmitter {
    tutorials = new Map();
    progress = new Map();
    activeTutorial = null;
    /**
     * Register a tutorial
     */
    register(tutorial) {
        this.tutorials.set(tutorial.id, tutorial);
        this.emit('tutorial-registered', { tutorialId: tutorial.id });
    }
    /**
     * Unregister a tutorial
     */
    unregister(tutorialId) {
        const removed = this.tutorials.delete(tutorialId);
        if (removed) {
            this.emit('tutorial-unregistered', { tutorialId });
        }
        return removed;
    }
    /**
     * List all tutorials
     */
    listTutorials() {
        return Array.from(this.tutorials.values());
    }
    /**
     * Get tutorial by ID
     */
    getTutorial(tutorialId) {
        return this.tutorials.get(tutorialId);
    }
    /**
     * Start a tutorial
     */
    async startTutorial(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        if (!tutorial) {
            throw new Error(`Tutorial "${tutorialId}" not found`);
        }
        if (this.activeTutorial) {
            throw new Error(`Already running tutorial "${this.activeTutorial}". Please complete or stop it first.`);
        }
        const progress = {
            tutorialId,
            currentStep: 0,
            completedSteps: [],
            startTime: Date.now(),
            lastActivityTime: Date.now(),
            completed: false,
        };
        this.progress.set(tutorialId, progress);
        this.activeTutorial = tutorialId;
        this.emit('tutorial-started', { tutorialId, tutorial });
        return progress;
    }
    /**
     * Get current step
     */
    getCurrentStep(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        const progress = this.progress.get(tutorialId);
        if (!tutorial || !progress)
            return null;
        return tutorial.steps[progress.currentStep] || null;
    }
    /**
     * Complete current step
     */
    async completeStep(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        const progress = this.progress.get(tutorialId);
        if (!tutorial || !progress) {
            throw new Error(`Tutorial "${tutorialId}" not found or not started`);
        }
        const currentStep = tutorial.steps[progress.currentStep];
        if (!currentStep) {
            throw new Error('No current step');
        }
        // Run validation if specified
        if (currentStep.validation) {
            try {
                const valid = await currentStep.validation();
                if (!valid) {
                    this.emit('step-validation-failed', {
                        tutorialId,
                        stepId: currentStep.id,
                    });
                    return false;
                }
            }
            catch (error) {
                this.emit('step-validation-error', {
                    tutorialId,
                    stepId: currentStep.id,
                    error,
                });
                return false;
            }
        }
        // Mark step as completed
        progress.completedSteps.push(currentStep.id);
        progress.lastActivityTime = Date.now();
        this.emit('step-completed', {
            tutorialId,
            stepId: currentStep.id,
            stepNumber: progress.currentStep + 1,
            totalSteps: tutorial.steps.length,
        });
        // Move to next step
        progress.currentStep++;
        // Check if tutorial is completed
        if (progress.currentStep >= tutorial.steps.length) {
            progress.completed = true;
            this.activeTutorial = null;
            const result = {
                tutorialId,
                completed: true,
                duration: Date.now() - progress.startTime,
                stepsCompleted: progress.completedSteps.length,
                totalSteps: tutorial.steps.length,
                startTime: progress.startTime,
                endTime: Date.now(),
            };
            this.emit('tutorial-completed', result);
        }
        return true;
    }
    /**
     * Skip current step
     */
    skipStep(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        const progress = this.progress.get(tutorialId);
        if (!tutorial || !progress) {
            throw new Error(`Tutorial "${tutorialId}" not found or not started`);
        }
        const currentStep = tutorial.steps[progress.currentStep];
        if (!currentStep) {
            throw new Error('No current step');
        }
        progress.currentStep++;
        progress.lastActivityTime = Date.now();
        this.emit('step-skipped', {
            tutorialId,
            stepId: currentStep.id,
        });
        // Check if tutorial is completed
        if (progress.currentStep >= tutorial.steps.length) {
            progress.completed = true;
            this.activeTutorial = null;
            const result = {
                tutorialId,
                completed: false, // Not fully completed if steps skipped
                duration: Date.now() - progress.startTime,
                stepsCompleted: progress.completedSteps.length,
                totalSteps: tutorial.steps.length,
                startTime: progress.startTime,
                endTime: Date.now(),
            };
            this.emit('tutorial-completed', result);
        }
    }
    /**
     * Stop current tutorial
     */
    stopTutorial(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        const progress = this.progress.get(tutorialId);
        if (!tutorial || !progress) {
            throw new Error(`Tutorial "${tutorialId}" not found or not started`);
        }
        this.activeTutorial = null;
        const result = {
            tutorialId,
            completed: false,
            duration: Date.now() - progress.startTime,
            stepsCompleted: progress.completedSteps.length,
            totalSteps: tutorial.steps.length,
            startTime: progress.startTime,
            endTime: Date.now(),
        };
        this.emit('tutorial-stopped', result);
        return result;
    }
    /**
     * Get progress for tutorial
     */
    getProgress(tutorialId) {
        return this.progress.get(tutorialId);
    }
    /**
     * Get all progress records
     */
    getAllProgress() {
        return Array.from(this.progress.values());
    }
    /**
     * Reset progress for tutorial
     */
    resetProgress(tutorialId) {
        this.progress.delete(tutorialId);
        if (this.activeTutorial === tutorialId) {
            this.activeTutorial = null;
        }
        this.emit('progress-reset', { tutorialId });
    }
    /**
     * Get active tutorial
     */
    getActiveTutorial() {
        if (!this.activeTutorial)
            return null;
        return this.tutorials.get(this.activeTutorial) || null;
    }
    /**
     * Check if a tutorial is running
     */
    isRunning(tutorialId) {
        if (tutorialId) {
            return this.activeTutorial === tutorialId;
        }
        return this.activeTutorial !== null;
    }
    /**
     * Load tutorials from directory
     */
    loadFromDirectory(directoryPath) {
        // Implementation would scan directory for tutorial JSON files
        // For MVP, we'll just emit an event
        this.emit('tutorials-loaded', { directoryPath });
        return this.tutorials.size;
    }
    /**
     * Get tutorial statistics
     */
    getStatistics() {
        const progressRecords = this.getAllProgress();
        const completed = progressRecords.filter((p) => p.completed);
        const inProgress = progressRecords.filter((p) => !p.completed);
        const totalTime = completed.reduce((sum, p) => {
            return sum + (Date.now() - p.startTime);
        }, 0);
        return {
            totalTutorials: this.tutorials.size,
            completedTutorials: completed.length,
            inProgressTutorials: inProgress.length,
            averageCompletionTime: completed.length > 0 ? totalTime / completed.length : 0,
        };
    }
}
/**
 * Create tutorial runner
 */
export function createTutorialRunner() {
    return new TutorialRunner();
}
/**
 * Global tutorial runner
 */
let globalRunner = null;
/**
 * Get global tutorial runner
 */
export function getGlobalRunner() {
    if (!globalRunner) {
        globalRunner = createTutorialRunner();
    }
    return globalRunner;
}
/**
 * Reset global tutorial runner
 */
export function resetGlobalRunner() {
    globalRunner = null;
}
//# sourceMappingURL=TutorialRunner.js.map