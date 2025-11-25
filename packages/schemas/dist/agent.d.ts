import { z } from 'zod';

/**
 * Agent profile schemas for AutomatosX
 * @module @ax/schemas/agent
 */

/**
 * Communication style for agent interactions
 */
declare const CommunicationStyle: z.ZodEnum<["formal", "casual", "technical", "friendly"]>;
type CommunicationStyle = z.infer<typeof CommunicationStyle>;
/**
 * Decision making approach
 */
declare const DecisionMaking: z.ZodEnum<["data-driven", "intuitive", "collaborative", "analytical"]>;
type DecisionMaking = z.infer<typeof DecisionMaking>;
/**
 * Agent personality configuration
 */
declare const PersonalitySchema: z.ZodObject<{
    /** Character traits that define the agent's behavior (1-5 traits) */
    traits: z.ZodArray<z.ZodString, "many">;
    /** Optional catchphrase or signature expression */
    catchphrase: z.ZodOptional<z.ZodString>;
    /** How the agent communicates */
    communicationStyle: z.ZodDefault<z.ZodEnum<["formal", "casual", "technical", "friendly"]>>;
    /** How the agent makes decisions */
    decisionMaking: z.ZodDefault<z.ZodEnum<["data-driven", "intuitive", "collaborative", "analytical"]>>;
}, "strip", z.ZodTypeAny, {
    traits: string[];
    communicationStyle: "formal" | "casual" | "technical" | "friendly";
    decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
    catchphrase?: string | undefined;
}, {
    traits: string[];
    catchphrase?: string | undefined;
    communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
    decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
}>;
type Personality = z.infer<typeof PersonalitySchema>;
/**
 * Smart ability loading configuration
 * Allows agents to load abilities based on task context
 */
declare const AbilitySelectionSchema: z.ZodObject<{
    /** Core abilities always loaded for this agent */
    core: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Task-based abilities loaded by keyword matching */
    taskBased: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    core: string[];
    taskBased: Record<string, string[]>;
}, {
    core?: string[] | undefined;
    taskBased?: Record<string, string[]> | undefined;
}>;
type AbilitySelection = z.infer<typeof AbilitySelectionSchema>;
/**
 * Agent orchestration and delegation settings
 */
declare const OrchestrationSchema: z.ZodObject<{
    /** Maximum depth of delegation chain (0 = cannot delegate) */
    maxDelegationDepth: z.ZodDefault<z.ZodNumber>;
    /** Workspaces this agent can read from */
    canReadWorkspaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Whether agent can write to shared workspace */
    canWriteToShared: z.ZodDefault<z.ZodBoolean>;
    /** Agents this agent can delegate to */
    canDelegateTo: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Priority level for task routing (1 = highest) */
    priority: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxDelegationDepth: number;
    canReadWorkspaces: string[];
    canWriteToShared: boolean;
    canDelegateTo: string[];
    priority: number;
}, {
    maxDelegationDepth?: number | undefined;
    canReadWorkspaces?: string[] | undefined;
    canWriteToShared?: boolean | undefined;
    canDelegateTo?: string[] | undefined;
    priority?: number | undefined;
}>;
type Orchestration = z.infer<typeof OrchestrationSchema>;
/**
 * Complete agent profile definition
 * This is the main schema for defining agent personalities and capabilities
 */
