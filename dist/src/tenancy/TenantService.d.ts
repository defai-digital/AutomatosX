/**
 * TenantService.ts
 *
 * Multi-tenancy management service
 * Phase 5 Week 3: Multi-tenancy
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { Tenant, TenantPlan } from '../types/security.types.js';
export declare class TenantService extends EventEmitter {
    private db;
    constructor(db?: Database.Database);
    createTenant(name: string, slug: string, plan?: TenantPlan): Promise<Tenant>;
    getTenant(tenantId: string): Promise<Tenant | null>;
    suspendTenant(tenantId: string, reason: string): Promise<void>;
    activateTenant(tenantId: string): Promise<void>;
    private initializeQuotas;
    private getDefaultQuotas;
}
//# sourceMappingURL=TenantService.d.ts.map