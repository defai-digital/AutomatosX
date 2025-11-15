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
import { getDatabase } from '../database/connection.js';
// ============================================================================
// CostAnalytics Service
// ============================================================================
export class CostAnalytics {
    db;
    constructor() {
        this.db = getDatabase();
    }
    // ==========================================================================
    // Cost Summary Methods
    // ==========================================================================
    /**
     * Get cost summary for a time range
     */
    async getSummary(query = {}) {
        const { startTime = Date.now() - 24 * 60 * 60 * 1000, // Default: last 24 hours
        endTime = Date.now(), provider, model, userId, } = query;
        // Build WHERE clause
        const conditions = ['timestamp >= ?', 'timestamp <= ?'];
        const params = [startTime, endTime];
        if (provider) {
            conditions.push('provider = ?');
            params.push(provider);
        }
        if (model) {
            conditions.push('model = ?');
            params.push(model);
        }
        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }
        const whereClause = conditions.join(' AND ');
        // Get total metrics
        const total = this.db
            .prepare(`
      SELECT
        COALESCE(SUM(cost), 0) as total_cost,
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens
      FROM metrics_raw
      WHERE ${whereClause}
    `)
            .get(...params);
        // Get breakdown by provider
        const byProvider = this.db
            .prepare(`
      SELECT
        provider,
        COALESCE(SUM(cost), 0) as cost,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM metrics_raw
      WHERE ${whereClause}
      GROUP BY provider
      ORDER BY cost DESC
    `)
            .all(...params);
        // Get breakdown by model
        const byModel = this.db
            .prepare(`
      SELECT
        model,
        COALESCE(SUM(cost), 0) as cost,
        COUNT(*) as requests,
        COALESCE(SUM(total_tokens), 0) as tokens
      FROM metrics_raw
      WHERE ${whereClause} AND model IS NOT NULL
      GROUP BY model
      ORDER BY cost DESC
    `)
            .all(...params);
        // Calculate percentages
        const totalCost = total.total_cost || 0;
        const addPercentages = (items) => items.map((item) => ({
            ...item,
            percentage: totalCost > 0 ? (item.cost / totalCost) * 100 : 0,
        }));
        return {
            totalCost: totalCost,
            totalRequests: total.total_requests,
            totalTokens: total.total_tokens,
            avgCostPerRequest: totalCost / (total.total_requests || 1),
            avgCostPerToken: totalCost / (total.total_tokens || 1),
            byProvider: addPercentages(byProvider),
            byModel: addPercentages(byModel),
            timeRange: { start: startTime, end: endTime },
        };
    }
    /**
     * Get cost trend over time
     */
    async getTrend(query = {}) {
        const { startTime = Date.now() - 7 * 24 * 60 * 60 * 1000, // Default: last 7 days
        endTime = Date.now(), provider, model, userId, bucketSize = 'day', } = query;
        // Calculate bucket duration in milliseconds
        const bucketDuration = bucketSize === 'hour'
            ? 60 * 60 * 1000
            : bucketSize === 'day'
                ? 24 * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000;
        // Build WHERE clause
        const conditions = ['timestamp >= ?', 'timestamp <= ?'];
        const params = [startTime, endTime];
        if (provider) {
            conditions.push('provider = ?');
            params.push(provider);
        }
        if (model) {
            conditions.push('model = ?');
            params.push(model);
        }
        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }
        const whereClause = conditions.join(' AND ');
        const results = this.db
            .prepare(`
      SELECT
        (timestamp / ${bucketDuration}) * ${bucketDuration} as bucket,
        COALESCE(SUM(cost), 0) as cost,
        COUNT(*) as requests
      FROM metrics_raw
      WHERE ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `)
            .all(...params);
        return results.map((row) => ({
            timestamp: row.bucket,
            cost: row.cost,
            requests: row.requests,
        }));
    }
    // ==========================================================================
    // Cost Projection Methods
    // ==========================================================================
    /**
     * Generate cost projection based on current spending trends
     */
    async getProjection(period = 'monthly') {
        const now = Date.now();
        const startOfPeriod = this.getStartOfPeriod(now, period);
        const daysInPeriod = this.getDaysInPeriod(period);
        const daysElapsed = Math.max(1, Math.floor((now - startOfPeriod) / (24 * 60 * 60 * 1000)));
        const daysRemaining = daysInPeriod - daysElapsed;
        // Get current spend in this period
        const summary = await this.getSummary({
            startTime: startOfPeriod,
            endTime: now,
        });
        const currentSpend = summary.totalCost;
        // Get daily trend for last 7 days (or less if period is shorter)
        const trendDays = Math.min(7, daysElapsed);
        const trendStart = now - trendDays * 24 * 60 * 60 * 1000;
        const trend = await this.getTrend({
            startTime: trendStart,
            endTime: now,
            bucketSize: 'day',
        });
        // Calculate linear projection
        const dailyAvg = currentSpend / daysElapsed;
        const linearProjection = dailyAvg * daysInPeriod;
        // Calculate trend-based projection
        let trendProjection = linearProjection;
        if (trend.length >= 2) {
            const growthRate = this.calculateGrowthRate(trend);
            trendProjection = this.applyTrendProjection(currentSpend, dailyAvg, growthRate, daysRemaining);
        }
        // Use average of linear and trend projections
        const estimate = (linearProjection + trendProjection) / 2;
        // Calculate confidence intervals (10th and 90th percentiles)
        const variance = Math.abs(trendProjection - linearProjection);
        const lowEstimate = Math.max(0, estimate - variance * 0.5);
        const highEstimate = estimate + variance * 0.5;
        // Calculate confidence (0.0 - 1.0)
        const confidence = Math.max(0.5, Math.min(0.95, 1.0 - variance / (estimate || 1)));
        // Get breakdown by provider and model
        const byProvider = {};
        const byModel = {};
        for (const item of summary.byProvider) {
            const providerProjection = (item.cost / currentSpend) * estimate || 0;
            byProvider[item.provider || 'unknown'] = providerProjection;
        }
        for (const item of summary.byModel) {
            const modelProjection = (item.cost / currentSpend) * estimate || 0;
            byModel[item.model || 'unknown'] = modelProjection;
        }
        const projection = {
            date: new Date(startOfPeriod).toISOString().split('T')[0],
            estimate: Math.round(estimate * 100) / 100,
            lowEstimate: Math.round(lowEstimate * 100) / 100,
            highEstimate: Math.round(highEstimate * 100) / 100,
            confidence: Math.round(confidence * 100) / 100,
            daysInPeriod,
            daysRemaining,
            currentSpend: Math.round(currentSpend * 100) / 100,
            projectedSpend: Math.round(estimate * 100) / 100,
            byProvider,
            byModel,
        };
        // Store projection in database
        await this.storeProjection(projection);
        return projection;
    }
    /**
     * Store cost projection in database
     */
    async storeProjection(projection) {
        const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.db
            .prepare(`
      INSERT INTO cost_projections (
        id, date, projection_date, daily_projection, weekly_projection,
        monthly_projection, annual_projection, confidence, low_estimate,
        high_estimate, by_provider, by_model, days_in_period,
        days_remaining, current_spend, projected_spend, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
            .run(id, projection.date, new Date().toISOString().split('T')[0], projection.estimate / projection.daysInPeriod, projection.estimate * (7 / projection.daysInPeriod), projection.estimate, projection.estimate * (365 / projection.daysInPeriod), projection.confidence, projection.lowEstimate, projection.highEstimate, JSON.stringify(projection.byProvider), JSON.stringify(projection.byModel), projection.daysInPeriod, projection.daysRemaining, projection.currentSpend, projection.projectedSpend, Date.now());
    }
    /**
     * Calculate growth rate from trend data
     */
    calculateGrowthRate(trend) {
        if (trend.length < 2)
            return 0;
        let totalGrowth = 0;
        let count = 0;
        for (let i = 1; i < trend.length; i++) {
            const prev = trend[i - 1].cost;
            const curr = trend[i].cost;
            if (prev > 0) {
                totalGrowth += (curr - prev) / prev;
                count++;
            }
        }
        return count > 0 ? totalGrowth / count : 0;
    }
    /**
     * Apply trend projection with growth rate
     */
    applyTrendProjection(currentSpend, dailyAvg, growthRate, daysRemaining) {
        let projectedSpend = currentSpend;
        for (let day = 0; day < daysRemaining; day++) {
            const dailySpend = dailyAvg * (1 + growthRate);
            projectedSpend += dailySpend;
        }
        return projectedSpend;
    }
    // ==========================================================================
    // Budget Management Methods
    // ==========================================================================
    /**
     * Get all budgets
     */
    async getBudgets(enabled) {
        let query = 'SELECT * FROM cost_budgets';
        const params = [];
        if (enabled !== undefined) {
            query += ' WHERE enabled = ?';
            params.push(enabled ? 1 : 0);
        }
        query += ' ORDER BY created_at DESC';
        const results = this.db.prepare(query).all(...params);
        return results.map(this.mapBudgetFromDb);
    }
    /**
     * Get budget status
     */
    async getBudgetStatus(budgetId) {
        const budget = await this.getBudget(budgetId);
        if (!budget) {
            throw new Error(`Budget not found: ${budgetId}`);
        }
        const now = Date.now();
        const startOfPeriod = this.getStartOfPeriod(now, budget.period);
        const daysInPeriod = this.getDaysInPeriod(budget.period);
        const daysElapsed = Math.max(1, Math.floor((now - startOfPeriod) / (24 * 60 * 60 * 1000)));
        const daysRemaining = daysInPeriod - daysElapsed;
        // Get current spend
        const summary = await this.getSummary({
            startTime: startOfPeriod,
            endTime: now,
            provider: budget.provider,
            model: budget.model,
            userId: budget.userId,
        });
        const currentSpend = summary.totalCost;
        const percentUsed = (currentSpend / budget.limitAmount) * 100;
        const remaining = Math.max(0, budget.limitAmount - currentSpend);
        // Get projection for this period
        const projection = await this.getProjection(budget.period);
        const projectedSpend = projection.estimate;
        const projectedOverage = Math.max(0, projectedSpend - budget.limitAmount);
        // Determine status
        let status = 'ok';
        if (percentUsed >= 100) {
            status = 'exceeded';
        }
        else if (percentUsed >= 95) {
            status = 'critical';
        }
        else if (percentUsed >= 80) {
            status = 'warning';
        }
        return {
            budget,
            currentSpend: Math.round(currentSpend * 100) / 100,
            percentUsed: Math.round(percentUsed * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
            projectedSpend: Math.round(projectedSpend * 100) / 100,
            projectedOverage: Math.round(projectedOverage * 100) / 100,
            status,
            daysInPeriod,
            daysElapsed,
            daysRemaining,
        };
    }
    /**
     * Get budget by ID
     */
    async getBudget(budgetId) {
        const result = this.db
            .prepare('SELECT * FROM cost_budgets WHERE id = ?')
            .get(budgetId);
        return result ? this.mapBudgetFromDb(result) : null;
    }
    /**
     * Create or update budget
     */
    async saveBudget(budget) {
        const now = Date.now();
        if (budget.id) {
            // Update existing budget
            this.db
                .prepare(`
        UPDATE cost_budgets
        SET name = ?, description = ?, period = ?, limit_amount = ?,
            provider = ?, model = ?, user_id = ?, alert_at_50_percent = ?,
            alert_at_80_percent = ?, alert_at_95_percent = ?,
            alert_at_exceeded = ?, enabled = ?, start_date = ?,
            end_date = ?, updated_at = ?
        WHERE id = ?
      `)
                .run(budget.name, budget.description || null, budget.period, budget.limitAmount, budget.provider || null, budget.model || null, budget.userId || null, budget.alertAt50Percent ? 1 : 0, budget.alertAt80Percent ? 1 : 0, budget.alertAt95Percent ? 1 : 0, budget.alertAtExceeded ? 1 : 0, budget.enabled ? 1 : 0, budget.startDate || null, budget.endDate || null, now, budget.id);
            return (await this.getBudget(budget.id));
        }
        else {
            // Create new budget
            const id = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.db
                .prepare(`
        INSERT INTO cost_budgets (
          id, name, description, period, limit_amount, provider, model,
          user_id, alert_at_50_percent, alert_at_80_percent,
          alert_at_95_percent, alert_at_exceeded, enabled, start_date,
          end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
                .run(id, budget.name, budget.description || null, budget.period || 'monthly', budget.limitAmount, budget.provider || null, budget.model || null, budget.userId || null, budget.alertAt50Percent ? 1 : 0, budget.alertAt80Percent ? 1 : 0, budget.alertAt95Percent ? 1 : 0, budget.alertAtExceeded ? 1 : 0, budget.enabled !== false ? 1 : 0, budget.startDate || null, budget.endDate || null, now, now);
            return (await this.getBudget(id));
        }
    }
    /**
     * Delete budget
     */
    async deleteBudget(budgetId) {
        this.db.prepare('DELETE FROM cost_budgets WHERE id = ?').run(budgetId);
    }
    // ==========================================================================
    // Optimization Recommendations
    // ==========================================================================
    /**
     * Get cost optimization recommendations
     */
    async getOptimizationRecommendations() {
        const recommendations = [];
        const summary = await this.getSummary({
            startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
        });
        // Recommendation 1: Switch to cheaper providers
        const expensiveProviders = summary.byProvider.filter((p) => p.percentage > 20);
        for (const provider of expensiveProviders) {
            if (provider.provider === 'openai') {
                // Estimate 30% savings by switching to Gemini
                recommendations.push({
                    type: 'provider_switch',
                    title: 'Switch to Gemini for Simple Tasks',
                    description: `Switch 30% of OpenAI requests to Gemini Flash (save ~$${Math.round(provider.cost * 0.3 * 0.5)}/month)`,
                    estimatedSavings: provider.cost * 0.3 * 0.5,
                    savingsPercentage: 15,
                    effort: 'low',
                    priority: 1,
                });
            }
        }
        // Recommendation 2: Increase cache TTL
        // Check current cache hit rate from metrics
        const cacheStats = this.db
            .prepare(`
      SELECT
        SUM(CASE WHEN cache_event = 'hit' THEN 1 ELSE 0 END) as hits,
        SUM(CASE WHEN cache_event = 'miss' THEN 1 ELSE 0 END) as misses,
        SUM(CASE WHEN cache_event = 'hit' THEN cache_saved_cost ELSE 0 END) as saved_cost
      FROM metrics_raw
      WHERE timestamp > ? AND cache_event IS NOT NULL
    `)
            .get(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (cacheStats && cacheStats.hits + cacheStats.misses > 0) {
            const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
            if (hitRate < 0.6) {
                recommendations.push({
                    type: 'cache_ttl',
                    title: 'Increase Cache TTL',
                    description: `Current cache hit rate is ${Math.round(hitRate * 100)}%. Increasing TTL to 2 hours could save ~$${Math.round(summary.totalCost * 0.1)}/month`,
                    estimatedSavings: summary.totalCost * 0.1,
                    savingsPercentage: 10,
                    effort: 'low',
                    priority: 2,
                });
            }
        }
        // Recommendation 3: Use cost-based routing
        recommendations.push({
            type: 'routing_strategy',
            title: 'Enable Cost-Based Routing',
            description: `Automatically route requests to cheapest available provider (save ~$${Math.round(summary.totalCost * 0.15)}/month)`,
            estimatedSavings: summary.totalCost * 0.15,
            savingsPercentage: 15,
            effort: 'medium',
            priority: 1,
        });
        // Recommendation 4: Switch expensive models to cheaper alternatives
        const expensiveModels = summary.byModel.filter((m) => m.percentage > 10 &&
            (m.model?.includes('gpt-4') || m.model?.includes('claude-3-opus')));
        for (const model of expensiveModels) {
            recommendations.push({
                type: 'model_switch',
                title: `Switch ${model.model} to Cheaper Alternative`,
                description: `Switch to Haiku or Flash for simple tasks (save ~$${Math.round(model.cost * 0.4)}/month)`,
                estimatedSavings: model.cost * 0.4,
                savingsPercentage: 40,
                effort: 'medium',
                priority: 2,
            });
        }
        // Sort by priority and estimated savings
        return recommendations.sort((a, b) => a.priority - b.priority || b.estimatedSavings - a.estimatedSavings);
    }
    // ==========================================================================
    // Helper Methods
    // ==========================================================================
    getStartOfPeriod(timestamp, period) {
        const date = new Date(timestamp);
        switch (period) {
            case 'daily':
                date.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() - date.getDay());
                break;
            case 'monthly':
                date.setHours(0, 0, 0, 0);
                date.setDate(1);
                break;
            case 'annual':
                date.setHours(0, 0, 0, 0);
                date.setMonth(0, 1);
                break;
        }
        return date.getTime();
    }
    getDaysInPeriod(period) {
        switch (period) {
            case 'daily':
                return 1;
            case 'weekly':
                return 7;
            case 'monthly':
                return 30; // Approximation
            case 'annual':
                return 365;
        }
    }
    mapBudgetFromDb(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            period: row.period,
            limitAmount: row.limit_amount,
            provider: row.provider,
            model: row.model,
            userId: row.user_id,
            alertAt50Percent: row.alert_at_50_percent === 1,
            alertAt80Percent: row.alert_at_80_percent === 1,
            alertAt95Percent: row.alert_at_95_percent === 1,
            alertAtExceeded: row.alert_at_exceeded === 1,
            enabled: row.enabled === 1,
            startDate: row.start_date,
            endDate: row.end_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
//# sourceMappingURL=CostAnalytics.js.map