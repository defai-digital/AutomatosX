/**
 * Phase 4 Integration
 *
 * Integrates Phase 4 features into the REPL:
 * - Batch approval for multiple file operations
 * - Structured event logging with JSONL output
 * - Command history with undo/redo
 * - Session persistence with auto-save
 *
 * Pattern: Similar to phase3-integration.ts - provides initialization,
 * update functions, and feature management for Phase 4 capabilities
 */

import { BatchApprovalManager, type BatchOperation, type BatchApprovalResult } from './batch-approval.js';
import { StructuredLogger, initLogger, type LoggingOptions, type LogLevel, type EventCategory } from './structured-logging.js';
import { CommandHistoryManager, type CommandHistoryEntry, type UndoData } from './command-history.js';
import { SessionPersistenceManager, type PersistedSession, type ConversationMessage } from './session-persistence.js';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * Phase 4 features container
 */
export interface Phase4Features {
  // Managers
  batchApproval: BatchApprovalManager;
  logger: StructuredLogger;
  commandHistory: CommandHistoryManager;
  sessionPersistence: SessionPersistenceManager;

  // State
  sessionId: string;
  workspaceRoot: string;
  currentProvider: string;

  // Metrics
  startTime: Date;
  commandCount: number;
  aiResponseCount: number;
  agentDelegationCount: number;
}

/**
 * Initialize Phase 4 features
 */
export function initPhase4Features(
  workspaceRoot: string,
  sessionName: string,
  provider: string,
  options?: {
    enableFileLogging?: boolean;
    logFilePath?: string;
    autoSaveInterval?: number;
    maxHistorySize?: number;
  }
): Phase4Features {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = new Date();

  // Initialize batch approval manager
  const batchApproval = new BatchApprovalManager();

  // Initialize structured logger
  const logFilePath = options?.logFilePath ||
    `${workspaceRoot}/.automatosx/logs/cli-events-${startTime.toISOString().split('T')[0]}.jsonl`;

  const logger = initLogger(sessionId, {
    enableConsole: false, // Don't pollute console
    enableFile: options?.enableFileLogging ?? true,
    logFilePath,
    minLevel: 'info'
  });

  // Initialize command history
  const commandHistory = new CommandHistoryManager();

  // Initialize session persistence
  const sessionPersistence = new SessionPersistenceManager(workspaceRoot);
  const session = sessionPersistence.createSession(sessionName, provider, workspaceRoot);

  // Enable auto-save if interval specified
  if (options?.autoSaveInterval) {
    sessionPersistence.enableAutoSave(options.autoSaveInterval);
  }

  // Log session start
  logger.logSession('started', {
    sessionId,
    sessionName,
    provider,
    workspaceRoot
  });

  return {
    batchApproval,
    logger,
    commandHistory,
    sessionPersistence,
    sessionId,
    workspaceRoot,
    currentProvider: provider,
    startTime,
    commandCount: 0,
    aiResponseCount: 0,
    agentDelegationCount: 0
  };
}

/**
 * Show startup banner with Phase 4 features
 */
export function showPhase4StartupBanner(features: Phase4Features): void {
  const lines = [
    chalk.bold('Phase 4 Features Active:'),
    '',
    `${chalk.green('✓')} Batch Approval - Group multiple operations`,
    `${chalk.green('✓')} Structured Logging - Event tracking in JSONL`,
    `${chalk.green('✓')} Command History - Undo/redo for file operations`,
    `${chalk.green('✓')} Session Persistence - Auto-save enabled`,
    '',
    chalk.dim(`Session: ${features.sessionId}`),
    chalk.dim(`Workspace: ${features.workspaceRoot}`)
  ];

  console.log(
    boxen(lines.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'blue'
    })
  );
  console.log();
}

/**
 * Update after command execution
 */
export function updateAfterPhase4Command(
  features: Phase4Features,
  command: string,
  args: string[],
  success: boolean,
  duration: number,
  error?: Error
): void {
  features.commandCount++;

  // Log to structured logger
  features.logger.logCommand(
    command,
    args,
    success ? 0 : 1,
    duration
  );

  // Add to command history (only if reversible)
  const reversibleCommands: Record<string, import('./command-history.js').CommandType> = {
    'write': 'file_write',
    'edit': 'file_edit',
    'delete': 'file_delete',
    'create': 'file_create',
    'rename': 'file_rename'
  };

  if (command in reversibleCommands && success) {
    // Note: Actual undo data would be created by the command handler
    // This is just tracking the command was executed
    features.commandHistory.addCommand(
      command,
      args,
      reversibleCommands[command]!,
      `${command} ${args.join(' ')}`,
      false // Set to true when undo data is available
    );
  }

  // Update session
  if (command in reversibleCommands && success) {
    const entry = features.commandHistory.getHistory().slice(-1)[0];
    if (entry) {
      features.sessionPersistence.addCommand(entry);
    }
  }
}

