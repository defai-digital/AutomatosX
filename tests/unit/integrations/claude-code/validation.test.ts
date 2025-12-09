/**
 * Comprehensive tests for Claude Code validation utilities
 *
 * Tests for configuration, MCP server, command, and manifest validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateClaudeConfig,
  validateMCPServer,
  validateMCPManifest,
  validateCommand,
  isValidCommandName,
  isValidServerName,
  hasWarnings,
  getValidationSummary
} from '../../../../src/integrations/claude-code/utils/validation.js';
import type {
  ClaudeConfig,
  ClaudeMCPServer,
  MCPManifest,
  ClaudeCommand
} from '../../../../src/integrations/claude-code/types.js';

describe('claude-code validation', () => {
  describe('validateClaudeConfig', () => {
    it('should return valid for empty config', () => {
      const result = validateClaudeConfig({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for non-object config', () => {
      const result = validateClaudeConfig(null as unknown as ClaudeConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should return invalid for string config', () => {
      const result = validateClaudeConfig('invalid' as unknown as ClaudeConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    describe('model validation', () => {
      it('should validate model object', () => {
        const result = validateClaudeConfig({
          model: { name: 'claude-3', temperature: 0.7, maxTokens: 4096 }
        });
        expect(result.valid).toBe(true);
      });

      it('should reject non-object model', () => {
        const result = validateClaudeConfig({
          model: 'invalid' as unknown as ClaudeConfig['model']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model must be an object');
      });

      it('should reject null model', () => {
        const result = validateClaudeConfig({
          model: null as unknown as ClaudeConfig['model']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model must be an object');
      });

      it('should reject non-string model name', () => {
        const result = validateClaudeConfig({
          model: { name: 123 as unknown as string }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model.name must be a string');
      });

      it('should reject non-number temperature', () => {
        const result = validateClaudeConfig({
          model: { temperature: 'hot' as unknown as number }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model.temperature must be a number');
      });

      it('should warn for temperature out of range', () => {
        const result = validateClaudeConfig({
          model: { temperature: 3 }
        });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('model.temperature should be between 0 and 2');
      });

      it('should warn for negative temperature', () => {
        const result = validateClaudeConfig({
          model: { temperature: -0.5 }
        });
        expect(result.warnings).toContain('model.temperature should be between 0 and 2');
      });

      it('should reject non-number maxTokens', () => {
        const result = validateClaudeConfig({
          model: { maxTokens: '1000' as unknown as number }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model.maxTokens must be a number');
      });

      it('should reject negative maxTokens', () => {
        const result = validateClaudeConfig({
          model: { maxTokens: -100 }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model.maxTokens must be positive');
      });

      it('should reject zero maxTokens', () => {
        const result = validateClaudeConfig({
          model: { maxTokens: 0 }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('model.maxTokens must be positive');
      });
    });

    describe('instructions validation', () => {
      it('should validate instructions object', () => {
        const result = validateClaudeConfig({
          instructions: { global: 'Be helpful', project: 'Follow style guide' }
        });
        expect(result.valid).toBe(true);
      });

      it('should reject non-object instructions', () => {
        const result = validateClaudeConfig({
          instructions: 'invalid' as unknown as ClaudeConfig['instructions']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('instructions must be an object');
      });

      it('should reject null instructions', () => {
        const result = validateClaudeConfig({
          instructions: null as unknown as ClaudeConfig['instructions']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('instructions must be an object');
      });

      it('should reject non-string global instructions', () => {
        const result = validateClaudeConfig({
          instructions: { global: 123 as unknown as string }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('instructions.global must be a string');
      });

      it('should reject non-string project instructions', () => {
        const result = validateClaudeConfig({
          instructions: { project: ['list'] as unknown as string }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('instructions.project must be a string');
      });
    });
  });

  describe('validateMCPServer', () => {
    it('should validate valid server', () => {
      const result = validateMCPServer(
        { command: 'node', args: ['server.js'] },
        'test-server'
      );
      expect(result.valid).toBe(true);
    });

    it('should reject non-object server', () => {
      const result = validateMCPServer(
        'invalid' as unknown as ClaudeMCPServer,
        'test-server'
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server "test-server" must be an object');
    });

    it('should reject null server', () => {
      const result = validateMCPServer(
        null as unknown as ClaudeMCPServer,
        'test-server'
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Server "test-server" must be an object');
    });

    describe('command validation', () => {
      it('should require command', () => {
        const result = validateMCPServer({} as ClaudeMCPServer, 'test-server');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" missing required field: command');
      });

      it('should reject non-string command', () => {
        const result = validateMCPServer(
          { command: 123 as unknown as string },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" command must be a string');
      });

      it('should reject empty command', () => {
        const result = validateMCPServer(
          { command: '   ' },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" command cannot be empty');
      });
    });

    describe('args validation', () => {
      it('should accept valid args array', () => {
        const result = validateMCPServer(
          { command: 'node', args: ['--port', '3000'] },
          'test-server'
        );
        expect(result.valid).toBe(true);
      });

      it('should reject non-array args', () => {
        const result = validateMCPServer(
          { command: 'node', args: 'invalid' as unknown as string[] },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" args must be an array');
      });

      it('should reject non-string array elements', () => {
        const result = validateMCPServer(
          { command: 'node', args: [123, 'valid'] as unknown as string[] },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" args[0] must be a string');
      });

      it('should check all array elements', () => {
        const result = validateMCPServer(
          { command: 'node', args: ['valid', 456] as unknown as string[] },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" args[1] must be a string');
      });
    });

    describe('env validation', () => {
      it('should accept valid env object', () => {
        const result = validateMCPServer(
          { command: 'node', env: { NODE_ENV: 'production' } },
          'test-server'
        );
        expect(result.valid).toBe(true);
      });

      it('should reject non-object env', () => {
        const result = validateMCPServer(
          { command: 'node', env: 'invalid' as unknown as Record<string, string> },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" env must be an object');
      });

      it('should reject null env', () => {
        const result = validateMCPServer(
          { command: 'node', env: null as unknown as Record<string, string> },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" env must be an object');
      });

      it('should reject array env', () => {
        const result = validateMCPServer(
          { command: 'node', env: ['invalid'] as unknown as Record<string, string> },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" env must be an object');
      });

      it('should reject non-string env values', () => {
        const result = validateMCPServer(
          { command: 'node', env: { PORT: 3000 as unknown as string } },
          'test-server'
        );
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "test-server" env.PORT must be a string');
      });

      it('should warn about sensitive environment variables', () => {
        const result = validateMCPServer(
          { command: 'node', env: { API_KEY: 'secret123' } },
          'test-server'
        );
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Server "test-server" env.API_KEY may contain sensitive data');
      });

      it('should warn about PASSWORD in env', () => {
        const result = validateMCPServer(
          { command: 'node', env: { DATABASE_PASSWORD: 'mypass' } },
          'test-server'
        );
        expect(result.warnings).toContain('Server "test-server" env.DATABASE_PASSWORD may contain sensitive data');
      });

      it('should warn about SECRET in env', () => {
        const result = validateMCPServer(
          { command: 'node', env: { JWT_SECRET: 'verysecret' } },
          'test-server'
        );
        expect(result.warnings).toContain('Server "test-server" env.JWT_SECRET may contain sensitive data');
      });

      it('should warn about TOKEN in env', () => {
        const result = validateMCPServer(
          { command: 'node', env: { ACCESS_TOKEN: 'tok123' } },
          'test-server'
        );
        expect(result.warnings).toContain('Server "test-server" env.ACCESS_TOKEN may contain sensitive data');
      });
    });
  });

  describe('validateMCPManifest', () => {
    it('should validate valid manifest', () => {
      const result = validateMCPManifest({
        version: '1.0.0',
        mcpServers: {
          'test-server': { command: 'node', args: ['server.js'] }
        }
      });
      expect(result.valid).toBe(true);
    });

    it('should reject non-object manifest', () => {
      const result = validateMCPManifest(
        'invalid' as unknown as MCPManifest
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest must be an object');
    });

    it('should reject null manifest', () => {
      const result = validateMCPManifest(
        null as unknown as MCPManifest
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest must be an object');
    });

    describe('version validation', () => {
      it('should accept string version', () => {
        const result = validateMCPManifest({ version: '2.0.0' });
        expect(result.valid).toBe(true);
        expect(result.warnings).not.toContain('version is not specified');
      });

      it('should warn when version is missing', () => {
        const result = validateMCPManifest({});
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('version is not specified');
      });

      it('should reject non-string version', () => {
        const result = validateMCPManifest({
          version: 1 as unknown as string
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('version must be a string');
      });
    });

    describe('mcpServers validation', () => {
      it('should accept valid mcpServers', () => {
        const result = validateMCPManifest({
          mcpServers: {
            server1: { command: 'node' },
            server2: { command: 'python' }
          }
        });
        expect(result.valid).toBe(true);
      });

      it('should reject non-object mcpServers', () => {
        const result = validateMCPManifest({
          mcpServers: 'invalid' as unknown as MCPManifest['mcpServers']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('mcpServers must be an object');
      });

      it('should reject null mcpServers', () => {
        const result = validateMCPManifest({
          mcpServers: null as unknown as MCPManifest['mcpServers']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('mcpServers must be an object');
      });

      it('should reject array mcpServers', () => {
        const result = validateMCPManifest({
          mcpServers: [] as unknown as MCPManifest['mcpServers']
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('mcpServers must be an object');
      });

      it('should reject invalid server names', () => {
        const result = validateMCPManifest({
          mcpServers: {
            '123invalid': { command: 'node' }
          }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid server name: "123invalid"');
      });

      it('should validate each server and aggregate errors', () => {
        const result = validateMCPManifest({
          mcpServers: {
            server1: {} as ClaudeMCPServer,
            server2: { command: '   ' }  // Empty after trim
          }
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server "server1" missing required field: command');
        expect(result.errors).toContain('Server "server2" command cannot be empty');
      });

      it('should aggregate warnings from servers', () => {
        const result = validateMCPManifest({
          mcpServers: {
            server1: { command: 'node', env: { API_KEY: 'secret' } },
            server2: { command: 'python', env: { PASSWORD: 'pass' } }
          }
        });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Server "server1" env.API_KEY may contain sensitive data');
        expect(result.warnings).toContain('Server "server2" env.PASSWORD may contain sensitive data');
      });
    });
  });

  describe('validateCommand', () => {
    it('should validate valid command', () => {
      const result = validateCommand({
        name: 'my-command',
        path: '/commands/my-command.md',
        content: '# My Command\nThis is the content',
        description: 'A helpful command'
      });
      expect(result.valid).toBe(true);
    });

    describe('name validation', () => {
      it('should require name', () => {
        const result = validateCommand({
          name: '',
          path: '/commands/test.md',
          content: 'content',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Command name is required');
      });

      it('should reject invalid command name', () => {
        const result = validateCommand({
          name: 'Invalid_Name',
          path: '/commands/test.md',
          content: 'content',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid command name: "Invalid_Name"');
      });
    });

    describe('path validation', () => {
      it('should require path', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '',
          content: 'content',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Command path is required');
      });

      it('should require .md extension', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '/commands/test.txt',
          content: 'content',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Command file must have .md extension');
      });
    });

    describe('content validation', () => {
      it('should require content', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '/commands/test.md',
          content: '',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Command content cannot be empty');
      });

      it('should reject whitespace-only content', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '/commands/test.md',
          content: '   \n\t  ',
          description: 'test'
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Command content cannot be empty');
      });
    });

    describe('description validation', () => {
      it('should warn for empty description', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '/commands/test.md',
          content: 'content',
          description: ''
        });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Command description is empty');
      });

      it('should warn for whitespace-only description', () => {
        const result = validateCommand({
          name: 'test-command',
          path: '/commands/test.md',
          content: 'content',
          description: '   '
        });
        expect(result.warnings).toContain('Command description is empty');
      });
    });
  });

  describe('isValidCommandName', () => {
    it('should accept valid lowercase names', () => {
      expect(isValidCommandName('test')).toBe(true);
      expect(isValidCommandName('my-command')).toBe(true);
      expect(isValidCommandName('test123')).toBe(true);
      expect(isValidCommandName('a1b2c3')).toBe(true);
    });

    it('should reject empty or null names', () => {
      expect(isValidCommandName('')).toBe(false);
      expect(isValidCommandName(null as unknown as string)).toBe(false);
      expect(isValidCommandName(undefined as unknown as string)).toBe(false);
    });

    it('should reject names not starting with a letter', () => {
      expect(isValidCommandName('123test')).toBe(false);
      expect(isValidCommandName('-test')).toBe(false);
      expect(isValidCommandName('_test')).toBe(false);
    });

    it('should reject uppercase letters', () => {
      expect(isValidCommandName('Test')).toBe(false);
      expect(isValidCommandName('myCommand')).toBe(false);
      expect(isValidCommandName('MY-COMMAND')).toBe(false);
    });

    it('should reject consecutive hyphens', () => {
      expect(isValidCommandName('test--command')).toBe(false);
      expect(isValidCommandName('a--b--c')).toBe(false);
    });

    it('should reject trailing hyphen', () => {
      expect(isValidCommandName('test-')).toBe(false);
      expect(isValidCommandName('my-command-')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidCommandName('test_command')).toBe(false);
      expect(isValidCommandName('test.command')).toBe(false);
      expect(isValidCommandName('test/command')).toBe(false);
      expect(isValidCommandName('test@command')).toBe(false);
    });
  });

  describe('isValidServerName', () => {
    it('should accept valid server names', () => {
      expect(isValidServerName('server')).toBe(true);
      expect(isValidServerName('my-server')).toBe(true);
      expect(isValidServerName('my_server')).toBe(true);
      expect(isValidServerName('Server123')).toBe(true);
      expect(isValidServerName('_private')).toBe(true);
    });

    it('should reject empty or null names', () => {
      expect(isValidServerName('')).toBe(false);
      expect(isValidServerName(null as unknown as string)).toBe(false);
      expect(isValidServerName(undefined as unknown as string)).toBe(false);
    });

    it('should reject names starting with a number', () => {
      expect(isValidServerName('123server')).toBe(false);
      expect(isValidServerName('1st-server')).toBe(false);
    });

    it('should reject names starting with a hyphen', () => {
      expect(isValidServerName('-server')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidServerName('server.name')).toBe(false);
      expect(isValidServerName('server/path')).toBe(false);
      expect(isValidServerName('server@host')).toBe(false);
      expect(isValidServerName('server name')).toBe(false);
    });
  });

  describe('hasWarnings', () => {
    it('should return true when warnings exist', () => {
      expect(hasWarnings({ valid: true, errors: [], warnings: ['warning'] })).toBe(true);
      expect(hasWarnings({ valid: false, errors: ['error'], warnings: ['warning'] })).toBe(true);
    });

    it('should return false when no warnings', () => {
      expect(hasWarnings({ valid: true, errors: [], warnings: [] })).toBe(false);
      expect(hasWarnings({ valid: false, errors: ['error'], warnings: [] })).toBe(false);
    });
  });

  describe('getValidationSummary', () => {
    it('should return valid summary for valid result', () => {
      const summary = getValidationSummary({ valid: true, errors: [], warnings: [] });
      expect(summary).toBe('✓ Valid');
    });

    it('should return invalid summary with error count', () => {
      const summary = getValidationSummary({
        valid: false,
        errors: ['error1', 'error2'],
        warnings: []
      });
      expect(summary).toBe('✗ Invalid (2 error(s))');
    });

    it('should include warning count', () => {
      const summary = getValidationSummary({
        valid: true,
        errors: [],
        warnings: ['warning1', 'warning2', 'warning3']
      });
      expect(summary).toBe('✓ Valid, 3 warning(s)');
    });

    it('should include both invalid and warnings', () => {
      const summary = getValidationSummary({
        valid: false,
        errors: ['error'],
        warnings: ['warning']
      });
      expect(summary).toBe('✗ Invalid (1 error(s)), 1 warning(s)');
    });
  });
});
