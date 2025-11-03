/**
 * Types for ax-cli interactive mode
 *
 * Based on Gemini CLI patterns, adapted for AutomatosX
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  provider?: string;
}

export interface Conversation {
  id: string;
  name?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    provider?: string;
    totalTokens?: number;
    totalCost?: number;
  };
}

/**
 * Bug #12 fix: Replace `any` with discriminated union types for type safety
 * Each event type has a specific data shape
 */
export type StreamEvent =
  | {
      type: 'token';
      data: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'tool_call';
      data: {
        tool: string;
        args: Record<string, unknown>;
      };
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'agent_delegation';
      data: AgentDelegation;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'provider_switch';
      data: {
        provider: string;
        reason?: string;
      };
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'completion';
      data: {
        tokensUsed: number;
        provider: string;
        model?: string;
      };
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'error';
      data: {
        message: string;
        code?: string;
        suggestions?: string[];
        context?: Record<string, unknown>;
        error?: Error;
      };
      metadata?: Record<string, unknown>;
    };

export interface AgentDelegation {
  agent: string;
  task: string;
}

/**
 * Bug #12 fix: Replace `any` with proper types
 * Complete interface matching actual implementations
 */
export interface CommandContext {
  conversation: Conversation;
  currentProvider: string;
  workspaceRoot?: string;
  agentExecutor?: {
    execute(delegation: AgentDelegation): Promise<{
      success: boolean;
      output: string;
      error?: Error;
    }>;
    listAgents(): Promise<Array<{ name: string; description?: string }>>;
    isAgentAvailable(agentName: string): Promise<boolean>;
  };
  conversationManager?: {
    addMessage(role: 'user' | 'assistant' | 'system', content: string): void;
    getContext(): Message[];  // Returns messages array, not full Conversation
    getConversation(): Conversation;  // Returns full conversation
    save(): Promise<void>;
    saveAs(name: string): Promise<string>;
    load(conversation: Conversation): void;
    loadFromFile(filepath: string): Promise<void>;
    listConversations(): Promise<Array<{
      filename: string;
      name?: string;
      messageCount: number;
      createdAt: number;
      updatedAt: number;
    }>>;
    deleteConversation(filename: string): Promise<void>;
    getStats(): {
      messageCount: number;
      totalTokens: number;
      duration: number;
    };
    exportToMarkdownFile(): Promise<string>;
  };
}

export interface CommandHandler {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  execute(args: string[], context: CommandContext): Promise<void>;
}

export interface REPLConfig {
  welcomeMessage: boolean;
  colors: boolean;
  spinner: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  historyPath: string;
  conversationsPath: string;
}
