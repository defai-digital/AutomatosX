/**
 * ErrorHandler.ts
 *
 * Enhanced error handling with user-friendly messages and recovery suggestions
 */
/**
 * Error categories for better error handling
 */
export declare enum ErrorCategory {
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    DIRECTORY_NOT_FOUND = "DIRECTORY_NOT_FOUND",
    NO_FILES_TO_INDEX = "NO_FILES_TO_INDEX",
    NO_RESULTS_FOUND = "NO_RESULTS_FOUND",
    INVALID_QUERY = "INVALID_QUERY",
    DATABASE_ERROR = "DATABASE_ERROR",
    PARSER_ERROR = "PARSER_ERROR",
    MIGRATION_ERROR = "MIGRATION_ERROR",
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
    PERMISSION_ERROR = "PERMISSION_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
/**
 * Error with recovery suggestions
 */
export interface EnhancedError {
    category: ErrorCategory;
    message: string;
    suggestions: string[];
    originalError?: Error;
}
/**
 * Error handler with recovery suggestions
 */
export declare class ErrorHandler {
    /**
     * Create enhanced error from standard error
     */
    static enhance(error: Error | unknown): EnhancedError;
    /**
     * File not found error
     */
    static fileNotFound(message: string, originalError?: Error): EnhancedError;
    /**
     * Directory not found error
     */
    static directoryNotFound(message: string, originalError?: Error): EnhancedError;
    /**
     * No files to index error
     */
    static noFilesToIndex(extensions: string[]): EnhancedError;
    /**
     * No results found error
     */
    static noResultsFound(query: string): EnhancedError;
    /**
     * Invalid query error
     */
    static invalidQuery(query: string, reason: string): EnhancedError;
    /**
     * Database error
     */
    static databaseError(message: string, originalError?: Error): EnhancedError;
    /**
     * Parser error
     */
    static parserError(message: string, originalError?: Error): EnhancedError;
    /**
     * Migration error
     */
    static migrationError(message: string, originalError?: Error): EnhancedError;
    /**
     * Configuration error
     */
    static configurationError(message: string, originalError?: Error): EnhancedError;
    /**
     * Permission error
     */
    static permissionError(message: string, originalError?: Error): EnhancedError;
    /**
     * Unknown error
     */
    static unknownError(message: string, originalError?: Error): EnhancedError;
    /**
     * Display enhanced error with formatting
     */
    static display(error: EnhancedError, verbose?: boolean): void;
    /**
     * Handle error and exit
     */
    static handleAndExit(error: Error | unknown, verbose?: boolean): never;
    /**
     * Create error for no index data
     */
    static noIndexData(): EnhancedError;
    /**
     * Validate query and throw if invalid
     */
    static validateQuery(query: string): void;
    /**
     * Validate directory exists
     */
    static validateDirectoryExists(path: string): void;
    /**
     * Validate file exists
     */
    static validateFileExists(path: string): void;
}
/**
 * Success message helper
 */
export declare class SuccessMessage {
    /**
     * Display success message
     */
    static display(message: string, details?: string[]): void;
}
/**
 * Warning message helper
 */
export declare class WarningMessage {
    /**
     * Display warning message
     */
    static display(message: string, details?: string[]): void;
}
/**
 * Info message helper
 */
export declare class InfoMessage {
    /**
     * Display info message
     */
    static display(message: string, details?: string[]): void;
}
//# sourceMappingURL=ErrorHandler.d.ts.map