import { randomUUID } from 'node:crypto';
import { createStepGuardEngine, type StepGuardContext, type StepGuardPolicy } from '@defai.digital/workflow-engine';
import type {
  AgentEntry,
  FeedbackEntry,
  MemoryEntry,
  PolicyEntry,
  SemanticEntry,
  SemanticNamespaceStats,
  SemanticSearchResult,
  SessionEntry,
  SessionParticipantRole,
  StateStore,
} from '@defai.digital/state-store';
import type {
  RuntimeAbility,
  RuntimeAbilityInjection,
  RuntimeFeedbackAdjustment,
  RuntimeFeedbackOverview,
  RuntimeFeedbackStats,
  RuntimeGuardCheckResponse,
  RuntimeGuardPolicySummary,
  SharedRuntimeService,
} from './index.js';

export interface RuntimeStateServiceConfig {
  stateStore: StateStore;
  builtinAbilities: RuntimeAbility[];
  buildFeedbackStats(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackStats;
  buildFeedbackOverview(entries: FeedbackEntry[]): RuntimeFeedbackOverview;
  buildFeedbackAdjustment(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackAdjustment;
  filterAbilities(
    abilities: RuntimeAbility[],
    options?: { category?: string; tags?: string[] },
  ): RuntimeAbility[];
  injectAbilities(
    abilities: RuntimeAbility[],
    request: {
      task: string;
      requiredAbilities?: string[];
      category?: string;
      tags?: string[];
      maxAbilities?: number;
      includeMetadata?: boolean;
    },
  ): RuntimeAbilityInjection;
  buildGuardPolicySummaries(policies: PolicyEntry[]): RuntimeGuardPolicySummary[];
  resolveGuardPolicyDefinition(
    policyId: string | undefined,
    definition: StepGuardPolicy | undefined,
  ): StepGuardPolicy;
  resolveGuardPoliciesForCheck(stateStore: StateStore, policyId?: string): Promise<StepGuardPolicy[]>;
}

type RuntimeStateService = Pick<
  SharedRuntimeService,
  | 'storeMemory'
  | 'getMemory'
  | 'searchMemory'
  | 'deleteMemory'
  | 'listMemory'
  | 'storeSemantic'
  | 'searchSemantic'
  | 'getSemantic'
  | 'listSemantic'
  | 'deleteSemantic'
  | 'clearSemantic'
  | 'semanticStats'
  | 'submitFeedback'
  | 'listFeedbackHistory'
  | 'getFeedbackStats'
  | 'getFeedbackOverview'
  | 'getFeedbackAdjustments'
  | 'listAbilities'
  | 'injectAbilities'
  | 'registerPolicy'
  | 'listPolicies'
  | 'listGuardPolicies'
  | 'applyGuardPolicy'
  | 'checkGuards'
  | 'registerAgent'
  | 'getAgent'
  | 'listAgents'
  | 'removeAgent'
  | 'listAgentCapabilities'
  | 'createSession'
  | 'getSession'
  | 'listSessions'
  | 'joinSession'
  | 'leaveSession'
  | 'completeSession'
  | 'failSession'
  | 'closeStuckSessions'
>;

export function createRuntimeStateService(config: RuntimeStateServiceConfig): RuntimeStateService {
  const {
    stateStore,
    builtinAbilities,
    buildFeedbackStats,
    buildFeedbackOverview,
    buildFeedbackAdjustment,
    filterAbilities,
    injectAbilities,
    buildGuardPolicySummaries,
    resolveGuardPolicyDefinition,
    resolveGuardPoliciesForCheck,
  } = config;

  return {
    storeMemory(entry) {
      return stateStore.storeMemory(entry);
    },

    getMemory(key, namespace) {
      return stateStore.getMemory(key, namespace);
    },

    searchMemory(query, namespace) {
      return stateStore.searchMemory(query, namespace);
    },

    deleteMemory(key, namespace) {
      return stateStore.deleteMemory(key, namespace);
    },

    listMemory(namespace) {
      return stateStore.listMemory(namespace);
    },

    storeSemantic(entry) {
      return stateStore.storeSemantic(entry);
    },

    searchSemantic(query, options) {
      return stateStore.searchSemantic(query, options);
    },

    getSemantic(key, namespace) {
      return stateStore.getSemantic(key, namespace);
    },

    listSemantic(options) {
      return stateStore.listSemantic(options);
    },

    deleteSemantic(key, namespace) {
      return stateStore.deleteSemantic(key, namespace);
    },

    clearSemantic(namespace) {
      return stateStore.clearSemantic(namespace);
    },

    semanticStats(namespace) {
      return stateStore.semanticStats(namespace);
    },

    submitFeedback(entry) {
      return stateStore.submitFeedback(entry);
    },

    listFeedbackHistory(options) {
      return stateStore.listFeedback(options);
    },

    async getFeedbackStats(agentId) {
      const entries = await stateStore.listFeedback({ agentId });
      return buildFeedbackStats(agentId, entries);
    },

    async getFeedbackOverview() {
      const entries = await stateStore.listFeedback();
      return buildFeedbackOverview(entries);
    },

    async getFeedbackAdjustments(agentId) {
      const entries = await stateStore.listFeedback({ agentId });
      return buildFeedbackAdjustment(agentId, entries);
    },

    async listAbilities(options) {
      return filterAbilities(builtinAbilities, options);
    },

    async injectAbilities(request) {
      return injectAbilities(builtinAbilities, request);
    },

    registerPolicy(entry) {
      return stateStore.registerPolicy(entry);
    },

    listPolicies() {
      return stateStore.listPolicies();
    },

    async listGuardPolicies() {
      const policies = await stateStore.listPolicies();
      return buildGuardPolicySummaries(policies);
    },

    async applyGuardPolicy(request) {
      const definition = resolveGuardPolicyDefinition(request.policyId, request.definition);
      return stateStore.registerPolicy({
        policyId: definition.policyId,
        name: definition.name,
        enabled: request.enabled ?? definition.enabled,
        metadata: {
          guardPolicy: definition,
          source: request.definition === undefined ? 'builtin' : 'stored',
        },
      });
    },

    async checkGuards(request) {
      const policies = await resolveGuardPoliciesForCheck(stateStore, request.policyId);
      const engine = createStepGuardEngine();
      for (const policy of policies) {
        engine.registerPolicy(policy);
      }

      const context: StepGuardContext = {
        agentId: request.agentId ?? 'cli',
        executionId: request.executionId ?? randomUUID(),
        sessionId: request.sessionId,
        stepId: request.stepId,
        stepType: request.stepType,
        stepIndex: request.stepIndex ?? 0,
        totalSteps: request.totalSteps ?? 1,
        previousOutputs: request.previousOutputs ?? {},
        stepConfig: request.stepConfig,
        workflowId: request.workflowId,
      };
      const position = request.position ?? 'before';
      const results = position === 'after'
        ? await engine.runAfterGuards(context)
        : await engine.runBeforeGuards(context);

      return {
        policyIds: policies.map((policy) => policy.policyId),
        position,
        blocked: engine.shouldBlock(results),
        context,
        results,
      } satisfies RuntimeGuardCheckResponse;
    },

    registerAgent(entry) {
      return stateStore.registerAgent(entry);
    },

    getAgent(agentId) {
      return stateStore.getAgent(agentId);
    },

    listAgents() {
      return stateStore.listAgents();
    },

    removeAgent(agentId) {
      return stateStore.removeAgent(agentId);
    },

    listAgentCapabilities() {
      return stateStore.listAgentCapabilities();
    },

    createSession(entry) {
      return stateStore.createSession(entry);
    },

    getSession(sessionId) {
      return stateStore.getSession(sessionId);
    },

    listSessions() {
      return stateStore.listSessions();
    },

    joinSession(entry) {
      return stateStore.joinSession(entry);
    },

    leaveSession(sessionId, agentId) {
      return stateStore.leaveSession(sessionId, agentId);
    },

    completeSession(sessionId, summary) {
      return stateStore.completeSession(sessionId, summary);
    },

    failSession(sessionId, message) {
      return stateStore.failSession(sessionId, message);
    },

    closeStuckSessions(maxAgeMs) {
      return stateStore.closeStuckSessions(maxAgeMs);
    },
  };
}
