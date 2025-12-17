import type { MCPTool, ToolHandler } from '../types.js';
import {
  createSessionStore,
  createSessionManager,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type Session,
  type SessionFilter,
} from '@automatosx/session-domain';

// Create shared store and manager instances
const store = createSessionStore();
const manager = createSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);

/**
 * Session create tool definition
 * INV-MCP-004: Non-idempotent - creates new session each call
 * INV-MCP-002: Side effects - creates session in store
 */
export const sessionCreateTool: MCPTool = {
  name: 'session_create',
  description: 'Create a new collaboration session. SIDE EFFECTS: Creates new session in store with unique ID.',
  inputSchema: {
    type: 'object',
    properties: {
      initiator: {
        type: 'string',
        description: 'Identifier of the agent creating the session',
      },
      task: {
        type: 'string',
        description: 'Description of the session task/objective',
      },
      workspace: {
        type: 'string',
        description: 'Optional workspace path for the session',
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata for the session',
      },
    },
    required: ['initiator', 'task'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Unique session identifier' },
      initiator: { type: 'string', description: 'Session initiator' },
      task: { type: 'string', description: 'Session task' },
      status: { type: 'string', description: 'Session status' },
      createdAt: { type: 'string', description: 'Creation timestamp' },
      workspace: { type: 'string', description: 'Workspace path' },
    },
    required: ['sessionId', 'initiator', 'task', 'status', 'createdAt'],
  },
  idempotent: false,
};

/**
 * Session status tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const sessionStatusTool: MCPTool = {
  name: 'session_status',
  description: 'Get the current status of a session. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to check',
      },
    },
    required: ['sessionId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      status: { type: 'string', enum: ['active', 'completed', 'failed'] },
      initiator: { type: 'string' },
      task: { type: 'string' },
      participants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            agentId: { type: 'string' },
            role: { type: 'string' },
            joinedAt: { type: 'string' },
            taskCount: { type: 'number' },
          },
        },
      },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
      completedAt: { type: 'string' },
    },
    required: ['sessionId', 'status', 'initiator', 'task', 'participants', 'createdAt'],
  },
  idempotent: true,
};

/**
 * Session complete tool definition
 * INV-MCP-004: Idempotent - completing already completed session is safe
 * INV-MCP-002: Side effects - updates session status to completed
 */
export const sessionCompleteTool: MCPTool = {
  name: 'session_complete',
  description: 'Complete a session. SIDE EFFECTS: Updates session status to completed. Idempotent for already-completed sessions.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to complete',
      },
      summary: {
        type: 'string',
        description: 'Optional summary of what was accomplished',
      },
    },
    required: ['sessionId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      status: { type: 'string' },
      completedAt: { type: 'string' },
      summary: { type: 'string' },
    },
    required: ['sessionId', 'status', 'completedAt'],
  },
  idempotent: true,
};

/**
 * Session list tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const sessionListTool: MCPTool = {
  name: 'session_list',
  description: 'List sessions with optional filtering. Read-only, no side effects.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by session status',
        enum: ['active', 'completed', 'failed'],
      },
      initiator: {
        type: 'string',
        description: 'Filter by initiator',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of sessions to return',
        default: 20,
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            initiator: { type: 'string' },
            task: { type: 'string' },
            status: { type: 'string' },
            participantCount: { type: 'number' },
            createdAt: { type: 'string' },
          },
        },
      },
      total: { type: 'number' },
    },
    required: ['sessions', 'total'],
  },
  idempotent: true,
};

/**
 * Session join tool definition
 * INV-MCP-004: Idempotent - joining twice returns existing participation
 * INV-MCP-002: Side effects - adds participant to session
 */
