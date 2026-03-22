import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { failure, success } from '../utils/formatters.js';
export async function traceCommand(args, options) {
    const basePath = options.outputDir ?? process.cwd();
    const runtime = createSharedRuntimeService({ basePath });
    if (args[0] === 'by-session') {
        const sessionId = args[1] ?? options.sessionId;
        if (sessionId === undefined) {
            return failure('Usage: ax trace by-session <session-id>');
        }
        const traces = await runtime.listTracesBySession(sessionId, options.limit);
        if (traces.length === 0) {
            return success(`No traces found for session ${sessionId}.`, traces);
        }
        const lines = [
            `Session traces: ${sessionId}`,
            ...traces.map((trace) => (`- ${trace.traceId} ${trace.workflowId} ${trace.status} ${trace.startedAt}`)),
        ];
        return success(lines.join('\n'), traces);
    }
    if (args[0] === 'analyze') {
        const traceId = args[1] ?? options.traceId;
        if (traceId === undefined) {
            return failure('Usage: ax trace analyze <trace-id>');
        }
        const analysis = await runtime.analyzeTrace(traceId);
        if (analysis === undefined) {
            return failure(`Trace not found: ${traceId}`);
        }
        const lines = [
            `Trace analysis: ${analysis.traceId}`,
            `Workflow: ${analysis.workflowId}`,
            `Status: ${analysis.status}`,
            `Surface: ${analysis.surface}`,
            `Duration: ${analysis.durationMs}ms`,
            `Steps: ${analysis.totalSteps} total, ${analysis.successfulSteps} ok, ${analysis.failedSteps} failed`,
            `Retries: ${analysis.retryCount}`,
            `Slowest step: ${analysis.slowestStep?.stepId ?? 'n/a'}${analysis.slowestStep === undefined ? '' : ` (${analysis.slowestStep.durationMs}ms)`}`,
            '',
            'Findings:',
            ...analysis.findings.map((finding) => `- ${finding.level.toUpperCase()} ${finding.code}: ${finding.message}`),
        ];
        return success(lines.join('\n'), analysis);
    }
    const traceId = args[0] ?? options.traceId;
    if (traceId !== undefined) {
        const trace = await runtime.getTrace(traceId);
        if (trace === undefined) {
            return failure(`Trace not found: ${traceId}`);
        }
        const lines = [
            `Trace: ${trace.traceId}`,
            `Workflow: ${trace.workflowId}`,
            `Status: ${trace.status}`,
            `Surface: ${trace.surface}`,
            `Session: ${typeof trace.metadata?.sessionId === 'string' ? trace.metadata.sessionId : 'n/a'}`,
            `Started: ${trace.startedAt}`,
            `Completed: ${trace.completedAt ?? 'running'}`,
            '',
            'Steps:',
            ...trace.stepResults.map((step) => (`- ${step.stepId}: ${step.success ? 'ok' : 'failed'} (${step.durationMs}ms, retries=${step.retryCount})`)),
        ];
        return success(lines.join('\n'), trace);
    }
    const traces = await runtime.listTraces(options.limit);
    if (traces.length === 0) {
        return success('No traces found.', traces);
    }
    const lines = [
        'Recent traces:',
        ...traces.map((trace) => (`- ${trace.traceId} ${trace.workflowId} ${trace.status} ${trace.startedAt}`)),
    ];
    return success(lines.join('\n'), traces);
}
