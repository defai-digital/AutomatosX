/**
 * Unit tests for test helper functions
 *
 * Tests the path assertions and temporary directory helpers
 *
 * @module tests/unit/test-helpers
 * @since 5.7.0
 */

import { describe, it, expect } from 'vitest';
import {
  expectPathsToBeEqual,
  expectPathsToNotBeEqual,
  expectPathToContain,
  expectPathToNotContain,
  expectPathToBeNormalized,
  expectPathToStartWith,
  expectPathToEndWith,
  expectPathToBeAbsolute,
  expectPathToBeRelative,
  expectPathsToAllBeEqual
} from '../helpers/path-assertions.js';
import {
  createTempDir,
  withTempDir,
  createTempDirWithStructure,
  createTempDirs,
  getTempDirCount
} from '../helpers/temp-dir.js';

describe('Test Helpers', () => {
  describe('Path Assertions', () => {
    describe('expectPathsToBeEqual()', () => {
      it('passes when paths are equal', () => {
        expect(() => {
          expectPathsToBeEqual('/foo/bar', '/foo/bar');
        }).not.toThrow();
      });

      it('passes when separators differ', () => {
        expect(() => {
          expectPathsToBeEqual('foo/bar', 'foo\\bar');
        }).not.toThrow();
      });

      it('throws when paths are different', () => {
        expect(() => {
          expectPathsToBeEqual('/foo/bar', '/foo/baz');
        }).toThrow();
      });
    });

    describe('expectPathsToNotBeEqual()', () => {
      it('passes when paths are different', () => {
        expect(() => {
          expectPathsToNotBeEqual('/foo/bar', '/foo/baz');
        }).not.toThrow();
      });

      it('throws when paths are equal', () => {
        expect(() => {
          expectPathsToNotBeEqual('/foo/bar', '/foo\\bar');
        }).toThrow();
      });
    });

    describe('expectPathToContain()', () => {
      it('passes when path contains segment', () => {
        expect(() => {
          expectPathToContain('/foo/bar/baz', 'bar/baz');
        }).not.toThrow();
      });

      it('throws when path does not contain segment', () => {
        expect(() => {
          expectPathToContain('/foo/bar/baz', 'qux');
        }).toThrow();
      });
    });

    describe('expectPathToNotContain()', () => {
      it('passes when path does not contain segment', () => {
        expect(() => {
          expectPathToNotContain('/foo/bar/baz', 'qux');
        }).not.toThrow();
      });

      it('throws when path contains segment', () => {
        expect(() => {
          expectPathToNotContain('/foo/bar/baz', 'bar');
        }).toThrow();
      });
    });

    describe('expectPathToBeNormalized()', () => {
      it('passes for paths with forward slashes', () => {
        expect(() => {
          expectPathToBeNormalized('/foo/bar/baz');
        }).not.toThrow();
      });

      it('throws for paths with backslashes', () => {
        expect(() => {
          expectPathToBeNormalized('C:\\foo\\bar');
        }).toThrow();
      });
    });

    describe('expectPathToStartWith()', () => {
      it('passes when path starts with prefix', () => {
        expect(() => {
          expectPathToStartWith('/foo/bar/baz', '/foo/bar');
        }).not.toThrow();
      });

      it('throws when path does not start with prefix', () => {
        expect(() => {
          expectPathToStartWith('/foo/bar/baz', '/qux');
        }).toThrow();
      });
    });

    describe('expectPathToEndWith()', () => {
      it('passes when path ends with suffix', () => {
        expect(() => {
          expectPathToEndWith('/foo/bar/baz.txt', 'baz.txt');
        }).not.toThrow();
      });

      it('throws when path does not end with suffix', () => {
        expect(() => {
          expectPathToEndWith('/foo/bar/baz.txt', 'qux.txt');
        }).toThrow();
      });
    });

    describe('expectPathToBeAbsolute()', () => {
      it('passes for Unix absolute paths', () => {
        expect(() => {
          expectPathToBeAbsolute('/foo/bar');
        }).not.toThrow();
      });

      it('passes for Windows absolute paths', () => {
        expect(() => {
          expectPathToBeAbsolute('C:/foo/bar');
        }).not.toThrow();
      });

      it('throws for relative paths', () => {
        expect(() => {
          expectPathToBeAbsolute('foo/bar');
        }).toThrow();
      });
    });

    describe('expectPathToBeRelative()', () => {
      it('passes for relative paths', () => {
        expect(() => {
          expectPathToBeRelative('foo/bar');
        }).not.toThrow();
      });

      it('throws for absolute paths', () => {
        expect(() => {
          expectPathToBeRelative('/foo/bar');
        }).toThrow();
      });
    });

    describe('expectPathsToAllBeEqual()', () => {
      it('passes when all paths are equal', () => {
        expect(() => {
          expectPathsToAllBeEqual(['/foo/bar', '/foo\\bar', '/foo/bar']);
        }).not.toThrow();
      });

      it('throws when any path differs', () => {
        expect(() => {
          expectPathsToAllBeEqual(['/foo/bar', '/foo/bar', '/foo/baz']);
        }).toThrow();
      });

      it('throws when less than 2 paths provided', () => {
        expect(() => {
          expectPathsToAllBeEqual(['/foo/bar']);
        }).toThrow('requires at least 2 paths');
      });
    });
  });

  describe('Temporary Directory Helpers', () => {
    describe('createTempDir()', () => {
      it('creates a temporary directory', async () => {
        const tempDir = await createTempDir({ autoCleanup: false });

        expect(tempDir.path).toBeTruthy();
        expect(tempDir.normalizedPath).not.toContain('\\');

        await tempDir.cleanup();
      });

      it('creates files within temp directory', async () => {
        const tempDir = await createTempDir({ autoCleanup: false });

        const filePath = await tempDir.createFile('test.txt', 'hello world');
        const content = await tempDir.readFile('test.txt');

        expect(content).toBe('hello world');
        expect(filePath).toContain('test.txt');

        await tempDir.cleanup();
      });

      it('creates subdirectories', async () => {
        const tempDir = await createTempDir({ autoCleanup: false });

        const subdirPath = await tempDir.createSubdir('subdir');
        expect(subdirPath).toContain('subdir');

        await tempDir.createFile('subdir/nested.txt', 'nested content');
        const content = await tempDir.readFile('subdir/nested.txt');
        expect(content).toBe('nested content');

        await tempDir.cleanup();
      });

      it('resolves paths within temp directory', async () => {
        const tempDir = await createTempDir({ autoCleanup: false });

        const resolved = tempDir.resolve('foo', 'bar', 'baz.txt');
        expect(resolved).toContain('foo');
        expect(resolved).toContain('bar');
        expect(resolved).toContain('baz.txt');

        await tempDir.cleanup();
      });
    });

    describe('withTempDir()', () => {
      it('automatically cleans up temp directory', async () => {
        let tempPath: string = '';

        await withTempDir(async (tempDir) => {
          tempPath = tempDir.path;
          await tempDir.createFile('test.txt', 'content');
        });

        // Directory should be cleaned up
        expect(tempPath).toBeTruthy();
      });

      it('returns callback result', async () => {
        const result = await withTempDir(async (tempDir) => {
          await tempDir.createFile('test.txt', 'content');
          return 42;
        });

        expect(result).toBe(42);
      });
    });

    describe('createTempDirWithStructure()', () => {
      it('creates directory with predefined structure', async () => {
        const tempDir = await createTempDirWithStructure(
          {
            'file1.txt': 'content1',
            'subdir/file2.txt': 'content2',
            'subdir/nested/file3.txt': 'content3'
          },
          { autoCleanup: false }
        );

        const content1 = await tempDir.readFile('file1.txt');
        const content2 = await tempDir.readFile('subdir/file2.txt');
        const content3 = await tempDir.readFile('subdir/nested/file3.txt');

        expect(content1).toBe('content1');
        expect(content2).toBe('content2');
        expect(content3).toBe('content3');

        await tempDir.cleanup();
      });
    });

    describe('createTempDirs()', () => {
      it('creates multiple temp directories', async () => {
        const dirs = await createTempDirs(3, { autoCleanup: false });

        expect(dirs).toHaveLength(3);
        expect(dirs[0]?.path).toBeTruthy();
        expect(dirs[1]?.path).toBeTruthy();
        expect(dirs[2]?.path).toBeTruthy();

        // All paths should be different
        expect(dirs[0]?.path).not.toBe(dirs[1]?.path);
        expect(dirs[1]?.path).not.toBe(dirs[2]?.path);

        await Promise.all(dirs.map((dir) => dir.cleanup()));
      });
    });

    describe('getTempDirCount()', () => {
      it('tracks active temp directories', async () => {
        const initialCount = getTempDirCount();

        const dir1 = await createTempDir({ autoCleanup: true });
        expect(getTempDirCount()).toBe(initialCount + 1);

        const dir2 = await createTempDir({ autoCleanup: true });
        expect(getTempDirCount()).toBe(initialCount + 2);

        await dir1.cleanup();
        expect(getTempDirCount()).toBe(initialCount + 1);

        await dir2.cleanup();
        expect(getTempDirCount()).toBe(initialCount);
      });
    });
  });
});
