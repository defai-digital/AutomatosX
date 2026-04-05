import type { StepGuardPolicy } from '@defai.digital/contracts';
import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import {
  parseJsonInput,
  asOptionalBoolean,
  asOptionalInteger,
  asOptionalRecord,
  asStringValue,
} from '../utils/validation.js';

export async function policyCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'list';
  const runtime = createRuntime(options);

  switch (subcommand) {
    case 'list': {
      const policies = await runtime.listGuardPolicies();
      if (policies.length === 0) {
        return success('No trust policies available.', policies);
      }

      return success([
        'Trust policies:',
        ...policies.map((policy) => `- ${policy.policyId}: ${policy.name} (${policy.source}, ${policy.enabled ? 'enabled' : 'disabled'}, priority=${policy.priority})`),
      ].join('\n'), policies);
    }
    case 'apply': {
      const parsed = parseGuardApplyInput(args[1], options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const policy = await runtime.applyGuardPolicy(parsed.value);
      return success(`Trust policy applied: ${policy.policyId}`, policy);
    }
    case 'check': {
      const parsed = parseGuardCheckInput(options.input, options.agent);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const result = await runtime.checkGuards(parsed.value);
      return success([
        `Policy check: ${result.blocked ? 'blocked' : 'passed'}`,
        `Policies: ${result.policyIds.join(', ')}`,
        `Position: ${result.position}`,
        ...result.results.map((entry) => `- ${entry.guardId}: ${entry.status} (${entry.summary})`),
      ].join('\n'), result);
    }
    default:
      return usageError('ax policy [list|apply|check]');
  }
}

function parseGuardApplyInput(policyIdArg: string | undefined, input: string | undefined): {
  value: { policyId?: string; definition?: StepGuardPolicy; enabled?: boolean };
  error?: string;
} {
  if (input !== undefined) {
    const parsed = parseJsonInput(input);
    if (parsed.error !== undefined) {
      return { value: {}, error: parsed.error };
    }
    const policyId = asStringValue(parsed.value.policyId);
    const definition = parsed.value.definition as StepGuardPolicy | undefined;
    const enabled = asOptionalBoolean(parsed.value.enabled);
    if (parsed.value.enabled !== undefined && enabled === undefined) {
      return { value: {}, error: 'Policy apply input requires "enabled" to be a boolean.' };
    }
    if (definition === undefined && policyId === undefined) {
      return { value: {}, error: 'Policy apply input requires "policyId" or "definition".' };
    }
    return { value: { policyId, definition, enabled } };
  }

  if (policyIdArg === undefined || policyIdArg.length === 0) {
    return { value: {}, error: 'Usage: ax policy apply <policy-id> or --input <json-object>' };
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
    return { value: { stepId: '', stepType: '' }, error: 'Usage: ax policy check --input <json-object>' };
  }

  const parsed = parseJsonInput(input);
  if (parsed.error !== undefined) {
    return { value: { stepId: '', stepType: '' }, error: parsed.error };
  }

  const stepId = asStringValue(parsed.value.stepId);
  const stepType = asStringValue(parsed.value.stepType);
  if (stepId === undefined || stepType === undefined) {
    return { value: { stepId: '', stepType: '' }, error: 'Policy check input requires "stepId" and "stepType".' };
  }
  const stepIndex = asOptionalInteger(parsed.value.stepIndex, 'stepIndex', { min: 0 });
  if (stepIndex.error !== undefined) {
    return { value: { stepId: '', stepType: '' }, error: stepIndex.error };
  }
  const totalSteps = asOptionalInteger(parsed.value.totalSteps, 'totalSteps', { min: 1 });
  if (totalSteps.error !== undefined) {
    return { value: { stepId: '', stepType: '' }, error: totalSteps.error };
  }

  return {
    value: {
      policyId: asStringValue(parsed.value.policyId),
      position: parsed.value.position === 'after' ? 'after' : 'before',
      agentId: asStringValue(parsed.value.agentId) ?? fallbackAgent,
      executionId: asStringValue(parsed.value.executionId),
      sessionId: asStringValue(parsed.value.sessionId),
      workflowId: asStringValue(parsed.value.workflowId),
      stepId,
      stepType,
      stepIndex: stepIndex.value,
      totalSteps: totalSteps.value,
      previousOutputs: asOptionalRecord(parsed.value.previousOutputs),
      stepConfig: asOptionalRecord(parsed.value.stepConfig),
    },
  };
}

/** @deprecated Use policyCommand directly. Kept for backward compatibility. */
export const guardCommand = policyCommand;
