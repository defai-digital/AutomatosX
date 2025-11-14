/**
 * AutomatosX v8.0.0 - Interactive CLI Types
 *
 * Shared type definitions for Interactive CLI Mode
 */
import type { Database } from 'better-sqlite3';
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
/**
 * REPL session configuration options
 */
export interface REPLOptions {
    /** Prompt string (default: "> ") */
    prompt?: string;
    /** Welcome message to display on startup */
    welcomeMessage?: string;
    /** Enable autocomplete for slash commands */
    enableAutocomplete?: boolean;
    /** Save context interval (milliseconds, default: 5 messages) */
    contextSaveInterval?: number;
    /** User ID for conversation tracking */
    userId?: string;
}
/**
 * REPL session state
 */
export interface REPLState {
    /** Is REPL currently processing a command? */
    isProcessing: boolean;
    /** Current conversation ID */
    conversationId: string | null;
    /** Number of messages in current session */
    messageCount: number;
    /** Last input received */
    lastInput: string | null;
    /** Session start time */
    startedAt: Date;
}
/**
 * Command execution context
 */
export interface CommandContext {
    /** Current conversation ID */
    conversationId: string;
    /** User ID */
    userId: string;
    /** Active agent name (if set) */
    activeAgent?: string;
    /** Active workflow path (if set) */
    activeWorkflow?: string;
    /** Context variables */
    variables: Record<string, unknown>;
    /** Last command results */
    lastResults?: unknown;
    /** Database connection */
    db: Database;
    /** Provider router for AI calls */
    providerRouter: ProviderRouterV2;
    /** Agent registry */
    agentRegistry: AgentRegistry;
}
/**
 * Slash command interface
 */
export interface SlashCommand {
    /** Command name (without /) */
    name: string;
    /** Command description */
    description: string;
    /** Usage example */
    usage: string;
    /** Command aliases */
    aliases?: string[];
    /** Execute the command */
    execute(args: string[], context: CommandContext): Promise<void>;
}
/**
 * Command execution result
 */
export interface CommandResult {
    /** Success flag */
    success: boolean;
    /** Output message */
    message?: string;
    /** Error if failed */
    error?: Error;
    /** Result data */
    data?: unknown;
}
/**
 * Natural language routing intent
 */
export interface Intent {
    /** Intent type */
    type: 'query' | 'workflow' | 'agent' | 'chat' | 'command' | 'unknown';
    /** Confidence score (0.0-1.0) */
    confidence: number;
    /** Extracted parameters */
    parameters?: Record<string, unknown>;
    /** Reasoning for classification */
    reasoning?: string;
}
/**
 * Conversation message
 */
export interface Message {
    /** Message ID */
    id: string;
    /** Conversation ID */
    conversationId: string;
    /** Message role */
    role: 'user' | 'assistant' | 'system';
    /** Message content */
    content: string;
    /** Timestamp */
    timestamp: Date;
    /** Tokens used */
    tokensUsed?: number;
    /** Metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Conversation context snapshot
 */
export interface ContextSnapshot {
    /** Conversation ID */
    conversationId: string;
    /** User ID */
    userId: string;
    /** All messages in conversation */
    messages: Message[];
    /** Active agent */
    activeAgent?: string;
    /** Active workflow */
    activeWorkflow?: string;
    /** Context variables */
    variables: Record<string, unknown>;
    /** Created at */
    createdAt: Date;
    /** Updated at */
    updatedAt: Date;
}
/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
    /** Full command to insert */
    completion: string;
    /** Display text */
    display: string;
    /** Description */
    description?: string;
}
//# sourceMappingURL=types.d.ts.map