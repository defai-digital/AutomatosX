import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findWorkflowDir, type StepGuardPolicy } from '@defai.digital/workflow-engine';
import {
  createTraceStore,
  type TraceStore,
} from '@defai.digital/trace-store';
import {
  createStateStore,
  type PolicyEntry,
  type StateStore,
} from '@defai.digital/state-store';
import {
  buildFeedbackAdjustment,
  buildFeedbackOverview,
  buildFeedbackStats,
  filterAbilities,
  injectAbilities,
} from './runtime-ability-support.js';
import {
  BUILTIN_ABILITIES,
  BUILTIN_GUARD_POLICIES,
  DEFAULT_DISCUSSION_CONCURRENCY,
  DEFAULT_DISCUSSION_PROVIDER_BUDGET,
  DEFAULT_DISCUSSION_ROUNDS,
} from './runtime-builtins.js';
import {
  getValueAtPath,
  listConfiguredExecutors,
  readWorkspaceConfig,
  setValueAtPath,
  writeWorkspaceConfig,
} from './runtime-config-support.js';
import { createRuntimeDependencyResolvers } from './runtime-dependency-resolvers.js';
import { createRuntimeExecutionService } from './runtime-execution-service.js';
import { createRuntimeGitService } from './runtime-git-service.js';
import {
  buildGuardPolicySummaries,
  resolveGuardPoliciesForCheck,
  resolveGuardPolicyDefinition,
} from './runtime-guard-policy-support.js';
import { createRuntimeOrchestrationService } from './runtime-orchestration-service.js';
import { createRuntimeQueryService } from './runtime-query-service.js';
import { createRuntimeSkillService } from './runtime-skill-service.js';
import { createRuntimeStateService } from './runtime-state-service.js';
import { analyzeTraceRecord } from './runtime-trace-analysis.js';
import type {
  SharedRuntimeConfig,
  SharedRuntimeService,
} from './runtime-service-types.js';
import { resolveEffectiveWorkflowDir } from './stable-workflow-paths.js';

export function createSharedRuntimeService(config: SharedRuntimeConfig = {}): SharedRuntimeService {
  const basePath = config.basePath ?? homedir();
  const traceStore = config.traceStore ?? createTraceStore({ basePath });
  const stateStore = config.stateStore ?? createStateStore({ basePath });
  const providerDependencies = createRuntimeDependencyResolvers({
    basePath,
    maxConcurrentDiscussions: config.maxConcurrentDiscussions ?? DEFAULT_DISCUSSION_CONCURRENCY,
    maxProvidersPerDiscussion: config.maxProvidersPerDiscussion ?? DEFAULT_DISCUSSION_PROVIDER_BUDGET,
    maxDiscussionRounds: config.maxDiscussionRounds ?? DEFAULT_DISCUSSION_ROUNDS,
  });

  const queryService = createRuntimeQueryService({
    basePath,
    traceStore,
    stateStore,
    providerBridge: providerDependencies.providerBridge,
    readWorkspaceConfig,
    writeWorkspaceConfig,
    listConfiguredExecutors,
    resolveWorkflowDir,
    getValueAtPath,
    setValueAtPath,
    analyzeTraceRecord,
  });
  const resolveBuiltinGuardPolicyDefinition = (
    policyId: string | undefined,
    definition: StepGuardPolicy | undefined,
  ) => resolveGuardPolicyDefinition(BUILTIN_GUARD_POLICIES, policyId, definition);
  const resolveBuiltinGuardPoliciesForCheck = (
    _: StateStore,
    policyId?: string,
  ) => resolveGuardPoliciesForCheck(stateStore, BUILTIN_GUARD_POLICIES, policyId);
  const buildBuiltinGuardPolicySummaries = (policies: PolicyEntry[]) => (
    buildGuardPolicySummaries(BUILTIN_GUARD_POLICIES, policies)
  );

  const stateService = createRuntimeStateService({
    stateStore,
    builtinAbilities: BUILTIN_ABILITIES,
    buildFeedbackStats,
    buildFeedbackOverview,
    buildFeedbackAdjustment,
    filterAbilities,
    injectAbilities,
    buildGuardPolicySummaries: buildBuiltinGuardPolicySummaries,
    resolveGuardPolicyDefinition: resolveBuiltinGuardPolicyDefinition,
    resolveGuardPoliciesForCheck: resolveBuiltinGuardPoliciesForCheck,
  });
  const gitService = createRuntimeGitService({ basePath });
  const orchestrationService = createRuntimeOrchestrationService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge: providerDependencies.resolveProviderBridge,
    resolveDiscussionCoordinator: providerDependencies.resolveDiscussionCoordinator,
    createTraceId: randomUUID,
    tokenize,
  });
  const executionService = createRuntimeExecutionService({
    basePath,
    traceStore,
    stateStore,
    resolveProviderBridge: providerDependencies.resolveProviderBridge,
    resolveDiscussionCoordinator: providerDependencies.resolveDiscussionCoordinator,
    resolveWorkflowDir,
    resolveGuardPolicies: () => resolveBuiltinGuardPoliciesForCheck(stateStore),
    tokenize,
    createTraceId: randomUUID,
    runAgent: orchestrationService.runAgent,
  });
  const skillService = createRuntimeSkillService({
    basePath,
    traceStore,
    stateStore,
    createTraceId: randomUUID,
    runAgent: orchestrationService.runAgent,
  });

  return {
    ...executionService,
    ...orchestrationService,
    ...skillService,
    ...queryService,
    ...gitService,
    ...stateService,
    getStores() {
      return { traceStore, stateStore };
    },
  };
}

function resolveWorkflowDir(
  explicitWorkflowDir: string | undefined,
  requestBasePath: string | undefined,
  defaultBasePath: string,
): string {
  const resolvedBasePath = requestBasePath ?? defaultBasePath;
  return resolveEffectiveWorkflowDir({
    workflowDir: explicitWorkflowDir,
    basePath: resolvedBasePath,
  }) ?? findWorkflowDir(resolvedBasePath) ?? join(resolvedBasePath, 'workflows');
}

function tokenize(value: string): number {
  const trimmed = value.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
