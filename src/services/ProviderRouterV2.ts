/**
 * Provider Router V2 - Real Provider SDK Integration
 *
 * Sprint 3 Day 22-23: Updated to use real Claude, Gemini, and OpenAI providers
 * instead of mocks. Maintains backward compatibility with existing interface.
 */

import { EventEmitter } from 'events'
import {
  ClaudeProvider,
  GeminiProvider,
  OpenAIProvider,
  type IProvider,
  type ProviderRequest as SDKProviderRequest,
  type ProviderResponse as SDKProviderResponse,
  ProviderError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../providers/index.js'

/**
 * Supported AI providers
 */
export type ProviderType = 'claude' | 'gemini' | 'openai'

/**
 * Provider configuration (backward compatible with V1)
 */
export interface ProviderConfig {
  enabled: boolean
  priority: number
  apiKey?: string
  maxRetries: number
  timeout: number
  defaultModel?: string
  rateLimitPerMinute?: number
}

/**
 * Legacy provider request format (for backward compatibility)
 */
export interface ProviderRequest {
  model?: string
  prompt?: string
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  stopSequences?: string[]
  metadata?: Record<string, any>
}

/**
 * Provider response (backward compatible with V1)
 */
export interface ProviderResponse {
  provider: ProviderType
  model: string
  content: string
  tokensUsed: number
  latency: number
  finishReason: 'complete' | 'length' | 'stop' | 'error' | 'tool_use'
  metadata?: Record<string, any>
}

/**
 * Provider health metrics
 */
export interface ProviderHealth {
  provider: ProviderType
  available: boolean
  latency: number
  errorRate: number
  requestsInLastMinute: number
  lastError?: string
  lastSuccessAt?: Date
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedProvider: ProviderType
  reason: string
  fallbackChain: ProviderType[]
  estimatedLatency: number
}

/**
 * Provider Router Options
 */
export interface ProviderRouterOptions {
  providers: Record<ProviderType, ProviderConfig>
  chaosMode?: boolean
  telemetryEnabled?: boolean
}

/**
 * Provider Router V2
 *
 * Manages multiple AI providers with real SDK integration, automatic fallback,
 * retry logic, and SLA tracking.
 *
 * @example
 * ```typescript
 * const router = new ProviderRouterV2({
 *   providers: {
 *     claude: {
 *       enabled: true,
 *       priority: 1,
 *       apiKey: process.env.ANTHROPIC_API_KEY,
 *       maxRetries: 3,
 *       timeout: 30000
 *     },
 *     gemini: {
 *       enabled: true,
 *       priority: 2,
 *       apiKey: process.env.GOOGLE_API_KEY,
 *       maxRetries: 2,
 *       timeout: 30000
 *     }
 *   }
 * })
 *
 * const response = await router.request({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   maxTokens: 100
 * })
 * ```
 */
export class ProviderRouterV2 extends EventEmitter {
  private config: ProviderRouterOptions
  private providers: Map<ProviderType, IProvider>
  private healthMetrics: Map<ProviderType, ProviderHealth>
  private requestCounts: Map<ProviderType, number[]>
  private chaosMode: boolean

  constructor(options: ProviderRouterOptions) {
    super()
    this.config = options
    this.chaosMode = options.chaosMode ?? false
    this.healthMetrics = new Map()
    this.requestCounts = new Map()
    this.providers = new Map()

    // Initialize provider instances
    this.initializeProviders()

    // Initialize health metrics
    this.initializeHealthMetrics()
  }

  /**
   * Initialize real provider SDK instances
   */
  private initializeProviders(): void {
    const { providers: configs } = this.config

    // Initialize Claude provider
    if (configs.claude?.enabled) {
      try {
        this.providers.set(
          'claude',
          new ClaudeProvider({
            enabled: true,
            priority: configs.claude.priority,
            apiKey: configs.claude.apiKey,
            defaultModel: configs.claude.defaultModel,
            maxRetries: 0, // We handle retries at router level
            timeout: configs.claude.timeout,
          })
        )
      } catch (error) {
        console.warn('Failed to initialize Claude provider:', error)
      }
    }

    // Initialize Gemini provider
    if (configs.gemini?.enabled) {
      try {
        this.providers.set(
          'gemini',
          new GeminiProvider({
            enabled: true,
            priority: configs.gemini.priority,
            apiKey: configs.gemini.apiKey,
            defaultModel: configs.gemini.defaultModel,
            maxRetries: 0, // We handle retries at router level
            timeout: configs.gemini.timeout,
          })
        )
      } catch (error) {
        console.warn('Failed to initialize Gemini provider:', error)
      }
    }

    // Initialize OpenAI provider
    if (configs.openai?.enabled) {
      try {
        this.providers.set(
          'openai',
          new OpenAIProvider({
            enabled: true,
            priority: configs.openai.priority,
            apiKey: configs.openai.apiKey,
            defaultModel: configs.openai.defaultModel,
            maxRetries: 0, // We handle retries at router level
            timeout: configs.openai.timeout,
          })
        )
      } catch (error) {
        console.warn('Failed to initialize OpenAI provider:', error)
      }
    }
  }

  /**
   * Initialize health metrics for all enabled providers
   */
  private initializeHealthMetrics(): void {
    for (const [provider, config] of Object.entries(this.config.providers)) {
      if (config.enabled) {
        this.healthMetrics.set(provider as ProviderType, {
          provider: provider as ProviderType,
          available: true,
          latency: 0,
          errorRate: 0,
          requestsInLastMinute: 0,
          lastSuccessAt: new Date(),
        })
        this.requestCounts.set(provider as ProviderType, [])
      }
    }
  }

  /**
   * Make a request to the best available provider with automatic fallback
   */
  async request(request: ProviderRequest): Promise<ProviderResponse> {
    const decision = this.selectProvider()
    this.emit('routing-decision', decision)

    let lastError: Error | null = null

    // Try primary provider first, then fallback chain
    for (const providerType of [decision.selectedProvider, ...decision.fallbackChain]) {
      const providerConfig = this.config.providers[providerType]
      const provider = this.providers.get(providerType)

      if (!providerConfig?.enabled || !provider) {
        continue
      }

      // Try with retries
      for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
        try {
          this.emit('attempt', { provider: providerType, attempt: attempt + 1 })

          const response = await this.executeRequest(providerType, provider, request, providerConfig)

          // Update health metrics on success
          this.updateHealthMetrics(providerType, true, response.latency)
          this.emit('success', { provider: providerType, response })

          return response
        } catch (error) {
          lastError = error as Error
          this.updateHealthMetrics(providerType, false, 0, lastError.message)
          this.emit('error', { provider: providerType, attempt: attempt + 1, error: lastError })

          // Don't retry on non-retryable errors
          if (
            error instanceof ProviderAuthError ||
            (error instanceof ProviderError && !error.retryable)
          ) {
            break
          }

          // Wait before retry (exponential backoff)
          // Fixed: Cap delay at 60 seconds to prevent excessive wait times
          if (attempt < providerConfig.maxRetries - 1) {
            await this.delay(Math.min(Math.pow(2, attempt) * 1000, 60000))
          }
        }
      }
    }

    // All providers failed
    throw new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    )
  }

  /**
   * Execute request to specific provider using real SDK
   */
  private async executeRequest(
    providerType: ProviderType,
    provider: IProvider,
    request: ProviderRequest,
    config: ProviderConfig
  ): Promise<ProviderResponse> {
    // Chaos mode: randomly fail requests for testing
    if (this.chaosMode && Math.random() < 0.3) {
      throw new Error(`Chaos mode: Simulated failure for ${providerType}`)
    }

    // Convert legacy request format to SDK format
    const sdkRequest = this.convertToSDKRequest(request, config)

    // Call real provider SDK
    const sdkResponse = await provider.request(sdkRequest)

    // Convert SDK response to legacy format
    return this.convertFromSDKResponse(providerType, sdkResponse)
  }

  /**
   * Convert legacy request format to SDK provider request format
   */
  private convertToSDKRequest(
    request: ProviderRequest,
    config: ProviderConfig
  ): SDKProviderRequest {
    // Handle legacy prompt format
    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>

    if (request.messages) {
      messages = request.messages
    } else if (request.prompt) {
      // Convert legacy prompt to messages format
      messages = [{ role: 'user', content: request.prompt }]
    } else {
      throw new Error('Either messages or prompt must be provided')
    }

    return {
      model: request.model || config.defaultModel,
      messages,
      maxTokens: request.maxTokens || 4096,
      temperature: request.temperature !== undefined ? request.temperature : 1.0,
      streaming: false,
      timeout: config.timeout,
    }
  }

  /**
   * Convert SDK provider response to legacy format
   */
  private convertFromSDKResponse(
    providerType: ProviderType,
    response: SDKProviderResponse
  ): ProviderResponse {
    return {
      provider: providerType,
      model: response.model,
      content: response.content,
      tokensUsed: response.usage.totalTokens,
      latency: response.latency,
      finishReason: this.mapFinishReason(response.finishReason),
      metadata: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        provider: response.provider,
      },
    }
  }

  /**
   * Map SDK finish reason to legacy format
   */
  private mapFinishReason(
    finishReason: 'stop' | 'length' | 'tool_use' | 'error' | undefined
  ): 'complete' | 'length' | 'stop' | 'error' | 'tool_use' {
    switch (finishReason) {
      case 'stop':
        return 'complete'
      case 'length':
        return 'length'
      case 'tool_use':
        return 'tool_use'
      case 'error':
        return 'error'
      default:
        return 'complete'
    }
  }

  /**
   * Select best provider based on health metrics and priority
   */
  selectProvider(): RoutingDecision {
    const availableProviders = Array.from(this.healthMetrics.entries())
      .filter(([providerType, health]) => {
        // Check if provider is enabled, available, and initialized
        return (
          health.available &&
          this.config.providers[providerType]?.enabled &&
          this.providers.has(providerType)
        )
      })
      .sort((a, b) => {
        const configA = this.config.providers[a[0]]
        const configB = this.config.providers[b[0]]
        return (configA?.priority || 999) - (configB?.priority || 999)
      })

    if (availableProviders.length === 0) {
      throw new Error('No providers available')
    }

    const [selectedProvider] = availableProviders[0]
    const fallbackChain = availableProviders.slice(1).map(([provider]) => provider)

    return {
      selectedProvider,
      reason: `Priority-based selection (priority ${this.config.providers[selectedProvider]?.priority})`,
      fallbackChain,
      estimatedLatency: availableProviders[0][1].latency,
    }
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): Map<ProviderType, ProviderHealth> {
    return new Map(this.healthMetrics)
  }

  /**
   * Get health status for specific provider
   */
  getProviderHealth(provider: ProviderType): ProviderHealth | undefined {
    return this.healthMetrics.get(provider)
  }

  /**
   * Perform health check on all providers
   */
  async performHealthChecks(): Promise<Map<ProviderType, boolean>> {
    const results = new Map<ProviderType, boolean>()

    for (const [providerType, provider] of this.providers.entries()) {
      try {
        const health = await provider.healthCheck()
        results.set(providerType, health.available)

        // Update health metrics
        this.updateHealthMetrics(providerType, health.available, health.latency)
      } catch (error) {
        results.set(providerType, false)
        this.updateHealthMetrics(providerType, false, 0, (error as Error).message)
      }
    }

    return results
  }

  /**
   * Update health metrics for a provider
   */
  private updateHealthMetrics(
    provider: ProviderType,
    success: boolean,
    latency: number,
    error?: string
  ): void {
    const health = this.healthMetrics.get(provider)
    if (!health) return

    // Update latency (moving average)
    if (success) {
      health.latency = health.latency === 0 ? latency : (health.latency + latency) / 2
      health.lastSuccessAt = new Date()
      health.lastError = undefined
    } else {
      health.lastError = error
    }

    // Update error rate (last 100 requests)
    const now = Date.now()
    let counts = this.requestCounts.get(provider) || []

    // Remove requests older than 1 minute
    counts = counts.filter((timestamp) => now - timestamp < 60000)

    // Add current request
    counts.push(now)
    this.requestCounts.set(provider, counts)

    health.requestsInLastMinute = counts.length

    // Calculate error rate
    const recentRequests = counts.slice(-100)
    const errors = recentRequests.filter(() => !success).length
    health.errorRate = recentRequests.length > 0 ? errors / recentRequests.length : 0

    // Mark as unavailable if error rate > 50%
    health.available = health.errorRate < 0.5

    this.healthMetrics.set(provider, health)
  }

  /**
   * Delay utility for exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get routing statistics
   */
  getStatistics() {
    const stats: Record<string, any> = {}

    for (const [provider, health] of this.healthMetrics.entries()) {
      stats[provider] = {
        available: health.available,
        latency: Math.round(health.latency),
        errorRate: Math.round(health.errorRate * 100) / 100,
        requestsLastMinute: health.requestsInLastMinute,
        lastSuccess: health.lastSuccessAt?.toISOString(),
        lastError: health.lastError,
      }
    }

    return stats
  }
}

/**
 * Factory function to create a ProviderRouterV2 instance with sensible defaults
 */
export function createProviderRouter(
  options?: Partial<ProviderRouterOptions>
): ProviderRouterV2 {
  const defaultOptions: ProviderRouterOptions = {
    providers: {
      claude: {
        enabled: !!process.env.ANTHROPIC_API_KEY,
        priority: 1,
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'claude-sonnet-4-5-20250929',
      },
      gemini: {
        enabled: !!process.env.GOOGLE_API_KEY,
        priority: 2,
        apiKey: process.env.GOOGLE_API_KEY,
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'gemini-2.0-flash-exp',
      },
      openai: {
        enabled: !!process.env.OPENAI_API_KEY,
        priority: 3,
        apiKey: process.env.OPENAI_API_KEY,
        maxRetries: 3,
        timeout: 60000,
        defaultModel: 'gpt-4o',
      },
    },
    chaosMode: false,
    telemetryEnabled: true,
  }

  // Merge custom options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    providers: {
      ...defaultOptions.providers,
      ...options?.providers,
    },
  }

  return new ProviderRouterV2(mergedOptions)
}
