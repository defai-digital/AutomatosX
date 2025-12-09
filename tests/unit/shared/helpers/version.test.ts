/**
 * Comprehensive tests for version.ts
 *
 * Tests for version information utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs before importing the module
vi.mock('fs', () => ({
  readFileSync: vi.fn()
}));

import { readFileSync } from 'fs';
import { getVersion, getVersionInfo } from '../../../../src/shared/helpers/version.js';

describe('version', () => {
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVersion', () => {
    it('should return version from package.json', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '12.5.5' }));

      const version = getVersion();

      expect(version).toBe('12.5.5');
    });

    it('should try multiple paths until finding package.json', () => {
      // First path fails, second succeeds
      mockReadFileSync
        .mockImplementationOnce(() => {
          throw new Error('ENOENT');
        })
        .mockReturnValueOnce(JSON.stringify({ version: '12.6.0' }));

      const version = getVersion();

      expect(version).toBe('12.6.0');
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    it('should return "unknown" when all paths fail', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      // Suppress console.error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = getVersion();

      expect(version).toBe('unknown');
      consoleSpy.mockRestore();
    });

    it('should return "unknown" when package.json has no version', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'test' }));

      // Suppress console.error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = getVersion();

      expect(version).toBe('unknown');
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON', () => {
      mockReadFileSync.mockReturnValue('not valid json');

      // Suppress console.error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = getVersion();

      expect(version).toBe('unknown');
      consoleSpy.mockRestore();
    });

    it('should handle empty package.json', () => {
      mockReadFileSync.mockReturnValue('{}');

      // Suppress console.error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = getVersion();

      expect(version).toBe('unknown');
      consoleSpy.mockRestore();
    });

    it('should handle version as empty string', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '' }));

      // Suppress console.error output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const version = getVersion();

      // Empty string is falsy, should continue to next path
      expect(version).toBe('unknown');
      consoleSpy.mockRestore();
    });
  });

  describe('getVersionInfo', () => {
    it('should return version info object', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '12.5.5' }));

      const info = getVersionInfo();

      expect(info.version).toBe('12.5.5');
      expect(info.codename).toBe('Current');
      expect(info.phase).toBe('Stable');
      expect(info.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return "unknown" version when not found', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const info = getVersionInfo();

      expect(info.version).toBe('unknown');
      expect(info.phase).toBe('Stable');
      consoleSpy.mockRestore();
    });

    it('should derive Beta phase from version string', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '13.0.0-beta.1' }));

      const info = getVersionInfo();

      expect(info.version).toBe('13.0.0-beta.1');
      expect(info.phase).toBe('Beta');
    });

    it('should derive Release Candidate phase from version string', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '13.0.0-rc.1' }));

      const info = getVersionInfo();

      expect(info.version).toBe('13.0.0-rc.1');
      expect(info.phase).toBe('Release Candidate');
    });

    it('should derive Alpha phase from version string', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '14.0.0-alpha.2' }));

      const info = getVersionInfo();

      expect(info.version).toBe('14.0.0-alpha.2');
      expect(info.phase).toBe('Alpha');
    });

    it('should default to Stable for release versions', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '12.5.5' }));

      const info = getVersionInfo();

      expect(info.phase).toBe('Stable');
    });

    it('should return releaseDate in YYYY-MM-DD format', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '12.5.5' }));

      const info = getVersionInfo();

      // releaseDate should be today's date in ISO format
      const today = new Date().toISOString().split('T')[0];
      expect(info.releaseDate).toBe(today);
    });

    it('should handle version with multiple pre-release tags', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0-alpha.beta.1' }));

      const info = getVersionInfo();

      // 'beta' is checked before 'alpha' in derivePhase
      expect(info.phase).toBe('Beta');
    });
  });
});
