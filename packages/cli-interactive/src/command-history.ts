/**
 * Command History with Undo/Redo
 *
 * Provides command history tracking with undo/redo capabilities
 * for reversible operations.
 *
 * Phase 4 P2: Command history with undo/redo
 */

import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, copyFileSync } from 'fs';

export interface CommandHistoryEntry {
  id: string;
  timestamp: Date;
  command: string;
  args: string[];
  type: CommandType;
  reversible: boolean;
  description: string;
  metadata?: Record<string, unknown>;
  undoData?: UndoData;
}

export type CommandType =
  | 'file_write'
  | 'file_edit'
  | 'file_delete'
  | 'file_create'
  | 'file_rename'
  | 'file_copy'
  | 'command_exec'
  | 'agent_run'
  | 'memory_add'
  | 'session_save';

export interface UndoData {
  operation: string;
  originalPath?: string;
  originalContent?: string;
  newPath?: string;
  newContent?: string;
  backupPath?: string;
  files?: Array<{ path: string; content?: string; existed: boolean }>;
}

export interface HistoryStatistics {
  totalCommands: number;
  reversibleCommands: number;
  undoneCommands: number;
  redoneCommands: number;
  commandsByType: Record<CommandType, number>;
}

/**
 * Command History Manager
 */
export class CommandHistoryManager {
  private history: CommandHistoryEntry[] = [];
  private undoneHistory: CommandHistoryEntry[] = [];
  private maxHistorySize = 100;
  private currentIndex = -1;

  /**
   * Add command to history
   */
  addCommand(
    command: string,
    args: string[],
    type: CommandType,
    description: string,
    reversible: boolean = false,
    undoData?: UndoData
  ): CommandHistoryEntry {
    const entry: CommandHistoryEntry = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      command,
      args,
      type,
      reversible,
      description,
      undoData
    };

    this.history.push(entry);
    this.currentIndex = this.history.length - 1;