declare const AgentProfileSchema: z.ZodObject<{
    /** Unique identifier for the agent (lowercase, alphanumeric with hyphens) */
    name: z.ZodBranded<z.ZodString, "AgentId">;
    /** Human-friendly display name */
    displayName: z.ZodString;
    /** Agent's role description */
    role: z.ZodString;
    /** Team affiliation */
    team: z.ZodDefault<z.ZodString>;
    /** Detailed description of agent capabilities */
    description: z.ZodOptional<z.ZodString>;
    /** List of ability identifiers */
    abilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Smart ability selection configuration */
    abilitySelection: z.ZodOptional<z.ZodObject<{
        /** Core abilities always loaded for this agent */
        core: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Task-based abilities loaded by keyword matching */
        taskBased: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        core: string[];
        taskBased: Record<string, string[]>;
    }, {
        core?: string[] | undefined;
        taskBased?: Record<string, string[]> | undefined;
    }>>;
    /** Agent personality configuration */
    personality: z.ZodOptional<z.ZodObject<{
        /** Character traits that define the agent's behavior (1-5 traits) */
        traits: z.ZodArray<z.ZodString, "many">;
        /** Optional catchphrase or signature expression */
        catchphrase: z.ZodOptional<z.ZodString>;
        /** How the agent communicates */
        communicationStyle: z.ZodDefault<z.ZodEnum<["formal", "casual", "technical", "friendly"]>>;
        /** How the agent makes decisions */
        decisionMaking: z.ZodDefault<z.ZodEnum<["data-driven", "intuitive", "collaborative", "analytical"]>>;
    }, "strip", z.ZodTypeAny, {
        traits: string[];
        communicationStyle: "formal" | "casual" | "technical" | "friendly";
        decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
        catchphrase?: string | undefined;
    }, {
        traits: string[];
        catchphrase?: string | undefined;
        communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
        decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
    }>>;
    /** Orchestration settings */
    orchestration: z.ZodDefault<z.ZodObject<{
        /** Maximum depth of delegation chain (0 = cannot delegate) */
        maxDelegationDepth: z.ZodDefault<z.ZodNumber>;
        /** Workspaces this agent can read from */
        canReadWorkspaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Whether agent can write to shared workspace */
        canWriteToShared: z.ZodDefault<z.ZodBoolean>;
        /** Agents this agent can delegate to */
        canDelegateTo: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Priority level for task routing (1 = highest) */
        priority: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxDelegationDepth: number;
        canReadWorkspaces: string[];
        canWriteToShared: boolean;
        canDelegateTo: string[];
        priority: number;
    }, {
        maxDelegationDepth?: number | undefined;
        canReadWorkspaces?: string[] | undefined;
        canWriteToShared?: boolean | undefined;
        canDelegateTo?: string[] | undefined;
        priority?: number | undefined;
    }>>;
    /** System prompt that defines agent behavior */
    systemPrompt: z.ZodString;
    /** Whether agent is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Agent version for tracking changes */
    version: z.ZodDefault<z.ZodString>;
    /** Custom metadata */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string & z.BRAND<"AgentId">;
    displayName: string;
    role: string;
    team: string;
    abilities: string[];
    orchestration: {
        maxDelegationDepth: number;
        canReadWorkspaces: string[];
        canWriteToShared: boolean;
        canDelegateTo: string[];
        priority: number;
    };
    systemPrompt: string;
    enabled: boolean;
    version: string;
    description?: string | undefined;
    abilitySelection?: {
        core: string[];
        taskBased: Record<string, string[]>;
    } | undefined;
    personality?: {
        traits: string[];
        communicationStyle: "formal" | "casual" | "technical" | "friendly";
        decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
        catchphrase?: string | undefined;
    } | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    name: string;
    displayName: string;
    role: string;
    systemPrompt: string;
    team?: string | undefined;
    description?: string | undefined;
    abilities?: string[] | undefined;
    abilitySelection?: {
        core?: string[] | undefined;
        taskBased?: Record<string, string[]> | undefined;
    } | undefined;
    personality?: {
        traits: string[];
        catchphrase?: string | undefined;
        communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
        decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
    } | undefined;
    orchestration?: {
        maxDelegationDepth?: number | undefined;
        canReadWorkspaces?: string[] | undefined;
        canWriteToShared?: boolean | undefined;
        canDelegateTo?: string[] | undefined;
        priority?: number | undefined;
    } | undefined;
    enabled?: boolean | undefined;
    version?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
type AgentProfile = z.infer<typeof AgentProfileSchema>;
/**
 * Context passed to agent during execution
 */
declare const ExecutionContextSchema: z.ZodObject<{
    /** The task to execute */
    task: z.ZodString;
    /** Session ID if part of a multi-agent session */
    sessionId: z.ZodOptional<z.ZodString>;
    /** Parent agent ID if delegated */
    parentAgentId: z.ZodOptional<z.ZodString>;
    /** Delegation chain for tracking depth */
    delegationChain: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Relevant memory entries */
    memoryContext: z.ZodDefault<z.ZodArray<z.ZodUnknown, "many">>;
    /** Additional context data */
    context: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Timeout in milliseconds */
    timeout: z.ZodDefault<z.ZodNumber>;
    /** Whether to stream output */
    stream: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    task: string;
    delegationChain: string[];
    memoryContext: unknown[];
    context: Record<string, unknown>;
    timeout: number;
    stream: boolean;
    sessionId?: string | undefined;
    parentAgentId?: string | undefined;
}, {
    task: string;
    sessionId?: string | undefined;
    parentAgentId?: string | undefined;
    delegationChain?: string[] | undefined;
    memoryContext?: unknown[] | undefined;
    context?: Record<string, unknown> | undefined;
    timeout?: number | undefined;
    stream?: boolean | undefined;
}>;
type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
/**
 * Response from agent execution
 */
declare const AgentResponseSchema: z.ZodObject<{
    /** Whether execution was successful */
    success: z.ZodBoolean;
    /** Agent output/response */
    output: z.ZodString;
    /** Agent ID that produced this response */
    agentId: z.ZodString;
    /** Execution duration in milliseconds */
    duration: z.ZodNumber;
    /** Provider used for execution */
    provider: z.ZodOptional<z.ZodString>;
    /** Token usage if available */
    tokens: z.ZodOptional<z.ZodObject<{
        input: z.ZodOptional<z.ZodNumber>;
        output: z.ZodOptional<z.ZodNumber>;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        output?: number | undefined;
        input?: number | undefined;
        total?: number | undefined;
    }, {
        output?: number | undefined;
        input?: number | undefined;
        total?: number | undefined;
    }>>;
    /** Delegation requests made by agent */
    delegations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        toAgent: z.ZodString;
        task: z.ZodString;
        status: z.ZodEnum<["pending", "completed", "failed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "completed" | "failed";
        task: string;
        toAgent: string;
    }, {
        status: "pending" | "completed" | "failed";
        task: string;
        toAgent: string;
    }>, "many">>;
    /** Error information if failed */
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: unknown;
    }, {
        code: string;
        message: string;
        details?: unknown;
    }>>;
    /** Metadata about execution */
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    output: string;
    agentId: string;
    duration: number;
    delegations: {
        status: "pending" | "completed" | "failed";
        task: string;
        toAgent: string;
    }[];
    metadata?: Record<string, unknown> | undefined;
    provider?: string | undefined;
    tokens?: {
        output?: number | undefined;
        input?: number | undefined;
        total?: number | undefined;
    } | undefined;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    } | undefined;
}, {
    success: boolean;
    output: string;
    agentId: string;
    duration: number;
    metadata?: Record<string, unknown> | undefined;
    provider?: string | undefined;
    tokens?: {
        output?: number | undefined;
        input?: number | undefined;
        total?: number | undefined;
    } | undefined;
    delegations?: {
        status: "pending" | "completed" | "failed";
        task: string;
        toAgent: string;
    }[] | undefined;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    } | undefined;
}>;
type AgentResponse = z.infer<typeof AgentResponseSchema>;
/**
 * Agent registration for the agent registry
 */
