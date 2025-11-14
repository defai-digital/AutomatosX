/**
 * AutomatosX v8.0.0 - Failure Analyzer
 *
 * Analyzes failures to classify errors and detect patterns
 */

import type {
  FailureAnalysis,
  ProgressSnapshot,
  IterationResult
} from '../types/iterate.types.js';

/**
 * Error classification patterns
 */
const ERROR_PATTERNS = {
  timeout: [
    'timeout', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'timed out', 'connection timeout', 'request timeout'
  ],
  rateLimit: [
    'rate limit', 'rate_limit', '429', 'too many requests',
    'quota exceeded', 'throttled'
  ],
  network: [
    'network', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED',
    'DNS', 'connection refused', 'socket hang up'
  ],
  auth: [
    'auth', 'authentication', 'authorization', '401', '403',
    'unauthorized', 'forbidden', 'invalid token', 'expired token'
  ],
  validation: [
    'validation', 'invalid', 'schema', 'required field',
    'bad request', '400', 'malformed'
  ],
  resource: [
    'resource exhausted', 'out of memory', 'EMFILE', 'ENOMEM',
    'EAGAIN', 'too many open files', 'memory'
  ],
  provider: [
    'api_error', 'api error', '500', '502', '503',
    'internal server error', 'bad gateway', 'service unavailable',
    'overloaded'
  ],
  permanent: [
    'not found', '404', 'does not exist', 'deleted',
    'permanently failed', 'fatal error'
  ]
};

/**
 * Failure Analyzer
 *
 * Analyzes errors to:
 * - Classify error types
 * - Determine if transient or permanent
 * - Detect failure patterns across iterations
 * - Recommend recovery strategies
 */
export class FailureAnalyzer {
  /**
   * Analyze a failure and provide classification
   */
  async analyze(
    error: Error,
    progress: ProgressSnapshot,
    iterationHistory: IterationResult[]
  ): Promise<FailureAnalysis> {
    // Classify error type
    const errorType = this.classifyError(error);

    // Determine if transient or permanent
    const isTransient = this.isTransientError(errorType, error);
    const isPermanent = this.isPermanentError(errorType, error);

    // Assess severity
    const severity = this.assessSeverity(errorType, progress, iterationHistory);

    // Detect failure pattern
    const failurePattern = this.detectPattern(errorType, iterationHistory);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      errorType,
      isTransient,
      failurePattern,
      iterationHistory
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(errorType, iterationHistory);

    return {
      errorType,
      isTransient,
      isPermanent,
      severity,
      failedStep: this.extractFailedStep(error, progress),
      failurePattern,
      recommendations,
      confidence
    };
  }

  /**
   * Classify error into a category
   */
  private classifyError(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    const errorString = `${errorName} ${errorMessage}`;

    // Check each pattern category
    for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
      for (const pattern of patterns) {
        if (errorString.includes(pattern.toLowerCase())) {
          return category;
        }
      }
    }

