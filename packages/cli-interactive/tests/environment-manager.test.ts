/**
 * Tests for EnvironmentManager
 * Phase 4: Build Systems, Environment Management, and Project Scaffolding
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentManager } from '../src/environment-manager.js';
import { existsSync, readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

describe('EnvironmentManager', () => {
  let environmentManager: EnvironmentManager;
  const mockWorkspaceRoot = '/mock/workspace';

  beforeEach(() => {
    environmentManager = new EnvironmentManager(mockWorkspaceRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('.env File Parsing', () => {
    it('should parse simple key=value pairs', () => {
      const content = 'API_KEY=abc123\nDATABASE_URL=localhost';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('API_KEY')).toBe('abc123');
      expect(result.get('DATABASE_URL')).toBe('localhost');
    });

    it('should handle values with single quotes', () => {
      const content = "API_KEY='abc123'";
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('API_KEY')).toBe('abc123');
    });

    it('should handle values with double quotes', () => {
      const content = 'API_KEY="abc123"';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('API_KEY')).toBe('abc123');
    });

    it('should handle empty values', () => {
      const content = 'API_KEY=';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('API_KEY')).toBe('');
    });

    it('should skip empty lines', () => {
      const content = 'API_KEY=abc123\n\n\nDATABASE_URL=localhost';
      const result = environmentManager.parseEnvFile(content);

      expect(result.size).toBe(2);
    });

    it('should skip comment lines', () => {
      const content = '# This is a comment\nAPI_KEY=abc123\n# Another comment\nDATABASE_URL=localhost';
      const result = environmentManager.parseEnvFile(content);

      expect(result.size).toBe(2);
      expect(result.get('API_KEY')).toBe('abc123');
    });

    it('should handle inline comments', () => {
      const content = 'API_KEY=abc123 # This is the API key';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('API_KEY')).toBe('abc123');
    });

    it('should handle escape sequences', () => {
      const content = 'MESSAGE=Hello\\nWorld\\tTest\\\\Path';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('MESSAGE')).toBe('Hello\nWorld\tTest\\Path');
    });

    it('should handle values with spaces', () => {
      const content = 'MESSAGE="Hello World"';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('MESSAGE')).toBe('Hello World');
    });

    it('should handle values with equals signs', () => {
      const content = 'EQUATION="a=b+c"';
      const result = environmentManager.parseEnvFile(content);

      expect(result.get('EQUATION')).toBe('a=b+c');
    });

    it('should ignore invalid lines', () => {
      const content = 'VALID_KEY=value\ninvalid line without equals\nANOTHER_KEY=value2';
      const result = environmentManager.parseEnvFile(content);

      expect(result.size).toBe(2);
      expect(result.get('VALID_KEY')).toBe('value');
      expect(result.get('ANOTHER_KEY')).toBe('value2');
    });
  });

  describe('Sensitive Data Masking', () => {
    it('should mask API keys', () => {
      const value = 'sk_live_1234567890abcdef';
      const masked = environmentManager.maskValue(value);

      expect(masked).toBe('sk***ef');
      expect(masked).not.toContain('1234567890');
    });

    it('should mask short values', () => {
      const value = 'abc';
      const masked = environmentManager.maskValue(value);

      expect(masked).toBe('***');
    });

    it('should mask passwords', () => {
      const value = 'supersecret123';
      const masked = environmentManager.maskValue(value);

      expect(masked).toBe('su***23');
    });

    it('should identify API_KEY as sensitive', () => {
      environmentManager.setEnv('API_KEY', 'secret123');
      const display = environmentManager.getDisplayValue('API_KEY');

      expect(display).toBe('se***23');
    });

    it('should identify SECRET as sensitive', () => {
      // BUG #31 FIX: Short secrets (<=8 chars) are fully masked
      environmentManager.setEnv('SECRET_TOKEN', 'mytoken'); // 7 chars
      const display = environmentManager.getDisplayValue('SECRET_TOKEN');

      expect(display).toBe('***'); // Fully masked (7 <= 8)
    });

    it('should identify PASSWORD as sensitive', () => {
      // BUG #31 FIX: Short secrets (<=8 chars) are fully masked
      environmentManager.setEnv('DATABASE_PASSWORD', 'pass123'); // 7 chars
      const display = environmentManager.getDisplayValue('DATABASE_PASSWORD');

      expect(display).toBe('***'); // Fully masked (7 <= 8)
    });

    it('should not mask non-sensitive values', () => {
      environmentManager.setEnv('NODE_ENV', 'production');
      const display = environmentManager.getDisplayValue('NODE_ENV');

      expect(display).toBe('production');
    });
  });

  describe('Environment Variable Management', () => {
    it('should get environment variable', () => {
      environmentManager.setEnv('TEST_VAR', 'test_value');
      const value = environmentManager.getEnv('TEST_VAR');

      expect(value).toBe('test_value');
    });

    it('should set environment variable', () => {
      environmentManager.setEnv('NEW_VAR', 'new_value');
      const value = environmentManager.getEnv('NEW_VAR');

      expect(value).toBe('new_value');
    });

    it('should unset environment variable', () => {
      environmentManager.setEnv('TEMP_VAR', 'temp');
      environmentManager.unsetEnv('TEMP_VAR');
      const value = environmentManager.getEnv('TEMP_VAR');

      expect(value).toBeUndefined();
    });

    it('should list all environment variables', () => {
      environmentManager.setEnv('VAR1', 'value1');
      environmentManager.setEnv('VAR2', 'value2');
      const vars = environmentManager.listEnv();

      expect(vars.length).toBeGreaterThanOrEqual(2);
      expect(vars.some(v => v.key === 'VAR1')).toBe(true);
      expect(vars.some(v => v.key === 'VAR2')).toBe(true);
    });

    it('should filter environment variables', () => {
      environmentManager.setEnv('API_KEY', 'key1');
      environmentManager.setEnv('API_SECRET', 'secret1');
      environmentManager.setEnv('DATABASE_URL', 'db_url');

      const filtered = environmentManager.listEnv('API');

      expect(filtered.every(v => v.key.includes('API'))).toBe(true);
    });

    it('should return undefined for non-existent variable', () => {
      const value = environmentManager.getEnv('NON_EXISTENT');

      expect(value).toBeUndefined();
    });
  });

  describe('Environment Variable Validation', () => {
    it('should validate when all required variables exist', () => {
      environmentManager.setEnv('VAR1', 'value1');
      environmentManager.setEnv('VAR2', 'value2');

      const result = environmentManager.validateEnv(['VAR1', 'VAR2']);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should identify missing variables', () => {
      environmentManager.setEnv('VAR1', 'value1');

      const result = environmentManager.validateEnv(['VAR1', 'VAR2', 'VAR3']);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['VAR2', 'VAR3']);
    });

    it('should handle empty required list', () => {
      const result = environmentManager.validateEnv([]);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('.env File Loading', () => {
    it('should load .env file and set variables', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('API_KEY=abc123\nDATABASE_URL=localhost');

      const loaded = await environmentManager.loadEnvFile({ path: '.env' });

      expect(loaded.size).toBe(2);
      expect(loaded.get('API_KEY')).toBe('abc123');
      expect(loaded.get('DATABASE_URL')).toBe('localhost');
    });

    it('should throw error when file does not exist', async () => {
      const { existsSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(false);

      await expect(environmentManager.loadEnvFile({ path: '.env' })).rejects.toThrow();
    });

    it('should handle override option', async () => {
      const { existsSync, readFileSync } = await import('fs');

      environmentManager.setEnv('EXISTING_VAR', 'old_value');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('EXISTING_VAR=new_value');

      await environmentManager.loadEnvFile({ path: '.env', override: true });

      expect(environmentManager.getEnv('EXISTING_VAR')).toBe('new_value');
    });

    it('should not override existing variables by default', async () => {
      const { existsSync, readFileSync } = await import('fs');

      environmentManager.setEnv('EXISTING_VAR', 'old_value');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('EXISTING_VAR=new_value');

      await environmentManager.loadEnvFile({ path: '.env', override: false });

      expect(environmentManager.getEnv('EXISTING_VAR')).toBe('old_value');
    });
  });

  describe('Export and Generation', () => {
    it('should export environment variables to object', () => {
      environmentManager.setEnv('VAR1', 'value1');
      environmentManager.setEnv('VAR2', 'value2');

      const exported = environmentManager.exportEnv(false);

      expect(exported.VAR1).toBe('value1');
      expect(exported.VAR2).toBe('value2');
    });

    it('should generate .env file content', () => {
      environmentManager.setEnv('VAR1', 'value1');
      environmentManager.setEnv('VAR2', 'value with spaces');

      const content = environmentManager.generateEnvFile(false);

      expect(content).toContain('VAR1=value1');
      expect(content).toContain('VAR2="value with spaces"');
    });

    it('should quote values with special characters', () => {
      environmentManager.setEnv('VAR', 'value=with=equals');

      const content = environmentManager.generateEnvFile(false);

      expect(content).toContain('"value=with=equals"');
    });
  });
});
