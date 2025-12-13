/**
 * AgentStatusWriter Unit Tests
 *
 * Comprehensive tests for agent-status-writer.ts to achieve 80%+ coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import {
  writeAgentStatus,
  cleanupOldStatusFiles,
  type AgentStatus
} from '../../../../src/shared/helpers/agent-status-writer.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock logger to verify logging calls
vi.mock('../../../../src/shared/logging/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

describe('AgentStatusWriter', () => {
  const projectDir = '/test-project';
  const statusDir = `${projectDir}/.automatosx/status`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset virtual filesystem
    vol.reset();
    // Create base directory structure
    vol.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('writeAgentStatus', () => {
    it('creates status directory if it does not exist', async () => {
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      };

      await writeAgentStatus(status, projectDir);

      expect(vol.existsSync(statusDir)).toBe(true);
    });

    it('writes status file with correct content', async () => {
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: '2024-01-15T10:00:00.000Z',
        pid: 12345,
        duration: 5000,
        task: 'implement auth',
        provider: 'claude'
      };

      await writeAgentStatus(status, projectDir);

      // Find the written file
      const files = vol.readdirSync(statusDir) as string[];
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^backend-\d+-12345\.json$/);

      // Check content
      const content = JSON.parse(
        vol.readFileSync(`${statusDir}/${files[0]}`, 'utf-8') as string
      );
      expect(content.agent).toBe('backend');
      expect(content.status).toBe('completed');
      expect(content.duration).toBe(5000);
      expect(content.task).toBe('implement auth');
      expect(content.provider).toBe('claude');
      expect(content.pid).toBe(12345);
    });

    it('sanitizes agent name for filename', async () => {
      const status: AgentStatus = {
        agent: 'my/agent@name!',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      };

      await writeAgentStatus(status, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files[0]).toMatch(/^my_agent_name_-\d+-12345\.json$/);
    });

    it('handles missing agent name gracefully', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const status = {
        agent: '',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      } as AgentStatus;

      await writeAgentStatus(status, projectDir);

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot write agent status: agent name is missing or invalid.',
        expect.any(Object)
      );

      // No file should be written
      expect(vol.existsSync(statusDir)).toBe(false);
    });

    it('handles whitespace-only agent name', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const status = {
        agent: '   ',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      } as AgentStatus;

      await writeAgentStatus(status, projectDir);

      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot write agent status: agent name is missing or invalid.',
        expect.any(Object)
      );
    });

    it('includes failed status with error message', async () => {
      const status: AgentStatus = {
        agent: 'backend',
        status: 'failed',
        timestamp: new Date().toISOString(),
        pid: 12345,
        error: 'Connection timeout'
      };

      await writeAgentStatus(status, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      const content = JSON.parse(
        vol.readFileSync(`${statusDir}/${files[0]}`, 'utf-8') as string
      );
      expect(content.status).toBe('failed');
      expect(content.error).toBe('Connection timeout');
    });

    it('uses process.pid when status.pid is not provided', async () => {
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 0  // falsy value
      };

      await writeAgentStatus(status, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      const content = JSON.parse(
        vol.readFileSync(`${statusDir}/${files[0]}`, 'utf-8') as string
      );
      // Should use process.pid
      expect(content.pid).toBe(process.pid);
    });

    it('auto-generates timestamp when not provided', async () => {
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: '',  // empty
        pid: 12345
      };

      await writeAgentStatus(status, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      const content = JSON.parse(
        vol.readFileSync(`${statusDir}/${files[0]}`, 'utf-8') as string
      );
      // Should have a valid ISO timestamp
      expect(content.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('uses default project directory when not specified', async () => {
      // Note: This test is tricky because it uses process.cwd()
      // We'll verify by checking the function doesn't throw
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      };

      // This will try to write to real cwd, which should work (or log warning)
      await expect(writeAgentStatus(status)).resolves.not.toThrow();
    });

    it('logs debug message on successful write', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      };

      await writeAgentStatus(status, projectDir);

      expect(logger.debug).toHaveBeenCalledWith(
        'Agent status written',
        expect.objectContaining({
          agent: 'backend',
          status: 'completed'
        })
      );
    });

    it('handles write errors gracefully', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      // Make directory read-only to cause write error
      vol.mkdirSync(statusDir, { recursive: true });

      // Mock writeFile to throw
      const originalWriteFile = vol.promises.writeFile;
      vi.spyOn(vol.promises, 'writeFile').mockRejectedValueOnce(
        new Error('Permission denied')
      );

      const status: AgentStatus = {
        agent: 'backend',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345
      };

      // Should not throw
      await expect(writeAgentStatus(status, projectDir)).resolves.not.toThrow();

      // Should log warning
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to write agent status',
        expect.objectContaining({
          agent: 'backend',
          error: 'Permission denied'
        })
      );

      vi.mocked(vol.promises.writeFile).mockRestore();
    });

    it('handles special characters in all status fields', async () => {
      const status: AgentStatus = {
        agent: 'test-agent',
        status: 'completed',
        timestamp: new Date().toISOString(),
        pid: 12345,
        task: 'Task with "quotes" and \'apostrophes\'',
        provider: 'provider/with/slashes',
        error: 'Error: \n\tmultiline'
      };

      await writeAgentStatus(status, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      const content = JSON.parse(
        vol.readFileSync(`${statusDir}/${files[0]}`, 'utf-8') as string
      );

      expect(content.task).toBe('Task with "quotes" and \'apostrophes\'');
      expect(content.provider).toBe('provider/with/slashes');
    });
  });

  describe('cleanupOldStatusFiles', () => {
    beforeEach(() => {
      vol.mkdirSync(statusDir, { recursive: true });
    });

    it('removes files older than maxAge', async () => {
      const now = Date.now();
      const oldTimestamp = now - 7200000; // 2 hours ago
      const recentTimestamp = now - 1800000; // 30 min ago

      // Create old file
      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}-123.json`,
        JSON.stringify({ agent: 'backend', status: 'completed' })
      );

      // Create recent file
      vol.writeFileSync(
        `${statusDir}/frontend-${recentTimestamp}-456.json`,
        JSON.stringify({ agent: 'frontend', status: 'completed' })
      );

      // Cleanup files older than 1 hour
      await cleanupOldStatusFiles(3600000, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files.length).toBe(1);
      expect(files[0]).toContain('frontend');
    });

    it('ignores non-JSON files', async () => {
      const now = Date.now();
      const oldTimestamp = now - 7200000;

      vol.writeFileSync(`${statusDir}/readme.txt`, 'Hello');
      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}-123.json`,
        '{}'
      );

      await cleanupOldStatusFiles(3600000, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files).toContain('readme.txt');
      expect(files.length).toBe(1);
    });

    it('handles missing directory gracefully', async () => {
      vol.rmdirSync(statusDir);

      // Should not throw
      await expect(cleanupOldStatusFiles(3600000, projectDir))
        .resolves.not.toThrow();
    });

    it('handles race condition when file is already deleted', async () => {
      const now = Date.now();
      const oldTimestamp = now - 7200000;

      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}-123.json`,
        '{}'
      );

      // Mock unlink to throw ENOENT
      vi.spyOn(vol.promises, 'unlink').mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      // Should handle gracefully
      await expect(cleanupOldStatusFiles(3600000, projectDir))
        .resolves.not.toThrow();

      vi.restoreAllMocks();
    });

    it('rethrows non-ENOENT errors from unlink', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const now = Date.now();
      const oldTimestamp = now - 7200000;

      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}-123.json`,
        '{}'
      );

      // Mock unlink to throw permission error
      vi.spyOn(vol.promises, 'unlink').mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { code: 'EPERM' })
      );

      // Should log warning (caught by outer try-catch)
      await cleanupOldStatusFiles(3600000, projectDir);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to cleanup status files',
        expect.any(Object)
      );

      vi.restoreAllMocks();
    });

    it('uses default maxAge of 1 hour', async () => {
      const now = Date.now();
      const twoHoursAgo = now - 7200000;
      const thirtyMinAgo = now - 1800000;

      vol.writeFileSync(
        `${statusDir}/old-${twoHoursAgo}-123.json`,
        '{}'
      );
      vol.writeFileSync(
        `${statusDir}/recent-${thirtyMinAgo}-456.json`,
        '{}'
      );

      // Call without maxAge (uses default 1 hour)
      await cleanupOldStatusFiles(undefined, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files.length).toBe(1);
      expect(files[0]).toContain('recent');
    });

    it('uses default project directory', async () => {
      // Just verify it doesn't throw
      await expect(cleanupOldStatusFiles()).resolves.not.toThrow();
    });

    it('handles files without PID in filename', async () => {
      const now = Date.now();
      const oldTimestamp = now - 7200000;

      // Old format without PID: agent-timestamp.json
      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}.json`,
        '{}'
      );

      await cleanupOldStatusFiles(3600000, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files.length).toBe(0);
    });

    it('skips files with invalid timestamp format', async () => {
      // File without proper timestamp
      vol.writeFileSync(
        `${statusDir}/invalid-name.json`,
        '{}'
      );

      await cleanupOldStatusFiles(3600000, projectDir);

      // File should still exist (not cleaned up)
      const files = vol.readdirSync(statusDir) as string[];
      expect(files).toContain('invalid-name.json');
    });

    it('logs debug message for each cleaned file', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');
      const now = Date.now();
      const oldTimestamp = now - 7200000;

      vol.writeFileSync(
        `${statusDir}/backend-${oldTimestamp}-123.json`,
        '{}'
      );

      await cleanupOldStatusFiles(3600000, projectDir);

      expect(logger.debug).toHaveBeenCalledWith(
        'Cleaned up old status file',
        expect.objectContaining({ file: expect.stringContaining('backend') })
      );
    });

    it('handles readdir error gracefully', async () => {
      const { logger } = await import('../../../../src/shared/logging/logger.js');

      vi.spyOn(vol.promises, 'readdir').mockRejectedValueOnce(
        new Error('Directory not found')
      );

      await cleanupOldStatusFiles(3600000, projectDir);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to cleanup status files',
        expect.objectContaining({ error: 'Directory not found' })
      );

      vi.restoreAllMocks();
    });

    it('processes multiple old files correctly', async () => {
      const now = Date.now();
      const twoHoursAgo = now - 7200000;
      const threeHoursAgo = now - 10800000;

      vol.writeFileSync(`${statusDir}/agent1-${twoHoursAgo}-111.json`, '{}');
      vol.writeFileSync(`${statusDir}/agent2-${threeHoursAgo}-222.json`, '{}');
      vol.writeFileSync(`${statusDir}/agent3-${now - 1000}-333.json`, '{}');

      await cleanupOldStatusFiles(3600000, projectDir);

      const files = vol.readdirSync(statusDir) as string[];
      expect(files.length).toBe(1);
      expect(files[0]).toContain('agent3');
    });
  });
});
