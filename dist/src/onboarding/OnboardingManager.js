/**
 * Onboarding Manager
 * Sprint 6 Day 57: First-time user onboarding with step-by-step tutorials
 */
import { EventEmitter } from 'events';
/**
 * Onboarding Manager
 */
export class OnboardingManager extends EventEmitter {
    flows = new Map();
    progress = new Map();
    flowCounter = 0;
    constructor() {
        super();
        this.registerBuiltInFlows();
    }
    /**
     * Register built-in onboarding flows
     */
    registerBuiltInFlows() {
        // Quick Start Flow
        this.registerFlow({
            id: 'quick-start',
            name: 'Quick Start Guide',
            description: 'Get started with AutomatosX in 5 minutes',
            targetAudience: 'New users',
            estimatedDuration: 5,
            steps: [
                {
                    id: 'welcome',
                    title: 'Welcome to AutomatosX',
                    description: 'Introduction to code intelligence and search capabilities',
                    instructions: [
                        'AutomatosX is a code intelligence engine',
                        'It indexes your codebase for fast symbol and full-text search',
                        'It supports TypeScript, JavaScript, Python, Go, Rust, and more',
                    ],
                    examples: [
                        'Find functions: ax find "getUserById"',
                        'Natural language: ax find "authentication logic"',
                        'Symbol lookup: ax def "calculateTotal"',
                    ],
                    estimatedDuration: 60,
                },
                {
                    id: 'index-codebase',
                    title: 'Index Your Codebase',
                    description: 'Create searchable index of your code',
                    instructions: [
                        'Navigate to your project directory',
                        'Run the indexing command',
                        'Wait for indexing to complete',
                    ],
                    command: 'ax index ./src',
                    estimatedDuration: 120,
                },
                {
                    id: 'first-search',
                    title: 'Perform Your First Search',
                    description: 'Search for symbols and code patterns',
                    instructions: [
                        'Try searching for a function name',
                        'Use filters to narrow results',
                        'View symbol definitions',
                    ],
                    command: 'ax find "function" --kind function --lang ts',
                    estimatedDuration: 90,
                },
                {
                    id: 'explore-features',
                    title: 'Explore Advanced Features',
                    description: 'Learn about call graphs, flow analysis, and plugins',
                    instructions: [
                        'View call graphs: ax flow <function>',
                        'Check index status: ax status',
                        'Browse plugins: ax marketplace search',
                    ],
                    examples: [
                        'ax flow "handleRequest"',
                        'ax status --verbose',
                        'ax marketplace search "linter"',
                    ],
                    optional: true,
                    estimatedDuration: 120,
                },
            ],
        });
        // Advanced Search Flow
        this.registerFlow({
            id: 'advanced-search',
            name: 'Advanced Search Techniques',
            description: 'Master multi-modal search and filtering',
            targetAudience: 'Intermediate users',
            prerequisites: ['quick-start'],
            estimatedDuration: 10,
            steps: [
                {
                    id: 'symbol-search',
                    title: 'Symbol Search',
                    description: 'Search for function, class, and variable definitions',
                    instructions: [
                        'Use exact symbol names for precise results',
                        'Filter by symbol kind (function, class, variable)',
                        'Filter by language',
                    ],
                    examples: [
                        'ax find "getUserById" --kind function',
                        'ax find "UserService" --kind class --lang ts',
                        'ax def "API_KEY"',
                    ],
                    estimatedDuration: 120,
                },
                {
                    id: 'natural-language',
                    title: 'Natural Language Search',
                    description: 'Search using plain English descriptions',
                    instructions: [
                        'Describe what you\'re looking for',
                        'Use action verbs (parse, validate, handle, etc.)',
                        'Include domain terms',
                    ],
                    examples: [
                        'ax find "parse JSON configuration"',
                        'ax find "validate user input"',
                        'ax find "error handling middleware"',
                    ],
                    estimatedDuration: 120,
                },
                {
                    id: 'advanced-filters',
                    title: 'Advanced Filters',
                    description: 'Combine multiple filters for precise results',
                    instructions: [
                        'Use lang: filter for language',
                        'Use kind: filter for symbol type',
                        'Use file: filter for file paths',
                        'Combine multiple filters',
                    ],
                    examples: [
                        'ax find "database" --lang ts --file src/services/',
                        'ax find "cache" --kind function --lang ts',
                        'ax find "config" --file src/ --kind interface',
                    ],
                    estimatedDuration: 180,
                },
            ],
        });
        // Plugin Development Flow
        this.registerFlow({
            id: 'plugin-development',
            name: 'Plugin Development Guide',
            description: 'Learn to create and publish AutomatosX plugins',
            targetAudience: 'Plugin developers',
            prerequisites: ['quick-start'],
            estimatedDuration: 20,
            steps: [
                {
                    id: 'plugin-template',
                    title: 'Generate Plugin Template',
                    description: 'Create plugin scaffold from template',
                    instructions: [
                        'Choose plugin category',
                        'Select template type',
                        'Customize plugin metadata',
                    ],
                    command: 'ax plugin template create --category linter --name my-linter',
                    estimatedDuration: 180,
                },
                {
                    id: 'implement-plugin',
                    title: 'Implement Plugin Logic',
                    description: 'Write plugin code and tests',
                    instructions: [
                        'Implement plugin interface',
                        'Add configuration options',
                        'Write comprehensive tests',
                        'Document usage and API',
                    ],
                    examples: [
                        'See: plugins/examples/sample-linter.ts',
                        'Test: npm test -- plugins/my-linter',
                    ],
                    estimatedDuration: 600,
                },
                {
                    id: 'publish-plugin',
                    title: 'Publish to Marketplace',
                    description: 'Submit plugin for community use',
                    instructions: [
                        'Test plugin thoroughly',
                        'Write comprehensive README',
                        'Submit to marketplace',
                        'Respond to moderation feedback',
                    ],
                    command: 'ax plugin publish ./plugins/my-linter',
                    estimatedDuration: 300,
                },
            ],
        });
    }
    /**
     * Register onboarding flow
     */
    registerFlow(flow) {
        const flowId = flow.id || `flow-${++this.flowCounter}`;
        // Calculate total duration if not provided
        if (!flow.estimatedDuration) {
            const totalSeconds = flow.steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
            flow.estimatedDuration = Math.ceil(totalSeconds / 60);
        }
        this.flows.set(flowId, { ...flow, id: flowId });
        this.emit('flow-registered', {
            flowId,
            name: flow.name,
            stepsCount: flow.steps.length,
        });
    }
    /**
     * Start onboarding flow
     */
    startFlow(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow) {
            throw new Error(`Flow not found: ${flowId}`);
        }
        const progress = {
            flowId,
            currentStep: 0,
            completedSteps: [],
            skippedSteps: [],
            startTime: Date.now(),
            lastUpdated: Date.now(),
            completed: false,
        };
        this.progress.set(flowId, progress);
        this.emit('flow-started', {
            flowId,
            name: flow.name,
            stepsCount: flow.steps.length,
        });
        return progress;
    }
    /**
     * Complete current step
     */
    async completeStep(flowId) {
        const progress = this.progress.get(flowId);
        const flow = this.flows.get(flowId);
        if (!progress || !flow) {
            return false;
        }
        const currentStep = flow.steps[progress.currentStep];
        // Validate step if validation function provided
        if (currentStep.validation) {
            const valid = await currentStep.validation();
            if (!valid) {
                this.emit('step-validation-failed', {
                    flowId,
                    stepId: currentStep.id,
                });
                return false;
            }
        }
        progress.completedSteps.push(currentStep.id);
        progress.currentStep++;
        progress.lastUpdated = Date.now();
        // Check if flow is complete
        if (progress.currentStep >= flow.steps.length) {
            progress.completed = true;
            this.emit('flow-completed', {
                flowId,
                duration: Date.now() - progress.startTime,
                stepsCompleted: progress.completedSteps.length,
            });
        }
        else {
            this.emit('step-completed', {
                flowId,
                stepId: currentStep.id,
                nextStep: flow.steps[progress.currentStep].id,
            });
        }
        return true;
    }
    /**
     * Skip current step
     */
    skipStep(flowId) {
        const progress = this.progress.get(flowId);
        const flow = this.flows.get(flowId);
        if (!progress || !flow) {
            return false;
        }
        const currentStep = flow.steps[progress.currentStep];
        if (!currentStep.optional) {
            this.emit('step-skip-denied', {
                flowId,
                stepId: currentStep.id,
                reason: 'Step is required',
            });
            return false;
        }
        progress.skippedSteps.push(currentStep.id);
        progress.currentStep++;
        progress.lastUpdated = Date.now();
        this.emit('step-skipped', {
            flowId,
            stepId: currentStep.id,
        });
        return true;
    }
    /**
     * Get flow by ID
     */
    getFlow(flowId) {
        return this.flows.get(flowId);
    }
    /**
     * Get all flows
     */
    getAllFlows() {
        return Array.from(this.flows.values());
    }
    /**
     * Get flows by target audience
     */
    getFlowsByAudience(audience) {
        return Array.from(this.flows.values()).filter((f) => f.targetAudience === audience);
    }
    /**
     * Get progress
     */
    getProgress(flowId) {
        return this.progress.get(flowId);
    }
    /**
     * Get current step
     */
    getCurrentStep(flowId) {
        const progress = this.progress.get(flowId);
        const flow = this.flows.get(flowId);
        if (!progress || !flow) {
            return undefined;
        }
        return flow.steps[progress.currentStep];
    }
    /**
     * Get onboarding statistics
     */
    getStats() {
        const allProgress = Array.from(this.progress.values());
        const completedFlows = allProgress.filter((p) => p.completed).length;
        const inProgressFlows = allProgress.length - completedFlows;
        const completedTimes = allProgress
            .filter((p) => p.completed)
            .map((p) => p.lastUpdated - p.startTime);
        const averageCompletionTime = completedTimes.length > 0 ? completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length : 0;
        const totalStepsCompleted = allProgress.reduce((sum, p) => sum + p.completedSteps.length, 0);
        return {
            totalFlows: this.flows.size,
            completedFlows,
            inProgressFlows,
            totalStepsCompleted,
            averageCompletionTime,
        };
    }
    /**
     * Reset flow progress
     */
    resetProgress(flowId) {
        this.progress.delete(flowId);
        this.emit('progress-reset', { flowId });
    }
    /**
     * Clear all progress
     */
    clearAllProgress() {
        this.progress.clear();
        this.emit('all-progress-cleared');
    }
}
/**
 * Create onboarding manager
 */
export function createOnboardingManager() {
    return new OnboardingManager();
}
/**
 * Global onboarding manager
 */
let globalManager = null;
/**
 * Get global onboarding manager
 */
export function getGlobalOnboardingManager() {
    if (!globalManager) {
        globalManager = createOnboardingManager();
    }
    return globalManager;
}
/**
 * Reset global onboarding manager
 */
export function resetGlobalOnboardingManager() {
    globalManager = null;
}
//# sourceMappingURL=OnboardingManager.js.map