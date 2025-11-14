/**
 * ProviderService.ts
 *
 * High-level service layer that integrates ProviderRouter with database logging,
 * telemetry, and the ReScript state machine.
 *
 * Phase 2 Week 3 Day 11: ProviderService Integration Layer
 */

import { v4 as uuidv4 } from 'uuid';
import { ProviderRouter } from '../../packages/rescript-core/src/providers/ProviderRouter.js';
import { ClaudeProvider } from '../../packages/rescript-core/src/providers/ClaudeProvider.js';
import { GeminiProvider } from '../../packages/rescript-core/src/providers/GeminiProvider.js';
import { OpenAIProvider } from '../../packages/rescript-core/src/providers/OpenAIProvider.js';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderType,
  StreamChunk,
} from '../types/schemas/provider.schema.js';
import { validateProviderRequest } from '../types/schemas/provider.schema.js';
import { getDatabase } from '../database/connection.js';

export interface ProviderServiceConfig {
  primaryProvider?: ProviderType;
  fallbackChain?: ProviderType[];
  enableFallback?: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  enableLogging?: boolean;
  enableTelemetry?: boolean;
}

export interface StreamingOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * ProviderService is the main entry point for AI provider interactions.
 * It orchestrates provider routing, database logging, and telemetry.
 */
export class ProviderService {
  private router: ProviderRouter;
  private config: ProviderServiceConfig;
  private db: any;

  constructor(config: ProviderServiceConfig = {}) {
    this.config = {
      primaryProvider: config.primaryProvider || 'claude',
      fallbackChain: config.fallbackChain || ['gemini', 'openai'],
      enableFallback: config.enableFallback ?? true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      enableLogging: config.enableLogging ?? true,
      enableTelemetry: config.enableTelemetry ?? true,
    };

    // Initialize router
    this.router = new ProviderRouter({
      primaryProvider: this.config.primaryProvider!,
      fallbackChain: this.config.fallbackChain!,
      enableFallback: this.config.enableFallback,
      circuitBreakerThreshold: this.config.circuitBreakerThreshold,
      circuitBreakerTimeout: this.config.circuitBreakerTimeout,
    });

    // Initialize database
    this.db = getDatabase();

    // Register providers with API keys from environment
    this.initializeProviders();
  }

