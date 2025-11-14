/**
 * TenantService.ts
 *
 * Multi-tenancy management service
 * Phase 5 Week 3: Multi-tenancy
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { Tenant, TenantPlan, TenantStatus, TenantWithQuotas, TenantSuspendedError } from '../types/security.types.js';
import { getDatabase } from '../database/connection.js';

export class TenantService extends EventEmitter {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    super();
    this.db = db || getDatabase();
  }

  async createTenant(name: string, slug: string, plan: TenantPlan = 'free'): Promise<Tenant> {
    const id = `tenant_${randomUUID()}`;
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO tenants (id, name, slug, plan, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(id, name, slug, plan, now, now);

    // Initialize quotas based on plan
    await this.initializeQuotas(id, plan);

    const tenant: Tenant = { id, name, slug, plan, status: 'active', createdAt: now, updatedAt: now };
    this.emit('tenant_created', { tenant });

    return tenant;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const row = this.db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suspendedAt: row.suspended_at,
      suspendedReason: row.suspended_reason,
    };
  }

  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tenants
      SET status = 'suspended', suspended_at = ?, suspended_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(now, reason, now, tenantId);

    this.emit('tenant_suspended', { tenantId, reason });
  }

  async activateTenant(tenantId: string): Promise<void> {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tenants
      SET status = 'active', suspended_at = NULL, suspended_reason = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, tenantId);

    this.emit('tenant_activated', { tenantId });
  }

  private async initializeQuotas(tenantId: string, plan: TenantPlan): Promise<void> {
    const quotas = this.getDefaultQuotas(plan);
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO tenant_quotas (
        tenant_id, max_workflows, max_executions_per_month, max_concurrent_executions,
        max_storage_bytes, max_api_calls_per_month, last_reset_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenantId,
      quotas.maxWorkflows,
      quotas.maxExecutionsPerMonth,
      quotas.maxConcurrentExecutions,
      quotas.maxStorageBytes,
      quotas.maxApiCallsPerMonth,
      now
    );
  }

  private getDefaultQuotas(plan: TenantPlan) {
    const quotasByPlan = {
      free: {
        maxWorkflows: 5,
        maxExecutionsPerMonth: 100,
        maxConcurrentExecutions: 2,
        maxStorageBytes: 104857600, // 100MB
        maxApiCallsPerMonth: 1000,
      },
      pro: {
        maxWorkflows: 50,
        maxExecutionsPerMonth: 10000,
        maxConcurrentExecutions: 10,
        maxStorageBytes: 1073741824, // 1GB
        maxApiCallsPerMonth: 100000,
      },
      enterprise: {
        maxWorkflows: -1, // unlimited
        maxExecutionsPerMonth: -1,
        maxConcurrentExecutions: 50,
        maxStorageBytes: -1,
        maxApiCallsPerMonth: -1,
      },
    };

    return quotasByPlan[plan];
  }
}