export const sessionJoinTool: MCPTool = {
  name: 'session_join',
  description: 'Join an existing session as a participant. SIDE EFFECTS: Adds agent to session participants. Idempotent - joining twice returns existing participation.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to join',
      },
      agentId: {
        type: 'string',
        description: 'The ID of the agent joining',
      },
      role: {
        type: 'string',
        description: 'Role in the session',
        enum: ['collaborator', 'delegate'],
        default: 'collaborator',
      },
    },
    required: ['sessionId', 'agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      agentId: { type: 'string' },
      role: { type: 'string' },
      joinedAt: { type: 'string' },
      participantCount: { type: 'number' },
    },
    required: ['sessionId', 'agentId', 'role', 'joinedAt', 'participantCount'],
  },
  idempotent: true,
};

/**
 * Session leave tool definition
 * INV-MCP-004: Non-idempotent - fails if not a participant
 * INV-MCP-002: Side effects - removes participant from session
 */
export const sessionLeaveTool: MCPTool = {
  name: 'session_leave',
  description: 'Leave a session. SIDE EFFECTS: Removes agent from session participants. Fails if not currently a participant.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to leave',
      },
      agentId: {
        type: 'string',
        description: 'The ID of the agent leaving',
      },
    },
    required: ['sessionId', 'agentId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      agentId: { type: 'string' },
      leftAt: { type: 'string' },
      remainingParticipants: { type: 'number' },
    },
    required: ['sessionId', 'agentId', 'leftAt', 'remainingParticipants'],
  },
  idempotent: false,
};

/**
 * Session fail tool definition
 * INV-MCP-004: Non-idempotent - only active sessions can be failed
 * INV-MCP-002: Side effects - updates session status to failed
 */
export const sessionFailTool: MCPTool = {
  name: 'session_fail',
  description: 'Mark a session as failed with error details. SIDE EFFECTS: Updates session status to failed. Only active sessions can be failed.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to mark as failed',
      },
      error: {
        type: 'object',
        description: 'Error details object with code and message properties',
      },
    },
    required: ['sessionId', 'error'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      status: { type: 'string' },
      failedAt: { type: 'string' },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
    required: ['sessionId', 'status', 'failedAt', 'error'],
  },
  idempotent: false,
};

/**
 * Handler for session_create tool
 */
export const handleSessionCreate: ToolHandler = async (args) => {
  const initiator = args.initiator as string;
  const task = args.task as string;
  const workspace = args.workspace as string | undefined;
  const metadata = args.metadata as Record<string, unknown> | undefined;

  try {
    const session = await manager.createSession({
      initiator,
      task,
      workspace,
      metadata,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: session.sessionId,
              initiator: session.initiator,
              task: session.task,
              status: session.status,
              createdAt: session.createdAt,
              workspace: session.workspace,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'SESSION_CREATE_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_status tool
 */
export const handleSessionStatus: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;

  try {
    const session = await manager.getSession(sessionId);

    if (session === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_NOT_FOUND',
              message: `Session "${sessionId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Build participant summaries
    const participants = session.participants.map((p) => ({
      agentId: p.agentId,
      role: p.role,
      joinedAt: p.joinedAt,
      taskCount: p.tasks.length,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: session.sessionId,
              status: session.status,
              initiator: session.initiator,
              task: session.task,
              participants,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt,
              completedAt: session.completedAt,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'SESSION_STATUS_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_complete tool
 */
export const handleSessionComplete: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;
  const summary = args.summary as string | undefined;

  try {
    const session = await manager.completeSession(sessionId, summary);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: session.sessionId,
              status: session.status,
              completedAt: session.completedAt,
              summary,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string }).code ?? 'SESSION_COMPLETE_FAILED';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_list tool
 */
export const handleSessionList: ToolHandler = async (args) => {
  const status = args.status as 'active' | 'completed' | 'failed' | undefined;
  const initiator = args.initiator as string | undefined;
  const limit = (args.limit as number | undefined) ?? 20;

  try {
    // Build filter only with defined properties
    const filter: SessionFilter = {};
    if (status !== undefined) {
      filter.status = status;
    }
    if (initiator !== undefined) {
      filter.initiator = initiator;
    }

    const sessions = await manager.listSessions(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    const sessionSummaries = sessions.slice(0, limit).map((s: Session) => ({
      sessionId: s.sessionId,
      initiator: s.initiator,
      task: s.task,
      status: s.status,
      participantCount: s.participants.length,
      createdAt: s.createdAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessions: sessionSummaries,
              total: sessions.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'SESSION_LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_join tool
 * INV-MCP-SES-001: Cannot join completed/failed session
 * INV-MCP-SES-002: Joining twice returns existing participation (idempotent)
 * INV-MCP-SES-003: Max participants enforced (default: 10)
 */
export const handleSessionJoin: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;
  const agentId = args.agentId as string;
  const role = (args.role as 'collaborator' | 'delegate' | undefined) ?? 'collaborator';

  try {
    const session = await manager.getSession(sessionId);

    if (session === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_NOT_FOUND',
              message: `Session "${sessionId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    // INV-MCP-SES-001: Cannot join completed/failed session
    if (session.status !== 'active') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_INVALID_TRANSITION',
              message: `Cannot join session with status "${session.status}"`,
            }),
          },
        ],
        isError: true,
      };
    }

    // INV-MCP-SES-003: Max participants check
    const MAX_PARTICIPANTS = 10;
    if (session.participants.length >= MAX_PARTICIPANTS) {
      // Check if already a participant (INV-MCP-SES-002)
      const existing = session.participants.find((p) => p.agentId === agentId);
      if (existing === undefined) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'SESSION_MAX_PARTICIPANTS',
                message: `Session has reached maximum participants (${MAX_PARTICIPANTS})`,
              }),
            },
          ],
          isError: true,
        };
      }
    }

    // Join the session (joinSession handles idempotency - INV-MCP-SES-002)
    const updatedSession = await manager.joinSession({ sessionId, agentId, role });

    const participant = updatedSession.participants.find((p: { agentId: string }) => p.agentId === agentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: updatedSession.sessionId,
              agentId,
              role: participant?.role ?? role,
              joinedAt: participant?.joinedAt ?? new Date().toISOString(),
              participantCount: updatedSession.participants.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string }).code ?? 'SESSION_JOIN_FAILED';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_leave tool
 * INV-MCP-SES-004: Cannot leave if not a participant
 * INV-MCP-SES-005: Initiator cannot leave active session
 */
