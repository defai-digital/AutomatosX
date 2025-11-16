/**
 * CLI output formatting utilities
 * Shared utilities for consistent CLI output formatting
 */
/**
 * Format options for list output
 */
export type OutputFormat = 'table' | 'json' | 'list';
/**
 * Output array as JSON
 */
export declare function outputAsJson(data: any[]): void;
/**
 * Output array as simple list
 */
export declare function outputAsList(data: string[]): void;
/**
 * Show empty results message
 */
export declare function showEmptyMessage(resourceType: string, setupCommand?: string): void;
/**
 * Show section header
 */
export declare function showSectionHeader(title: string): void;
/**
 * Show section footer with total count
 */
export declare function showSectionFooter(count: number, resourceType: string): void;
/**
 * Handle standard output format selection
 */
export declare function handleOutputFormat<T>(data: T[], format: OutputFormat | undefined, defaultFormatter: () => void | Promise<void>): Promise<void>;
//# sourceMappingURL=cli-formatters.d.ts.map