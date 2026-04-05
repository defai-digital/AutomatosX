import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  formatWorkflowInputSummary,
  getWorkflowCatalogEntry as getSharedWorkflowCatalogEntry,
  listWorkflowCatalog as listSharedWorkflowCatalog,
  type StableWorkflowCatalogEntry,
} from '@defai.digital/shared-runtime/catalog';
import { z } from 'zod';
import { writePrettyJsonFile } from './json-file-write.js';
import { runCommand } from './commands/run.js';
import type { CLIOptions, CommandResult } from './types.js';
import { parseJsonObjectString } from './utils/validation.js';

export type WorkflowCommandId = 'ship' | 'architect' | 'audit' | 'qa' | 'release';

export interface WorkflowCommandInput {
  commandId: WorkflowCommandId;
  arguments: Record<string, string | boolean>;
  options: {
    provider?: string;
    sessionId?: string;
    dryRun?: boolean;
    outputDir?: string;
    basePath?: string;
    verbose?: boolean;
    quiet?: boolean;
  };
  traceContext?: {
    parentTraceId?: string;
  };
}

export interface WorkflowCommandPreview {
  workflowId: string;
  workflowName: string;
  traceId: string;
  agent: string;
  stages: string[];
  task: string;
  artifactNames: string[];
  artifactCount: number;
}

export interface WorkflowCommandResult {
  success: boolean;
  traceId: string;
  outputDir: string;
  manifestPath?: string;
  summaryPath?: string;
  artifactPaths?: string[];
  errorCode?: string;
  errorMessage?: string;
  guard?: WorkflowCommandGuardSummary;
}

export interface WorkflowCommandGuardSummary {
  summary: string;
  guardId?: string;
  failedStepId?: string;
  failedGates: string[];
  failedGateMessages?: string[];
  blockedByRuntimeGovernance: boolean;
  toolName?: string;
  trustState?: string;
  requiredTrustStates?: string[];
  sourceRef?: string;
}

export interface WorkflowInputPayload {
  workflowId: string;
  workflowName: string;
  traceId: string;
  agent: string;
  task: string;
  options: {
    provider?: string;
    sessionId?: string;
    outputDir?: string;
    basePath?: string;
    verbose?: boolean;
    quiet?: boolean;
  };
  arguments: Record<string, string | boolean>;
  traceContext?: {
    parentTraceId?: string;
  };
}

type WorkflowStatus = 'preview' | 'pending' | 'dispatched' | 'failed';

type RuntimeDispatcher = (payload: WorkflowInputPayload) => Promise<WorkflowCommandResult>;

interface WorkflowTaskSpec {
  taskTemplateBase: string[];
  taskTemplateByArgument: Record<string, string>;
}

type WorkflowSpec = StableWorkflowCatalogEntry & WorkflowTaskSpec & {
  agent: string;
};

export type WorkflowCatalogEntry = StableWorkflowCatalogEntry;

interface WorkflowArtifactWriteResult {
  outputDir: string;
  manifestPath: string;
  summaryPath: string;
  artifactPaths: string[];
}

const artifactDocumentSchema = z.record(z.string(), z.unknown());

const WORKFLOW_TASK_SPEC_BY_ID: Record<WorkflowCommandId, WorkflowTaskSpec> = {
  ship: {
    taskTemplateBase: [
      'Prepare this change for ship readiness.',
      'Inspect the current diff or feature scope and produce a concise ship summary.',
      'Include review findings, test status or recommended test plan, risk notes, and a PR draft summary.',
    ],
    taskTemplateByArgument: {
      scope: 'Focus scope: {{value}}.',
      issue: 'Related issue or requirement: {{value}}.',
      policy: 'Apply policy posture: {{value}}.',
      branch: 'Target branch context: {{value}}.',
    },
  },
  architect: {
    taskTemplateBase: [
      'Turn this requirement into an implementation-ready architecture proposal.',
      'Produce an architecture summary, ADR draft, phased implementation plan, and risk matrix.',
    ],
    taskTemplateByArgument: {
      request: 'Primary request: {{value}}.',
      input: 'Reference input file: {{value}}.',
      timeline: 'Target timeline: {{value}}.',
      constraints: 'Constraints: {{value}}.',
    },
  },
  audit: {
    taskTemplateBase: [
      'Perform a structured audit of this codebase or selected scope.',
      'Identify design drift, dependency risk, quality gaps, and operational bottlenecks.',
      'Produce an audit report with severity ranking and a remediation plan.',
    ],
    taskTemplateByArgument: {
      scope: 'Audit scope: {{value}}.',
      repo: 'Repository or path: {{value}}.',
      depth: 'Audit depth: {{value}}.',
    },
  },
  qa: {
    taskTemplateBase: [
      'Perform a QA validation pass for the provided target.',
      'Check expected behavior, identify defects, and summarize pass/fail outcomes.',
      'Include reproduction steps for issues that are found.',
    ],
    taskTemplateByArgument: {
      target: 'QA target: {{value}}.',
      url: 'Target URL: {{value}}.',
      scenario: 'Expected scenarios: {{value}}.',
    },
  },
  release: {
    taskTemplateBase: [
      'Prepare release artifacts for the requested software delivery scope.',
      'Produce a changelog draft, release notes, upgrade notes, and a deployment checklist.',
    ],
    taskTemplateByArgument: {
      releaseVersion: 'Target version: {{value}}.',
      commits: 'Merged PRs or commits: {{value}}.',
      target: 'Release target: {{value}}.',
    },
  },
};

