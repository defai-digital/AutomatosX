/**
 * QuotaService.ts
 *
 * Quota tracking and enforcement service
 * Phase 5 Week 3: Multi-tenancy
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { TenantQuotas, QuotaType } from '../types/security.types.js';
export declare class QuotaService extends EventEmitter {
    private db;
    constructor(db?: Database.Database);
    getQuotas(tenantId: string): Promise<TenantQuotas | null>;
    checkQuota(tenantId: string, quotaType: QuotaType): Promise<boolean>;
    incrementQuota(tenantId: string, quotaType: QuotaType, amount?: number): Promise<void>;
    decrementQuota(tenantId: string, quotaType: QuotaType, amount?: number): Promise<void>;
    resetMonthlyQuotas(): Promise<void>;
    private getLimitKey;
}
//# sourceMappingURL=QuotaService.d.ts.map