/**
 * Startup Monitor Tests
 * Sprint 5 Day 44: CLI startup monitoring tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StartupMonitor, createStartupMonitor, getGlobalMonitor, resetGlobalMonitor, } from '../../cli/StartupMonitor.js';
describe('StartupMonitor', () => {
    let monitor;
    beforeEach(() => {
        monitor = createStartupMonitor();
    });
    describe('Basic Monitoring', () => {
        it('should start monitoring', () => {
            const listener = vi.fn();
            monitor.on('startup-started', listener);
            monitor.start();
            expect(listener).toHaveBeenCalled();
        });
        it('should track phases', () => {
            monitor.start();
            monitor.startPhase('phase1');
            monitor.endPhase();
            const phases = monitor.getPhases();
            expect(phases).toHaveLength(1);
            expect(phases[0].name).toBe('phase1');
        });
        it('should finish monitoring', async () => {
            monitor.start();
            monitor.startPhase('init');
            monitor.endPhase();
            await new Promise((resolve) => setTimeout(resolve, 10));
            const report = monitor.finish();
            expect(report.totalDuration).toBeGreaterThan(0);
            expect(report.phases).toHaveLength(1);
        });
    });
    describe('Phase Tracking', () => {
        it('should emit phase-started event', () => {
            const listener = vi.fn();
            monitor.on('phase-started', listener);
            monitor.start();
            monitor.startPhase('test-phase');
            expect(listener).toHaveBeenCalledWith({ name: 'test-phase' });
        });
        it('should emit phase-ended event', () => {
            const listener = vi.fn();
            monitor.on('phase-ended', listener);
            monitor.start();
            monitor.startPhase('test-phase');
            monitor.endPhase();
            expect(listener).toHaveBeenCalled();
        });
        it('should auto-end previous phase', () => {
            monitor.start();
            monitor.startPhase('phase1');
            monitor.startPhase('phase2');
            const phases = monitor.getPhases();
            expect(phases).toHaveLength(1);
            expect(phases[0].name).toBe('phase1');
        });
        it('should calculate phase duration', async () => {
            monitor.start();
            monitor.startPhase('slow-phase');
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.endPhase();
            const phases = monitor.getPhases();
            expect(phases[0].duration).toBeGreaterThanOrEqual(45);
            expect(phases[0].duration).toBeLessThan(100);
        });
        it('should include phase metadata', () => {
            monitor.start();
            monitor.startPhase('phase', { step: 1, module: 'test' });
            monitor.endPhase();
            const phases = monitor.getPhases();
            expect(phases[0].metadata).toEqual({ step: 1, module: 'test' });
        });
        it('should track memory delta', () => {
            monitor.start();
            monitor.startPhase('phase');
            // Allocate some memory
            const arr = new Array(1000).fill({});
            monitor.endPhase();
            const phases = monitor.getPhases();
            expect(phases[0].memoryDelta).toBeDefined();
        });
    });
    describe('Report Generation', () => {
        it('should generate complete report', async () => {
            monitor.start();
            monitor.startPhase('phase1');
            await new Promise((resolve) => setTimeout(resolve, 10));
            monitor.endPhase();
            monitor.startPhase('phase2');
            await new Promise((resolve) => setTimeout(resolve, 20));
            monitor.endPhase();
            const report = monitor.finish();
            expect(report).toMatchObject({
                totalDuration: expect.any(Number),
                phases: expect.any(Array),
                slowestPhases: expect.any(Array),
                memoryUsage: {
                    initial: expect.any(Number),
                    final: expect.any(Number),
                    delta: expect.any(Number),
                },
                recommendations: expect.any(Array),
            });
        });
        it('should identify slowest phases', async () => {
            monitor.start();
            monitor.startPhase('fast');
            await new Promise((resolve) => setTimeout(resolve, 5));
            monitor.endPhase();
            monitor.startPhase('slow');
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.endPhase();
            monitor.startPhase('medium');
            await new Promise((resolve) => setTimeout(resolve, 20));
            monitor.endPhase();
            const report = monitor.finish();
            expect(report.slowestPhases[0].name).toBe('slow');
            expect(report.slowestPhases[1].name).toBe('medium');
            expect(report.slowestPhases[2].name).toBe('fast');
        });
        it('should limit slowest phases to 3', () => {
            monitor.start();
            for (let i = 0; i < 10; i++) {
                monitor.startPhase(`phase${i}`);
                monitor.endPhase();
            }
            const report = monitor.finish();
            expect(report.slowestPhases).toHaveLength(3);
        });
        it('should emit startup-finished event', () => {
            const listener = vi.fn();
            monitor.on('startup-finished', listener);
            monitor.start();
            const report = monitor.finish();
            expect(listener).toHaveBeenCalledWith(report);
        });
    });
    describe('Recommendations', () => {
        it('should recommend on slow total startup', async () => {
            monitor.setThresholds({ totalStartup: 10 });
            monitor.start();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const report = monitor.finish();
            expect(report.recommendations.length).toBeGreaterThan(0);
            expect(report.recommendations[0]).toContain('Startup time');
        });
        it('should recommend on slow phase', async () => {
            monitor.setThresholds({ slowPhase: 10 });
            monitor.start();
            monitor.startPhase('slow-init');
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.endPhase();
            const report = monitor.finish();
            const slowPhaseRec = report.recommendations.find((r) => r.includes('slow-init'));
            expect(slowPhaseRec).toBeDefined();
        });
        it('should not recommend when within thresholds', async () => {
            monitor.setThresholds({
                totalStartup: 1000,
                slowPhase: 100,
            });
            monitor.start();
            monitor.startPhase('fast');
            await new Promise((resolve) => setTimeout(resolve, 10));
            monitor.endPhase();
            const report = monitor.finish();
            // Should have minimal or no recommendations
            const performanceRecs = report.recommendations.filter((r) => r.includes('Startup time') || r.includes('is slow'));
            expect(performanceRecs).toHaveLength(0);
        });
    });
    describe('Thresholds', () => {
        it('should get default thresholds', () => {
            const thresholds = monitor.getThresholds();
            expect(thresholds).toMatchObject({
                slowPhase: 50,
                totalStartup: 200,
            });
        });
        it('should set custom thresholds', () => {
            monitor.setThresholds({
                slowPhase: 100,
                totalStartup: 500,
            });
            const thresholds = monitor.getThresholds();
            expect(thresholds.slowPhase).toBe(100);
            expect(thresholds.totalStartup).toBe(500);
        });
        it('should partially update thresholds', () => {
            monitor.setThresholds({ slowPhase: 75 });
            const thresholds = monitor.getThresholds();
            expect(thresholds.slowPhase).toBe(75);
            expect(thresholds.totalStartup).toBe(200); // Unchanged
        });
    });
    describe('Enable/Disable', () => {
        it('should start enabled by default', () => {
            expect(monitor.isEnabled()).toBe(true);
        });
        it('should disable monitoring', () => {
            monitor.disable();
            expect(monitor.isEnabled()).toBe(false);
        });
        it('should not track when disabled', () => {
            monitor.disable();
            monitor.start();
            monitor.startPhase('test');
            monitor.endPhase();
            expect(monitor.getPhases()).toHaveLength(0);
        });
        it('should return empty report when disabled', () => {
            monitor.disable();
            monitor.start();
            const report = monitor.finish();
            expect(report.totalDuration).toBe(0);
            expect(report.phases).toHaveLength(0);
        });
        it('should re-enable monitoring', () => {
            monitor.disable();
            monitor.enable();
            expect(monitor.isEnabled()).toBe(true);
            monitor.start();
            monitor.startPhase('test');
            monitor.endPhase();
            expect(monitor.getPhases()).toHaveLength(1);
        });
    });
    describe('Formatting', () => {
        it('should format report as text', async () => {
            monitor.start();
            monitor.startPhase('init');
            await new Promise((resolve) => setTimeout(resolve, 10));
            monitor.endPhase();
            const report = monitor.finish();
            const formatted = StartupMonitor.formatReport(report);
            expect(formatted).toContain('Startup Performance Report');
            expect(formatted).toContain('Total Duration');
            expect(formatted).toContain('Memory Usage');
            expect(formatted).toContain('init');
        });
        it('should include slowest phases in format', async () => {
            monitor.start();
            monitor.startPhase('slow');
            await new Promise((resolve) => setTimeout(resolve, 50));
            monitor.endPhase();
            const report = monitor.finish();
            const formatted = StartupMonitor.formatReport(report);
            expect(formatted).toContain('Slowest Phases');
            expect(formatted).toContain('slow');
        });
        it('should include recommendations in format', async () => {
            monitor.setThresholds({ totalStartup: 10 });
            monitor.start();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const report = monitor.finish();
            const formatted = StartupMonitor.formatReport(report);
            expect(formatted).toContain('Recommendations');
        });
    });
    describe('Global Monitor', () => {
        afterEach(() => {
            resetGlobalMonitor();
        });
        it('should get global monitor', () => {
            const monitor = getGlobalMonitor();
            expect(monitor).toBeInstanceOf(StartupMonitor);
        });
        it('should return same instance', () => {
            const monitor1 = getGlobalMonitor();
            const monitor2 = getGlobalMonitor();
            expect(monitor1).toBe(monitor2);
        });
        it('should reset global monitor', () => {
            const monitor1 = getGlobalMonitor();
            resetGlobalMonitor();
            const monitor2 = getGlobalMonitor();
            expect(monitor2).not.toBe(monitor1);
        });
    });
    describe('Edge Cases', () => {
        it('should handle finishing without starting', () => {
            const report = monitor.finish();
            expect(report.totalDuration).toBeGreaterThanOrEqual(0);
        });
        it('should handle ending phase without active phase', () => {
            monitor.start();
            expect(() => monitor.endPhase()).not.toThrow();
            expect(monitor.getPhases()).toHaveLength(0);
        });
        it('should auto-end phase on finish', () => {
            monitor.start();
            monitor.startPhase('incomplete');
            const report = monitor.finish();
            expect(report.phases).toHaveLength(1);
            expect(report.phases[0].name).toBe('incomplete');
            expect(report.phases[0].duration).toBeDefined();
        });
        it('should handle multiple starts', () => {
            monitor.start();
            monitor.startPhase('phase1');
            monitor.endPhase();
            monitor.start(); // Start again
            expect(monitor.getPhases()).toHaveLength(0);
        });
        it('should handle many phases', () => {
            monitor.start();
            for (let i = 0; i < 100; i++) {
                monitor.startPhase(`phase${i}`);
                monitor.endPhase();
            }
            const report = monitor.finish();
            expect(report.phases).toHaveLength(100);
            expect(report.slowestPhases).toHaveLength(3);
        });
    });
    describe('Memory Tracking', () => {
        it('should track memory usage', () => {
            monitor.start();
            // Allocate memory
            const bigArray = new Array(10000).fill(Math.random());
            const report = monitor.finish();
            expect(report.memoryUsage.delta).toBeGreaterThan(0);
        });
        it('should calculate memory delta per phase', () => {
            monitor.start();
            monitor.startPhase('phase1');
            const arr1 = new Array(5000).fill({});
            monitor.endPhase();
            const phases = monitor.getPhases();
            expect(phases[0].memoryDelta).toBeDefined();
        });
    });
});
//# sourceMappingURL=StartupMonitor.test.js.map