    // Check for HTTP status codes in message
    const statusMatch = errorMessage.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      const status = statusMatch[1];
      if (status.startsWith('4')) return 'validation';
      if (status.startsWith('5')) return 'provider';
    }

    return 'unknown';
  }

  /**
   * Determine if error is transient (can be retried)
   */
  private isTransientError(errorType: string, error: Error): boolean {
    const transientTypes = ['timeout', 'rateLimit', 'network', 'resource', 'provider'];
    return transientTypes.includes(errorType);
  }

  /**
   * Determine if error is permanent (no point retrying)
   */
  private isPermanentError(errorType: string, error: Error): boolean {
    const permanentTypes = ['permanent', 'auth', 'validation'];

    if (permanentTypes.includes(errorType)) {
      return true;
    }

    // Check for specific permanent error indicators
    const errorMessage = error.message.toLowerCase();
    const permanentKeywords = [
      'not found',
      'does not exist',
      'invalid api key',
      'permanently failed',
      'no such file',
      'cannot find'
    ];

    return permanentKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Assess error severity
   */
  private assessSeverity(
    errorType: string,
    progress: ProgressSnapshot,
    iterationHistory: IterationResult[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Permanent errors or many consecutive failures
    if (errorType === 'permanent' || iterationHistory.length >= 8) {
      return 'critical';
    }

    // High: Auth errors or repeated failures
    if (errorType === 'auth' || iterationHistory.length >= 5) {
      return 'high';
    }

    // Medium: Provider errors or resource issues
    if (errorType === 'provider' || errorType === 'resource') {
      return 'medium';
    }

    // Low: Transient network/timeout issues early in retry cycle
    return 'low';
  }

  /**
   * Detect failure pattern across iterations
   */
  private detectPattern(
    errorType: string,
    iterationHistory: IterationResult[]
  ): string | undefined {
    if (iterationHistory.length < 2) {
      return undefined;
    }

    // Check if same error type repeated
    const recentErrors = iterationHistory
      .slice(-3)
      .filter(iter => !iter.success)
      .map(iter => iter.error?.name || 'unknown');

    if (recentErrors.length >= 2 && new Set(recentErrors).size === 1) {
      return 'repeated_same_error';
    }

    // Check for alternating pattern
    const lastTwoResults = iterationHistory.slice(-2).map(iter => iter.success);
    if (lastTwoResults.length === 2 && lastTwoResults[0] === lastTwoResults[1]) {
      return 'consistent_failure';
    }

    // Check for increasing duration (performance degradation)
    const durations = iterationHistory.slice(-3).map(iter => iter.duration);
    if (durations.length >= 3) {
      const increasing = durations.every((d, i) => i === 0 || d > durations[i - 1]);
      if (increasing) {
        return 'performance_degradation';
      }
    }

    return undefined;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    errorType: string,
    isTransient: boolean,
    failurePattern: string | undefined,
    iterationHistory: IterationResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Type-specific recommendations
    switch (errorType) {
      case 'timeout':
        recommendations.push('Increase timeout values');
        recommendations.push('Check network connectivity');
        break;

      case 'rateLimit':
        recommendations.push('Use fallback AI providers');
        recommendations.push('Reduce parallelism to slow down requests');
        break;

      case 'network':
        recommendations.push('Retry with exponential backoff');
        recommendations.push('Check network connectivity');
        break;

      case 'resource':
        recommendations.push('Reduce parallelism to lower resource usage');
        recommendations.push('Close unused connections');
        break;

      case 'provider':
        recommendations.push('Switch to alternative AI provider');
        recommendations.push('Retry with backoff');
        break;

      case 'auth':
        recommendations.push('Verify API credentials');
        recommendations.push('Check token expiration');
        break;

      case 'validation':
        recommendations.push('Review input parameters');
        recommendations.push('Check workflow schema');
        break;

      case 'permanent':
        recommendations.push('Manual intervention required');
        recommendations.push('Review error details and fix root cause');
        break;
    }

    // Pattern-specific recommendations
    if (failurePattern === 'repeated_same_error') {
      recommendations.push('Try a different strategy approach');
    }

    if (failurePattern === 'performance_degradation') {
      recommendations.push('System may be overloaded - reduce load');
    }

    // Iteration-specific recommendations
    if (iterationHistory.length >= 7) {
      recommendations.push('Consider manual intervention - many iterations failed');
    }

    return recommendations;
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateConfidence(
    errorType: string,
    iterationHistory: IterationResult[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Known error type increases confidence
    if (errorType !== 'unknown') {
      confidence += 0.2;
    }

    // More iteration history increases confidence
    if (iterationHistory.length >= 3) {
      confidence += 0.15;
    }

    // Consistent patterns increase confidence
    const errorTypes = iterationHistory
      .filter(iter => !iter.success)
      .map(iter => iter.error?.name);

    if (errorTypes.length >= 2 && new Set(errorTypes).size === 1) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract failed step from error and progress
   */
  private extractFailedStep(error: Error, progress: ProgressSnapshot): string {
    // Try to extract step name from progress
    if (progress.currentStep) {
      return progress.currentStep;
    }

    // Try to extract from error message
    const stepMatch = error.message.match(/step[:\s]+['"]?([^'"]+)['"]?/i);
    if (stepMatch) {
      return stepMatch[1];
    }

    // Fallback to step number
    if (progress.steps && progress.steps.length > 0) {
      const failedStep = progress.steps.find(s => s.status === 'failed');
      if (failedStep) {
        return failedStep.name;
      }
    }

    return 'unknown';
  }
}
