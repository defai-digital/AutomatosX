/**
 * TypeScript type definitions for AutomatosX YAML specs (*.ax.yaml)
 * Generated from schema/spec-schema.json
 *
 * @module types/spec-yaml
 * @see schema/spec-schema.json
 */

// ============================================================================
// Main Spec Type
// ============================================================================

/**
 * Root spec structure for *.ax.yaml files
 */
export interface SpecYAML {
  /** Spec schema version (e.g., '1.0') */
  version: string;

  /** Metadata about the spec */
  metadata: SpecMetadata;

  /** List of actors (agents) that execute tasks */
  actors: ActorSpec[];

  /** AI provider configuration (optional) */
  providers?: ProvidersSpec;

  /** Routing and optimization policy (optional) */
  policy?: PolicySpec;

  /** Monitoring and observability configuration (optional) */
  observability?: ObservabilitySpec;

  /** Error handling and recovery configuration (optional) */
  recovery?: RecoverySpec;

  /** Custom validation rules (optional) */
  validation?: ValidationSpec;
}

// ============================================================================
// Metadata
// ============================================================================

export interface SpecMetadata {
  /** Unique identifier (kebab-case) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Brief description of what this spec does */
  description: string;

  /** Spec version (semver format) */
  version?: string;

  /** Author or team name */
  author?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Creation timestamp (ISO 8601) */
  created?: string;

  /** Last update timestamp (ISO 8601) */
  updated?: string;
}

// ============================================================================
// Actors
// ============================================================================

export interface ActorSpec {
  /** Unique actor identifier */
  id: string;

  /** Agent name (e.g., 'backend', 'frontend') */
  agent: string;

  /** Actor role description */
  description?: string;

  /** Permissions for this actor */
  permissions?: PermissionsSpec;

  /** Resource limits for this actor */
  resources?: ResourcesSpec;

  /** Execution timeout in milliseconds */
  timeout?: number;
}

export interface PermissionsSpec {
  /** Filesystem access permissions */
  filesystem?: {
    /** Allowed read paths (glob patterns) */
    read?: string[];
    /** Allowed write paths (glob patterns) */
    write?: string[];
  };

  /** Network access permissions */
  network?: {
    /** Whether network access is allowed */
    enabled?: boolean;
    /** Allowed domains/IPs */
    whitelist?: string[];
    /** Require TLS/SSL for all connections */
    requireTls?: boolean;
  };

  /** Environment variable access */
  environment?: {
    /** Allowed environment variables to read */
    read?: string[];
    /** Allowed environment variables to modify */
    write?: string[];
  };
}

export interface ResourcesSpec {
  /** Memory limits */
  memory?: {
    /** Memory limit (e.g., '512MB', '2GB') */
    limit?: string;
  };

  /** CPU limits */
  cpu?: {
    /** CPU cores limit */
    limit?: number;
  };

  /** Storage limits */
  storage?: {
    /** Storage limit (e.g., '1GB', '10GB') */
    limit?: string;
  };
}

// ============================================================================
// Providers
// ============================================================================

export interface ProvidersSpec {
  /** Primary AI provider */
  primary?: ProviderConfig;

  /** Fallback providers (in order of preference) */
  fallback?: ProviderConfig[];
}

export interface ProviderConfig {
  /** Provider name */
  name: 'openai' | 'claude-code' | 'gemini-cli' | 'claude-sdk' | 'gemini-sdk';

  /** Model name (e.g., 'gpt-4o', 'claude-opus-4') */
  model?: string;

  /** Budget configuration */
  budget?: {
    /** Soft cost limit (triggers warning) */
    softCap?: number;
    /** Hard cost limit (aborts execution) */
    hardCap?: number;
    /** Budget period */
    period?: 'daily' | 'weekly' | 'monthly';
  };
}

// ============================================================================
// Policy
// ============================================================================

export interface PolicySpec {
  /** Primary optimization goal */
  goal?: 'cost' | 'latency' | 'reliability' | 'balanced';

  /** Multi-factor optimization weights */
  optimization?: {
    weights?: {
      cost?: number;
      latency?: number;
      reliability?: number;
    };
  };

