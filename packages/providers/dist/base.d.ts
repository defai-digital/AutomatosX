import { ProviderType, IntegrationMode, ProviderConfig, ProviderHealth, ExecutionRequest, ExecutionResponse } from '@ax/schemas';

/**
 * Base Provider - Abstract provider interface
 *
 * All providers must extend this base class and implement
 * the required abstract methods.
 *
 * @module @ax/providers/base
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/** Default execution timeout in milliseconds (5 minutes) */
declare const DEFAULT_EXECUTION_TIMEOUT_MS = 300000;

interface ProviderEvents {
    onHealthChange?: (health: ProviderHealth) => void;
    onExecutionStart?: (request: ExecutionRequest) => void;
    onExecutionEnd?: (response: ExecutionResponse) => void;
    onError?: (error: Error) => void;
}
declare abstract class BaseProvider {
    /** Provider type identifier */
    abstract readonly id: ProviderType;
    /** Human-readable provider name */
    abstract readonly name: string;
    /** Integration mode (mcp, sdk, bash) */
    abstract readonly integrationMode: IntegrationMode;
    /** Provider configuration */
    protected config: ProviderConfig | null;
    /** Event handlers */
    protected events: ProviderEvents;
    /** Current health status */
    protected health: ProviderHealth;
    /** Request history for success rate calculation */
    private requestHistory;
    private readonly historySize;
    /** Circuit breaker recovery timeout ID */
    private recoveryTimeoutId;
    /**
     * Execute a task using this provider
     * Must be implemented by concrete providers
     */
    abstract execute(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Check if provider is healthy and available
     * Must be implemented by concrete providers
     */
    abstract checkHealth(): Promise<boolean>;
    /**
     * Initialize provider (optional)
     * Override in concrete providers if initialization is needed
     */
    initialize(config?: ProviderConfig): Promise<void>;
    /**
     * Cleanup provider resources (optional)
     * Override in concrete providers if cleanup is needed
     */
    cleanup(): Promise<void>;
    /**
     * Get current health status
     */
    getHealth(): ProviderHealth;
    /**
     * Check if provider is currently healthy
     */
    isHealthy(): boolean;
    /**
     * Get provider configuration
     */
    getConfig(): ProviderConfig | null;
    /**
     * Set event handlers
     */
    setEvents(events: ProviderEvents): void;
    /**
     * Execute with automatic health tracking, circuit breaker, and timeout
     */
    executeWithTracking(request: ExecutionRequest): Promise<ExecutionResponse>;
    /**
     * Update health status after an operation
     */
    protected updateHealth(success: boolean, latencyMs: number): void;
    /**
     * Extract output from MCP tool result
     * Shared by all MCP-based providers (Claude, Gemini)
     */
    protected extractMcpOutput(result: unknown): string;
    /**
     * Create a standardized error response
     */
    protected createErrorResponse(request: ExecutionRequest, code: string, message: string, retryable: boolean): ExecutionResponse;
    /**
     * Create a successful response
     */
    protected createSuccessResponse(output: string, duration: number, tokens?: {
        input?: number;
        output?: number;
        total?: number;
    }): ExecutionResponse;
    /**
     * Reset health to default state
     */
    protected resetHealth(): void;
}

export { BaseProvider, DEFAULT_EXECUTION_TIMEOUT_MS, type ProviderEvents };
