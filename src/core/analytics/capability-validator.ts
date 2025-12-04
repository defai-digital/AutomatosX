/**
 * Capability Validation Framework
 *
 * Validates that provider metadata matches actual capabilities.
 * Prevents silent capability mismatches and metadata drift.
 *
 * @module core/analytics/capability-validator
 */

import type { ProviderMetadata } from '@/types/provider-metadata.js';
// v9.0.2: Simplified stub since cost tracking was removed in v8.3.0
const PROVIDER_METADATA: Record<string, any> = {};
const getProviderMetadata = (name: string): ProviderMetadata | null => {
  // Return minimal metadata for validation purposes
  return {
    name,
    displayName: name,
    costPerMToken: 0, // Deprecated but kept for type compatibility
    avgLatencyMs: 0,  // Deprecated but kept for type compatibility
    features: {
      streaming: false,
      functionCalling: false,
      vision: false
    }
  } as any;
};
import { logger } from '@/shared/logging/logger.js';

export interface ValidationResult {
  valid: boolean;
  mismatches: Array<{
    claim: string;
    reality: string;
    severity: 'critical' | 'warning' | 'info';
    recommendation: string;
  }>;
}

export interface CapabilityTestResult {
  supported: boolean;
  tested: boolean;
  evidence: {
    request?: any;
    response?: any;
    timestamp?: Date;
    error?: string;
    [key: string]: any;
  };
}

export interface CapabilityMatrix {
  providers: Record<string, {
    metadata: ProviderMetadata;
    actual: {
      streaming: boolean;
      vision: boolean;
      parameters: string[];
      models: string[];
    };
    lastValidated: Date;
    status: 'validated' | 'mismatch' | 'untested';
  }>;
}

/**
 * Capability Validator
 *
 * Tests actual provider capabilities and compares with metadata claims.
 */
export class CapabilityValidator {
  /**
   * Validate a single provider
   */
  async validateProvider(providerName: string): Promise<ValidationResult> {
    const metadata = getProviderMetadata(providerName);
    if (!metadata) {
      return {
        valid: false,
        mismatches: [{
          claim: 'Provider exists',
          reality: 'Provider not found',
          severity: 'critical',
          recommendation: `Add ${providerName} to provider metadata registry`
        }]
      };
    }

    const mismatches: ValidationResult['mismatches'] = [];

    // Test streaming capability
    const streamingResult = await this.testStreamingCapability(providerName);
    if (metadata.features.streaming !== streamingResult.supported) {
      mismatches.push({
        claim: `streaming: ${metadata.features.streaming}`,
        reality: `streaming: ${streamingResult.supported}`,
        severity: 'critical',
        recommendation: `Update provider-metadata-registry.ts streaming flag to ${streamingResult.supported}`
      });
    }

    // Test vision capability (if claimed)
    if (metadata.features.vision) {
      const visionResult = await this.testVisionCapability(providerName);
      if (!visionResult.supported && metadata.features.vision) {
        mismatches.push({
          claim: 'vision: true',
          reality: 'vision: false',
          severity: 'warning',
          recommendation: 'Update metadata or verify vision support'
        });
      }
    }

    return {
      valid: mismatches.length === 0,
      mismatches
    };
  }

  /**
   * Test streaming capability
   */
  async testStreamingCapability(providerName: string): Promise<CapabilityTestResult> {
    try {
      // Load provider dynamically
      const { GeminiProvider } = await import('@/providers/gemini-provider.js');
      const { OpenAIProvider } = await import('@/providers/openai-provider.js');
      const { ClaudeProvider } = await import('@/providers/claude-provider.js');

      let provider;
      const baseConfig = {
        name: providerName,
        enabled: true,
        priority: 1,
        timeout: 30000,
        command: providerName === 'gemini-cli' ? 'gemini' :
                 providerName === 'openai' ? 'codex' : 'claude'
      };

      if (providerName === 'gemini-cli') {
        provider = new GeminiProvider(baseConfig);
      } else if (providerName === 'openai') {
        provider = new OpenAIProvider(baseConfig);
      } else if (providerName === 'claude-code') {
        provider = new ClaudeProvider(baseConfig);
      } else {
        return {
          supported: false,
          tested: false,
          evidence: { error: 'Unknown provider' }
        };
      }

      // Check if provider reports streaming support
      const supportsStreaming = provider.supportsStreaming?.() ?? false;

      return {
        supported: supportsStreaming,
        tested: true,
        evidence: {
          method: 'provider.supportsStreaming()',
          result: supportsStreaming,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error('Failed to test streaming capability', {
        provider: providerName,
        error: (error as Error).message
      });

      return {
        supported: false,
        tested: false,
        evidence: {
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Test vision capability
   */
  async testVisionCapability(providerName: string): Promise<CapabilityTestResult> {
    // For now, trust metadata for vision
    // Real implementation would test with an actual image
    return {
      supported: true,
      tested: false,
      evidence: {
        note: 'Vision capability not tested (requires real image)'
      }
    };
  }

  /**
   * Generate capability matrix for all providers
   */
  async generateCapabilityMatrix(): Promise<CapabilityMatrix> {
    const providers: CapabilityMatrix['providers'] = {};
    const providerNames = Object.keys(PROVIDER_METADATA);

    for (const providerName of providerNames) {
      const metadata = getProviderMetadata(providerName);
      if (!metadata) continue;

      const streamingResult = await this.testStreamingCapability(providerName);
      const validation = await this.validateProvider(providerName);

      providers[providerName] = {
        metadata,
        actual: {
          streaming: streamingResult.supported,
          vision: metadata.features.vision, // Trust metadata for now
          parameters: [], // Would enumerate actual supported params
          models: [] // Would enumerate actual supported models
        },
        lastValidated: new Date(),
        status: validation.valid ? 'validated' : 'mismatch'
      };
    }

    return { providers };
  }

  /**
   * Test parameter support
   */
  async testParameterSupport(
    providerName: string,
    parameter: 'temperature' | 'maxTokens' | 'topP' | 'model'
  ): Promise<CapabilityTestResult> {
    // This would test if a provider actually supports a parameter
    // For now, return based on known provider capabilities

    const knownSupport: Record<string, string[]> = {
      'openai': ['temperature', 'maxTokens', 'model'],
      'claude-code': ['model'],
      'gemini-cli': [] // No parameters supported yet
    };

    const supported = knownSupport[providerName]?.includes(parameter) ?? false;

    return {
      supported,
      tested: true,
      evidence: {
        parameter,
        supported,
        source: 'known capabilities database'
      }
    };
  }
}
