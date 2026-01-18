/**
 * Ability Domain Tests
 *
 * Tests for ability registry, loader, and manager functionality.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { InMemoryAbilityRegistry, createAbilityRegistry, FileSystemAbilityLoader, createAbilityLoader, DefaultAbilityManager, createAbilityManager, DEFAULT_ABILITY_DOMAIN_CONFIG, } from '@defai.digital/ability-domain';
describe('Ability Domain', () => {
    describe('InMemoryAbilityRegistry', () => {
        let registry;
        beforeEach(() => {
            registry = new InMemoryAbilityRegistry();
        });
        describe('register', () => {
            it('should register a valid ability', async () => {
                const ability = {
                    abilityId: 'typescript',
                    content: 'TypeScript best practices',
                    priority: 80,
                    enabled: true,
                };
                await registry.register(ability);
                const retrieved = await registry.get('typescript');
                expect(retrieved).toBeDefined();
                expect(retrieved?.abilityId).toBe('typescript');
                expect(retrieved?.priority).toBe(80);
            });
            it('should overwrite existing ability with same ID', async () => {
                const ability1 = {
                    abilityId: 'typescript',
                    content: 'Version 1',
                    priority: 50,
                    enabled: true,
                };
                const ability2 = {
                    abilityId: 'typescript',
                    content: 'Version 2',
                    priority: 80,
                    enabled: true,
                };
                await registry.register(ability1);
                await registry.register(ability2);
                const retrieved = await registry.get('typescript');
                expect(retrieved?.content).toBe('Version 2');
                expect(retrieved?.priority).toBe(80);
            });
        });
        describe('get', () => {
            it('should return undefined for non-existent ability', async () => {
                const result = await registry.get('non-existent');
                expect(result).toBeUndefined();
            });
            it('should return ability by ID', async () => {
                await registry.register({
                    abilityId: 'clean-code',
                    content: 'Clean code principles',
                    priority: 75,
                    enabled: true,
                });
                const result = await registry.get('clean-code');
                expect(result).toBeDefined();
                expect(result?.abilityId).toBe('clean-code');
            });
        });
        describe('list', () => {
            beforeEach(async () => {
                await registry.register({
                    abilityId: 'typescript',
                    content: 'TypeScript content',
                    category: 'languages',
                    tags: ['typescript', 'programming'],
                    priority: 90,
                    enabled: true,
                    applicableTo: ['code-reviewer'],
                });
                await registry.register({
                    abilityId: 'javascript',
                    content: 'JavaScript content',
                    category: 'languages',
                    tags: ['javascript', 'programming'],
                    priority: 85,
                    enabled: true,
                });
                await registry.register({
                    abilityId: 'clean-code',
                    content: 'Clean code principles',
                    category: 'engineering',
                    tags: ['best-practices'],
                    priority: 80,
                    enabled: true,
                });
                await registry.register({
                    abilityId: 'deprecated-patterns',
                    content: 'Old patterns',
                    category: 'legacy',
                    priority: 20,
                    enabled: false,
                    excludeFrom: ['code-reviewer'],
                });
            });
            it('should list all abilities sorted by priority', async () => {
                const abilities = await registry.list();
                expect(abilities).toHaveLength(4);
                expect(abilities[0].abilityId).toBe('typescript'); // Priority 90
                expect(abilities[1].abilityId).toBe('javascript'); // Priority 85
                expect(abilities[2].abilityId).toBe('clean-code'); // Priority 80
                expect(abilities[3].abilityId).toBe('deprecated-patterns'); // Priority 20
            });
            it('should filter by category', async () => {
                const abilities = await registry.list({ category: 'languages' });
                expect(abilities).toHaveLength(2);
                expect(abilities.every((a) => a.category === 'languages')).toBe(true);
            });
            it('should filter by tags', async () => {
                const abilities = await registry.list({ tags: ['programming'] });
                expect(abilities).toHaveLength(2);
                expect(abilities.map((a) => a.abilityId)).toContain('typescript');
                expect(abilities.map((a) => a.abilityId)).toContain('javascript');
            });
            it('should filter by enabled status', async () => {
                const enabled = await registry.list({ enabled: true });
                expect(enabled).toHaveLength(3);
                const disabled = await registry.list({ enabled: false });
                expect(disabled).toHaveLength(1);
                expect(disabled[0].abilityId).toBe('deprecated-patterns');
            });
            it('should filter by applicableTo', async () => {
                const applicable = await registry.list({ applicableTo: 'code-reviewer' });
                // typescript has applicableTo: ['code-reviewer']
                // javascript has no applicableTo (applies to all)
                // clean-code has no applicableTo (applies to all)
                // deprecated-patterns has excludeFrom: ['code-reviewer']
                expect(applicable).toHaveLength(3);
                expect(applicable.map((a) => a.abilityId)).not.toContain('deprecated-patterns');
            });
            it('should handle wildcard applicableTo', async () => {
                await registry.register({
                    abilityId: 'universal',
                    content: 'Universal ability',
                    applicableTo: ['*'],
                    priority: 50,
                    enabled: true,
                });
                const applicable = await registry.list({ applicableTo: 'any-agent' });
                expect(applicable.map((a) => a.abilityId)).toContain('universal');
            });
        });
        describe('remove', () => {
            it('should remove an ability', async () => {
                await registry.register({
                    abilityId: 'to-remove',
                    content: 'Will be removed',
                    priority: 50,
                    enabled: true,
                });
                expect(await registry.exists('to-remove')).toBe(true);
                await registry.remove('to-remove');
                expect(await registry.exists('to-remove')).toBe(false);
            });
            it('should not throw when removing non-existent ability', async () => {
                await expect(registry.remove('non-existent')).resolves.not.toThrow();
            });
        });
        describe('exists', () => {
            it('should return true for existing ability', async () => {
                await registry.register({
                    abilityId: 'exists-test',
                    content: 'Test',
                    priority: 50,
                    enabled: true,
                });
                expect(await registry.exists('exists-test')).toBe(true);
            });
            it('should return false for non-existent ability', async () => {
                expect(await registry.exists('does-not-exist')).toBe(false);
            });
        });
        describe('clear', () => {
            it('should remove all abilities', async () => {
                await registry.register({
                    abilityId: 'ability-1',
                    content: 'Content 1',
                    priority: 50,
                    enabled: true,
                });
                await registry.register({
                    abilityId: 'ability-2',
                    content: 'Content 2',
                    priority: 50,
                    enabled: true,
                });
                expect((await registry.list()).length).toBe(2);
                await registry.clear();
                expect((await registry.list()).length).toBe(0);
            });
        });
    });
    describe('createAbilityRegistry', () => {
        it('should create an InMemoryAbilityRegistry', () => {
            const registry = createAbilityRegistry();
            expect(registry).toBeInstanceOf(InMemoryAbilityRegistry);
        });
    });
    describe('FileSystemAbilityLoader', () => {
        const testDir = '/tmp/test-abilities';
        beforeEach(() => {
            // Create test directory and files
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            // Create test ability files
            fs.writeFileSync(path.join(testDir, 'typescript.md'), `---
abilityId: typescript
displayName: TypeScript Best Practices
category: languages
tags: [typescript, programming]
priority: 85
---

# TypeScript Best Practices

Use strict mode and proper typing.
`);
            fs.writeFileSync(path.join(testDir, 'clean-code.md'), `---
category: engineering
priority: 80
enabled: true
---

# Clean Code

Write clean, maintainable code.
`);
            fs.writeFileSync(path.join(testDir, 'no-frontmatter.md'), `# Simple Ability

Just content, no frontmatter.
`);
        });
        afterEach(() => {
            // Clean up test directory
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true });
            }
        });
        it('should load all abilities from directory', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            const abilities = await loader.loadAll();
            expect(abilities).toHaveLength(3);
            expect(abilities.map((a) => a.abilityId)).toContain('typescript');
            expect(abilities.map((a) => a.abilityId)).toContain('clean-code');
            expect(abilities.map((a) => a.abilityId)).toContain('no-frontmatter');
        });
        it('should parse YAML frontmatter correctly', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            const typescript = await loader.load('typescript');
            expect(typescript).toBeDefined();
            expect(typescript?.displayName).toBe('TypeScript Best Practices');
            expect(typescript?.category).toBe('languages');
            expect(typescript?.tags).toContain('typescript');
            expect(typescript?.priority).toBe(85);
        });
        it('should generate ability ID from filename if not in frontmatter', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            const cleanCode = await loader.load('clean-code');
            expect(cleanCode).toBeDefined();
            expect(cleanCode?.abilityId).toBe('clean-code');
        });
        it('should handle files without frontmatter', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            const simple = await loader.load('no-frontmatter');
            expect(simple).toBeDefined();
            expect(simple?.abilityId).toBe('no-frontmatter');
            expect(simple?.content).toContain('Simple Ability');
        });
        it('should check existence correctly', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            expect(await loader.exists('typescript')).toBe(true);
            expect(await loader.exists('non-existent')).toBe(false);
        });
        it('should reload abilities', async () => {
            const loader = new FileSystemAbilityLoader({ abilitiesDir: testDir });
            await loader.loadAll();
            // Add a new file
            fs.writeFileSync(path.join(testDir, 'new-ability.md'), `---
abilityId: new-ability
---
New content.
`);
            // Before reload, should not exist
            expect(await loader.exists('new-ability')).toBe(false);
            // After reload, should exist
            await loader.reload();
            expect(await loader.exists('new-ability')).toBe(true);
        });
        it('should handle non-existent directory gracefully', async () => {
            const loader = new FileSystemAbilityLoader({
                abilitiesDir: '/non/existent/dir',
            });
            const abilities = await loader.loadAll();
            expect(abilities).toHaveLength(0);
        });
    });
    describe('createAbilityLoader', () => {
        it('should create a FileSystemAbilityLoader', () => {
            const loader = createAbilityLoader({ abilitiesDir: '/tmp/test' });
            expect(loader).toBeInstanceOf(FileSystemAbilityLoader);
        });
    });
    describe('DefaultAbilityManager', () => {
        let registry;
        let manager;
        beforeEach(async () => {
            registry = new InMemoryAbilityRegistry();
            manager = new DefaultAbilityManager(registry);
            // Register test abilities
            await registry.register({
                abilityId: 'typescript',
                content: 'TypeScript best practices for type safety and modern development.',
                category: 'languages',
                tags: ['typescript', 'types', 'programming'],
                priority: 90,
                enabled: true,
            });
            await registry.register({
                abilityId: 'clean-code',
                content: 'Clean code principles: readability, maintainability, SOLID.',
                category: 'engineering',
                tags: ['clean-code', 'best-practices', 'solid'],
                priority: 85,
                enabled: true,
            });
            await registry.register({
                abilityId: 'testing',
                content: 'Testing strategies: unit tests, integration tests, TDD.',
                category: 'engineering',
                tags: ['testing', 'tdd', 'unit-tests'],
                priority: 80,
                enabled: true,
            });
            await registry.register({
                abilityId: 'legacy-patterns',
                content: 'Old patterns (deprecated)',
                category: 'legacy',
                priority: 20,
                enabled: false,
            });
        });
        describe('getAbilitiesForTask', () => {
            it('should return abilities relevant to task', async () => {
                const abilities = await manager.getAbilitiesForTask('test-agent', 'Write TypeScript code with proper types');
                expect(abilities.length).toBeGreaterThan(0);
                // TypeScript should be first due to keyword match
                expect(abilities[0].abilityId).toBe('typescript');
            });
            it('should prioritize core abilities', async () => {
                const abilities = await manager.getAbilitiesForTask('test-agent', 'Write some code', ['clean-code'] // Explicit core ability
                );
                // clean-code should be first due to core ability bonus
                expect(abilities[0].abilityId).toBe('clean-code');
            });
            it('should respect maxAbilities limit', async () => {
                const abilities = await manager.getAbilitiesForTask('test-agent', 'Write TypeScript tests with clean code', undefined, 2);
                expect(abilities).toHaveLength(2);
            });
            it('should not return disabled abilities', async () => {
                const abilities = await manager.getAbilitiesForTask('test-agent', 'Legacy patterns and old code');
                expect(abilities.map((a) => a.abilityId)).not.toContain('legacy-patterns');
            });
        });
        describe('injectAbilities', () => {
            it('should inject abilities and return combined content', async () => {
                const result = await manager.injectAbilities('test-agent', 'Write TypeScript code');
                expect(result.agentId).toBe('test-agent');
                expect(result.injectedAbilities.length).toBeGreaterThan(0);
                expect(result.combinedContent.length).toBeGreaterThan(0);
                expect(result.tokenCount).toBeGreaterThan(0);
            });
            it('should respect maxTokens limit and set truncated flag', async () => {
                // First, verify we have multiple abilities available
                const allAbilities = await manager.getAbilitiesForTask('test-agent', 'Write TypeScript tests with clean code');
                expect(allAbilities.length).toBeGreaterThan(1);
                // Now inject with a limit that allows only 1 ability
                // Each ability content is ~60-70 chars = ~15-18 tokens
                // Set limit to allow exactly 1 ability
                const result = await manager.injectAbilities('test-agent', 'Write TypeScript tests with clean code', undefined, { maxTokens: 25, maxAbilities: 10 } // ~100 chars, fits 1 ability only
                );
                // Should have at least 1 ability but not all
                expect(result.injectedAbilities.length).toBeGreaterThanOrEqual(1);
                expect(result.injectedAbilities.length).toBeLessThan(allAbilities.length);
                expect(result.truncated).toBe(true);
            });
            it('should include core abilities first', async () => {
                const result = await manager.injectAbilities('test-agent', 'Write some code', ['testing']);
                expect(result.injectedAbilities[0]).toBe('testing');
            });
            it('should include metadata headers when requested', async () => {
                const result = await manager.injectAbilities('test-agent', 'Write TypeScript code', undefined, { includeMetadata: true, maxAbilities: 1 });
                // Should include header with ability name
                expect(result.combinedContent).toContain('##');
            });
        });
        describe('getApplicableAbilities', () => {
            it('should return only enabled abilities', async () => {
                const abilities = await manager.getApplicableAbilities('test-agent');
                expect(abilities.every((a) => a.enabled)).toBe(true);
                expect(abilities.map((a) => a.abilityId)).not.toContain('legacy-patterns');
            });
        });
    });
    describe('createAbilityManager', () => {
        it('should create a DefaultAbilityManager', () => {
            const registry = createAbilityRegistry();
            const manager = createAbilityManager(registry);
            expect(manager).toBeInstanceOf(DefaultAbilityManager);
        });
        it('should use custom config', () => {
            const registry = createAbilityRegistry();
            const manager = createAbilityManager(registry, {
                maxAbilitiesPerAgent: 5,
            });
            expect(manager).toBeInstanceOf(DefaultAbilityManager);
        });
    });
    describe('DEFAULT_ABILITY_DOMAIN_CONFIG', () => {
        it('should have sensible defaults', () => {
            expect(DEFAULT_ABILITY_DOMAIN_CONFIG.abilitiesDir).toBe('examples/abilities');
            expect(DEFAULT_ABILITY_DOMAIN_CONFIG.maxAbilitiesPerAgent).toBe(10);
            expect(DEFAULT_ABILITY_DOMAIN_CONFIG.maxTokensPerInjection).toBe(50000);
            expect(DEFAULT_ABILITY_DOMAIN_CONFIG.cacheEnabled).toBe(true);
        });
    });
});
//# sourceMappingURL=ability-domain.test.js.map