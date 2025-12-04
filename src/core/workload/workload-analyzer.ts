/**
 * Workload Analyzer
 *
 * Analyzes request characteristics to enable intelligent routing decisions.
 * Classifies workloads by size, complexity, and resource requirements.
 *
 * @module core/workload/workload-analyzer
 */

import type { ExecutionRequest } from '@/types/provider.js';
import { logger } from '@/shared/logging/logger.js';

/**
 * Workload characteristics
 */
export interface WorkloadCharacteristics {
  estimatedTokens: number;       // Estimated total tokens (input + output)
  sizeClass: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
  requiresStreaming: boolean;    // Real-time streaming needed?
  requiresVision: boolean;       // Vision/image processing?
  requiresFunctionCalling: boolean; // Function/tool calling?
  complexity: 'simple' | 'medium' | 'complex';
  priority: 'low' | 'normal' | 'high';
}

/**
 * Routing recommendation based on workload analysis
 */
export interface RoutingRecommendation {
  preferredProviders: string[];  // Providers ranked by suitability
  reason: string;                // Why this routing is recommended
  costOptimized: boolean;        // Is this cost-optimized routing?
  speedOptimized: boolean;       // Is this speed-optimized routing?
}

/**
 * Workload Analyzer
 *
 * Analyzes execution requests to determine optimal routing strategy.
 */
export class WorkloadAnalyzer {
  /**
   * Analyze a request and extract workload characteristics
   *
   * FIXED (Bug #11): Added input validation to prevent runtime errors
   */
  analyze(request: ExecutionRequest): WorkloadCharacteristics {
    // FIXED (Bug #11): Validate request.prompt exists and is a non-empty string
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new Error(`Invalid request.prompt: ${request.prompt}. Must be a non-empty string.`);
    }
    if (request.prompt.trim().length === 0) {
      throw new Error('Invalid request.prompt: cannot be empty or whitespace-only.');
    }

    // FIXED (Bug #11): Validate request.maxTokens if provided
    if (request.maxTokens !== undefined) {
      if (!Number.isInteger(request.maxTokens) || request.maxTokens < 0) {
        throw new Error(`Invalid request.maxTokens: ${request.maxTokens}. Must be a non-negative integer.`);
      }
    }

    const estimatedTokens = this.estimateTokens(request);
    const sizeClass = this.classifySize(estimatedTokens);
    const complexity = this.detectComplexity(request);
    const requiresStreaming = this.detectStreamingRequirement(request);
    const requiresVision = this.detectVisionRequirement(request);
    const requiresFunctionCalling = this.detectFunctionCallingRequirement(request);
    const priority = this.detectPriority(request);

    logger.debug('Workload analyzed', {
      estimatedTokens,
      sizeClass,
      complexity,
      requiresStreaming,
      requiresVision,
      requiresFunctionCalling
    });