    // Clear redo history when new command is added
    this.undoneHistory = [];

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    return entry;
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): CommandHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get reversible commands only
   */
  getReversibleHistory(): CommandHistoryEntry[] {
    return this.history.filter(entry => entry.reversible);
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    // Find last reversible command
    for (let i = this.currentIndex; i >= 0; i--) {
      if (this.history[i]?.reversible) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.undoneHistory.length > 0;
  }

  /**
   * Undo last reversible command
   */
  async undo(): Promise<{ success: boolean; entry?: CommandHistoryEntry; error?: string }> {
    // Find last reversible command from current index backwards
    let targetIndex = -1;
    for (let i = this.currentIndex; i >= 0; i--) {
      if (this.history[i]?.reversible) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      return { success: false, error: 'No reversible commands to undo' };
    }

    const entry = this.history[targetIndex];
    if (!entry) {
      return { success: false, error: 'Command entry not found' };
    }

    try {
      await this.executeUndo(entry);

      // Move to undo history
      this.undoneHistory.push(entry);
      this.currentIndex = targetIndex - 1;

      return { success: true, entry };
    } catch (error) {
      return {
        success: false,
        entry,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Redo last undone command
   */
  async redo(): Promise<{ success: boolean; entry?: CommandHistoryEntry; error?: string }> {
    if (this.undoneHistory.length === 0) {
      return { success: false, error: 'No commands to redo' };
    }

    const entry = this.undoneHistory.pop()!;

    try {
      await this.executeRedo(entry);

      // Move back to history
      this.currentIndex++;

      return { success: true, entry };
    } catch (error) {
      // Put it back in undo history if failed
      this.undoneHistory.push(entry);
      return {
        success: false,
        entry,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute undo operation
   */
  private async executeUndo(entry: CommandHistoryEntry): Promise<void> {
    if (!entry.undoData) {
      throw new Error('No undo data available');
    }

    const { operation, originalPath, originalContent, backupPath } = entry.undoData;

    switch (operation) {
      case 'restore_file':
        // Restore original file content
        if (originalPath && originalContent !== undefined) {
          writeFileSync(originalPath, originalContent, 'utf8');
        }
        break;

      case 'restore_from_backup':
        // Restore from backup file
        if (originalPath && backupPath && existsSync(backupPath)) {
          copyFileSync(backupPath, originalPath);
          unlinkSync(backupPath);
        }
        break;

      case 'delete_file':
        // Delete the created file
        if (originalPath && existsSync(originalPath)) {
          unlinkSync(originalPath);
        }
        break;

      case 'restore_deleted':
        // Restore deleted file from backup
        if (originalPath && backupPath && existsSync(backupPath)) {
          renameSync(backupPath, originalPath);
        }
        break;

      case 'reverse_rename':
        // Reverse file rename
        if (originalPath && entry.undoData.newPath) {
          const { newPath } = entry.undoData;
          if (existsSync(newPath)) {
            renameSync(newPath, originalPath);
          }
        }
        break;

      default:
        throw new Error(`Unknown undo operation: ${operation}`);
    }
  }

  /**
   * Execute redo operation
   */
  private async executeRedo(entry: CommandHistoryEntry): Promise<void> {
    if (!entry.undoData) {
      throw new Error('No undo data available');
    }

    const { operation, originalPath, newContent, newPath } = entry.undoData;

    switch (operation) {
      case 'restore_file':
        // Re-apply the file change
        if (originalPath && newContent !== undefined) {
          writeFileSync(originalPath, newContent, 'utf8');
        }
        break;

      case 'restore_from_backup':
        // Re-apply the file change
        if (originalPath && newContent !== undefined) {
          writeFileSync(originalPath, newContent, 'utf8');
        }
        break;

      case 'delete_file':
        // Re-create the file
        if (originalPath && newContent !== undefined) {
          writeFileSync(originalPath, newContent, 'utf8');
        }
        break;

      case 'restore_deleted':
        // Re-delete the file
        if (originalPath && existsSync(originalPath)) {
          unlinkSync(originalPath);
        }
        break;

      case 'reverse_rename':
        // Re-apply rename
        if (originalPath && newPath && existsSync(originalPath)) {
          renameSync(originalPath, newPath);
        }
        break;

      default:
        throw new Error(`Unknown redo operation: ${operation}`);
    }
  }

  /**
   * Get history statistics
   */
  getStatistics(): HistoryStatistics {
    const stats: HistoryStatistics = {
      totalCommands: this.history.length,
      reversibleCommands: this.history.filter(e => e.reversible).length,
      undoneCommands: this.undoneHistory.length,
      redoneCommands: 0, // Not tracked separately
      commandsByType: {} as Record<CommandType, number>
    };

    this.history.forEach(entry => {
      stats.commandsByType[entry.type] = (stats.commandsByType[entry.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.undoneHistory = [];
    this.currentIndex = -1;
  }

  /**
   * Search history
   */
  searchHistory(query: string): CommandHistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(entry =>
      entry.command.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery) ||
      entry.args.some(arg => arg.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Filter by type
   */
  filterByType(type: CommandType): CommandHistoryEntry[] {
    return this.history.filter(entry => entry.type === type);
  }

  /**
   * Get current position info
   */
  getPositionInfo(): { current: number; total: number; canUndo: boolean; canRedo: boolean } {
    return {
      current: this.currentIndex + 1,
      total: this.history.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}

/**
 * Render command history
 */
export function renderCommandHistory(
  entries: CommandHistoryEntry[],
  options: { showMetadata?: boolean; maxEntries?: number; highlightReversible?: boolean } = {}
): string {
  const {
    showMetadata = false,
    maxEntries = 20,
    highlightReversible = true
  } = options;

  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Command History'));
  lines.push('');

  const recent = entries.slice(-maxEntries);

  recent.forEach((entry, idx) => {
    const time = entry.timestamp.toLocaleTimeString('en-US', { hour12: false });
    const reversibleIcon = entry.reversible ? chalk.green('↺') : chalk.dim('•');
    const typeIcon = getCommandTypeIcon(entry.type);

    const number = chalk.dim(`${entries.length - maxEntries + idx + 1}.`);
    const timestamp = chalk.dim(time);

    const commandStr = highlightReversible && entry.reversible
      ? chalk.green(`${entry.command} ${entry.args.join(' ')}`)
      : chalk.white(`${entry.command} ${entry.args.join(' ')}`);

    lines.push(`${number} ${reversibleIcon} ${typeIcon} ${timestamp} ${commandStr}`);
    lines.push(`   ${chalk.dim(entry.description)}`);

    if (showMetadata && entry.metadata) {
      lines.push(`   ${chalk.dim(JSON.stringify(entry.metadata))}`);
    }

    if (idx < recent.length - 1) {
      lines.push('');
    }
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Render undo/redo status
 */
export function renderUndoRedoStatus(manager: CommandHistoryManager): string {
  const info = manager.getPositionInfo();
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.bold.cyan('Undo/Redo Status'));
  lines.push('');

  lines.push(`  Position: ${chalk.white(`${info.current}/${info.total}`)}`);
  lines.push(`  Can Undo: ${info.canUndo ? chalk.green('Yes ↺') : chalk.dim('No')}`);
  lines.push(`  Can Redo: ${info.canRedo ? chalk.green('Yes ↻') : chalk.dim('No')}`);
  lines.push('');

  const stats = manager.getStatistics();
  lines.push(`  Reversible: ${chalk.cyan(stats.reversibleCommands.toString())}/${stats.totalCommands}`);
  lines.push(`  Undone: ${chalk.yellow(stats.undoneCommands.toString())}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Get command type icon
 */
function getCommandTypeIcon(type: CommandType): string {
  const icons: Record<CommandType, string> = {
    file_write: '✍️',
    file_edit: '✎',
    file_delete: '🗑️',
    file_create: '📄',
    file_rename: '📝',
    file_copy: '📋',
    command_exec: '⚡',
    agent_run: '👤',
    memory_add: '💾',
    session_save: '💼'
  };
  return icons[type] || '•';
}

/**
 * Create undo data for file write operation
 */
export function createFileWriteUndoData(path: string, newContent: string): UndoData {
  const originalContent = existsSync(path) ? readFileSync(path, 'utf8') : undefined;

  return {
    operation: 'restore_file',
    originalPath: path,
    originalContent,
    newContent
  };
}

/**
 * Create undo data for file edit operation
 */
export function createFileEditUndoData(path: string, newContent: string): UndoData {
  const originalContent = readFileSync(path, 'utf8');

  return {
    operation: 'restore_file',
    originalPath: path,
    originalContent,
    newContent
  };
}

/**
 * Create undo data for file delete operation
 */
export function createFileDeleteUndoData(path: string): UndoData {
  const originalContent = readFileSync(path, 'utf8');
  const backupPath = `${path}.backup-${Date.now()}`;

  // Create backup
  copyFileSync(path, backupPath);

  return {
    operation: 'restore_deleted',
    originalPath: path,
    originalContent,
    backupPath
  };
}

/**
 * Create undo data for file create operation
 */
export function createFileCreateUndoData(path: string, content: string): UndoData {
  return {
    operation: 'delete_file',
    originalPath: path,
    newContent: content
  };
}

/**
 * Create undo data for file rename operation
 */
export function createFileRenameUndoData(oldPath: string, newPath: string): UndoData {
  return {
    operation: 'reverse_rename',
    originalPath: oldPath,
    newPath
  };
}
