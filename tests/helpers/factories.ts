/**
 * Test Data Factories using Faker.js
 *
 * Provides factory functions for creating test data with realistic random values.
 * All factories accept optional overrides for specific test scenarios.
 *
 * @module tests/helpers/factories
 * @since v12.8.3
 */

import { faker } from '@faker-js/faker';
import { vi } from 'vitest';
import type { AgentProfile, ExecutionContext, Stage, Personality } from '@/types/agent.js';
import type {
  Provider,
  ExecutionResponse,
  HealthStatus,
  RateLimitStatus,
  ProviderCapabilities,
} from '@/types/provider.js';
import type { MemoryEntry } from '@/types/memory.js';
import type { DelegationResult } from '@/types/orchestration.js';

// ============================================================================
// Seed Management
// ============================================================================

/**
 * Set a seed for reproducible tests
 * Call this in beforeEach() for deterministic test data
 */
export function setTestSeed(seed: number): void {
  faker.seed(seed);
}

/**
 * Reset faker to use random seed
 */
export function resetTestSeed(): void {
  faker.seed();
}

// ============================================================================
// Agent Factories
// ============================================================================

/**
 * Create a fake agent profile
 */
export function createAgentProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  const name = overrides.name ?? faker.helpers.arrayElement([
    'backend', 'frontend', 'quality', 'security', 'devops', 'architecture'
  ]);

  return {
    name,
    displayName: faker.person.firstName(),
    role: faker.person.jobTitle(),
    description: faker.lorem.sentence(),
    systemPrompt: faker.lorem.paragraph(),
    abilities: faker.helpers.arrayElements(['coding', 'testing', 'debugging', 'reviewing', 'deploying'], { min: 1, max: 3 }),
    team: faker.helpers.arrayElement(['core', 'platform', 'security', 'data']),
    provider: faker.helpers.arrayElement(['claude', 'gemini-cli', 'openai']),
    model: faker.helpers.arrayElement(['gpt-4o', 'claude-3-opus', 'gemini-pro']),
    temperature: faker.number.float({ min: 0, max: 1, fractionDigits: 1 }),
    tags: faker.helpers.arrayElements(['ai', 'automation', 'development', 'testing'], { min: 0, max: 2 }),
    version: faker.system.semver(),
    ...overrides,
  };
}

/**
 * Create a fake stage for agent workflow
 */
export function createStage(overrides: Partial<Stage> = {}): Stage {
  return {
    name: faker.helpers.slugify(faker.lorem.words(2)),
    description: faker.lorem.sentence(),
    key_questions: faker.helpers.multiple(() => faker.lorem.sentence() + '?', { count: { min: 1, max: 3 } }),
    outputs: faker.helpers.multiple(() => faker.lorem.words(3), { count: { min: 1, max: 2 } }),
    ...overrides,
  };
}

/**
 * Create a fake personality
 */
export function createPersonality(overrides: Partial<Personality> = {}): Personality {
  return {
    traits: faker.helpers.arrayElements(['analytical', 'creative', 'methodical', 'pragmatic', 'detail-oriented'], { min: 2, max: 4 }),
    catchphrase: faker.lorem.sentence(),
    communication_style: faker.helpers.arrayElement(['formal', 'casual', 'technical', 'friendly']),
    decision_making: faker.helpers.arrayElement(['data-driven', 'intuitive', 'collaborative', 'cautious']),
    ...overrides,
  };
}

// ============================================================================
// Provider Factories
// ============================================================================

/**
 * Create fake provider capabilities
 */
export function createProviderCapabilities(overrides: Partial<ProviderCapabilities> = {}): ProviderCapabilities {
  return {
    supportsStreaming: faker.datatype.boolean(),
    supportsEmbedding: faker.datatype.boolean(),
    supportsVision: faker.datatype.boolean(),
    maxContextTokens: faker.helpers.arrayElement([4096, 8192, 16384, 32768, 128000]),
    supportedModels: faker.helpers.arrayElements(['gpt-4o', 'gpt-4-turbo', 'claude-3-opus', 'gemini-pro'], { min: 1, max: 3 }),
    ...overrides,
  };
}

/**
 * Create fake health status
 */