  /** Constraints for routing decisions */
  constraints?: {
    cost?: CostConstraint;
    latency?: LatencyConstraint;
    privacy?: PrivacyConstraint;
    reliability?: ReliabilityConstraint;
  };
}

export interface CostConstraint {
  /** Maximum cost per request (USD) */
  maxPerRequest?: number;

  /** Maximum daily cost (USD) */
  maxDaily?: number;
}

export interface LatencyConstraint {
  /** P50 latency target (ms) */
  p50?: number;

  /** P95 latency target (ms) */
  p95?: number;

  /** P99 latency target (ms) */
  p99?: number;
}

export interface PrivacyConstraint {
  /** Data classification level */
  dataClassification?: 'public' | 'internal' | 'confidential' | 'pii' | 'phi';

  /** Allowed cloud providers */
  allowedClouds?: Array<'aws' | 'gcp' | 'azure' | 'on-prem'>;

  /** Allowed geographic regions (e.g., 'us-east', 'eu-west') */
  allowedRegions?: string[];
}

export interface ReliabilityConstraint {
  /** Minimum availability (e.g., 0.999 for 99.9%) */
  minAvailability?: number;

  /** Maximum acceptable error rate */
  maxErrorRate?: number;
}

// ============================================================================
// Observability
// ============================================================================

export interface ObservabilitySpec {
  /** Metrics configuration */
  metrics?: {
    enabled?: boolean;
    /** Metrics provider */
    provider?: 'prometheus' | 'datadog' | 'cloudwatch';
  };

  /** Logging configuration */
  logs?: {
    enabled?: boolean;
    /** Log level */
    level?: 'debug' | 'info' | 'warn' | 'error';
    /** Log destination (file path or URL) */
    destination?: string;
  };

  /** Distributed tracing configuration */
  tracing?: {
    enabled?: boolean;
    /** Tracing provider */
    provider?: 'jaeger' | 'zipkin' | 'opentelemetry';
  };

  /** Audit logging configuration */
  audit?: {
    enabled?: boolean;
    /** Audit log destination */
    destination?: string;
  };
}

// ============================================================================
// Recovery
// ============================================================================

export interface RecoverySpec {
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts?: number;
    /** Backoff strategy */
    strategy?: 'exponential' | 'linear' | 'constant';
    /** Initial retry delay (ms) */
    initialDelayMs?: number;
  };

  /** Timeout configuration */
  timeout?: {
    /** Request timeout (ms) */
    request?: number;
    /** Task timeout (ms) */
    task?: number;
  };

  /** Failover configuration */
  failover?: {
    enabled?: boolean;
    /** Failover trigger strategy */
    strategy?: 'immediate' | 'delayed' | 'manual';
  };

  /** Circuit breaker configuration */
  circuit?: {
    enabled?: boolean;
    /** Consecutive errors to open circuit */
    errorThreshold?: number;
    /** Time before attempting reset (ms) */
    resetTimeoutMs?: number;
  };
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationSpec {
  /** Enable strict validation (warnings become errors) */
  strictMode?: boolean;

  /** Custom validation rules */
  customRules?: CustomValidationRule[];
}

export interface CustomValidationRule {
  /** Rule ID (e.g., 'CUSTOM-001') */
  id: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Rule description */
  description: string;

  /** Regex pattern to match */
  pattern?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Validation result for a spec
 */
export interface SpecValidationResult {
  /** Whether the spec is valid */
  valid: boolean;

  /** Validation errors (blocking issues) */
  errors: ValidationIssue[];

  /** Validation warnings (non-blocking issues) */
  warnings: ValidationIssue[];

  /** Informational messages */
  info: ValidationIssue[];
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Rule ID (e.g., 'SEC001', 'SCHEMA-001') */
  ruleId: string;

  /** Severity level */
  severity: 'error' | 'warning' | 'info';

  /** Human-readable message */
  message: string;

  /** Path to the problematic field (e.g., 'actors[0].permissions.network') */
  path?: string;

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Spec loading result
 */
export interface LoadedSpec {
  /** Parsed spec data */
  spec: SpecYAML;

  /** File path */
  filePath: string;

  /** Validation result */
  validation: SpecValidationResult;
}
