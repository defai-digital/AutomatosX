/**
 * Phase 5 Integration
 *
 * Integrates Phase 5 features into the REPL:
 * - Provider routing transparency
 * - Memory search suggestions
 * - Agent delegation preview
 * - Cross-tool hand-offs
 *
 * Pattern: Similar to phase4-integration.ts - provides initialization,
 * update functions, and feature management for Phase 5 capabilities
 */

import {
  ProviderUsageTracker,
  renderProviderRoute,
  renderProviderMetrics,
  renderInlineRoutingNotification,
  createRouteFromTrace,
  type ProviderRoute,
  type ProviderMetrics
} from './provider-transparency.js';

import {
  generateMemorySuggestions,
  renderMemorySuggestions,
  shouldSuggestMemorySearch,
  renderInlineMemoryHint,
  type MemorySuggestion
} from './memory-suggestions.js';

import {
  generateDelegationPreview,
  renderDelegationPreview,
  renderInlineDelegationPrompt,
  compareAgentsForTask,
  renderAgentComparison,
  type AgentDelegationPreview
} from './agent-preview.js';

import {
  suggestHandoff,
  renderHandoffSuggestion,
  detectAvailableTools,
  type HandoffContext,
  type ToolType
} from './cross-tool-handoffs.js';

import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Phase 5 features container
 */
export interface Phase5Features {
  // Trackers
  providerTracker: ProviderUsageTracker;

  // State
  sessionId: string;
  workspaceRoot: string;
  currentProvider: string;
  availableTools: Record<ToolType, boolean>;

  // Context for suggestions
  recentCommands: string[];
  activeAgents: string[];
  currentTask?: string;

  // Metrics
  startTime: Date;
  totalProviderCalls: number;
  totalAgentDelegations: number;
  totalHandoffs: number;
}

/**
 * Initialize Phase 5 features
 */
export async function initPhase5Features(
  workspaceRoot: string,
  sessionId: string,
  provider: string
): Promise<Phase5Features> {
  const startTime = new Date();

  // Initialize provider tracker
  const providerTracker = new ProviderUsageTracker();

  // Detect available external tools
  const availableTools = await detectAvailableTools();

  return {
    providerTracker,
    sessionId,
    workspaceRoot,
    currentProvider: provider,
    availableTools,
    recentCommands: [],
    activeAgents: [],
    startTime,
    totalProviderCalls: 0,
    totalAgentDelegations: 0,
    totalHandoffs: 0
  };
}

/**
 * Show startup banner with Phase 5 features
 */
export function showPhase5StartupBanner(features: Phase5Features): void {
  const toolCount = Object.values(features.availableTools).filter(Boolean).length;

  const lines = [
    chalk.bold('Phase 5 Features Active:'),
    '',
    `${chalk.green('✓')} Provider Transparency - Routing decision visibility`,
    `${chalk.green('✓')} Memory Suggestions - Context-based memory hints`,
    `${chalk.green('✓')} Agent Preview - See what agents will do`,
    `${chalk.green('✓')} Cross-Tool Hand-offs - ${toolCount} external tools available`,
    '',
    chalk.dim(`Session: ${features.sessionId}`),
    chalk.dim(`Workspace: ${features.workspaceRoot}`)
  ];

  console.log(
    boxen(lines.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'magenta'
    })
  );
  console.log();
}

/**
 * Track provider usage
 */
export function trackProviderUsage(
  features: Phase5Features,
  provider: string,
  cost: number,
  latency: number,
  success: boolean,
  trace?: {
    selectedProvider: string;
    reason: string;
    candidates?: Array<{ provider: string; score: number; available: boolean }>;
    estimatedCost?: number;
    estimatedLatency?: number;
  }
): void {
  features.totalProviderCalls++;
  features.providerTracker.recordUsage(provider, cost, latency, success);

  // Show routing decision if trace provided
  if (trace) {
    const route = createRouteFromTrace(trace);
    console.log(renderInlineRoutingNotification(route));
  }
}

/**
 * Get memory suggestions for current context
 */
export function getMemorySuggestionsForContext(
  features: Phase5Features
): MemorySuggestion[] {
  return generateMemorySuggestions({
    currentTask: features.currentTask,
    recentCommands: features.recentCommands,
    activeAgents: features.activeAgents
  });
}

/**
 * Show memory suggestions
 */
export function showMemorySuggestions(features: Phase5Features): void {
  const suggestions = getMemorySuggestionsForContext(features);

  if (suggestions.length > 0) {
    console.log(renderMemorySuggestions(suggestions));
  }
}

/**
 * Auto-suggest memory search after command
 */
export function autoSuggestMemorySearch(
  features: Phase5Features,
  command: string,
  errorOccurred: boolean
): void {
  const suggestion = shouldSuggestMemorySearch(command, {
    errorOccurred,
    similarPastCommand: features.recentCommands.includes(command)
  });

  if (suggestion) {
    console.log(renderInlineMemoryHint(suggestion));
  }
}

/**
 * Track command for memory suggestions
 */
