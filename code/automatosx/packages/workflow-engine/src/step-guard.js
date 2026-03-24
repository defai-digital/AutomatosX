import { createStepGuardResult, createProgressEvent, getErrorMessage, } from '@defai.digital/contracts';
export const DEFAULT_STEP_GUARD_ENGINE_CONFIG = {
    enabled: true,
    defaultOnFail: 'warn',
};
export class StepGuardEngine {
    config;
    gateRegistry;
    policies = new Map();
    onProgressEvent;
    constructor(config = {}) {
        this.config = { ...DEFAULT_STEP_GUARD_ENGINE_CONFIG, ...config };
        this.gateRegistry = config.gateRegistry ?? createGateRegistry();
        this.onProgressEvent = config.onProgressEvent;
        this.registerDefaultGates();
    }
    registerPolicy(policy) {
        this.policies.set(policy.policyId, policy);
    }
    removePolicy(policyId) {
        return this.policies.delete(policyId);
    }
    getPolicies() {
        return Array.from(this.policies.values());
    }
    registerGate(gateId, check) {
        this.gateRegistry.register(gateId, check);
    }
    async runBeforeGuards(context) {
        return this.runGuards(context, 'before');
    }
    async runAfterGuards(context) {
        return this.runGuards(context, 'after');
    }
    shouldBlock(results) {
        return results.some((result) => result.blocked);
    }
    emitProgress(executionId, agentId, stageIndex, stageTotal, stageName, stageType, status, options = {}) {
        if (this.onProgressEvent) {
            const event = createProgressEvent(executionId, agentId, stageIndex, stageTotal, stageName, stageType, status, options);
            this.onProgressEvent(event);
        }
    }
    async runGuards(context, position) {
        if (!this.config.enabled) {
            return [];
        }
        const results = [];
        const applicablePolicies = this.getApplicablePolicies(context);
        applicablePolicies.sort((a, b) => b.priority - a.priority);
        for (const policy of applicablePolicies) {
            for (const guard of policy.guards) {
                if (!guard.enabled)
                    continue;
                if (guard.position !== position)
                    continue;
                if (!this.matchesStep(guard.stepId, context.stepId))
                    continue;
                results.push(await this.runGuard(guard, context));
            }
        }
        return results;
    }
    async runGuard(guard, context) {
        const startTime = Date.now();
        const gateResults = await Promise.all(guard.gates.map(async (gateId) => {
            const gateFn = this.gateRegistry.get(gateId);
            if (!gateFn) {
                return {
                    gateId,
                    status: 'WARN',
                    message: `Gate "${gateId}" not found`,
                };
            }
            try {
                return await gateFn(context);
            }
            catch (error) {
                return {
                    gateId,
                    status: 'FAIL',
                    message: getErrorMessage(error, 'Gate check failed'),
                };
            }
        }));
        const hasFailure = gateResults.some((gate) => gate.status === 'FAIL');
        const blocked = hasFailure && guard.onFail === 'block';
        const result = createStepGuardResult(guard.guardId, context.stepId, guard.position, gateResults, blocked);
        result.durationMs = Date.now() - startTime;
        return result;
    }
    getApplicablePolicies(context) {
        const applicable = [];
        for (const policy of this.policies.values()) {
            if (!policy.enabled)
                continue;
            if (!this.matchesPatterns(policy.agentPatterns, context.agentId))
                continue;
            if (policy.stepTypes && !policy.stepTypes.includes(context.stepType))
                continue;
            if (context.workflowId && !this.matchesPatterns(policy.workflowPatterns, context.workflowId))
                continue;
            applicable.push(policy);
        }
        return applicable;
    }
    matchesStep(pattern, stepId) {
        if (pattern === '*')
            return true;
        return this.globMatch(pattern, stepId);
    }
    matchesPatterns(patterns, value) {
        return patterns.some((pattern) => pattern === '*' || this.globMatch(pattern, value));
    }
    globMatch(pattern, value) {
        try {
            const regex = new RegExp(`^${pattern.split('*').map(this.escapeRegex).join('.*')}$`);
            return regex.test(value);
        }
        catch {
            console.warn(`[step-guard] Invalid glob pattern: "${pattern}"`);
            return false;
        }
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    registerDefaultGates() {
        this.gateRegistry.register('validation', async (context) => {
            const config = context.stepConfig;
            const errors = [];
            const warnings = [];
            if (config != null && Object.keys(config).length > 0) {
                switch (context.stepType) {
                    case 'prompt':
                        if (!config.prompt && !config.template) {
                            errors.push('Prompt step requires "prompt" or "template" in config');
                        }
                        break;
                    case 'tool':
                        if (!config.toolName && !config.tool) {
                            errors.push('Tool step requires "toolName" or "tool" in config');
                        }
                        break;
                    case 'conditional':
                        if (!config.condition && !config.when) {
                            errors.push('Conditional step requires "condition" or "when" in config');
                        }
                        break;
                    case 'loop':
                        if (!config.items && !config.count && !config.until) {
                            errors.push('Loop step requires "items", "count", or "until" in config');
                        }
                        break;
                    case 'parallel':
                        break;
                    case 'discuss':
                        if (!config.prompt && !config.topic) {
                            errors.push('Discuss step requires "prompt" or "topic" in config');
                        }
                        break;
                    case 'delegate':
                        if (!config.agentId && !config.targetAgent) {
                            errors.push('Delegate step requires "agentId" or "targetAgent" in config');
                        }
                        break;
                }
            }
            if (!/^[a-z][a-z0-9-]*$/.test(context.stepId)) {
                warnings.push(`Step ID "${context.stepId}" should be kebab-case (lowercase letters, numbers, hyphens)`);
            }
            if (errors.length > 0) {
                return {
                    gateId: 'validation',
                    status: 'FAIL',
                    message: `Validation failed: ${errors.join('; ')}`,
                    details: { errors, warnings },
                };
            }
            if (warnings.length > 0) {
                return {
                    gateId: 'validation',
                    status: 'WARN',
                    message: `Validation passed with warnings: ${warnings.join('; ')}`,
                    details: { warnings },
                };
            }
            return {
                gateId: 'validation',
                status: 'PASS',
                message: 'Step configuration is valid',
                details: { stepType: context.stepType },
            };
        });
        this.gateRegistry.register('capability', async (context) => {
            const warnings = [];
            const config = context.stepConfig;
            switch (context.stepType) {
                case 'prompt':
                case 'discuss':
                    break;
                case 'tool': {
                    const toolName = config?.toolName ?? config?.tool;
                    if (toolName && typeof toolName === 'string') {
                        const knownTools = ['read', 'write', 'search', 'execute', 'fetch'];
                        if (!knownTools.includes(toolName.toLowerCase())) {
                            warnings.push(`Tool "${toolName}" may require custom executor`);
                        }
                    }
                    break;
                }
                case 'delegate': {
                    const targetAgent = config?.agentId ?? config?.targetAgent;
                    if (!targetAgent) {
                        warnings.push('Delegate step has no target agent specified');
                    }
                    break;
                }
            }
            if (warnings.length > 0) {
                return {
                    gateId: 'capability',
                    status: 'WARN',
                    message: `Capability warnings: ${warnings.join('; ')}`,
                    details: { warnings, agentId: context.agentId },
                };
            }
            return {
                gateId: 'capability',
                status: 'PASS',
                message: `Agent ${context.agentId} has required capabilities for ${context.stepType} step`,
                details: { stepType: context.stepType },
            };
        });
        this.gateRegistry.register('resource', async (context) => {
            const issues = [];
            const MAX_STEPS_WARNING = 50;
            const MAX_STEPS_LIMIT = 100;
            if (context.totalSteps > MAX_STEPS_LIMIT) {
                return {
                    gateId: 'resource',
                    status: 'FAIL',
                    message: `Workflow exceeds maximum step limit (${String(context.totalSteps)} > ${String(MAX_STEPS_LIMIT)})`,
                    details: {
                        totalSteps: context.totalSteps,
                        limit: MAX_STEPS_LIMIT,
                    },
                };
            }
            if (context.totalSteps > MAX_STEPS_WARNING) {
                issues.push(`Workflow has ${String(context.totalSteps)} steps (warning threshold: ${String(MAX_STEPS_WARNING)})`);
            }
            const outputKeys = Object.keys(context.previousOutputs ?? {});
            const currentStepOutputCount = outputKeys.filter((key) => key.startsWith(context.stepId)).length;
            if (currentStepOutputCount > 5) {
                issues.push(`Step "${context.stepId}" has run ${String(currentStepOutputCount)} times - possible loop`);
            }
            if (issues.length > 0) {
                return {
                    gateId: 'resource',
                    status: 'WARN',
                    message: `Resource warnings: ${issues.join('; ')}`,
                    details: {
                        stepIndex: context.stepIndex,
                        totalSteps: context.totalSteps,
                        warnings: issues,
                    },
                };
            }
            return {
                gateId: 'resource',
                status: 'PASS',
                message: 'Resource limits not exceeded',
                details: {
                    stepIndex: context.stepIndex,
                    totalSteps: context.totalSteps,
                    remainingSteps: context.totalSteps - context.stepIndex - 1,
                },
            };
        });
        this.gateRegistry.register('progress', async (context) => {
            const progress = context.totalSteps > 0
                ? ((context.stepIndex + 1) / context.totalSteps) * 100
                : 0;
            return {
                gateId: 'progress',
                status: 'PASS',
                message: `Execution at ${progress.toFixed(0)}%`,
                details: {
                    stepIndex: context.stepIndex,
                    totalSteps: context.totalSteps,
                    percentComplete: progress,
                },
            };
        });
        this.gateRegistry.register('path_violation', async (context) => {
            const changedPaths = extractChangedPaths(context);
            const allowedPaths = normalizeStringArray(context.stepConfig?.allowedPaths ?? context.stepConfig?.pathsAllowlist);
            if (changedPaths.length === 0) {
                return {
                    gateId: 'path_violation',
                    status: 'PASS',
                    message: 'No changed paths declared for this step',
                    details: { changedPaths: [] },
                };
            }
            if (allowedPaths.length === 0) {
                return {
                    gateId: 'path_violation',
                    status: 'WARN',
                    message: 'Changed paths were provided but no allowed-path policy was configured',
                    details: { changedPaths },
                    suggestion: 'Provide stepConfig.allowedPaths to enforce a workspace write boundary.',
                };
            }
            const violations = changedPaths.filter((path) => !matchesAnyPattern(path, allowedPaths));
            if (violations.length > 0) {
                return {
                    gateId: 'path_violation',
                    status: 'FAIL',
                    message: `Changed paths fall outside the allowed scope: ${violations.join(', ')}`,
                    details: { changedPaths, allowedPaths, violations },
                    suggestion: 'Restrict writes to allowed paths or widen the allowlist explicitly.',
                };
            }
            return {
                gateId: 'path_violation',
                status: 'PASS',
                message: 'All changed paths are within the allowed scope',
                details: { changedPaths, allowedPaths },
            };
        });
        this.gateRegistry.register('change_radius', async (context) => {
            const changedPaths = extractChangedPaths(context);
            const limit = extractChangeRadiusLimit(context.stepConfig);
            if (changedPaths.length === 0) {
                return {
                    gateId: 'change_radius',
                    status: 'PASS',
                    message: 'No changed paths declared for this step',
                    details: { changedPaths: [], limit },
                };
            }
            if (changedPaths.length > limit) {
                return {
                    gateId: 'change_radius',
                    status: 'FAIL',
                    message: `Change radius exceeded (${String(changedPaths.length)} files > ${String(limit)} allowed)`,
                    details: { changedPaths, limit, changedCount: changedPaths.length },
                    suggestion: 'Reduce the number of touched files or raise the explicit changeRadius budget.',
                };
            }
            return {
                gateId: 'change_radius',
                status: 'PASS',
                message: `Change radius within limit (${String(changedPaths.length)}/${String(limit)})`,
                details: { changedPaths, limit, changedCount: changedPaths.length },
            };
        });
        this.gateRegistry.register('sensitive_change', async (context) => {
            const changedPaths = extractChangedPaths(context);
            const sensitivePaths = normalizeStringArray(context.stepConfig?.sensitivePaths);
            const patterns = sensitivePaths.length > 0 ? sensitivePaths : DEFAULT_SENSITIVE_PATH_PATTERNS;
            const matches = changedPaths.filter((path) => matchesAnyPattern(path, patterns));
            if (matches.length > 0) {
                return {
                    gateId: 'sensitive_change',
                    status: 'FAIL',
                    message: `Sensitive paths were targeted: ${matches.join(', ')}`,
                    details: { changedPaths, sensitivePaths: patterns, matches },
                    suggestion: 'Require explicit human review before changing sensitive paths.',
                };
            }
            return {
                gateId: 'sensitive_change',
                status: 'PASS',
                message: 'No sensitive paths were targeted',
                details: { changedPaths, sensitivePaths: patterns },
            };
        });
        this.gateRegistry.register('secrets_detection', async (context) => {
            const matches = collectPotentialSecrets(context.stepConfig, context.previousOutputs);
            if (matches.length > 0) {
                return {
                    gateId: 'secrets_detection',
                    status: 'FAIL',
                    message: `Potential secret material detected: ${matches.map((match) => match.pattern).join(', ')}`,
                    details: { matches },
                    suggestion: 'Remove credentials or secret-like content before continuing.',
                };
            }
            return {
                gateId: 'secrets_detection',
                status: 'PASS',
                message: 'No obvious secret material detected in step content',
                details: {},
            };
        });
    }
}
const DEFAULT_CHANGE_RADIUS_LIMIT = 10;
const DEFAULT_SENSITIVE_PATH_PATTERNS = [
    '.github/**',
    'auth/**',
    'infra/**',
    'config/secrets/**',
    '.env*',
    '**/*.pem',
    '**/id_rsa*',
];
const SECRET_PATTERNS = [
    { pattern: 'private-key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
    { pattern: 'openai-key', regex: /\bsk-[A-Za-z0-9]{16,}\b/ },
    { pattern: 'aws-secret', regex: /\b(?:aws[_-]?secret|secret[_-]?access[_-]?key)\b.{0,20}[A-Za-z0-9/+]{20,}/i },
        { pattern: 'generic-token', regex: /\b(?:api[_-]?key|token|secret)\b\s*[:=]\s*(['"])[^'"\n]{8,}\1/i },
];
function extractChangedPaths(context) {
    const stepConfig = context.stepConfig ?? {};
    return normalizeStringArray(stepConfig.changedPaths
        ?? stepConfig.paths
        ?? stepConfig.files
        ?? context.previousOutputs.changedPaths
        ?? context.previousOutputs.paths
        ?? context.previousOutputs.files);
}
function normalizeStringArray(value) {
    return Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
            .map((entry) => normalizeWorkspacePath(entry))
        : [];
}
function extractChangeRadiusLimit(stepConfig) {
    const raw = stepConfig?.changeRadius
        ?? stepConfig?.maxChangedFiles
        ?? stepConfig?.maxFiles;
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : DEFAULT_CHANGE_RADIUS_LIMIT;
}
function normalizeWorkspacePath(path) {
    return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
}
function matchesAnyPattern(path, patterns) {
    const normalizedPath = normalizeWorkspacePath(path);
    return patterns.some((pattern) => globMatchPattern(normalizedPath, pattern));
}
function globMatchPattern(value, pattern) {
    if (pattern === '*') {
        return true;
    }
    const normalizedPattern = normalizeWorkspacePath(pattern);
    const escaped = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DOUBLE_STAR::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DOUBLE_STAR::/g, '.*');
    return new RegExp(`^${escaped}$`).test(value);
}
function collectPotentialSecrets(stepConfig, previousOutputs) {
    const values = [
        ...collectStringValues(stepConfig),
        ...collectStringValues(previousOutputs),
    ];
    const findings = [];
    for (const value of values) {
        for (const matcher of SECRET_PATTERNS) {
            const match = value.match(matcher.regex);
            if (match !== null) {
                findings.push({
                    pattern: matcher.pattern,
                    snippet: match[0].slice(0, 80),
                });
            }
        }
    }
    return findings;
}
function collectStringValues(value, depth = 0) {
    if (depth > 3 || value === null || value === undefined) {
        return [];
    }
    if (typeof value === 'string') {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.flatMap((entry) => collectStringValues(entry, depth + 1));
    }
    if (typeof value === 'object') {
        return Object.values(value).flatMap((entry) => collectStringValues(entry, depth + 1));
    }
    return [];
}
export function createGateRegistry() {
    const gates = new Map();
    return {
        register(gateId, check) {
            gates.set(gateId, check);
        },
        get(gateId) {
            return gates.get(gateId);
        },
        has(gateId) {
            return gates.has(gateId);
        },
        list() {
            return Array.from(gates.keys());
        },
    };
}
export function createStepGuardEngine(config) {
    return new StepGuardEngine(config);
}
export class ProgressTracker {
    executionId;
    agentId;
    sessionId;
    totalSteps;
    onEvent;
    constructor(executionId, agentId, totalSteps, onEvent, sessionId) {
        this.executionId = executionId;
        this.agentId = agentId;
        this.sessionId = sessionId;
        this.totalSteps = totalSteps;
        this.onEvent = onEvent;
    }
    starting(stepIndex, stepId, stepType) {
        this.emit(stepIndex, stepId, stepType, 'starting');
    }
    completed(stepIndex, stepId, stepType, durationMs) {
        this.emit(stepIndex, stepId, stepType, 'completed', { durationMs });
    }
    failed(stepIndex, stepId, stepType, error, durationMs) {
        this.emit(stepIndex, stepId, stepType, 'failed', { durationMs, error });
    }
    skipped(stepIndex, stepId, stepType) {
        this.emit(stepIndex, stepId, stepType, 'skipped');
    }
    blocked(stepIndex, stepId, stepType, guardResult) {
        this.emit(stepIndex, stepId, stepType, 'blocked', { guardResult });
    }
    emit(stepIndex, stepId, stepType, status, options = {}) {
        const eventOptions = { ...options };
        if (this.sessionId !== undefined) {
            eventOptions.sessionId = this.sessionId;
        }
        const event = createProgressEvent(this.executionId, this.agentId, stepIndex, this.totalSteps, stepId, stepType, status, eventOptions);
        this.onEvent(event);
    }
}
export function createProgressTracker(executionId, agentId, totalSteps, onEvent, sessionId) {
    return new ProgressTracker(executionId, agentId, totalSteps, onEvent, sessionId);
}
