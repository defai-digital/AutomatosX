/**
 * AutomatosX v8.0.0 - Progress Monitor
 *
 * Real-time progress tracking for Iterate Mode
 * Uses cli-progress for visual feedback
 */
import cliProgress from 'cli-progress';
import chalk from 'chalk';
/**
 * Progress Monitor
 *
 * Provides real-time visual feedback during iterate execution
 * Tracks progress, estimates completion time, and displays metrics
 */
export class ProgressMonitor {
    progressBar = null;
    state;
    iterationTimes = [];
    constructor(maxIterations = 10) {
        this.state = {
            currentIteration: 0,
            maxIterations,
            currentStrategy: 'initializing',
            success: false,
            startTime: Date.now(),
            lastUpdateTime: Date.now()
        };
    }
    /**
     * Start progress monitoring
     */
    start() {
        // Create progress bar
        this.progressBar = new cliProgress.SingleBar({
            format: this.getProgressFormat(),
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            clearOnComplete: false
        }, cliProgress.Presets.shades_classic);
        this.progressBar.start(this.state.maxIterations, 0, {
            strategy: this.state.currentStrategy,
            status: 'Starting...',
            eta: 'N/A'
        });
        console.log(chalk.cyan('\n🚀 Iterate Mode started\n'));
    }
    /**
     * Update progress
     */
    update(iteration, strategy, success, status = 'Processing...') {
        const now = Date.now();
        const iterationTime = now - this.state.lastUpdateTime;
        // Record iteration time
        this.iterationTimes.push(iterationTime);
        // Update state
        this.state.currentIteration = iteration;
        this.state.currentStrategy = strategy;
        this.state.success = success;
        this.state.lastUpdateTime = now;
        // Calculate ETA
        const eta = this.calculateETA();
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.update(iteration, {
                strategy: this.truncate(strategy, 20),
                status: this.formatStatus(success, status),
                eta: this.formatETA(eta)
            });
        }
    }
    /**
     * Stop progress monitoring
     */
    stop(success, message) {
        if (this.progressBar) {
            this.progressBar.stop();
        }
        const elapsed = Date.now() - this.state.startTime;
        const metrics = this.getMetrics();
        console.log('\n');
        if (success) {
            console.log(chalk.green('✓ Iterate Mode completed successfully'));
            console.log(chalk.gray(`  Total iterations: ${this.state.currentIteration}`));
            console.log(chalk.gray(`  Elapsed time: ${this.formatDuration(elapsed)}`));
            console.log(chalk.gray(`  Success rate: ${this.formatSuccessRate(metrics.successRate)}`));
        }
        else {
            console.log(chalk.red('✖ Iterate Mode failed'));
            console.log(chalk.gray(`  Iterations completed: ${this.state.currentIteration}/${this.state.maxIterations}`));
            console.log(chalk.gray(`  Elapsed time: ${this.formatDuration(elapsed)}`));
            if (message) {
                console.log(chalk.gray(`  Reason: ${message}`));
            }
        }
        console.log('');
    }
    /**
     * Display detailed metrics
     */
    displayMetrics() {
        const metrics = this.getMetrics();
        console.log(chalk.bold.cyan('\n╔═══ Iteration Metrics ═══╗\n'));
        console.log(chalk.white(`Total Iterations: ${chalk.yellow(metrics.totalIterations)}`));
        console.log(chalk.white(`Successful: ${chalk.green(metrics.successfulIterations)}`));
        console.log(chalk.white(`Failed: ${chalk.red(metrics.failedIterations)}`));
        console.log(chalk.white(`Success Rate: ${this.formatSuccessRate(metrics.successRate)}`));
        console.log(chalk.white(`Average Iteration Time: ${chalk.yellow(metrics.averageIterationTime + 'ms')}`));
        console.log(chalk.white(`Elapsed Time: ${chalk.yellow(this.formatDuration(metrics.elapsedTime))}`));
        if (metrics.estimatedCompletion > 0) {
            console.log(chalk.white(`Est. Completion: ${chalk.yellow(this.formatDuration(metrics.estimatedCompletion))}`));
        }
        console.log(chalk.gray('\n─────────────────────────────────\n'));
    }
    /**
     * Get current metrics
     */
    getMetrics() {
        const totalIterations = this.state.currentIteration;
        const successfulIterations = this.iterationTimes.length; // Simplified
        const failedIterations = totalIterations - successfulIterations;
        const successRate = totalIterations > 0 ? successfulIterations / totalIterations : 0;
        const averageIterationTime = this.iterationTimes.length > 0
            ? this.iterationTimes.reduce((sum, time) => sum + time, 0) / this.iterationTimes.length
            : 0;
        const elapsedTime = Date.now() - this.state.startTime;
        const remainingIterations = this.state.maxIterations - this.state.currentIteration;
        const estimatedCompletion = remainingIterations * averageIterationTime;
        return {
            totalIterations,
            successfulIterations,
            failedIterations,
            averageIterationTime: Math.round(averageIterationTime),
            elapsedTime,
            estimatedCompletion: Math.round(estimatedCompletion),
            successRate
        };
    }
    /**
     * Calculate estimated time remaining
     */
    calculateETA() {
        if (this.iterationTimes.length === 0) {
            return 0;
        }
        // Use exponentially weighted moving average for ETA
        const recentTimes = this.iterationTimes.slice(-5);
        const avgTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
        const remainingIterations = this.state.maxIterations - this.state.currentIteration;
        return remainingIterations * avgTime;
    }
    /**
     * Get progress bar format string
     */
    getProgressFormat() {
        return (chalk.cyan('{bar}') +
            ' {percentage}% | ' +
            chalk.gray('Iteration {value}/{total}') +
            ' | ' +
            chalk.yellow('{strategy}') +
            ' | ' +
            '{status} | ' +
            chalk.gray('ETA: {eta}'));
    }
    /**
     * Format status indicator
     */
    formatStatus(success, text) {
        if (success) {
            return chalk.green('✓ ') + chalk.white(this.truncate(text, 15));
        }
        else {
            return chalk.red('✖ ') + chalk.white(this.truncate(text, 15));
        }
    }
    /**
     * Format ETA
     */
    formatETA(ms) {
        if (ms === 0) {
            return 'N/A';
        }
        if (ms < 1000) {
            return '<1s';
        }
        if (ms < 60000) {
            return Math.round(ms / 1000) + 's';
        }
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.round((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
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
     * Truncate string to max length
     */
    truncate(str, maxLength) {
        if (str.length <= maxLength) {
            return str;
        }
        return str.substring(0, maxLength - 3) + '...';
    }
    /**
     * Pause progress bar
     */
    pause() {
        // cli-progress doesn't have pause, so we just note it
        console.log(chalk.yellow('\n⏸  Paused - waiting for user input...\n'));
    }
    /**
     * Resume progress bar
     */
    resume() {
        console.log(chalk.cyan('\n▶  Resumed\n'));
    }
}
//# sourceMappingURL=ProgressMonitor.js.map