export const handleSessionLeave: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;
  const agentId = args.agentId as string;

  try {
    const session = await manager.getSession(sessionId);

    if (session === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_NOT_FOUND',
              message: `Session "${sessionId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    // INV-MCP-SES-004: Cannot leave if not a participant
    const isParticipant = session.participants.some((p) => p.agentId === agentId);
    if (!isParticipant) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_AGENT_NOT_PARTICIPANT',
              message: `Agent "${agentId}" is not a participant in this session`,
            }),
          },
        ],
        isError: true,
      };
    }

    // INV-MCP-SES-005: Initiator cannot leave active session
    if (session.initiator === agentId && session.status === 'active') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_INITIATOR_CANNOT_LEAVE',
              message: 'Session initiator cannot leave an active session. Complete or fail the session first.',
            }),
          },
        ],
        isError: true,
      };
    }

    // Leave the session
    const updatedSession = await manager.leaveSession(sessionId, agentId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: updatedSession.sessionId,
              agentId,
              leftAt: new Date().toISOString(),
              remainingParticipants: updatedSession.participants.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string }).code ?? 'SESSION_LEAVE_FAILED';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for session_fail tool
 */
export const handleSessionFail: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;
  const error = args.error as {
    code: string;
    message: string;
    taskId?: string;
    details?: Record<string, unknown>;
  };

  try {
    const session = await manager.getSession(sessionId);

    if (session === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_NOT_FOUND',
              message: `Session "${sessionId}" not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    if (session.status !== 'active') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'SESSION_INVALID_TRANSITION',
              message: `Cannot fail session with status "${session.status}"`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Fail the session
    const updatedSession = await manager.failSession(sessionId, error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              sessionId: updatedSession.sessionId,
              status: 'failed',
              failedAt: updatedSession.completedAt ?? new Date().toISOString(),
              error: {
                code: error.code,
                message: error.message,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = (err as { code?: string }).code ?? 'SESSION_FAIL_FAILED';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};