const CLI_BOOLEAN_OPTIONS = new Set(['dryRun', 'verbose', 'quiet']);

function getWorkflowSpec(commandId: WorkflowCommandId): WorkflowSpec {
  const catalogEntry = getSharedWorkflowCatalogEntry(commandId);
  if (catalogEntry === undefined) {
    throw new Error(`Unknown workflow catalog entry: ${commandId}`);
  }

  return {
    ...catalogEntry,
    ...WORKFLOW_TASK_SPEC_BY_ID[commandId],
    agent: catalogEntry.agentId,
  };
}

export function parseWorkflowCommandInput(
  commandId: WorkflowCommandId,
  args: string[],
  globalProvider?: string,
): WorkflowCommandInput {
  const definition = getWorkflowSpec(commandId);
  const parsed = parseCommandArgs(args);
  const positionalValues = parsed.positionals;

  const parsedArguments: Record<string, string | boolean> = {};

  if (definition.positionalArgumentName !== undefined && positionalValues[0] !== undefined) {
    parsedArguments[definition.positionalArgumentName] = positionalValues[0] as string;
  }

  for (const [key, value] of Object.entries(parsed.options)) {
    const normalized = normalizeBooleanValue(value);
    parsedArguments[key] = normalized;
  }

  return {
    commandId,
    arguments: parsedArguments,
    options: {
      provider: (typeof globalProvider === 'string' && globalProvider.length > 0)
        ? globalProvider
        : (typeof parsed.stringOptions.provider === 'string' && parsed.stringOptions.provider.length > 0 ? parsed.stringOptions.provider : undefined),
      sessionId: typeof parsed.stringOptions.sessionId === 'string' && parsed.stringOptions.sessionId.length > 0
        ? parsed.stringOptions.sessionId
        : undefined,
      dryRun: parsed.boolOptions.dryRun,
      outputDir: parsed.stringOptions.outputDir,
      verbose: parsed.boolOptions.verbose,
      quiet: parsed.boolOptions.quiet,
    },
  };
}

export function validateWorkflowInput(input: WorkflowCommandInput): string | null {
  const spec = getWorkflowSpec(input.commandId);
  const hasRequiredInputs = hasRequiredWorkflowInputs(spec, input.arguments);

  if (!hasRequiredInputs) {
    return buildRequiredInputError(spec);
  }

  return null;
}

export function listWorkflowCatalog(): WorkflowCatalogEntry[] {
  return listSharedWorkflowCatalog();
}

export function getWorkflowCatalogEntry(command: string): WorkflowCatalogEntry | undefined {
  return getSharedWorkflowCatalogEntry(command);
}

export function buildWorkflowInput(input: WorkflowCommandInput): WorkflowInputPayload {
  const spec = getWorkflowSpec(input.commandId);
  const traceId = input.traceContext?.parentTraceId ?? randomUUID();

  const task = buildTaskText(spec, input.arguments);

  return {
    workflowId: spec.workflowId,
    workflowName: spec.workflowName,
    traceId,
    agent: spec.agent,
    task,
    arguments: { ...input.arguments },
    options: {
      provider: input.options.provider,
      sessionId: input.options.sessionId,
      outputDir: input.options.outputDir,
      verbose: input.options.verbose,
      quiet: input.options.quiet,
    },
    traceContext: input.traceContext,
  };
}

