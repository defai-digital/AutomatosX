/**
 * Lockfile Manager Tests
 * Sprint 4 Day 31: Lockfile serialization and validation tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LockfileManager, createLockfileManager, } from '../../plugins/LockfileManager.js';
describe('LockfileManager', () => {
    let tempDir;
    let manager;
    beforeEach(async () => {
        // Create temp directory for tests
        tempDir = join(tmpdir(), `ax-test-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        manager = new LockfileManager(tempDir);
    });
    afterEach(async () => {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch (error) {
            // Ignore cleanup errors
        }
    });
    describe('Read Lockfile', () => {
        it('should return null when lockfile does not exist', async () => {
            const lockfile = await manager.read();
            expect(lockfile).toBeNull();
        });
        it('should read valid lockfile', async () => {
            const mockLockfile = {
                lockfileVersion: 1,
                name: 'test-plugin',
                version: '1.0.0',
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://registry.example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc123',
                    },
                },
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(mockLockfile), 'utf-8');
            const lockfile = await manager.read();
            expect(lockfile).toEqual(mockLockfile);
        });
        it('should parse lockfile with metadata', async () => {
            const mockLockfile = {
                lockfileVersion: 1,
                name: 'test-plugin',
                version: '1.0.0',
                dependencies: {},
                metadata: {
                    generatedAt: '2024-01-01T00:00:00.000Z',
                    generatedBy: 'automatosx',
                    automatosxVersion: '2.0.0',
                    nodeVersion: 'v18.0.0',
                },
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(mockLockfile), 'utf-8');
            const lockfile = await manager.read();
            expect(lockfile?.metadata).toBeDefined();
            expect(lockfile?.metadata?.generatedBy).toBe('automatosx');
        });
        it('should throw error on invalid JSON', async () => {
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), 'invalid json', 'utf-8');
            await expect(manager.read()).rejects.toThrow('Failed to read lockfile');
        });
        it('should throw error on invalid lockfile schema', async () => {
            const invalidLockfile = {
                lockfileVersion: 'invalid', // Should be number
                dependencies: {},
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(invalidLockfile), 'utf-8');
            await expect(manager.read()).rejects.toThrow();
        });
    });
    describe('Write Lockfile', () => {
        it('should write lockfile to disk', async () => {
            const lockfile = {
                lockfileVersion: 1,
                name: 'test-plugin',
                version: '1.0.0',
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://registry.example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc123',
                    },
                },
            };
            await manager.write(lockfile);
            const content = await fs.readFile(join(tempDir, 'ax-plugin.lock'), 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(lockfile);
        });
        it('should format lockfile with indentation', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {},
            };
            await manager.write(lockfile);
            const content = await fs.readFile(join(tempDir, 'ax-plugin.lock'), 'utf-8');
            // Check for indentation (2 spaces)
            expect(content).toContain('  "lockfileVersion"');
        });
        it('should validate lockfile before writing', async () => {
            const invalidLockfile = {
                lockfileVersion: 'invalid',
            };
            await expect(manager.write(invalidLockfile)).rejects.toThrow();
        });
        it('should overwrite existing lockfile', async () => {
            const lockfile1 = {
                lockfileVersion: 1,
                name: 'plugin-v1',
                dependencies: {},
            };
            const lockfile2 = {
                lockfileVersion: 1,
                name: 'plugin-v2',
                dependencies: {},
            };
            await manager.write(lockfile1);
            await manager.write(lockfile2);
            const result = await manager.read();
            expect(result?.name).toBe('plugin-v2');
        });
    });
    describe('Generate Lockfile', () => {
        it('should generate lockfile from dependency nodes', async () => {
            const nodes = [
                {
                    name: 'test-plugin',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 0,
                    optional: false,
                },
                {
                    name: 'dep-a',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: false,
                },
            ];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.name).toBe('test-plugin');
            expect(lockfile.version).toBe('1.0.0');
            expect(lockfile.dependencies['dep-a']).toBeDefined();
        });
        it('should include metadata in generated lockfile', async () => {
            const nodes = [];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.metadata).toBeDefined();
            expect(lockfile.metadata?.generatedBy).toBe('automatosx');
            expect(lockfile.metadata?.generatedAt).toBeDefined();
        });
        it('should skip root node in dependencies', async () => {
            const nodes = [
                {
                    name: 'test-plugin',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 0,
                    optional: false,
                },
                {
                    name: 'dep-a',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: false,
                },
            ];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.dependencies['test-plugin']).toBeUndefined();
            expect(lockfile.dependencies['dep-a']).toBeDefined();
        });
        it('should include child dependencies', async () => {
            const childNode = {
                name: 'dep-b',
                version: '2.0.0',
                dependencies: [],
                depth: 2,
                optional: false,
            };
            const nodes = [
                {
                    name: 'dep-a',
                    version: '1.0.0',
                    dependencies: [childNode],
                    depth: 1,
                    optional: false,
                },
            ];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.dependencies['dep-a'].dependencies).toBeDefined();
            expect(lockfile.dependencies['dep-a'].dependencies?.['dep-b']).toBe('2.0.0');
        });
        it('should mark optional dependencies', async () => {
            const nodes = [
                {
                    name: 'optional-dep',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: true,
                },
            ];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.dependencies['optional-dep'].optional).toBe(true);
        });
        it('should generate integrity hashes', async () => {
            const nodes = [
                {
                    name: 'dep-a',
                    version: '1.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: false,
                },
            ];
            const lockfile = await manager.generate('test-plugin', '1.0.0', nodes);
            expect(lockfile.dependencies['dep-a'].integrity).toMatch(/^sha512-/);
        });
    });
    describe('Update Lockfile', () => {
        it('should throw error if no lockfile exists', async () => {
            const nodes = [];
            await expect(manager.update(nodes)).rejects.toThrow('No existing lockfile found');
        });
        it('should merge new dependencies into existing lockfile', async () => {
            const existing = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await manager.write(existing);
            const newNodes = [
                {
                    name: 'dep-b',
                    version: '2.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: false,
                },
            ];
            const updated = await manager.update(newNodes);
            expect(updated.dependencies['dep-a']).toBeDefined();
            expect(updated.dependencies['dep-b']).toBeDefined();
        });
        it('should update existing dependency versions', async () => {
            const existing = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-old',
                    },
                },
            };
            await manager.write(existing);
            const newNodes = [
                {
                    name: 'dep-a',
                    version: '2.0.0',
                    dependencies: [],
                    depth: 1,
                    optional: false,
                },
            ];
            const updated = await manager.update(newNodes);
            expect(updated.dependencies['dep-a'].version).toBe('2.0.0');
        });
        it('should update metadata timestamp', async () => {
            const existing = {
                lockfileVersion: 1,
                dependencies: {},
                metadata: {
                    generatedAt: '2024-01-01T00:00:00.000Z',
                    generatedBy: 'automatosx',
                },
            };
            await manager.write(existing);
            const newNodes = [];
            const updated = await manager.update(newNodes);
            expect(updated.metadata?.generatedAt).not.toBe('2024-01-01T00:00:00.000Z');
        });
    });
    describe('Validate Lockfile', () => {
        it('should return valid for correct lockfile', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await manager.write(lockfile);
            const result = await manager.validate();
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect missing lockfile', async () => {
            const result = await manager.validate();
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Lockfile not found');
        });
        it('should detect unsupported lockfile version', async () => {
            const lockfile = {
                lockfileVersion: 999,
                dependencies: {},
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(lockfile), 'utf-8');
            const result = await manager.validate();
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(true);
        });
        it('should detect missing version in dependency', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(lockfile), 'utf-8');
            const result = await manager.validate();
            expect(result.valid).toBe(false);
        });
        it('should detect missing integrity in dependency', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                    },
                },
            };
            await fs.writeFile(join(tempDir, 'ax-plugin.lock'), JSON.stringify(lockfile), 'utf-8');
            const result = await manager.validate();
            expect(result.valid).toBe(false);
        });
    });
    describe('Compare with Manifest', () => {
        it('should return matching for identical dependencies', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await manager.write(lockfile);
            const manifestDeps = {
                'dep-a': '^1.0.0',
            };
            const result = await manager.compare(manifestDeps);
            expect(result.matching).toBe(true);
            expect(result.differences).toHaveLength(0);
        });
        it('should detect dependency in manifest but not in lockfile', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {},
            };
            await manager.write(lockfile);
            const manifestDeps = {
                'dep-a': '^1.0.0',
            };
            const result = await manager.compare(manifestDeps);
            expect(result.matching).toBe(false);
            expect(result.differences.some((d) => d.includes('dep-a'))).toBe(true);
        });
        it('should detect dependency in lockfile but not in manifest', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await manager.write(lockfile);
            const manifestDeps = {};
            const result = await manager.compare(manifestDeps);
            expect(result.matching).toBe(false);
            expect(result.differences.some((d) => d.includes('dep-a'))).toBe(true);
        });
        it('should return not matching if no lockfile exists', async () => {
            const manifestDeps = {
                'dep-a': '^1.0.0',
            };
            const result = await manager.compare(manifestDeps);
            expect(result.matching).toBe(false);
            expect(result.differences).toContain('No lockfile exists');
        });
    });
    describe('Get Flat Dependencies', () => {
        it('should return empty array when no lockfile exists', async () => {
            const flat = await manager.getFlatDependencies();
            expect(flat).toEqual([]);
        });
        it('should flatten lockfile dependencies', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                    'dep-b': {
                        version: '2.0.0',
                        resolved: 'https://example.com/dep-b-2.0.0.tgz',
                        integrity: 'sha512-def',
                    },
                },
            };
            await manager.write(lockfile);
            const flat = await manager.getFlatDependencies();
            expect(flat).toHaveLength(2);
            expect(flat[0].name).toBe('dep-a');
            expect(flat[1].name).toBe('dep-b');
        });
        it('should include all required fields in flat entries', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'dep-a': {
                        version: '1.0.0',
                        resolved: 'https://example.com/dep-a-1.0.0.tgz',
                        integrity: 'sha512-abc',
                    },
                },
            };
            await manager.write(lockfile);
            const flat = await manager.getFlatDependencies();
            expect(flat[0]).toHaveProperty('name');
            expect(flat[0]).toHaveProperty('version');
            expect(flat[0]).toHaveProperty('resolved');
            expect(flat[0]).toHaveProperty('integrity');
            expect(flat[0]).toHaveProperty('isOptional');
        });
        it('should mark optional dependencies correctly', async () => {
            const lockfile = {
                lockfileVersion: 1,
                dependencies: {
                    'optional-dep': {
                        version: '1.0.0',
                        resolved: 'https://example.com/optional-dep-1.0.0.tgz',
                        integrity: 'sha512-abc',
                        optional: true,
                    },
                },
            };
            await manager.write(lockfile);
            const flat = await manager.getFlatDependencies();
            expect(flat[0].isOptional).toBe(true);
        });
    });
    describe('Factory Function', () => {
        it('should create manager via factory', () => {
            const manager = createLockfileManager(tempDir);
            expect(manager).toBeInstanceOf(LockfileManager);
        });
        it('should create managers with different paths', () => {
            const manager1 = createLockfileManager('/path/1');
            const manager2 = createLockfileManager('/path/2');
            expect(manager1).not.toBe(manager2);
        });
    });
});
//# sourceMappingURL=LockfileManager.test.js.map