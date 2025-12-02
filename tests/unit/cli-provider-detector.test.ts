/**
 * Unit tests for CLI Provider Detector
 *
 * Tests cover:
 * - Cross-platform detection (Windows, Unix)
 * - Configuration hierarchy (ENV → Config → PATH)
 * - Version verification
 * - Caching behavior
 * - Error handling
 *
 * @see src/core/cli-provider-detector.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import {
  detectAll,
  ensureProvider,
  runProvider,
  findOnPath,
  spawnCross,
  clearCache,
  type Provider,
  type ProviderConfig,
  type DetectionReport
} from '../../src/core/cli-provider-detector.js';

// Mock file system
vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn()
}));

describe('CLI Provider Detector', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();

    // Reset mocks
    vi.clearAllMocks();

    // Save original env
    process.env.__TEST_BACKUP__ = JSON.stringify({
      CLAUDE_CLI: process.env.CLAUDE_CLI,
      GEMINI_CLI: process.env.GEMINI_CLI,
      CODEX_CLI: process.env.CODEX_CLI,
      PATH: process.env.PATH,
      PATHEXT: process.env.PATHEXT
    });
  });

  afterEach(() => {
    // Restore env
    if (process.env.__TEST_BACKUP__) {
      const backup = JSON.parse(process.env.__TEST_BACKUP__);
      process.env.CLAUDE_CLI = backup.CLAUDE_CLI;
      process.env.GEMINI_CLI = backup.GEMINI_CLI;
      process.env.CODEX_CLI = backup.CODEX_CLI;
      process.env.PATH = backup.PATH;
      process.env.PATHEXT = backup.PATHEXT;
      delete process.env.__TEST_BACKUP__;
    }
  });

  describe('findOnPath', () => {
    describe('Windows platform', () => {
      beforeEach(() => {
        // Mock Windows platform
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          configurable: true
        });
      });

      it('should find provider using where.exe', () => {
        const mockPath = 'C:\\Users\\test\\AppData\\Roaming\\npm\\claude.cmd';

        vi.mocked(spawnSync).mockReturnValue({
          status: 0,
          stdout: Buffer.from(`${mockPath}\n`),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(mockPath), Buffer.from('')],
          signal: null
        });

        const result = findOnPath('claude');

        expect(result.found).toBe(true);
        expect(result.path).toBe(mockPath);
        expect(spawnSync).toHaveBeenCalledWith('where', ['claude'], expect.any(Object));
      });

      it.skipIf(process.platform !== 'win32')('should fallback to PATH × PATHEXT scan when where.exe fails', () => {
        // Mock where.exe failure
        vi.mocked(spawnSync).mockReturnValue({
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from('ERROR: not found'),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        });

        // Mock PATH and PATHEXT
        process.env.PATH = 'C:\\Windows\\System32;C:\\Program Files\\nodejs;C:\\Users\\test\\AppData\\Roaming\\npm';
        process.env.PATHEXT = '.COM;.EXE;.BAT;.CMD';

        // Note: PATHEXT is uppercased in implementation, so path will be .CMD (uppercase)
        const mockPath = 'C:\\Users\\test\\AppData\\Roaming\\npm\\claude.CMD';
        vi.mocked(existsSync).mockImplementation((path: any) => {
          return path === mockPath;
        });

        const result = findOnPath('claude');

        expect(result.found).toBe(true);
        expect(result.path).toBe(mockPath);
      });

      it.skipIf(process.platform !== 'win32')('should try all PATHEXT extensions', () => {
        vi.mocked(spawnSync).mockReturnValue({
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        });

        process.env.PATH = 'C:\\test';
        process.env.PATHEXT = '.EXE;.CMD;.BAT';

        // Note: PATHEXT is uppercased in implementation
        const mockPath = 'C:\\test\\gemini.CMD';
        vi.mocked(existsSync).mockImplementation((path: any) => {
          return path === mockPath;
        });

        const result = findOnPath('gemini');

        expect(result.found).toBe(true);
        expect(result.path).toBe(mockPath);
        // Should have tried .EXE first, then .CMD
        expect(existsSync).toHaveBeenCalledWith('C:\\test\\gemini.EXE');
        expect(existsSync).toHaveBeenCalledWith('C:\\test\\gemini.CMD');
      });

      it('should return not found when provider missing', () => {
        vi.mocked(spawnSync).mockReturnValue({
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        });

        process.env.PATH = 'C:\\test';
        process.env.PATHEXT = '.EXE;.CMD';

        vi.mocked(existsSync).mockReturnValue(false);

        const result = findOnPath('nonexistent');

        expect(result.found).toBe(false);
        expect(result.path).toBeUndefined();
      });
    });

    describe('Unix platform', () => {
      beforeEach(() => {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          configurable: true
        });
      });

      it('should find provider using which', () => {
        const mockPath = '/usr/local/bin/claude';

        vi.mocked(spawnSync).mockReturnValue({
          status: 0,
          stdout: Buffer.from(mockPath),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(mockPath), Buffer.from('')],
          signal: null
        });

        const result = findOnPath('claude');

        expect(result.found).toBe(true);
        expect(result.path).toBe(mockPath);
        expect(spawnSync).toHaveBeenCalledWith('which', ['claude'], expect.any(Object));
      });

      it('should return not found when which fails', () => {
        vi.mocked(spawnSync).mockReturnValue({
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        });

        const result = findOnPath('nonexistent');

        expect(result.found).toBe(false);
        expect(result.path).toBeUndefined();
      });
    });
  });

  describe('detectAll', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
    });

    it('should detect all three providers', async () => {
      // Mock successful detection for all providers
      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        const arg = args?.[0];

        // which command
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from(`/usr/local/bin/${arg}`),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from(`/usr/local/bin/${arg}`), Buffer.from('')],
            signal: null
          };
        }

        // version check
        if (args?.includes('--version')) {
          const provider = args[0];
          return {
            status: 0,
            stdout: Buffer.from(`${provider} version 1.0.0`),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('1.0.0'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      const reports = await detectAll();

      expect(reports).toHaveLength(3);
      expect(reports.every(r => r.found)).toBe(true);
      expect(reports.map(r => r.provider)).toEqual(['claude', 'gemini', 'codex']);
    });

    it('should respect ENV variable override', async () => {
      const customPath = '/custom/path/to/claude';
      process.env.CLAUDE_CLI = customPath;

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path === customPath;
      });

      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('2.0.0'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('2.0.0'), Buffer.from('')],
            signal: null
          };
        }

        // Other providers not found
        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      const reports = await detectAll();
      const claude = reports.find(r => r.provider === 'claude');

      expect(claude?.found).toBe(true);
      expect(claude?.path).toBe(customPath);
    });

    it('should respect config path override', async () => {
      const customPath = 'C:\\custom\\gemini.cmd';

      vi.mocked(existsSync).mockImplementation((path: any) => {
        return path === customPath;
      });

      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('0.8.2'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('0.8.2'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      const config: ProviderConfig = {
        paths: {
          gemini: customPath
        }
      };

      const reports = await detectAll(config);
      const gemini = reports.find(r => r.provider === 'gemini');

      expect(gemini?.found).toBe(true);
      expect(gemini?.path).toBe(customPath);
    });

    it('should verify minimum version requirements', async () => {
      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/claude'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('/usr/local/bin/claude'), Buffer.from('')],
            signal: null
          };
        }

        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('1.0.0'), // Old version
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('1.0.0'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      const reports = await detectAll({
        minVersions: {
          claude: '2.0.0' // Require newer version
        }
      });

      const claude = reports.find(r => r.provider === 'claude');

      expect(claude?.found).toBe(false);
      expect(claude?.version).toBe('1.0.0');
      expect(claude?.reason).toContain('version-too-low');
    });

    it('should handle detection errors gracefully', async () => {
      // Clear cache to ensure fresh detection
      clearCache();

      vi.mocked(spawnSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const reports = await detectAll();

      expect(reports).toHaveLength(3);
      expect(reports.every(r => !r.found)).toBe(true);
      // Errors are caught and reported as "not-found" (graceful degradation)
      expect(reports.every(r => r.reason === 'not-found')).toBe(true);
    });
  });

  describe('ensureProvider', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
    });

    it('should return resolved provider when available', async () => {
      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/claude'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('/usr/local/bin/claude'), Buffer.from('')],
            signal: null
          };
        }

        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('2.0.14'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('2.0.14'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      const resolved = await ensureProvider('claude');

      expect(resolved.absPath).toBe('/usr/local/bin/claude');
      expect(resolved.version).toBe('2.0.14');
    });

    it('should throw when provider not found', async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        pid: 1234,
        output: [null, Buffer.from(''), Buffer.from('')],
        signal: null
      });

      await expect(ensureProvider('claude')).rejects.toThrow(
        'Provider "claude" not found'
      );
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true
      });
    });

    it('should cache detection results', async () => {
      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/claude'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('/usr/local/bin/claude'), Buffer.from('')],
            signal: null
          };
        }

        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('2.0.0'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('2.0.0'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      // First call
      await detectAll();
      const firstCallCount = vi.mocked(spawnSync).mock.calls.length;

      // Second call should use cache
      await detectAll();
      const secondCallCount = vi.mocked(spawnSync).mock.calls.length;

      // No additional calls should be made
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should respect cache clear', async () => {
      vi.mocked(spawnSync).mockImplementation((cmd: string, args?: readonly string[]) => {
        if (cmd === 'which') {
          return {
            status: 0,
            stdout: Buffer.from('/usr/local/bin/claude'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('/usr/local/bin/claude'), Buffer.from('')],
            signal: null
          };
        }

        if (args?.includes('--version')) {
          return {
            status: 0,
            stdout: Buffer.from('2.0.0'),
            stderr: Buffer.from(''),
            pid: 1234,
            output: [null, Buffer.from('2.0.0'), Buffer.from('')],
            signal: null
          };
        }

        return {
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [null, Buffer.from(''), Buffer.from('')],
          signal: null
        };
      });

      // First call
      await detectAll();
      const firstCallCount = vi.mocked(spawnSync).mock.calls.length;

      // Clear cache
      clearCache();

      // Second call should re-detect
      await detectAll();
      const secondCallCount = vi.mocked(spawnSync).mock.calls.length;

      // Should have made additional calls
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });
  });
});
