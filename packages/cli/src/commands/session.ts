/**
 * Session Command
 *
 * CLI command for managing sessions.
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { getSessionManager } from '../bootstrap.js';
import {
  success,
  successJson,
  failure,
  failureFromError,
  usageError,
  formatList,
} from '../utils/formatters.js';

/**
 * Parses JSON input and returns parsed object or error result
 */
function parseJsonInput(input: string | undefined, usage: string): { parsed?: Record<string, unknown>; error?: CommandResult } {
  if (input === undefined) {
    return { error: usageError(usage) };
  }
  try {
    return { parsed: JSON.parse(input) };
  } catch {
    return { error: failure('Invalid JSON input. Please provide a valid JSON string.') };
  }
}

/**
 * Validates required string field exists in parsed input
 */
function requireField(parsed: Record<string, unknown>, field: string): string | CommandResult {
  const value = parsed[field];
  if (typeof value !== 'string') {
    return failure(`Input must include "${field}" field.`);
  }
  return value;
}

/**
 * Handles the 'session' command - manage sessions
 *
 * Subcommands:
 *   session list             - List sessions
 *   session get <id>         - Get session details
 *   session create           - Create a new session
 *   session join <id>        - Join a session
 *   session leave <id>       - Leave a session
 *   session complete <id>    - Complete a session
 *   session fail <id>        - Fail a session
 */
export async function sessionCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
      return listSessions(options);
    case 'get':
      return getSession(subArgs, options);
    case 'create':
      return createSession(options);
    case 'join':
      return joinSession(subArgs, options);
    case 'leave':
      return leaveSession(subArgs, options);
    case 'complete':
      return completeSession(subArgs, options);
    case 'fail':
      return failSession(subArgs, options);
    default:
      return failure(`Unknown session subcommand: ${subcommand}\nAvailable: list, get, create, join, leave, complete, fail`);
  }
}

/**
 * List all sessions
 */
async function listSessions(options: CLIOptions): Promise<CommandResult> {
  try {
    const sessions = await getSessionManager().listSessions();

    if (sessions.length === 0) {
      return success('No sessions found.', []);
    }

    const limited = options.limit !== undefined ? sessions.slice(0, options.limit) : sessions;

    if (options.format === 'json') {
      return successJson(limited);
    }

    const table = formatList(limited, [
      { header: 'Session ID', width: 36, getValue: s => s.sessionId },
      { header: 'Initiator', width: 20, getValue: s => s.initiator },
      { header: 'Status', width: 9, getValue: s => s.status },
      { header: 'Participants', width: 12, getValue: s => String(s.participants.length) },
    ]);

    return success(table, limited);
  } catch (error) {
    return failureFromError('list sessions', error);
  }
}

/**
 * Get session details by ID
 */
async function getSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];
  if (sessionId === undefined) {
    return usageError('ax session get <session-id>');
  }

  try {
    const session = await getSessionManager().getSession(sessionId);

    if (session === undefined) {
      return failure(`Session not found: ${sessionId}`);
    }

    if (options.format === 'json') {
      return successJson(session);
    }

    const lines = [
      `Session: ${session.sessionId}`,
      `Task: ${session.task}`,
      `Initiator: ${session.initiator}`,
      `Status: ${session.status}`,
      `Version: ${session.version}`,
      `Created: ${session.createdAt}`,
      `Updated: ${session.updatedAt}`,
      `Workspace: ${session.workspace ?? 'N/A'}`,
      '',
      'Participants:',
    ];

    for (const participant of session.participants) {
      const status = participant.leftAt !== undefined ? 'left' : 'active';
      lines.push(`  - ${participant.agentId} (${participant.role}, ${status})`);

      for (const task of participant.tasks) {
        lines.push(`      Task: ${task.title} [${task.status}]`);
      }
    }

    return success(lines.join('\n'), session);
  } catch (error) {
    return failureFromError('get session', error);
  }
}

/**
 * Create a new session
 */
