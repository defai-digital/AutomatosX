/**
 * agents.types.ts
 *
 * Type definitions for Agent System
 * Phase 7: Agent System Implementation
 */

import { z } from 'zod';

/**
 * Agent specialization types
 */
export type AgentType =
  | 'backend'
  | 'frontend'
  | 'security'
  | 'quality'
  | 'devops'
  | 'architecture'
  | 'data'
  | 'product'
  | 'datascience'
  | 'mobile'
  | 'cto'
  | 'ceo'
  | 'writer'
  | 'researcher'
  | 'standards'
  | 'database'
  | 'api'
  | 'testing'
  | 'infrastructure';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Agent capability
 */
export interface AgentCapability {
  name: string;
  description: string;
  keywords: string[];
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
  type: AgentType;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  specializations: string[];
  requiredContext?: string[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedAgent?: AgentType;
  context?: Record<string, unknown>;
  dependencies?: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: TaskResult;
  error?: string;
}

/**
 * Task result
 */
export interface TaskResult {
  success: boolean;
  data?: unknown;
  message?: string;
  artifacts?: TaskArtifact[];
  metadata?: Record<string, unknown>;
}

/**
 * Task artifact (files, code, documents generated)
 */
export interface TaskArtifact {
  type: 'file' | 'code' | 'document' | 'diagram' | 'data';
  name: string;
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  // Task information
  task: Task;

  // Memory access
  memory: {
    search: (query: string) => Promise<any[]>;
    recall: (conversationId: string) => Promise<any>;
    store: (data: any) => Promise<void>;
  };

  // Code intelligence access
  codeIntelligence: {
    findSymbol: (name: string) => Promise<any[]>;
    getCallGraph: (functionName: string) => Promise<any>;
    searchCode: (query: string) => Promise<any[]>;
    analyzeQuality: (filePath: string) => Promise<any>;
  };

  // Provider access
  provider: {
    call: (prompt: string, options?: any) => Promise<string>;
    stream: (prompt: string, options?: any) => AsyncGenerator<string>;
  };

  // Delegation
  delegate: (agentType: AgentType, task: string) => Promise<TaskResult>;

  // Monitoring
  monitoring: {
    recordMetric: (name: string, value: number) => void;
    startTrace: () => string;
    startSpan: (traceId: string, name: string) => string;
    completeSpan: (spanId: string) => void;
    log: (level: string, message: string) => void;
  };
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  provider?: 'claude' | 'gemini' | 'openai';
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

/**
 * Delegation request
 */
export interface DelegationRequest {
  targetAgent: AgentType;
  task: string;
  context?: Record<string, unknown>;
  priority?: TaskPriority;
}

/**
 * Collaboration request (multi-agent)
 */
export interface CollaborationRequest {
  agents: AgentType[];
  task: string;
  strategy: 'sequential' | 'parallel' | 'consensus';
  context?: Record<string, unknown>;
}

/**
 * Zod schemas for validation
 */
export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  assignedAgent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
});

export const AgentMetadataSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
    })
  ),
  specializations: z.array(z.string()),
  requiredContext: z.array(z.string()).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

export const TaskResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  artifacts: z
    .array(
      z.object({
        type: z.enum(['file', 'code', 'document', 'diagram', 'data']),
        name: z.string(),
        path: z.string().optional(),
        content: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});
