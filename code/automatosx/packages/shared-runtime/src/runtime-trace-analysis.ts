import type { TraceRecord } from '@defai.digital/trace-store';
import {
  extractRuntimeTraceGuardSummary,
  type RuntimeTraceGuardSummary,
} from './runtime-governance-summary.js';
import type {
  RuntimeTraceAnalysis,
  RuntimeTraceAnalysisFinding,
} from './runtime-service-types.js';

export function analyzeTraceRecord(trace: TraceRecord): RuntimeTraceAnalysis {
  const totalSteps = trace.stepResults.length;
  const successfulSteps = trace.stepResults.filter((step) => step.success).length;
  const failedSteps = totalSteps - successfulSteps;
  const retryCount = trace.stepResults.reduce((sum, step) => sum + step.retryCount, 0);
  const slowestStep = [...trace.stepResults]
    .sort((left, right) => right.durationMs - left.durationMs)[0];
  const durationMs = resolveTraceDuration(trace);
  const guard = extractRuntimeTraceGuardSummary(trace.metadata);
  const findings = buildTraceFindings(trace, {
    totalSteps,
    failedSteps,
    retryCount,
    guard,
  });

  return {
    traceId: trace.traceId,
    workflowId: trace.workflowId,
    surface: trace.surface,
    status: trace.status,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    durationMs,
    totalSteps,
    successfulSteps,
    failedSteps,
    retryCount,
    slowestStep: slowestStep === undefined ? undefined : {
      stepId: slowestStep.stepId,
      durationMs: slowestStep.durationMs,
      success: slowestStep.success,
    },
    guard,
    error: trace.error,
    findings,
  };
}

function buildTraceFindings(
  trace: TraceRecord,
  summary: {
    totalSteps: number;
    failedSteps: number;
    retryCount: number;
    guard?: RuntimeTraceGuardSummary;
  },
): RuntimeTraceAnalysisFinding[] {
  const findings: RuntimeTraceAnalysisFinding[] = [];

  if (trace.status === 'failed') {
    findings.push({
      level: 'error',
      code: 'TRACE_FAILED',
      message: trace.error?.message ?? 'Trace completed with a failure status.',
    });
  }

  if (trace.status === 'running') {
    findings.push({
      level: 'warn',
      code: 'TRACE_RUNNING',
      message: 'Trace is still running and may not have final output yet.',
    });
  }

  if (summary.failedSteps > 0) {
    findings.push({
      level: 'error',
      code: 'STEP_FAILURES',
      message: `${summary.failedSteps} step${summary.failedSteps === 1 ? '' : 's'} failed during execution.`,
    });
  }

  if (summary.retryCount > 0) {
    findings.push({
      level: 'warn',
      code: 'STEP_RETRIES',
      message: `${summary.retryCount} retr${summary.retryCount === 1 ? 'y was' : 'ies were'} required across all steps.`,
    });
  }

  if (summary.guard !== undefined) {
    findings.push({
      level: summary.guard.blockedByRuntimeGovernance ? 'error' : 'warn',
      code: summary.guard.blockedByRuntimeGovernance ? 'RUNTIME_GOVERNANCE_BLOCK' : 'TRACE_GUARD_SIGNAL',
      message: summary.guard.summary,
    });
  }

  if (summary.totalSteps === 0) {
    findings.push({
      level: 'warn',
      code: 'NO_STEP_RESULTS',
      message: 'Trace completed without any recorded step results.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      level: 'info',
      code: 'TRACE_HEALTHY',
      message: 'Trace completed without recorded execution issues.',
    });
  }

  return findings;
}

function resolveTraceDuration(trace: TraceRecord): number {
  const metadataDuration = trace.metadata?.totalDurationMs;
  if (typeof metadataDuration === 'number' && Number.isFinite(metadataDuration) && metadataDuration >= 0) {
    return metadataDuration;
  }

  if (trace.completedAt !== undefined) {
    const startedAtMs = Date.parse(trace.startedAt);
    const completedAtMs = Date.parse(trace.completedAt);
    if (Number.isFinite(startedAtMs) && Number.isFinite(completedAtMs) && completedAtMs >= startedAtMs) {
      return completedAtMs - startedAtMs;
    }
  }

  return trace.stepResults.reduce((sum, step) => sum + step.durationMs, 0);
}
