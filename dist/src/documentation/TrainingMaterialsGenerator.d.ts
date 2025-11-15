/**
 * Training Materials Generator
 * Sprint 6 Day 58: Generate training materials and tutorials
 */
import { EventEmitter } from 'events';
/**
 * Training module
 */
export interface TrainingModule {
    id: string;
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedTime: number;
    prerequisites?: string[];
    learningObjectives: string[];
    lessons: Lesson[];
}
/**
 * Lesson
 */
export interface Lesson {
    id: string;
    title: string;
    content: string;
    type: 'concept' | 'tutorial' | 'exercise' | 'quiz';
    codeExamples?: CodeExample[];
    exercises?: Exercise[];
    quiz?: QuizQuestion[];
}
/**
 * Code example
 */
export interface CodeExample {
    title: string;
    language: string;
    code: string;
    explanation: string;
    output?: string;
}
/**
 * Exercise
 */
export interface Exercise {
    id: string;
    title: string;
    description: string;
    startingCode?: string;
    solution?: string;
    hints?: string[];
    testCases?: TestCase[];
}
/**
 * Test case
 */
export interface TestCase {
    input: unknown;
    expectedOutput: unknown;
    description: string;
}
/**
 * Quiz question
 */
export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
}
/**
 * Training progress
 */
export interface TrainingProgress {
    moduleId: string;
    currentLesson: number;
    completedLessons: string[];
    score: number;
    startTime: number;
    lastUpdated: number;
    completed: boolean;
}
/**
 * Training Materials Generator
 */
export declare class TrainingMaterialsGenerator extends EventEmitter {
    private modules;
    private progress;
    private moduleCounter;
    constructor();
    /**
     * Register default training modules
     */
    private registerDefaultModules;
    /**
     * Register training module
     */
    registerModule(module: TrainingModule): void;
    /**
     * Start training module
     */
    startModule(moduleId: string): TrainingProgress;
    /**
     * Complete current lesson
     */
    completeLesson(moduleId: string, score?: number): boolean;
    /**
     * Get module
     */
    getModule(moduleId: string): TrainingModule | undefined;
    /**
     * Get all modules
     */
    getAllModules(): TrainingModule[];
    /**
     * Get modules by difficulty
     */
    getModulesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): TrainingModule[];
    /**
     * Get progress
     */
    getProgress(moduleId: string): TrainingProgress | undefined;
    /**
     * Get current lesson
     */
    getCurrentLesson(moduleId: string): Lesson | undefined;
    /**
     * Reset module progress
     */
    resetProgress(moduleId: string): void;
    /**
     * Clear all progress
     */
    clearAllProgress(): void;
}
/**
 * Create training materials generator
 */
export declare function createTrainingMaterialsGenerator(): TrainingMaterialsGenerator;
/**
 * Get global training materials generator
 */
export declare function getGlobalTrainingMaterialsGenerator(): TrainingMaterialsGenerator;
/**
 * Reset global training materials generator
 */
export declare function resetGlobalTrainingMaterialsGenerator(): void;
//# sourceMappingURL=TrainingMaterialsGenerator.d.ts.map