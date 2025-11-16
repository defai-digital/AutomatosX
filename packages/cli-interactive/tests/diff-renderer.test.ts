/**
 * Tests for diff-renderer.ts
 * Verifies inline diff rendering with color-coded patches
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderFileDiff,
  renderMultiFileDiff,
  renderApprovalPrompt,
  type FileDiff,
  type DiffOptions
} from '../src/diff-renderer.js';

describe('Diff Renderer', () => {
  describe('renderFileDiff', () => {
    it('should render a simple file modification', () => {
      const diff: FileDiff = {
        path: 'src/app.ts',
        oldContent: 'const x = 1;\nconst y = 2;',
        newContent: 'const x = 1;\nconst y = 3;',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('src/app.ts');
      expect(result).toContain('modified');
      expect(result).toContain('const y = 2'); // old line
      expect(result).toContain('const y = 3'); // new line
    });

    it('should render a new file creation', () => {
      const diff: FileDiff = {
        path: 'src/new.ts',
        oldContent: '',
        newContent: 'export const foo = "bar";',
        isNew: true,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('src/new.ts');
      expect(result).toContain('new');
      expect(result).toContain('foo');
    });

    it('should render a file deletion', () => {
      const diff: FileDiff = {
        path: 'src/old.ts',
        oldContent: 'export const old = true;',
        newContent: '',
        isNew: false,
        isDeleted: true
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('src/old.ts');
      expect(result).toContain('deleted');
      expect(result).toContain('old');
    });

    it('should respect showLineNumbers option', () => {
      const diff: FileDiff = {
        path: 'src/app.ts',
        oldContent: 'line1\nline2',
        newContent: 'line1\nline3',
        isNew: false,
        isDeleted: false
      };

      const withNumbers = renderFileDiff(diff, { showLineNumbers: true });
      const withoutNumbers = renderFileDiff(diff, { showLineNumbers: false });

      expect(withNumbers).toMatch(/\d+/); // Should contain line numbers
      expect(withoutNumbers).not.toMatch(/^\s*\d+\s/m); // Should not start lines with numbers
    });

    it('should respect context option', () => {
      const diff: FileDiff = {
        path: 'src/app.ts',
        oldContent: 'line1\nline2\nline3\nline4\nline5',
        newContent: 'line1\nline2\nchanged\nline4\nline5',
        isNew: false,
        isDeleted: false
      };

      const fullContext = renderFileDiff(diff, { context: 10 });
      const limitedContext = renderFileDiff(diff, { context: 1 });

      // Full context should show all lines
      expect(fullContext).toContain('line1');
      expect(fullContext).toContain('line5');

      // Limited context might not show distant lines
      expect(limitedContext).toContain('line2');
      expect(limitedContext).toContain('changed');
    });

    it('should handle empty files', () => {
      const diff: FileDiff = {
        path: 'empty.ts',
        oldContent: '',
        newContent: '',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('empty.ts');
      expect(result).toContain('unchanged'); // or 'no changes'
    });

    it('should handle large files with many changes', () => {
      const oldLines = Array(100).fill(0).map((_, i) => `line ${i}`);
      const newLines = Array(100).fill(0).map((_, i) => i % 2 === 0 ? `line ${i}` : `changed ${i}`);

      const diff: FileDiff = {
        path: 'large.ts',
        oldContent: oldLines.join('\n'),
        newContent: newLines.join('\n'),
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff, { maxLines: 50 });

      expect(result).toContain('large.ts');
      expect(result).toBeTruthy();
    });
  });

  describe('renderMultiFileDiff', () => {
    it('should render multiple file diffs', () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/a.ts',
          oldContent: 'old a',
          newContent: 'new a',
          isNew: false,
          isDeleted: false
        },
        {
          path: 'src/b.ts',
          oldContent: 'old b',
          newContent: 'new b',
          isNew: false,
          isDeleted: false
        }
      ];

      const result = renderMultiFileDiff(diffs);

      expect(result).toContain('src/a.ts');
      expect(result).toContain('src/b.ts');
      expect(result).toContain('2 files'); // Summary
    });

    it('should show file count summary', () => {
      const diffs: FileDiff[] = [
        { path: 'new.ts', oldContent: '', newContent: 'new', isNew: true, isDeleted: false },
        { path: 'mod.ts', oldContent: 'old', newContent: 'new', isNew: false, isDeleted: false },
        { path: 'del.ts', oldContent: 'old', newContent: '', isNew: false, isDeleted: true }
      ];

      const result = renderMultiFileDiff(diffs);

      expect(result).toContain('3 files');
      expect(result).toContain('1 new');
      expect(result).toContain('1 modified');
      expect(result).toContain('1 deleted');
    });

    it('should handle empty diff list', () => {
      const result = renderMultiFileDiff([]);

      expect(result).toContain('No changes');
    });

    it('should respect compact mode', () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/a.ts',
          oldContent: 'line1\nline2\nline3',
          newContent: 'line1\nchanged\nline3',
          isNew: false,
          isDeleted: false
        }
      ];

      const compact = renderMultiFileDiff(diffs, { compact: true });
      const full = renderMultiFileDiff(diffs, { compact: false });

      expect(compact.length).toBeLessThan(full.length);
    });
  });

  describe('renderApprovalPrompt', () => {
    it('should render approval prompt with file list', () => {
      const diffs: FileDiff[] = [
        {
          path: 'src/a.ts',
          oldContent: 'old',
          newContent: 'new',
          isNew: false,
          isDeleted: false
        }
      ];

      const result = renderApprovalPrompt(diffs);

      expect(result).toContain('Review');
      expect(result).toContain('src/a.ts');
      expect(result).toContain('Approve'); // Action button
      expect(result).toContain('Cancel'); // Action button
    });

    it('should show file statistics', () => {
      const diffs: FileDiff[] = [
        { path: 'a.ts', oldContent: '', newContent: 'new', isNew: true, isDeleted: false },
        { path: 'b.ts', oldContent: 'old', newContent: 'new', isNew: false, isDeleted: false },
        { path: 'c.ts', oldContent: 'old', newContent: '', isNew: false, isDeleted: true }
      ];

      const result = renderApprovalPrompt(diffs);

      expect(result).toContain('3 files');
      expect(result).toMatch(/1.*new/i);
      expect(result).toMatch(/1.*modified/i);
      expect(result).toMatch(/1.*deleted/i);
    });

    it('should provide action options', () => {
      const diffs: FileDiff[] = [
        { path: 'a.ts', oldContent: 'old', newContent: 'new', isNew: false, isDeleted: false }
      ];

      const result = renderApprovalPrompt(diffs);

      expect(result).toContain('Approve all');
      expect(result).toContain('Review individually');
      expect(result).toContain('Show diffs');
      expect(result).toContain('Cancel');
    });

    it('should handle single file approval', () => {
      const diffs: FileDiff[] = [
        { path: 'single.ts', oldContent: 'old', newContent: 'new', isNew: false, isDeleted: false }
      ];

      const result = renderApprovalPrompt(diffs);

      expect(result).toContain('single.ts');
      expect(result).toContain('1 file');
    });

    it('should warn about deletions', () => {
      const diffs: FileDiff[] = [
        { path: 'delete-me.ts', oldContent: 'content', newContent: '', isNew: false, isDeleted: true }
      ];

      const result = renderApprovalPrompt(diffs);

      expect(result).toMatch(/delete|remove/i);
      expect(result).toContain('delete-me.ts');
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with special characters', () => {
      const diff: FileDiff = {
        path: 'src/file (with spaces).ts',
        oldContent: 'old',
        newContent: 'new',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('file (with spaces).ts');
    });

    it('should handle very long file paths', () => {
      const longPath = 'src/' + 'nested/'.repeat(20) + 'file.ts';
      const diff: FileDiff = {
        path: longPath,
        oldContent: 'old',
        newContent: 'new',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('file.ts');
    });

    it('should handle binary file indicators', () => {
      const diff: FileDiff = {
        path: 'image.png',
        oldContent: '',
        newContent: '',
        isNew: false,
        isDeleted: false,
        isBinary: true
      };

      const result = renderFileDiff(diff);

      expect(result).toContain('binary');
    });

    it('should handle files with no newline at end', () => {
      const diff: FileDiff = {
        path: 'no-newline.ts',
        oldContent: 'line without newline',
        newContent: 'line with newline\n',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff);

      expect(result).toBeTruthy();
    });
  });

  describe('Color and Formatting', () => {
    it('should use green for additions', () => {
      const diff: FileDiff = {
        path: 'add.ts',
        oldContent: '',
        newContent: 'new line',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff, { colorize: true });

      // Check for ANSI green color codes
      expect(result).toMatch(/\u001b\[32m/); // Green color
    });

    it('should use red for deletions', () => {
      const diff: FileDiff = {
        path: 'del.ts',
        oldContent: 'deleted line',
        newContent: '',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff, { colorize: true });

      // Check for ANSI red color codes
      expect(result).toMatch(/\u001b\[31m/); // Red color
    });

    it('should support colorless mode', () => {
      const diff: FileDiff = {
        path: 'plain.ts',
        oldContent: 'old',
        newContent: 'new',
        isNew: false,
        isDeleted: false
      };

      const result = renderFileDiff(diff, { colorize: false });

      // Should not contain ANSI escape codes
      expect(result).not.toMatch(/\u001b\[\d+m/);
    });
  });
});
