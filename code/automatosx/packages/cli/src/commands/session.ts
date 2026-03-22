import { randomUUID } from 'node:crypto';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success, usageError } from '../utils/formatters.js';

type SessionInput = Record<string, unknown>;

export async function sessionCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });

  switch (subcommand) {
    case 'list': {
      const sessions = await runtime.listSessions();
      if (sessions.length === 0) {
        return success('No sessions found.', sessions);
      }

      const lines = [
        'Sessions:',
        ...sessions.map((session) => (
          `- ${session.sessionId} ${session.status} ${session.initiator} ${session.task}`
        )),
      ];
      return success(lines.join('\n'), sessions);
    }
    case 'get': {
      const sessionId = args[1];
      if (sessionId === undefined) {
        return usageError('ax session get <session-id>');
      }

      const session = await runtime.getSession(sessionId);
      if (session === undefined) {
        return failure(`Session not found: ${sessionId}`);
      }

      const lines = [
        `Session: ${session.sessionId}`,
        `Task: ${session.task}`,
        `Initiator: ${session.initiator}`,
        `Status: ${session.status}`,
        `Workspace: ${session.workspace ?? 'N/A'}`,
        `Participants: ${session.participants.map((entry) => `${entry.agentId}:${entry.role}${entry.leftAt ? ':left' : ''}`).join(', ')}`,
      ];
      return success(lines.join('\n'), session);
    }
    case 'create': {
      const parsed = parseJsonInput(options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const task = asString(parsed.value.task ?? options.task, 'task');
      if (task.error !== undefined) {
        return failure(task.error);
      }

      const initiator = asString(parsed.value.initiator ?? options.agent ?? 'cli', 'initiator');
      if (initiator.error !== undefined) {
        return failure(initiator.error);
      }

      const session = await runtime.createSession({
        sessionId: typeof parsed.value.sessionId === 'string' && parsed.value.sessionId.length > 0 ? parsed.value.sessionId : randomUUID(),
        task: task.value,
        initiator: initiator.value,
        workspace: typeof parsed.value.workspace === 'string' ? parsed.value.workspace : undefined,
        metadata: asRecord(parsed.value.metadata),
      });
      return success(`Session created: ${session.sessionId}`, session);
    }
    case 'join': {
      const sessionId = args[1];
      if (sessionId === undefined) {
        return usageError('ax session join <session-id> --input <json-object>');
      }
      const parsed = parseJsonInput(options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      const agentId = asString(parsed.value.agentId ?? options.agent, 'agentId');
      if (agentId.error !== undefined) {
        return failure(agentId.error);
      }
      const role = normalizeRole(parsed.value.role);
      if (typeof parsed.value.role === 'string' && role === undefined) {
        return failure('Input requires "role" to be one of: initiator, collaborator, delegate.');
      }
      const session = await runtime.joinSession({
        sessionId,
        agentId: agentId.value,
        role,
      });
      return success(`Joined session: ${session.sessionId}`, session);
    }
    case 'leave': {
      const sessionId = args[1];
      if (sessionId === undefined) {
        return usageError('ax session leave <session-id> --input <json-object>');
      }
      const parsed = parseJsonInput(options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      const agentId = asString(parsed.value.agentId ?? options.agent, 'agentId');
      if (agentId.error !== undefined) {
        return failure(agentId.error);
      }
      const session = await runtime.leaveSession(sessionId, agentId.value);
      return success(`Left session: ${session.sessionId}`, session);
    }
    case 'complete': {
      const sessionId = args[1];
      if (sessionId === undefined) {
        return usageError('ax session complete <session-id> [--input <json-object>]');
      }
      const parsed = parseJsonInput(options.input, true);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      const summary = typeof parsed.value.summary === 'string' ? parsed.value.summary : undefined;
      const session = await runtime.completeSession(sessionId, summary);
      return success(`Session completed: ${session.sessionId}`, session);
    }
    case 'fail': {
      const sessionId = args[1];
      if (sessionId === undefined) {
        return usageError('ax session fail <session-id> --input <json-object>');
      }
      const parsed = parseJsonInput(options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }
      const message = asString(parsed.value.message, 'message');
      if (message.error !== undefined) {
        return failure(message.error);
      }
      const session = await runtime.failSession(sessionId, message.value);
      return success(`Session failed: ${session.sessionId}`, session);
    }
    default:
      return usageError('ax session [list|get|create|join|leave|complete|fail]');
  }
}

function parseJsonInput(input: string | undefined, allowEmpty = false): { value: SessionInput; error?: string } {
  if (input === undefined) {
    return allowEmpty ? { value: {} } : { value: {}, error: 'Command requires --input <json-object>' };
  }

  try {
    const parsed = JSON.parse(input);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: {}, error: 'Input must be a JSON object.' };
    }
    return { value: parsed as SessionInput };
  } catch {
    return { value: {}, error: 'Invalid JSON input. Please provide a valid JSON object.' };
  }
}

function asString(value: unknown, field: string): { value: string; error?: string } {
  if (typeof value !== 'string' || value.length === 0) {
    return { value: '', error: `Input requires "${field}".` };
  }
  return { value };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeRole(value: unknown): 'initiator' | 'collaborator' | 'delegate' | undefined {
  return value === 'initiator' || value === 'collaborator' || value === 'delegate'
    ? value
    : undefined;
}
