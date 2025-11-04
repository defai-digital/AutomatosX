/**
 * Tests for command-history.ts
 * Verifies command history with undo/redo functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  CommandHistoryManager,
  renderCommandHistory,
  renderUndoRedoStatus,
  createFileWriteUndoData,
  createFileEditUndoData,
  createFileDeleteUndoData,
  createFileCreateUndoData,
  createFileRenameUndoData,
  type CommandHistoryEntry
} from '../src/command-history.js';

describe('CommandHistoryManager', () => {
  let manager: CommandHistoryManager;
  let testDir: string;

  beforeEach(() => {
    manager = new CommandHistoryManager();
    testDir = join(process.cwd(), '.test-command-history');
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      const files = require('fs').readdirSync(testDir);
      files.forEach((file: string) => {
        try {
          unlinkSync(join(testDir, file));
        } catch (error) {
          // Ignore
        }
      });
      try {
        require('fs').rmdirSync(testDir);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('addCommand', () => {
    it('should add command to history', () => {
      const entry = manager.addCommand(
        'write',
        ['test.txt'],
        'file_write',
        'Write test file',
        false
      );

      expect(entry.command).toBe('write');
      expect(entry.args).toEqual(['test.txt']);
      expect(entry.type).toBe('file_write');
      expect(entry.description).toBe('Write test file');
      expect(entry.reversible).toBe(false);
    });

    it('should generate unique IDs', () => {
      const entry1 = manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', false);
      const entry2 = manager.addCommand('write', ['file2.txt'], 'file_write', 'Write 2', false);

      expect(entry1.id).not.toBe(entry2.id);
    });

    it('should set timestamp automatically', () => {
      const before = Date.now();
      const entry = manager.addCommand('write', ['test.txt'], 'file_write', 'Write', false);
      const after = Date.now();

      const timestamp = entry.timestamp.getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should track reversible commands with undo data', () => {
      const undoData = createFileWriteUndoData(join(testDir, 'test.txt'), 'new content');

      const entry = manager.addCommand(
        'write',
        ['test.txt'],
        'file_write',
        'Write test file',
        true,
        undoData
      );

      expect(entry.reversible).toBe(true);
      expect(entry.undoData).toEqual(undoData);
    });

    it('should clear redo history when new command is added', () => {
      // Add command, undo it
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original');

      const undoData = createFileWriteUndoData(testFile, 'new');
      manager.addCommand('write', [testFile], 'file_write', 'Write', true, undoData);

      writeFileSync(testFile, 'new');
      manager.undo();

      expect(manager.canRedo()).toBe(true);

      // Add new command - should clear redo
      manager.addCommand('write', ['other.txt'], 'file_write', 'Write other', false);

      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('getHistory', () => {
    it('should return all commands', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', false);
      manager.addCommand('edit', ['file2.txt'], 'file_edit', 'Edit 2', false);
      manager.addCommand('delete', ['file3.txt'], 'file_delete', 'Delete 3', false);

      const history = manager.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should limit history when specified', () => {
      for (let i = 0; i < 10; i++) {
        manager.addCommand('write', [`file${i}.txt`], 'file_write', `Write ${i}`, false);
      }

      const limited = manager.getHistory(5);
      expect(limited).toHaveLength(5);
      expect(limited[0].description).toBe('Write 5'); // Last 5
    });

    it('should return commands in chronological order', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'First', false);
      manager.addCommand('write', ['file2.txt'], 'file_write', 'Second', false);
      manager.addCommand('write', ['file3.txt'], 'file_write', 'Third', false);

      const history = manager.getHistory();
      expect(history[0].description).toBe('First');
      expect(history[1].description).toBe('Second');
      expect(history[2].description).toBe('Third');
    });
  });

  describe('getReversibleHistory', () => {
    it('should filter only reversible commands', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', true);
      manager.addCommand('exec', ['npm test'], 'command_exec', 'Run tests', false);
      manager.addCommand('edit', ['file2.txt'], 'file_edit', 'Edit 2', true);

      const reversible = manager.getReversibleHistory();
      expect(reversible).toHaveLength(2);
      expect(reversible.every(entry => entry.reversible)).toBe(true);
    });
  });

  describe('canUndo and canRedo', () => {
    it('should return false when no reversible commands', () => {
      manager.addCommand('exec', ['npm test'], 'command_exec', 'Run tests', false);

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });

    it('should return true when reversible command exists', () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original');

      const undoData = createFileWriteUndoData(testFile, 'new');
      manager.addCommand('write', [testFile], 'file_write', 'Write', true, undoData);

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });

    it('should update after undo/redo', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original');

      const undoData = createFileWriteUndoData(testFile, 'new');
      manager.addCommand('write', [testFile], 'file_write', 'Write', true, undoData);

      writeFileSync(testFile, 'new');

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);

      await manager.undo();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);

      await manager.redo();

      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('should return error when no reversible commands', async () => {
      const result = await manager.undo();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No reversible commands');
    });

    it('should undo file write operation', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original content');

      const undoData = createFileWriteUndoData(testFile, 'new content');
      manager.addCommand('write', [testFile], 'file_write', 'Write file', true, undoData);

      // Perform write
      writeFileSync(testFile, 'new content');

      // Undo
      const result = await manager.undo();

      expect(result.success).toBe(true);
      expect(result.entry?.description).toBe('Write file');

      // Verify file restored
      const content = readFileSync(testFile, 'utf8');
      expect(content).toBe('original content');
    });

    it('should undo file edit operation', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original content');

      const undoData = createFileEditUndoData(testFile, 'edited content');
      manager.addCommand('edit', [testFile], 'file_edit', 'Edit file', true, undoData);

      // Perform edit
      writeFileSync(testFile, 'edited content');

      // Undo
      const result = await manager.undo();

      expect(result.success).toBe(true);

      // Verify file restored
      const content = readFileSync(testFile, 'utf8');
      expect(content).toBe('original content');
    });

    it('should undo file create operation', async () => {
      const testFile = join(testDir, 'new-file.txt');

      const undoData = createFileCreateUndoData(testFile, 'new content');
      manager.addCommand('create', [testFile], 'file_create', 'Create file', true, undoData);

      // Create file
      writeFileSync(testFile, 'new content');
      expect(existsSync(testFile)).toBe(true);

      // Undo
      const result = await manager.undo();

      expect(result.success).toBe(true);

      // Verify file deleted
      expect(existsSync(testFile)).toBe(false);
    });

    it('should undo file delete operation', async () => {
      const testFile = join(testDir, 'delete-me.txt');
      writeFileSync(testFile, 'original content');

      const undoData = createFileDeleteUndoData(testFile);
      manager.addCommand('delete', [testFile], 'file_delete', 'Delete file', true, undoData);

      // Delete file
      unlinkSync(testFile);
      expect(existsSync(testFile)).toBe(false);

      // Undo
      const result = await manager.undo();

      expect(result.success).toBe(true);

      // Verify file restored
      expect(existsSync(testFile)).toBe(true);
      const content = readFileSync(testFile, 'utf8');
      expect(content).toBe('original content');

      // Clean up backup
      const backupFiles = require('fs').readdirSync(testDir).filter((f: string) => f.includes('.backup'));
      backupFiles.forEach((file: string) => unlinkSync(join(testDir, file)));
    });

    it('should undo most recent reversible command', async () => {
      const file1 = join(testDir, 'file1.txt');
      const file2 = join(testDir, 'file2.txt');

      writeFileSync(file1, 'content 1');
      writeFileSync(file2, 'content 2');

      // Add reversible command
      const undoData1 = createFileWriteUndoData(file1, 'new 1');
      manager.addCommand('write', [file1], 'file_write', 'Write 1', true, undoData1);
      writeFileSync(file1, 'new 1');

      // Add non-reversible command
      manager.addCommand('exec', ['npm test'], 'command_exec', 'Run tests', false);

      // Add another reversible command
      const undoData2 = createFileWriteUndoData(file2, 'new 2');
      manager.addCommand('write', [file2], 'file_write', 'Write 2', true, undoData2);
      writeFileSync(file2, 'new 2');

      // Undo should revert file2 (most recent reversible)
      const result = await manager.undo();

      expect(result.success).toBe(true);
      expect(result.entry?.description).toBe('Write 2');

      const content2 = readFileSync(file2, 'utf8');
      expect(content2).toBe('content 2');

      // file1 should still have new content
      const content1 = readFileSync(file1, 'utf8');
      expect(content1).toBe('new 1');
    });
  });

  describe('redo', () => {
    it('should return error when no commands to redo', async () => {
      const result = await manager.redo();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No commands to redo');
    });

    it('should redo undone operation', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'original');

      const undoData = createFileWriteUndoData(testFile, 'new');
      manager.addCommand('write', [testFile], 'file_write', 'Write', true, undoData);

      writeFileSync(testFile, 'new');

      // Undo
      await manager.undo();
      expect(readFileSync(testFile, 'utf8')).toBe('original');

      // Redo
      const result = await manager.redo();
      expect(result.success).toBe(true);

      expect(readFileSync(testFile, 'utf8')).toBe('new');
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics correctly', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', true);
      manager.addCommand('edit', ['file2.txt'], 'file_edit', 'Edit 2', true);
      manager.addCommand('exec', ['npm test'], 'command_exec', 'Test', false);
      manager.addCommand('delete', ['file3.txt'], 'file_delete', 'Delete 3', true);

      const stats = manager.getStatistics();

      expect(stats.totalCommands).toBe(4);
      expect(stats.reversibleCommands).toBe(3);
      expect(stats.commandsByType.file_write).toBe(1);
      expect(stats.commandsByType.file_edit).toBe(1);
      expect(stats.commandsByType.command_exec).toBe(1);
      expect(stats.commandsByType.file_delete).toBe(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', false);
      manager.addCommand('write', ['file2.txt'], 'file_write', 'Write 2', false);

      expect(manager.getHistory()).toHaveLength(2);

      manager.clearHistory();

      expect(manager.getHistory()).toHaveLength(0);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });
  });

  describe('searchHistory', () => {
    beforeEach(() => {
      manager.addCommand('write', ['config.json'], 'file_write', 'Update configuration', false);
      manager.addCommand('edit', ['package.json'], 'file_edit', 'Edit package', false);
      manager.addCommand('delete', ['temp.txt'], 'file_delete', 'Remove temp file', false);
    });

    it('should search by command', () => {
      const results = manager.searchHistory('write');

      expect(results).toHaveLength(1);
      expect(results[0].command).toBe('write');
    });

    it('should search by description', () => {
      const results = manager.searchHistory('configuration');

      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('configuration');
    });

    it('should search by args', () => {
      const results = manager.searchHistory('config.json');

      expect(results).toHaveLength(1);
      expect(results[0].args).toContain('config.json');
    });

    it('should be case-insensitive', () => {
      const results = manager.searchHistory('CONFIG');

      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = manager.searchHistory('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('filterByType', () => {
    beforeEach(() => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', false);
      manager.addCommand('edit', ['file2.txt'], 'file_edit', 'Edit 2', false);
      manager.addCommand('write', ['file3.txt'], 'file_write', 'Write 3', false);
    });

    it('should filter commands by type', () => {
      const writeCommands = manager.filterByType('file_write');

      expect(writeCommands).toHaveLength(2);
      expect(writeCommands.every(cmd => cmd.type === 'file_write')).toBe(true);
    });

    it('should return empty array for unused type', () => {
      const deleteCommands = manager.filterByType('file_delete');

      expect(deleteCommands).toHaveLength(0);
    });
  });

  describe('getPositionInfo', () => {
    it('should return current position information', () => {
      manager.addCommand('write', ['file1.txt'], 'file_write', 'Write 1', false);
      manager.addCommand('write', ['file2.txt'], 'file_write', 'Write 2', false);

      const info = manager.getPositionInfo();

      expect(info.current).toBe(2);
      expect(info.total).toBe(2);
      expect(info.canUndo).toBe(false); // No reversible commands
      expect(info.canRedo).toBe(false);
    });
  });
});

describe('Undo Data Creators', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-undo-data');
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      const files = require('fs').readdirSync(testDir);
      files.forEach((file: string) => {
        try {
          unlinkSync(join(testDir, file));
        } catch (error) {
          // Ignore
        }
      });
      try {
        require('fs').rmdirSync(testDir);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('createFileWriteUndoData', () => {
    it('should capture original content for existing file', () => {
      const testFile = join(testDir, 'existing.txt');
      writeFileSync(testFile, 'original content');

      const undoData = createFileWriteUndoData(testFile, 'new content');

      expect(undoData.operation).toBe('restore_file');
      expect(undoData.originalPath).toBe(testFile);
      expect(undoData.originalContent).toBe('original content');
      expect(undoData.newContent).toBe('new content');
    });

    it('should handle new files with undefined original content', () => {
      const testFile = join(testDir, 'new-file.txt');

      const undoData = createFileWriteUndoData(testFile, 'new content');

      expect(undoData.originalContent).toBeUndefined();
      expect(undoData.newContent).toBe('new content');
    });
  });

  describe('createFileEditUndoData', () => {
    it('should capture original content', () => {
      const testFile = join(testDir, 'edit.txt');
      writeFileSync(testFile, 'original content');

      const undoData = createFileEditUndoData(testFile, 'edited content');

      expect(undoData.operation).toBe('restore_file');
      expect(undoData.originalContent).toBe('original content');
      expect(undoData.newContent).toBe('edited content');
    });
  });

  describe('createFileDeleteUndoData', () => {
    it('should create backup file', () => {
      const testFile = join(testDir, 'delete.txt');
      writeFileSync(testFile, 'content to delete');

      const undoData = createFileDeleteUndoData(testFile);

      expect(undoData.operation).toBe('restore_deleted');
      expect(undoData.originalPath).toBe(testFile);
      expect(undoData.originalContent).toBe('content to delete');
      expect(undoData.backupPath).toBeTruthy();
      expect(existsSync(undoData.backupPath!)).toBe(true);

      // Clean up backup
      if (undoData.backupPath) {
        unlinkSync(undoData.backupPath);
      }
    });
  });

  describe('createFileCreateUndoData', () => {
    it('should create undo data for file creation', () => {
      const testFile = join(testDir, 'created.txt');

      const undoData = createFileCreateUndoData(testFile, 'new content');

      expect(undoData.operation).toBe('delete_file');
      expect(undoData.originalPath).toBe(testFile);
      expect(undoData.newContent).toBe('new content');
    });
  });

  describe('createFileRenameUndoData', () => {
    it('should create undo data for file rename', () => {
      const oldPath = join(testDir, 'old-name.txt');
      const newPath = join(testDir, 'new-name.txt');

      const undoData = createFileRenameUndoData(oldPath, newPath);

      expect(undoData.operation).toBe('reverse_rename');
      expect(undoData.originalPath).toBe(oldPath);
      expect(undoData.newPath).toBe(newPath);
    });
  });
});

describe('renderCommandHistory', () => {
  it('should render command history', () => {
    const manager = new CommandHistoryManager();

    manager.addCommand('write', ['file1.txt'], 'file_write', 'Write file 1', false);
    manager.addCommand('edit', ['file2.txt'], 'file_edit', 'Edit file 2', true);

    const rendered = renderCommandHistory(manager.getHistory());

    expect(rendered).toContain('Command History');
    expect(rendered).toContain('Write file 1');
    expect(rendered).toContain('Edit file 2');
  });

  it('should highlight reversible commands', () => {
    const manager = new CommandHistoryManager();

    manager.addCommand('write', ['file.txt'], 'file_write', 'Reversible', true);

    const rendered = renderCommandHistory(manager.getHistory(), { highlightReversible: true });

    expect(rendered).toContain('Reversible');
  });
});

describe('renderUndoRedoStatus', () => {
  it('should render undo/redo status', () => {
    const manager = new CommandHistoryManager();

    manager.addCommand('write', ['file.txt'], 'file_write', 'Write', false);

    const rendered = renderUndoRedoStatus(manager);

    expect(rendered).toContain('Undo/Redo Status');
    expect(rendered).toContain('Position');
    expect(rendered).toContain('Can Undo');
    expect(rendered).toContain('Can Redo');
  });
});

describe('Edge Cases', () => {
  let manager: CommandHistoryManager;

  beforeEach(() => {
    manager = new CommandHistoryManager();
  });

  it('should handle history size limit of 100', () => {
    for (let i = 0; i < 150; i++) {
      manager.addCommand('write', [`file${i}.txt`], 'file_write', `Write ${i}`, false);
    }

    const history = manager.getHistory();
    expect(history.length).toBeLessThanOrEqual(100);
  });

  it('should handle multiple undo/redo cycles', async () => {
    const testDir = join(process.cwd(), '.test-cycles');
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    const testFile = join(testDir, 'test.txt');
    writeFileSync(testFile, 'original');

    const undoData = createFileWriteUndoData(testFile, 'new');
    manager.addCommand('write', [testFile], 'file_write', 'Write', true, undoData);

    writeFileSync(testFile, 'new');

    // Multiple undo/redo cycles
    await manager.undo();
    await manager.redo();
    await manager.undo();
    await manager.redo();

    expect(readFileSync(testFile, 'utf8')).toBe('new');

    // Cleanup
    unlinkSync(testFile);
    require('fs').rmdirSync(testDir);
  });
});
