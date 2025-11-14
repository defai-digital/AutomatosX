// Sprint 2 Day 17: Determinism & Chaos Tests
// Tests for deterministic execution and chaos engineering
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SeededRandom, DeterministicUUID, DeterministicTime, DeterministicEnvironment, } from '../utils/DeterministicSeeds.js';
import { ChaosEngine } from '../utils/ChaosEngine.js';
// ============================================================================
// Deterministic Random Tests (10 tests)
// ============================================================================
describe('Deterministic Random', () => {
    it('should generate same sequence with same seed', () => {
        const rng1 = new SeededRandom(12345);
        const rng2 = new SeededRandom(12345);
        const seq1 = Array.from({ length: 10 }, () => rng1.next());
        const seq2 = Array.from({ length: 10 }, () => rng2.next());
        expect(seq1).toEqual(seq2);
    });
    it('should generate different sequences with different seeds', () => {
        const rng1 = new SeededRandom(12345);
        const rng2 = new SeededRandom(54321);
        const seq1 = Array.from({ length: 10 }, () => rng1.next());
        const seq2 = Array.from({ length: 10 }, () => rng2.next());
        expect(seq1).not.toEqual(seq2);
    });
    it('should generate numbers in range [0, 1)', () => {
        const rng = new SeededRandom(12345);
        for (let i = 0; i < 100; i++) {
            const num = rng.next();
            expect(num).toBeGreaterThanOrEqual(0);
            expect(num).toBeLessThan(1);
        }
    });
    it('should generate integers in custom range', () => {
        const rng = new SeededRandom(12345);
        for (let i = 0; i < 100; i++) {
            const num = rng.nextInt(1, 100);
            expect(num).toBeGreaterThanOrEqual(1);
            expect(num).toBeLessThanOrEqual(100);
            expect(Number.isInteger(num)).toBe(true);
        }
    });
    it('should generate floats in custom range', () => {
        const rng = new SeededRandom(12345);
        for (let i = 0; i < 100; i++) {
            const num = rng.nextInRange(10.5, 20.5);
            expect(num).toBeGreaterThanOrEqual(10.5);
            expect(num).toBeLessThanOrEqual(20.5);
        }
    });
    it('should generate boolean with 50% probability', () => {
        const rng = new SeededRandom(12345);
        const results = Array.from({ length: 1000 }, () => rng.nextBoolean());
        const trueCount = results.filter(x => x).length;
        const falseCount = results.filter(x => !x).length;
        // Should be roughly 50/50
        expect(trueCount).toBeGreaterThan(400);
        expect(trueCount).toBeLessThan(600);
        expect(falseCount).toBeGreaterThan(400);
        expect(falseCount).toBeLessThan(600);
    });
    it('should generate same boolean sequence with same seed', () => {
        const rng1 = new SeededRandom(12345);
        const rng2 = new SeededRandom(12345);
        const seq1 = Array.from({ length: 10 }, () => rng1.nextBoolean());
        const seq2 = Array.from({ length: 10 }, () => rng2.nextBoolean());
        expect(seq1).toEqual(seq2);
    });
    it('should pick from array deterministically', () => {
        const rng = new SeededRandom(12345);
        const items = ['a', 'b', 'c', 'd', 'e'];
        const picked = Array.from({ length: 10 }, () => rng.pick(items));
        // All picks should be from items array
        picked.forEach(item => expect(items).toContain(item));
    });
    it('should shuffle array deterministically', () => {
        const rng1 = new SeededRandom(12345);
        const rng2 = new SeededRandom(12345);
        const arr1 = [1, 2, 3, 4, 5];
        const arr2 = [1, 2, 3, 4, 5];
        rng1.shuffle(arr1);
        rng2.shuffle(arr2);
        expect(arr1).toEqual(arr2);
    });
    it('should reset to initial seed', () => {
        const rng = new SeededRandom(12345);
        const seq1 = Array.from({ length: 5 }, () => rng.next());
        rng.reset();
        const seq2 = Array.from({ length: 5 }, () => rng.next());
        expect(seq1).toEqual(seq2);
    });
});
// ============================================================================
// Deterministic UUID Tests (5 tests)
// ============================================================================
describe('Deterministic UUID', () => {
    it('should generate same UUIDs with same seed', () => {
        const uuid1 = new DeterministicUUID(12345);
        const uuid2 = new DeterministicUUID(12345);
        const id1 = uuid1.generate();
        const id2 = uuid2.generate();
        expect(id1).toBe(id2);
    });
    it('should generate different UUIDs with different seeds', () => {
        const uuid1 = new DeterministicUUID(12345);
        const uuid2 = new DeterministicUUID(54321);
        const id1 = uuid1.generate();
        const id2 = uuid2.generate();
        expect(id1).not.toBe(id2);
    });
    it('should generate valid UUID format', () => {
        const uuid = new DeterministicUUID(12345);
        const id = uuid.generate();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
    it('should generate sequence of UUIDs', () => {
        const uuid1 = new DeterministicUUID(12345);
        const uuid2 = new DeterministicUUID(12345);
        const seq1 = Array.from({ length: 5 }, () => uuid1.generate());
        const seq2 = Array.from({ length: 5 }, () => uuid2.generate());
        expect(seq1).toEqual(seq2);
    });
    it('should generate unique UUIDs in sequence', () => {
        const uuid = new DeterministicUUID(12345);
        const ids = Array.from({ length: 100 }, () => uuid.generate());
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(100);
    });
});
// ============================================================================
// Deterministic Time Tests (5 tests)
// ============================================================================
describe('Deterministic Time', () => {
    it('should return fixed base time', () => {
        const baseTime = 1704067200000; // 2024-01-01 00:00:00 UTC
        const time = new DeterministicTime(baseTime);
        expect(time.now()).toBe(baseTime);
    });
    it('should advance time correctly', () => {
        const baseTime = 1704067200000;
        const time = new DeterministicTime(baseTime);
        time.advance(1000); // 1 second
        expect(time.now()).toBe(baseTime + 1000);
        time.advance(5000); // 5 seconds
        expect(time.now()).toBe(baseTime + 6000);
    });
    it('should generate same timestamps with same seed', () => {
        const baseTime = 1704067200000;
        const time1 = new DeterministicTime(baseTime);
        const time2 = new DeterministicTime(baseTime);
        time1.advance(1000);
        time2.advance(1000);
        expect(time1.now()).toBe(time2.now());
    });
    it('should create Date objects', () => {
        const baseTime = 1704067200000;
        const time = new DeterministicTime(baseTime);
        const date = time.date();
        expect(date.getTime()).toBe(baseTime);
    });
    it('should reset to base time', () => {
        const baseTime = 1704067200000;
        const time = new DeterministicTime(baseTime);
        time.advance(10000);
        expect(time.now()).toBe(baseTime + 10000);
        time.reset();
        expect(time.now()).toBe(baseTime);
    });
});
// ============================================================================
// Deterministic Environment Tests (5 tests)
// ============================================================================
describe('Deterministic Environment', () => {
    let env;
    let restoreMocks;
    beforeEach(() => {
        env = new DeterministicEnvironment(12345, 1704067200000);
    });
    afterEach(() => {
        if (restoreMocks) {
            restoreMocks();
            restoreMocks = undefined;
        }
    });
    it('should provide deterministic random', () => {
        const num1 = env.random.next();
        const num2 = env.random.next();
        const env2 = new DeterministicEnvironment(12345);
        const num3 = env2.random.next();
        const num4 = env2.random.next();
        expect(num1).toBe(num3);
        expect(num2).toBe(num4);
    });
    it('should provide deterministic UUIDs', () => {
        const id1 = env.uuid.generate();
        const id2 = env.uuid.generate();
        const env2 = new DeterministicEnvironment(12345);
        const id3 = env2.uuid.generate();
        const id4 = env2.uuid.generate();
        expect(id1).toBe(id3);
        expect(id2).toBe(id4);
    });
    it('should provide deterministic time', () => {
        const t1 = env.time.now();
        env.time.advance(1000);
        const t2 = env.time.now();
        const env2 = new DeterministicEnvironment(12345, 1704067200000);
        const t3 = env2.time.now();
        env2.time.advance(1000);
        const t4 = env2.time.now();
        expect(t1).toBe(t3);
        expect(t2).toBe(t4);
    });
    it('should install global mocks', () => {
        restoreMocks = env.installGlobalMocks();
        const random1 = Math.random();
        const random2 = Math.random();
        env = new DeterministicEnvironment(12345);
        restoreMocks = env.installGlobalMocks();
        const random3 = Math.random();
        const random4 = Math.random();
        expect(random1).toBe(random3);
        expect(random2).toBe(random4);
    });
    it('should restore global functions', () => {
        const originalRandom = Math.random;
        const originalDateNow = Date.now;
        restoreMocks = env.installGlobalMocks();
        expect(Math.random).not.toBe(originalRandom);
        expect(Date.now).not.toBe(originalDateNow);
        restoreMocks();
        expect(Math.random).toBe(originalRandom);
        expect(Date.now).toBe(originalDateNow);
    });
});
// ============================================================================
// Chaos Engine Tests (10 tests)
// ============================================================================
describe('Chaos Engine', () => {
    let chaos;
    beforeEach(() => {
        chaos = new ChaosEngine({
            enabled: true,
            failureRate: 0.5,
            seed: 12345,
        });
    });
    afterEach(() => {
        chaos.disable();
        chaos.reset();
    });
    it('should inject failures at configured rate', () => {
        const iterations = 1000;
        let failures = 0;
        for (let i = 0; i < iterations; i++) {
            const result = chaos.shouldInject(`test-${i}`);
            if (result.shouldFail) {
                failures++;
            }
        }
        const actualRate = failures / iterations;
        const expectedRate = 0.5;
        // Should be within 10% of expected rate
        expect(actualRate).toBeGreaterThan(expectedRate - 0.1);
        expect(actualRate).toBeLessThan(expectedRate + 0.1);
    });
    it('should not inject failures when disabled', () => {
        chaos.disable();
        const iterations = 100;
        for (let i = 0; i < iterations; i++) {
            const result = chaos.shouldInject(`test-${i}`);
            expect(result.shouldFail).toBe(false);
        }
    });
    it('should generate deterministic failures with same seed', () => {
        const chaos1 = new ChaosEngine({ enabled: true, seed: 12345, failureRate: 0.3 });
        const chaos2 = new ChaosEngine({ enabled: true, seed: 12345, failureRate: 0.3 });
        const results1 = Array.from({ length: 10 }, (_, i) => chaos1.shouldInject(`test-${i}`).shouldFail);
        const results2 = Array.from({ length: 10 }, (_, i) => chaos2.shouldInject(`test-${i}`).shouldFail);
        expect(results1).toEqual(results2);
    });
    it('should track chaos events', () => {
        for (let i = 0; i < 10; i++) {
            chaos.shouldInject(`test-${i}`);
        }
        const events = chaos.getEvents();
        expect(events.length).toBe(10);
    });
    it('should track scenario statistics', () => {
        for (let i = 0; i < 50; i++) {
            chaos.shouldInject(`test-${i}`);
        }
        const stats = chaos.getStats();
        let totalInjected = 0;
        stats.forEach(count => {
            totalInjected += count;
        });
        expect(totalInjected).toBeGreaterThan(0);
    });
    it('should inject delays', async () => {
        chaos.updateConfig({ minDelay: 100, maxDelay: 200 });
        const start = Date.now();
        const result = chaos.shouldInject('test-delay');
        if (result.shouldFail && result.delay) {
            await new Promise(resolve => setTimeout(resolve, result.delay));
        }
        const elapsed = Date.now() - start;
        if (result.shouldFail) {
            expect(elapsed).toBeGreaterThanOrEqual(90); // Some tolerance
        }
    });
    it('should emit chaos events', () => {
        const events = [];
        chaos.on('chaos-injected', event => events.push(event));
        for (let i = 0; i < 20; i++) {
            chaos.shouldInject(`test-${i}`);
        }
        expect(events.length).toBeGreaterThan(0);
    });
    it('should reset statistics', () => {
        for (let i = 0; i < 10; i++) {
            chaos.shouldInject(`test-${i}`);
        }
        chaos.reset();
        const summary = chaos.getSummary();
        expect(summary.totalEvents).toBe(0);
        expect(summary.eventsInjected).toBe(0);
    });
    it('should get summary statistics', () => {
        for (let i = 0; i < 100; i++) {
            chaos.shouldInject(`test-${i}`);
        }
        const summary = chaos.getSummary();
        expect(summary.totalEvents).toBe(100);
        expect(summary.eventsInjected).toBeGreaterThan(0);
        expect(summary.failureRate).toBeGreaterThan(0);
        expect(summary.scenarioCounts).toBeDefined();
    });
    it('should handle specific scenarios', () => {
        chaos.updateConfig({
            scenarios: ['provider-failure', 'network-latency'],
        });
        for (let i = 0; i < 50; i++) {
            const result = chaos.shouldInject(`test-${i}`);
            if (result.shouldFail && result.scenario) {
                expect(['provider-failure', 'network-latency']).toContain(result.scenario);
            }
        }
    });
});
//# sourceMappingURL=determinism-and-chaos.test.js.map