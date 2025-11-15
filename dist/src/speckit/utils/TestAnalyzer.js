/**
 * Test Analyzer
 *
 * Week 3-4 Implementation - Day 5
 * Analyzes workflows to determine test requirements
 */
/**
 * Test Analyzer
 *
 * Analyzes workflow definitions to extract testable components,
 * identify dependencies, determine required mocks, and calculate coverage needs.
 */
export class TestAnalyzer {
    /**
     * Analyze workflow for test generation
     */
    analyze(workflow) {
        const steps = this.extractTestableSteps(workflow.steps);
        const phases = this.identifyPhases(workflow.steps);
        const dependencies = this.buildDependencyMap(workflow.steps);
        const requiredMocks = this.identifyRequiredMocks(steps);
        const coverageNeeds = this.calculateCoverageNeeds(workflow.steps);
        return {
            steps,
            phases,
            dependencies,
            requiredMocks,
            coverageNeeds,
        };
    }
    /**
     * Extract testable steps from workflow
     */
    extractTestableSteps(steps) {
        return steps.map(step => ({
            id: step.id,
            name: step.name,
            agent: step.agent,
            action: step.action,
            config: step.config || {},
            dependencies: step.dependsOn || [],
            hasSideEffects: this.detectSideEffects(step),
            requiresMocks: this.determineRequiredMocks(step),
            estimatedDuration: this.estimateStepDuration(step),
            retryConfig: step.retryConfig,
            timeout: step.timeout,
        }));
    }
    /**
     * Identify execution phases for integration tests
     */
    identifyPhases(steps) {
        const levels = this.topologicalSort(steps);
        const phases = [];
        levels.forEach((stepIds, index) => {
            const phaseSteps = steps.filter(s => stepIds.includes(s.id));
            const totalDuration = phaseSteps.reduce((sum, s) => sum + this.estimateStepDuration(s), 0);
            phases.push({
                number: index + 1,
                name: `Phase ${index + 1}`,
                steps: stepIds,
                canParallelize: stepIds.length > 1,
                estimatedDuration: stepIds.length > 1 ? totalDuration / stepIds.length : totalDuration,
            });
        });
        return phases;
    }
    /**
     * Topological sort to find execution levels
     */
    topologicalSort(steps) {
        const levels = [];
        const remaining = new Set(steps.map(s => s.id));
        const processed = new Set();
        while (remaining.size > 0) {
            const currentLevel = [];
            for (const stepId of remaining) {
                const step = steps.find(s => s.id === stepId);
                if (!step)
                    continue;
                const deps = step.dependsOn || [];
                const allDepsProcessed = deps.every(dep => processed.has(dep));
                if (allDepsProcessed) {
                    currentLevel.push(stepId);
                }
            }
            if (currentLevel.length === 0 && remaining.size > 0) {
                // Circular dependency detected - add remaining steps to avoid infinite loop
                currentLevel.push(...Array.from(remaining));
            }
            currentLevel.forEach(id => {
                remaining.delete(id);
                processed.add(id);
            });
            levels.push(currentLevel);
        }
        return levels;
    }
    /**
     * Build dependency map
     */
    buildDependencyMap(steps) {
        const depMap = new Map();
        for (const step of steps) {
            depMap.set(step.id, step.dependsOn || []);
        }
        return depMap;
    }
    /**
     * Identify required mocks for all steps
     */
    identifyRequiredMocks(steps) {
        const mocks = new Map();
        for (const step of steps) {
            // Agent mock
            if (!mocks.has(`agent:${step.agent}`)) {
                mocks.set(`agent:${step.agent}`, {
                    type: 'agent',
                    name: step.agent,
                    methods: ['execute', 'validate', 'cleanup'],
                });
            }
            // Provider mock (if step uses external providers)
            if (step.requiresMocks.includes('provider')) {
                if (!mocks.has('provider:default')) {
                    mocks.set('provider:default', {
                        type: 'provider',
                        name: 'ProviderRouter',
                        methods: ['request', 'stream', 'health'],
                    });
                }
            }
            // Database mock (if step has side effects)
            if (step.hasSideEffects && !mocks.has('database:default')) {
                mocks.set('database:default', {
                    type: 'database',
                    name: 'Database',
                    methods: ['query', 'execute', 'transaction'],
                });
            }
            // Filesystem mock (if step reads/writes files)
            if (step.requiresMocks.includes('filesystem')) {
                if (!mocks.has('filesystem:default')) {
                    mocks.set('filesystem:default', {
                        type: 'filesystem',
                        name: 'FileSystem',
                        methods: ['readFile', 'writeFile', 'exists'],
                    });
                }
            }
        }
        return Array.from(mocks.values());
    }
    /**
     * Calculate coverage requirements
     */
    calculateCoverageNeeds(steps) {
        const baseThreshold = 80;
        const stepCount = steps.length;
        // Adjust coverage based on workflow complexity
        const complexityFactor = Math.min(stepCount / 10, 1.2);
        const adjustedThreshold = Math.min(baseThreshold * complexityFactor, 95);
        return {
            statements: Math.round(adjustedThreshold),
            branches: Math.round(adjustedThreshold * 0.9),
            functions: Math.round(adjustedThreshold * 0.95),
            lines: Math.round(adjustedThreshold),
        };
    }
    /**
     * Detect if step has side effects
     */
    detectSideEffects(step) {
        const sideEffectActions = [
            'create',
            'update',
            'delete',
            'deploy',
            'execute',
            'run',
            'start',
            'stop',
            'write',
        ];
        return sideEffectActions.some(action => step.action.toLowerCase().includes(action));
    }
    /**
     * Determine required mocks for a step
     */
    determineRequiredMocks(step) {
        const mocks = [];
        // Always need agent mock
        mocks.push('agent');
        // Check if step uses providers
        if (step.action.includes('llm') ||
            step.action.includes('ai') ||
            step.action.includes('generate')) {
            mocks.push('provider');
        }
        // Check if step uses file system
        if (step.action.includes('read') ||
            step.action.includes('write') ||
            step.action.includes('file')) {
            mocks.push('filesystem');
        }
        // Check if step uses database
        if (step.action.includes('query') ||
            step.action.includes('store') ||
            step.action.includes('persist')) {
            mocks.push('database');
        }
        return mocks;
    }
    /**
     * Estimate step duration in milliseconds
     */
    estimateStepDuration(step) {
        if (step.timeout) {
            return step.timeout;
        }
        const baseTime = 5000; // 5 seconds baseline
        const agentMultipliers = {
            security: 3.0,
            quality: 2.5,
            testing: 2.0,
            backend: 1.5,
            frontend: 1.5,
            devops: 2.0,
            architecture: 1.8,
            performance: 2.2,
        };
        const multiplier = agentMultipliers[step.agent.toLowerCase()] || 1.0;
        return Math.round(baseTime * multiplier);
    }
}
//# sourceMappingURL=TestAnalyzer.js.map