/**
 * Session Persistence and Resumption
 *
 * Provides automatic session saving and resumption capabilities
 * to prevent data loss and enable long-running workflows.
 *
 * Phase 4 P2: Session persistence and resumption
 */

import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { CommandHistoryEntry } from './command-history.js';
import type { SessionSnapshot } from './session-snapshot.js';
import type { AgentUpdate } from './threaded-agents.js';
import type { OutcomeTracker } from './outcome-tracker.js';

export interface PersistedSession {
  id: string;
  name: string;
  createdAt: Date;
  lastSavedAt: Date;
  lastAccessedAt: Date;
  version: string;

  // Session state
  sessionSnapshot?: SessionSnapshot;
  conversationHistory: ConversationMessage[];
  commandHistory: CommandHistoryEntry[];
  agentUpdates: AgentUpdate[];
  outcomeTracker?: OutcomeTracker;

  // Metadata
  metadata: {
    messageCount: number;
    commandCount: number;
    agentCount: number;
    provider?: string;
    workspaceRoot?: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionListEntry {
  id: string;
  name: string;
  createdAt: Date;
  lastSavedAt: Date;
  messageCount: number;
  size: number;
}

/**
 * Session Persistence Manager
 */
export class SessionPersistenceManager {
  private sessionsDir: string;
  private currentSession: PersistedSession | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private autoSaveIntervalMs = 60000; // 1 minute

  constructor(workspaceRoot?: string) {
    this.sessionsDir = join(workspaceRoot || process.cwd(), '.automatosx', 'sessions');

    // Ensure sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Create new session
   */
  createSession(name: string, provider?: string, workspaceRoot?: string): PersistedSession {
    const session: PersistedSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: new Date(),
      lastSavedAt: new Date(),
      lastAccessedAt: new Date(),
      version: '1.0',
      conversationHistory: [],
      commandHistory: [],
      agentUpdates: [],
      metadata: {
        messageCount: 0,
        commandCount: 0,
        agentCount: 0,
        provider,
        workspaceRoot
      }
    };

    this.currentSession = session;
    return session;
  }

  /**
   * Save session to disk
   */
  async saveSession(session?: PersistedSession): Promise<{ success: boolean; path?: string; error?: string }> {
    const targetSession = session || this.currentSession;

    if (!targetSession) {
      return { success: false, error: 'No active session to save' };
    }

    try {
      // Update timestamps
      targetSession.lastSavedAt = new Date();
      targetSession.lastAccessedAt = new Date();

      // Write to file
      const sessionPath = join(this.sessionsDir, `${targetSession.id}.json`);
      const json = JSON.stringify(targetSession, null, 2);
      writeFileSync(sessionPath, json, 'utf8');

      return { success: true, path: sessionPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load session from disk
   */
  async loadSession(sessionId: string): Promise<{ success: boolean; session?: PersistedSession; error?: string }> {
    try {
      const sessionPath = join(this.sessionsDir, `${sessionId}.json`);

      if (!existsSync(sessionPath)) {
        return { success: false, error: 'Session not found' };
      }

      const json = readFileSync(sessionPath, 'utf8');
      const session = JSON.parse(json, (key, value) => {
        // Revive Date objects
        if (key.endsWith('At') || key === 'timestamp') {
          return new Date(value);
        }
        return value;
      }) as PersistedSession;

      // Update last accessed
      session.lastAccessedAt = new Date();

      this.currentSession = session;

      // Save updated timestamp
      await this.saveSession(session);

      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all saved sessions
   */
  listSessions(sortBy: 'name' | 'created' | 'modified' = 'modified'): SessionListEntry[] {
    const sessions: SessionListEntry[] = [];

    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      try {
        const path = join(this.sessionsDir, file);
        const json = readFileSync(path, 'utf8');
        const session = JSON.parse(json) as PersistedSession;
        const stats = statSync(path);

        sessions.push({
          id: session.id,
          name: session.name,
          createdAt: new Date(session.createdAt),
          lastSavedAt: new Date(session.lastSavedAt),
          messageCount: session.metadata.messageCount,
          size: stats.size
        });
      } catch (error) {
        // Skip corrupted sessions
        console.warn(`Skipping corrupted session file: ${file}`);
      }
    });

    // Sort
    sessions.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'modified':
        default:
          return b.lastSavedAt.getTime() - a.lastSavedAt.getTime();
      }
    });

    return sessions;
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const sessionPath = join(this.sessionsDir, `${sessionId}.json`);

      if (!existsSync(sessionPath)) {
        return { success: false, error: 'Session not found' };
      }

      unlinkSync(sessionPath);

      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add message to current session
   */
  addMessage(role: ConversationMessage['role'], content: string, metadata?: Record<string, unknown>): void {
    if (!this.currentSession) return;

    this.currentSession.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });

    this.currentSession.metadata.messageCount++;
  }

  /**
   * Add command to current session
   */
  addCommand(entry: CommandHistoryEntry): void {
    if (!this.currentSession) return;

    this.currentSession.commandHistory.push(entry);
    this.currentSession.metadata.commandCount++;
  }

  /**
   * Add agent update to current session
   */
  addAgentUpdate(update: AgentUpdate): void {
    if (!this.currentSession) return;

    this.currentSession.agentUpdates.push(update);
    this.currentSession.metadata.agentCount++;
  }

  /**
   * Update session snapshot
   */
  updateSessionSnapshot(snapshot: SessionSnapshot): void {
    if (!this.currentSession) return;

    this.currentSession.sessionSnapshot = snapshot;
  }

  /**
   * Update outcome tracker
   */
  updateOutcomeTracker(tracker: OutcomeTracker): void {
    if (!this.currentSession) return;

    this.currentSession.outcomeTracker = tracker;
  }

  /**
   * Get current session
   */
  getCurrentSession(): PersistedSession | null {
    return this.currentSession;
  }

  /**
   * Enable auto-save
   */
  enableAutoSave(intervalMs?: number): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    const interval = intervalMs || this.autoSaveIntervalMs;

    this.autoSaveInterval = setInterval(async () => {
      if (this.currentSession) {
        await this.saveSession();
      }
    }, interval);
  }