export function createHealthStatus(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    available: overrides.available ?? true,
    latencyMs: faker.number.int({ min: 50, max: 500 }),
    errorRate: faker.number.float({ min: 0, max: 0.1, fractionDigits: 3 }),
    consecutiveFailures: overrides.available === false ? faker.number.int({ min: 1, max: 5 }) : 0,
    lastCheckTime: Date.now(),
    ...overrides,
  };
}

/**
 * Create fake rate limit status
 */
export function createRateLimitStatus(overrides: Partial<RateLimitStatus> = {}): RateLimitStatus {
  return {
    hasCapacity: overrides.hasCapacity ?? true,
    requestsRemaining: faker.number.int({ min: 50, max: 1000 }),
    tokensRemaining: faker.number.int({ min: 5000, max: 100000 }),
    resetAtMs: Date.now() + faker.number.int({ min: 30000, max: 120000 }),
    ...overrides,
  };
}

/**
 * Create a fake execution response
 */
export function createExecutionResponse(overrides: Partial<ExecutionResponse> = {}): ExecutionResponse {
  const promptTokens = faker.number.int({ min: 100, max: 2000 });
  const completionTokens = faker.number.int({ min: 50, max: 1000 });

  return {
    content: overrides.content ?? faker.lorem.paragraphs({ min: 1, max: 3 }),
    model: faker.helpers.arrayElement(['gpt-4o', 'claude-3-opus', 'gemini-pro']),
    tokensUsed: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
    latencyMs: faker.number.int({ min: 100, max: 3000 }),
    finishReason: faker.helpers.arrayElement(['stop', 'length']),
    cached: faker.datatype.boolean({ probability: 0.2 }),
    ...overrides,
  };
}

/**
 * Create a mock provider with all required methods
 */
export function createMockProvider(overrides: Partial<Provider> = {}): Provider {
  const name = overrides.name ?? faker.helpers.arrayElement(['mock', 'claude', 'gemini', 'openai']);
  const defaultResponse = createExecutionResponse();

  return {
    name,
    version: faker.system.semver(),
    priority: faker.number.int({ min: 1, max: 10 }),
    capabilities: createProviderCapabilities(),
    execute: vi.fn().mockResolvedValue(defaultResponse),
    supportsStreaming: vi.fn().mockReturnValue(false),
    generateEmbedding: vi.fn().mockResolvedValue(
      faker.helpers.multiple(() => faker.number.float({ min: -1, max: 1 }), { count: 384 })
    ),
    isAvailable: vi.fn().mockResolvedValue(true),
    getHealth: vi.fn().mockResolvedValue(createHealthStatus()),
    checkRateLimit: vi.fn().mockResolvedValue(createRateLimitStatus()),
    waitForCapacity: vi.fn().mockResolvedValue(undefined),
    estimateCost: vi.fn().mockResolvedValue({
      estimatedUsd: faker.number.float({ min: 0.001, max: 0.1, fractionDigits: 4 }),
      tokensUsed: faker.number.int({ min: 100, max: 5000 }),
    }),
    getUsageStats: vi.fn().mockResolvedValue({
      totalRequests: faker.number.int({ min: 0, max: 1000 }),
      totalTokens: faker.number.int({ min: 0, max: 1000000 }),
      totalCost: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
      averageLatencyMs: faker.number.int({ min: 100, max: 1000 }),
      errorCount: faker.number.int({ min: 0, max: 50 }),
    }),
    shouldRetry: vi.fn().mockReturnValue(false),
    getRetryDelay: vi.fn().mockReturnValue(1000),
    getCacheMetrics: vi.fn().mockReturnValue({
      availability: { hits: 0, misses: 0, hitRate: 0, avgAge: 0, maxAge: 60000 },
      version: { hits: 0, misses: 0, hitRate: 0, size: 0, avgAge: 0, maxAge: 300000 },
      health: { consecutiveFailures: 0, consecutiveSuccesses: 0, lastCheckDuration: 0, uptime: 100 },
    }),
    clearCaches: vi.fn(),
    ...overrides,
  } as Provider;
}

// ============================================================================
// Context Factories
// ============================================================================

/**
 * Create a fake execution context
 */
