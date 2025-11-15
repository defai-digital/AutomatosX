/**
 * Streaming Handler
 *
 * Week 1 Implementation - Interactive CLI Mode
 * Handles token-by-token streaming, loading indicators, and formatted output
 */
export declare class StreamingHandler {
    private spinner?;
    private currentLine;
    /**
     * Start loading indicator
     */
    startThinking(message?: string): void;
    /**
     * Stop loading indicator
     */
    stopThinking(): void;
    /**
     * Stream a single token without newline
     */
    streamToken(token: string): void;
    /**
     * Finish streaming and ensure newline
     */
    finishStream(): void;
    /**
     * Display error message
     */
    displayError(error: Error): void;
    /**
     * Display success message
     */
    displaySuccess(message: string): void;
    /**
     * Display info message
     */
    displayInfo(message: string): void;
    /**
     * Display warning message
     */
    displayWarning(message: string): void;
    /**
     * Display system message
     */
    displaySystem(message: string): void;
    /**
     * Clear current line (for progress updates)
     */
    clearLine(): void;
    /**
     * Display progress bar
     */
    displayProgress(current: number, total: number, label?: string): void;
}
//# sourceMappingURL=StreamingHandler.d.ts.map