async function createSession(options: CLIOptions): Promise<CommandResult> {
  const usage = 'ax session create --input \'{"initiator": "agent-id", "task": "description"}\'';
  const { parsed, error } = parseJsonInput(options.input, usage);
  if (error) return error;

  const task = requireField(parsed!, 'task');
  if (typeof task !== 'string') return task;

  const initiator = requireField(parsed!, 'initiator');
  if (typeof initiator !== 'string') return initiator;

  try {
    const session = await getSessionManager().createSession({
      task,
      initiator,
      metadata: parsed!.metadata as Record<string, unknown> | undefined,
      workspace: parsed!.workspace as string | undefined,
    });

    if (options.format === 'json') {
      return successJson(session);
    }
    return success(`Session created: ${session.sessionId}`, session);
  } catch (error) {
    return failureFromError('create session', error);
  }
}

/**
 * Join an existing session
 */
async function joinSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];
  const usage = 'ax session join <session-id> --input \'{"agentId": "agent-id"}\'';

  if (sessionId === undefined) {
    return usageError(usage);
  }

  const { parsed, error } = parseJsonInput(options.input, usage);
  if (error) return error;

  const agentId = requireField(parsed!, 'agentId');
  if (typeof agentId !== 'string') return agentId;

  const role = parsed!.role === 'collaborator' || parsed!.role === 'delegate' || parsed!.role === 'initiator'
    ? parsed!.role
    : 'collaborator';

  try {
    const session = await getSessionManager().joinSession({ sessionId, agentId, role });

    if (options.format === 'json') {
      return successJson(session);
    }
    return success(`Joined session: ${session.sessionId}`, session);
  } catch (error) {
    return failureFromError('join session', error);
  }
}

/**
 * Leave a session
 */
async function leaveSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];
  const usage = 'ax session leave <session-id> --input \'{"agentId": "agent-id"}\'';

  if (sessionId === undefined) {
    return usageError(usage);
  }

  const { parsed, error } = parseJsonInput(options.input, usage);
  if (error) return error;

  const agentId = requireField(parsed!, 'agentId');
  if (typeof agentId !== 'string') return agentId;

  try {
    const session = await getSessionManager().leaveSession(sessionId, agentId);

    if (options.format === 'json') {
      return successJson(session);
    }
    return success(`Left session: ${session.sessionId}`, session);
  } catch (error) {
    return failureFromError('leave session', error);
  }
}

/**
 * Complete a session
 */
async function completeSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];
  if (sessionId === undefined) {
    return usageError('ax session complete <session-id>');
  }

  try {
    let summary: string | undefined;
    if (options.input !== undefined) {
      try {
        const parsed = JSON.parse(options.input);
        summary = parsed.summary as string | undefined;
      } catch {
        return failure('Invalid JSON input. Please provide a valid JSON string.');
      }
    }

    const session = await getSessionManager().completeSession(sessionId, summary);

    if (options.format === 'json') {
      return successJson(session);
    }
    return success(`Session completed: ${session.sessionId}`, session);
  } catch (error) {
    return failureFromError('complete session', error);
  }
}

/**
 * Fail a session
 */
async function failSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];
  const usage = 'ax session fail <session-id> --input \'{"code": "ERROR", "message": "..."}\'';

  if (sessionId === undefined) {
    return usageError(usage);
  }

  const { parsed, error } = parseJsonInput(options.input, usage);
  if (error) return error;

  const code = requireField(parsed!, 'code');
  if (typeof code !== 'string') return code;

  const message = requireField(parsed!, 'message');
  if (typeof message !== 'string') return message;

  try {
    const sessionFailure: { code: string; message: string; taskId?: string; details?: Record<string, unknown> } = {
      code,
      message,
    };
    if (typeof parsed!.taskId === 'string') {
      sessionFailure.taskId = parsed!.taskId;
    }
    if (parsed!.details !== undefined && typeof parsed!.details === 'object') {
      sessionFailure.details = parsed!.details as Record<string, unknown>;
    }

    const session = await getSessionManager().failSession(sessionId, sessionFailure);

    if (options.format === 'json') {
      return successJson(session);
    }
    return success(`Session failed: ${session.sessionId}`, session);
  } catch (error) {
    return failureFromError('fail session', error);
  }
}