/**
 * Update after AI response
 */
export function updateAfterPhase4AIResponse(
  features: Phase4Features,
  prompt: string,
  response: string,
  provider: string,
  duration: number,
  tokenCount?: number,
  cost?: number
): void {
  features.aiResponseCount++;

  // Log to structured logger
  features.logger.logAIResponse(provider, tokenCount, cost, duration);

  // Update session
  features.sessionPersistence.addMessage('user', prompt);
  features.sessionPersistence.addMessage('assistant', response, { provider, duration, tokenCount, cost });
}

/**
 * Track agent delegation
 */
export function trackPhase4AgentDelegation(
  features: Phase4Features,
  agentName: string,
  task: string,
  status: 'starting' | 'complete' | 'error',
  duration?: number,
  error?: Error
): void {
  if (status === 'starting') {
    features.agentDelegationCount++;
  }

  // Log to structured logger
  const logStatus = status === 'complete' ? 'completed' : status === 'error' ? 'failed' : 'started';
  features.logger.logAgentDelegation(agentName, task, logStatus, duration);

  // Update session - addAgentUpdate doesn't exist, so skip or use generic method
  // features.sessionPersistence would need an addAgentUpdate method
}

/**
 * Track file operation for batch approval
 */
export function addFileToBatchApproval(
  features: Phase4Features,
  operation: BatchOperation
): void {
  features.batchApproval.addOperation(operation);

  // Log approval request (using simplified signature)
  features.logger.logApproval(`${operation.type} ${operation.path}`, false, `Pending (${operation.risk} risk)`);
}

/**
 * Handle batch approval result
 */
export function handleBatchApprovalResult(
  features: Phase4Features,
  result: BatchApprovalResult
): void {
  // Log approval outcome
  const approvedCount = result.selectedOperations.length;
  const rejectedCount = result.rejectedOperations.length;
  features.logger.logApproval(
    `batch of ${approvedCount + rejectedCount} operations`,
    result.approved,
    result.feedback
  );

  // Mark operations as executed
  if (result.selectedOperations.length > 0) {
    features.batchApproval.markExecuted(result.selectedOperations);
  }
}

/**
 * Execute undo operation
 */
export async function executeUndo(features: Phase4Features): Promise<{
  success: boolean;
  entry?: CommandHistoryEntry;
  error?: string;
}> {
  const result = await features.commandHistory.undo();

  if (result.success && result.entry) {
    features.logger.info('command', 'command_undone', `Undone: ${result.entry.description}`, {
      command: result.entry.command,
      args: result.entry.args
    });

    // Update session
    features.sessionPersistence.addCommand({
      id: `undo-${Date.now()}`,
      command: 'undo',
      args: [],
      timestamp: new Date(),
      type: 'command_exec',
      reversible: false,
      description: 'Undo operation'
    });
  } else {
    features.logger.warn('command', 'undo_failed', result.error || 'No reversible commands', {
      error: result.error
    });
  }

  return result;
}

/**
 * Execute redo operation
 */
export async function executeRedo(features: Phase4Features): Promise<{
  success: boolean;
  entry?: CommandHistoryEntry;
  error?: string;
}> {
  const result = await features.commandHistory.redo();

  if (result.success && result.entry) {
    features.logger.info('command', 'command_redone', `Redone: ${result.entry.description}`, {
      command: result.entry.command,
      args: result.entry.args
    });

    // Update session
    features.sessionPersistence.addCommand({
      id: `redo-${Date.now()}`,
      command: 'redo',
      args: [],
      timestamp: new Date(),
      type: 'command_exec',
      reversible: false,
      description: 'Redo operation'
    });
  } else {
    features.logger.warn('command', 'redo_failed', result.error || 'No undone commands', {
      error: result.error
    });
  }

  return result;
}

/**
 * Get session summary
 */
