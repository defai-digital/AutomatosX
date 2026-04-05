import {
  getWorkflowCatalogEntry,
  listWorkflowCatalog,
  type WorkflowCatalogEntry,
} from '../workflow-adapter.js';
import {
  isBundledWorkflowDir,
  resolveBundledWorkflowDir,
} from '../workflow-paths.js';
import type {
  MonitorWorkflowEntry,
  RuntimeService,
} from './monitor-types.js';

export async function loadMonitorWorkflowDetail(
  runtime: RuntimeService,
  workflowId: string,
  basePath: string,
  workflowDir: string | undefined,
  stateWorkflows: MonitorWorkflowEntry[],
): Promise<MonitorWorkflowEntry | undefined> {
  const summary = stateWorkflows.find((workflow) => workflow.workflowId === workflowId);
  const catalogEntry = getWorkflowCatalogEntry(workflowId);
  const bundledWorkflowDir = catalogEntry === undefined ? undefined : resolveBundledWorkflowDir();
  const candidateDirs = uniqueStringValues([workflowDir, bundledWorkflowDir]);

  let describedWorkflow: Awaited<ReturnType<RuntimeService['describeWorkflow']>> | undefined;
  for (const candidateDir of candidateDirs) {
    describedWorkflow = await runtime.describeWorkflow({
      workflowId,
      workflowDir: candidateDir,
      basePath,
    });
    if (describedWorkflow !== undefined) {
      break;
    }
  }

  if (summary === undefined && catalogEntry === undefined && describedWorkflow === undefined) {
    return undefined;
  }

  const source = summary?.source ?? resolveMonitorWorkflowSource({
    describedSource: describedWorkflow?.source,
    describedWorkflowDir: describedWorkflow?.workflowDir,
    workflowDir,
    bundledWorkflowDir,
    fallback: 'stable-catalog',
  });

  return {
    workflowId: summary?.workflowId ?? describedWorkflow?.workflowId ?? catalogEntry?.workflowId ?? workflowId,
    name: summary?.name ?? describedWorkflow?.name ?? catalogEntry?.workflowName,
    version: summary?.version ?? describedWorkflow?.version ?? catalogEntry?.version ?? 'unknown',
    steps: summary?.steps ?? describedWorkflow?.steps.length ?? catalogEntry?.stages.length ?? 0,
    description: summary?.description ?? describedWorkflow?.description ?? catalogEntry?.description,
    agentId: summary?.agentId ?? catalogEntry?.agentId,
    artifactNames: summary?.artifactNames ?? cloneOptionalStringArray(catalogEntry?.artifactNames),
    requiredInputs: summary?.requiredInputs ?? cloneOptionalStringArray(catalogEntry?.requiredInputs),
    optionalInputs: summary?.optionalInputs ?? cloneOptionalStringArray(catalogEntry?.optionalInputs),
    whenToUse: summary?.whenToUse ?? cloneOptionalStringArray(catalogEntry?.whenToUse),
    avoidWhen: summary?.avoidWhen ?? cloneOptionalStringArray(catalogEntry?.avoidWhen),
    examples: summary?.examples ?? cloneOptionalStringArray(catalogEntry?.examples),
    stages: summary?.stages ?? cloneOptionalStringArray(catalogEntry?.stages),
    stableSurface: summary?.stableSurface ?? catalogEntry !== undefined,
    source,
    stepDefinitions: describedWorkflow?.steps.map((step) => ({
      stepId: step.stepId,
      type: step.type,
    })),
    workflowDir: describedWorkflow?.workflowDir ?? summary?.workflowDir,
  };
}

export async function loadMonitorWorkflows(
  runtime: RuntimeService,
  basePath: string,
  workflowDir: string | undefined,
): Promise<MonitorWorkflowEntry[]> {
  const discoveredWorkflows = workflowDir === undefined
    ? []
    : await runtime.listWorkflows({ basePath, workflowDir });
  const discoveredById = new Map(discoveredWorkflows.map((workflow) => [workflow.workflowId, workflow] as const));
  const bundledWorkflowDir = resolveBundledWorkflowDir();
  const stableCatalog = listWorkflowCatalog().map((catalogEntry) => {
    const discovered = discoveredById.get(catalogEntry.workflowId);
    return mergeWorkflowSummary(catalogEntry, discovered, workflowDir, bundledWorkflowDir);
  });
  const stableIds = new Set(stableCatalog.map((workflow) => workflow.workflowId));
  const customWorkflows: MonitorWorkflowEntry[] = discoveredWorkflows
    .filter((workflow) => !stableIds.has(workflow.workflowId))
    .map((workflow) => ({
      ...workflow,
      stableSurface: false,
      source: resolveMonitorWorkflowSource({
        workflowDir,
        bundledWorkflowDir,
        fallback: 'workspace-definition',
      }),
    }));

  return [...stableCatalog, ...customWorkflows];
}

function mergeWorkflowSummary(
  catalogEntry: WorkflowCatalogEntry,
  discovered: Awaited<ReturnType<RuntimeService['listWorkflows']>>[number] | undefined,
  workflowDir: string | undefined,
  bundledWorkflowDir: string | undefined,
): MonitorWorkflowEntry {
  const source = resolveMonitorWorkflowSource({
    workflowDir,
    bundledWorkflowDir,
    fallback: discovered === undefined ? 'stable-catalog' : 'workspace-definition',
  });

  return {
    workflowId: catalogEntry.workflowId,
    name: discovered?.name ?? catalogEntry.workflowName,
    version: discovered?.version ?? catalogEntry.version,
    steps: discovered?.steps ?? catalogEntry.stages.length,
    description: catalogEntry.description,
    agentId: catalogEntry.agentId,
    artifactNames: [...catalogEntry.artifactNames],
    requiredInputs: [...catalogEntry.requiredInputs],
    optionalInputs: [...catalogEntry.optionalInputs],
    whenToUse: [...catalogEntry.whenToUse],
    avoidWhen: [...catalogEntry.avoidWhen],
    examples: [...catalogEntry.examples],
    stages: [...catalogEntry.stages],
    stableSurface: true,
    source,
  };
}

function resolveMonitorWorkflowSource(input: {
  describedSource?: 'stable-catalog' | 'workflow-definition';
  describedWorkflowDir?: string;
  workflowDir?: string;
  bundledWorkflowDir?: string;
  fallback: MonitorWorkflowEntry['source'];
}): MonitorWorkflowEntry['source'] {
  if (input.describedSource === 'stable-catalog') {
    return 'stable-catalog';
  }

  const candidateWorkflowDir = input.describedWorkflowDir ?? input.workflowDir;
  if (
    candidateWorkflowDir !== undefined
    && input.bundledWorkflowDir !== undefined
    && isBundledWorkflowDir(candidateWorkflowDir)
    && candidateWorkflowDir === input.bundledWorkflowDir
  ) {
    return 'bundled-definition';
  }

  return input.fallback;
}

function uniqueStringValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function cloneOptionalStringArray(values: string[] | undefined): string[] | undefined {
  return values === undefined ? undefined : [...values];
}
