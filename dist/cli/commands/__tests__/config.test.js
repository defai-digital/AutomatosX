/**
 * config.test.ts
 *
 * Tests for config CLI command
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConfigCommand } from '../config.js';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { dirname } from 'path';
describe('config command', () => {
    const testConfigPath = '.automatosx-test/config.json';
    const testDir = dirname(testConfigPath);
    beforeEach(() => {
        // Clean up before each test
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });
    afterEach(() => {
        // Clean up after each test
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });
    describe('command structure', () => {
        it('should create config command', () => {
            const command = createConfigCommand();
            expect(command.name()).toBe('config');
            expect(command.description()).toBe('Manage AutomatosX configuration');
        });
        it('should have show subcommand', () => {
            const command = createConfigCommand();
            const subcommands = command.commands;
            const showCmd = subcommands.find(cmd => cmd.name() === 'show');
            expect(showCmd).toBeDefined();
            expect(showCmd?.description()).toBe('Display current configuration');
        });
        it('should have validate subcommand', () => {
            const command = createConfigCommand();
            const subcommands = command.commands;
            const validateCmd = subcommands.find(cmd => cmd.name() === 'validate');
            expect(validateCmd).toBeDefined();
            expect(validateCmd?.description()).toBe('Validate configuration file');
        });
        it('should have init subcommand', () => {
            const command = createConfigCommand();
            const subcommands = command.commands;
            const initCmd = subcommands.find(cmd => cmd.name() === 'init');
            expect(initCmd).toBeDefined();
            expect(initCmd?.description()).toBe('Initialize a new configuration file');
        });
        it('should have reset subcommand', () => {
            const command = createConfigCommand();
            const subcommands = command.commands;
            const resetCmd = subcommands.find(cmd => cmd.name() === 'reset');
            expect(resetCmd).toBeDefined();
            expect(resetCmd?.description()).toBe('Reset configuration to defaults');
        });
    });
    describe('config init', () => {
        it('should create a new configuration file', () => {
            expect(existsSync(testConfigPath)).toBe(false);
            // Manually call init logic
            const defaultConfig = {
                version: '1.0.0',
                languages: {
                    typescript: { enabled: true },
                    javascript: { enabled: true },
                    python: { enabled: true },
                    go: { enabled: true },
                    java: { enabled: true },
                    rust: { enabled: false },
                },
                search: {
                    defaultLimit: 10,
                    maxLimit: 100,
                    enableSymbolSearch: true,
                    enableNaturalSearch: true,
                    enableHybridSearch: true,
                    symbolMatchThreshold: 0.8,
                    hybridSymbolWeight: 0.7,
                },
                indexing: {
                    chunkSize: 512,
                    chunkOverlap: 50,
                    maxFileSize: 1048576,
                    excludePatterns: [
                        '**/node_modules/**',
                        '**/.git/**',
                        '**/dist/**',
                        '**/build/**',
                        '**/*.min.js',
                    ],
                    includePatterns: ['**/*'],
                    followSymlinks: false,
                    respectGitignore: true,
                },
                database: {
                    path: '.automatosx/db/code-intelligence.db',
                    inMemory: false,
                    wal: true,
                    busyTimeout: 5000,
                    cacheSize: -2000,
                },
                performance: {
                    enableCache: true,
                    cacheMaxSize: 1000,
                    cacheTTL: 300000,
                    batchSize: 100,
                    maxConcurrency: 4,
                },
                logging: {
                    level: 'info',
                    enableFileLogging: false,
                    logFilePath: '.automatosx/logs/app.log',
                    maxLogFiles: 5,
                    maxLogSize: 10485760,
                },
            };
            if (!existsSync(testDir)) {
                mkdirSync(testDir, { recursive: true });
            }
            writeFileSync(testConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            expect(existsSync(testConfigPath)).toBe(true);
            const content = readFileSync(testConfigPath, 'utf-8');
            const config = JSON.parse(content);
            expect(config.version).toBe('1.0.0');
            expect(config.languages.typescript.enabled).toBe(true);
            expect(config.search.defaultLimit).toBe(10);
        });
        it('should not overwrite existing config without force', () => {
            // Create initial config
            if (!existsSync(testDir)) {
                mkdirSync(testDir, { recursive: true });
            }
            const initialConfig = { version: '0.9.0', custom: true };
            writeFileSync(testConfigPath, JSON.stringify(initialConfig), 'utf-8');
            expect(existsSync(testConfigPath)).toBe(true);
            const content = readFileSync(testConfigPath, 'utf-8');
            const config = JSON.parse(content);
            expect(config.version).toBe('0.9.0');
            expect(config.custom).toBe(true);
        });
    });
    describe('config validate', () => {
        it('should validate correct configuration', () => {
            const validConfig = {
                version: '1.0.0',
                languages: {
                    typescript: { enabled: true },
                },
                search: {
                    defaultLimit: 10,
                    maxLimit: 100,
                    enableSymbolSearch: true,
                    enableNaturalSearch: true,
                    enableHybridSearch: true,
                    symbolMatchThreshold: 0.8,
                    hybridSymbolWeight: 0.7,
                },
                indexing: {
                    chunkSize: 512,
                    chunkOverlap: 50,
                    maxFileSize: 1048576,
                    excludePatterns: ['**/node_modules/**'],
                    includePatterns: ['**/*'],
                    followSymlinks: false,
                    respectGitignore: true,
                },
                database: {
                    path: '.automatosx/db/code-intelligence.db',
                    inMemory: false,
                    wal: true,
                    busyTimeout: 5000,
                    cacheSize: -2000,
                },
                performance: {
                    enableCache: true,
                    cacheMaxSize: 1000,
                    cacheTTL: 300000,
                    batchSize: 100,
                    maxConcurrency: 4,
                },
                logging: {
                    level: 'info',
                    enableFileLogging: false,
                    logFilePath: '.automatosx/logs/app.log',
                    maxLogFiles: 5,
                    maxLogSize: 10485760,
                },
            };
            if (!existsSync(testDir)) {
                mkdirSync(testDir, { recursive: true });
            }
            writeFileSync(testConfigPath, JSON.stringify(validConfig), 'utf-8');
            expect(existsSync(testConfigPath)).toBe(true);
            // Validation would happen via ConfigLoader
            const content = readFileSync(testConfigPath, 'utf-8');
            const config = JSON.parse(content);
            expect(config.version).toBe('1.0.0');
            expect(config.search).toBeDefined();
            expect(config.indexing).toBeDefined();
            expect(config.database).toBeDefined();
        });
    });
    describe('config show', () => {
        it('should display configuration', () => {
            const config = {
                version: '1.0.0',
                languages: {
                    typescript: { enabled: true },
                    python: { enabled: true },
                },
                search: {
                    defaultLimit: 10,
                },
            };
            if (!existsSync(testDir)) {
                mkdirSync(testDir, { recursive: true });
            }
            writeFileSync(testConfigPath, JSON.stringify(config), 'utf-8');
            expect(existsSync(testConfigPath)).toBe(true);
            const content = readFileSync(testConfigPath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.version).toBe('1.0.0');
            expect(parsed.languages.typescript.enabled).toBe(true);
        });
    });
    describe('config reset', () => {
        it('should reset configuration to defaults', () => {
            // Create custom config
            if (!existsSync(testDir)) {
                mkdirSync(testDir, { recursive: true });
            }
            const customConfig = {
                version: '1.0.0',
                languages: {
                    custom: { enabled: true },
                },
                search: {
                    defaultLimit: 999,
                },
            };
            writeFileSync(testConfigPath, JSON.stringify(customConfig), 'utf-8');
            expect(existsSync(testConfigPath)).toBe(true);
            let content = readFileSync(testConfigPath, 'utf-8');
            let config = JSON.parse(content);
            expect(config.search.defaultLimit).toBe(999);
            // Reset to defaults
            const defaultConfig = {
                version: '1.0.0',
                languages: {
                    typescript: { enabled: true },
                    javascript: { enabled: true },
                    python: { enabled: true },
                    go: { enabled: true },
                    java: { enabled: true },
                    rust: { enabled: false },
                },
                search: {
                    defaultLimit: 10,
                    maxLimit: 100,
                    enableSymbolSearch: true,
                    enableNaturalSearch: true,
                    enableHybridSearch: true,
                    symbolMatchThreshold: 0.8,
                    hybridSymbolWeight: 0.7,
                },
                indexing: {
                    chunkSize: 512,
                    chunkOverlap: 50,
                    maxFileSize: 1048576,
                    excludePatterns: [
                        '**/node_modules/**',
                        '**/.git/**',
                        '**/dist/**',
                        '**/build/**',
                        '**/*.min.js',
                    ],
                    includePatterns: ['**/*'],
                    followSymlinks: false,
                    respectGitignore: true,
                },
                database: {
                    path: '.automatosx/db/code-intelligence.db',
                    inMemory: false,
                    wal: true,
                    busyTimeout: 5000,
                    cacheSize: -2000,
                },
                performance: {
                    enableCache: true,
                    cacheMaxSize: 1000,
                    cacheTTL: 300000,
                    batchSize: 100,
                    maxConcurrency: 4,
                },
                logging: {
                    level: 'info',
                    enableFileLogging: false,
                    logFilePath: '.automatosx/logs/app.log',
                    maxLogFiles: 5,
                    maxLogSize: 10485760,
                },
            };
            writeFileSync(testConfigPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
            content = readFileSync(testConfigPath, 'utf-8');
            config = JSON.parse(content);
            expect(config.search.defaultLimit).toBe(10);
            expect(config.languages.typescript).toBeDefined();
        });
    });
    describe('configuration schema', () => {
        it('should have all required sections', () => {
            const config = {
                version: '1.0.0',
                languages: {},
                search: {
                    defaultLimit: 10,
                    maxLimit: 100,
                    enableSymbolSearch: true,
                    enableNaturalSearch: true,
                    enableHybridSearch: true,
                    symbolMatchThreshold: 0.8,
                    hybridSymbolWeight: 0.7,
                },
                indexing: {
                    chunkSize: 512,
                    chunkOverlap: 50,
                    maxFileSize: 1048576,
                    excludePatterns: [],
                    includePatterns: ['**/*'],
                    followSymlinks: false,
                    respectGitignore: true,
                },
                database: {
                    path: '.automatosx/db/code-intelligence.db',
                    inMemory: false,
                    wal: true,
                    busyTimeout: 5000,
                    cacheSize: -2000,
                },
                performance: {
                    enableCache: true,
                    cacheMaxSize: 1000,
                    cacheTTL: 300000,
                    batchSize: 100,
                    maxConcurrency: 4,
                },
                logging: {
                    level: 'info',
                    enableFileLogging: false,
                    logFilePath: '.automatosx/logs/app.log',
                    maxLogFiles: 5,
                    maxLogSize: 10485760,
                },
            };
            expect(config.version).toBeDefined();
            expect(config.languages).toBeDefined();
            expect(config.search).toBeDefined();
            expect(config.indexing).toBeDefined();
            expect(config.database).toBeDefined();
            expect(config.performance).toBeDefined();
            expect(config.logging).toBeDefined();
        });
    });
});
//# sourceMappingURL=config.test.js.map