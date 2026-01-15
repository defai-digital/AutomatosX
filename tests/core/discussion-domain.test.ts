/**
 * Discussion Domain Tests
 *
 * Tests for multi-model discussion orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DiscussionExecutor,
  createDiscussionExecutor,
  StubProviderExecutor,
  RoundRobinPattern,
  SynthesisPattern,
  DebatePattern,
  CritiquePattern,
  VotingPattern,
  SynthesisConsensus,
  VotingConsensus,
  ModeratorConsensus,
  getPatternExecutor,
  getConsensusExecutor,
  isPatternSupported,
  isConsensusMethodSupported,
  getSupportedPatterns,
  getSupportedConsensusMethods,
  interpolate,
  formatPreviousResponses,
  formatVotingOptions,
  formatVotes,
  getProviderSystemPrompt,
  type DiscussionProviderExecutor,
  type PatternExecutionContext,
  type ConsensusExecutionContext,
} from '@defai.digital/discussion-domain';
import {
  createDefaultDiscussStepConfig,
  createDebateConfig,
  createVotingConfig,
  DEFAULT_PROVIDERS,
  type DiscussStepConfig,
} from '@defai.digital/contracts';

// ============================================================================
// Stub Provider Executor Tests
// ============================================================================

describe('StubProviderExecutor', () => {
  it('should return mock responses for available providers', async () => {
    const executor = new StubProviderExecutor(['claude', 'grok']);

    const result = await executor.execute({
      providerId: 'claude',
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('claude');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should fail for unavailable providers', async () => {
    const executor = new StubProviderExecutor(['claude']);

    const result = await executor.execute({
      providerId: 'gpt',
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('should check provider availability', async () => {
    const executor = new StubProviderExecutor(['claude', 'grok', 'gemini']);

    expect(await executor.isAvailable('claude')).toBe(true);
    expect(await executor.isAvailable('grok')).toBe(true);
    expect(await executor.isAvailable('unknown')).toBe(false);
  });

  it('should return list of available providers', async () => {
    const executor = new StubProviderExecutor(['claude', 'grok']);

    const providers = await executor.getAvailableProviders();

    expect(providers).toContain('claude');
    expect(providers).toContain('grok');
    expect(providers.length).toBe(2);
  });

  it('should allow adding and removing providers', async () => {
    const executor = new StubProviderExecutor(['claude']);

    expect(await executor.isAvailable('grok')).toBe(false);

    executor.addProvider('grok');
    expect(await executor.isAvailable('grok')).toBe(true);

    executor.removeProvider('grok');
    expect(await executor.isAvailable('grok')).toBe(false);
  });
});

// ============================================================================
// Pattern Factory Tests
// ============================================================================

describe('Pattern Factory', () => {
  it('should return correct pattern executors', () => {
    expect(getPatternExecutor('round-robin')).toBeInstanceOf(RoundRobinPattern);
    expect(getPatternExecutor('synthesis')).toBeInstanceOf(SynthesisPattern);
    expect(getPatternExecutor('debate')).toBeInstanceOf(DebatePattern);
    expect(getPatternExecutor('critique')).toBeInstanceOf(CritiquePattern);
    expect(getPatternExecutor('voting')).toBeInstanceOf(VotingPattern);
  });

  it('should check if patterns are supported', () => {
    expect(isPatternSupported('round-robin')).toBe(true);
    expect(isPatternSupported('synthesis')).toBe(true);
    expect(isPatternSupported('debate')).toBe(true);
    expect(isPatternSupported('critique')).toBe(true);
    expect(isPatternSupported('voting')).toBe(true);
    expect(isPatternSupported('unknown' as any)).toBe(false);
  });

  it('should return all supported patterns', () => {
    const patterns = getSupportedPatterns();

    expect(patterns).toContain('round-robin');
    expect(patterns).toContain('synthesis');
    expect(patterns).toContain('debate');
    expect(patterns).toContain('critique');
    expect(patterns).toContain('voting');
    expect(patterns.length).toBe(5);
  });
});

// ============================================================================
// Consensus Factory Tests
// ============================================================================

describe('Consensus Factory', () => {
  it('should return correct consensus executors', () => {
    expect(getConsensusExecutor('synthesis')).toBeInstanceOf(SynthesisConsensus);
    expect(getConsensusExecutor('voting')).toBeInstanceOf(VotingConsensus);
    expect(getConsensusExecutor('moderator')).toBeInstanceOf(ModeratorConsensus);
  });

  it('should check if consensus methods are supported', () => {
    expect(isConsensusMethodSupported('synthesis')).toBe(true);
    expect(isConsensusMethodSupported('voting')).toBe(true);
    expect(isConsensusMethodSupported('moderator')).toBe(true);
    expect(isConsensusMethodSupported('unknown' as any)).toBe(false);
  });

  it('should return all supported consensus methods', () => {
    const methods = getSupportedConsensusMethods();

    expect(methods).toContain('synthesis');
    expect(methods).toContain('voting');
    expect(methods).toContain('moderator');
  });
});

// ============================================================================
// Prompt Template Tests
// ============================================================================

describe('Prompt Templates', () => {
  describe('interpolate', () => {
    it('should replace template variables', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const result = interpolate(template, { name: 'Alice', place: 'Wonderland' });

      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should remove unmatched variables', () => {
      const template = 'Hello {{name}}, you have {{count}} messages';
      const result = interpolate(template, { name: 'Bob' });

      expect(result).toBe('Hello Bob, you have  messages');
    });

    it('should handle empty variables', () => {
      const template = 'Value: {{value}}';
      const result = interpolate(template, { value: '' });

      expect(result).toBe('Value:');
    });
  });

  describe('formatPreviousResponses', () => {
    it('should format responses with provider names', () => {
      const responses = [
        { provider: 'claude', content: 'Claude says hello' },
        { provider: 'grok', content: 'Grok responds' },
      ];

      const result = formatPreviousResponses(responses);

      expect(result).toContain('### claude');
      expect(result).toContain('Claude says hello');
      expect(result).toContain('### grok');
      expect(result).toContain('Grok responds');
    });

    it('should include role labels when provided', () => {
      const responses = [
        { provider: 'claude', content: 'For this position', role: 'proponent' as const },
        { provider: 'grok', content: 'Against this position', role: 'opponent' as const },
      ];

      const result = formatPreviousResponses(responses);

      expect(result).toContain('(proponent)');
      expect(result).toContain('(opponent)');
    });
  });

  describe('formatVotingOptions', () => {
    it('should format options as numbered list', () => {
      const options = ['Option A', 'Option B', 'Option C'];
      const result = formatVotingOptions(options);

      expect(result).toBe('1. Option A\n2. Option B\n3. Option C');
    });
  });

  describe('formatVotes', () => {
    it('should format votes with confidence', () => {
      const votes = [
        { provider: 'claude', choice: 'Option A', confidence: 0.9 },
        { provider: 'grok', choice: 'Option B', confidence: 0.7 },
      ];

      const result = formatVotes(votes);

      expect(result).toContain('**claude**: Option A (90% confidence)');
      expect(result).toContain('**grok**: Option B (70% confidence)');
    });

    it('should include reasoning when provided', () => {
      const votes = [
        { provider: 'claude', choice: 'Option A', confidence: 0.9, reasoning: 'Best option' },
      ];

      const result = formatVotes(votes);

      expect(result).toContain('Reasoning: Best option');
    });
  });

  describe('getProviderSystemPrompt', () => {
    it('should return provider-specific prompts', () => {
      const claudePrompt = getProviderSystemPrompt('claude');
      const grokPrompt = getProviderSystemPrompt('grok');

      expect(claudePrompt).toContain('Claude');
      expect(claudePrompt).toContain('nuanced reasoning');

      expect(grokPrompt).toContain('Grok');
      expect(grokPrompt).toContain('reasoning');
    });

    it('should return generic prompt for unknown providers', () => {
      const prompt = getProviderSystemPrompt('unknown-provider');

      expect(prompt).toContain('unknown-provider');
      expect(prompt).toContain('AI assistant');
    });
  });
});

// ============================================================================
// Pattern Executor Tests
// ============================================================================

describe('Pattern Executors', () => {
  let stubExecutor: StubProviderExecutor;

  beforeEach(() => {
    stubExecutor = new StubProviderExecutor(['claude', 'grok', 'gemini'], 10);
  });

  describe('RoundRobinPattern', () => {
    it('should execute sequential round-robin discussion', async () => {
      const pattern = new RoundRobinPattern();
      const config = createDefaultDiscussStepConfig('Test topic', ['claude', 'grok']);

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(true);
      expect(result.participatingProviders).toContain('claude');
      expect(result.participatingProviders).toContain('grok');
      expect(result.rounds.length).toBeGreaterThan(0);
    });

    it('should fail when minimum providers unavailable', async () => {
      const pattern = new RoundRobinPattern();
      const config = createDefaultDiscussStepConfig('Test topic', ['claude', 'grok', 'gemini']);

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude'], // Only one available
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('providers available');
    });
  });

  describe('SynthesisPattern', () => {
    it('should execute parallel synthesis discussion', async () => {
      const pattern = new SynthesisPattern();
      const config = createDefaultDiscussStepConfig('Test topic', ['claude', 'grok']);

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(true);
      expect(result.rounds.length).toBeGreaterThan(0);
    });
  });

  describe('DebatePattern', () => {
    it('should execute debate with roles', async () => {
      const pattern = new DebatePattern();
      const config = createDebateConfig('Should we use TypeScript?', 'claude', 'grok', 'gemini');

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok', 'gemini'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(true);
      expect(result.participatingProviders).toContain('claude');
      expect(result.participatingProviders).toContain('grok');
    });

    it('should fail without role assignments', async () => {
      const pattern = new DebatePattern();
      const config: DiscussStepConfig = {
        pattern: 'debate',
        rounds: 2,
        providers: ['claude', 'grok'],
        prompt: 'Test debate',
        consensus: { method: 'synthesis', threshold: 0.5, includeDissent: true },
        providerTimeout: 60000,
        continueOnProviderFailure: true,
        minProviders: 2,
        temperature: 0.7,
        verbose: false,
        agentWeightMultiplier: 1.5,
        // Missing roles
      };

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('role');
    });
  });

  describe('CritiquePattern', () => {
    it('should execute propose-critique-revise cycle', async () => {
      const pattern = new CritiquePattern();
      // CritiquePattern needs at least 3 rounds for one critique-revision cycle
      // cycles = Math.floor((rounds - 1) / 2), so rounds=3 gives 1 cycle
      const config = {
        ...createDefaultDiscussStepConfig('Propose a solution', ['claude', 'grok', 'gemini']),
        pattern: 'critique' as const,
        rounds: 3, // Must be 3+ for critique-revision cycle
      };

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok', 'gemini'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(true);
      expect(result.rounds.length).toBeGreaterThan(0);
    });
  });

  describe('VotingPattern', () => {
    it('should execute voting with options', async () => {
      const pattern = new VotingPattern();
      const config = createVotingConfig(
        'Which framework?',
        ['React', 'Vue', 'Angular'],
        ['claude', 'grok']
      );

      const context: PatternExecutionContext = {
        config,
        providerExecutor: stubExecutor,
        availableProviders: ['claude', 'grok'],
      };

      const result = await pattern.execute(context);

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Consensus Executor Tests
// ============================================================================

describe('Consensus Executors', () => {
  let stubExecutor: StubProviderExecutor;

  beforeEach(() => {
    stubExecutor = new StubProviderExecutor(['claude', 'grok', 'gemini'], 10);
  });

  const createMockRounds = () => [
    {
      roundNumber: 1,
      responses: [
        {
          provider: 'claude',
          content: 'Claude perspective on the topic',
          round: 1,
          timestamp: new Date().toISOString(),
          durationMs: 100,
        },
        {
          provider: 'grok',
          content: 'Grok perspective on the topic',
          round: 1,
          timestamp: new Date().toISOString(),
          durationMs: 100,
        },
      ],
      durationMs: 200,
    },
  ];

  describe('SynthesisConsensus', () => {
    it('should synthesize perspectives into conclusion', async () => {
      const consensus = new SynthesisConsensus();

      const context: ConsensusExecutionContext = {
        topic: 'Test topic',
        rounds: createMockRounds(),
        participatingProviders: ['claude', 'grok'],
        config: {
          method: 'synthesis',
          threshold: 0.5,
          includeDissent: true,
          synthesizer: 'claude',
        },
        providerExecutor: stubExecutor,
      };

      const result = await consensus.execute(context);

      expect(result.success).toBe(true);
      expect(result.synthesis).toBeTruthy();
      expect(result.consensus.method).toBe('synthesis');
    });
  });

  describe('ModeratorConsensus', () => {
    it('should require synthesizer for moderation', async () => {
      const consensus = new ModeratorConsensus();

      const context: ConsensusExecutionContext = {
        topic: 'Test topic',
        rounds: createMockRounds(),
        participatingProviders: ['claude', 'grok'],
        config: {
          method: 'moderator',
          threshold: 0.5,
          includeDissent: true,
          // Missing synthesizer
        },
        providerExecutor: stubExecutor,
      };

      const result = await consensus.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('synthesizer');
    });

    it('should moderate with designated moderator', async () => {
      const consensus = new ModeratorConsensus();

      const context: ConsensusExecutionContext = {
        topic: 'Test topic',
        rounds: createMockRounds(),
        participatingProviders: ['claude', 'grok'],
        config: {
          method: 'moderator',
          threshold: 0.5,
          includeDissent: true,
          synthesizer: 'claude',
        },
        providerExecutor: stubExecutor,
      };

      const result = await consensus.execute(context);

      expect(result.success).toBe(true);
      expect(result.consensus.method).toBe('moderator');
    });
  });
});

// ============================================================================
// DiscussionExecutor Integration Tests
// ============================================================================

describe('DiscussionExecutor', () => {
  let stubExecutor: StubProviderExecutor;
  let executor: DiscussionExecutor;

  beforeEach(() => {
    stubExecutor = new StubProviderExecutor(['claude', 'grok', 'gemini'], 10);
    executor = createDiscussionExecutor(stubExecutor, { checkProviderHealth: false });
  });

  it('should execute a complete discussion', async () => {
    const config = createDefaultDiscussStepConfig('What is the best approach?', ['claude', 'grok']);

    const result = await executor.execute(config);

    expect(result.success).toBe(true);
    expect(result.pattern).toBe('synthesis');
    expect(result.synthesis).toBeTruthy();
    expect(result.participatingProviders.length).toBeGreaterThan(0);
  });

  it('should execute quick synthesis', async () => {
    const result = await executor.quickSynthesis('Quick topic discussion');

    expect(result.success).toBe(true);
    expect(result.pattern).toBe('synthesis');
  });

  it('should execute debate', async () => {
    const result = await executor.debate('Is TypeScript better than JavaScript?');

    expect(result.success).toBe(true);
    expect(result.pattern).toBe('debate');
  });

  it('should execute voting', async () => {
    const result = await executor.vote(
      'Which database to use?',
      ['PostgreSQL', 'MongoDB', 'MySQL']
    );

    expect(result.success).toBe(true);
    expect(result.pattern).toBe('voting');
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const config = createDefaultDiscussStepConfig('Test', ['claude', 'grok']);
    const result = await executor.execute(config, { abortSignal: controller.signal });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('abort');
  });

  it('should call progress callback', async () => {
    const progressEvents: any[] = [];
    const onProgress = vi.fn((event) => progressEvents.push(event));

    const config = createDefaultDiscussStepConfig('Test', ['claude', 'grok']);
    await executor.execute(config, { onProgress });

    expect(onProgress).toHaveBeenCalled();
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.some(e => e.type === 'round_start')).toBe(true);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createDiscussionExecutor', () => {
  it('should create executor with default options', () => {
    const stubExecutor = new StubProviderExecutor(['claude']);
    const executor = createDiscussionExecutor(stubExecutor);

    expect(executor).toBeInstanceOf(DiscussionExecutor);
  });

  it('should create executor with custom timeout', () => {
    const stubExecutor = new StubProviderExecutor(['claude']);
    const executor = createDiscussionExecutor(stubExecutor, {
      defaultTimeoutMs: 120000,
    });

    expect(executor).toBeInstanceOf(DiscussionExecutor);
  });
});
