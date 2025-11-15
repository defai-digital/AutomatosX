/**
 * AutomatosX v8.0.0 - Iteration Reporter
 *
 * Generates comprehensive reports for Iterate Mode execution
 * Provides detailed analysis, metrics, and visualizations
 */
import chalk from 'chalk';
/**
 * Iteration Reporter
 *
 * Analyzes iteration execution and generates detailed reports
 */
export class IterationReporter {
    /**
     * Generate comprehensive execution report
     */
    generateReport(summary) {
        const lines = [];
        // Header
        lines.push(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════╗'));
        lines.push(chalk.bold.cyan('║         Iterate Mode Execution Report                  ║'));
        lines.push(chalk.bold.cyan('╚════════════════════════════════════════════════════════╝\n'));
        // Task info
        lines.push(chalk.white(`Task ID: ${chalk.yellow(summary.taskId)}`));
        lines.push(chalk.white(`Final Status: ${this.formatStatus(summary.finalStatus)}`));
        lines.push('');
        // Execution metrics
        lines.push(chalk.bold.white('📊 Execution Metrics'));
        lines.push(chalk.gray('─'.repeat(60)));
        lines.push(chalk.white(`Total Iterations: ${chalk.yellow(summary.totalIterations)}`));
        lines.push(chalk.white(`Successful: ${chalk.green(summary.successfulIterations)}`));
        lines.push(chalk.white(`Failed: ${chalk.red(summary.failedIterations)}`));
        lines.push(chalk.white(`Success Rate: ${this.formatSuccessRate(summary.successfulIterations / summary.totalIterations)}`));
        lines.push(chalk.white(`Total Execution Time: ${chalk.yellow(this.formatDuration(summary.totalExecutionTime))}`));
        lines.push(chalk.white(`Average Iteration Time: ${chalk.yellow(this.formatDuration(summary.averageIterationTime))}`));
        lines.push('');
        // Strategy analysis
        lines.push(chalk.bold.white('⚡ Strategy Analysis'));
        lines.push(chalk.gray('─'.repeat(60)));
        lines.push(chalk.white(`Strategies Used: ${chalk.yellow(summary.strategiesUsed.length)}`));
        for (const strategy of summary.strategiesUsed) {
            const count = summary.iterations.filter(i => i.strategy === strategy).length;
            const successCount = summary.iterations.filter(i => i.strategy === strategy && i.success).length;
            const rate = count > 0 ? successCount / count : 0;
            lines.push(chalk.gray(`  • ${strategy.padEnd(30)} ${count} uses, ${this.formatSuccessRate(rate)} success`));
        }
        if (summary.mostEffectiveStrategy) {
            lines.push('');
            lines.push(chalk.white(`Most Effective: ${chalk.green(summary.mostEffectiveStrategy)}`));
        }
        lines.push('');
        // Timeline
        lines.push(chalk.bold.white('📅 Iteration Timeline'));
        lines.push(chalk.gray('─'.repeat(60)));
        this.addTimeline(lines, summary.iterations);
        lines.push('');
        // Error analysis
        const errors = summary.iterations.filter(i => !i.success && i.error);
        if (errors.length > 0) {
            lines.push(chalk.bold.white('🔍 Error Analysis'));
            lines.push(chalk.gray('─'.repeat(60)));
            this.addErrorAnalysis(lines, errors);
            lines.push('');
        }
        // Recommendations
        lines.push(chalk.bold.white('💡 Recommendations'));
        lines.push(chalk.gray('─'.repeat(60)));
        this.addRecommendations(lines, summary);
        lines.push('');
        lines.push(chalk.gray('─'.repeat(60)));
        lines.push('');
        return lines.join('\n');
    }
    /**
     * Add timeline visualization
     */
    addTimeline(lines, iterations) {
        for (const iteration of iterations.slice(-10)) {
            const symbol = iteration.success ? chalk.green('✓') : chalk.red('✖');
            const time = this.formatDuration(iteration.executionTime);
            const strategy = chalk.yellow(iteration.strategy.padEnd(25));
            lines.push(`  ${symbol} Iteration ${iteration.iteration.toString().padStart(2)} | ${strategy} | ${time}`);
        }
        if (iterations.length > 10) {
            lines.push(chalk.gray(`  ... (${iterations.length - 10} more iterations)`));
        }
    }
    /**
     * Add error analysis
     */
    addErrorAnalysis(lines, errors) {
        // Group errors by type
        const errorGroups = new Map();
        for (const error of errors) {
            if (error.error) {
                const count = errorGroups.get(error.error) || 0;
                errorGroups.set(error.error, count + 1);
            }
        }
        // Display top errors
        const sorted = Array.from(errorGroups.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        for (const [errorMsg, count] of sorted) {
            lines.push(chalk.red(`  • ${this.truncate(errorMsg, 50)} (${count} occurrences)`));
        }
    }
    /**
     * Add recommendations
     */
    addRecommendations(lines, summary) {
        const recommendations = [];
        // Check success rate
        const successRate = summary.successfulIterations / summary.totalIterations;
        if (successRate < 0.5) {
            recommendations.push('Consider reviewing task complexity and simplifying requirements');
            recommendations.push('Enable circuit breaker to prevent repeated failures');
        }
        // Check iteration count
        if (summary.totalIterations >= 8) {
            recommendations.push('High iteration count - consider increasing task decomposition');
        }
        // Check execution time
        if (summary.averageIterationTime > 30000) {
            recommendations.push('Long iteration times - consider adding timeouts or parallelism');
        }
        // Check strategy diversity
        if (summary.strategiesUsed.length < 3) {
            recommendations.push('Limited strategy variety - enable more recovery strategies');
        }
        // Check for repeated failures
        const consecutiveFailures = this.countConsecutiveFailures(summary.iterations);
        if (consecutiveFailures >= 3) {
            recommendations.push('Multiple consecutive failures detected - review safety settings');
        }
        // Display recommendations
        if (recommendations.length > 0) {
            for (const rec of recommendations) {
                lines.push(chalk.gray(`  • ${rec}`));
            }
        }
        else {
            lines.push(chalk.green('  ✓ No issues detected - execution was optimal'));
        }
    }
    /**
     * Generate compact summary (for inline display)
     */
    generateCompactSummary(summary) {
        const successRate = summary.totalIterations > 0
            ? summary.successfulIterations / summary.totalIterations
            : 0;
        return (`${this.formatStatus(summary.finalStatus)} | ` +
            `${summary.totalIterations} iterations | ` +
            `${this.formatSuccessRate(successRate)} success | ` +
            `${this.formatDuration(summary.totalExecutionTime)}`);
    }
    /**
     * Generate markdown report (for file export)
     */
    generateMarkdownReport(summary) {
        const lines = [];
        lines.push('# Iterate Mode Execution Report\n');
        lines.push(`**Task ID:** ${summary.taskId}\n`);
        lines.push(`**Final Status:** ${summary.finalStatus}\n`);
        lines.push(`**Generated:** ${new Date().toISOString()}\n`);
        lines.push('---\n');
        lines.push('## Execution Metrics\n');
        lines.push(`- **Total Iterations:** ${summary.totalIterations}`);
        lines.push(`- **Successful:** ${summary.successfulIterations}`);
        lines.push(`- **Failed:** ${summary.failedIterations}`);
        lines.push(`- **Success Rate:** ${((summary.successfulIterations / summary.totalIterations) * 100).toFixed(1)}%`);
        lines.push(`- **Total Execution Time:** ${this.formatDuration(summary.totalExecutionTime)}`);
        lines.push(`- **Average Iteration Time:** ${this.formatDuration(summary.averageIterationTime)}\n`);
        lines.push('## Strategy Analysis\n');
        lines.push('| Strategy | Uses | Success Rate |');
        lines.push('|----------|------|--------------|');
        for (const strategy of summary.strategiesUsed) {
            const count = summary.iterations.filter(i => i.strategy === strategy).length;
            const successCount = summary.iterations.filter(i => i.strategy === strategy && i.success).length;
            const rate = count > 0 ? ((successCount / count) * 100).toFixed(1) : '0.0';
            lines.push(`| ${strategy} | ${count} | ${rate}% |`);
        }
        lines.push('');
        lines.push('## Iteration Timeline\n');
        lines.push('| Iteration | Strategy | Status | Time |');
        lines.push('|-----------|----------|--------|------|');
        for (const iteration of summary.iterations) {
            const status = iteration.success ? '✓ Success' : '✖ Failed';
            const time = this.formatDuration(iteration.executionTime);
            lines.push(`| ${iteration.iteration} | ${iteration.strategy} | ${status} | ${time} |`);
        }
        lines.push('');
        return lines.join('\n');
    }
    /**
     * Format status
     */
    formatStatus(status) {
        switch (status) {
            case 'success':
                return chalk.green('✓ SUCCESS');
            case 'failure':
                return chalk.red('✖ FAILURE');
            case 'timeout':
                return chalk.yellow('⏱ TIMEOUT');
            case 'aborted':
                return chalk.yellow('⏸ ABORTED');
            default:
                return chalk.gray(status.toUpperCase());
        }
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
     * Format duration
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }
    /**
     * Count consecutive failures
     */
    countConsecutiveFailures(iterations) {
        let maxConsecutive = 0;
        let current = 0;
        for (const iteration of iterations) {
            if (!iteration.success) {
                current++;
                maxConsecutive = Math.max(maxConsecutive, current);
            }
            else {
                current = 0;
            }
        }
        return maxConsecutive;
    }
    /**
     * Truncate string
     */
    truncate(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength - 3) + '...';
    }
}
//# sourceMappingURL=IterationReporter.js.map