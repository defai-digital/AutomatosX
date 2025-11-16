/**
 * Provider Metadata Type Definitions
 *
 * Defines metadata for AI providers including cost, latency, reliability,
 * cloud/region information, and feature support.
 *
 * @module types/provider-metadata
 */

/**
 * Provider metadata including cost, latency, reliability, and features
 */
export interface ProviderMetadata {
  /** Provider name */
  name: string;

  /** Cloud provider */
  cloud: 'aws' | 'gcp' | 'azure' | 'on-prem';

  /** Available regions */
  regions: string[];

  /** Cost per token in USD */
  costPerToken: {
    /** Input token cost per 1K tokens */
    input: number;
    /** Output token cost per 1K tokens */
    output: number;
  };

  /** Latency estimates in milliseconds */
  latencyEstimate: {
    /** P50 latency */
    p50: number;
    /** P95 latency */
    p95: number;
    /** P99 latency */
    p99: number;
  };

  /** Reliability metrics */
  reliability: {
    /** Availability (0.0-1.0, e.g., 0.999 = 99.9%) */
    availability: number;
    /** Error rate (0.0-1.0) */
    errorRate: number;
  };

  /** Supported features */
  features: {
    /** Streaming support */
    streaming: boolean;
    /** Vision/image support */
    vision: boolean;
    /** Function calling support */
    functionCalling: boolean;
  };
}

/**
 * Provider metadata registry
 */
export type ProviderMetadataRegistry = Record<string, ProviderMetadata>;
