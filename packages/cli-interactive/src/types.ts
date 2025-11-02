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

export interface StreamEvent {
  type: 'token' | 'tool_call' | 'agent_delegation' | 'provider_switch' | 'completion' | 'error';
  data: any;
  metadata?: Record<string, any>;
}

export interface AgentDelegation {
  agent: string;
  task: string;
}

export interface CommandContext {
  conversation: Conversation;
  currentProvider: string;
  workspaceRoot?: string;
  agentExecutor?: any; // Import type from agent-bridge if needed
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
