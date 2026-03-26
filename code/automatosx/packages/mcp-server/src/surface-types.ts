import type { JsonSchema } from './tool-schema.js';

export interface MpcToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: McpPromptArgument[];
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface McpPromptResult {
  description: string;
  messages: McpPromptMessage[];
}

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}
