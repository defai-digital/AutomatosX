/**
 * Streaming Handler
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Handles token-by-token streaming, loading indicators, and formatted output
 */
import chalk from 'chalk';
import ora from 'ora';
export class StreamingHandler {
    spinner;
    currentLine = '';
    /**
     * Start loading indicator
     */
    startThinking(message = 'Thinking...') {
        this.spinner = ora({
            text: message,
            color: 'cyan',
        }).start();
    }
    /**
     * Stop loading indicator
     */
    stopThinking() {
        if (this.spinner) {
            this.spinner.stop();
            this.spinner = undefined;
        }
    }
    /**
     * Stream a single token without newline
     */
    streamToken(token) {
        // Stop spinner if still active
        this.stopThinking();
        // Write token without newline
        process.stdout.write(chalk.white(token));
        this.currentLine += token;
        // Track line breaks
        if (token.includes('\n')) {
            this.currentLine = '';
        }
    }
    /**
     * Finish streaming and ensure newline
     */
    finishStream() {
        if (this.currentLine && !this.currentLine.endsWith('\n')) {
            process.stdout.write('\n');
        }
        this.currentLine = '';
    }
    /**
     * Display error message
     */
    displayError(error) {
        this.stopThinking();
        console.log(chalk.red('\n❌ Error: ') + error.message);
        console.log();
    }
    /**
     * Display success message
     */
    displaySuccess(message) {
        this.stopThinking();
        console.log(chalk.green('\n✅ ' + message + '\n'));
    }
    /**
     * Display info message
     */
    displayInfo(message) {
        console.log(chalk.cyan('\nℹ️  ' + message + '\n'));
    }
    /**
     * Display warning message
     */
    displayWarning(message) {
        console.log(chalk.yellow('\n⚠️  ' + message + '\n'));
    }
    /**
     * Display system message
     */
    displaySystem(message) {
        console.log(chalk.gray('\n[System] ' + message + '\n'));
    }
    /**
     * Clear current line (for progress updates)
     */
    clearLine() {
        if (process.stdout.isTTY) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
        }
    }
    /**
     * Display progress bar
     */
    displayProgress(current, total, label = 'Progress') {
        const percentage = Math.round((current / total) * 100);
        const barLength = 30;
        const filled = Math.round((current / total) * barLength);
        const empty = barLength - filled;
        this.clearLine();
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write(chalk.cyan(`${label}: [${bar}] ${percentage}% (${current}/${total})`));
        if (current >= total) {
            process.stdout.write('\n');
        }
    }
}
//# sourceMappingURL=StreamingHandler.js.map