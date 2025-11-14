/**
 * Diagnostics Provider
 *
 * Provides code quality diagnostics for documents.
 * Integrates with QualityService to analyze code quality.
 * Publishes diagnostics for complexity, maintainability, and code smells.
 */
import type { Diagnostic as LSPDiagnostic } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
/**
 * Diagnostic configuration
 */
export interface DiagnosticsConfig {
    enabled: boolean;
    complexityThreshold: number;
    maintainabilityThreshold: number;
    debounceMs: number;
}
/**
 * Diagnostics Provider
 * Analyzes code quality and publishes diagnostics
 */
export declare class DiagnosticsProvider {
    private documentManager;
    private qualityService;
    private config;
    private debounceTimers;
    private diagnosticsCache;
    constructor(documentManager: DocumentManager, config?: Partial<DiagnosticsConfig>);
    /**
     * Analyze document and return diagnostics
     */
    provideDiagnostics(uri: string): Promise<LSPDiagnostic[]>;
    /**
     * Analyze document with debouncing
     */
    provideDiagnosticsDebounced(uri: string, callback: (diagnostics: LSPDiagnostic[]) => void): Promise<void>;
    /**
     * Clear diagnostics for document
     */
    clearDiagnostics(uri: string): void;
    /**
     * Convert QualityReport to LSP diagnostics
     */
    private convertQualityReportToDiagnostics;
    /**
     * Get diagnostic severity for complexity
     */
    private getSeverityForComplexity;
    /**
     * Get diagnostic severity for maintainability
     */
    private getSeverityForMaintainability;
    /**
     * Map code smell severity to LSP severity
     */
    private mapSmellSeverity;
    /**
     * Create range from code smell
     */
    private createRangeFromSmell;
    /**
     * Create file-level range (line 0)
     */
    private createFileRange;
    /**
     * Map language ID to Language enum
     */
    private mapLanguageId;
    /**
     * Get statistics
     */
    getStats(): {
        cachedFiles: number;
        pendingAnalysis: number;
    };
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=DiagnosticsProvider.d.ts.map