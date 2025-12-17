import type { MCPTool, ToolHandler } from '../types.js';
import {
  getPolicy,
  listPolicies,
  resolvePolicy,
  executeGates,
  type GuardResult,
} from '@automatosx/guard';
import {
  createSessionStore,
  type SessionStore,
} from '@automatosx/session-domain';

// Lazy-initialized session store for guard operations
let sessionStore: SessionStore | null = null;

function getSessionStore(): SessionStore {
  if (sessionStore === null) {
    sessionStore = createSessionStore();
  }
  return sessionStore;
}

/**
 * Guard check tool definition
 */
export const guardCheckTool: MCPTool = {
  name: 'guard_check',
  description: 'Run governance gates on changed paths against a policy',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      policyId: {
        type: 'string',
        description: 'Policy ID (e.g., "bugfix", "rebuild", "provider-refactor")',
      },
      changedPaths: {
        type: 'array',
        description: 'List of file paths that were changed',
        items: { type: 'string' },
      },
      target: {
        type: 'string',
        description: 'Target identifier (e.g., provider name for provider-refactor)',
      },
    },
    required: ['policyId', 'changedPaths'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Overall result status (PASS, FAIL, WARN)',
        enum: ['PASS', 'FAIL', 'WARN'],
      },
      policyId: { type: 'string', description: 'Policy that was checked' },
      target: { type: 'string', description: 'Target that was checked' },
      gates: {
        type: 'array',
        description: 'Individual gate results',
        items: {
          type: 'object',
          properties: {
            gate: { type: 'string' },
            status: { type: 'string', enum: ['PASS', 'FAIL', 'WARN'] },
            message: { type: 'string' },
          },
        },
      },
      summary: { type: 'string', description: 'Human-readable summary' },
      suggestions: {
        type: 'array',
        description: 'Suggested actions for failures',
        items: { type: 'string' },
      },
      timestamp: { type: 'string', description: 'Timestamp of check' },
    },
    required: ['status', 'policyId', 'target', 'gates', 'summary', 'suggestions', 'timestamp'],
  },
};

/**
 * Guard list tool definition
 */
export const guardListTool: MCPTool = {
  name: 'guard_list',
  description: 'List available governance policies',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of policies to return',
        default: 20,
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      policies: {
        type: 'array',
        description: 'List of policy summaries',
        items: {
          type: 'object',
          properties: {
            policyId: { type: 'string' },
            allowedPaths: { type: 'array', items: { type: 'string' } },
            forbiddenPaths: { type: 'array', items: { type: 'string' } },
            gates: { type: 'array', items: { type: 'string' } },
            changeRadiusLimit: { type: 'number' },
          },
        },
      },
      total: { type: 'number', description: 'Total number of policies' },
    },
    required: ['policies', 'total'],
  },
};

/**
 * Guard apply tool definition
 */
export const guardApplyTool: MCPTool = {
  name: 'guard_apply',
  description: 'Apply a governance policy to a session',
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'Session ID to apply the policy to',
      },
      policyId: {
        type: 'string',
        description: 'Policy ID to apply',
      },
    },
    required: ['sessionId', 'policyId'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      applied: { type: 'boolean', description: 'Whether the policy was applied' },
      sessionId: { type: 'string', description: 'Session ID' },
      policyId: { type: 'string', description: 'Applied policy ID' },
      message: { type: 'string', description: 'Result message' },
    },
    required: ['applied', 'sessionId', 'policyId', 'message'],
  },
};

/**
 * Handler for guard_check tool
 */
export const handleGuardCheck: ToolHandler = async (args) => {
  const policyId = args.policyId as string;
  const changedPaths = args.changedPaths as string[];
  const target = (args.target as string) ?? '';

  try {
    // Resolve policy to governance context
    const context = resolvePolicy(policyId, target);

    // Execute gates with provided changed paths
    const result: GuardResult = await executeGates(context, changedPaths);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
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
            error: 'GUARD_CHECK_FAILED',
            message,
            policyId,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for guard_list tool
 */
export const handleGuardList: ToolHandler = async (args) => {
  const limit = (args.limit as number | undefined) ?? 20;

  try {
    // listPolicies returns string[] of policy IDs
    const policyIds = listPolicies();

    const policySummaries = policyIds.slice(0, limit).map((policyId) => {
      const policy = getPolicy(policyId);
      if (policy === undefined) {
        return {
          policyId,
          allowedPaths: [],
          forbiddenPaths: [],
          gates: [],
          changeRadiusLimit: 0,
        };
      }
      return {
        policyId: policy.policyId,
        allowedPaths: policy.allowedPaths,
        forbiddenPaths: policy.forbiddenPaths,
        gates: policy.gates,
        changeRadiusLimit: policy.changeRadiusLimit,
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              policies: policySummaries,
              total: policyIds.length,
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
            error: 'GUARD_LIST_FAILED',
            message,
          }),
        },
      ],
      isError: true,
    };
  }
};

/**
 * Handler for guard_apply tool
 *
 * Applies a governance policy to a session, enabling policy-based
 * validation of agent actions within that session.
 */
export const handleGuardApply: ToolHandler = async (args) => {
  const sessionId = args.sessionId as string;
  const policyId = args.policyId as string;

  // Validate the policy exists
  const policy = getPolicy(policyId);
  if (policy === undefined) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'POLICY_NOT_FOUND',
            message: `Policy "${policyId}" not found`,
            availablePolicies: listPolicies(),
          }),
        },
      ],
      isError: true,
    };
  }

  // Get session store and apply policy
  const store = getSessionStore();
  const session = await store.get(sessionId);

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

  try {
    // Apply the policy to the session
    const updatedSession = await store.applyPolicy(sessionId, policyId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            applied: true,
            sessionId,
            policyId,
            appliedPolicies: updatedSession.appliedPolicies,
            message: `Policy '${policyId}' applied to session '${sessionId}'`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'POLICY_APPLY_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      isError: true,
    };
  }
};
