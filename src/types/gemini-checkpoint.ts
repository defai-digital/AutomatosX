/**
 * Gemini Checkpoint Types
 *
 * Conversation checkpointing for Gemini CLI sessions.
 * Enables save/resume of long-running agent conversations.
 */

export interface GeminiCheckpoint {
  /** Unique checkpoint identifier */
  id: string;
  
  /** Session identifier this checkpoint belongs to */
  sessionId: string;
  
  /** Conversation identifier */
  conversationId: string;
  
  /** Checkpoint creation timestamp */
  createdAt: Date;
  
  /** Checkpoint metadata */
  metadata: CheckpointMetadata;
  
  /** Serialized conversation state */
  conversationState: {
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
      metadata?: Record<string, unknown>;
    }>;
    context?: Record<string, unknown>;
    tools?: string[];
    model?: string;
  };
  
  /** Checkpoint file path */
  filePath?: string;
  
  /** Checkpoint size in bytes */
  size: number;
}

export interface CheckpointMetadata {
  /** Checkpoint title/name */
  title?: string;
  
  /** Checkpoint description */
  description?: string;
  
  /** Number of messages in checkpoint */
  messageCount: number;
  
  /** Total tokens used (if available) */
  totalTokens?: number;
  
  /** Tools used in conversation */
  toolsUsed?: string[];
  
  /** Files modified during conversation */
  filesModified?: string[];
  
  /** Checkpoint tags for organization */
  tags?: string[];
  
  /** Whether checkpoint is auto-saved */
  autoSaved: boolean;
  
  /** Checkpoint version for compatibility */
  version: string;
}

export interface CheckpointStorage {
  /** Storage backend type */
  type: 'filesystem' | 'memory' | 'custom';
  
  /** Storage configuration */
  config: {
    /** Base path for filesystem storage */
    basePath?: string;
    
    /** Maximum storage size in bytes */
    maxSize?: number;
    
    /** Maximum number of checkpoints */
    maxCheckpoints?: number;
    
    /** Retention period in days */
    retentionDays?: number;
    
    /** Compression enabled */
    compression?: boolean;
  };
}

export interface CheckpointConfig {
  /** Enable checkpointing */
  enabled: boolean;
  
  /** Auto-save checkpoints */
  autoSave: boolean;
  
  /** Auto-save interval (number of messages) */
  autoSaveInterval: number;
  
  /** Maximum checkpoints to retain */
  maxCheckpoints: number;
  
  /** Retention period in days */
  retentionDays: number;
  
  /** Checkpoint storage path */
  path: string;
  
  /** Storage configuration */
  storage: CheckpointStorage;
}

export interface CheckpointInfo {
  /** Checkpoint ID */
  id: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Conversation ID */
  conversationId: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Checkpoint metadata */
  metadata: CheckpointMetadata;
  
  /** File size in bytes */
  size: number;
  
  /** Whether checkpoint is valid */
  valid: boolean;
}

export interface CheckpointListOptions {
  /** Filter by session ID */
  sessionId?: string;
  
  /** Filter by conversation ID */
  conversationId?: string;
  
  /** Filter by date range */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  
  /** Filter by tags */
  tags?: string[];
  
  /** Maximum number of results */
  limit?: number;
  
  /** Sort order */
  sortBy?: 'createdAt' | 'size' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
}

export interface CheckpointSaveOptions {
  /** Checkpoint title */
  title?: string;
  
  /** Checkpoint description */
  description?: string;
  
  /** Checkpoint tags */
  tags?: string[];
  
  /** Whether to override auto-save setting */
  force?: boolean;
  
  /** Custom storage path */
  customPath?: string;
}

export interface CheckpointLoadOptions {
  /** Whether to validate checkpoint integrity */
  validate?: boolean;
  
  /** Whether to merge with current session */
  merge?: boolean;
  
  /** Resume from specific message index */
  fromMessage?: number;
}