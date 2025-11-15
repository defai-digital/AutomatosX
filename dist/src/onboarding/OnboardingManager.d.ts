/**
 * Onboarding Manager
 * Sprint 6 Day 57: First-time user onboarding with step-by-step tutorials
 */
import { EventEmitter } from 'events';
/**
 * Onboarding step
 */
export interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    instructions: string[];
    examples?: string[];
    command?: string;
    validation?: () => boolean | Promise<boolean>;
    optional?: boolean;
    estimatedDuration: number;
}
/**
 * Onboarding flow
 */
export interface OnboardingFlow {
    id: string;
    name: string;
    description: string;
    steps: OnboardingStep[];
    estimatedDuration: number;
    targetAudience: string;
    prerequisites?: string[];
}
/**
 * Onboarding progress
 */
export interface OnboardingProgress {
    flowId: string;
    currentStep: number;
    completedSteps: string[];
    skippedSteps: string[];
    startTime: number;
    lastUpdated: number;
    completed: boolean;
}
/**
 * Onboarding statistics
 */
export interface OnboardingStats {
    totalFlows: number;
    completedFlows: number;
    inProgressFlows: number;
    totalStepsCompleted: number;
    averageCompletionTime: number;
    mostPopularFlow?: string;
}
/**
 * Onboarding Manager
 */
export declare class OnboardingManager extends EventEmitter {
    private flows;
    private progress;
    private flowCounter;
    constructor();
    /**
     * Register built-in onboarding flows
     */
    private registerBuiltInFlows;
    /**
     * Register onboarding flow
     */
    registerFlow(flow: OnboardingFlow): void;
    /**
     * Start onboarding flow
     */
    startFlow(flowId: string): OnboardingProgress;
    /**
     * Complete current step
     */
    completeStep(flowId: string): Promise<boolean>;
    /**
     * Skip current step
     */
    skipStep(flowId: string): boolean;
    /**
     * Get flow by ID
     */
    getFlow(flowId: string): OnboardingFlow | undefined;
    /**
     * Get all flows
     */
    getAllFlows(): OnboardingFlow[];
    /**
     * Get flows by target audience
     */
    getFlowsByAudience(audience: string): OnboardingFlow[];
    /**
     * Get progress
     */
    getProgress(flowId: string): OnboardingProgress | undefined;
    /**
     * Get current step
     */
    getCurrentStep(flowId: string): OnboardingStep | undefined;
    /**
     * Get onboarding statistics
     */
    getStats(): OnboardingStats;
    /**
     * Reset flow progress
     */
    resetProgress(flowId: string): void;
    /**
     * Clear all progress
     */
    clearAllProgress(): void;
}
/**
 * Create onboarding manager
 */
export declare function createOnboardingManager(): OnboardingManager;
/**
 * Get global onboarding manager
 */
export declare function getGlobalOnboardingManager(): OnboardingManager;
/**
 * Reset global onboarding manager
 */
export declare function resetGlobalOnboardingManager(): void;
//# sourceMappingURL=OnboardingManager.d.ts.map