export function preview(input: WorkflowCommandInput): Promise<WorkflowCommandPreview> {
  const spec = getWorkflowSpec(input.commandId);
  const traceId = input.traceContext?.parentTraceId ?? randomUUID();
  const task = buildTaskText(spec, input.arguments);

  return Promise.resolve({
    workflowId: spec.workflowId,
    workflowName: spec.workflowName,
    traceId,
    agent: spec.agent,
    stages: [...spec.stages],
    task,
    artifactNames: [...spec.artifactNames],
    artifactCount: spec.artifactNames.length,
  });
}

export async function dispatch(
  input: WorkflowCommandInput,
  options?: {
    runtimeDispatcher?: RuntimeDispatcher;
  },
): Promise<WorkflowCommandResult> {
  const spec = getWorkflowSpec(input.commandId);
  const traceId = input.traceContext?.parentTraceId ?? randomUUID();
  const task = buildTaskText(spec, input.arguments);
  const artifactNames = [...spec.artifactNames];
  const previewData: WorkflowCommandPreview = {
    workflowId: spec.workflowId,
    workflowName: spec.workflowName,
    traceId,
    agent: spec.agent,
    stages: [...spec.stages],
    task,
    artifactNames,
    artifactCount: artifactNames.length,
  };

  const outputDir = resolveOutputDir(input, previewData.traceId);
  const artifactWriteResult = await writeWorkflowArtifacts(previewData, input, 'pending');

  try {
    if (input.options.dryRun) {
      const previewResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'preview');
      return { ...previewResult, success: true, traceId };
    }

    const runtimePayload: WorkflowInputPayload = {
      ...buildWorkflowInput(input),
      traceId,
      options: {
        provider: input.options.provider,
        sessionId: input.options.sessionId,
        outputDir,
        basePath: input.options.basePath,
        verbose: input.options.verbose,
        quiet: input.options.quiet,
      },
      traceContext: input.traceContext,
    };

    const execute = options?.runtimeDispatcher ?? executeWorkflowWithCLI;
    const execution = await execute(runtimePayload);

    if (!execution.success) {
      const errorCode = execution.errorCode ?? 'workflow_dispatch_failed';
      const errorMessage = execution.errorMessage ?? 'Workflow dispatch failed';
      const failResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'failed', {
        errorMessage,
        guard: execution.guard,
      });
      return { ...failResult, success: false, traceId, errorCode, errorMessage, guard: execution.guard };
    }

    const successResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'dispatched');
    return { ...successResult, success: true, traceId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failResult = await updateWorkflowArtifactsStatus(artifactWriteResult, 'failed', { errorMessage });
    return { ...failResult, success: false, traceId, errorCode: 'workflow_dispatch_failed', errorMessage };
  }
}

function resolveOutputDir(input: WorkflowCommandInput, traceId: string): string {
  if (input.options.outputDir !== undefined && input.options.outputDir.length > 0) {
    return input.options.outputDir;
  }

  return join(input.options.basePath ?? process.cwd(), '.automatosx', 'workflows', input.commandId, traceId);
}

function hasInputValue(value: string | boolean | undefined): value is string {
  return typeof value === 'string' ? value.length > 0 : false;
}

function hasRequiredWorkflowInputs(
  spec: WorkflowSpec,
  values: Record<string, string | boolean>,
): boolean {
  if (spec.requiredInputs.length === 0) {
    return true;
  }

  if (spec.requiredInputMode === 'any') {
    return spec.requiredInputs.some((key) => hasInputValue(values[key]));
  }

  return spec.requiredInputs.every((key) => hasInputValue(values[key]));
}

function buildTaskText(spec: WorkflowSpec, values: Record<string, string | boolean>): string {
  const parts = [...spec.taskTemplateBase];

  for (const [key, template] of Object.entries(spec.taskTemplateByArgument)) {
    const value = values[key];
    if (typeof value === 'string' && value.length > 0) {
      parts.push(applyTemplate(template, value));
    }
  }

  return parts.join(' ');
}

function buildRequiredInputError(spec: WorkflowSpec): string {
  const formatted = formatWorkflowInputSummary(spec.requiredInputs, spec.requiredInputMode);
  if (spec.requiredInputs.length === 1 || spec.requiredInputMode === 'any') {
    return `A ${formatted} is required for ${spec.commandId}`;
  }

  return `Required inputs for ${spec.commandId}: ${formatted}`;
}

function applyTemplate(template: string, value: string): string {
  return template.replaceAll('{{value}}', value);
}

