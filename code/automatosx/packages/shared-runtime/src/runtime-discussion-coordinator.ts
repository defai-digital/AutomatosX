import type {
  ProviderExecutionOutcome,
  ProviderExecutionRequest,
} from './provider-bridge.js';

interface ProviderBridgeLike {
  executePrompt(request: ProviderExecutionRequest): Promise<ProviderExecutionOutcome>;
}

export interface DiscussionCoordinator {
  run(request: {
    traceId: string;
    provider?: string;
    config: {
      pattern: string;
      rounds: number;
      providers: string[];
      prompt: string;
      providerPrompts?: Record<string, string>;
      roles?: Record<string, string>;
      consensus: {
        method: string;
        threshold?: number;
        synthesizer?: string;
        includeDissent?: boolean;
      };
      providerTimeout: number;
      continueOnProviderFailure: boolean;
      minProviders: number;
      temperature: number;
      context?: string;
      verbose: boolean;
    };
  }): Promise<{
    success: boolean;
    pattern: string;
    topic: string;
    participatingProviders: string[];
    failedProviders: string[];
    rounds: Array<{
      roundNumber: number;
      responses: Array<{
        provider: string;
        content: string;
        round: number;
        timestamp: string;
        durationMs: number;
      }>;
      durationMs: number;
    }>;
    synthesis: string;
    consensus: {
      method: string;
      winner?: string;
      votes?: Record<string, number>;
      confidence?: number;
      dissent?: string[];
    };
    totalDurationMs: number;
    metadata: {
      startedAt: string;
      completedAt: string;
      traceId: string;
      queueDepth: number;
      providerBudget: number;
      roundsExecuted: number;
      executionMode?: 'simulated' | 'subprocess' | 'mixed';
    };
    error?: {
      code: string;
      message: string;
    };
  }>;
}

export interface DiscussionCoordinatorConfig {
  maxConcurrentDiscussions: number;
  maxProvidersPerDiscussion: number;
  maxDiscussionRounds: number;
  providerBridge: ProviderBridgeLike;
}

