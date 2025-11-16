/**
 * CLI output formatting utilities
 * Shared utilities for consistent CLI output formatting
 */
import chalk from 'chalk';
/**
 * Constants for CLI formatting
 */
const SEPARATOR_WIDTH = 80;
/**
 * Output array as JSON
 */
export function outputAsJson(data) {
    console.log(JSON.stringify(data, null, 2));
}
/**
 * Output array as simple list
 */
export function outputAsList(data) {
    data.forEach(item => console.log(item));
}
/**
 * Show empty results message
 */
export function showEmptyMessage(resourceType, setupCommand) {
    console.log(chalk.yellow(`\nNo ${resourceType} found\n`));
    if (setupCommand) {
        console.log(chalk.gray(`Run: ${setupCommand}\n`));
    }
}
/**
 * Show section header
 */
export function showSectionHeader(title) {
    console.log(chalk.bold(`\n${title}\n`));
    console.log('─'.repeat(SEPARATOR_WIDTH));
}
/**
 * Show section footer with total count
 */
export function showSectionFooter(count, resourceType) {
    console.log('\n' + '─'.repeat(SEPARATOR_WIDTH));
    console.log(chalk.gray(`Total: ${count} ${resourceType}\n`));
}
/**
 * Handle standard output format selection
 */
export async function handleOutputFormat(data, format, defaultFormatter) {
    if (format === 'json') {
        outputAsJson(data);
        return;
    }
    if (format === 'list' && data.length > 0 && typeof data[0] === 'string') {
        outputAsList(data);
        return;
    }
    // Use default table/custom formatter (may be async)
    await defaultFormatter();
}
//# sourceMappingURL=cli-formatters.js.map