/**
 * AutomatosX v8.0.0 - Strategy Telemetry
 *
 * Tracks strategy effectiveness over time
 * Provides analytics for continuous improvement
 */
import chalk from 'chalk';
/**
 * Strategy Telemetry
 *
 * Tracks and analyzes strategy performance for data-driven improvements
 */
export class StrategyTelemetry {
    db;
    constructor(db) {
        this.db = db;
        this.initializeDatabase();
    }
    /**
     * Initialize telemetry database tables
     */
    initializeDatabase() {
        const createTable = `
      CREATE TABLE IF NOT EXISTS strategy_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_name TEXT NOT NULL,
        task_id TEXT NOT NULL,
        failure_type TEXT NOT NULL,
        success INTEGER NOT NULL,
        execution_time INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
        const createIndexStrategy = `
      CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_name
      ON strategy_telemetry(strategy_name);
    `;
        const createIndexFailureType = `
      CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_failure
      ON strategy_telemetry(failure_type);
    `;
        const createIndexTimestamp = `
      CREATE INDEX IF NOT EXISTS idx_strategy_telemetry_timestamp
      ON strategy_telemetry(timestamp);
    `;
        this.db.exec(createTable);
        this.db.exec(createIndexStrategy);
        this.db.exec(createIndexFailureType);
        this.db.exec(createIndexTimestamp);
    }
    /**
     * Record strategy execution
     */
    recordExecution(strategyName, taskId, failureType, success, executionTime, metadata) {
        const timestamp = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO strategy_telemetry
      (strategy_name, task_id, failure_type, success, execution_time, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(strategyName, taskId, failureType, success ? 1 : 0, executionTime, timestamp, metadata ? JSON.stringify(metadata) : null);
    }
    /**
     * Get statistics for a specific strategy
     */
    getStrategyStats(strategyName) {
        // Get aggregated stats
        const statsStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_executions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count,
        AVG(execution_time) as avg_execution_time,
        MAX(timestamp) as last_used
      FROM strategy_telemetry
      WHERE strategy_name = ?
    `);
        const stats = statsStmt.get(strategyName);
        if (!stats || stats.total_executions === 0) {
            return null;
        }
        // Get failure type distribution
        const failureStmt = this.db.prepare(`
      SELECT failure_type, COUNT(*) as count
      FROM strategy_telemetry
      WHERE strategy_name = ?
      GROUP BY failure_type
    `);
        const failureRows = failureStmt.all(strategyName);
        const failureTypes = {};
        for (const row of failureRows) {
            failureTypes[row.failure_type] = row.count;
        }
        return {
            strategyName,
            totalExecutions: stats.total_executions,
            successCount: stats.success_count,
            failureCount: stats.failure_count,
            successRate: stats.success_count / stats.total_executions,
            averageExecutionTime: Math.round(stats.avg_execution_time),
            lastUsed: stats.last_used,
            failureTypes
        };
    }
    /**
     * Get all strategy statistics
     */
    getAllStats() {
        const stmt = this.db.prepare(`
      SELECT DISTINCT strategy_name
      FROM strategy_telemetry
    `);
        const rows = stmt.all();
        const stats = [];
        for (const row of rows) {
            const strategyStats = this.getStrategyStats(row.strategy_name);
            if (strategyStats) {
                stats.push(strategyStats);
            }
        }
        // Sort by success rate (descending)
        return stats.sort((a, b) => b.successRate - a.successRate);
    }
    /**
     * Get best strategy for a failure type
     */
    getBestStrategyForFailure(failureType) {
        const stmt = this.db.prepare(`
      SELECT
        strategy_name,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate,
        COUNT(*) as usage_count
      FROM strategy_telemetry
      WHERE failure_type = ?
      GROUP BY strategy_name
      HAVING usage_count >= 3
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT 1
    `);
        const row = stmt.get(failureType);
        return row?.strategy_name || null;
    }
    /**
     * Generate comprehensive telemetry report
     */
    generateReport() {
        // Total executions
        const totalStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
      FROM strategy_telemetry
    `);
        const totals = totalStmt.get();
        // Strategy rankings
        const allStats = this.getAllStats();
        const rankings = allStats.map((stat, index) => ({
            strategy: stat.strategyName,
            rank: index + 1,
            successRate: stat.successRate,
            usage: stat.totalExecutions
        }));
        // Failure type distribution
        const failureStmt = this.db.prepare(`
      SELECT failure_type, COUNT(*) as count
      FROM strategy_telemetry
      GROUP BY failure_type
      ORDER BY count DESC
    `);
        const failureRows = failureStmt.all();
        const failureTypeDistribution = {};
        for (const row of failureRows) {
            failureTypeDistribution[row.failure_type] = row.count;
        }
        // Generate recommendations
        const recommendations = this.generateRecommendations(allStats, failureTypeDistribution);
        return {
            totalExecutions: totals.total,
            overallSuccessRate: totals.success_rate,
            strategyRankings: rankings,
            failureTypeDistribution,
            recommendations
        };
    }
    /**
     * Generate recommendations based on telemetry data
     */
    generateRecommendations(stats, failureDistribution) {
        const recommendations = [];
        // Find underperforming strategies
        const underperforming = stats.filter(s => s.successRate < 0.5 && s.totalExecutions >= 5);
        if (underperforming.length > 0) {
            recommendations.push(`Consider disabling or improving: ${underperforming.map(s => s.strategyName).join(', ')}`);
        }
        // Find top performers
        const topPerformers = stats.filter(s => s.successRate >= 0.8 && s.totalExecutions >= 5);
        if (topPerformers.length > 0) {
            recommendations.push(`Increase priority for high-performing strategies: ${topPerformers.map(s => s.strategyName).join(', ')}`);
        }
        // Check most common failure types
        const entries = Object.entries(failureDistribution).sort((a, b) => b[1] - a[1]);
        if (entries.length > 0) {
            const topFailure = entries[0];
            const bestStrategy = this.getBestStrategyForFailure(topFailure[0]);
            if (bestStrategy) {
                recommendations.push(`For '${topFailure[0]}' failures (${topFailure[1]} occurrences), use '${bestStrategy}' strategy`);
            }
        }
        // Check for unused strategies
        const allStrategies = [
            'simple-retry',
            'exponential-backoff',
            'different-provider',
            'different-agent',
            'simplify-task',
            'incremental-retry',
            'adaptive-parallelism',
            'circuit-breaker',
            'gradual-relaxation',
            'hybrid-approach'
        ];
        const usedStrategies = new Set(stats.map(s => s.strategyName));
        const unused = allStrategies.filter(s => !usedStrategies.has(s));
        if (unused.length > 0) {
            recommendations.push(`Underutilized strategies: ${unused.join(', ')} - consider testing these`);
        }
        return recommendations;
    }
    /**
     * Display telemetry report
     */
    displayReport() {
        const report = this.generateReport();
        console.log(chalk.bold.cyan('\n╔═══ Strategy Telemetry Report ═══╗\n'));
        // Overall stats
        console.log(chalk.white(`Total Executions: ${chalk.yellow(report.totalExecutions)}`));
        console.log(chalk.white(`Overall Success Rate: ${this.formatSuccessRate(report.overallSuccessRate)}`));
        // Top strategies
        console.log(chalk.white('\n📊 Strategy Rankings:'));
        const top5 = report.strategyRankings.slice(0, 5);
        for (const ranking of top5) {
            const bar = this.createProgressBar(ranking.successRate, 20);
            console.log(chalk.gray(`  ${ranking.rank}. ${ranking.strategy.padEnd(25)} ${bar} ${this.formatSuccessRate(ranking.successRate)} (${ranking.usage} uses)`));
        }
        // Failure distribution
        if (Object.keys(report.failureTypeDistribution).length > 0) {
            console.log(chalk.white('\n🔍 Failure Type Distribution:'));
            const sorted = Object.entries(report.failureTypeDistribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            for (const [type, count] of sorted) {
                console.log(chalk.gray(`  • ${type.padEnd(15)} ${count} occurrences`));
            }
        }
        // Recommendations
        if (report.recommendations.length > 0) {
            console.log(chalk.white('\n💡 Recommendations:'));
            for (const rec of report.recommendations) {
                console.log(chalk.gray(`  • ${rec}`));
            }
        }
        console.log(chalk.gray('\n─────────────────────────────────────\n'));
    }
    /**
     * Display single strategy stats
     */
    displayStrategyStats(strategyName) {
        const stats = this.getStrategyStats(strategyName);
        if (!stats) {
            console.log(chalk.yellow(`\nNo telemetry data for strategy: ${strategyName}\n`));
            return;
        }
        console.log(chalk.bold.cyan(`\n╔═══ ${strategyName} Statistics ═══╗\n`));
        console.log(chalk.white(`Total Executions: ${chalk.yellow(stats.totalExecutions)}`));
        console.log(chalk.white(`Success Rate: ${this.formatSuccessRate(stats.successRate)}`));
        console.log(chalk.white(`Success Count: ${chalk.green(stats.successCount)}`));
        console.log(chalk.white(`Failure Count: ${chalk.red(stats.failureCount)}`));
        console.log(chalk.white(`Avg Execution Time: ${chalk.yellow(stats.averageExecutionTime + 'ms')}`));
        console.log(chalk.white(`Last Used: ${new Date(stats.lastUsed).toLocaleString()}`));
        if (Object.keys(stats.failureTypes).length > 0) {
            console.log(chalk.white('\nFailure Types:'));
            for (const [type, count] of Object.entries(stats.failureTypes)) {
                console.log(chalk.gray(`  • ${type}: ${count}`));
            }
        }
        console.log(chalk.gray('\n─────────────────────────────────────\n'));
    }
    /**
     * Clear all telemetry data
     */
    clearTelemetry() {
        const stmt = this.db.prepare(`DELETE FROM strategy_telemetry`);
        stmt.run();
        console.log(chalk.yellow('⚠ All telemetry data cleared'));
    }
    /**
     * Format success rate
     */
    formatSuccessRate(rate) {
        const percent = (rate * 100).toFixed(1);
        const num = parseFloat(percent);
        if (num >= 80) {
            return chalk.green(`${percent}%`);
        }
        else if (num >= 60) {
            return chalk.yellow(`${percent}%`);
        }
        else {
            return chalk.red(`${percent}%`);
        }
    }
    /**
     * Create ASCII progress bar
     */
    createProgressBar(value, width) {
        const filled = Math.round(value * width);
        const empty = width - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }
}
//# sourceMappingURL=StrategyTelemetry.js.map