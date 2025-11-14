/**
 * AutomatosX v8.0.0 - Table Formatter
 *
 * Rich ASCII table formatting for CLI output using cli-table3
 */
/**
 * Table column definition
 */
export interface TableColumn {
    header: string;
    key: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    color?: (value: string) => string;
}
/**
 * Table options
 */
export interface TableOptions {
    title?: string;
    compact?: boolean;
    showHeader?: boolean;
}
/**
 * Table Formatter
 *
 * Creates formatted ASCII tables with Unicode box drawing characters
 * Supports colors, alignment, and custom formatting
 */
export declare class TableFormatter {
    /**
     * Create formatted ASCII table
     * @param columns - Column definitions
     * @param rows - Data rows
     * @param options - Table styling options
     */
    createTable(columns: TableColumn[], rows: Record<string, unknown>[], options?: TableOptions): string;
    /**
     * Create simple two-column key-value table
     */
    createKeyValueTable(data: Record<string, string | number>, options?: TableOptions): string;
    /**
     * Create compact list (for small datasets)
     */
    createList(items: string[], options?: {
        bullet?: string;
        color?: (s: string) => string;
        numbered?: boolean;
    }): string;
    /**
     * Create horizontal separator
     */
    createSeparator(length?: number, char?: string): string;
    /**
     * Create section header
     */
    createHeader(text: string, level?: 1 | 2 | 3): string;
    /**
     * Format status indicator
     */
    formatStatus(status: string): string;
    /**
     * Format percentage with color
     */
    formatPercentage(value: number): string;
    /**
     * Format file size
     */
    formatFileSize(bytes: number): string;
    /**
     * Format duration
     */
    formatDuration(ms: number): string;
    /**
     * Get table border characters (Unicode box drawing)
     */
    private getTableChars;
}
//# sourceMappingURL=TableFormatter.d.ts.map