    return {
      estimatedTokens,
      sizeClass,
      requiresStreaming,
      requiresVision,
      requiresFunctionCalling,
      complexity,
      priority
    };
  }

  /**
   * Estimate total tokens (input + expected output)
   */
  private estimateTokens(request: ExecutionRequest): number {
    // Rough estimation: 1 token ≈ 4 characters
    const promptTokens = Math.ceil(request.prompt.length / 4);

    // Estimate output tokens based on maxTokens or use heuristic
    let outputTokens = request.maxTokens || 0;

    if (!outputTokens) {
      // Heuristic: output is typically 20-50% of input for most tasks
      outputTokens = Math.ceil(promptTokens * 0.35);
    }

    return promptTokens + outputTokens;
  }

  /**
   * Classify workload size
   */
  private classifySize(estimatedTokens: number): WorkloadCharacteristics['sizeClass'] {
    if (estimatedTokens < 500) return 'tiny';           // <500 tokens
    if (estimatedTokens < 2000) return 'small';         // 500-2K tokens
    if (estimatedTokens < 10000) return 'medium';       // 2K-10K tokens
    if (estimatedTokens < 50000) return 'large';        // 10K-50K tokens
    return 'xlarge';                                    // >50K tokens
  }

  /**
   * Detect if streaming is required
   */
  private detectStreamingRequirement(request: ExecutionRequest): boolean {
    // Check for streaming-related keywords in prompt or spec
    const streamingKeywords = [
      'stream',
      'real-time',
      'interactive',
      'live',
      'progressive'
    ];

    const promptLower = request.prompt.toLowerCase();
    const hasStreamingKeyword = streamingKeywords.some(kw => promptLower.includes(kw));

    // Check spec description
    if (request.spec?.description) {
      const specLower = request.spec.description.toLowerCase();
      if (streamingKeywords.some(kw => specLower.includes(kw))) {
        return true;
      }
    }

    return hasStreamingKeyword;
  }

  /**
   * Detect if vision/image processing is required
   */
  private detectVisionRequirement(request: ExecutionRequest): boolean {
    // Check for vision-related keywords
    const visionKeywords = [
      'image',
      'picture',
      'photo',
      'video',
      'visual',
      'analyze image',
      'describe image',
      'ocr'
    ];

    const promptLower = request.prompt.toLowerCase();
    return visionKeywords.some(kw => promptLower.includes(kw));
  }

  /**
   * Detect if function calling is required
   */
  private detectFunctionCallingRequirement(request: ExecutionRequest): boolean {
    // Check for function calling keywords
    const functionKeywords = [
      'function',
      'tool',
      'api call',
      'execute',
      'call the',
      'use the tool'
    ];

    const promptLower = request.prompt.toLowerCase();
    return functionKeywords.some(kw => promptLower.includes(kw));
  }

  /**
   * Detect workload complexity
   */
  private detectComplexity(request: ExecutionRequest): WorkloadCharacteristics['complexity'] {
    const complexityIndicators = [
      'complex',
      'difficult',
      'detailed',
      'comprehensive',
      'analyze deeply',
      'reason about',
      'think step by step'
    ];

    const promptLower = request.prompt.toLowerCase();
    const hasComplexityIndicator = complexityIndicators.some(kw => promptLower.includes(kw));

    // Long prompts are typically more complex
    const promptTokens = Math.ceil(request.prompt.length / 4);

    if (hasComplexityIndicator || promptTokens > 2000) {
      return 'complex';
    } else if (promptTokens > 500) {
      return 'medium';
    } else {
      return 'simple';
    }
  }

  /**
   * Detect priority level
   */
  private detectPriority(request: ExecutionRequest): WorkloadCharacteristics['priority'] {
    // Check for priority keywords
    const highPriorityKeywords = ['urgent', 'asap', 'immediately', 'priority'];
    const lowPriorityKeywords = ['whenever', 'no rush', 'background'];

    const promptLower = request.prompt.toLowerCase();

    if (highPriorityKeywords.some(kw => promptLower.includes(kw))) {
      return 'high';
    } else if (lowPriorityKeywords.some(kw => promptLower.includes(kw))) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Generate routing recommendation based on workload
   */
  recommend(characteristics: WorkloadCharacteristics): RoutingRecommendation {
    const providers: string[] = [];
    let reason = '';
    let costOptimized = false;
    let speedOptimized = false;

    // Routing logic based on workload characteristics
    if (characteristics.sizeClass === 'tiny' && characteristics.requiresStreaming) {
      // Tiny streaming: prioritize speed
      providers.push('openai', 'claude-code', 'gemini-cli');
      reason = 'Tiny streaming workload: prioritizing speed (OpenAI fastest)';
      speedOptimized = true;
    } else if (characteristics.sizeClass === 'tiny' || characteristics.sizeClass === 'small') {
      // Small tasks: balance speed and cost
      providers.push('gemini-cli', 'openai', 'claude-code');
      reason = 'Small workload: Gemini offers best cost/speed balance';
      costOptimized = true;
    } else if (characteristics.sizeClass === 'medium' && characteristics.requiresStreaming) {
      // Medium streaming: depends on priority
      if (characteristics.priority === 'high') {
        providers.push('openai', 'claude-code', 'gemini-cli');
        reason = 'Medium streaming with high priority: prioritizing speed';
        speedOptimized = true;
      } else {
        providers.push('gemini-cli', 'openai', 'claude-code');
        reason = 'Medium streaming: Gemini for cost savings';
        costOptimized = true;
      }
    } else if (characteristics.sizeClass === 'large' || characteristics.sizeClass === 'xlarge') {
      // Large tasks: heavily prioritize cost
      providers.push('gemini-cli', 'gemini-sdk');
      reason = `${characteristics.sizeClass.toUpperCase()} workload: strongly prioritizing cost (Gemini 96% cheaper)`;
      costOptimized = true;
    } else if (characteristics.requiresVision) {
      // Vision tasks: providers with vision support
      providers.push('gemini-cli', 'openai');
      reason = 'Vision required: routing to providers with vision support';
    } else if (characteristics.complexity === 'complex') {
      // Complex reasoning: better models
      providers.push('openai', 'claude-code', 'gemini-cli');
      reason = 'Complex reasoning: routing to advanced models';
    } else {
      // Default: cost-optimized routing
      providers.push('gemini-cli', 'openai', 'claude-code');
      reason = 'Standard workload: cost-optimized routing';
      costOptimized = true;
    }

    logger.debug('Routing recommendation generated', {
      sizeClass: characteristics.sizeClass,
      providers,
      reason,
      costOptimized,
      speedOptimized
    });

    return {
      preferredProviders: providers,
      reason,
      costOptimized,
      speedOptimized
    };
  }
}

// Global instance
let workloadAnalyzerInstance: WorkloadAnalyzer | null = null;

/**
 * Get or create workload analyzer instance
 */
export function getWorkloadAnalyzer(): WorkloadAnalyzer {
  if (!workloadAnalyzerInstance) {
    workloadAnalyzerInstance = new WorkloadAnalyzer();
  }
  return workloadAnalyzerInstance;
}