export function createDiscussionCoordinator(
  config: DiscussionCoordinatorConfig,
): DiscussionCoordinator {
  let active = 0;
  const queue: Array<() => void> = [];

  return {
    async run(request) {
      const queueDepth = await acquire();
      const startedAt = new Date().toISOString();
      const startedAtMs = Date.now();

      try {
        await yieldToEventLoop(); // hold the acquired slot briefly so concurrent callers can queue
        const uniqueProviders = Array.from(new Set(request.config.providers.filter((entry) => entry.trim().length > 0)));
        const providerBudget = Math.min(config.maxProvidersPerDiscussion, uniqueProviders.length);
        let participatingProviders = uniqueProviders.slice(0, providerBudget);
        const failedProviders = uniqueProviders.slice(providerBudget);
        const roundsExecuted = clampRounds(request.config.rounds, config.maxDiscussionRounds);

        if (participatingProviders.length < Math.max(1, request.config.minProviders)) {
          return {
            success: false,
            pattern: request.config.pattern,
            topic: request.config.prompt,
            participatingProviders,
            failedProviders,
            rounds: [],
            synthesis: '',
            consensus: {
              method: request.config.consensus.method,
            },
            totalDurationMs: Date.now() - startedAtMs,
            metadata: {
              startedAt,
              completedAt: new Date().toISOString(),
              traceId: request.traceId,
              queueDepth,
              providerBudget,
              roundsExecuted: 0,
            },
            error: {
              code: 'DISCUSSION_PROVIDER_BUDGET_EXCEEDED',
              message: `Discussion requires ${request.config.minProviders} providers but only ${participatingProviders.length} are available within the configured budget`,
            },
          };
        }

        const rounds = [];
        const roundSummaries: string[] = [];
        let usedRealProvider = false;

        for (let index = 0; index < roundsExecuted; index += 1) {
          const roundNumber = index + 1;
          const roundStartedAt = Date.now();
          const providerResponses = await Promise.all(participatingProviders.map(async (entry) => {
            const prompt = buildDiscussionProviderPrompt(
              request.config.prompt,
              request.config.context,
              request.config.pattern,
              roundNumber,
              roundSummaries,
              request.config.providerPrompts?.[entry],
            );
            const bridgeResult = await config.providerBridge.executePrompt({
              provider: entry,
              prompt,
              temperature: request.config.temperature,
              timeoutMs: request.config.providerTimeout > 0 ? request.config.providerTimeout : undefined,
            });

            if (bridgeResult.type === 'response' && bridgeResult.response.success) {
              usedRealProvider = true;
              return {
                provider: entry,
                content: bridgeResult.response.content ?? '',
                round: roundNumber,
                timestamp: new Date().toISOString(),
                durationMs: bridgeResult.response.latencyMs,
                tokenCount: bridgeResult.response.usage?.totalTokens,
              };
            }

            if (bridgeResult.type === 'failure') {
              return {
                provider: entry,
                content: '',
                round: roundNumber,
                timestamp: new Date().toISOString(),
                durationMs: bridgeResult.response.latencyMs,
                error: bridgeResult.response.error ?? 'Provider execution failed',
              };
            }

            return {
              provider: entry,
              content: `Simulated discussion response from ${entry} in round ${roundNumber}`,
              round: roundNumber,
              timestamp: new Date().toISOString(),
              durationMs: 0,
            };
          }));

          const successfulProviders = providerResponses
            .filter((response) => response.error === undefined)
            .map((response) => response.provider);
          if (successfulProviders.length < Math.max(1, request.config.minProviders)) {
            return {
              success: false,
              pattern: request.config.pattern,
              topic: request.config.prompt,
              participatingProviders: successfulProviders,
              failedProviders: Array.from(new Set([
                ...failedProviders,
                ...providerResponses
                  .filter((response) => response.error !== undefined)
                  .map((response) => response.provider),
              ])),
              rounds,
              synthesis: roundSummaries.join('\n\n'),
              consensus: {
                method: request.config.consensus.method,
              },
              totalDurationMs: Date.now() - startedAtMs,
              metadata: {
                startedAt,
                completedAt: new Date().toISOString(),
                traceId: request.traceId,
                queueDepth,
                providerBudget,
                roundsExecuted: rounds.length,
                executionMode: usedRealProvider ? 'mixed' : 'simulated',
              },
              error: {
                code: 'DISCUSSION_PROVIDER_EXECUTION_FAILED',
                message: `Discussion dropped below the minimum provider threshold during round ${roundNumber}.`,
              },
            };
          }

          participatingProviders = successfulProviders;
          roundSummaries.push(
            `Round ${roundNumber}\n${providerResponses.map((response) => `${response.provider}: ${response.content || response.error || 'no output'}`).join('\n')}`,
          );
          rounds.push({
            roundNumber,
            responses: providerResponses,
            durationMs: Date.now() - roundStartedAt,
          });
        }

        return {
          success: true,
          pattern: request.config.pattern,
          topic: request.config.prompt,
          participatingProviders,
          failedProviders,
          rounds,
          synthesis: [request.config.prompt, request.config.context].filter((value): value is string => typeof value === 'string' && value.length > 0).join('\n'),
          consensus: {
            method: request.config.consensus.method,
            winner: participatingProviders[0] ?? request.provider ?? 'claude',
            votes: Object.fromEntries(participatingProviders.map((entry) => [entry, 1])),
            confidence: 1,
          },
          totalDurationMs: Date.now() - startedAtMs,
          metadata: {
            startedAt,
            completedAt: new Date().toISOString(),
            traceId: request.traceId,
            queueDepth,
            providerBudget,
            roundsExecuted,
            executionMode: usedRealProvider ? 'subprocess' : 'simulated',
          },
        };
      } finally {
        release();
      }
    },
  };

  function acquire(): Promise<number> {
    if (active < config.maxConcurrentDiscussions) {
      active += 1;
      return Promise.resolve(0);
    }

    return new Promise<number>((resolve) => {
      const depth = queue.length + 1;
      queue.push(() => {
        active += 1;
        resolve(depth);
      });
    });
  }

  function release(): void {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next !== undefined) {
      next();
    }
  }
}

function buildDiscussionProviderPrompt(
  topic: string,
  context: string | undefined,
  pattern: string,
  round: number,
  roundSummaries: string[],
  providerPrompt: string | undefined,
): string {
  if (providerPrompt !== undefined && providerPrompt.trim().length > 0) {
    return providerPrompt;
  }

  return [
    `Discussion pattern: ${pattern}`,
    `Round: ${round}`,
    `Topic: ${topic}`,
    context ? `Context:\n${context}` : undefined,
    roundSummaries.length > 0 ? `Previous rounds:\n${roundSummaries.join('\n\n')}` : undefined,
  ].filter((value): value is string => value !== undefined).join('\n\n');
}

function clampRounds(rounds: number, maxDiscussionRounds: number): number {
  if (!Number.isFinite(rounds) || rounds < 1) {
    return 1;
  }
  return Math.min(Math.floor(rounds), maxDiscussionRounds);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}
