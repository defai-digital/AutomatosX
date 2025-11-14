/**
 * security.types.ts
 *
 * Type definitions for security, RBAC, multi-tenancy, and audit logging
 * Phase 5 Week 3-4: Production Readiness
 */

// ============================================================================
// Permissions & RBAC
// ============================================================================

export type Permission =
  | 'workflow.read'
  | 'workflow.write'
  | 'workflow.execute'
  | 'workflow.delete'
  | 'agent.read'
  | 'agent.write'
  | 'agent.delete'
  | 'user.read'
  | 'user.write'
  | 'user.delete'
  | 'role.read'
  | 'role.write'
  | 'role.assign'
  | 'tenant.read'
  | 'tenant.write'
  | 'tenant.suspend'
  | 'admin.manage'
  | 'audit.read'
  | 'audit.export'
  | 'backup.create'
  | 'backup.restore'
  | '*';  // Wildcard permission (admin)

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  description?: string;
  isSystemRole: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  tenantId: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: number;
  assignedBy?: string;
}

// ============================================================================
// Multi-tenancy
// ============================================================================

export type TenantPlan = 'free' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'deleted';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  suspendedAt?: number;
  suspendedReason?: string;
}

export interface TenantQuotas {
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxConcurrentExecutions: number;
  maxStorageBytes: number;
  maxApiCallsPerMonth: number;
  workflowsUsed: number;
  executionsThisMonth: number;
  concurrentExecutions: number;
  storageBytesUsed: number;
  apiCallsThisMonth: number;
  lastResetAt: number;
}

export type QuotaType = keyof Pick<
  TenantQuotas,
  'workflowsUsed' | 'executionsThisMonth' | 'concurrentExecutions' | 'storageBytesUsed' | 'apiCallsThisMonth'
>;

export interface TenantWithQuotas extends Tenant {
  quotas: TenantQuotas;
}

// ============================================================================
// Secrets Management
// ============================================================================

export interface Secret {
  id: string;
  tenantId: string;
  key: string;
  encryptedValue: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  rotatedAt?: number;
}

export interface SecretValue {
  key: string;
  value: string;  // Decrypted value
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimit {
  scope: 'user' | 'tenant' | 'global';
  maxTokens: number;
  refillRate: number;  // tokens per second
  windowMs: number;
}

export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// Audit Logging
// ============================================================================

export type AuditAction =
  | 'workflow.create'
  | 'workflow.read'
  | 'workflow.update'
  | 'workflow.delete'
  | 'workflow.execute'
  | 'workflow.cancel'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.login'
  | 'user.logout'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'role.assign'
  | 'role.revoke'
  | 'tenant.create'
  | 'tenant.update'
  | 'tenant.suspend'
  | 'tenant.activate'
  | 'secret.create'
  | 'secret.read'
  | 'secret.update'
  | 'secret.delete'
  | 'backup.create'
  | 'backup.restore'
  | 'audit.export';

export type AuditOutcome = 'success' | 'failure' | 'denied';

export type AuditResourceType =
  | 'workflow'
  | 'user'
  | 'tenant'
  | 'role'
  | 'secret'
  | 'backup'
  | 'audit';

export interface AuditEvent {
  id: string;
  timestamp: number;
  tenantId: string;
  userId: string;
  action: AuditAction;
  resource: string;  // e.g., 'workflow:abc123'
  resourceType: AuditResourceType;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  durationMs?: number;
  errorMessage?: string;
  signature: string;  // HMAC for tamper detection
}

export interface AuditFilter {
  tenantId?: string;
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  outcome?: AuditOutcome;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface AuditRetention {
  id: string;
  archiveDate: number;
  archiveType: 'warm' | 'cold';
  archivePath: string;
  startTimestamp: number;
  endTimestamp: number;
  eventCount: number;
  compressedSize: number;
  checksum: string;
  createdAt: number;
}

export interface ComplianceReport {
  id: string;
  tenantId: string;
  reportType: string;
  startDate: number;
  endDate: number;
  reportData: {
    totalEvents: number;
    successfulActions: number;
    failedActions: number;
    deniedActions: number;
    actionBreakdown: Record<AuditAction, number>;
    userActivity: Record<string, number>;
    integrityVerification: {
      totalChecked: number;
      tamperedEvents: number;
    };
  };
  generatedAt: number;
  generatedBy: string;
}

// ============================================================================
// Backup & Disaster Recovery
// ============================================================================

export type BackupType = 'full' | 'incremental';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'deleted';

export interface Backup {
  id: string;
  timestamp: number;
  type: BackupType;
  size: number;
  compressedSize: number;
  checksum: string;
  encryptionEnabled: boolean;
  backupPath: string;
  metadata: {
    dbVersion: string;
    recordCount: Record<string, number>;
  };
  status: BackupStatus;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
  retentionUntil?: number;
  uploadedToRemote: boolean;
}

export type BackupDestinationType = 'local' | 's3' | 'gcs' | 'azure';

export interface BackupDestination {
  id: string;
  name: string;
  type: BackupDestinationType;
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string;  // cron expression
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  compression: 'gzip' | 'zstd';
  encryption: boolean;
  destinations: string[];  // destination IDs
}

export type RestoreType = 'full' | 'point_in_time';
export type RestoreStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface RestoreOperation {
  id: string;
  backupId: string;
  restoreType: RestoreType;
  targetTimestamp?: number;  // For PITR
  status: RestoreStatus;
  startedAt: number;
  completedAt?: number;
  initiatedBy: string;
  errorMessage?: string;
  validationResult?: {
    checksumValid: boolean;
    tablesRestored: string[];
    recordsRestored: number;
  };
}

// ============================================================================
// Execution Context
// ============================================================================

export interface ExecutionContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

// ============================================================================
// Errors
// ============================================================================

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Permission denied: ${permission}`);
    this.name = 'ForbiddenError';
  }
}

export class QuotaExceededError extends Error {
  constructor(tenantId: string, quotaType: QuotaType) {
    super(`Quota exceeded for tenant ${tenantId}: ${quotaType}`);
    this.name = 'QuotaExceededError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(retryAfter?: number) {
    super(`Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`);
    this.name = 'RateLimitExceededError';
  }
}

export class TenantSuspendedError extends Error {
  constructor(tenantId: string, reason?: string) {
    super(`Tenant ${tenantId} is suspended${reason ? `: ${reason}` : ''}`);
    this.name = 'TenantSuspendedError';
  }
}