function parseCommandArgs(args: string[]): {
  positionals: string[];
  options: Record<string, string>;
  boolOptions: {
    dryRun: boolean;
    verbose: boolean;
    quiet: boolean;
  };
  stringOptions: {
    provider?: string;
    outputDir?: string;
    [key: string]: string | undefined;
  };
} {
  const resultOptions: Record<string, string> = {};
  const boolOptions = {
    dryRun: false,
    verbose: false,
    quiet: false,
  };
  const stringOptions: Record<string, string | undefined> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      continue;
    }

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const [rawKey, rawValue] = raw.split('=', 2);
    const normalizedKey = normalizeCliOptionName(rawKey);

    if (normalizedKey.length === 0) {
      continue;
    }

    if (CLI_BOOLEAN_OPTIONS.has(normalizedKey)) {
      if (rawValue !== undefined) {
        boolOptions[normalizedKey as 'dryRun' | 'verbose' | 'quiet'] = rawValue !== 'false';
      } else {
        boolOptions[normalizedKey as 'dryRun' | 'verbose' | 'quiet'] = true;
      }
      continue;
    }

    if (rawValue !== undefined) {
      resultOptions[normalizedKey] = rawValue;
      stringOptions[normalizedKey] = rawValue;
      continue;
    }

    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      resultOptions[normalizedKey] = next;
      stringOptions[normalizedKey] = next;
      i += 1;
      continue;
    }

    resultOptions[normalizedKey] = 'true';
    stringOptions[normalizedKey] = 'true';
  }

  return { positionals, options: resultOptions, boolOptions, stringOptions };
}

function normalizeCliOptionName(rawKey: string | undefined): string {
  if (rawKey === undefined) {
    return '';
  }

  return rawKey.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
}

