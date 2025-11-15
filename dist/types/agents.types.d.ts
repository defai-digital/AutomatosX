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
export type AgentType = 'backend' | 'frontend' | 'security' | 'quality' | 'devops' | 'architecture' | 'data' | 'product' | 'datascience' | 'mobile' | 'cto' | 'ceo' | 'writer' | 'researcher' | 'standards' | 'database' | 'api' | 'testing' | 'infrastructure' | 'performance';
/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'medium' | 'high' | 'critical';
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
    task: Task;
    memory: {
        search: (query: string) => Promise<any[]>;
        recall: (conversationId: string) => Promise<any>;
        store: (data: any) => Promise<void>;
    };
    codeIntelligence: {
        findSymbol: (name: string) => Promise<any[]>;
        getCallGraph: (functionName: string) => Promise<any>;
        searchCode: (query: string) => Promise<any[]>;
        analyzeQuality: (filePath: string) => Promise<any>;
    };
    provider: {
        call: (prompt: string, options?: any) => Promise<string>;
        stream: (prompt: string, options?: any) => AsyncGenerator<string>;
    };
    delegate: (agentType: AgentType, task: string) => Promise<TaskResult>;
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
export declare const TaskSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    priority: z.ZodEnum<["low", "medium", "high", "critical"]>;
    status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
    assignedAgent: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodNumber>;
    completedAt: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    priority: "medium" | "low" | "high" | "critical";
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    createdAt: number;
    assignedAgent?: string | undefined;
    context?: Record<string, unknown> | undefined;
    dependencies?: string[] | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
}, {
    id: string;
    description: string;
    priority: "medium" | "low" | "high" | "critical";
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    createdAt: number;
    assignedAgent?: string | undefined;
    context?: Record<string, unknown> | undefined;
    dependencies?: string[] | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
}>;
export declare const AgentMetadataSchema: z.ZodObject<{
    type: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    capabilities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        keywords: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        keywords: string[];
    }, {
        name: string;
        description: string;
        keywords: string[];
    }>, "many">;
    specializations: z.ZodArray<z.ZodString, "many">;
    requiredContext: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    description: string;
    capabilities: {
        name: string;
        description: string;
        keywords: string[];
    }[];
    specializations: string[];
    requiredContext?: string[] | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
}, {
    type: string;
    name: string;
    description: string;
    capabilities: {
        name: string;
        description: string;
        keywords: string[];
    }[];
    specializations: string[];
    requiredContext?: string[] | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
}>;
export declare const TaskResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    message: z.ZodOptional<z.ZodString>;
    artifacts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["file", "code", "document", "diagram", "data"]>;
        name: z.ZodString;
        path: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "document" | "data" | "file" | "code" | "diagram";
        name: string;
        path?: string | undefined;
        content?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        type: "document" | "data" | "file" | "code" | "diagram";
        name: string;
        path?: string | undefined;
        content?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    data?: unknown;
    message?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    artifacts?: {
        type: "document" | "data" | "file" | "code" | "diagram";
        name: string;
        path?: string | undefined;
        content?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
}, {
    success: boolean;
    data?: unknown;
    message?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
    artifacts?: {
        type: "document" | "data" | "file" | "code" | "diagram";
        name: string;
        path?: string | undefined;
        content?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
//# sourceMappingURL=agents.types.d.ts.map