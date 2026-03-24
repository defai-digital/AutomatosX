import { z } from 'zod';
export const GuardPositionSchema = z.enum(['before', 'after']);
export const GuardFailActionSchema = z.enum(['block', 'warn', 'continue']);
export const WorkflowStepGuardSchema = z.object({
    guardId: z.string().min(1),
    stepId: z.string().min(1),
    position: GuardPositionSchema,
    gates: z.array(z.string()).min(1),
    onFail: GuardFailActionSchema.default('warn'),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
});
export const GuardCheckStatusSchema = z.enum(['PASS', 'WARN', 'FAIL']);
export const StepGateResultSchema = z.object({
    gateId: z.string(),
    status: GuardCheckStatusSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    suggestion: z.string().optional(),
});
export const StepGuardResultSchema = z.object({
    guardId: z.string(),
    stepId: z.string(),
    position: GuardPositionSchema,
    status: GuardCheckStatusSchema,
    gates: z.array(StepGateResultSchema),
    blocked: z.boolean(),
    summary: z.string(),
    timestamp: z.string().datetime(),
    durationMs: z.number().nonnegative(),
});
export const StepGuardPolicySchema = z.object({
    policyId: z.string().min(1),
    name: z.string(),
    description: z.string().optional(),
    workflowPatterns: z.array(z.string()).default(['*']),
    stepTypes: z.array(z.string()).optional(),
    agentPatterns: z.array(z.string()).default(['*']),
    guards: z.array(WorkflowStepGuardSchema),
    enabled: z.boolean().default(true),
    priority: z.number().int().default(0),
});
export const StepGuardContextSchema = z.object({
    agentId: z.string(),
    executionId: z.string(),
    sessionId: z.string().optional(),
    stepId: z.string(),
    stepType: z.string(),
    stepIndex: z.number().int().nonnegative(),
    totalSteps: z.number().int().positive(),
    previousOutputs: z.record(z.unknown()),
    stepConfig: z.record(z.unknown()).optional(),
    workflowId: z.string().optional(),
});
export const StageProgressStatusSchema = z.enum([
    'pending',
    'starting',
    'completed',
    'failed',
    'skipped',
    'blocked',
]);
export const StageProgressEventSchema = z.object({
    type: z.literal('stage.progress'),
    executionId: z.string(),
    agentId: z.string(),
    sessionId: z.string().optional(),
    stageIndex: z.number().int().nonnegative(),
    stageTotal: z.number().int().positive(),
    stageName: z.string(),
    stageType: z.string(),
    status: StageProgressStatusSchema,
    durationMs: z.number().nonnegative().optional(),
    error: z.string().optional(),
    guardResult: StepGuardResultSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string().datetime(),
});
export const GoalAnchorTriggerSchema = z.enum([
    'every_step',
    'on_checkpoint',
    'on_decision',
    'on_delegation',
]);
export const GoalAnchorConfigSchema = z.object({
    originalTask: z.string(),
    checkpointsReached: z.array(z.string()).default([]),
    trigger: GoalAnchorTriggerSchema.default('on_checkpoint'),
    includeRemainingSteps: z.boolean().default(true),
    includeProgress: z.boolean().default(true),
});
export const GoalAnchorContextSchema = z.object({
    task: z.string(),
    progress: z.string(),
    checkpointsReached: z.array(z.string()),
    remainingSteps: z.array(z.string()).optional(),
    percentComplete: z.number().min(0).max(100).optional(),
});
export const DEFAULT_STEP_GUARD = {
    guardId: 'default-step-guard',
    stepId: '*',
    position: 'before',
    gates: ['validation'],
    onFail: 'warn',
    enabled: true,
};
export function createStepGuardResult(guardId, stepId, position, gates, blocked) {
    const hasFailure = gates.some((gate) => gate.status === 'FAIL');
    const hasWarning = gates.some((gate) => gate.status === 'WARN');
    const status = hasFailure ? 'FAIL' : hasWarning ? 'WARN' : 'PASS';
    const passCount = gates.filter((gate) => gate.status === 'PASS').length;
    const warnCount = gates.filter((gate) => gate.status === 'WARN').length;
    const failCount = gates.filter((gate) => gate.status === 'FAIL').length;
    let summary;
    if (status === 'PASS') {
        summary = `All ${String(gates.length)} gates passed`;
    }
    else if (status === 'WARN') {
        summary = `${String(passCount)} passed, ${String(warnCount)} warnings`;
    }
    else {
        summary = `${String(failCount)} failed, ${String(warnCount)} warnings, ${String(passCount)} passed`;
    }
    return {
        guardId,
        stepId,
        position,
        status,
        gates,
        blocked,
        summary,
        timestamp: new Date().toISOString(),
        durationMs: 0,
    };
}
export function createProgressEvent(executionId, agentId, stageIndex, stageTotal, stageName, stageType, status, options = {}) {
    return {
        type: 'stage.progress',
        executionId,
        agentId,
        sessionId: options.sessionId,
        stageIndex,
        stageTotal,
        stageName,
        stageType,
        status,
        durationMs: options.durationMs,
        error: options.error,
        guardResult: options.guardResult,
        metadata: options.metadata,
        timestamp: new Date().toISOString(),
    };
}
