import type {
  RuntimeWorkflowGuardSummary,
} from './runtime-service-types.js';
import type {
  Workflow,
  WorkflowResult,
} from '@defai.digital/workflow-engine';

export function buildWorkflowGuardSummary(
  workflow: Workflow,
  result: WorkflowResult,
): RuntimeWorkflowGuardSummary | undefined {
  if (result.error?.code !== 'WORKFLOW_GUARD_BLOCKED') {
    return undefined;
  }

  const errorDetails = asOptionalRecord(result.error.details);
  const failedStepId = result.error.failedStepId;
  const guardId = asOptionalString(errorDetails?.guardId);
  const failedGates = asStringArray(errorDetails?.failedGates) ?? [];
  const failedGateMessages = asStringArray(errorDetails?.failedGateMessages) ?? [];
  const blockedByRuntimeGovernance = guardId === 'enforce-runtime-trust' || failedGates.includes('runtime_trust');
  const failedStep = failedStepId === undefined
    ? undefined
    : workflow.steps.find((step) => step.stepId === failedStepId);
  const failedStepResult = failedStepId === undefined
    ? undefined
    : result.stepResults.find((step) => step.stepId === failedStepId);
  const toolName = extractWorkflowToolName(failedStepResult?.output) ?? extractWorkflowConfigToolName(failedStep);
  const trust = extractWorkflowTrustSnapshot(failedStepResult?.output);
  const requiredTrustStates = failedStep === undefined
    ? []
    : asStringArray(asOptionalRecord(failedStep.config)?.requiredTrustStates)
      ?? asStringArray(asOptionalRecord(failedStep.config)?.allowedTrustStates)
      ?? [];

  return {
    summary: formatWorkflowGuardSummary({
      failedStepId,
      guardId,
      failedGates,
      failedGateMessages,
      blockedByRuntimeGovernance,
      toolName,
      trust,
      requiredTrustStates,
    }),
    guardId,
    failedStepId,
    failedGates,
    failedGateMessages,
    blockedByRuntimeGovernance,
    toolName,
    trustState: trust?.state,
    requiredTrustStates: requiredTrustStates.length > 0 ? requiredTrustStates : undefined,
    approvalMode: trust?.approvalMode,
    approvalPolicyId: trust?.approvalPolicyId,
    sourceRef: trust?.sourceRef,
  };
}

interface WorkflowTrustSnapshot {
  state: string;
  approvalMode?: string;
  approvalPolicyId?: string;
  sourceRef?: string;
}

function formatWorkflowGuardSummary(config: {
  failedStepId?: string;
  guardId?: string;
  failedGates: string[];
  failedGateMessages: string[];
  blockedByRuntimeGovernance: boolean;
  toolName?: string;
  trust?: WorkflowTrustSnapshot;
  requiredTrustStates: string[];
}): string {
  const stepLabel = config.failedStepId ?? 'unknown-step';
  if (config.blockedByRuntimeGovernance) {
    const parts = [
      `Runtime governance blocked step "${stepLabel}"${config.toolName ? ` (${config.toolName})` : ''}.`,
      config.trust?.state ? `Trust state: ${config.trust.state}.` : undefined,
      config.requiredTrustStates.length > 0 ? `Required trust states: ${config.requiredTrustStates.join(', ')}.` : undefined,
      config.failedGateMessages.length > 0 ? config.failedGateMessages.join(' ') : undefined,
    ].filter((value): value is string => value !== undefined);
    return parts.join(' ');
  }

  const parts = [
    `Workflow step "${stepLabel}" was blocked by guard "${config.guardId ?? 'unknown-guard'}".`,
    config.failedGates.length > 0 ? `Failed gates: ${config.failedGates.join(', ')}.` : undefined,
    config.failedGateMessages.length > 0 ? config.failedGateMessages.join(' ') : undefined,
  ].filter((value): value is string => value !== undefined);
  return parts.join(' ');
}

function extractWorkflowConfigToolName(step: Workflow['steps'][number] | undefined): string | undefined {
  const config = step?.config;
  const parsed = asOptionalRecord(config);
  return asOptionalString(parsed?.toolName) ?? asOptionalString(step?.tool);
}

function extractWorkflowToolName(output: unknown): string | undefined {
  const envelope = asOptionalRecord(output);
  return envelope?.type === 'tool'
    ? asOptionalString(envelope.toolName)
    : undefined;
}

function extractWorkflowTrustSnapshot(output: unknown): WorkflowTrustSnapshot | undefined {
  const toolEnvelope = asOptionalRecord(output);
  const toolOutput = toolEnvelope?.type === 'tool'
    ? asOptionalRecord(toolEnvelope.toolOutput)
    : undefined;
  if (toolOutput === undefined) {
    return undefined;
  }

  const trust = asOptionalRecord(toolOutput.skillTrust)
    ?? asOptionalRecord(toolOutput.trust)
    ?? asOptionalRecord(asOptionalRecord(toolOutput.execution)?.trust);
  if (trust === undefined) {
    return undefined;
  }

  const state = asOptionalString(trust.state);
  if (state === undefined) {
    return undefined;
  }

  return {
    state,
    approvalMode: asOptionalString(trust.approvalMode),
    approvalPolicyId: asOptionalString(trust.approvalPolicyId),
    sourceRef: asOptionalString(trust.sourceRef),
  };
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.map((entry) => String(entry))
    : undefined;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
