/**
 * Seeded random number generator (LCG algorithm)
 * Provides deterministic random numbers for testing
 */
export declare class SeededRandom {
    private seed;
    constructor(seed: number);
    /**
     * Generate next random number [0, 1)
     */
    next(): number;
    /**
     * Generate random integer in range [min, max)
     */
    nextInt(min: number, max: number): number;
    /**
     * Generate random element from array
     */
    choice<T>(array: T[]): T;
    /**
     * Shuffle array deterministically
     */
    shuffle<T>(array: T[]): T[];
    /**
     * Reset seed for replay
     */
    reset(newSeed: number): void;
}
/**
 * Deterministic UUID generator
 * Generates UUIDs from seeded random numbers
 */
export declare class DeterministicUUID {
    private random;
    constructor(seed: number);
    /**
     * Generate UUID v4 format
     */
    generate(): string;
    /**
     * Generate multiple UUIDs
     */
    generateBatch(count: number): string[];
}
/**
 * Deterministic timestamp generator
 * Provides controlled time progression for testing
 */
export declare class DeterministicTime {
    private baseTime;
    private currentOffset;
    constructor(baseTimestamp?: number);
    /**
     * Get current timestamp
     */
    now(): number;
    /**
     * Get current Date object
     */
    date(): Date;
    /**
     * Get current ISO string
     */
    toISOString(): string;
    /**
     * Advance time by milliseconds
     */
    advance(ms: number): void;
    /**
     * Reset time to base
     */
    reset(): void;
    /**
     * Set new base time
     */
    setBase(timestamp: number): void;
}
/**
 * Comprehensive deterministic environment
 * Combines random, UUID, and time control
 */
export declare class DeterministicEnvironment {
    random: SeededRandom;
    uuid: DeterministicUUID;
    time: DeterministicTime;
    constructor(seed: number, baseTimestamp?: number);
    /**
     * Reset all components
     */
    reset(seed: number, baseTimestamp?: number): void;
    /**
     * Install global mocks
     * Replaces Math.random, Date.now, crypto.randomUUID
     */
    installGlobalMocks(): () => void;
    /**
     * Create isolated test environment
     */
    static createTestEnv(seed?: number): {
        env: DeterministicEnvironment;
        cleanup: () => void;
    };
}
/**
 * Utility for deterministic delays
 */
export declare class DeterministicDelay {
    private time;
    constructor(time: DeterministicTime);
    /**
     * Simulate delay without actually waiting
     */
    simulate(ms: number): Promise<void>;
    /**
     * Create mock setTimeout
     */
    createMockSetTimeout(): typeof setTimeout;
}
/**
 * Provider response mocker
 */
export interface MockProviderResponse {
    provider: string;
    model: string;
    response: string;
    latency: number;
}
export declare class MockProviderResponses {
    private responses;
    private random;
    constructor(seed: number);
    /**
     * Register mock response for a provider
     */
    register(provider: string, response: MockProviderResponse): void;
    /**
     * Get next response for provider
     */
    getNext(provider: string): MockProviderResponse | null;
    /**
     * Check if provider has responses available
     */
    hasResponses(provider: string): boolean;
    /**
     * Clear all responses
     */
    clear(): void;
    /**
     * Load responses from fixture
     */
    loadFromFixture(fixture: Record<string, MockProviderResponse[]>): void;
}
/**
 * Example usage in tests:
 *
 * ```typescript
 * import { DeterministicEnvironment } from './DeterministicSeeds'
 *
 * describe('MyTest', () => {
 *   let env: DeterministicEnvironment
 *   let cleanup: () => void
 *
 *   beforeEach(() => {
 *     const testEnv = DeterministicEnvironment.createTestEnv(12345)
 *     env = testEnv.env
 *     cleanup = testEnv.cleanup
 *   })
 *
 *   afterEach(() => {
 *     cleanup()
 *   })
 *
 *   it('should generate deterministic UUID', () => {
 *     const uuid1 = env.uuid.generate()
 *     env.reset(12345) // Reset to same seed
 *     const uuid2 = env.uuid.generate()
 *     expect(uuid1).toBe(uuid2) // Same UUID!
 *   })
 * })
 * ```
 */
//# sourceMappingURL=DeterministicSeeds.d.ts.map