declare const AgentRegistrationSchema: z.ZodObject<{
    /** Agent profile */
    profile: z.ZodObject<{
        /** Unique identifier for the agent (lowercase, alphanumeric with hyphens) */
        name: z.ZodBranded<z.ZodString, "AgentId">;
        /** Human-friendly display name */
        displayName: z.ZodString;
        /** Agent's role description */
        role: z.ZodString;
        /** Team affiliation */
        team: z.ZodDefault<z.ZodString>;
        /** Detailed description of agent capabilities */
        description: z.ZodOptional<z.ZodString>;
        /** List of ability identifiers */
        abilities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Smart ability selection configuration */
        abilitySelection: z.ZodOptional<z.ZodObject<{
            /** Core abilities always loaded for this agent */
            core: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Task-based abilities loaded by keyword matching */
            taskBased: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
        }, "strip", z.ZodTypeAny, {
            core: string[];
            taskBased: Record<string, string[]>;
        }, {
            core?: string[] | undefined;
            taskBased?: Record<string, string[]> | undefined;
        }>>;
        /** Agent personality configuration */
        personality: z.ZodOptional<z.ZodObject<{
            /** Character traits that define the agent's behavior (1-5 traits) */
            traits: z.ZodArray<z.ZodString, "many">;
            /** Optional catchphrase or signature expression */
            catchphrase: z.ZodOptional<z.ZodString>;
            /** How the agent communicates */
            communicationStyle: z.ZodDefault<z.ZodEnum<["formal", "casual", "technical", "friendly"]>>;
            /** How the agent makes decisions */
            decisionMaking: z.ZodDefault<z.ZodEnum<["data-driven", "intuitive", "collaborative", "analytical"]>>;
        }, "strip", z.ZodTypeAny, {
            traits: string[];
            communicationStyle: "formal" | "casual" | "technical" | "friendly";
            decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
            catchphrase?: string | undefined;
        }, {
            traits: string[];
            catchphrase?: string | undefined;
            communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
            decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
        }>>;
        /** Orchestration settings */
        orchestration: z.ZodDefault<z.ZodObject<{
            /** Maximum depth of delegation chain (0 = cannot delegate) */
            maxDelegationDepth: z.ZodDefault<z.ZodNumber>;
            /** Workspaces this agent can read from */
            canReadWorkspaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Whether agent can write to shared workspace */
            canWriteToShared: z.ZodDefault<z.ZodBoolean>;
            /** Agents this agent can delegate to */
            canDelegateTo: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            /** Priority level for task routing (1 = highest) */
            priority: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxDelegationDepth: number;
            canReadWorkspaces: string[];
            canWriteToShared: boolean;
            canDelegateTo: string[];
            priority: number;
        }, {
            maxDelegationDepth?: number | undefined;
            canReadWorkspaces?: string[] | undefined;
            canWriteToShared?: boolean | undefined;
            canDelegateTo?: string[] | undefined;
            priority?: number | undefined;
        }>>;
        /** System prompt that defines agent behavior */
        systemPrompt: z.ZodString;
        /** Whether agent is enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Agent version for tracking changes */
        version: z.ZodDefault<z.ZodString>;
        /** Custom metadata */
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string & z.BRAND<"AgentId">;
        displayName: string;
        role: string;
        team: string;
        abilities: string[];
        orchestration: {
            maxDelegationDepth: number;
            canReadWorkspaces: string[];
            canWriteToShared: boolean;
            canDelegateTo: string[];
            priority: number;
        };
        systemPrompt: string;
        enabled: boolean;
        version: string;
        description?: string | undefined;
        abilitySelection?: {
            core: string[];
            taskBased: Record<string, string[]>;
        } | undefined;
        personality?: {
            traits: string[];
            communicationStyle: "formal" | "casual" | "technical" | "friendly";
            decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
            catchphrase?: string | undefined;
        } | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        name: string;
        displayName: string;
        role: string;
        systemPrompt: string;
        team?: string | undefined;
        description?: string | undefined;
        abilities?: string[] | undefined;
        abilitySelection?: {
            core?: string[] | undefined;
            taskBased?: Record<string, string[]> | undefined;
        } | undefined;
        personality?: {
            traits: string[];
            catchphrase?: string | undefined;
            communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
            decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
        } | undefined;
        orchestration?: {
            maxDelegationDepth?: number | undefined;
            canReadWorkspaces?: string[] | undefined;
            canWriteToShared?: boolean | undefined;
            canDelegateTo?: string[] | undefined;
            priority?: number | undefined;
        } | undefined;
        enabled?: boolean | undefined;
        version?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>;
    /** Registration timestamp */
    registeredAt: z.ZodDate;
    /** Last updated timestamp */
    updatedAt: z.ZodDate;
    /** Source file path */
    sourcePath: z.ZodOptional<z.ZodString>;
    /** Health score (0-1) based on recent executions */
    healthScore: z.ZodDefault<z.ZodNumber>;
    /** Total executions */
    executionCount: z.ZodDefault<z.ZodNumber>;
    /** Successful executions */
    successCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    profile: {
        name: string & z.BRAND<"AgentId">;
        displayName: string;
        role: string;
        team: string;
        abilities: string[];
        orchestration: {
            maxDelegationDepth: number;
            canReadWorkspaces: string[];
            canWriteToShared: boolean;
            canDelegateTo: string[];
            priority: number;
        };
        systemPrompt: string;
        enabled: boolean;
        version: string;
        description?: string | undefined;
        abilitySelection?: {
            core: string[];
            taskBased: Record<string, string[]>;
        } | undefined;
        personality?: {
            traits: string[];
            communicationStyle: "formal" | "casual" | "technical" | "friendly";
            decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
            catchphrase?: string | undefined;
        } | undefined;
        metadata?: Record<string, unknown> | undefined;
    };
    registeredAt: Date;
    updatedAt: Date;
    healthScore: number;
    executionCount: number;
    successCount: number;
    sourcePath?: string | undefined;
}, {
    profile: {
        name: string;
        displayName: string;
        role: string;
        systemPrompt: string;
        team?: string | undefined;
        description?: string | undefined;
        abilities?: string[] | undefined;
        abilitySelection?: {
            core?: string[] | undefined;
            taskBased?: Record<string, string[]> | undefined;
        } | undefined;
        personality?: {
            traits: string[];
            catchphrase?: string | undefined;
            communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
            decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
        } | undefined;
        orchestration?: {
            maxDelegationDepth?: number | undefined;
            canReadWorkspaces?: string[] | undefined;
            canWriteToShared?: boolean | undefined;
            canDelegateTo?: string[] | undefined;
            priority?: number | undefined;
        } | undefined;
        enabled?: boolean | undefined;
        version?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    };
    registeredAt: Date;
    updatedAt: Date;
    sourcePath?: string | undefined;
    healthScore?: number | undefined;
    executionCount?: number | undefined;
    successCount?: number | undefined;
}>;
type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;
/**
 * Validate agent profile data
 */
declare function validateAgentProfile(data: unknown): AgentProfile;
/**
 * Safe validate agent profile data
 */
declare function safeValidateAgentProfile(data: unknown): z.SafeParseReturnType<unknown, AgentProfile>;
/**
 * Create a partial agent profile for updates
 */
declare const PartialAgentProfileSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    team: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    abilities: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    abilitySelection: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        /** Core abilities always loaded for this agent */
        core: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Task-based abilities loaded by keyword matching */
        taskBased: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        core: string[];
        taskBased: Record<string, string[]>;
    }, {
        core?: string[] | undefined;
        taskBased?: Record<string, string[]> | undefined;
    }>>>;
    personality: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        /** Character traits that define the agent's behavior (1-5 traits) */
        traits: z.ZodArray<z.ZodString, "many">;
        /** Optional catchphrase or signature expression */
        catchphrase: z.ZodOptional<z.ZodString>;
        /** How the agent communicates */
        communicationStyle: z.ZodDefault<z.ZodEnum<["formal", "casual", "technical", "friendly"]>>;
        /** How the agent makes decisions */
        decisionMaking: z.ZodDefault<z.ZodEnum<["data-driven", "intuitive", "collaborative", "analytical"]>>;
    }, "strip", z.ZodTypeAny, {
        traits: string[];
        communicationStyle: "formal" | "casual" | "technical" | "friendly";
        decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
        catchphrase?: string | undefined;
    }, {
        traits: string[];
        catchphrase?: string | undefined;
        communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
        decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
    }>>>;
    orchestration: z.ZodOptional<z.ZodDefault<z.ZodObject<{
        /** Maximum depth of delegation chain (0 = cannot delegate) */
        maxDelegationDepth: z.ZodDefault<z.ZodNumber>;
        /** Workspaces this agent can read from */
        canReadWorkspaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Whether agent can write to shared workspace */
        canWriteToShared: z.ZodDefault<z.ZodBoolean>;
        /** Agents this agent can delegate to */
        canDelegateTo: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Priority level for task routing (1 = highest) */
        priority: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxDelegationDepth: number;
        canReadWorkspaces: string[];
        canWriteToShared: boolean;
        canDelegateTo: string[];
        priority: number;
    }, {
        maxDelegationDepth?: number | undefined;
        canReadWorkspaces?: string[] | undefined;
        canWriteToShared?: boolean | undefined;
        canDelegateTo?: string[] | undefined;
        priority?: number | undefined;
    }>>>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    version: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
} & {
    name: z.ZodBranded<z.ZodString, "AgentId">;
}, "strip", z.ZodTypeAny, {
    name: string & z.BRAND<"AgentId">;
    displayName?: string | undefined;
    role?: string | undefined;
    team?: string | undefined;
    description?: string | undefined;
    abilities?: string[] | undefined;
    abilitySelection?: {
        core: string[];
        taskBased: Record<string, string[]>;
    } | undefined;
    personality?: {
        traits: string[];
        communicationStyle: "formal" | "casual" | "technical" | "friendly";
        decisionMaking: "data-driven" | "intuitive" | "collaborative" | "analytical";
        catchphrase?: string | undefined;
    } | undefined;
    orchestration?: {
        maxDelegationDepth: number;
        canReadWorkspaces: string[];
        canWriteToShared: boolean;
        canDelegateTo: string[];
        priority: number;
    } | undefined;
    systemPrompt?: string | undefined;
    enabled?: boolean | undefined;
    version?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    name: string;
    displayName?: string | undefined;
    role?: string | undefined;
    team?: string | undefined;
    description?: string | undefined;
    abilities?: string[] | undefined;
    abilitySelection?: {
        core?: string[] | undefined;
        taskBased?: Record<string, string[]> | undefined;
    } | undefined;
    personality?: {
        traits: string[];
        catchphrase?: string | undefined;
        communicationStyle?: "formal" | "casual" | "technical" | "friendly" | undefined;
        decisionMaking?: "data-driven" | "intuitive" | "collaborative" | "analytical" | undefined;
    } | undefined;
    orchestration?: {
        maxDelegationDepth?: number | undefined;
        canReadWorkspaces?: string[] | undefined;
        canWriteToShared?: boolean | undefined;
        canDelegateTo?: string[] | undefined;
        priority?: number | undefined;
    } | undefined;
    systemPrompt?: string | undefined;
    enabled?: boolean | undefined;
    version?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
type PartialAgentProfile = z.infer<typeof PartialAgentProfileSchema>;

export { type AbilitySelection, AbilitySelectionSchema, type AgentProfile, AgentProfileSchema, type AgentRegistration, AgentRegistrationSchema, type AgentResponse, AgentResponseSchema, CommunicationStyle, DecisionMaking, type ExecutionContext, ExecutionContextSchema, type Orchestration, OrchestrationSchema, type PartialAgentProfile, PartialAgentProfileSchema, type Personality, PersonalitySchema, safeValidateAgentProfile, validateAgentProfile };