  /**
   * Disable auto-save
   */
  disableAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Export session to markdown
   */
  exportToMarkdown(session?: PersistedSession): string {
    const targetSession = session || this.currentSession;

    if (!targetSession) {
      return '# No session to export';
    }

    const lines: string[] = [];

    // Header
    lines.push(`# ${targetSession.name}`);
    lines.push('');
    lines.push(`**Session ID**: ${targetSession.id}`);
    lines.push(`**Created**: ${targetSession.createdAt.toLocaleString()}`);
    lines.push(`**Last Saved**: ${targetSession.lastSavedAt.toLocaleString()}`);
    lines.push(`**Messages**: ${targetSession.metadata.messageCount}`);
    lines.push(`**Commands**: ${targetSession.metadata.commandCount}`);
    lines.push(`**Agents**: ${targetSession.metadata.agentCount}`);

    if (targetSession.metadata.provider) {
      lines.push(`**Provider**: ${targetSession.metadata.provider}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    // Conversation
    if (targetSession.conversationHistory.length > 0) {
      lines.push('## Conversation');
      lines.push('');

      targetSession.conversationHistory.forEach(msg => {
        const time = msg.timestamp.toLocaleTimeString();
        lines.push(`### ${msg.role.toUpperCase()} (${time})`);
        lines.push('');
        lines.push(msg.content);
        lines.push('');
      });
    }

    // Commands
    if (targetSession.commandHistory.length > 0) {
      lines.push('## Command History');
      lines.push('');

      targetSession.commandHistory.forEach((cmd, idx) => {
        lines.push(`${idx + 1}. \`${cmd.command} ${cmd.args.join(' ')}\``);
        lines.push(`   - ${cmd.description}`);
        lines.push(`   - ${cmd.timestamp.toLocaleString()}`);
        lines.push('');
      });
    }

    // Agent Activity
    if (targetSession.agentUpdates.length > 0) {
      lines.push('## Agent Activity');
      lines.push('');

      targetSession.agentUpdates.forEach(update => {
        lines.push(`- **@${update.agent}**: ${update.task} (${update.status})`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<{ deleted: number; errors: string[] }> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const deleted: string[] = [];
    const errors: string[] = [];

    const sessions = this.listSessions();

    for (const session of sessions) {
      if (session.lastSavedAt < cutoffDate) {
        const result = await this.deleteSession(session.id);
        if (result.success) {
          deleted.push(session.id);
        } else {
          errors.push(`${session.id}: ${result.error}`);
        }
      }
    }

    return { deleted: deleted.length, errors };
  }

  /**
   * Get session statistics
   */
  getStatistics(): {
    totalSessions: number;
    totalSize: number;
    averageMessages: number;
    oldestSession?: Date;
    newestSession?: Date;
  } {
    const sessions = this.listSessions();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalSize: 0,
        averageMessages: 0
      };
    }

    const totalSize = sessions.reduce((sum, s) => sum + s.size, 0);
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);

    return {
      totalSessions: sessions.length,
      totalSize,
      averageMessages: Math.round(totalMessages / sessions.length),
      oldestSession: sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt,
      newestSession: sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt
    };
  }
}

/**
 * Render session list
 */
export function renderSessionList(sessions: SessionListEntry[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Saved Sessions'));
  lines.push('');

  if (sessions.length === 0) {
    lines.push(chalk.dim('No saved sessions found'));
    lines.push('');
    return lines.join('\n');
  }

  sessions.forEach((session, idx) => {
    const number = chalk.dim(`${idx + 1}.`);
    const name = chalk.bold.white(session.name);
    const id = chalk.dim(`[${session.id.substring(8, 16)}]`);
    const messages = chalk.cyan(`${session.messageCount} messages`);
    const lastSaved = chalk.dim(formatRelativeTime(session.lastSavedAt));
    const size = chalk.dim(formatBytes(session.size));

    lines.push(`${number} ${name} ${id}`);
    lines.push(`   ${messages} • ${lastSaved} • ${size}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Format bytes
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