export function trackCommand(
  features: Phase5Features,
  command: string
): void {
  features.recentCommands.push(command);

  // Keep only last 10 commands
  if (features.recentCommands.length > 10) {
    features.recentCommands.shift();
  }
}

/**
 * Set current task
 */
export function setCurrentTask(
  features: Phase5Features,
  task: string
): void {
  features.currentTask = task;
}

/**
 * Track agent delegation
 */
export function trackAgentDelegationPhase5(
  features: Phase5Features,
  agentName: string
): void {
  features.totalAgentDelegations++;

  if (!features.activeAgents.includes(agentName)) {
    features.activeAgents.push(agentName);
  }

  // Keep only last 5 agents
  if (features.activeAgents.length > 5) {
    features.activeAgents.shift();
  }
}

/**
 * Generate and show agent preview
 */
export function showAgentPreview(
  features: Phase5Features,
  agent: string,
  task: string
): AgentDelegationPreview {
  const preview = generateDelegationPreview(agent, task, {
    projectType: detectProjectType(features.workspaceRoot),
    recentActivity: features.recentCommands
  });

  console.log(renderDelegationPreview(preview));

  return preview;
}

/**
 * Show agent comparison
 */
export function showAgentComparison(
  features: Phase5Features,
  task: string,
  agents: string[]
): void {
  const comparisons = compareAgentsForTask(task, agents);
  console.log(renderAgentComparison(task, comparisons));
}

/**
 * Suggest hand-off if appropriate
 */
export function suggestHandoffIfAppropriate(
  features: Phase5Features,
  context: {
    fileType?: string;
    operation?: string;
    complexity?: 'simple' | 'medium' | 'complex';
  }
): HandoffContext | null {
  const suggestion = suggestHandoff(context);

  if (suggestion) {
    // Check if suggested tool is available
    if (features.availableTools[suggestion.type]) {
      console.log(renderHandoffSuggestion(suggestion));
      return suggestion;
    }
  }

  return null;
}

/**
 * Track handoff
 */
export function trackHandoff(
  features: Phase5Features,
  tool: ToolType,
  success: boolean
): void {
  if (success) {
    features.totalHandoffs++;
  }
}

/**
 * Get provider metrics
 */
export function getProviderMetricsPhase5(features: Phase5Features): ProviderMetrics[] {
  return features.providerTracker.getMetrics();
}

/**
 * Show provider usage summary
 */
export function showProviderUsageSummary(features: Phase5Features): void {
  const metrics = getProviderMetricsPhase5(features);

  if (metrics.length > 0) {
    console.log(renderProviderMetrics(metrics));
  } else {
    console.log(chalk.dim('No provider usage data yet'));
  }
}

/**
 * Show detailed routing decision
 */
export function showDetailedRoutingDecision(route: ProviderRoute): void {
  console.log(renderProviderRoute(route, { compact: false }));
}

/**
 * Render inline delegation prompt
 */
export function renderInlineDelegationPromptPhase5(preview: AgentDelegationPreview): string {
  return renderInlineDelegationPrompt(preview);
}

/**
 * Get Phase 5 session summary
 */
export function getPhase5SessionSummary(features: Phase5Features): string {
  const duration = Date.now() - features.startTime.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  const durationSeconds = Math.floor((duration % 60000) / 1000);

  const metrics = getProviderMetricsPhase5(features);
  const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
  const avgSuccessRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
    : 0;

  const availableToolsCount = Object.values(features.availableTools).filter(Boolean).length;

  const lines = [
    chalk.bold('Phase 5 Session Summary'),
    '',
    `${chalk.blue('Duration:')} ${durationMinutes}m ${durationSeconds}s`,
    `${chalk.blue('Provider Calls:')} ${features.totalProviderCalls}`,
    `${chalk.blue('Total Cost:')} $${totalCost.toFixed(4)}`,
    `${chalk.blue('Success Rate:')} ${(avgSuccessRate * 100).toFixed(0)}%`,
    `${chalk.blue('Agent Delegations:')} ${features.totalAgentDelegations}`,
    `${chalk.blue('Tool Hand-offs:')} ${features.totalHandoffs}`,
    '',
    `${chalk.blue('Available Tools:')} ${availableToolsCount}/${Object.keys(features.availableTools).length}`,
    `${chalk.blue('Active Agents:')} ${features.activeAgents.join(', ') || 'None'}`,
    '',
    chalk.dim(`Session ID: ${features.sessionId}`)
  ];

  return boxen(lines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'magenta'
  });
}

/**
 * Detect project type from workspace
 */
function detectProjectType(workspaceRoot: string): string {
  // Simple detection based on common files
  // In production, could check for package.json, Cargo.toml, etc.
  return 'typescript'; // Default
}

/**
 * Cleanup Phase 5 features
 */
export async function cleanupPhase5Features(features: Phase5Features): Promise<void> {
  // Show final summary
  console.log(getPhase5SessionSummary(features));

  // Clear tracking data
  features.recentCommands = [];
  features.activeAgents = [];
  features.providerTracker.clear();
}
