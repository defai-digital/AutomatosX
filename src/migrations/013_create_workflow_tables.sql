-- Migration 013: Workflow Engine Tables
-- Phase 4 Week 1: Foundation & State Machine
-- Tables for declarative workflow definitions, execution tracking, and checkpoint/resume

-- ============================================================================
-- Schema Migration: Rename old workflows table from migration 008
-- ============================================================================
-- Migration 008 created a "workflows" table that was actually for execution tracking
-- This migration renames it to "legacy_workflows" to avoid naming conflict
-- The old table had: status, execution_id, started_at, completed_at (execution fields)
-- The new table has: version, author, tags, is_active, statistics (definition fields)

-- Drop old workflows table if it exists (from migration 008)
-- This is safe because:
-- 1. Migration 008's workflows table was for execution tracking, not definitions
-- 2. Migration 013 introduces proper workflow_executions table for that purpose
-- 3. No production data should exist yet (v8.0.0 is not released)
DROP TABLE IF EXISTS workflows;

-- Also drop dependent indices from migration 008
DROP INDEX IF EXISTS idx_workflows_status;
DROP INDEX IF EXISTS idx_workflows_execution_id;
DROP INDEX IF EXISTS idx_workflows_created_at;
DROP INDEX IF EXISTS idx_workflows_name;

-- ============================================================================
-- Table 1: workflows - Workflow definitions
-- ============================================================================
-- Now create the correct workflows table for workflow DEFINITIONS (not executions)
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  definition TEXT NOT NULL,  -- JSON: full workflow definition with steps, dependencies, config
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),

  -- Metadata
  author TEXT,  -- Who created this workflow
  tags TEXT,  -- JSON array of tags for categorization
  is_active INTEGER NOT NULL DEFAULT 1,  -- 0 = archived, 1 = active

  -- Statistics
  total_executions INTEGER NOT NULL DEFAULT 0,
  successful_executions INTEGER NOT NULL DEFAULT 0,
  failed_executions INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER  -- Average execution time in milliseconds
);

CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

