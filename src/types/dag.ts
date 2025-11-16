/**
 * DAG (Directed Acyclic Graph) Type Definitions
 *
 * Phase 3: Auto-generated DAG format for execution
 *
 * @module types/dag
 */

/**
 * DAG node representing a task or actor
 */
export interface DagNode {
  /** Unique node identifier */
  id: string;

  /** Agent name to execute this node */
  actor: string;

  /** Task description */
  task: string;

  /** Dependencies (node IDs that must complete first) */
  dependencies: string[];

  /** Node metadata */
  metadata: {
    /** Execution timeout in milliseconds */
    timeout?: number;

    /** Number of retry attempts */
    retries?: number;

    /** SLA target in milliseconds */
    sla?: number;

    /** Resource requirements */
    resources?: {
      /** Memory limit (e.g., "512MB") */
      memory?: string;
      /** CPU limit in cores */
      cpu?: number;
    };

    /** Permissions for this node */
    permissions?: {
      filesystem?: {
        read?: string[];
        write?: string[];
      };
      network?: {
        enabled?: boolean;
        whitelist?: string[];
      };
    };
  };
}

/**
 * DAG edge representing a dependency
 */
export interface DagEdge {
  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Edge type (optional) */
  type?: 'data' | 'control' | 'resource';
}

/**
 * Complete DAG structure for execution
 */
export interface DagJson {
  /** DAG format version */
  version: string;

  /** SHA-256 hash of source spec (for change detection) */
  specHash: string;

  /** Metadata about the DAG */
  metadata: {
    /** Spec ID */
    id: string;

    /** Spec name */
    name: string;

    /** Generation timestamp (ISO 8601) */
    generated: string;

    /** Source spec file */
    sourceFile?: string;
  };

  /** Nodes in the DAG */
  nodes: DagNode[];

  /** Edges representing dependencies */
  edges: DagEdge[];

  /** Policy configuration for routing (optional) */
  policy?: {
    goal?: string;
    optimization?: any;
    constraints?: any;
  };

  /** Execution configuration (optional) */
  execution?: {
    /** Parallel execution enabled */
    parallel?: boolean;

    /** Maximum concurrent nodes */
    maxConcurrency?: number;

    /** Timeout for entire DAG execution */
    timeoutMs?: number;
  };
}

/**
 * DAG validation result
 */
export interface DagValidationResult {
  /** Whether DAG is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** DAG statistics */
  stats?: {
    nodeCount: number;
    edgeCount: number;
    maxDepth: number;
    parallelizableNodes: number;
  };
}

/**
 * DAG execution result
 */
export interface DagExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Completed node IDs */
  completed: string[];

  /** Failed node IDs */
  failed: string[];

  /** Skipped node IDs */
  skipped: string[];

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Total cost (if available) */
  totalCost?: number;

  /** Node-level results */
  nodeResults: Record<string, {
    success: boolean;
    durationMs: number;
    cost?: number;
    error?: string;
  }>;
}
