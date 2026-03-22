import type { StepGuardPolicy } from '@defai.digital/contracts';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success, usageError } from '../utils/formatters.js';

export async function guardCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });

  switch (subcommand) {
    case 'list': {
      const policies = await runtime.listGuardPolicies();
      if (policies.length === 0) {
        return success('No guard policies available.', policies);
      }

      return success([
        'Guard policies:',
        ...policies.map((policy) => `- ${policy.policyId}: ${policy.name} (${policy.source}, ${policy.enabled ? 'enabled' : 'disabled'}, priority=${policy.priority})`),
      ].join('\n'), policies);
    }
    case 'apply': {
      const parsed = parseGuardApplyInput(args[1], options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const policy = await runtime.applyGuardPolicy(parsed.value);
      return success(`Guard policy applied: ${policy.policyId}`, policy);
    }
    case 'check': {
      const parsed = parseGuardCheckInput(options.input, options.agent);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const result = await runtime.checkGuards(parsed.value);
      return success([
        `Guard check: ${result.blocked ? 'blocked' : 'passed'}`,
        `Policies: ${result.policyIds.join(', ')}`,
        `Position: ${result.position}`,
        ...result.results.map((entry) => `- ${entry.guardId}: ${entry.status} (${entry.summary})`),
      ].join('\n'), result);
    }
    default:
      return usageError('ax guard [list|apply|check]');
  }
}

function parseGuardApplyInput(policyIdArg: string | undefined, input: string | undefined): {
  value: { policyId?: string; definition?: StepGuardPolicy; enabled?: boolean };
  error?: string;
} {
  if (input !== undefined) {
    try {
      const parsed = JSON.parse(input) as {
        policyId?: string;
        definition?: StepGuardPolicy;
        enabled?: boolean;
      };
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { value: {}, error: 'Guard apply input must be a JSON object.' };
      }
      if (parsed.definition === undefined && typeof parsed.policyId !== 'string') {
        return { value: {}, error: 'Guard apply input requires "policyId" or "definition".' };
      }
      return { value: parsed };
    } catch {
      return { value: {}, error: 'Invalid JSON input. Please provide a valid JSON object.' };
    }
  }

  if (policyIdArg === undefined || policyIdArg.length === 0) {
    return { value: {}, error: 'Usage: ax guard apply <policy-id> or --input <json-object>' };
  }

  return { value: { policyId: policyIdArg } };
}

function parseGuardCheckInput(input: string | undefined, fallbackAgent: string | undefined): {
  value: {
    policyId?: string;
    position?: 'before' | 'after';
    agentId?: string;
    executionId?: string;
    sessionId?: string;
    workflowId?: string;
    stepId: string;
    stepType: string;
    stepIndex?: number;
    totalSteps?: number;
    previousOutputs?: Record<string, unknown>;
    stepConfig?: Record<string, unknown>;
  };
  error?: string;
} {
  if (input === undefined) {
    return { value: { stepId: '', stepType: '' }, error: 'Usage: ax guard check --input <json-object>' };
  }

  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: { stepId: '', stepType: '' }, error: 'Guard check input must be a JSON object.' };
    }

    if (typeof parsed.stepId !== 'string' || typeof parsed.stepType !== 'string') {
      return { value: { stepId: '', stepType: '' }, error: 'Guard check input requires "stepId" and "stepType".' };
    }

    return {
      value: {
        policyId: typeof parsed.policyId === 'string' ? parsed.policyId : undefined,
        position: parsed.position === 'after' ? 'after' : 'before',
        agentId: typeof parsed.agentId === 'string' ? parsed.agentId : fallbackAgent,
        executionId: typeof parsed.executionId === 'string' ? parsed.executionId : undefined,
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
        workflowId: typeof parsed.workflowId === 'string' ? parsed.workflowId : undefined,
        stepId: parsed.stepId,
        stepType: parsed.stepType,
        stepIndex: typeof parsed.stepIndex === 'number' ? parsed.stepIndex : undefined,
        totalSteps: typeof parsed.totalSteps === 'number' ? parsed.totalSteps : undefined,
        previousOutputs: isRecord(parsed.previousOutputs) ? parsed.previousOutputs : undefined,
        stepConfig: isRecord(parsed.stepConfig) ? parsed.stepConfig : undefined,
      },
    };
  } catch {
    return { value: { stepId: '', stepType: '' }, error: 'Invalid JSON input. Please provide a valid JSON object.' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
