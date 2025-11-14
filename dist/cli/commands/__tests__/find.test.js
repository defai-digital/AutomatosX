/**
 * Tests for find command
 * Sprint 3 Day 27: CLI command tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import { createFindCommand } from '../find.js';
import * as FileService from '../../../services/FileService.js';
// Mock FileService
vi.mock('../../../services/FileService.js', () => ({
    searchFiles: vi.fn(),
    getFileService: vi.fn(() => ({
        searchFiles: vi.fn(),
    })),
}));
describe('find command', () => {
    let command;
    let program;
    beforeEach(() => {
        command = createFindCommand();
        program = new Command();
        program.addCommand(command);
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('command registration', () => {
        it('should register find command', () => {
            expect(command.name()).toBe('find');
        });
        it('should have correct aliases', () => {
            expect(command.aliases()).toContain('search');
        });
        it('should have description', () => {
            const desc = command.description();
            expect(desc).toBeTruthy();
            expect(desc.toLowerCase()).toContain('search');
        });
        it('should require query argument', () => {
            const args = command.registeredArguments;
            expect(args).toHaveLength(1);
            expect(args[0].name()).toBe('query');
            expect(args[0].required).toBe(true);
        });
    });
    describe('command options', () => {
        it('should have limit option', () => {
            const option = command.options.find((opt) => opt.long === '--limit');
            expect(option).toBeDefined();
            expect(option?.short).toBe('-l');
        });
        it('should have lang option', () => {
            const option = command.options.find((opt) => opt.long === '--lang');
            expect(option).toBeDefined();
        });
        it('should have kind option', () => {
            const option = command.options.find((opt) => opt.long === '--kind');
            expect(option).toBeDefined();
        });
        it('should have file option', () => {
            const option = command.options.find((opt) => opt.long === '--file');
            expect(option).toBeDefined();
        });
        it('should have json option', () => {
            const option = command.options.find((opt) => opt.long === '--json');
            expect(option).toBeDefined();
        });
        it('should have verbose option', () => {
            const option = command.options.find((opt) => opt.long === '--verbose');
            expect(option).toBeDefined();
            expect(option?.short).toBe('-v');
        });
    });
    describe('command execution', () => {
        it('should search with query only', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'Calculator']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                query: 'Calculator',
            }));
        });
        it('should apply limit option', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'function', '--limit', '5']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 5,
            }));
        });
        it('should apply language filter', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'class', '--lang', 'typescript']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                lang: 'typescript',
            }));
        });
        it('should apply kind filter', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'test', '--kind', 'function']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                kind: 'function',
            }));
        });
        it('should apply file filter', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'export', '--file', 'src/']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                file: 'src/',
            }));
        });
        it('should handle multiple filters', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync([
                'node',
                'test',
                'find',
                'getUserById',
                '--lang',
                'typescript',
                '--kind',
                'function',
                '--file',
                'src/services',
                '--limit',
                '10',
            ]);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                query: 'getUserById',
                lang: 'typescript',
                kind: 'function',
                file: 'src/services',
                limit: 10,
            }));
        });
    });
    describe('output formatting', () => {
        it('should format results as text by default', async () => {
            const mockResults = [
                {
                    file: 'src/utils/Calculator.ts',
                    symbol: 'Calculator',
                    kind: 'class',
                    line: 10,
                },
            ];
            const mockSearch = vi.fn().mockResolvedValue(mockResults);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            await program.parseAsync(['node', 'test', 'find', 'Calculator']);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should format results as JSON when requested', async () => {
            const mockResults = [
                {
                    file: 'src/utils/Calculator.ts',
                    symbol: 'Calculator',
                    kind: 'class',
                    line: 10,
                },
            ];
            const mockSearch = vi.fn().mockResolvedValue(mockResults);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            await program.parseAsync(['node', 'test', 'find', 'Calculator', '--json']);
            expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockResults, null, 2));
            consoleSpy.mockRestore();
        });
        it('should show verbose output when requested', async () => {
            const mockResults = [
                {
                    file: 'src/utils/Calculator.ts',
                    symbol: 'Calculator',
                    kind: 'class',
                    line: 10,
                    signature: 'class Calculator { }',
                },
            ];
            const mockSearch = vi.fn().mockResolvedValue(mockResults);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            await program.parseAsync(['node', 'test', 'find', 'Calculator', '--verbose']);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('error handling', () => {
        it('should handle empty query', async () => {
            await expect(program.parseAsync(['node', 'test', 'find', ''])).rejects.toThrow();
        });
        it('should handle search errors gracefully', async () => {
            const mockSearch = vi.fn().mockRejectedValue(new Error('Database error'));
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            await program.parseAsync(['node', 'test', 'find', 'test']);
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
        it('should handle no results found', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            await program.parseAsync(['node', 'test', 'find', 'NonExistent']);
            expect(mockSearch).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should validate limit is positive', async () => {
            await expect(program.parseAsync(['node', 'test', 'find', 'test', '--limit', '-1'])).rejects.toThrow();
        });
        it('should validate limit is numeric', async () => {
            await expect(program.parseAsync(['node', 'test', 'find', 'test', '--limit', 'abc'])).rejects.toThrow();
        });
    });
    describe('integration scenarios', () => {
        it('should search for TypeScript classes', async () => {
            const mockSearch = vi.fn().mockResolvedValue([
                {
                    file: 'src/models/User.ts',
                    symbol: 'User',
                    kind: 'class',
                    line: 5,
                },
                {
                    file: 'src/models/Post.ts',
                    symbol: 'Post',
                    kind: 'class',
                    line: 8,
                },
            ]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync([
                'node',
                'test',
                'find',
                'class',
                '--lang',
                'typescript',
                '--kind',
                'class',
            ]);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                query: 'class',
                lang: 'typescript',
                kind: 'class',
            }));
        });
        it('should search in specific directory', async () => {
            const mockSearch = vi.fn().mockResolvedValue([
                {
                    file: 'src/services/UserService.ts',
                    symbol: 'UserService',
                    kind: 'class',
                    line: 10,
                },
            ]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'Service', '--file', 'src/services/']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                query: 'Service',
                file: 'src/services/',
            }));
        });
        it('should limit results count', async () => {
            const mockResults = Array.from({ length: 20 }, (_, i) => ({
                file: `src/test${i}.ts`,
                symbol: `Symbol${i}`,
                kind: 'function',
                line: i,
            }));
            const mockSearch = vi.fn().mockResolvedValue(mockResults.slice(0, 5));
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            await program.parseAsync(['node', 'test', 'find', 'Symbol', '--limit', '5']);
            expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
                limit: 5,
            }));
        });
    });
    describe('performance', () => {
        it('should complete search within reasonable time', async () => {
            const mockSearch = vi.fn().mockResolvedValue([]);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const startTime = Date.now();
            await program.parseAsync(['node', 'test', 'find', 'test']);
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // Should complete in < 1 second
        });
        it('should handle large result sets efficiently', async () => {
            const largeResults = Array.from({ length: 1000 }, (_, i) => ({
                file: `src/test${i}.ts`,
                symbol: `Symbol${i}`,
                kind: 'function',
                line: i,
            }));
            const mockSearch = vi.fn().mockResolvedValue(largeResults);
            vi.mocked(FileService.searchFiles).mockImplementation(mockSearch);
            const startTime = Date.now();
            await program.parseAsync(['node', 'test', 'find', 'Symbol']);
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(2000); // Should handle 1000 results in < 2 seconds
        });
    });
});
//# sourceMappingURL=find.test.js.map