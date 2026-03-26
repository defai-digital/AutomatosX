import type { RuntimeTraceTreeNode } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success } from '../utils/formatters.js';
import {
  extractRuntimeGuardSummary,
  formatRuntimeGuardSummaryDetails,
} from '../utils/runtime-guard-summary.js';
import { findUnexpectedFlag } from '../utils/validation.js';

export async function traceCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const runtime = createRuntime(options);
  const unexpectedFlag = findUnexpectedFlag(args);
  if (unexpectedFlag !== undefined) {
    return failure(`Unknown trace flag: ${unexpectedFlag}.`);
  }

  if (args[0] === 'by-session') {
    const sessionId = args[1] ?? options.sessionId;
    if (sessionId === undefined) {
      return failure('Usage: ax trace by-session <session-id>');
    }
    if (args[2] !== undefined) {
      return failure('Usage: ax trace by-session <session-id>');
    }

    const traces = await runtime.listTracesBySession(sessionId, options.limit);
    if (traces.length === 0) {
      return success(`No traces found for session ${sessionId}.`, traces);
    }

    const lines = [
      `Session traces: ${sessionId}`,
      ...traces.map((trace) => (
        `- ${trace.traceId} ${trace.workflowId} ${trace.status} ${trace.startedAt}`
      )),
    ];
    return success(lines.join('\n'), traces);
  }

  if (args[0] === 'analyze') {
    const traceId = args[1] ?? options.traceId;
    if (traceId === undefined) {
      return failure('Usage: ax trace analyze <trace-id>');
    }
    if (args[2] !== undefined) {
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
      ...(
        analysis.guard === undefined
          ? []
          : [
              '',
              ...formatRuntimeGuardSummaryDetails(analysis.guard),
            ]
      ),
      '',
      'Findings:',
      ...analysis.findings.map((finding) => `- ${finding.level.toUpperCase()} ${finding.code}: ${finding.message}`),
    ];

    return success(lines.join('\n'), analysis);
  }

  if (args[0] === 'tree') {
    const traceId = args[1] ?? options.traceId;
    if (traceId === undefined) {
      return failure('Usage: ax trace tree <trace-id>');
    }
    if (args[2] !== undefined) {
      return failure('Usage: ax trace tree <trace-id>');
    }

    const tree = await runtime.getTraceTree(traceId);
    if (tree === undefined) {
      return failure(`Trace not found: ${traceId}`);
    }

    return success(renderTraceTree(tree), tree);
  }

  const traceId = args[0] ?? options.traceId;

  if (traceId !== undefined) {
    if (args[1] !== undefined) {
      return failure('Usage: ax trace [trace-id]');
    }

    const trace = await runtime.getTrace(traceId);
    if (trace === undefined) {
      return failure(`Trace not found: ${traceId}`);
    }
    const guard = extractRuntimeGuardSummary(trace.metadata);

    const lines = [
      `Trace: ${trace.traceId}`,
      `Workflow: ${trace.workflowId}`,
      `Status: ${trace.status}`,
      `Surface: ${trace.surface}`,
      `Session: ${typeof trace.metadata?.sessionId === 'string' ? trace.metadata.sessionId : 'n/a'}`,
      `Started: ${trace.startedAt}`,
      `Completed: ${trace.completedAt ?? 'running'}`,
      ...(
        guard === undefined
          ? []
          : [
              '',
              ...formatRuntimeGuardSummaryDetails(guard),
            ]
      ),
      '',
      'Steps:',
      ...trace.stepResults.map((step) => (
        `- ${step.stepId}: ${step.success ? 'ok' : 'failed'} (${step.durationMs}ms, retries=${step.retryCount})`
      )),
    ];

    return success(lines.join('\n'), trace);
  }

  const traces = await runtime.listTraces(options.limit);
  if (traces.length === 0) {
    return success('No traces found.', traces);
  }

  const lines = [
    'Recent traces:',
    ...traces.map((trace) => (
      `- ${trace.traceId} ${trace.workflowId} ${trace.status} ${trace.startedAt}`
    )),
  ];

  return success(lines.join('\n'), traces);
}

function renderTraceTree(node: RuntimeTraceTreeNode, depth = 0): string {
  const prefix = depth === 0 ? '' : `${'  '.repeat(depth - 1)}- `;
  const lines = [`${prefix}${node.traceId} ${node.workflowId} ${node.status}`];
  for (const child of node.children) {
    lines.push(renderTraceTree(child, depth + 1));
  }
  return lines.join('\n');
}