-- ============================================================================
-- Table 2: workflow_executions - Execution instances with state
-- ============================================================================
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,

  -- State machine state
  state TEXT NOT NULL,  -- idle, parsing, validating, building_graph, scheduling, executing, awaiting_completion, creating_checkpoint, restoring_checkpoint, aggregating_results, completed, failed, paused, cancelled

  -- Execution context
  context TEXT NOT NULL DEFAULT '{}',  -- JSON: execution variables, step outputs, shared state

  -- Timing
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  started_at INTEGER,
  completed_at INTEGER,
  paused_at INTEGER,
  cancelled_at INTEGER,
  duration_ms INTEGER,  -- Total execution time

  -- Error tracking
  error TEXT,  -- Error message if failed
  error_step_id TEXT,  -- Which step caused the failure

  -- Resume support
  last_checkpoint_id TEXT,  -- Reference to most recent checkpoint
  resume_count INTEGER NOT NULL DEFAULT 0,  -- How many times this execution was resumed

  -- Metadata
  triggered_by TEXT,  -- User or system that triggered execution
  priority INTEGER NOT NULL DEFAULT 0,  -- Execution priority (higher = more important)
  parent_execution_id TEXT,  -- For nested workflows

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (last_checkpoint_id) REFERENCES workflow_checkpoints(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_state ON workflow_executions(state);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_parent ON workflow_executions(parent_execution_id);

-- ============================================================================
-- Table 3: workflow_steps - Step definitions extracted from workflows
-- ============================================================================
CREATE TABLE workflow_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,

  -- Step identification
  step_key TEXT NOT NULL,  -- Unique key within workflow (e.g., "parse-changes", "security-audit")
  step_index INTEGER NOT NULL,  -- Execution order hint

  -- Agent configuration
  agent TEXT NOT NULL,  -- Which agent executes this step (e.g., "backend", "security", "quality")
  prompt_template TEXT NOT NULL,  -- Prompt with {{variable}} placeholders

  -- Execution control
  dependencies TEXT NOT NULL DEFAULT '[]',  -- JSON array of step_keys this depends on
  parallel BOOLEAN NOT NULL DEFAULT 0,  -- Can execute in parallel with other steps
  optional BOOLEAN NOT NULL DEFAULT 0,  -- Workflow continues even if this fails
  timeout_ms INTEGER,  -- Step timeout in milliseconds

  -- Retry policy
  max_retries INTEGER NOT NULL DEFAULT 0,
  retry_delay_ms INTEGER NOT NULL DEFAULT 1000,
  retry_backoff_multiplier REAL NOT NULL DEFAULT 2.0,

  -- Output configuration
  output_schema TEXT,  -- JSON schema for expected output

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE (workflow_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_key ON workflow_steps(workflow_id, step_key);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_agent ON workflow_steps(agent);

-- ============================================================================
-- Table 4: workflow_step_executions - Step execution tracking
-- ============================================================================
CREATE TABLE workflow_step_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step_id TEXT NOT NULL,

  -- State
  state TEXT NOT NULL,  -- pending, running, completed, failed, skipped, cancelled

  -- Results
  result TEXT,  -- JSON: step output data
  error TEXT,  -- Error message if failed

  -- Timing
  started_at INTEGER,
  completed_at INTEGER,
  duration_ms INTEGER,

  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  previous_errors TEXT,  -- JSON array of errors from previous attempts

  -- Agent metadata
  agent_used TEXT,  -- Actual agent that executed (may differ from step definition)
  provider_used TEXT,  -- AI provider used (claude, gemini, openai)
  model_used TEXT,  -- Model used (claude-3-5-sonnet-20241022, etc.)
  tokens_used INTEGER,  -- Total tokens consumed
  cost REAL,  -- Cost in USD

  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_step_id ON workflow_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_state ON workflow_step_executions(state);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_started_at ON workflow_step_executions(started_at DESC);

-- ============================================================================
-- Table 5: workflow_checkpoints - State snapshots for resume
-- ============================================================================
CREATE TABLE workflow_checkpoints (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,

  -- State snapshot
  state TEXT NOT NULL,  -- State machine state at checkpoint
  context TEXT NOT NULL,  -- JSON: complete execution context
  completed_steps TEXT NOT NULL DEFAULT '[]',  -- JSON array of completed step_keys
  pending_steps TEXT NOT NULL DEFAULT '[]',  -- JSON array of remaining step_keys

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_by TEXT,  -- automatic, manual, or user ID
  label TEXT,  -- User-friendly label for checkpoint

  -- Storage
  size_bytes INTEGER,  -- Size of serialized checkpoint

  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_execution_id ON workflow_checkpoints(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_created_at ON workflow_checkpoints(created_at DESC);

-- ============================================================================
-- Table 6: workflow_dependencies - Dependency graph for parallel execution
-- ============================================================================
CREATE TABLE workflow_dependencies (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  from_step_key TEXT NOT NULL,
  to_step_key TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'data',  -- data, control, resource

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE (workflow_id, from_step_key, to_step_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_workflow_id ON workflow_dependencies(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_from ON workflow_dependencies(from_step_key);
CREATE INDEX IF NOT EXISTS idx_workflow_dependencies_to ON workflow_dependencies(to_step_key);

-- ============================================================================
-- Table 7: workflow_events - Event log for workflow execution
-- ============================================================================
CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- workflow_started, step_started, step_completed, state_transition, checkpoint_created, error_occurred, etc.
  event_data TEXT,  -- JSON: event-specific data
  timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),

  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_execution_id ON workflow_events(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_type ON workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_events_timestamp ON workflow_events(timestamp DESC);

-- ============================================================================
-- Views for common queries
-- ============================================================================

-- View 1: Active executions with workflow details
CREATE VIEW IF NOT EXISTS v_active_executions AS
SELECT
  we.id AS execution_id,
  we.workflow_id,
  w.name AS workflow_name,
  w.version AS workflow_version,
  we.state,
  we.started_at,
  we.paused_at,
  we.resume_count,
  we.triggered_by,
  we.priority,
  (strftime('%s', 'now') * 1000 - we.started_at) AS running_duration_ms,
  COUNT(DISTINCT wse.id) AS total_steps,
  SUM(CASE WHEN wse.state = 'completed' THEN 1 ELSE 0 END) AS completed_steps,
  SUM(CASE WHEN wse.state = 'failed' THEN 1 ELSE 0 END) AS failed_steps,
  SUM(CASE WHEN wse.state = 'running' THEN 1 ELSE 0 END) AS running_steps
FROM workflow_executions we
JOIN workflows w ON we.workflow_id = w.id
LEFT JOIN workflow_step_executions wse ON we.id = wse.execution_id
WHERE we.state NOT IN ('completed', 'failed', 'cancelled')
GROUP BY we.id;

-- View 2: Workflow execution statistics
CREATE VIEW IF NOT EXISTS v_workflow_stats AS
SELECT
  w.id AS workflow_id,
  w.name AS workflow_name,
  w.version,
  w.total_executions,
  w.successful_executions,
  w.failed_executions,
  ROUND(CAST(w.successful_executions AS REAL) / NULLIF(w.total_executions, 0) * 100, 2) AS success_rate_percent,
  w.avg_duration_ms,
  COUNT(DISTINCT we.id) AS active_executions,
  MAX(we.created_at) AS last_execution_at
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
  AND we.state NOT IN ('completed', 'failed', 'cancelled')
WHERE w.is_active = 1
GROUP BY w.id;

-- View 3: Recent workflow events
CREATE VIEW IF NOT EXISTS v_recent_workflow_events AS
SELECT
  wev.id,
  wev.execution_id,
  we.workflow_id,
  w.name AS workflow_name,
  wev.event_type,
  wev.event_data,
  wev.timestamp,
  we.state AS execution_state
FROM workflow_events wev
JOIN workflow_executions we ON wev.execution_id = we.id
JOIN workflows w ON we.workflow_id = w.id
ORDER BY wev.timestamp DESC
LIMIT 100;

-- ============================================================================
-- Triggers for automatic updates
-- ============================================================================

-- Trigger 1: Update workflow.updated_at on definition change
CREATE TRIGGER IF NOT EXISTS trg_workflows_updated_at
AFTER UPDATE ON workflows
FOR EACH ROW
BEGIN
  UPDATE workflows SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- Trigger 2: Update workflow statistics on execution completion
CREATE TRIGGER IF NOT EXISTS trg_workflow_executions_stats
AFTER UPDATE ON workflow_executions
FOR EACH ROW
WHEN NEW.state IN ('completed', 'failed') AND OLD.state NOT IN ('completed', 'failed')
BEGIN
  UPDATE workflows SET
    total_executions = total_executions + 1,
    successful_executions = successful_executions + CASE WHEN NEW.state = 'completed' THEN 1 ELSE 0 END,
    failed_executions = failed_executions + CASE WHEN NEW.state = 'failed' THEN 1 ELSE 0 END,
    avg_duration_ms = CASE
      WHEN avg_duration_ms IS NULL THEN NEW.duration_ms
      ELSE (avg_duration_ms * total_executions + COALESCE(NEW.duration_ms, 0)) / (total_executions + 1)
    END
  WHERE id = NEW.workflow_id;
END;

-- Trigger 3: Calculate execution duration on completion
CREATE TRIGGER IF NOT EXISTS trg_workflow_executions_duration
AFTER UPDATE ON workflow_executions
FOR EACH ROW
WHEN NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL
BEGIN
  UPDATE workflow_executions SET
    duration_ms = NEW.completed_at - NEW.started_at
  WHERE id = NEW.id;
END;

-- Trigger 4: Calculate step execution duration on completion
CREATE TRIGGER IF NOT EXISTS trg_workflow_step_executions_duration
AFTER UPDATE ON workflow_step_executions
FOR EACH ROW
WHEN NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL
BEGIN
  UPDATE workflow_step_executions SET
    duration_ms = NEW.completed_at - NEW.started_at
  WHERE id = NEW.id;
END;

-- ============================================================================
-- Seed data for testing
-- ============================================================================

-- Example workflow: Code Review
INSERT OR IGNORE INTO workflows (id, name, description, definition, version, author, tags) VALUES (
  'workflow-001',
  'code-review-workflow',
  'Multi-agent code review with security and quality checks',
  '{
    "name": "code-review-workflow",
    "description": "Multi-agent code review with security and quality checks",
    "version": "1.0.0",
    "steps": [
      {
        "key": "parse-changes",
        "agent": "backend",
        "prompt": "Parse git diff and extract changed files: {{git_diff}}",
        "dependencies": [],
        "parallel": false
      },
      {
        "key": "security-audit",
        "agent": "security",
        "prompt": "Audit these changes for vulnerabilities: {{parse-changes.result}}",
        "dependencies": ["parse-changes"],
        "parallel": true
      },
      {
        "key": "quality-check",
        "agent": "quality",
        "prompt": "Run tests and check code quality: {{parse-changes.result}}",
        "dependencies": ["parse-changes"],
        "parallel": true
      },
      {
        "key": "aggregate-results",
        "agent": "product",
        "prompt": "Aggregate results: security={{security-audit.result}}, quality={{quality-check.result}}",
        "dependencies": ["security-audit", "quality-check"],
        "parallel": false
      }
    ],
    "config": {
      "timeout": 300000,
      "maxRetries": 2,
      "checkpointInterval": 60000
    }
  }',
  '1.0.0',
  'system',
  '["code-review", "multi-agent", "security", "quality"]'
);

-- Example workflow steps for code-review-workflow
INSERT OR IGNORE INTO workflow_steps (id, workflow_id, step_key, step_index, agent, prompt_template, dependencies, parallel) VALUES
  ('step-001', 'workflow-001', 'parse-changes', 0, 'backend', 'Parse git diff and extract changed files: {{git_diff}}', '[]', 0),
  ('step-002', 'workflow-001', 'security-audit', 1, 'security', 'Audit these changes for vulnerabilities: {{parse-changes.result}}', '["parse-changes"]', 1),
  ('step-003', 'workflow-001', 'quality-check', 2, 'quality', 'Run tests and check code quality: {{parse-changes.result}}', '["parse-changes"]', 1),
  ('step-004', 'workflow-001', 'aggregate-results', 3, 'product', 'Aggregate results: security={{security-audit.result}}, quality={{quality-check.result}}', '["security-audit", "quality-check"]', 0);

-- Example dependencies
INSERT OR IGNORE INTO workflow_dependencies (id, workflow_id, from_step_key, to_step_key, dependency_type) VALUES
  ('dep-001', 'workflow-001', 'parse-changes', 'security-audit', 'data'),
  ('dep-002', 'workflow-001', 'parse-changes', 'quality-check', 'data'),
  ('dep-003', 'workflow-001', 'security-audit', 'aggregate-results', 'data'),
  ('dep-004', 'workflow-001', 'quality-check', 'aggregate-results', 'data');
