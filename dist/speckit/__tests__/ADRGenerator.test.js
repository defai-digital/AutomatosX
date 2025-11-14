/**
 * ADRGenerator test suite
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ADRGenerator } from '../ADRGenerator.js';
// Mock fs module
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
}));
describe('ADRGenerator', () => {
    let generator;
    let mockProviderRouter;
    let mockMemoryService;
    beforeEach(() => {
        // Setup mock ProviderRouterV2
        mockProviderRouter = {
            route: vi.fn().mockResolvedValue({
                content: `# Architectural Decision Record

## Pattern: Singleton

### Context
The codebase extensively uses the Singleton pattern for managing shared resources like database connections, cache instances, and configuration objects.

### Decision
Continue using the Singleton pattern for shared resources that require centralized access and state management across the application.

### Consequences
**Benefits:**
- Controlled access to shared resources
- Single point of truth for configuration
- Memory efficiency through instance reuse

**Tradeoffs:**
- Testing can be challenging due to global state
- Potential for tight coupling if not properly abstracted
- Thread safety considerations in concurrent environments`,
                provider: 'claude',
                cost: 0.001,
                latency: 100,
            }),
        };
        // Setup mock MemoryService - Return 3-6 results per query to pass confidence thresholds
        // PatternDetector filters at 0.5 confidence. Most patterns need 3+ results to pass.
        // Singleton: needs 3+ results (confidence = results/5)
        // Factory: needs 3+ results (confidence = results/5)
        // DI: needs 5+ results (confidence = results/10)
        mockMemoryService = {
            search: vi.fn().mockImplementation((query) => {
                // Return 4 results by default - enough for most patterns
                return Promise.resolve([
                    {
                        file: 'src/database/connection.ts',
                        line: 10,
                        content: `${query} implementation here`,
                        score: 0.9,
                    },
                    {
                        file: 'src/cache/Cache.ts',
                        line: 5,
                        content: `${query} example`,
                        score: 0.85,
                    },
                    {
                        file: 'src/auth/AuthService.ts',
                        line: 15,
                        content: `Using ${query} pattern`,
                        score: 0.8,
                    },
                    {
                        file: 'src/services/UserService.ts',
                        line: 20,
                        content: `${query} in user service`,
                        score: 0.75,
                    },
                ]);
            }),
        };
        generator = new ADRGenerator(mockProviderRouter, mockMemoryService);
    });
    describe('constructor', () => {
        it('should create ADRGenerator instance', () => {
            expect(generator).toBeInstanceOf(ADRGenerator);
        });
        it('should set generatorName to "ADR"', () => {
            expect(generator.generatorName).toBe('ADR');
        });
    });
    describe('generate', () => {
        const baseOptions = {
            projectRoot: '/test/project',
            outputPath: 'docs/adr.md',
            provider: 'claude',
            enableCache: false,
        };
        it('should generate ADR successfully', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            expect(result.outputPath).toBe('docs/adr.md');
            expect(result.content).toContain('Architectural Decision Record');
            expect(result.metadata).toBeDefined();
            expect(result.metadata.patternsDetected).toBeGreaterThan(0);
        });
        it('should detect singleton pattern', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            expect(result.content).toContain('Singleton');
        });
        it('should respect pattern filter option', async () => {
            const result = await generator.generate({
                ...baseOptions,
                pattern: 'Singleton',
            });
            expect(result.success).toBe(true);
            expect(mockMemoryService.search).toHaveBeenCalledWith('static instance', expect.any(Object));
        });
        it('should include code examples when requested', async () => {
            const result = await generator.generate({
                ...baseOptions,
                includeExamples: true,
            });
            expect(result.success).toBe(true);
            // AI should be prompted to include examples
            expect(mockProviderRouter.route).toHaveBeenCalled();
            const prompt = mockProviderRouter.route.mock.calls[0][0].messages[0].content;
            expect(prompt).toContain('Examples:');
        });
        it('should include rationale when requested', async () => {
            const result = await generator.generate({
                ...baseOptions,
                includeRationale: true,
            });
            expect(result.success).toBe(true);
            const prompt = mockProviderRouter.route.mock.calls[0][0].messages[0].content;
            expect(prompt).toContain('detailed rationale');
        });
        it('should support different templates', async () => {
            const result = await generator.generate({
                ...baseOptions,
                template: 'y-statement',
            });
            expect(result.success).toBe(true);
            const prompt = mockProviderRouter.route.mock.calls[0][0].messages[0].content;
            expect(prompt).toContain('Y-statement');
        });
        it('should handle no patterns found', async () => {
            mockMemoryService.search = vi.fn().mockResolvedValue([]);
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            expect(result.content).toContain('No significant architectural patterns');
        });
        it('should track progress with callback', async () => {
            const progressCallback = vi.fn();
            await generator.generate(baseOptions, progressCallback);
            expect(progressCallback).toHaveBeenCalled();
            // Progress callback receives (stage: string, progress: number), not messages
            const calls = progressCallback.mock.calls.map((call) => call[0]);
            expect(calls).toContain('analyzing');
            expect(calls).toContain('detecting');
            expect(calls).toContain('generating');
        });
        it('should validate generated content', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.validation).toBeDefined();
            expect(result.validation?.valid).toBe(true);
            expect(result.validation?.errors).toHaveLength(0);
        });
        it('should use cache when enabled', async () => {
            const optionsWithCache = { ...baseOptions, enableCache: true };
            // First call
            const result1 = await generator.generate(optionsWithCache);
            expect(result1.metadata.cacheHit).toBe(false);
            // Second call (should hit cache)
            const result2 = await generator.generate(optionsWithCache);
            expect(result2.metadata.cacheHit).toBe(true);
        });
        it('should include additional context in prompt', async () => {
            await generator.generate({
                ...baseOptions,
                context: 'This is a microservices architecture',
            });
            const prompt = mockProviderRouter.route.mock.calls[0][0].messages[0].content;
            expect(prompt).toContain('This is a microservices architecture');
        });
        it('should handle AI provider errors gracefully', async () => {
            mockProviderRouter.route = vi.fn().mockRejectedValue(new Error('AI provider error'));
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(false);
            expect(result.error).toContain('AI provider error');
        });
        it('should detect multiple pattern types', async () => {
            // Return 4+ results for ALL queries to pass confidence thresholds
            // PatternDetector.detectAll() sends: 'static instance' (Singleton), 'factory' (Factory), etc.
            mockMemoryService.search = vi.fn().mockImplementation((query) => {
                // Singleton pattern - searches for 'static instance'
                if (query === 'static instance') {
                    return Promise.resolve([
                        { file: 'src/db.ts', content: 'static instance; getInstance()', score: 0.9 },
                        { file: 'src/cache.ts', content: 'static instance', score: 0.85 },
                        { file: 'src/config.ts', content: 'static instance', score: 0.8 },
                        { file: 'src/logger.ts', content: 'private constructor static instance', score: 0.75 },
                    ]);
                }
                // Factory pattern - searches for 'factory' (lowercase)
                if (query === 'factory') {
                    return Promise.resolve([
                        { file: 'src/UserFactory.ts', content: 'class UserFactory { createUser() {} }', score: 0.85 },
                        { file: 'src/ProductFactory.ts', content: 'class ProductFactory { create() {} }', score: 0.8 },
                        { file: 'src/OrderFactory.ts', content: 'class OrderFactory { buildOrder() {} }', score: 0.75 },
                        { file: 'src/ItemFactory.ts', content: 'factory pattern with create method', score: 0.7 },
                    ]);
                }
                // Return fewer results for other patterns so they don't pass threshold
                return Promise.resolve([
                    { file: 'src/test.ts', content: 'test content', score: 0.5 },
                ]);
            });
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            expect(result.metadata.patternsDetected).toBeGreaterThan(1);
        });
        it('should format output correctly', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            // Content starts with HTML comment header, followed by markdown
            expect(result.content).toContain('# Architectural Decision Record');
            expect(result.content).toContain('\n\n'); // Has paragraphs
            expect(result.content).toContain('<!--'); // Has header comment
        });
        it('should save file to correct location', async () => {
            const fs = await import('fs');
            const result = await generator.generate(baseOptions);
            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith('docs/adr.md', expect.any(String), 'utf-8');
        });
        it('should create output directory if needed', async () => {
            const fs = await import('fs');
            fs.existsSync.mockReturnValue(false);
            await generator.generate(baseOptions);
            expect(fs.mkdirSync).toHaveBeenCalled();
        });
        it('should respect verbose logging option', async () => {
            const consoleSpy = vi.spyOn(console, 'log');
            await generator.generate({ ...baseOptions, verbose: true });
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
        it('should handle empty project root', async () => {
            const result = await generator.generate({
                ...baseOptions,
                projectRoot: '',
            });
            expect(result.success).toBe(true);
        });
        it('should include metadata in result', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.generator).toBe('adr');
            expect(result.metadata.timestamp).toBeDefined();
            expect(result.metadata.patternsDetected).toBeDefined();
            expect(result.metadata.filesAnalyzed).toBeDefined();
        });
        it('should measure generation time', async () => {
            const result = await generator.generate(baseOptions);
            expect(result.metadata.generationTime).toBeGreaterThan(0);
        });
    });
    describe('PatternDetector integration', () => {
        it('should detect Singleton pattern', async () => {
            // Return 4+ results to pass confidence threshold (3/5 = 0.6 > 0.5)
            mockMemoryService.search = vi.fn().mockResolvedValue([
                { file: 'test1.ts', content: 'static instance; getInstance()', score: 0.9 },
                { file: 'test2.ts', content: 'private static instance', score: 0.85 },
                { file: 'test3.ts', content: 'static instance', score: 0.8 },
                { file: 'test4.ts', content: 'getInstance()', score: 0.75 },
            ]);
            const result = await generator.generate({
                projectRoot: '/test',
                outputPath: 'out.md',
                pattern: 'Singleton',
            });
            expect(result.success).toBe(true);
            expect(result.metadata.patternsDetected).toBeGreaterThan(0);
        });
        it('should detect Factory pattern', async () => {
            // Return 4+ results to pass confidence threshold
            mockMemoryService.search = vi.fn().mockResolvedValue([
                { file: 'test1.ts', content: 'class UserFactory { create() {} }', score: 0.9 },
                { file: 'test2.ts', content: 'class ProductFactory { create() {} }', score: 0.85 },
                { file: 'test3.ts', content: 'class OrderFactory { create() {} }', score: 0.8 },
                { file: 'test4.ts', content: 'class ItemFactory { create() {} }', score: 0.75 },
            ]);
            const result = await generator.generate({
                projectRoot: '/test',
                outputPath: 'out.md',
                pattern: 'Factory',
            });
            expect(result.success).toBe(true);
        });
        it('should detect Dependency Injection pattern', async () => {
            // Return 6+ results to pass DI confidence threshold (5/10 = 0.5, need 6 for >0.5)
            mockMemoryService.search = vi.fn().mockResolvedValue([
                { file: 'test1.ts', content: 'constructor(private repo: Repository)', score: 0.9 },
                { file: 'test2.ts', content: 'constructor(service: UserService)', score: 0.85 },
                { file: 'test3.ts', content: 'constructor(private db: Database)', score: 0.8 },
                { file: 'test4.ts', content: 'constructor(logger: Logger)', score: 0.75 },
                { file: 'test5.ts', content: 'constructor(cache: Cache)', score: 0.7 },
                { file: 'test6.ts', content: 'constructor(auth: Auth)', score: 0.65 },
            ]);
            const result = await generator.generate({
                projectRoot: '/test',
                outputPath: 'out.md',
                pattern: 'DependencyInjection',
            });
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=ADRGenerator.test.js.map