  /**
   * Initialize and register all providers
   */
  private initializeProviders(): void {
    // Claude
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;
    if (claudeApiKey) {
      const claudeProvider = new ClaudeProvider({
        apiKey: claudeApiKey,
        defaultModel: process.env.CLAUDE_DEFAULT_MODEL,
      });
      this.router.registerProvider(claudeProvider);
    }

    // Gemini
    const geminiApiKey = process.env.GOOGLE_API_KEY;
    if (geminiApiKey) {
      const geminiProvider = new GeminiProvider({
        apiKey: geminiApiKey,
        defaultModel: process.env.GEMINI_DEFAULT_MODEL,
      });
      this.router.registerProvider(geminiProvider);
    }

    // OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      const openaiProvider = new OpenAIProvider({
        apiKey: openaiApiKey,
        defaultModel: process.env.OPENAI_DEFAULT_MODEL,
        organization: process.env.OPENAI_ORGANIZATION,
      });
      this.router.registerProvider(openaiProvider);
    }
  }

  /**
   * Send a request to the AI provider with full logging and telemetry
   */
  async sendRequest(
    request: Partial<ProviderRequest>,
    userId?: string
  ): Promise<ProviderResponse> {
    // Generate request ID and complete metadata
    const requestId = uuidv4();
    const conversationId = request.metadata?.conversationId || uuidv4();

    const completeRequest: ProviderRequest = {
      provider: request.provider || this.config.primaryProvider!,
      model: request.model || 'default',
      messages: request.messages || [],
      stream: request.stream || false,
      temperature: request.temperature,
      topP: request.topP,
      topK: request.topK,
      maxTokens: request.maxTokens,
      stopSequences: request.stopSequences,
      metadata: {
        requestId,
        conversationId,
        userId,
        tags: request.metadata?.tags || [],
      },
    };

    // Validate request
    validateProviderRequest(completeRequest);

    // Log request start
    if (this.config.enableLogging) {
      await this.logRequestStart(completeRequest, userId);
    }

    const startTime = Date.now();

    try {
      // Route request through provider router
      const response = await this.router.routeRequest(completeRequest);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log successful response
      if (this.config.enableLogging) {
        await this.logRequestSuccess(
          completeRequest,
          response,
          duration,
          userId
        );
      }

      // Record telemetry
      if (this.config.enableTelemetry) {
        await this.recordTelemetry(completeRequest, response, duration);
      }

      return response;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log failure
      if (this.config.enableLogging) {
        await this.logRequestFailure(completeRequest, error, duration, userId);
      }

      throw error;
    }
  }

  /**
   * Send a streaming request with logging
   */
  async sendStreamingRequest(
    request: Partial<ProviderRequest>,
    options: StreamingOptions = {},
    userId?: string
  ): Promise<ProviderResponse> {
    // Generate request ID
    const requestId = uuidv4();
    const conversationId = request.metadata?.conversationId || uuidv4();

    const completeRequest: ProviderRequest = {
      ...request,
      provider: request.provider || this.config.primaryProvider!,
      model: request.model || 'default',
      messages: request.messages || [],
      stream: true,
      metadata: {
        requestId,
        conversationId,
        userId,
        tags: request.metadata?.tags || [],
      },
    } as ProviderRequest;

    // Validate request
    validateProviderRequest(completeRequest);

    // Log request start
    if (this.config.enableLogging) {
      await this.logRequestStart(completeRequest, userId);
    }

    const startTime = Date.now();

    try {
      // Wrap callbacks to track chunks
      let chunksReceived = 0;
      const wrappedOptions = {
        onChunk: (chunk: StreamChunk) => {
          chunksReceived++;
          if (options.onChunk) {
            options.onChunk(chunk);
          }
        },
        onComplete: () => {
          if (options.onComplete) {
            options.onComplete();
          }
        },
        onError: (error: any) => {
          if (options.onError) {
            options.onError(error);
          }
        },
      };

      // Route streaming request
      const response = await this.router.routeRequest(completeRequest);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log successful streaming response
      if (this.config.enableLogging) {
        await this.logRequestSuccess(
          completeRequest,
          response,
          duration,
          userId,
          chunksReceived
        );
      }

      // Record telemetry
      if (this.config.enableTelemetry) {
        await this.recordTelemetry(
          completeRequest,
          response,
          duration,
          chunksReceived
        );
      }

      return response;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log failure
      if (this.config.enableLogging) {
        await this.logRequestFailure(completeRequest, error, duration, userId);
      }

      throw error;
    }
  }

  /**
   * Log request start to database
   */
  private async logRequestStart(
    request: ProviderRequest,
    userId?: string
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO provider_logs (
          id, request_id, conversation_id, user_id, provider, model,
          state, request_data, start_time, retry_attempt, tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        uuidv4(),
        request.metadata.requestId,
        request.metadata.conversationId,
        userId || null,
        request.provider,
        request.model,
        'requesting',
        JSON.stringify(request),
        Date.now(),
        0,
        JSON.stringify(request.metadata.tags),
        Date.now()
      );
    } catch (error) {
      console.error('Failed to log request start:', error);
    }
  }

  /**
   * Log successful request to database
   */
  private async logRequestSuccess(
    request: ProviderRequest,
    response: ProviderResponse,
    duration: number,
    userId?: string,
    chunksReceived?: number
  ): Promise<void> {
    try {
      // Update provider_logs
      const updateStmt = this.db.prepare(`
        UPDATE provider_logs
        SET state = ?, response_data = ?, end_time = ?, duration = ?, updated_at = ?
        WHERE request_id = ?
      `);

      updateStmt.run(
        'completed',
        JSON.stringify(response),
        Date.now(),
        duration,
        Date.now(),
        request.metadata.requestId
      );

      // Insert provider_metrics
      const metricsStmt = this.db.prepare(`
        INSERT INTO provider_metrics (
          id, request_id, provider, model, input_tokens, output_tokens,
          total_tokens, total_duration, chunks_received, retry_count,
          is_fallback, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      metricsStmt.run(
        uuidv4(),
        request.metadata.requestId,
        response.provider,
        response.model,
        response.tokens.input,
        response.tokens.output,
        response.tokens.total,
        duration,
        chunksReceived || 0,
        0,
        request.provider !== response.provider ? 1 : 0,
        1,
        Date.now()
      );
    } catch (error) {
      console.error('Failed to log request success:', error);
    }
  }

  /**
   * Log failed request to database
   */
  private async logRequestFailure(
    request: ProviderRequest,
    error: any,
    duration: number,
    userId?: string
  ): Promise<void> {
    try {
      const updateStmt = this.db.prepare(`
        UPDATE provider_logs
        SET state = ?, error_message = ?, error_code = ?, end_time = ?, duration = ?, updated_at = ?
        WHERE request_id = ?
      `);

      updateStmt.run(
        'failed',
        error.message || String(error),
        error.code || 'unknown_error',
        Date.now(),
        duration,
        Date.now(),
        request.metadata.requestId
      );

      // Insert failure metrics
      const metricsStmt = this.db.prepare(`
        INSERT INTO provider_metrics (
          id, request_id, provider, model, input_tokens, output_tokens,
          total_tokens, total_duration, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      metricsStmt.run(
        uuidv4(),
        request.metadata.requestId,
        request.provider,
        request.model,
        0,
        0,
        0,
        duration,
        0,
        Date.now()
      );
    } catch (dbError) {
      console.error('Failed to log request failure:', dbError);
    }
  }

  /**
   * Record telemetry data
   */
  private async recordTelemetry(
    request: ProviderRequest,
    response: ProviderResponse,
    duration: number,
    chunksReceived?: number
  ): Promise<void> {
    try {
      const telemetryStmt = this.db.prepare(`
        INSERT INTO telemetry (
          id, event_type, timestamp, duration, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      telemetryStmt.run(
        uuidv4(),
        'provider_request',
        Date.now(),
        duration,
        JSON.stringify({
          provider: response.provider,
          model: response.model,
          tokens: response.tokens,
          chunks: chunksReceived || 0,
          streaming: request.stream,
          fallback: request.provider !== response.provider,
        }),
        Date.now()
      );
    } catch (error) {
      console.error('Failed to record telemetry:', error);
    }
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(): Promise<Map<ProviderType, boolean>> {
    return this.router.getProviderHealthStatus();
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates() {
    return this.router.getCircuitBreakerStates();
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(provider: ProviderType): void {
    this.router.resetCircuitBreaker(provider);
  }

  /**
   * Get provider statistics from database
   */
  async getProviderStats(timeRangeMs: number = 24 * 60 * 60 * 1000): Promise<any> {
    const sinceTimestamp = Date.now() - timeRangeMs;

    const stmt = this.db.prepare(`
      SELECT
        provider,
        model,
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        AVG(total_duration) as avg_duration,
        SUM(total_tokens) as total_tokens,
        AVG(input_tokens) as avg_input_tokens,
        AVG(output_tokens) as avg_output_tokens
      FROM provider_metrics
      WHERE created_at >= ?
      GROUP BY provider, model
    `);

    return stmt.all(sinceTimestamp);
  }

  /**
   * Get recent provider logs
   */
  async getRecentLogs(limit: number = 50): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM provider_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<ProviderServiceConfig>): void {
    this.config = { ...this.config, ...config };

    // Update router config if routing params changed
    if (
      config.primaryProvider ||
      config.fallbackChain ||
      config.enableFallback ||
      config.circuitBreakerThreshold ||
      config.circuitBreakerTimeout
    ) {
      this.router.updateConfig({
        primaryProvider: config.primaryProvider,
        fallbackChain: config.fallbackChain,
        enableFallback: config.enableFallback,
        circuitBreakerThreshold: config.circuitBreakerThreshold,
        circuitBreakerTimeout: config.circuitBreakerTimeout,
      });
    }
  }
}