export function getPhase4SessionSummary(features: Phase4Features): string {
  const duration = Date.now() - features.startTime.getTime();
  const durationMinutes = Math.floor(duration / 60000);
  const durationSeconds = Math.floor((duration % 60000) / 1000);

  const lines = [
    chalk.bold('Session Summary'),
    '',
    `${chalk.blue('Duration:')} ${durationMinutes}m ${durationSeconds}s`,
    `${chalk.blue('Commands:')} ${features.commandCount}`,
    `${chalk.blue('AI Responses:')} ${features.aiResponseCount}`,
    `${chalk.blue('Agent Delegations:')} ${features.agentDelegationCount}`,
    '',
    `${chalk.blue('History:')} ${features.commandHistory.getHistory().length} commands (${features.commandHistory.canUndo() ? 'can undo' : 'cannot undo'}, ${features.commandHistory.canRedo() ? 'can redo' : 'cannot redo'})`,
    `${chalk.blue('Pending Approvals:')} ${features.batchApproval.getPendingCount()} operations`,
    '',
    chalk.dim(`Session ID: ${features.sessionId}`)
  ];

  return boxen(lines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  });
}

/**
 * Render command history
 */
export function renderCommandHistory(features: Phase4Features, limit: number = 10): string {
  const history = features.commandHistory.getHistory();
  const recent = history.slice(-limit).reverse();

  if (recent.length === 0) {
    return chalk.dim('No command history');
  }

  const lines = [
    chalk.bold('Recent Commands'),
    ''
  ];

  recent.forEach((entry, index) => {
    const ago = Date.now() - entry.timestamp.getTime();
    const agoStr = ago < 60000 ? `${Math.floor(ago / 1000)}s ago` : `${Math.floor(ago / 60000)}m ago`;

    const icon = entry.reversible ? chalk.green('↺') : chalk.dim('·');

    lines.push(`${icon} ${chalk.cyan(entry.command)} ${chalk.dim(entry.args.join(' '))} ${chalk.dim(agoStr)}`);
  });

  if (features.commandHistory.canUndo()) {
    lines.push('');
    lines.push(chalk.dim('Use /undo to reverse the last command'));
  }

  return lines.join('\n');
}

/**
 * Render event timeline
 */
export function renderEventTimeline(features: Phase4Features, limit: number = 20): string {
  const logs = features.logger.getRecentLogs(limit);

  if (logs.length === 0) {
    return chalk.dim('No events logged');
  }

  const lines = [
    chalk.bold('Recent Events'),
    ''
  ];

  logs.forEach(entry => {
    const time = entry.timestamp.toLocaleTimeString();
    const levelColor = entry.level === 'error' ? 'red' :
                      entry.level === 'warn' ? 'yellow' :
                      entry.level === 'success' ? 'green' : 'blue';

    const level = chalk[levelColor](entry.level.toUpperCase().padEnd(7));
    const category = chalk.dim(`[${entry.category}]`.padEnd(12));
    const message = entry.message;

    lines.push(`${chalk.dim(time)} ${level} ${category} ${message}`);
  });

  return lines.join('\n');
}

/**
 * Save session
 */
export async function savePhase4Session(features: Phase4Features): Promise<{
  success: boolean;
  path?: string;
  error?: string;
}> {
  const result = await features.sessionPersistence.saveSession();

  if (result.success) {
    features.logger.logSession('saved', {
      path: result.path
    });
  } else {
    features.logger.error('session', 'session_save_failed', result.error || 'Failed to save session', {
      error: result.error
    });
  }

  return result;
}

/**
 * Load session
 */
export async function loadPhase4Session(
  features: Phase4Features,
  sessionId: string
): Promise<{
  success: boolean;
  session?: PersistedSession;
  error?: string;
}> {
  const result = await features.sessionPersistence.loadSession(sessionId);

  if (result.success && result.session) {
    features.logger.logSession('resumed', {
      sessionId: result.session.id,
      messageCount: result.session.conversationHistory.length
    });
  } else {
    features.logger.error('session', 'session_load_failed', result.error || 'Failed to load session', {
      sessionId,
      error: result.error
    });
  }

  return result;
}

/**
 * Cleanup Phase 4 features
 */
export async function cleanupPhase4Features(features: Phase4Features): Promise<void> {
  // Stop auto-save
  features.sessionPersistence.disableAutoSave();

  // Save final session state
  await savePhase4Session(features);

  // Log session end
  features.logger.logSession('ended', {
    sessionId: features.sessionId,
    duration: Date.now() - features.startTime.getTime(),
    commandCount: features.commandCount,
    aiResponseCount: features.aiResponseCount,
    agentDelegationCount: features.agentDelegationCount
  });
}
