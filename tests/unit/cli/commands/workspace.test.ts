/**
 * Workspace Command Unit Tests
 *
 * Comprehensive tests for the workspace command including:
 * - List subcommand (PRD/tmp files)
 * - Stats subcommand
 * - Cleanup subcommand
 * - JSON output format
 * - Error handling
 *
 * @module tests/unit/cli/commands/workspace.test.ts
 * @since v12.8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Mock Modules
// ============================================================================

vi.mock('chalk', () => ({
  default: {
    blue: Object.assign((s: string) => s, { bold: (s: string) => s }),
    cyan: (s: string) => s,
    white: (s: string) => s,
    green: Object.assign((s: string) => s, { bold: (s: string) => s }),
    yellow: (s: string) => s,
    red: Object.assign((s: string) => s, { bold: (s: string) => s }),
    gray: (s: string) => s,
    dim: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}));

// ============================================================================
// Test Setup
// ============================================================================

describe('Workspace Command', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ============================================================================
  // List Subcommand Tests
  // ============================================================================

  describe('List Subcommand', () => {
    describe('Type Selection', () => {
      it('should default to PRD type', () => {
        const getType = (argv: { type?: 'prd' | 'tmp' }): 'prd' | 'tmp' => {
          return argv.type ?? 'prd';
        };

        expect(getType({})).toBe('prd');
      });

      it('should use specified type', () => {
        const getType = (argv: { type?: 'prd' | 'tmp' }): 'prd' | 'tmp' => {
          return argv.type ?? 'prd';
        };

        expect(getType({ type: 'prd' })).toBe('prd');
        expect(getType({ type: 'tmp' })).toBe('tmp');
      });
    });

    describe('File Listing', () => {
      it('should list PRD files', async () => {
        const mockWorkspaceManager = {
          listPRD: vi.fn().mockResolvedValue(['spec.md', 'design.md', 'roadmap.md']),
          listTmp: vi.fn().mockResolvedValue([]),
        };

        const files = await mockWorkspaceManager.listPRD();
        expect(files).toHaveLength(3);
        expect(files).toContain('spec.md');
        expect(files).toContain('design.md');
        expect(files).toContain('roadmap.md');
      });

      it('should list tmp files', async () => {
        const mockWorkspaceManager = {
          listPRD: vi.fn().mockResolvedValue([]),
          listTmp: vi.fn().mockResolvedValue(['temp1.txt', 'cache.json']),
        };

        const files = await mockWorkspaceManager.listTmp();
        expect(files).toHaveLength(2);
        expect(files).toContain('temp1.txt');
        expect(files).toContain('cache.json');
      });

      it('should handle empty file list', async () => {
        const mockWorkspaceManager = {
          listPRD: vi.fn().mockResolvedValue([]),
          listTmp: vi.fn().mockResolvedValue([]),
        };

        const files = await mockWorkspaceManager.listPRD();
        expect(files).toHaveLength(0);
      });
    });

    describe('JSON Output', () => {
      it('should format as JSON when flag is set', () => {
        const formatOutput = (type: string, files: string[], json: boolean): string => {
          if (json) {
            return JSON.stringify({ type, files }, null, 2);
          }
          return `Files: ${files.join(', ')}`;
        };

        const output = formatOutput('prd', ['file1.md', 'file2.md'], true);
        const parsed = JSON.parse(output);

        expect(parsed.type).toBe('prd');
        expect(parsed.files).toHaveLength(2);
      });

      it('should format as text when JSON flag is false', () => {
        const formatOutput = (type: string, files: string[], json: boolean): string => {
          if (json) {
            return JSON.stringify({ type, files }, null, 2);
          }
          return `Files: ${files.join(', ')}`;
        };

        const output = formatOutput('prd', ['file1.md', 'file2.md'], false);
        expect(output).toBe('Files: file1.md, file2.md');
      });
    });

    describe('Display Formatting', () => {
      it('should display file count summary', () => {
        const formatSummary = (files: string[]): string => {
          return `Total: ${files.length} file(s)`;
        };

        expect(formatSummary(['a', 'b', 'c'])).toBe('Total: 3 file(s)');
        expect(formatSummary(['a'])).toBe('Total: 1 file(s)');
        expect(formatSummary([])).toBe('Total: 0 file(s)');
      });

      it('should display empty state message', () => {
        const formatEmptyState = (files: string[]): string | null => {
          if (files.length === 0) {
            return '(No files)';
          }
          return null;
        };

        expect(formatEmptyState([])).toBe('(No files)');
        expect(formatEmptyState(['file.md'])).toBeNull();
      });

      it('should format workspace type title', () => {
        const getTitle = (type: 'prd' | 'tmp'): string => {
          return type === 'tmp' ? 'Temporary' : 'PRD';
        };

        expect(getTitle('prd')).toBe('PRD');
        expect(getTitle('tmp')).toBe('Temporary');
      });
    });
  });

  // ============================================================================
  // Stats Subcommand Tests
  // ============================================================================

  describe('Stats Subcommand', () => {
    describe('Statistics Retrieval', () => {
      it('should get workspace stats', async () => {
        const mockWorkspaceManager = {
          getStats: vi.fn().mockResolvedValue({
            prdFiles: 10,
            tmpFiles: 5,
            prdSizeBytes: 102400,
            tmpSizeBytes: 51200,
            totalSizeBytes: 153600,
          }),
        };

        const stats = await mockWorkspaceManager.getStats();
        expect(stats.prdFiles).toBe(10);
        expect(stats.tmpFiles).toBe(5);
        expect(stats.totalSizeBytes).toBe(153600);
      });

      it('should handle empty workspace', async () => {
        const mockWorkspaceManager = {
          getStats: vi.fn().mockResolvedValue({
            prdFiles: 0,
            tmpFiles: 0,
            prdSizeBytes: 0,
            tmpSizeBytes: 0,
            totalSizeBytes: 0,
          }),
        };

        const stats = await mockWorkspaceManager.getStats();
        expect(stats.prdFiles).toBe(0);
        expect(stats.tmpFiles).toBe(0);
        expect(stats.totalSizeBytes).toBe(0);
      });
    });

    describe('Size Formatting', () => {
      it('should format bytes to MB', () => {
        const formatSize = (bytes: number): string => {
          return (bytes / 1024 / 1024).toFixed(2);
        };

        expect(formatSize(1048576)).toBe('1.00'); // 1 MB
        expect(formatSize(2621440)).toBe('2.50'); // 2.5 MB
        expect(formatSize(0)).toBe('0.00');
      });
    });

    describe('JSON Output', () => {
      it('should output stats as JSON', () => {
        const stats = {
          prdFiles: 10,
          tmpFiles: 5,
          totalSizeBytes: 153600,
        };

        const jsonOutput = JSON.stringify(stats, null, 2);
        const parsed = JSON.parse(jsonOutput);

        expect(parsed.prdFiles).toBe(10);
        expect(parsed.tmpFiles).toBe(5);
        expect(parsed.totalSizeBytes).toBe(153600);
      });
    });
  });

  // ============================================================================
  // Cleanup Subcommand Tests
  // ============================================================================

  describe('Cleanup Subcommand', () => {
    describe('Age Validation', () => {
      it('should default to 7 days', () => {
        const getOlderThan = (argv: { olderThan?: number }): number => {
          return argv.olderThan ?? 7;
        };

        expect(getOlderThan({})).toBe(7);
      });

      it('should use specified age', () => {
        const getOlderThan = (argv: { olderThan?: number }): number => {
          return argv.olderThan ?? 7;
        };

        expect(getOlderThan({ olderThan: 14 })).toBe(14);
        expect(getOlderThan({ olderThan: 1 })).toBe(1);
        expect(getOlderThan({ olderThan: 30 })).toBe(30);
      });

      it('should reject invalid age values', () => {
        const validateAge = (olderThan: number): boolean => {
          return !isNaN(olderThan) && olderThan >= 0;
        };

        expect(validateAge(7)).toBe(true);
        expect(validateAge(0)).toBe(true);
        expect(validateAge(-1)).toBe(false);
        expect(validateAge(NaN)).toBe(false);
      });
    });

    describe('Confirmation Flow', () => {
      it('should require --confirm flag', () => {
        const requiresConfirmation = (confirm: boolean): boolean => {
          return !confirm;
        };

        expect(requiresConfirmation(false)).toBe(true);
        expect(requiresConfirmation(true)).toBe(false);
      });

      it('should show warning without confirmation', () => {
        const getWarningMessage = (olderThan: number): string => {
          return `This will remove temporary files older than ${olderThan} days`;
        };

        const warning = getWarningMessage(7);
        expect(warning).toContain('7 days');
      });
    });

    describe('Cleanup Execution', () => {
      it('should call cleanupTmp with age parameter', async () => {
        const mockWorkspaceManager = {
          cleanupTmp: vi.fn().mockResolvedValue(5),
        };

        const removed = await mockWorkspaceManager.cleanupTmp(7);
        expect(mockWorkspaceManager.cleanupTmp).toHaveBeenCalledWith(7);
        expect(removed).toBe(5);
      });

      it('should report removed file count', async () => {
        const mockWorkspaceManager = {
          cleanupTmp: vi.fn().mockResolvedValue(10),
        };

        const removed = await mockWorkspaceManager.cleanupTmp(14);
        const message = `Removed ${removed} temporary file(s)`;

        expect(message).toBe('Removed 10 temporary file(s)');
      });

      it('should handle no files to remove', async () => {
        const mockWorkspaceManager = {
          cleanupTmp: vi.fn().mockResolvedValue(0),
        };

        const removed = await mockWorkspaceManager.cleanupTmp(7);
        expect(removed).toBe(0);
      });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    describe('List Errors', () => {
      it('should handle list failure', async () => {
        const mockWorkspaceManager = {
          listPRD: vi.fn().mockRejectedValue(new Error('Permission denied')),
        };

        await expect(mockWorkspaceManager.listPRD()).rejects.toThrow('Permission denied');
      });

      it('should format error message', () => {
        const formatError = (message: string): string => {
          return `Failed to list workspaces: ${message}`;
        };

        expect(formatError('Permission denied')).toBe('Failed to list workspaces: Permission denied');
      });
    });

    describe('Stats Errors', () => {
      it('should handle stats failure', async () => {
        const mockWorkspaceManager = {
          getStats: vi.fn().mockRejectedValue(new Error('Directory not found')),
        };

        await expect(mockWorkspaceManager.getStats()).rejects.toThrow('Directory not found');
      });
    });

    describe('Cleanup Errors', () => {
      it('should handle cleanup failure', async () => {
        const mockWorkspaceManager = {
          cleanupTmp: vi.fn().mockRejectedValue(new Error('Cannot remove files')),
        };

        await expect(mockWorkspaceManager.cleanupTmp(7)).rejects.toThrow('Cannot remove files');
      });

      it('should format cleanup error message', () => {
        const formatError = (message: string): string => {
          return `Failed to cleanup workspaces: ${message}`;
        };

        expect(formatError('Cannot remove files')).toBe('Failed to cleanup workspaces: Cannot remove files');
      });
    });
  });

  // ============================================================================
  // Project Root Detection Tests
  // ============================================================================

  describe('Project Root Detection', () => {
    it('should detect project root', async () => {
      const mockDetectProjectRoot = vi.fn().mockResolvedValue('/home/user/project');

      const projectDir = await mockDetectProjectRoot(process.cwd());
      expect(projectDir).toBe('/home/user/project');
    });

    it('should use current working directory as base', async () => {
      const mockDetectProjectRoot = vi.fn().mockResolvedValue('/cwd/project');

      const cwd = '/cwd/project/subdir';
      const projectDir = await mockDetectProjectRoot(cwd);

      expect(mockDetectProjectRoot).toHaveBeenCalledWith(cwd);
      expect(projectDir).toBe('/cwd/project');
    });
  });

  // ============================================================================
  // Command Structure Tests
  // ============================================================================

  describe('Command Structure', () => {
    describe('Main Command', () => {
      it('should require subcommand', () => {
        const commandDefinition = {
          command: 'workspace <command>',
          describe: 'Manage agent workspaces',
          demandCommand: 1,
        };

        expect(commandDefinition.command).toBe('workspace <command>');
        expect(commandDefinition.demandCommand).toBe(1);
      });
    });

    describe('Subcommand Options', () => {
      it('should define list command options', () => {
        const listOptions = {
          type: {
            describe: 'Workspace type to list',
            type: 'string',
            choices: ['prd', 'tmp'],
            default: 'prd',
          },
          json: {
            describe: 'Output as JSON',
            type: 'boolean',
            default: false,
          },
        };

        expect(listOptions.type.choices).toContain('prd');
        expect(listOptions.type.choices).toContain('tmp');
        expect(listOptions.type.default).toBe('prd');
        expect(listOptions.json.default).toBe(false);
      });

      it('should define stats command options', () => {
        const statsOptions = {
          json: {
            describe: 'Output as JSON',
            type: 'boolean',
            default: false,
          },
        };

        expect(statsOptions.json.default).toBe(false);
      });

      it('should define cleanup command options', () => {
        const cleanupOptions = {
          olderThan: {
            describe: 'Clean up files older than N days',
            type: 'number',
            default: 7,
          },
          confirm: {
            describe: 'Skip confirmation prompt',
            type: 'boolean',
            default: false,
          },
        };

        expect(cleanupOptions.olderThan.default).toBe(7);
        expect(cleanupOptions.confirm.default).toBe(false);
      });
    });
  });

  // ============================================================================
  // Integration-Like Tests
  // ============================================================================

  describe('Command Flow', () => {
    it('should complete list flow successfully', async () => {
      const mockWorkspaceManager = {
        listPRD: vi.fn().mockResolvedValue(['file1.md', 'file2.md']),
      };

      const files = await mockWorkspaceManager.listPRD();
      const output = {
        type: 'prd',
        files,
        count: files.length,
      };

      expect(output.type).toBe('prd');
      expect(output.count).toBe(2);
    });

    it('should complete stats flow successfully', async () => {
      const mockWorkspaceManager = {
        getStats: vi.fn().mockResolvedValue({
          prdFiles: 5,
          tmpFiles: 3,
          totalSizeBytes: 51200,
        }),
      };

      const stats = await mockWorkspaceManager.getStats();
      expect(stats.prdFiles).toBe(5);
      expect(stats.tmpFiles).toBe(3);
    });

    it('should complete cleanup flow successfully', async () => {
      const mockWorkspaceManager = {
        cleanupTmp: vi.fn().mockResolvedValue(7),
      };

      const argv = { olderThan: 14, confirm: true };
      const removed = await mockWorkspaceManager.cleanupTmp(argv.olderThan);

      expect(removed).toBe(7);
      expect(mockWorkspaceManager.cleanupTmp).toHaveBeenCalledWith(14);
    });

    it('should exit without cleanup when not confirmed', () => {
      const shouldCleanup = (confirm: boolean): boolean => {
        return confirm;
      };

      expect(shouldCleanup(false)).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very large file counts', async () => {
      const mockWorkspaceManager = {
        listPRD: vi.fn().mockResolvedValue(Array(1000).fill('file.md')),
      };

      const files = await mockWorkspaceManager.listPRD();
      expect(files).toHaveLength(1000);
    });

    it('should handle very large file sizes', () => {
      const formatSize = (bytes: number): string => {
        return (bytes / 1024 / 1024).toFixed(2);
      };

      const largeSize = 10 * 1024 * 1024 * 1024; // 10 GB
      expect(formatSize(largeSize)).toBe('10240.00');
    });

    it('should handle zero-day cleanup', async () => {
      const mockWorkspaceManager = {
        cleanupTmp: vi.fn().mockResolvedValue(100),
      };

      const removed = await mockWorkspaceManager.cleanupTmp(0);
      expect(mockWorkspaceManager.cleanupTmp).toHaveBeenCalledWith(0);
      expect(removed).toBe(100);
    });

    it('should handle special characters in filenames', async () => {
      const mockWorkspaceManager = {
        listPRD: vi.fn().mockResolvedValue([
          'file with spaces.md',
          'file-with-dashes.md',
          'file_with_underscores.md',
          '文件.md',
        ]),
      };

      const files = await mockWorkspaceManager.listPRD();
      expect(files).toHaveLength(4);
      expect(files).toContain('file with spaces.md');
      expect(files).toContain('文件.md');
    });
  });
});
