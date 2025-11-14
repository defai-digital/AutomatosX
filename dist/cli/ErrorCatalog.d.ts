/**
 * Error Catalog
 * Sprint 6 Day 56: Standardized error messages with codes and remediation guidance
 */
/**
 * Error severity level
 */
export declare enum ErrorSeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
}
/**
 * Error category
 */
export declare enum ErrorCategory {
    DATABASE = "database",
    FILE_SYSTEM = "file_system",
    PARSER = "parser",
    NETWORK = "network",
    CONFIGURATION = "configuration",
    VALIDATION = "validation",
    PERMISSION = "permission",
    RESOURCE = "resource",
    PLUGIN = "plugin",
    MIGRATION = "migration"
}
/**
 * Error entry
 */
export interface ErrorEntry {
    code: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    message: string;
    description: string;
    remediation: string[];
    learnMore?: string;
}
/**
 * Error Catalog - Standardized error messages
 */
export declare class ErrorCatalog {
    private static errors;
    /**
     * Get error by code
     */
    static getError(code: string): ErrorEntry | undefined;
    /**
     * Get all errors
     */
    static getAllErrors(): ErrorEntry[];
    /**
     * Get errors by category
     */
    static getErrorsByCategory(category: ErrorCategory): ErrorEntry[];
    /**
     * Get errors by severity
     */
    static getErrorsBySeverity(severity: ErrorSeverity): ErrorEntry[];
    /**
     * Format error for display
     */
    static formatError(code: string, context?: Record<string, unknown>): string;
    /**
     * Register custom error
     */
    static registerError(error: ErrorEntry): void;
    /**
     * Check if error exists
     */
    static hasError(code: string): boolean;
    /**
     * Get error count
     */
    static getErrorCount(): number;
    /**
     * Get all error codes
     */
    static getAllErrorCodes(): string[];
    /**
     * Clear all custom errors (built-in errors remain)
     */
    static clearCustomErrors(): void;
}
/**
 * Create error instance from catalog
 */
export declare function createCatalogError(code: string, context?: Record<string, unknown>): Error;
//# sourceMappingURL=ErrorCatalog.d.ts.map