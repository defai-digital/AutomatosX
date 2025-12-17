/**
 * Session Command
 *
 * CLI command for managing sessions.
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createSessionStore,
  createSessionManager,
  DEFAULT_SESSION_DOMAIN_CONFIG,
} from '@automatosx/session-domain';

// Singleton store and manager for demo purposes
const store = createSessionStore();
const manager = createSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);

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
      return {
        success: false,
        message: `Unknown session subcommand: ${subcommand}\nAvailable: list, get, create, join, leave, complete, fail`,
        data: undefined,
        exitCode: 1,
      };
  }
}

/**
 * List all sessions
 */
async function listSessions(options: CLIOptions): Promise<CommandResult> {
  try {
    const sessions = await manager.listSessions();

    if (sessions.length === 0) {
      return {
        success: true,
        message: 'No sessions found.',
        data: [],
        exitCode: 0,
      };
    }

    // Apply limit if specified
    const limited = options.limit !== undefined
      ? sessions.slice(0, options.limit)
      : sessions;

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: limited,
        exitCode: 0,
      };
    }

    // Format as text table
    const header = 'Session ID                           | Initiator            | Status    | Participants';
    const separator = '-'.repeat(header.length);
    const rows = limited.map((s) =>
      `${s.sessionId.padEnd(36)} | ${s.initiator.padEnd(20)} | ${s.status.padEnd(9)} | ${s.participants.length}`
    );

    return {
      success: true,
      message: [header, separator, ...rows].join('\n'),
      data: limited,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Get session details by ID
 */
async function getSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];

  if (sessionId === undefined) {
    return {
      success: false,
      message: 'Usage: ax session get <session-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const session = await manager.getSession(sessionId);

    if (session === undefined) {
      return {
        success: false,
        message: `Session not found: ${sessionId}`,
        data: undefined,
        exitCode: 1,
      };
    }

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    // Format as text
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

    for (const p of session.participants) {
      const status = p.leftAt !== undefined ? 'left' : 'active';
      lines.push(`  - ${p.agentId} (${p.role}, ${status})`);

      if (p.tasks.length > 0) {
        for (const t of p.tasks) {
          lines.push(`      Task: ${t.title} [${t.status}]`);
        }
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Create a new session
 */
async function createSession(options: CLIOptions): Promise<CommandResult> {
  try {
    if (options.input === undefined) {
      return {
        success: false,
        message: 'Usage: ax session create --input \'{"initiator": "agent-id", "task": "description"}\'',
        data: undefined,
        exitCode: 1,
      };
    }

    const input = JSON.parse(options.input);
    const session = await manager.createSession(input);

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Session created: ${session.sessionId}`,
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Join an existing session
 */
async function joinSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];

  if (sessionId === undefined) {
    return {
      success: false,
      message: 'Usage: ax session join <session-id> --input \'{"agentId": "agent-id"}\'',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    if (options.input === undefined) {
      return {
        success: false,
        message: 'Usage: ax session join <session-id> --input \'{"agentId": "agent-id"}\'',
        data: undefined,
        exitCode: 1,
      };
    }

    const input = JSON.parse(options.input);
    const session = await manager.joinSession({
      sessionId,
      agentId: input.agentId,
      role: input.role,
    });

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Joined session: ${session.sessionId}`,
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to join session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Leave a session
 */
async function leaveSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];

  if (sessionId === undefined) {
    return {
      success: false,
      message: 'Usage: ax session leave <session-id> --input \'{"agentId": "agent-id"}\'',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    if (options.input === undefined) {
      return {
        success: false,
        message: 'Usage: ax session leave <session-id> --input \'{"agentId": "agent-id"}\'',
        data: undefined,
        exitCode: 1,
      };
    }

    const input = JSON.parse(options.input);
    const session = await manager.leaveSession(sessionId, input.agentId);

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Left session: ${session.sessionId}`,
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to leave session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Complete a session
 */
async function completeSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];

  if (sessionId === undefined) {
    return {
      success: false,
      message: 'Usage: ax session complete <session-id>',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const input = options.input !== undefined ? JSON.parse(options.input) : {};
    const session = await manager.completeSession(sessionId, input.summary);

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Session completed: ${session.sessionId}`,
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to complete session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Fail a session
 */
async function failSession(args: string[], options: CLIOptions): Promise<CommandResult> {
  const sessionId = args[0];

  if (sessionId === undefined) {
    return {
      success: false,
      message: 'Usage: ax session fail <session-id> --input \'{"code": "ERROR", "message": "..."}\'',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    if (options.input === undefined) {
      return {
        success: false,
        message: 'Usage: ax session fail <session-id> --input \'{"code": "ERROR", "message": "..."}\'',
        data: undefined,
        exitCode: 1,
      };
    }

    const input = JSON.parse(options.input);
    const session = await manager.failSession(sessionId, {
      code: input.code,
      message: input.message,
      taskId: input.taskId,
      details: input.details,
    });

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: session,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `Session failed: ${session.sessionId}`,
      data: session,
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to fail session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: undefined,
      exitCode: 1,
    };
  }
}
