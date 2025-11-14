// Sprint 2 Day 13: Deterministic Seeds Utility
// Provides deterministic randomness, timestamps, and UUIDs for replay testing

/**
 * Seeded random number generator (LCG algorithm)
 * Provides deterministic random numbers for testing
 */
export class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  /**
   * Generate next random number [0, 1)
   */
  next(): number {
    // Linear Congruential Generator
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  /**
   * Generate random integer in range [min, max)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min
  }

  /**
   * Generate random float in range [min, max)
   */
  nextInRange(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  /**
   * Generate random element from array
   */
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)]
  }

  /**
   * Shuffle array deterministically
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  /**
   * Reset seed for replay
   */
  reset(newSeed: number): void {
    this.seed = newSeed
  }
}

/**
 * Deterministic UUID generator
 * Generates UUIDs from seeded random numbers
 */
export class DeterministicUUID {
  private random: SeededRandom

  constructor(seed: number) {
    this.random = new SeededRandom(seed)
  }

  /**
   * Generate UUID v4 format
   */
  generate(): string {
    const hex = '0123456789abcdef'
    let uuid = ''

    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-'
      } else if (i === 14) {
        uuid += '4' // Version 4
      } else if (i === 19) {
        uuid += hex[this.random.nextInt(8, 12)] // Variant bits
      } else {
        uuid += hex[this.random.nextInt(0, 16)]
      }
    }

    return uuid
  }

  /**
   * Generate multiple UUIDs
   */
  generateBatch(count: number): string[] {
    return Array.from({ length: count }, () => this.generate())
  }
}

/**
 * Deterministic timestamp generator
 * Provides controlled time progression for testing
 */
export class DeterministicTime {
  private baseTime: number
  private currentOffset: number

  constructor(baseTimestamp: number = Date.UTC(2025, 0, 8, 10, 0, 0)) {
    this.baseTime = baseTimestamp
    this.currentOffset = 0
  }

  /**
   * Get current timestamp
   */
  now(): number {
    return this.baseTime + this.currentOffset
  }

  /**
   * Get current Date object
   */
  date(): Date {
    return new Date(this.now())
  }

  /**
   * Get current ISO string
   */
  toISOString(): string {
    return this.date().toISOString()
  }

  /**
   * Advance time by milliseconds
   */
  advance(ms: number): void {
    this.currentOffset += ms
  }

  /**
   * Reset time to base
   */
  reset(): void {
    this.currentOffset = 0
  }

  /**
   * Set new base time
   */
  setBase(timestamp: number): void {
    this.baseTime = timestamp
    this.currentOffset = 0
  }
}

/**
 * Comprehensive deterministic environment
 * Combines random, UUID, and time control
 */
export class DeterministicEnvironment {
  public random: SeededRandom
  public uuid: DeterministicUUID
  public time: DeterministicTime

  constructor(seed: number, baseTimestamp?: number) {
    this.random = new SeededRandom(seed)
    this.uuid = new DeterministicUUID(seed)
    this.time = new DeterministicTime(baseTimestamp)
  }

  /**
   * Reset all components
   */
  reset(seed: number, baseTimestamp?: number): void {
    this.random.reset(seed)
    this.uuid = new DeterministicUUID(seed)
    if (baseTimestamp !== undefined) {
      this.time.setBase(baseTimestamp)
    } else {
      this.time.reset()
    }
  }

  /**
   * Install global mocks
   * Replaces Math.random, Date.now, crypto.randomUUID
   */
  installGlobalMocks(): () => void {
    const originalRandom = Math.random
    const originalDateNow = Date.now
    const originalCryptoRandomUUID = global.crypto?.randomUUID

    // Mock Math.random
    Math.random = () => this.random.next()

    // Mock Date.now
    Date.now = () => this.time.now()

    // Mock crypto.randomUUID if available
    if (global.crypto) {
      global.crypto.randomUUID = () => this.uuid.generate() as `${string}-${string}-${string}-${string}-${string}`
    }

    // Return cleanup function
    return () => {
      Math.random = originalRandom
      Date.now = originalDateNow
      if (global.crypto && originalCryptoRandomUUID) {
        global.crypto.randomUUID = originalCryptoRandomUUID
      }
    }
  }

  /**
   * Create isolated test environment
   */
  static createTestEnv(seed: number = 12345): {
    env: DeterministicEnvironment
    cleanup: () => void
  } {
    const env = new DeterministicEnvironment(seed)
    const cleanup = env.installGlobalMocks()
    return { env, cleanup }
  }
}

/**
 * Utility for deterministic delays
 */
export class DeterministicDelay {
  private time: DeterministicTime

  constructor(time: DeterministicTime) {
    this.time = time
  }

  /**
   * Simulate delay without actually waiting
   */
  async simulate(ms: number): Promise<void> {
    this.time.advance(ms)
    return Promise.resolve()
  }

  /**
   * Create mock setTimeout
   */
  createMockSetTimeout(): typeof setTimeout {
    return ((callback: () => void, ms: number) => {
      this.time.advance(ms)
      callback()
      return 0 as any
    }) as typeof setTimeout
  }
}

/**
 * Provider response mocker
 */
export interface MockProviderResponse {
  provider: string
  model: string
  response: string
  latency: number
}

export class MockProviderResponses {
  private responses: Map<string, MockProviderResponse[]> = new Map()
  private random: SeededRandom

  constructor(seed: number) {
    this.random = new SeededRandom(seed)
  }

  /**
   * Register mock response for a provider
   */
  register(provider: string, response: MockProviderResponse): void {
    if (!this.responses.has(provider)) {
      this.responses.set(provider, [])
    }
    this.responses.get(provider)!.push(response)
  }

  /**
   * Get next response for provider
   */
  getNext(provider: string): MockProviderResponse | null {
    const providerResponses = this.responses.get(provider)
    if (!providerResponses || providerResponses.length === 0) {
      return null
    }

    // Return responses in order (deterministic)
    return providerResponses.shift() || null
  }

  /**
   * Check if provider has responses available
   */
  hasResponses(provider: string): boolean {
    const providerResponses = this.responses.get(provider)
    return !!providerResponses && providerResponses.length > 0
  }

  /**
   * Clear all responses
   */
  clear(): void {
    this.responses.clear()
  }

  /**
   * Load responses from fixture
   */
  loadFromFixture(fixture: Record<string, MockProviderResponse[]>): void {
    this.clear()
    Object.entries(fixture).forEach(([provider, responses]) => {
      responses.forEach(response => this.register(provider, response))
    })
  }
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
