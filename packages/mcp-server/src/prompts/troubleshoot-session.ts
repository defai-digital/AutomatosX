/**
 * Troubleshoot Session Prompt
 *
 * User-controlled prompt template for debugging session issues.
 */

import type { MCPPrompt, MCPPromptMessage, PromptHandler } from '../types.js';
import { getSharedSessionManager } from '../session-accessor.js';

// ============================================================================
// Prompt Definition
// ============================================================================

/**
 * Troubleshoot session prompt definition
 */
export const troubleshootSessionPrompt: MCPPrompt = {
  name: 'troubleshoot-session',
  description: 'Generate a prompt to help debug session issues',
  arguments: [
    {
      name: 'sessionId',
      description: 'ID of the session to troubleshoot',
      required: true,
    },
    {
      name: 'symptoms',
      description: 'Description of the issue or symptoms observed',
      required: false,
    },
  ],
};

// ============================================================================
// Prompt Handler
// ============================================================================

/**
 * Handler for troubleshoot-session prompt
 */
export const handleTroubleshootSession: PromptHandler = async (args) => {
  const sessionId = args.sessionId ?? '';
  const symptoms = args.symptoms ?? 'No specific symptoms provided';

  const manager = getSharedSessionManager();
  const session = await manager.getSession(sessionId);

  if (session === undefined) {
    const messages: MCPPromptMessage[] = [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `# Session Troubleshooting

**Session ID:** ${sessionId}
**Status:** NOT FOUND

The session could not be found. Possible causes:
1. The session ID is incorrect or mistyped
2. The session has been deleted or expired
3. The session was never created

**Reported Symptoms:**
${symptoms}

Please help identify:
1. How to verify if the session ever existed
2. Steps to recover or recreate the session
3. Root cause analysis for session loss`,
        },
      },
    ];
    return { description: 'Session not found - troubleshooting prompt', messages };
  }

  // Build session diagnostic info
  const participantInfo = session.participants.map((p) => ({
    agentId: p.agentId,
    role: p.role,
    joinedAt: p.joinedAt,
    taskCount: p.tasks.length,
  }));

  // Find any failed tasks for error info
  const failedTasks = session.participants.flatMap((p) =>
    p.tasks.filter((t) => t.status === 'failed' && t.error !== undefined)
  );
  const firstFailedTask = failedTasks[0];
  const lastError = firstFailedTask?.error;

  const diagnostics = {
    sessionId: session.sessionId,
    status: session.status,
    initiator: session.initiator,
    task: session.task,
    participantCount: session.participants.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt,
    hasError: session.status === 'failed' || failedTasks.length > 0,
    lastError,
  };

  const promptText = `# Session Troubleshooting

## Session Information

**Session ID:** ${session.sessionId}
**Status:** ${session.status}
**Initiator:** ${session.initiator}
**Task:** ${session.task}

## Timeline

- **Created:** ${session.createdAt}
- **Last Updated:** ${session.updatedAt}
${session.completedAt ? `- **Completed/Failed:** ${session.completedAt}` : ''}

## Participants (${session.participants.length})

${participantInfo.map((p) => `- **${p.agentId}** (${p.role}) - joined ${p.joinedAt}, ${p.taskCount} tasks`).join('\n') || '(no participants)'}

${lastError !== undefined ? `## Error Information

**Code:** ${lastError.code}
**Message:** ${lastError.message}
${lastError.details !== undefined ? `**Details:** ${JSON.stringify(lastError.details)}` : ''}
` : session.status === 'failed' ? `## Error Information

**Status:** Session failed (no detailed error captured)
` : ''}

## Reported Symptoms

${symptoms}

## Diagnostics Data

\`\`\`json
${JSON.stringify(diagnostics, null, 2)}
\`\`\`

## Troubleshooting Questions

1. Is the session status as expected?
2. Are all expected participants present?
3. If there's an error, what caused it?
4. What was the last successful operation?
5. What steps led to the current state?

Please analyze this session and help identify:
1. The root cause of the issue
2. Recommended resolution steps
3. How to prevent this issue in the future`;

  const messages: MCPPromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: promptText,
      },
    },
  ];

  return {
    description: `Troubleshooting prompt for session "${sessionId}" (${session.status})`,
    messages,
  };
};
