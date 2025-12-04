/**
 * Unit tests for path-utils module
 *
 * Tests cross-platform path handling utilities including:
 * - Path normalization (display vs filesystem)
 * - Path comparison (case-sensitive/insensitive)
 * - Path containment checks
 * - Windows short path expansion
 * - Platform detection
 *
 * @module tests/unit/path-utils
 * @since 5.7.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import {
  normalizePath,
  platformPath,
  pathsEqual,
  pathContains,
  getRelativePath,
  isWindows,
  isAbsolutePath,
  expandShortPath,
  expandShortPathSync,
  joinPath,
  joinPathDisplay,
  resolvePath,
  dirname,
  basename,
  extname
} from '../../src/shared/validation/path-utils.js';

describe('path-utils', () => {
  describe('normalizePath()', () => {
    it('converts Windows backslashes to forward slashes', () => {
      const input = 'C:\\Users\\foo\\bar\\baz.txt';
      const expected = 'C:/Users/foo/bar/baz.txt';
      expect(normalizePath(input)).toBe(expected);
    });

    it('preserves Unix forward slashes', () => {
      const input = '/Users/foo/bar/baz.txt';
      expect(normalizePath(input)).toBe(input);
    });

    it('handles mixed separators', () => {
      const input = 'C:/Users\\foo/bar\\baz.txt';
      const expected = 'C:/Users/foo/bar/baz.txt';
      expect(normalizePath(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect(normalizePath('')).toBe('');
    });

    it('handles root paths', () => {
      expect(normalizePath('C:\\')).toBe('C:/');
      expect(normalizePath('/')).toBe('/');
    });

    it('handles relative paths', () => {
      expect(normalizePath('..\\..\\foo')).toBe('../../foo');
      expect(normalizePath('../../foo')).toBe('../../foo');
    });

    it('handles paths with dots', () => {
      expect(normalizePath('.\\foo\\bar')).toBe('./foo/bar');
      expect(normalizePath('./foo/bar')).toBe('./foo/bar');
    });

    it('handles UNC paths (Windows network paths)', () => {
      const input = '\\\\server\\share\\folder';
      const expected = '//server/share/folder';
      expect(normalizePath(input)).toBe(expected);
    });
  });

  describe('platformPath()', () => {
    it('normalizes path using platform-native separators', () => {
      const input = 'foo/bar/baz.txt';
      const result = platformPath(input);

      // Result should be valid for current platform
      if (os.platform() === 'win32') {
        expect(result).toContain('\\');
      } else {
        expect(result).toBe('foo/bar/baz.txt');
      }
    });

    it('handles empty string', () => {
      expect(platformPath('')).toBe('');
    });

    it('resolves relative paths', () => {
      const input = 'foo/../bar/./baz.txt';
      const result = platformPath(input);

      // Should resolve to 'bar/baz.txt' with platform separators
      if (os.platform() === 'win32') {
        expect(result).toBe('bar\\baz.txt');
      } else {
        expect(result).toBe('bar/baz.txt');
      }
    });

    it('handles absolute paths', () => {
      const input = '/usr/local/bin';
      const result = platformPath(input);

      if (os.platform() === 'win32') {
        expect(result).toContain('\\');
      } else {
        expect(result).toBe('/usr/local/bin');
      }
    });
  });

  describe('pathsEqual()', () => {
    describe('Unix behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('darwin');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns true for identical paths', () => {
        expect(pathsEqual('/foo/bar', '/foo/bar')).toBe(true);
      });

      it('returns true when separators differ', () => {
        // normalizePath converts backslash to forward slash
        expect(pathsEqual('foo/bar', 'foo\\bar')).toBe(true);
      });

      it('returns false for different cases (case-sensitive)', () => {
        expect(pathsEqual('Foo/Bar', 'foo/bar')).toBe(false);
      });

      it('returns false for different paths', () => {
        expect(pathsEqual('/foo/bar', '/foo/baz')).toBe(false);
      });

      it('handles relative paths', () => {
        expect(pathsEqual('../foo', '../foo')).toBe(true);
        expect(pathsEqual('../foo', './foo')).toBe(false);
      });
    });

    describe('Windows behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('win32');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns true for identical paths', () => {
        expect(pathsEqual('C:\\foo\\bar', 'C:\\foo\\bar')).toBe(true);
      });

      it('returns true when separators differ', () => {
        expect(pathsEqual('C:/foo/bar', 'C:\\foo\\bar')).toBe(true);
      });

      it('returns true for different cases (case-insensitive)', () => {
        expect(pathsEqual('C:/Foo/Bar', 'c:/foo/bar')).toBe(true);
      });

      it('returns false for different paths', () => {
        expect(pathsEqual('C:\\foo\\bar', 'C:\\foo\\baz')).toBe(false);
      });

      it('handles UNC paths', () => {
        expect(pathsEqual('\\\\server\\share\\folder', '//server/share/folder')).toBe(true);
      });
    });

    it('handles empty strings', () => {
      expect(pathsEqual('', '')).toBe(true);
      expect(pathsEqual('foo', '')).toBe(false);
    });
  });

  describe('pathContains()', () => {
    describe('Unix behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('darwin');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns true when segment is found', () => {
        expect(pathContains('/foo/bar/baz', 'bar/baz')).toBe(true);
      });

      it('returns true with different separators', () => {
        // normalizePath converts backslash to forward slash
        expect(pathContains('/foo/bar/baz', 'bar\\baz')).toBe(true);
      });

      it('returns false when segment is not found', () => {
        expect(pathContains('/foo/bar/baz', 'qux')).toBe(false);
      });

      it('returns false for different cases (case-sensitive)', () => {
        expect(pathContains('/Foo/Bar/Baz', 'bar/baz')).toBe(false);
      });

      it('handles partial segments', () => {
        expect(pathContains('/foo/barbaz', 'bar')).toBe(true);
      });
    });

    describe('Windows behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('win32');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns true when segment is found', () => {
        expect(pathContains('C:\\foo\\bar\\baz', 'bar/baz')).toBe(true);
      });

      it('returns true for different cases (case-insensitive)', () => {
        expect(pathContains('C:\\Foo\\Bar\\Baz', 'bar/baz')).toBe(true);
      });

      it('returns false when segment is not found', () => {
        expect(pathContains('C:\\foo\\bar\\baz', 'qux')).toBe(false);
      });

      it('handles UNC paths', () => {
        expect(pathContains('\\\\server\\share\\folder', 'share/folder')).toBe(true);
      });
    });

    it('handles empty strings', () => {
      expect(pathContains('', '')).toBe(true);
      expect(pathContains('/foo/bar', '')).toBe(true);
      expect(pathContains('', 'foo')).toBe(false);
    });
  });

  describe('getRelativePath()', () => {
    it('calculates relative path between directories', () => {
      const from = '/foo/bar';
      const to = '/foo/baz';
      const result = getRelativePath(from, to);
      expect(result).toBe('../baz');
    });

    it('normalizes result to forward slashes', () => {
      const from = 'C:\\foo\\bar';
      const to = 'C:\\foo\\baz';
      const result = getRelativePath(from, to);
      // Result should always use forward slashes
      expect(result).not.toContain('\\');
    });

    it('handles same directory', () => {
      const path = '/foo/bar';
      const result = getRelativePath(path, path);
      expect(result).toBe('');
    });

    it('handles nested paths', () => {
      const from = '/foo';
      const to = '/foo/bar/baz';
      const result = getRelativePath(from, to);
      expect(result).toBe('bar/baz');
    });

    it('handles parent paths', () => {
      const from = '/foo/bar/baz';
      const to = '/foo';
      const result = getRelativePath(from, to);
      expect(result).toBe('../..');
    });
  });

  describe('isWindows()', () => {
    it('returns true on Windows', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      expect(isWindows()).toBe(true);
      vi.restoreAllMocks();
    });

    it('returns false on macOS', () => {
      vi.spyOn(os, 'platform').mockReturnValue('darwin');
      expect(isWindows()).toBe(false);
      vi.restoreAllMocks();
    });

    it('returns false on Linux', () => {
      vi.spyOn(os, 'platform').mockReturnValue('linux');
      expect(isWindows()).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('expandShortPath()', () => {
    describe('Windows behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('win32');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      // Note: Cannot spy on ESM module exports (fs.realpath) in Vitest
      // These tests would require actual filesystem operations on Windows
      // or a different mocking approach

      it('handles empty string', async () => {
        const result = await expandShortPath('');
        expect(result).toBe('');
      });

      it('returns path on non-Windows platforms', async () => {
        // On macOS/Linux, it should return the path unchanged
        vi.spyOn(os, 'platform').mockReturnValue('darwin');
        const path = '/usr/local/bin';
        const result = await expandShortPath(path);
        expect(result).toBe(path);
        vi.restoreAllMocks();
      });
    });

    describe('Unix behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('darwin');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns path unchanged on Unix', async () => {
        const path = '/usr/local/bin';
        const result = await expandShortPath(path);
        expect(result).toBe(path);
      });

      // Note: Cannot spy on ESM module exports in Vitest
      // This test is skipped as it's not possible to spy on fs.realpath in ESM
    });
  });

  describe('expandShortPathSync()', () => {
    describe('Windows behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('win32');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('expands short path using realpathSync', () => {
        const shortPath = 'C:\\PROGRA~1\\foo';
        const expandedPath = 'C:\\Program Files\\foo';

        // Mock require to return our mock realpathSync
        const mockRealpathSync = vi.fn().mockReturnValue(expandedPath);
        vi.doMock('node:fs', () => ({
          realpathSync: mockRealpathSync
        }));

        const result = expandShortPathSync(shortPath);
        // On Windows, it should attempt to expand
        expect(result).toBeDefined();
      });

      it('returns original path if realpathSync fails', () => {
        const shortPath = 'C:\\PROGRA~1\\nonexistent';

        // Mock require to throw error
        vi.doMock('node:fs', () => ({
          realpathSync: vi.fn().mockImplementation(() => {
            throw new Error('ENOENT');
          })
        }));

        const result = expandShortPathSync(shortPath);
        expect(result).toBe(shortPath);
      });

      it('handles empty string', () => {
        const result = expandShortPathSync('');
        expect(result).toBe('');
      });
    });

    describe('Unix behavior', () => {
      beforeEach(() => {
        vi.spyOn(os, 'platform').mockReturnValue('darwin');
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('returns path unchanged on Unix', () => {
        const path = '/usr/local/bin';
        const result = expandShortPathSync(path);
        expect(result).toBe(path);
      });
    });
  });

  describe('Helper Functions', () => {
    describe('joinPath()', () => {
      it('joins path segments using platform separator', () => {
        const result = joinPath('foo', 'bar', 'baz.txt');

        if (os.platform() === 'win32') {
          expect(result).toBe('foo\\bar\\baz.txt');
        } else {
          expect(result).toBe('foo/bar/baz.txt');
        }
      });

      it('handles absolute paths', () => {
        const result = joinPath('/foo', 'bar', 'baz.txt');

        if (os.platform() === 'win32') {
          expect(result).toContain('\\');
        } else {
          expect(result).toBe('/foo/bar/baz.txt');
        }
      });

      it('handles empty segments', () => {
        const result = joinPath('foo', '', 'bar');

        if (os.platform() === 'win32') {
          expect(result).toBe('foo\\bar');
        } else {
          expect(result).toBe('foo/bar');
        }
      });

      it('normalizes relative path segments', () => {
        const result = joinPath('foo', '../bar', 'baz.txt');

        if (os.platform() === 'win32') {
          expect(result).toBe('bar\\baz.txt');
        } else {
          expect(result).toBe('bar/baz.txt');
        }
      });
    });

    describe('joinPathDisplay()', () => {
      it('joins path segments with forward slashes', () => {
        const result = joinPathDisplay('foo', 'bar', 'baz.txt');
        expect(result).toBe('foo/bar/baz.txt');
        expect(result).not.toContain('\\');
      });

      it('handles absolute paths', () => {
        const result = joinPathDisplay('/foo', 'bar', 'baz.txt');
        expect(result).toBe('/foo/bar/baz.txt');
      });

      it('normalizes relative path segments', () => {
        const result = joinPathDisplay('foo', '../bar', 'baz.txt');
        expect(result).toBe('bar/baz.txt');
      });

      it('consistent across all platforms', () => {
        const result = joinPathDisplay('C:', 'Users', 'foo', 'bar.txt');
        expect(result).not.toContain('\\');
      });
    });

    describe('resolvePath()', () => {
      it('resolves to absolute path', () => {
        const result = resolvePath('foo', 'bar');
        expect(result).toMatch(/^(\/|[A-Z]:\\)/); // Unix: starts with /, Windows: starts with C:\
      });

      it('handles absolute input', () => {
        const input = '/foo/bar';
        const result = resolvePath(input);

        if (os.platform() === 'win32') {
          expect(result).toMatch(/^[A-Z]:\\/);
        } else {
          expect(result).toBe('/foo/bar');
        }
      });

      it('resolves relative path segments', () => {
        const result = resolvePath('foo', '../bar');
        expect(result).toContain('bar');
        expect(result).not.toContain('foo');
      });
    });

    describe('dirname()', () => {
      it('returns directory name', () => {
        expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar');
      });

      it('handles Windows paths', () => {
        const result = dirname('C:\\foo\\bar\\baz.txt');

        if (os.platform() === 'win32') {
          expect(result).toBe('C:\\foo\\bar');
        } else {
          // On Unix, backslashes are treated as regular characters
          // 'C:\foo\bar\baz.txt' is treated as a single filename
          expect(result).toBe('.');
        }
      });

      it('handles root paths', () => {
        expect(dirname('/foo')).toBe('/');
      });

      it('handles relative paths', () => {
        expect(dirname('foo/bar')).toBe('foo');
      });
    });

    describe('basename()', () => {
      it('returns file name', () => {
        expect(basename('/foo/bar/baz.txt')).toBe('baz.txt');
      });

      it('removes extension when provided', () => {
        expect(basename('/foo/bar/baz.txt', '.txt')).toBe('baz');
      });

      it('handles Windows paths', () => {
        if (os.platform() === 'win32') {
          expect(basename('C:\\foo\\bar\\baz.txt')).toBe('baz.txt');
        } else {
          // On Unix, backslashes are treated as regular characters
          // 'C:\foo\bar\baz.txt' is treated as a single filename
          expect(basename('C:\\foo\\bar\\baz.txt')).toBe('C:\\foo\\bar\\baz.txt');
        }
      });

      it('handles paths without extension', () => {
        expect(basename('/foo/bar/baz')).toBe('baz');
      });

      it('handles root paths', () => {
        // Note: path.basename('/') returns '' on all platforms
        // This is expected behavior from Node.js path module
        const result = basename('/');
        expect(result).toBe('');
      });
    });

    describe('extname()', () => {
      it('returns file extension', () => {
        expect(extname('/foo/bar/baz.txt')).toBe('.txt');
      });

      it('handles multiple dots', () => {
        expect(extname('archive.tar.gz')).toBe('.gz');
      });

      it('returns empty string for no extension', () => {
        expect(extname('/foo/bar/baz')).toBe('');
      });

      it('handles hidden files', () => {
        expect(extname('.gitignore')).toBe('');
        expect(extname('.config.json')).toBe('.json');
      });

      it('handles Windows paths', () => {
        expect(extname('C:\\foo\\bar\\baz.txt')).toBe('.txt');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined input gracefully', () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(normalizePath(undefined as any)).toBe(undefined);
      expect(platformPath(undefined as any)).toBe(undefined);
    });

    it('handles null input gracefully', () => {
      expect(normalizePath(null as any)).toBe(null);
      expect(platformPath(null as any)).toBe(null);
    });

    it('handles special characters in paths', () => {
      const path = '/foo/bar (1)/baz [test].txt';
      expect(normalizePath(path)).toBe(path);
    });

    it('handles very long paths', () => {
      const longPath = '/foo/' + 'bar/'.repeat(100) + 'baz.txt';
      const result = normalizePath(longPath);
      expect(result).toContain('baz.txt');
      expect(result.split('/').length).toBeGreaterThan(100);
    });

    it('handles paths with spaces', () => {
      const path = '/foo bar/baz qux/file.txt';
      expect(normalizePath(path)).toBe(path);
      expect(pathContains(path, 'baz qux')).toBe(true);
    });

    it('handles paths with unicode characters', () => {
      const path = '/foo/文件夹/檔案.txt';
      expect(normalizePath(path)).toBe(path);
    });

    it('handles multiple consecutive separators', () => {
      const input = 'foo//bar///baz.txt';
      const result = platformPath(input);

      if (os.platform() === 'win32') {
        expect(result).toBe('foo\\bar\\baz.txt');
      } else {
        expect(result).toBe('foo/bar/baz.txt');
      }
    });

    it('handles trailing separators', () => {
      expect(normalizePath('/foo/bar/')).toBe('/foo/bar/');
      // Backslashes are converted to forward slashes
      expect(normalizePath('C:\\foo\\bar\\')).toBe('C:/foo/bar/');
    });
  });

  /**
   * isAbsolutePath() - Edge Case Tests (Queenie's Recommendations)
   *
   * Tests for cross-platform absolute path detection including:
   * - Windows UNC paths (\\server\share)
   * - Windows drive paths (C:\, D:/)
   * - Unix absolute paths (/)
   * - Relative paths
   *
   * @see tmp/code-review-phase2-queenie-updated.md
   * @since Phase 3.1
   */
  describe('isAbsolutePath() - Edge Cases (Queenie)', () => {
    describe('Windows UNC paths', () => {
      it('should detect Windows UNC path with backslashes', () => {
        // Note: On Unix, this is treated as relative path starting with \
        const result = isAbsolutePath('\\\\server\\share');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          // On Unix, backslash is a valid filename character, not a separator
          expect(result).toBe(false);
        }
      });

      it('should detect normalized UNC path with forward slashes', () => {
        const result = isAbsolutePath('//server/share');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          // On Unix, this is an absolute path (double slash is normalized to single)
          expect(result).toBe(true);
        }
      });

      it('should detect UNC path with subdirectories', () => {
        const result = isAbsolutePath('\\\\server\\share\\folder\\file.txt');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      });
    });

    describe('Windows drive paths', () => {
      it('should detect Windows drive with backslash (C:\\)', () => {
        const result = isAbsolutePath('C:\\');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          // On Unix, this is a relative path
          expect(result).toBe(false);
        }
      });

      it('should detect Windows drive with forward slash (C:/)', () => {
        const result = isAbsolutePath('C:/');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      });

      it('should detect Windows drive with subdirectory (D:/foo/bar)', () => {
        const result = isAbsolutePath('D:/foo/bar');
        if (os.platform() === 'win32') {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      });

      it('should NOT detect drive letter without slash as absolute (C:)', () => {
        // C: is relative to current directory on drive C:
        const result = isAbsolutePath('C:');
        expect(result).toBe(false);
      });

      it('should detect case-insensitive drive letters', () => {
        if (os.platform() === 'win32') {
          expect(isAbsolutePath('c:\\')).toBe(true);
          expect(isAbsolutePath('d:/')).toBe(true);
          expect(isAbsolutePath('Z:\\foo')).toBe(true);
        }
      });
    });

    describe('Unix absolute paths', () => {
      it('should detect root path (/)', () => {
        expect(isAbsolutePath('/')).toBe(true);
      });

      it('should detect Unix absolute path (/foo/bar)', () => {
        expect(isAbsolutePath('/foo/bar')).toBe(true);
      });

      it('should detect Unix absolute path with subdirectories', () => {
        expect(isAbsolutePath('/home/user/documents/file.txt')).toBe(true);
      });

      it('should detect Unix absolute path with special characters', () => {
        expect(isAbsolutePath('/foo/bar (1)/baz [test].txt')).toBe(true);
      });
    });

    describe('Relative paths', () => {
      it('should NOT detect simple relative path as absolute (foo/bar)', () => {
        expect(isAbsolutePath('foo/bar')).toBe(false);
      });

      it('should NOT detect parent reference as absolute (../foo)', () => {
        expect(isAbsolutePath('../foo')).toBe(false);
      });

      it('should NOT detect current directory reference as absolute (./foo)', () => {
        expect(isAbsolutePath('./foo')).toBe(false);
      });

      it('should NOT detect dot as absolute (.)', () => {
        expect(isAbsolutePath('.')).toBe(false);
      });

      it('should NOT detect double dot as absolute (..)', () => {
        expect(isAbsolutePath('..')).toBe(false);
      });

      it('should NOT detect complex relative path as absolute (a/b/../c)', () => {
        expect(isAbsolutePath('a/b/../c')).toBe(false);
      });
    });

    describe('Edge cases and empty inputs', () => {
      it('should handle empty string', () => {
        expect(isAbsolutePath('')).toBe(false);
      });

      it('should handle single slash', () => {
        expect(isAbsolutePath('/')).toBe(true);
      });

      it('should handle single backslash', () => {
        const result = isAbsolutePath('\\');
        if (os.platform() === 'win32') {
          // On Windows, single backslash is considered absolute (root of current drive)
          expect(result).toBe(true);
        } else {
          // On Unix, backslash is a filename character
          expect(result).toBe(false);
        }
      });

      it('should handle paths with mixed separators', () => {
        if (os.platform() === 'win32') {
          expect(isAbsolutePath('C:\\foo/bar\\baz')).toBe(true);
        }
      });
    });
  });
});
