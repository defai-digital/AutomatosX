import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseJsonInput, asOptionalString, asOptionalNumber, asOptionalRecord, asStringValue, findUnexpectedFlag } from '../utils/validation.js';

interface FeedbackInput {
  selectedAgent: string;
  recommendedAgent?: string;
  rating?: number;
  feedbackType?: string;
  taskDescription: string;
  userComment?: string;
  outcome?: string;
  durationMs?: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export async function feedbackCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'overview';
  const runtime = createRuntime(options);

  switch (subcommand) {
    case 'submit': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown feedback flag: ${unexpectedFlag}.`);
      }
      if (args[1] !== undefined) {
        return usageError('ax feedback submit --agent <agent-id> --task "<task>" --input <json-object>');
      }

      const parsed = parseFeedbackInput(options.input, options);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const entry = await runtime.submitFeedback(parsed.value);
      return success(`Feedback submitted: ${entry.feedbackId}`, entry);
    }
    case 'history': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown feedback flag: ${unexpectedFlag}.`);
      }
      if (args.length > 2) {
        return usageError('ax feedback history [agent-id]');
      }

      const agentId = args[1] ?? options.agent;
      const history = await runtime.listFeedbackHistory({
        agentId,
        limit: options.limit,
      });
      if (history.length === 0) {
        return success('No feedback found.', history);
      }

      return success([
        `Feedback history${agentId !== undefined ? ` for ${agentId}` : ''}:`,
        ...history.map((entry) => `- ${entry.createdAt} ${entry.selectedAgent}${entry.rating !== undefined ? ` rating=${entry.rating}` : ''} ${entry.taskDescription}`),
      ].join('\n'), history);
    }
    case 'stats': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown feedback flag: ${unexpectedFlag}.`);
      }
      if (args.length > 2) {
        return usageError('ax feedback stats <agent-id>');
      }

      const agentId = args[1] ?? options.agent;
      if (agentId === undefined || agentId.length === 0) {
        return usageError('ax feedback stats <agent-id>');
      }

      const stats = await runtime.getFeedbackStats(agentId);
      return success([
        `Feedback stats: ${agentId}`,
        `Total: ${stats.totalFeedback}`,
        `Ratings: ${stats.ratingsCount}`,
        `Average rating: ${stats.averageRating ?? 'n/a'}`,
        `Average duration: ${stats.averageDurationMs ?? 'n/a'}`,
        `Latest outcome: ${stats.latestOutcome ?? 'n/a'}`,
      ].join('\n'), stats);
    }
    case 'overview': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown feedback flag: ${unexpectedFlag}.`);
      }
      if (args[1] !== undefined) {
        return usageError('ax feedback overview');
      }

      const overview = await runtime.getFeedbackOverview();
      return success([
        'Feedback overview',
        `Total feedback: ${overview.totalFeedback}`,
        `Rated feedback: ${overview.ratedFeedback}`,
        `Agents with feedback: ${overview.agentsWithFeedback}`,
        `Average rating: ${overview.averageRating ?? 'n/a'}`,
        'Top agents:',
        ...(overview.topAgents.length > 0
          ? overview.topAgents.map((entry) => `- ${entry.agentId}: avg=${entry.averageRating ?? 'n/a'} total=${entry.totalFeedback}`)
          : ['- none']),
      ].join('\n'), overview);
    }
    case 'adjustments': {
      const unexpectedFlag = findUnexpectedFlag(args, 1);
      if (unexpectedFlag !== undefined) {
        return failure(`Unknown feedback flag: ${unexpectedFlag}.`);
      }
      if (args.length > 2) {
        return usageError('ax feedback adjustments <agent-id>');
      }

      const agentId = args[1] ?? options.agent;
      if (agentId === undefined || agentId.length === 0) {
        return usageError('ax feedback adjustments <agent-id>');
      }

      const adjustment = await runtime.getFeedbackAdjustments(agentId);
      return success([
        `Feedback adjustment: ${agentId}`,
        `Adjustment: ${adjustment.adjustment}`,
        `Confidence: ${adjustment.confidence}`,
        `Sample size: ${adjustment.sampleSize}`,
        `Average rating: ${adjustment.averageRating ?? 'n/a'}`,
      ].join('\n'), adjustment);
    }
    default:
      return usageError('ax feedback [submit|history|stats|overview|adjustments]');
  }
}

function parseFeedbackInput(input: string | undefined, options: CLIOptions): { value: FeedbackInput; error?: string } {
  let parsed: Partial<FeedbackInput> = {};
  if (input !== undefined) {
    const result = parseJsonInput(input);
    if (result.error !== undefined) {
      return { value: { selectedAgent: '', taskDescription: '' }, error: result.error };
    }
    parsed = result.value as Partial<FeedbackInput>;
  }

  const selectedAgent = asOptionalString(parsed.selectedAgent) ?? options.agent;
  const taskDescription = asOptionalString(parsed.taskDescription) ?? options.task;

  if (selectedAgent === undefined) {
    return { value: { selectedAgent: '', taskDescription: taskDescription ?? '' }, error: 'Feedback submit requires "selectedAgent" or --agent.' };
  }
  if (taskDescription === undefined) {
    return { value: { selectedAgent, taskDescription: '' }, error: 'Feedback submit requires "taskDescription" or --task.' };
  }

  return {
    value: {
      selectedAgent,
      recommendedAgent: asStringValue(parsed.recommendedAgent),
      rating: asOptionalNumber(parsed.rating),
      feedbackType: asStringValue(parsed.feedbackType),
      taskDescription,
      userComment: asStringValue(parsed.userComment),
      outcome: asStringValue(parsed.outcome),
      durationMs: asOptionalNumber(parsed.durationMs),
      sessionId: asStringValue(parsed.sessionId) ?? options.sessionId,
      metadata: asOptionalRecord(parsed.metadata),
    },
  };
}
