/**
 * Tutorial Runner
 * Sprint 5 Day 48: Interactive tutorial system for onboarding
 */
import { EventEmitter } from 'events';
/**
 * Tutorial step
 */
export interface TutorialStep {
    id: string;
    title: string;
    description: string;
    instructions: string;
    expectedAction?: string;
    validation?: () => Promise<boolean>;
    code?: string;
}
/**
 * Tutorial metadata
 */
export interface Tutorial {
    id: string;
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number;
    tags: string[];
    steps: TutorialStep[];
}
/**
 * Tutorial progress
 */
export interface TutorialProgress {
    tutorialId: string;
    currentStep: number;
    completedSteps: string[];
    startTime: number;
    lastActivityTime: number;
    completed: boolean;
}
/**
 * Tutorial completion result
 */
export interface TutorialResult {
    tutorialId: string;
    completed: boolean;
    duration: number;
    stepsCompleted: number;
    totalSteps: number;
    startTime: number;
    endTime: number;
}
/**
 * Tutorial runner
 */
export declare class TutorialRunner extends EventEmitter {
    private tutorials;
    private progress;
    private activeTutorial;
    /**
     * Register a tutorial
     */
    register(tutorial: Tutorial): void;
    /**
     * Unregister a tutorial
     */
    unregister(tutorialId: string): boolean;
    /**
     * List all tutorials
     */
    listTutorials(): Tutorial[];
    /**
     * Get tutorial by ID
     */
    getTutorial(tutorialId: string): Tutorial | undefined;
    /**
     * Start a tutorial
     */
    startTutorial(tutorialId: string): Promise<TutorialProgress>;
    /**
     * Get current step
     */
    getCurrentStep(tutorialId: string): TutorialStep | null;
    /**
     * Complete current step
     */
    completeStep(tutorialId: string): Promise<boolean>;
    /**
     * Skip current step
     */
    skipStep(tutorialId: string): void;
    /**
     * Stop current tutorial
     */
    stopTutorial(tutorialId: string): TutorialResult;
    /**
     * Get progress for tutorial
     */
    getProgress(tutorialId: string): TutorialProgress | undefined;
    /**
     * Get all progress records
     */
    getAllProgress(): TutorialProgress[];
    /**
     * Reset progress for tutorial
     */
    resetProgress(tutorialId: string): void;
    /**
     * Get active tutorial
     */
    getActiveTutorial(): Tutorial | null;
    /**
     * Check if a tutorial is running
     */
    isRunning(tutorialId?: string): boolean;
    /**
     * Load tutorials from directory
     */
    loadFromDirectory(directoryPath: string): number;
    /**
     * Get tutorial statistics
     */
    getStatistics(): {
        totalTutorials: number;
        completedTutorials: number;
        inProgressTutorials: number;
        averageCompletionTime: number;
    };
}
/**
 * Create tutorial runner
 */
export declare function createTutorialRunner(): TutorialRunner;
/**
 * Get global tutorial runner
 */
export declare function getGlobalRunner(): TutorialRunner;
/**
 * Reset global tutorial runner
 */
export declare function resetGlobalRunner(): void;
//# sourceMappingURL=TutorialRunner.d.ts.map