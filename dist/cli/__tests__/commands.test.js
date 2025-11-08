// Sprint 2 Day 13: CLI Command Tests
// Comprehensive snapshot and integration tests for all 5 CLI commands
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeterministicEnvironment } from '../../utils/DeterministicSeeds.js';
// Command handlers
import { runCommand } from '../handlers/runCommand.js';
import { memorySearchCommand } from '../handlers/memorySearchCommand.js';
import { listAgentsCommand } from '../handlers/listAgentsCommand.js';
import { statusCommand } from '../handlers/statusCommand.js';
import { configShowCommand } from '../handlers/configShowCommand.js';
// Test utilities
let env;
let cleanup;
let consoleLogSpy;
let consoleErrorSpy;
beforeEach(() => {
    const testEnv = DeterministicEnvironment.createTestEnv(12345);
    env = testEnv.env;
    cleanup = testEnv.cleanup;
    // Spy on console output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
});
afterEach(() => {
    cleanup();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
});
describe('RunCommand', () => {
    it('should execute valid agent task', async () => {
        const args = {
            agent: 'backend',
            task: 'Implement user authentication',
            streaming: false,
            json: false,
        };
        await runCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Starting agent execution: backend');
        expect(output).toContain('Task completed successfully');
    });
    it('should validate agent name format', async () => {
        const args = {
            agent: 'InvalidAgent', // Uppercase not allowed
            task: 'Test task',
        };
        await expect(runCommand(args)).rejects.toThrow();
    });
    it('should handle streaming output', async () => {
        const args = {
            agent: 'backend',
            task: 'Complex task',
            streaming: true,
        };
        await runCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toMatch(/\[\d+\/\d+\]/); // Progress indicator
    });
    it('should respect verbose flag', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task',
            verbose: true,
        };
        await runCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('DEBUG');
    });
    it('should output JSON when requested', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task',
            json: true,
        };
        await runCommand(args);
        const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0].includes('{') && call[0].includes('success'));
        expect(jsonOutput).toBeDefined();
        const parsed = JSON.parse(jsonOutput[0]);
        expect(parsed).toHaveProperty('success');
        expect(parsed).toHaveProperty('agent', 'backend');
    });
    it('should validate task description length', async () => {
        const args = {
            agent: 'backend',
            task: 'ab', // Too short (min 3 chars)
        };
        await expect(runCommand(args)).rejects.toThrow();
    });
    it('should handle timeout parameter', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task',
            timeout: 10000,
        };
        await runCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle memory configuration', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task with memory',
            useMemory: true,
            memoryLimit: 5,
        };
        await runCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Searching memory');
    });
    it('should handle provider override', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task',
            provider: 'gemini',
        };
        await runCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle quiet mode', async () => {
        const args = {
            agent: 'backend',
            task: 'Test task',
            quiet: true,
        };
        await runCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).not.toContain('INFO');
    });
});
describe('MemorySearchCommand', () => {
    it('should search memory with basic query', async () => {
        const args = {
            query: 'authentication implementation',
            limit: 10,
            offset: 0,
        };
        await memorySearchCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Searching memory');
        expect(output).toContain('Found');
    });
    it('should validate query length', async () => {
        const args = {
            query: '', // Empty query
        };
        await expect(memorySearchCommand(args)).rejects.toThrow();
    });
    it('should filter by agent', async () => {
        const args = {
            query: 'test query',
            agent: 'backend',
        };
        await memorySearchCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle pagination', async () => {
        const args = {
            query: 'test query',
            limit: 5,
            offset: 10,
        };
        await memorySearchCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should output JSON format', async () => {
        const args = {
            query: 'test query',
            format: 'json',
        };
        await memorySearchCommand(args);
        const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0].includes('[') && call[0].includes('{'));
        expect(jsonOutput).toBeDefined();
    });
    it('should output table format', async () => {
        const args = {
            query: 'test query',
            format: 'table',
        };
        await memorySearchCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toMatch(/[┌│└]/); // Box drawing characters
    });
    it('should handle date filtering', async () => {
        const args = {
            query: 'test query',
            dateFrom: '2025-01-01T00:00:00Z',
            dateTo: '2025-01-31T23:59:59Z',
        };
        await memorySearchCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle exact match mode', async () => {
        const args = {
            query: 'exact phrase',
            exactMatch: true,
        };
        await memorySearchCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle sort options', async () => {
        const args = {
            query: 'test query',
            sortBy: 'date',
        };
        await memorySearchCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle verbose mode', async () => {
        const args = {
            query: 'test query',
            verbose: true,
        };
        await memorySearchCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('DEBUG');
    });
});
describe('ListAgentsCommand', () => {
    it('should list all agents', async () => {
        const args = {
            category: 'all',
            format: 'text',
        };
        await listAgentsCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('backend');
        expect(output).toContain('frontend');
    });
    it('should filter by category', async () => {
        const args = {
            category: 'development',
        };
        await listAgentsCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('development');
    });
    it('should output table format', async () => {
        const args = {
            format: 'table',
        };
        await listAgentsCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toMatch(/[┌│└]/);
    });
    it('should output JSON format', async () => {
        const args = {
            format: 'json',
        };
        await listAgentsCommand(args);
        const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0].includes('[') && call[0].includes('{'));
        expect(jsonOutput).toBeDefined();
        const parsed = JSON.parse(jsonOutput[0]);
        expect(Array.isArray(parsed)).toBe(true);
    });
    it('should sort by name', async () => {
        const args = {
            sortBy: 'name',
        };
        await listAgentsCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should sort by priority', async () => {
        const args = {
            sortBy: 'priority',
        };
        await listAgentsCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should show capabilities', async () => {
        const args = {
            showCapabilities: true,
        };
        await listAgentsCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Capabilities');
    });
    it('should filter by enabled status', async () => {
        const args = {
            enabled: true,
        };
        await listAgentsCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle verbose mode', async () => {
        const args = {
            verbose: true,
        };
        await listAgentsCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Priority');
    });
});
describe('StatusCommand', () => {
    it('should show system status', async () => {
        const args = {};
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('System Status');
        expect(output).toMatch(/✓|✗/);
    });
    it('should check memory health', async () => {
        const args = {
            checkMemory: true,
        };
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('memory');
    });
    it('should check providers health', async () => {
        const args = {
            checkProviders: true,
        };
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('providers');
    });
    it('should output JSON format', async () => {
        const args = {
            format: 'json',
        };
        await statusCommand(args);
        const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0].includes('{') && call[0].includes('overall'));
        expect(jsonOutput).toBeDefined();
        const parsed = JSON.parse(jsonOutput[0]);
        expect(parsed).toHaveProperty('overall');
        expect(parsed).toHaveProperty('checks');
    });
    it('should show metrics', async () => {
        const args = {
            showMetrics: true,
        };
        await statusCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should handle verbose mode', async () => {
        const args = {
            verbose: true,
        };
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output.length).toBeGreaterThan(0);
    });
    it('should check all components by default', async () => {
        const args = {};
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('memory');
        expect(output).toContain('providers');
        expect(output).toContain('agents');
    });
    it('should handle cache check', async () => {
        const args = {
            checkCache: true,
        };
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('cache');
    });
    it('should handle filesystem check', async () => {
        const args = {
            checkFilesystem: true,
        };
        await statusCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('filesystem');
    });
});
describe('ConfigShowCommand', () => {
    it('should show full configuration', async () => {
        const args = {};
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('Configuration');
    });
    it('should show specific key', async () => {
        const args = {
            key: 'providers.claude.enabled',
        };
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('providers.claude.enabled');
    });
    it('should output JSON format', async () => {
        const args = {
            format: 'json',
        };
        await configShowCommand(args);
        const jsonOutput = consoleLogSpy.mock.calls.find((call) => call[0].includes('{') && call[0].includes('providers'));
        expect(jsonOutput).toBeDefined();
        const parsed = JSON.parse(jsonOutput[0]);
        expect(parsed).toHaveProperty('providers');
    });
    it('should output YAML format', async () => {
        const args = {
            format: 'yaml',
        };
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain(':');
    });
    it('should show defaults', async () => {
        const args = {
            showDefaults: true,
        };
        await configShowCommand(args);
        expect(consoleLogSpy).toHaveBeenCalled();
    });
    it('should show sources', async () => {
        const args = {
            showSources: true,
        };
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('automatosx.config.json');
    });
    it('should filter by category', async () => {
        const args = {
            category: 'providers',
        };
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('providers');
    });
    it('should handle verbose mode', async () => {
        const args = {
            verbose: true,
        };
        await configShowCommand(args);
        const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n');
        expect(output).toContain('DEBUG');
    });
    it('should error on nonexistent key', async () => {
        const args = {
            key: 'nonexistent.key',
        };
        await expect(configShowCommand(args)).rejects.toThrow('not found');
    });
});
//# sourceMappingURL=commands.test.js.map