-- Migration 007: Security Tables (RBAC, Users, Roles)
-- Phase 5 Week 3: Security & Multi-tenancy

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL,  -- JSON array of permissions
  description TEXT,
  is_system_role INTEGER NOT NULL DEFAULT 0,  -- 1 for built-in roles
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- User-Role assignments (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  assigned_by TEXT,  -- User ID who assigned this role
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  settings TEXT,  -- JSON configuration
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  suspended_at INTEGER,
  suspended_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Tenant quotas
CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id TEXT PRIMARY KEY,
  max_workflows INTEGER NOT NULL DEFAULT 5,
  max_executions_per_month INTEGER NOT NULL DEFAULT 100,
  max_concurrent_executions INTEGER NOT NULL DEFAULT 2,
  max_storage_bytes INTEGER NOT NULL DEFAULT 104857600,  -- 100 MB
  max_api_calls_per_month INTEGER NOT NULL DEFAULT 1000,
  workflows_used INTEGER NOT NULL DEFAULT 0,
  executions_this_month INTEGER NOT NULL DEFAULT 0,
  concurrent_executions INTEGER NOT NULL DEFAULT 0,
  storage_bytes_used INTEGER NOT NULL DEFAULT 0,
  api_calls_this_month INTEGER NOT NULL DEFAULT 0,
  last_reset_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Encrypted secrets storage
CREATE TABLE IF NOT EXISTS secrets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  rotated_at INTEGER,
  UNIQUE(tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_secrets_tenant ON secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_key ON secrets(tenant_id, key);

-- Add tenant_id to existing workflow tables for multi-tenancy
-- Note: These columns may already exist, use ALTER TABLE IF NOT EXISTS in newer SQLite
-- For compatibility, we use separate ALTER statements with error handling

-- ALTER TABLE workflows ADD COLUMN tenant_id TEXT DEFAULT 'default';
-- ALTER TABLE workflow_executions ADD COLUMN tenant_id TEXT DEFAULT 'default';
-- ALTER TABLE workflow_checkpoints ADD COLUMN tenant_id TEXT DEFAULT 'default';
-- ALTER TABLE workflow_queue ADD COLUMN tenant_id TEXT DEFAULT 'default';

-- Indexes for tenant isolation (will be created after columns exist)
-- CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
-- CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
-- CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_tenant ON workflow_checkpoints(tenant_id);
-- CREATE INDEX IF NOT EXISTS idx_workflow_queue_tenant ON workflow_queue(tenant_id);

-- Insert default system roles
INSERT OR IGNORE INTO roles (id, name, permissions, description, is_system_role, created_at, updated_at) VALUES
  ('role_admin', 'admin', '["*"]', 'Administrator with all permissions', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('role_developer', 'developer', '["workflow.read","workflow.write","workflow.execute","workflow.delete","agent.read","agent.write"]', 'Developer with workflow management permissions', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('role_viewer', 'viewer', '["workflow.read","agent.read","audit.read"]', 'Read-only access to workflows and agents', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
  ('role_auditor', 'auditor', '["workflow.read","agent.read","audit.read","audit.export"]', 'Auditor with read access and audit log export', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Insert default tenant
INSERT OR IGNORE INTO tenants (id, name, slug, plan, status, created_at, updated_at) VALUES
  ('tenant_default', 'Default Tenant', 'default', 'enterprise', 'active', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Insert default quota for default tenant (enterprise = unlimited)
INSERT OR IGNORE INTO tenant_quotas (
  tenant_id, max_workflows, max_executions_per_month, max_concurrent_executions,
  max_storage_bytes, max_api_calls_per_month, last_reset_at
) VALUES (
  'tenant_default', -1, -1, 50, -1, -1, strftime('%s', 'now') * 1000
);