export function createExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  const projectDir = overrides.projectDir ?? `/tmp/test-project-${faker.string.alphanumeric(8)}`;

  return {
    agent: overrides.agent ?? createAgentProfile(),
    task: overrides.task ?? faker.lorem.sentence(),
    memory: overrides.memory ?? [],
    projectDir,
    workingDir: projectDir,
    agentWorkspace: `${projectDir}/.automatosx/workspaces/${overrides.agent?.name ?? 'test-agent'}`,
    provider: overrides.provider ?? createMockProvider(),
    abilities: faker.lorem.paragraphs(2),
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Memory Factories
// ============================================================================

/**
 * Create a fake memory entry
 */
export function createMemoryEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: faker.number.int({ min: 1, max: 10000 }),
    content: faker.lorem.paragraph(),
    embedding: faker.helpers.multiple(
      () => faker.number.float({ min: -1, max: 1, fractionDigits: 6 }),
      { count: 1536 }
    ),
    createdAt: faker.date.recent(),
    lastAccessedAt: faker.date.recent(),
    accessCount: faker.number.int({ min: 1, max: 100 }),
    metadata: {
      type: faker.helpers.arrayElement(['conversation', 'code', 'document', 'task', 'other'] as const),
      source: faker.helpers.arrayElement(['task', 'conversation', 'import']),
      agentId: faker.helpers.arrayElement(['backend', 'frontend', 'quality', 'security']),
      tags: faker.helpers.arrayElements(['important', 'reference', 'context'], { min: 0, max: 2 }),
      importance: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
    },
    score: faker.number.float({ min: 0.5, max: 1, fractionDigits: 3 }),
    ...overrides,
  };
}

/**
 * Create multiple memory entries
 */
export function createMemoryEntries(count: number, overrides: Partial<MemoryEntry> = {}): MemoryEntry[] {
  return faker.helpers.multiple(() => createMemoryEntry(overrides), { count });
}

// ============================================================================
// Delegation Factories
// ============================================================================

/**
 * Create a fake delegation result
 */
export function createDelegationResult(overrides: Partial<DelegationResult> = {}): DelegationResult {
  const startTime = faker.date.recent();
  const duration = faker.number.int({ min: 100, max: 5000 });
  const endTime = new Date(startTime.getTime() + duration);

  return {
    delegationId: faker.string.uuid(),
    fromAgent: faker.helpers.arrayElement(['backend', 'architecture', 'product']),
    toAgent: faker.helpers.arrayElement(['frontend', 'quality', 'security']),
    task: faker.lorem.sentence(),
    status: faker.helpers.arrayElement(['success', 'failure']),
    success: overrides.status !== 'failure',
    response: createExecutionResponse(),
    duration,
    outputs: {
      files: faker.helpers.multiple(() => faker.system.filePath(), { count: { min: 0, max: 3 } }),
      memoryIds: faker.helpers.multiple(() => faker.number.int({ min: 1, max: 1000 }), { count: { min: 0, max: 2 } }),
      workspacePath: faker.system.directoryPath(),
    },
    startTime,
    endTime,
    ...overrides,
  };
}

// ============================================================================
// Task Factories
// ============================================================================

/**
 * Create a fake task description
 */
export function createTaskDescription(): string {
  const actions = ['implement', 'create', 'fix', 'refactor', 'test', 'review', 'deploy', 'optimize'];
  const subjects = ['user authentication', 'payment processing', 'API endpoint', 'database schema', 'UI component', 'caching layer', 'error handling', 'logging system'];

  return `${faker.helpers.arrayElement(actions)} ${faker.helpers.arrayElement(subjects)} ${faker.lorem.words({ min: 2, max: 5 })}`;
}

/**
 * Create a complex multi-step task description
 */
export function createComplexTask(): string {
  const tasks = faker.helpers.multiple(() => createTaskDescription(), { count: { min: 2, max: 4 } });
  return tasks.join(' and ');
}

// ============================================================================
// ID Generators
// ============================================================================

/**
 * Create a fake session ID
 */
export function createSessionId(): string {
  return faker.string.uuid();
}

/**
 * Create a fake task ID
 */
export function createTaskId(): string {
  return `task_${faker.string.alphanumeric(12)}`;
}

/**
 * Create a fake delegation chain
 */
export function createDelegationChain(depth: number = 2): string[] {
  const agents = ['backend', 'frontend', 'quality', 'security', 'devops', 'architecture'];
  return faker.helpers.arrayElements(agents, { min: depth, max: depth });
}
