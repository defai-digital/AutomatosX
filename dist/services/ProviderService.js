/**
 * ProviderService.ts
 *
 * High-level service layer that integrates ProviderRouter with database logging,
 * telemetry, and the ReScript state machine.
 *
 * Phase 2 Week 3 Day 11: ProviderService Integration Layer
 */
import { v4 as uuidv4 } from 'uuid';
import { ProviderRouterV2 } from './ProviderRouterV2.js';
import { validateProviderRequest } from '../types/schemas/provider.schema.js';
import { getDatabase } from '../database/connection.js';
/**
 * ProviderService is the main entry point for AI provider interactions.
 * It orchestrates provider routing, database logging, and telemetry.
 */
export class ProviderService {
    router;
    config;
    db;
    constructor(config = {}) {
        this.config = {
            primaryProvider: config.primaryProvider || 'claude',
            fallbackChain: config.fallbackChain || ['gemini', 'openai'],
            enableFallback: config.enableFallback ?? true,
            circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
            enableLogging: config.enableLogging ?? true,
            enableTelemetry: config.enableTelemetry ?? true,
        };
        // Initialize router with ProviderRouterV2
        this.router = new ProviderRouterV2({
            providers: {
                claude: {
                    enabled: !!process.env.ANTHROPIC_API_KEY,
                    priority: 1,
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-sonnet-4-5-20250929',
                },
                gemini: {
                    enabled: !!process.env.GOOGLE_API_KEY,
                    priority: 2,
                    apiKey: process.env.GOOGLE_API_KEY,
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash-exp',
                },
                openai: {
                    enabled: !!process.env.OPENAI_API_KEY,
                    priority: 3,
                    apiKey: process.env.OPENAI_API_KEY,
                    maxRetries: 3,
                    timeout: 60000,
                    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
                },
            },
        });
        // Initialize database
        this.db = getDatabase();
    }
    /**
     * Send a request to the AI provider with full logging and telemetry
     */
    async sendRequest(request, userId) {
        // Generate request ID and complete metadata
        const requestId = uuidv4();
        const conversationId = request.metadata?.conversationId || uuidv4();
        const completeRequest = {
            provider: request.provider || this.config.primaryProvider,
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
            // Route request through provider router (V2 uses .request() method)
            const legacyRequest = {
                model: completeRequest.model,
                messages: completeRequest.messages,
                maxTokens: completeRequest.maxTokens,
                temperature: completeRequest.temperature,
                stopSequences: completeRequest.stopSequences,
                metadata: completeRequest.metadata,
            };
            const routerResponse = await this.router.request(legacyRequest);
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Convert ProviderRouterV2 response format to schema format
            const response = {
                provider: routerResponse.provider,
                model: routerResponse.model,
                content: routerResponse.content,
                tokens: {
                    input: routerResponse.tokensUsed, // Approximation
                    output: 0, // Not available in V2 response
                    total: routerResponse.tokensUsed,
                },
                duration: routerResponse.latency,
                finishReason: routerResponse.finishReason === 'complete' ? 'stop' :
                    routerResponse.finishReason === 'tool_use' ? undefined :
                        routerResponse.finishReason,
            };
            // Log successful response
            if (this.config.enableLogging) {
                await this.logRequestSuccess(completeRequest, response, duration, userId);
            }
            // Record telemetry
            if (this.config.enableTelemetry) {
                await this.recordTelemetry(completeRequest, response, duration);
            }
            return response;
        }
        catch (error) {
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
    async sendStreamingRequest(request, options = {}, userId) {
        // Generate request ID
        const requestId = uuidv4();
        const conversationId = request.metadata?.conversationId || uuidv4();
        const completeRequest = {
            ...request,
            provider: request.provider || this.config.primaryProvider,
            model: request.model || 'default',
            messages: request.messages || [],
            stream: true,
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
            // Wrap callbacks to track chunks
            let chunksReceived = 0;
            const wrappedOptions = {
                onChunk: (chunk) => {
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
                onError: (error) => {
                    if (options.onError) {
                        options.onError(error);
                    }
                },
            };
            // Route streaming request (V2 uses .request() method)
            const legacyRequest = {
                model: completeRequest.model,
                messages: completeRequest.messages,
                maxTokens: completeRequest.maxTokens,
                temperature: completeRequest.temperature,
                stopSequences: completeRequest.stopSequences,
                metadata: completeRequest.metadata,
            };
            const routerResponse = await this.router.request(legacyRequest);
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Convert ProviderRouterV2 response format to schema format
            const response = {
                provider: routerResponse.provider,
                model: routerResponse.model,
                content: routerResponse.content,
                tokens: {
                    input: routerResponse.tokensUsed, // Approximation
                    output: 0, // Not available in V2 response
                    total: routerResponse.tokensUsed,
                },
                duration: routerResponse.latency,
                finishReason: routerResponse.finishReason === 'complete' ? 'stop' :
                    routerResponse.finishReason === 'tool_use' ? undefined :
                        routerResponse.finishReason,
            };
            // Log successful streaming response
            if (this.config.enableLogging) {
                await this.logRequestSuccess(completeRequest, response, duration, userId, chunksReceived);
            }
            // Record telemetry
            if (this.config.enableTelemetry) {
                await this.recordTelemetry(completeRequest, response, duration, chunksReceived);
            }
            return response;
        }
        catch (error) {
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
    async logRequestStart(request, userId) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO provider_logs (
          id, request_id, conversation_id, user_id, provider, model,
          state, request_data, start_time, retry_attempt, tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(uuidv4(), request.metadata.requestId, request.metadata.conversationId, userId || null, request.provider, request.model, 'requesting', JSON.stringify(request), Date.now(), 0, JSON.stringify(request.metadata.tags), Date.now());
        }
        catch (error) {
            console.error('Failed to log request start:', error);
        }
    }
    /**
     * Log successful request to database
     */
    async logRequestSuccess(request, response, duration, userId, chunksReceived) {
        try {
            // Update provider_logs
            const updateStmt = this.db.prepare(`
        UPDATE provider_logs
        SET state = ?, response_data = ?, end_time = ?, duration = ?, updated_at = ?
        WHERE request_id = ?
      `);
            updateStmt.run('completed', JSON.stringify(response), Date.now(), duration, Date.now(), request.metadata.requestId);
            // Insert provider_metrics
            const metricsStmt = this.db.prepare(`
        INSERT INTO provider_metrics (
          id, request_id, provider, model, input_tokens, output_tokens,
          total_tokens, total_duration, chunks_received, retry_count,
          is_fallback, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            metricsStmt.run(uuidv4(), request.metadata.requestId, response.provider, response.model, response.tokens.input, response.tokens.output, response.tokens.total, duration, chunksReceived || 0, 0, request.provider !== response.provider ? 1 : 0, 1, Date.now());
        }
        catch (error) {
            console.error('Failed to log request success:', error);
        }
    }
    /**
     * Log failed request to database
     */
    async logRequestFailure(request, error, duration, userId) {
        try {
            const updateStmt = this.db.prepare(`
        UPDATE provider_logs
        SET state = ?, error_message = ?, error_code = ?, end_time = ?, duration = ?, updated_at = ?
        WHERE request_id = ?
      `);
            updateStmt.run('failed', error.message || String(error), error.code || 'unknown_error', Date.now(), duration, Date.now(), request.metadata.requestId);
            // Insert failure metrics
            const metricsStmt = this.db.prepare(`
        INSERT INTO provider_metrics (
          id, request_id, provider, model, input_tokens, output_tokens,
          total_tokens, total_duration, success, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            metricsStmt.run(uuidv4(), request.metadata.requestId, request.provider, request.model, 0, 0, 0, duration, 0, Date.now());
        }
        catch (dbError) {
            console.error('Failed to log request failure:', dbError);
        }
    }
    /**
     * Record telemetry data
     */
    async recordTelemetry(request, response, duration, chunksReceived) {
        try {
            const telemetryStmt = this.db.prepare(`
        INSERT INTO telemetry (
          id, event_type, timestamp, duration, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
            telemetryStmt.run(uuidv4(), 'provider_request', Date.now(), duration, JSON.stringify({
                provider: response.provider,
                model: response.model,
                tokens: response.tokens,
                chunks: chunksReceived || 0,
                streaming: request.stream,
                fallback: request.provider !== response.provider,
            }), Date.now());
        }
        catch (error) {
            console.error('Failed to record telemetry:', error);
        }
    }
    /**
     * Get provider health status
     */
    async getProviderHealth() {
        const healthChecks = await this.router.performHealthChecks();
        return healthChecks;
    }
    /**
     * Get provider statistics
     */
    getProviderStatistics() {
        return this.router.getStatistics();
    }
    /**
     * Get provider statistics from database
     */
    async getProviderStats(timeRangeMs = 24 * 60 * 60 * 1000) {
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
    async getRecentLogs(limit = 50) {
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
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Note: ProviderRouterV2 doesn't support runtime config updates
        // Would need to recreate router instance
    }
    /**
     * Get circuit breaker states (compatibility method)
     */
    getCircuitBreakerStates() {
        // Return empty object for now - circuit breaker is managed by ProviderRouterV2
        return {};
    }
    /**
     * Reset circuit breaker for a provider (compatibility method)
     */
    resetCircuitBreaker(providerName) {
        // No-op for now - circuit breaker is managed by ProviderRouterV2
        console.log(`Circuit breaker reset requested for ${providerName}`);
    }
}
//# sourceMappingURL=ProviderService.js.map