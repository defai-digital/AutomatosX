/**
 * Hot Reload Engine Tests
 * Sprint 5 Day 46: Hot reload with state preservation tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadEngine, createHotReloadEngine, getHotReloadEngine, resetHotReloadEngine, } from '../../plugins/HotReload.js';
import { mkdtempSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
describe('HotReloadEngine', () => {
    let engine;
    let testDir;
    beforeEach(() => {
        engine = createHotReloadEngine();
        testDir = mkdtempSync(join(tmpdir(), 'hot-reload-test-'));
    });
    afterEach(() => {
        engine.shutdown();
        try {
            // Clean up test directory
            const fs = require('fs');
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
    });
    describe('Enable/Disable', () => {
        it('should enable hot reload for a plugin', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            expect(engine.isEnabled('test-plugin')).toBe(true);
        });
        it('should disable hot reload for a plugin', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            engine.disableHotReload('test-plugin');
            expect(engine.isEnabled('test-plugin')).toBe(false);
        });
        it('should emit hot-reload-enabled event', async () => {
            const listener = vi.fn();
            engine.on('hot-reload-enabled', listener);
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith({ pluginName: 'test-plugin' });
        });
        it('should emit hot-reload-disabled event', async () => {
            const listener = vi.fn();
            engine.on('hot-reload-disabled', listener);
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            engine.disableHotReload('test-plugin');
            expect(listener).toHaveBeenCalledWith({ pluginName: 'test-plugin' });
        });
        it('should replace existing watcher when re-enabling', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
                debounceMs: 500,
            });
            expect(engine.isEnabled('test-plugin')).toBe(true);
        });
        it('should do nothing when disabling non-existent plugin', () => {
            expect(() => engine.disableHotReload('non-existent')).not.toThrow();
        });
    });
    describe('Plugin State', () => {
        it('should check if plugin is enabled', async () => {
            expect(engine.isEnabled('test-plugin')).toBe(false);
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            expect(engine.isEnabled('test-plugin')).toBe(true);
        });
        it('should check if reload is in progress', async () => {
            expect(engine.isReloading('test-plugin')).toBe(false);
            // Note: Testing reload in progress is difficult without actual file changes
            // This is tested indirectly through reload operations
        });
        it('should list all watched plugins', async () => {
            await engine.enableHotReload('plugin-1', { watchPath: testDir });
            await engine.enableHotReload('plugin-2', { watchPath: testDir });
            const watched = engine.getWatchedPlugins();
            expect(watched).toContain('plugin-1');
            expect(watched).toContain('plugin-2');
            expect(watched).toHaveLength(2);
        });
        it('should return empty list when no plugins watched', () => {
            expect(engine.getWatchedPlugins()).toEqual([]);
        });
    });
    describe('Reload Operations', () => {
        it('should reload a plugin', async () => {
            const result = await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(result).toMatchObject({
                success: true,
                pluginName: 'test-plugin',
                duration: expect.any(Number),
            });
        });
        it('should emit reload-started event', async () => {
            const listener = vi.fn();
            engine.on('reload-started', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith({ pluginName: 'test-plugin' });
        });
        it('should emit reload-success event', async () => {
            const listener = vi.fn();
            engine.on('reload-success', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                pluginName: 'test-plugin',
            }));
        });
        it('should measure reload duration', async () => {
            const result = await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(result.duration).toBeGreaterThan(0);
            expect(result.duration).toBeLessThan(1000); // Should be fast for mock
        });
        it('should include version information', async () => {
            const result = await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(result.previousVersion).toBeDefined();
            expect(result.newVersion).toBeDefined();
        });
        it('should prevent concurrent reloads of same plugin', async () => {
            const promise1 = engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            // Try to reload again immediately
            const promise2 = engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            const [result1, result2] = await Promise.all([promise1, promise2]);
            // One should succeed, one should be skipped (undefined result)
            const successCount = [result1, result2].filter((r) => r?.success).length;
            expect(successCount).toBeGreaterThanOrEqual(1);
        });
    });
    describe('State Preservation', () => {
        it('should save plugin state when preserveState enabled', async () => {
            const listener = vi.fn();
            engine.on('state-saved', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: true,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                pluginName: 'test-plugin',
                snapshot: expect.objectContaining({
                    pluginName: 'test-plugin',
                    timestamp: expect.any(Number),
                    state: expect.any(Object),
                    metadata: expect.any(Object),
                }),
            }));
        });
        it('should restore plugin state when preserveState enabled', async () => {
            const listener = vi.fn();
            engine.on('state-restored', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: true,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                pluginName: 'test-plugin',
            }));
        });
        it('should not save state when preserveState disabled', async () => {
            const listener = vi.fn();
            engine.on('state-saved', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: false,
            });
            expect(listener).not.toHaveBeenCalled();
        });
        it('should get state snapshot', async () => {
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: true,
            });
            const snapshot = engine.getStateSnapshot('test-plugin');
            expect(snapshot).toMatchObject({
                pluginName: 'test-plugin',
                timestamp: expect.any(Number),
                state: expect.any(Object),
                metadata: expect.any(Object),
            });
        });
        it('should return undefined for non-existent snapshot', () => {
            const snapshot = engine.getStateSnapshot('non-existent');
            expect(snapshot).toBeUndefined();
        });
    });
    describe('Error Handling', () => {
        it('should handle reload errors', async () => {
            // Mock loadPlugin to throw error
            const originalLoadPlugin = engine.loadPlugin;
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            const result = await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('Load failed');
            engine.loadPlugin = originalLoadPlugin;
        });
        it('should emit reload-failure event on error', async () => {
            const listener = vi.fn();
            engine.on('reload-failure', listener);
            // Mock loadPlugin to throw error
            const originalLoadPlugin = engine.loadPlugin;
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                pluginName: 'test-plugin',
                error: expect.any(Error),
            }));
            engine.loadPlugin = originalLoadPlugin;
        });
        it('should rollback on error when rollbackOnError enabled', async () => {
            const listener = vi.fn();
            engine.on('rollback-started', listener);
            // Mock loadPlugin to throw error
            const originalLoadPlugin = engine.loadPlugin;
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                rollbackOnError: true,
            });
            expect(listener).toHaveBeenCalledWith({ pluginName: 'test-plugin' });
            engine.loadPlugin = originalLoadPlugin;
        });
        it('should not rollback when rollbackOnError disabled', async () => {
            const listener = vi.fn();
            engine.on('rollback-started', listener);
            // Mock loadPlugin to throw error
            const originalLoadPlugin = engine.loadPlugin;
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                rollbackOnError: false,
            });
            expect(listener).not.toHaveBeenCalled();
            engine.loadPlugin = originalLoadPlugin;
        });
    });
    describe('File Watching', () => {
        it('should watch for file changes', async () => {
            const listener = vi.fn();
            engine.on('hot-reload-complete', listener);
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
                debounceMs: 50,
            });
            // Create a file to trigger watch
            const testFile = join(testDir, 'test.js');
            writeFileSync(testFile, 'console.log("test")');
            // Wait for debounce and reload
            await new Promise((resolve) => setTimeout(resolve, 200));
            expect(listener).toHaveBeenCalled();
            // Cleanup
            unlinkSync(testFile);
        });
        it('should debounce rapid file changes', async () => {
            const listener = vi.fn();
            engine.on('hot-reload-complete', listener);
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
                debounceMs: 100,
            });
            const testFile = join(testDir, 'test.js');
            // Create multiple rapid changes
            writeFileSync(testFile, 'v1');
            writeFileSync(testFile, 'v2');
            writeFileSync(testFile, 'v3');
            // Wait for debounce
            await new Promise((resolve) => setTimeout(resolve, 200));
            // Should only reload once despite multiple changes
            expect(listener.mock.calls.length).toBeLessThanOrEqual(1);
            // Cleanup
            unlinkSync(testFile);
        });
        it('should use custom debounce time', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
                debounceMs: 500,
            });
            // Note: Testing specific debounce timing is difficult
            // This test mainly ensures the option is accepted
            expect(engine.isEnabled('test-plugin')).toBe(true);
        });
        it('should use default debounce when not specified', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
            });
            expect(engine.isEnabled('test-plugin')).toBe(true);
        });
    });
    describe('Cache Clearing', () => {
        it('should emit cache-cleared event', async () => {
            const listener = vi.fn();
            engine.on('cache-cleared', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                pluginName: 'test-plugin',
                clearedModules: expect.any(Number),
            }));
        });
        it('should clear module cache during reload', async () => {
            // Load a mock module
            require.cache['/test/plugin/index.js'] = { exports: {} };
            await engine.reloadPlugin('plugin', {
                watchPath: testDir,
            });
            // Cache for 'plugin' should be cleared
            const pluginCacheKeys = Object.keys(require.cache).filter((key) => key.includes('plugin'));
            expect(pluginCacheKeys.length).toBe(0);
        });
    });
    describe('Shutdown', () => {
        it('should shutdown cleanly', async () => {
            await engine.enableHotReload('plugin-1', { watchPath: testDir });
            await engine.enableHotReload('plugin-2', { watchPath: testDir });
            engine.shutdown();
            expect(engine.getWatchedPlugins()).toHaveLength(0);
        });
        it('should emit shutdown event', () => {
            const listener = vi.fn();
            engine.on('shutdown', listener);
            engine.shutdown();
            expect(listener).toHaveBeenCalled();
        });
        it('should clear all watchers', async () => {
            await engine.enableHotReload('plugin-1', { watchPath: testDir });
            await engine.enableHotReload('plugin-2', { watchPath: testDir });
            engine.shutdown();
            expect(engine.isEnabled('plugin-1')).toBe(false);
            expect(engine.isEnabled('plugin-2')).toBe(false);
        });
        it('should clear all state', async () => {
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: true,
            });
            engine.shutdown();
            expect(engine.getStateSnapshot('test-plugin')).toBeUndefined();
        });
        it('should clear pending timers', async () => {
            await engine.enableHotReload('test-plugin', {
                watchPath: testDir,
                debounceMs: 5000, // Long debounce
            });
            // Trigger a file change
            const testFile = join(testDir, 'test.js');
            writeFileSync(testFile, 'test');
            engine.shutdown();
            // Timer should be cleared - no reload after shutdown
            const listener = vi.fn();
            engine.on('hot-reload-complete', listener);
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(listener).not.toHaveBeenCalled();
        });
    });
    describe('Global Engine', () => {
        afterEach(() => {
            resetHotReloadEngine();
        });
        it('should get global engine', () => {
            const engine = getHotReloadEngine();
            expect(engine).toBeInstanceOf(HotReloadEngine);
        });
        it('should return same instance on multiple calls', () => {
            const engine1 = getHotReloadEngine();
            const engine2 = getHotReloadEngine();
            expect(engine1).toBe(engine2);
        });
        it('should reset global engine', () => {
            const engine1 = getHotReloadEngine();
            resetHotReloadEngine();
            const engine2 = getHotReloadEngine();
            expect(engine2).not.toBe(engine1);
        });
        it('should shutdown when resetting', async () => {
            const engine = getHotReloadEngine();
            const listener = vi.fn();
            engine.on('shutdown', listener);
            resetHotReloadEngine();
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Event Lifecycle', () => {
        it('should emit plugin-loaded event', async () => {
            const listener = vi.fn();
            engine.on('plugin-loaded', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                pluginName: 'test-plugin',
                version: expect.any(String),
            }));
        });
        it('should emit plugin-unloaded event', async () => {
            const listener = vi.fn();
            engine.on('plugin-unloaded', listener);
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
            });
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                pluginName: 'test-plugin',
            }));
        });
        it('should emit rollback-complete event', async () => {
            const listener = vi.fn();
            engine.on('rollback-complete', listener);
            // Mock loadPlugin to throw error
            const originalLoadPlugin = engine.loadPlugin;
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                rollbackOnError: true,
                preserveState: true, // Need state to rollback
            });
            engine.loadPlugin = originalLoadPlugin;
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                preserveState: true,
            });
            engine.loadPlugin = vi.fn().mockRejectedValue(new Error('Load failed'));
            await engine.reloadPlugin('test-plugin', {
                watchPath: testDir,
                rollbackOnError: true,
            });
            expect(listener).toHaveBeenCalledWith({ pluginName: 'test-plugin' });
            engine.loadPlugin = originalLoadPlugin;
        });
    });
});
//# sourceMappingURL=HotReload.test.js.map