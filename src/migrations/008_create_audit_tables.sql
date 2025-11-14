-- Migration 008: Audit Logging Tables
-- Phase 5 Week 4: Audit & Compliance

-- Audit log table (append-only, tamper-proof)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  metadata TEXT,  -- JSON with additional context
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  signature TEXT NOT NULL,  -- HMAC for tamper detection
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_log(outcome);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_log(request_id);

-- Audit log retention policy tracking
CREATE TABLE IF NOT EXISTS audit_retention (
  id TEXT PRIMARY KEY,
  archive_date INTEGER NOT NULL,
  archive_type TEXT NOT NULL CHECK (archive_type IN ('warm', 'cold')),
  archive_path TEXT NOT NULL,
  start_timestamp INTEGER NOT NULL,
  end_timestamp INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  compressed_size INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_retention_date ON audit_retention(archive_date);
CREATE INDEX IF NOT EXISTS idx_audit_retention_type ON audit_retention(archive_type);

-- Compliance report cache
CREATE TABLE IF NOT EXISTS compliance_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  report_data TEXT NOT NULL,  -- JSON report
  generated_at INTEGER NOT NULL,
  generated_by TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_tenant ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_dates ON compliance_reports(start_date, end_date);
