/**
 * Cost Analytics Service
 *
 * Provides cost tracking, projections, and budget management for AI provider usage.
 * Analyzes spending patterns and generates forecasts.
 *
 * Features:
 * - Real-time cost tracking by provider, model, user
 * - Trend-based cost projections (daily, weekly, monthly, annual)
 * - Budget tracking with threshold alerts
 * - Cost optimization recommendations
 * - Confidence intervals for projections
 *
 * @module CostAnalytics
 */
export interface CostBreakdown {
    provider?: string;
    model?: string;
    userId?: string;
    cost: number;
    requests: number;
    tokens: number;
    percentage: number;
}
export interface CostSummary {
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    avgCostPerRequest: number;
    avgCostPerToken: number;
    byProvider: CostBreakdown[];
    byModel: CostBreakdown[];
    byUser?: CostBreakdown[];
    timeRange: {
        start: number;
        end: number;
    };
}
export interface CostProjection {
    date: string;
    estimate: number;
    lowEstimate: number;
    highEstimate: number;
    confidence: number;
    daysInPeriod: number;
    daysRemaining: number;
    currentSpend: number;
    projectedSpend: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
}
export interface CostBudget {
    id: string;
    name: string;
    description?: string;
    period: 'daily' | 'weekly' | 'monthly' | 'annual';
    limitAmount: number;
    provider?: string;
    model?: string;
    userId?: string;
    alertAt50Percent: boolean;
    alertAt80Percent: boolean;
    alertAt95Percent: boolean;
    alertAtExceeded: boolean;
    enabled: boolean;
    startDate?: string;
    endDate?: string;
    createdAt: number;
    updatedAt: number;
}
export interface BudgetStatus {
    budget: CostBudget;
    currentSpend: number;
    percentUsed: number;
    remaining: number;
    projectedSpend: number;
    projectedOverage: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
    daysInPeriod: number;
    daysElapsed: number;
    daysRemaining: number;
}
export interface CostOptimization {
    type: 'provider_switch' | 'cache_ttl' | 'routing_strategy' | 'model_switch';
    title: string;
    description: string;
    estimatedSavings: number;
    savingsPercentage: number;
    effort: 'low' | 'medium' | 'high';
    priority: number;
}
export interface CostQuery {
    startTime?: number;
    endTime?: number;
    provider?: string;
    model?: string;
    userId?: string;
    groupBy?: 'provider' | 'model' | 'user' | 'day' | 'hour';
}
export declare class CostAnalytics {
    private db;
    constructor();
    /**
     * Get cost summary for a time range
     */
    getSummary(query?: CostQuery): Promise<CostSummary>;
    /**
     * Get cost trend over time
     */
    getTrend(query?: CostQuery & {
        bucketSize?: 'hour' | 'day' | 'week';
    }): Promise<Array<{
        timestamp: number;
        cost: number;
        requests: number;
    }>>;
    /**
     * Generate cost projection based on current spending trends
     */
    getProjection(period?: 'daily' | 'weekly' | 'monthly' | 'annual'): Promise<CostProjection>;
    /**
     * Store cost projection in database
     */
    private storeProjection;
    /**
     * Calculate growth rate from trend data
     */
    private calculateGrowthRate;
    /**
     * Apply trend projection with growth rate
     */
    private applyTrendProjection;
    /**
     * Get all budgets
     */
    getBudgets(enabled?: boolean): Promise<CostBudget[]>;
    /**
     * Get budget status
     */
    getBudgetStatus(budgetId: string): Promise<BudgetStatus>;
    /**
     * Get budget by ID
     */
    getBudget(budgetId: string): Promise<CostBudget | null>;
    /**
     * Create or update budget
     */
    saveBudget(budget: Partial<CostBudget>): Promise<CostBudget>;
    /**
     * Delete budget
     */
    deleteBudget(budgetId: string): Promise<void>;
    /**
     * Get cost optimization recommendations
     */
    getOptimizationRecommendations(): Promise<CostOptimization[]>;
    private getStartOfPeriod;
    private getDaysInPeriod;
    private mapBudgetFromDb;
}
//# sourceMappingURL=CostAnalytics.d.ts.map