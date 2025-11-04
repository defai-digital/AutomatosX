/**
 * Phase 3 Integration Module
 *
 * Integrates Claude-style UX patterns into REPL:
 * - Inline diff renderer
 * - Session snapshot cards
 * - Threaded agent updates
 * - Outcome trackers
 *
 * Phase 3 P1: Make ax feel like Claude Code
 */

import { renderFileDiff, renderMultiFileDiff, renderApprovalPrompt, type FileDiff, type DiffOptions } from './diff-renderer.js';
import {
  renderSessionSnapshot,
  renderSessionBar,
  createSessionSnapshot,
  updateSessionSnapshot,
  detectWorkspaceState,
  renderWorkspaceBanner,
  type SessionSnapshot
} from './session-snapshot.js';
import {
  renderAgentUpdate,
  renderAgentThread,
  renderDelegationChain,
  renderAgentSummary,
  renderLiveAgentStatus,
  createAgentUpdate,
  buildAgentThread,
  getAgentDisplayName,
  type AgentUpdate,
  type AgentThread
} from './threaded-agents.js';
import {
  createOutcomeTracker,
  addOutcome,
  updateOutcome,
  renderOutcomeTracker,
  renderOutcomeStatusBar,
  renderProgressBar,
  renderNextActions,
  detectOutcomeFromCommand,
  OUTCOME_PRESETS,
  type OutcomeTracker,
  type Outcome
} from './outcome-tracker.js';

/**
 * Phase 3 Feature Manager
 * Tracks all Phase 3 state for a session
 */
export class Phase3Features {
  private sessionSnapshot: SessionSnapshot | null = null;
  private agentUpdates: AgentUpdate[] = [];
  private outcomeTracker: OutcomeTracker | null = null;
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  /**
   * Initialize session snapshot
   */
  initSession(sessionName: string, provider?: string): void {
    this.sessionSnapshot = createSessionSnapshot(sessionName, this.workspaceRoot, {
      provider,
      policyMode: 'balanced',
      costToday: 0
    });

    this.outcomeTracker = createOutcomeTracker(sessionName);
  }

  /**
   * Update session state
   */
  updateSession(updates: Partial<SessionSnapshot>): void {
    if (this.sessionSnapshot) {
      this.sessionSnapshot = updateSessionSnapshot(this.sessionSnapshot, updates);
    }
  }

  /**
   * Show session header (persistent context)
   */
  showSessionHeader(): void {
    if (!this.sessionSnapshot) return;

    const bar = renderSessionBar(this.sessionSnapshot);
    console.log('');
    console.log(bar);
    console.log('');
  }

  /**
   * Show full session snapshot
   */
  showSessionSnapshot(): void {
    if (!this.sessionSnapshot) return;

    const snapshot = renderSessionSnapshot(this.sessionSnapshot);
    console.log(snapshot);
  }

  /**
   * Show workspace banner on startup
   */
  showWorkspaceBanner(): void {
    const state = detectWorkspaceState(this.workspaceRoot);
    const banner = renderWorkspaceBanner(state, this.workspaceRoot);
    console.log(banner);
  }

  /**
   * Track agent activity
   */
  trackAgent(agent: string, task: string, status: AgentUpdate['status'], options?: Partial<AgentUpdate>): void {
    const displayName = getAgentDisplayName(agent);

    const update = createAgentUpdate(agent, task, status, {
      ...options,
      displayName
    });

    this.agentUpdates.push(update);

    // Update session with active agents
    if (this.sessionSnapshot) {
      const activeAgents = this.agentUpdates
        .filter(u => u.status === 'in_progress' || u.status === 'starting')
        .map(u => u.agent);

      this.updateSession({ activeAgents });
    }

    // Render agent update
    const rendered = renderAgentUpdate(update);
    console.log(rendered);
  }

  /**
   * Show agent delegation chain
   */
  showAgentChain(): void {
    if (this.agentUpdates.length === 0) return;

    const chain = renderDelegationChain(this.agentUpdates);
    console.log(chain);
  }

  /**
   * Show live agent status
   */
  showLiveAgentStatus(): void {
    const status = renderLiveAgentStatus(this.agentUpdates);
    console.log(status);
  }

  /**
   * Show agent summary
   */
  showAgentSummary(): void {
    const summary = renderAgentSummary(this.agentUpdates);
    console.log(summary);
  }

  /**
   * Track outcome from command execution
   */
  trackCommandOutcome(command: string, output: string, exitCode: number): void {
    if (!this.outcomeTracker) return;

    const detected = detectOutcomeFromCommand(command, output, exitCode);

    if (detected) {
      // Check if outcome already exists
      const existing = this.outcomeTracker.outcomes.find(o => o.id === detected.id);

      if (existing) {
        // Update existing outcome
        this.outcomeTracker = updateOutcome(this.outcomeTracker, detected.id!, detected);
      } else {
        // Add new outcome
        this.outcomeTracker = addOutcome(this.outcomeTracker, detected as Omit<Outcome, 'timestamp'>);
      }

      // Show outcome update
      this.showOutcomes({ compact: true });
    }
  }

  /**
   * Add custom outcome
   */
  addOutcome(id: string, label: string, status: Outcome['status'], options?: Partial<Outcome>): void {
    if (!this.outcomeTracker) return;

    this.outcomeTracker = addOutcome(this.outcomeTracker, {
      id,
      label,
      status,
      ...options
    });
  }

