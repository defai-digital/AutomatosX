/**
 * QuotaService.ts
 *
 * Quota tracking and enforcement service
 * Phase 5 Week 3: Multi-tenancy
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { TenantQuotas, QuotaType, QuotaExceededError } from '../types/security.types.js';
import { getDatabase } from '../database/connection.js';

export class QuotaService extends EventEmitter {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    super();
    this.db = db || getDatabase();
  }

  async getQuotas(tenantId: string): Promise<TenantQuotas | null> {
    const row = this.db.prepare(`
      SELECT * FROM tenant_quotas WHERE tenant_id = ?
    `).get(tenantId) as any;

    if (!row) return null;

    return {
      maxWorkflows: row.max_workflows,
      maxExecutionsPerMonth: row.max_executions_per_month,
      maxConcurrentExecutions: row.max_concurrent_executions,
      maxStorageBytes: row.max_storage_bytes,
      maxApiCallsPerMonth: row.max_api_calls_per_month,
      workflowsUsed: row.workflows_used,
      executionsThisMonth: row.executions_this_month,
      concurrentExecutions: row.concurrent_executions,
      storageBytesUsed: row.storage_bytes_used,
      apiCallsThisMonth: row.api_calls_this_month,
      lastResetAt: row.last_reset_at,
    };
  }

  async checkQuota(tenantId: string, quotaType: QuotaType): Promise<boolean> {
    const quotas = await this.getQuotas(tenantId);
    if (!quotas) return false;

    const limitKey = this.getLimitKey(quotaType);
    const limit = quotas[limitKey];
    const used = quotas[quotaType];

    // -1 means unlimited
    if (limit === -1) return true;

    return used < limit;
  }

  async incrementQuota(tenantId: string, quotaType: QuotaType, amount: number = 1): Promise<void> {
    const canProceed = await this.checkQuota(tenantId, quotaType);

    if (!canProceed) {
      throw new QuotaExceededError(tenantId, quotaType);
    }

    this.db.prepare(`
      UPDATE tenant_quotas
      SET ${quotaType} = ${quotaType} + ?
      WHERE tenant_id = ?
    `).run(amount, tenantId);

    this.emit('quota_incremented', { tenantId, quotaType, amount });
  }

  async decrementQuota(tenantId: string, quotaType: QuotaType, amount: number = 1): Promise<void> {
    this.db.prepare(`
      UPDATE tenant_quotas
      SET ${quotaType} = MAX(0, ${quotaType} - ?)
      WHERE tenant_id = ?
    `).run(amount, tenantId);

    this.emit('quota_decremented', { tenantId, quotaType, amount });
  }

  async resetMonthlyQuotas(): Promise<void> {
    const now = Date.now();
    const lastMonth = now - 30 * 24 * 60 * 60 * 1000;

    this.db.prepare(`
      UPDATE tenant_quotas
      SET executions_this_month = 0,
          api_calls_this_month = 0,
          last_reset_at = ?
      WHERE last_reset_at < ?
    `).run(now, lastMonth);

    this.emit('monthly_quotas_reset');
  }

  private getLimitKey(quotaType: QuotaType): keyof TenantQuotas {
    const mapping: Record<QuotaType, keyof TenantQuotas> = {
      workflowsUsed: 'maxWorkflows',
      executionsThisMonth: 'maxExecutionsPerMonth',
      concurrentExecutions: 'maxConcurrentExecutions',
      storageBytesUsed: 'maxStorageBytes',
      apiCallsThisMonth: 'maxApiCallsPerMonth',
    };

    return mapping[quotaType];
  }
}
