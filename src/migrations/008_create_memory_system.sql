-- Migration 008: Memory System
-- Creates tables for conversation and message persistence with FTS5 search
-- Author: AutomatosX Team
-- Date: 2025-11-09

-- ============================================================================
-- Conversations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle' CHECK(state IN ('idle', 'active', 'searching', 'archived', 'deleted')),
  message_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  metadata TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- ============================================================================
-- Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'function', 'tool')),
  content TEXT NOT NULL,
  tokens INTEGER,
  metadata TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================================================
-- Messages FTS5 Search
-- ============================================================================
-- Contentless FTS5 table (stores only the index, not the actual content)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

-- Triggers to keep FTS5 in sync with messages table
-- Insert trigger
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

-- Update trigger
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

-- Delete trigger
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;

-- ============================================================================
-- Agents Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  expertise TEXT NOT NULL, -- JSON array of expertise areas
  capabilities TEXT NOT NULL, -- JSON array of capabilities
  allowed_tools TEXT NOT NULL, -- JSON array of allowed tool IDs
  max_concurrent_tasks INTEGER NOT NULL DEFAULT 5,
  metadata TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);

-- ============================================================================
-- Agent State Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_state (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle' CHECK(state IN (
    'idle', 'planning', 'validating_task', 'selecting_tools',
    'executing_tools', 'processing_results', 'delegating',
    'awaiting_delegation', 'completing', 'completed', 'failed', 'paused'
  )),
  current_task TEXT,
  task_queue TEXT NOT NULL DEFAULT '[]', -- JSON array
  metadata TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_state_agent_id ON agent_state(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_state_conversation_id ON agent_state(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_state_state ON agent_state(state);

-- ============================================================================
-- Workflows Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  definition TEXT NOT NULL, -- YAML or JSON workflow definition
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
  )),
  execution_id TEXT,
  metadata TEXT, -- JSON string
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_execution_id ON workflows(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);

-- ============================================================================
-- Memory Statistics View
-- ============================================================================
CREATE VIEW IF NOT EXISTS memory_stats AS
SELECT
  (SELECT COUNT(*) FROM conversations) AS total_conversations,
  (SELECT COUNT(*) FROM conversations WHERE state = 'active') AS active_conversations,
  (SELECT COUNT(*) FROM conversations WHERE state = 'archived') AS archived_conversations,
  (SELECT COUNT(*) FROM conversations WHERE state = 'deleted') AS deleted_conversations,
  (SELECT COUNT(*) FROM messages) AS total_messages,
  (SELECT SUM(COALESCE(tokens, 0)) FROM messages) AS total_tokens,
  (SELECT CAST(COUNT(*) AS REAL) / NULLIF(COUNT(DISTINCT conversation_id), 0) FROM messages) AS avg_messages_per_conversation,
  (SELECT CAST(SUM(COALESCE(tokens, 0)) AS REAL) / NULLIF(COUNT(*), 0) FROM messages WHERE tokens IS NOT NULL) AS avg_tokens_per_message,
  (SELECT MIN(created_at) FROM conversations) AS oldest_conversation,
  (SELECT MAX(created_at) FROM conversations) AS newest_conversation;

-- ============================================================================
-- Insert Default System Agent
-- ============================================================================
INSERT OR IGNORE INTO agents (
  id,
  name,
  description,
  expertise,
  capabilities,
  allowed_tools,
  max_concurrent_tasks,
  metadata,
  created_at,
  updated_at
) VALUES (
  'system',
  'System Agent',
  'Default system agent for AutomatosX memory management',
  '["memory", "conversation", "system"]',
  '["Manage conversations", "Store messages", "Search memory"]',
  '[]',
  10,
  '{}',
  (strftime('%s', 'now') * 1000),
  (strftime('%s', 'now') * 1000)
);

-- ============================================================================
-- Migration Complete
-- ============================================================================
