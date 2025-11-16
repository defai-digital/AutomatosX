/**
 * Simple logger shim for CLI commands
 * Provides consistent colored logging across AutomatosX commands
 */
export declare const logger: {
    /**
     * Log informational message (blue)
     */
    info: (message: string, metadata?: unknown) => void;
    /**
     * Log success message (green)
     */
    success: (message: string, metadata?: unknown) => void;
    /**
     * Log warning message (yellow)
     */
    warn: (message: string, metadata?: unknown) => void;
    /**
     * Log error message (red)
     */
    error: (message: string, metadata?: unknown) => void;
    /**
     * Log debug message (gray, only if DEBUG env var set)
     */
    debug: (message: string, metadata?: unknown) => void;
    /**
     * Log plain message without icon
     */
    log: (message: string) => void;
};
//# sourceMappingURL=logger.d.ts.map