  /**
   * Show outcomes
   */
  showOutcomes(options?: { compact?: boolean }): void {
    if (!this.outcomeTracker) return;

    const rendered = renderOutcomeTracker(this.outcomeTracker, options);
    console.log(rendered);
  }

  /**
   * Show outcome status bar
   */
  showOutcomeStatusBar(): void {
    if (!this.outcomeTracker) return;

    const bar = renderOutcomeStatusBar(this.outcomeTracker);
    console.log(bar);
  }

  /**
   * Show progress bar
   */
  showProgressBar(): void {
    if (!this.outcomeTracker) return;

    const bar = renderProgressBar(this.outcomeTracker);
    console.log(bar);
  }

  /**
   * Show suggested next actions
   */
  showNextActions(): void {
    if (!this.outcomeTracker) return;

    const actions = renderNextActions(this.outcomeTracker);
    if (actions) {
      console.log(actions);
    }
  }

  /**
   * Show diff approval prompt
   */
  showDiffApproval(diffs: FileDiff[], options?: DiffOptions): void {
    const prompt = renderApprovalPrompt(diffs, options);
    console.log(prompt);
  }

  /**
   * Show file diff
   */
  showFileDiff(diff: FileDiff, options?: DiffOptions): void {
    const rendered = renderFileDiff(diff, options);
    console.log(rendered);
  }

  /**
   * Show multiple file diffs
   */
  showMultiFileDiff(diffs: FileDiff[], options?: DiffOptions): void {
    const rendered = renderMultiFileDiff(diffs, options);
    console.log(rendered);
  }

  /**
   * Get current session snapshot
   */
  getSession(): SessionSnapshot | null {
    return this.sessionSnapshot;
  }

  /**
   * Get outcome tracker
   */
  getOutcomeTracker(): OutcomeTracker | null {
    return this.outcomeTracker;
  }

  /**
   * Get agent updates
   */
  getAgentUpdates(): AgentUpdate[] {
    return this.agentUpdates;
  }

  /**
   * Clear all Phase 3 state (for new session)
   */
  clear(): void {
    this.sessionSnapshot = null;
    this.agentUpdates = [];
    this.outcomeTracker = null;
  }
}

/**
 * Global Phase 3 features instance (singleton for convenience)
 */
let globalPhase3Features: Phase3Features | null = null;

/**
 * Initialize Phase 3 features for REPL
 */
export function initPhase3Features(workspaceRoot?: string, sessionName: string = 'main', provider?: string): Phase3Features {
  const features = new Phase3Features(workspaceRoot);
  features.initSession(sessionName, provider);

  globalPhase3Features = features;

  return features;
}

/**
 * Get global Phase 3 features instance
 */
export function getPhase3Features(): Phase3Features | null {
  return globalPhase3Features;
}

/**
 * Integration helpers for REPL
 */

/**
 * Show startup banner with workspace info
 */
export function showStartupBanner(features: Phase3Features): void {
  features.showWorkspaceBanner();
  features.showSessionHeader();
}

/**
 * Update after command execution
 */
export function updateAfterCommand(
  features: Phase3Features,
  command: string,
  output: string,
  exitCode: number,
  lastAction?: string
): void {
  // Track outcome
  features.trackCommandOutcome(command, output, exitCode);

  // Update session
  if (lastAction) {
    features.updateSession({
      lastAction,
      lastActionTime: new Date()
    });
  }

  // Show next actions if outcomes exist
  features.showNextActions();
}

/**
 * Update after AI response
 */
export function updateAfterAIResponse(features: Phase3Features, messageCount: number): void {
  features.updateSession({
    messagesInSession: messageCount,
    lastAction: 'AI response',
    lastActionTime: new Date()
  });
}

/**
 * Track agent delegation
 */
export function trackAgentDelegation(
  features: Phase3Features,
  agent: string,
  task: string,
  status: 'starting' | 'complete' | 'error',
  duration?: number
): void {
  features.trackAgent(agent, task, status, { duration });

  // Update session active agents
  if (status === 'starting') {
    features.updateSession({
      lastAction: `@${agent} started`,
      lastActionTime: new Date()
    });
  } else if (status === 'complete') {
    features.updateSession({
      lastAction: `@${agent} completed`,
      lastActionTime: new Date()
    });
  }
}

/**
 * Show comprehensive session status
 */
export function showSessionStatus(features: Phase3Features): void {
  features.showSessionSnapshot();
  features.showOutcomes({ compact: false });
  features.showAgentSummary();
}

/**
 * Usage example for REPL integration:
 *
 * ```typescript
 * import { initPhase3Features, showStartupBanner, updateAfterCommand, trackAgentDelegation } from './phase3-integration.js';
 *
 * // In REPLManager.start():
 * this.phase3 = initPhase3Features(process.cwd(), 'main', this.currentProvider);
 * showStartupBanner(this.phase3);
 *
 * // After command execution:
 * updateAfterCommand(this.phase3, command, output, exitCode, commandDescription);
 *
 * // After AI response:
 * updateAfterAIResponse(this.phase3, this.conversation.messages.length);
 *
 * // When agent is delegated:
 * trackAgentDelegation(this.phase3, agent, task, 'starting');
 * // ... agent executes ...
 * trackAgentDelegation(this.phase3, agent, task, 'complete', duration);
 * ```
 */
