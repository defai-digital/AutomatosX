import { createRuntime } from '../utils/formatters.js';
import type {
  DeniedInstalledBridgeAggregate,
  RuntimeGovernanceAggregate,
} from '../utils/runtime-guard-summary.js';

export interface MonitorConfig {
  portMin: number;
  portMax: number;
  autoOpen: boolean;
}

export interface MonitorProviderSnapshot {
  source: 'cached' | 'unavailable';
  generatedAt?: string;
  detectedProviders: string[];
  enabledProviders: string[];
  installedButDisabledProviders: string[];
  configuredButUnavailableProviders: string[];
}

export type RuntimeService = ReturnType<typeof createRuntime>;
type RuntimeWorkflowSummary = Awaited<ReturnType<RuntimeService['listWorkflows']>>[number];

export interface MonitorApiState {
  status: Awaited<ReturnType<RuntimeService['getStatus']>>;
  governance: RuntimeGovernanceAggregate;
  deniedInstalledBridges: DeniedInstalledBridgeAggregate;
  providers: MonitorProviderSnapshot;
  sessions: Awaited<ReturnType<RuntimeService['listSessions']>>;
  agents: Awaited<ReturnType<RuntimeService['listAgents']>>;
  traces: Awaited<ReturnType<RuntimeService['listTraces']>>;
  workflows: MonitorWorkflowEntry[];
}

export interface MonitorWorkflowEntry extends RuntimeWorkflowSummary {
  description?: string;
  agentId?: string;
  artifactNames?: string[];
  requiredInputs?: string[];
  optionalInputs?: string[];
  whenToUse?: string[];
  avoidWhen?: string[];
  examples?: string[];
  stages?: string[];
  stepDefinitions?: Array<{ stepId: string; type: string }>;
  stableSurface?: boolean;
  source?: 'bundled-definition' | 'workspace-definition' | 'stable-catalog';
  workflowDir?: string;
}