function normalizeBooleanValue(value: string | boolean): string | boolean {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

async function writeWorkflowArtifacts(
  preview: WorkflowCommandPreview,
  input: WorkflowCommandInput,
  status: WorkflowStatus,
): Promise<WorkflowArtifactWriteResult> {
  const outputDir = resolveOutputDir(input, preview.traceId);
  const artifactsDir = join(outputDir, 'artifacts');
  await mkdir(artifactsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const manifestPath = join(outputDir, 'manifest.json');
  const summaryPath = join(outputDir, 'summary.json');

  const artifactPaths = preview.artifactNames.map((artifactName, index) => {
    const fileName = `${String(index + 1).padStart(2, '0')}-${slugifyArtifactName(artifactName)}.md`;
    return join(artifactsDir, fileName);
  });

  const summary = {
    generatedAt,
    workflow: preview.workflowId,
    version: getWorkflowSpecVersion(preview.workflowId),
    name: preview.workflowName,
    traceId: preview.traceId,
    agent: preview.agent,
    task: preview.task,
    status,
    outputDir,
    inputs: { ...input.arguments },
    stages: [...preview.stages],
    artifacts: preview.artifactNames.map((artifactName, index) => ({ name: artifactName, path: artifactPaths[index] ?? join(artifactsDir, `${String(index + 1).padStart(2, '0')}-${slugifyArtifactName(artifactName)}.md`) })),
  };

  const manifest = {
    generatedAt,
    workflow: {
      id: preview.workflowId,
      version: getWorkflowSpecVersion(preview.workflowId),
      name: preview.workflowName,
    },
    traceId: preview.traceId,
    agent: preview.agent,
    status,
    outputDir,
    inputs: { ...input.arguments },
    task: preview.task,
    files: {
      summary: summaryPath,
      artifacts: artifactPaths,
    },
  };

  await Promise.all([
    writePrettyJsonFile(manifestPath, manifest),
    writePrettyJsonFile(summaryPath, summary),
  ]);

  const artifactContents = await Promise.all(
    artifactPaths.map(async (path, index) => ({
      path,
      markdown: await renderArtifactMarkdown(preview, index + 1, status),
    })),
  );

  await Promise.all(artifactContents.map(({ path, markdown }) => writeFile(path, `${markdown}\n`, 'utf8')));

  return {
    outputDir,
    manifestPath,
    summaryPath,
    artifactPaths,
  };
}

async function updateWorkflowArtifactsStatus(
  result: WorkflowArtifactWriteResult,
  status: WorkflowStatus,
  options: {
    errorMessage?: string;
    guard?: WorkflowCommandGuardSummary;
  } = {},
): Promise<WorkflowCommandResult> {
  const updatedAt = new Date().toISOString();
  const { errorMessage, guard } = options;

  const [manifestData, summaryData] = await Promise.all([
    readArtifactDocument(result.manifestPath),
    readArtifactDocument(result.summaryPath),
  ]);

  const updatedArtifacts = await Promise.all(
    result.artifactPaths.map(async (artifactPath) => {
      const artifactContent = await readFile(artifactPath, 'utf8');
      return {
        artifactPath,
        content: updateArtifactMarkdownContent(artifactContent, status, { errorMessage, guard }),
      };
    }),
  );

  await Promise.all([
    writeFile(
      result.manifestPath,
      `${JSON.stringify({
        ...manifestData,
        status,
        updatedAt,
        ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        ...(guard !== undefined ? { guard } : {}),
      }, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      result.summaryPath,
      `${JSON.stringify({
        ...summaryData,
        status,
        updatedAt,
        ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        ...(guard !== undefined ? { guard } : {}),
      }, null, 2)}\n`,
      'utf8',
    ),
    ...updatedArtifacts.map(({ artifactPath, content }) => writeFile(artifactPath, content, 'utf8')),
  ]);

  const resolvedTraceId = typeof manifestData['traceId'] === 'string' ? manifestData['traceId'] : randomUUID();
  return {
    success: true,
    traceId: resolvedTraceId,
    outputDir: result.outputDir,
    manifestPath: result.manifestPath,
    summaryPath: result.summaryPath,
    artifactPaths: result.artifactPaths,
    ...(guard !== undefined ? { guard } : {}),
  };
}

async function readArtifactDocument(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseJsonObjectString(raw);
    if (parsed.error !== undefined) {
      return {};
    }
    const result = artifactDocumentSchema.safeParse(parsed.value);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function getWorkflowSpecVersion(workflowId: string): string {
  return getSharedWorkflowCatalogEntry(workflowId)?.version ?? 'v0';
}

function slugifyArtifactName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll('/', '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artifact';
}

async function renderArtifactMarkdown(
  preview: WorkflowCommandPreview,
  index: number,
  status: WorkflowStatus,
): Promise<string> {
  const artifactName = preview.artifactNames[index - 1] ?? `artifact-${index}`;
  const inputRows = Object.entries(previewInputs(preview)).map(([key, value]) => `- ${key}: ${String(value)}`);

  return [
    `# ${artifactName}`,
    '',
    `- Workflow: ${preview.workflowId}@${getWorkflowSpecVersion(preview.workflowId)}`,
    `- Trace ID: ${preview.traceId}`,
    `- Agent: ${preview.agent}`,
    `- Status: ${status}`,
    '',
    '## Inputs',
    ...(inputRows.length > 0 ? inputRows : ['- No explicit workflow inputs were provided.']),
    '',
    '## Task',
    preview.task,
    '',
    `## Notes`,
    `This artifact was generated as part of workflow ${preview.workflowId}.`,
    `Use workflow execution output to replace or enrich this placeholder.`,
  ].join('\n');
}

function updateArtifactMarkdownContent(
  content: string,
  status: WorkflowStatus,
  options: {
    errorMessage?: string;
    guard?: WorkflowCommandGuardSummary;
  },
): string {
  const base = stripDispatchOutcomeSection(
    content.replace(/^- Status: .+$/m, `- Status: ${status}`),
  );
  const dispatchOutcome = renderDispatchOutcomeSection(status, options);
  return dispatchOutcome === undefined ? base : `${base}\n${dispatchOutcome}`;
}

function stripDispatchOutcomeSection(content: string): string {
  return content.replace(/\n## Dispatch Outcome\n[\s\S]*$/m, '').trimEnd();
}

function renderDispatchOutcomeSection(
  status: WorkflowStatus,
  options: {
    errorMessage?: string;
    guard?: WorkflowCommandGuardSummary;
  },
): string | undefined {
  const { errorMessage, guard } = options;
  if (errorMessage === undefined && guard === undefined) {
    return undefined;
  }

  const lines = [
    '',
    '## Dispatch Outcome',
    `- Status: ${status}`,
  ];

  if (errorMessage !== undefined) {
    lines.push(`- Error: ${errorMessage}`);
  }

  if (guard !== undefined) {
    lines.push(`- Policy: ${guard.summary}`);
    if (guard.toolName !== undefined) {
      lines.push(`- Policy tool: ${guard.toolName}`);
    }
    if (guard.trustState !== undefined) {
      lines.push(`- Policy trust: ${guard.trustState}`);
    }
    if (guard.requiredTrustStates !== undefined && guard.requiredTrustStates.length > 0) {
      lines.push(`- Policy requires: ${guard.requiredTrustStates.join(', ')}`);
    }
    if (guard.sourceRef !== undefined) {
      lines.push(`- Policy source: ${guard.sourceRef}`);
    }
  }

  return lines.join('\n');
}

function previewInputs(preview: WorkflowCommandPreview): Record<string, string> {
  return {
    workflowId: preview.workflowId,
    workflowName: preview.workflowName,
    traceId: preview.traceId,
    agent: preview.agent,
    task: preview.task,
  };
}

async function executeWorkflowWithCLI(payload: WorkflowInputPayload): Promise<WorkflowCommandResult> {
  const runResult: CommandResult = await runCommand(
    [payload.workflowId],
    toRunOptions(payload),
  );
  const runData = asWorkflowRunData(runResult.data);

  if (!runResult.success) {
    return {
      success: false,
      traceId: payload.traceId,
      outputDir: payload.options.outputDir ?? resolveOutputDirFromPayload(payload),
      manifestPath: undefined,
      summaryPath: undefined,
      artifactPaths: [],
      errorCode: 'workflow_runtime_failed',
      errorMessage: runResult.message ?? 'Workflow runtime failed',
      guard: runData?.guard,
    };
  }

  return {
    success: true,
    traceId: payload.traceId,
    outputDir: payload.options.outputDir ?? resolveOutputDirFromPayload(payload),
    manifestPath: undefined,
    summaryPath: undefined,
    artifactPaths: [],
  };
}

function asWorkflowRunData(value: unknown): { guard?: WorkflowCommandGuardSummary } | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const guard = asWorkflowCommandGuardSummary(candidate.guard);
  return guard === undefined ? undefined : { guard };
}

function asWorkflowCommandGuardSummary(value: unknown): WorkflowCommandGuardSummary | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const summary = typeof candidate.summary === 'string' && candidate.summary.trim().length > 0
    ? candidate.summary.trim()
    : undefined;
  const failedGates = Array.isArray(candidate.failedGates)
    ? candidate.failedGates.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    : [];
  if (summary === undefined || typeof candidate.blockedByRuntimeGovernance !== 'boolean') {
    return undefined;
  }
  const failedGateMessages = Array.isArray(candidate.failedGateMessages)
    ? candidate.failedGateMessages.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    : undefined;
  const requiredTrustStates = Array.isArray(candidate.requiredTrustStates)
    ? candidate.requiredTrustStates.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    : undefined;
  return {
    summary,
    failedGates,
    blockedByRuntimeGovernance: candidate.blockedByRuntimeGovernance,
    guardId: typeof candidate.guardId === 'string' ? candidate.guardId : undefined,
    failedStepId: typeof candidate.failedStepId === 'string' ? candidate.failedStepId : undefined,
    failedGateMessages,
    toolName: typeof candidate.toolName === 'string' ? candidate.toolName : undefined,
    trustState: typeof candidate.trustState === 'string' ? candidate.trustState : undefined,
    requiredTrustStates,
    sourceRef: typeof candidate.sourceRef === 'string' ? candidate.sourceRef : undefined,
  };
}

function resolveOutputDirFromPayload(payload: WorkflowInputPayload): string {
  if (payload.options.outputDir !== undefined && payload.options.outputDir.length > 0) {
    return payload.options.outputDir;
  }

  return join(payload.options.basePath ?? process.cwd(), '.automatosx', 'workflows', payload.workflowId, payload.traceId);
}

function toRunOptions(payload: WorkflowInputPayload): CLIOptions {
  const runtimeBasePath = payload.options.basePath ?? process.cwd();

  return {
    help: false,
    version: false,
    verbose: Boolean(payload.options.verbose),
    format: 'text',
    workflowDir: undefined,
    workflowId: payload.workflowId,
    traceId: payload.traceId,
    limit: undefined,
    input: undefined,
    iterate: false,
    maxIterations: undefined,
    maxTime: undefined,
    noContext: false,
    category: undefined,
    tags: undefined,
    agent: payload.agent,
    task: payload.task,
    core: undefined,
    maxTokens: undefined,
    refresh: undefined,
    compact: false,
    team: undefined,
    provider: payload.options.provider,
    sessionId: payload.options.sessionId,
    outputDir: payload.options.outputDir,
    basePath: runtimeBasePath,
    dryRun: false,
    quiet: Boolean(payload.options.quiet),
  };
}
