/**
 * Quality Integration Service
 *
 * Bridge between LSP diagnostics and QualityService.
 * Manages diagnostics lifecycle: analysis, caching, publishing, clearing.
 * Debounces updates and batches diagnostics for performance.
 */
import type { Connection } from 'vscode-languageserver/node.js';
import { DiagnosticsProvider } from '../providers/DiagnosticsProvider.js';
import type { DocumentManager } from '../server/DocumentManager.js';
/**
 * Quality Integration Configuration
 */
export interface QualityIntegrationConfig {
    enabled: boolean;
    debounceMs: number;
    batchSize: number;
    autoAnalyzeOnSave: boolean;
    autoAnalyzeOnChange: boolean;
}
/**
 * Quality Integration Service
 * Manages quality analysis and diagnostics publishing
 */
export declare class QualityIntegration {
    private connection;
    private documentManager;
    private diagnosticsProvider;
    private config;
    private pendingUpdates;
    private updateTimer?;
    private analysisCount;
    private publishCount;
    constructor(connection: Connection, documentManager: DocumentManager, config?: Partial<QualityIntegrationConfig>);
    /**
     * Setup event handlers for document changes
     */
    private setupEventHandlers;
    /**
     * Analyze document and publish diagnostics
     */
    analyzeAndPublish(uri: string): Promise<void>;
    /**
     * Analyze document with debouncing
     */
    analyzeDebounced(uri: string): void;
    /**
     * Process pending diagnostics updates
     */
    private processPendingUpdates;
    /**
     * Publish diagnostics to client
     */
    private publishDiagnostics;
    /**
     * Clear diagnostics for document
     */
    clearDiagnostics(uri: string): void;
    /**
     * Clear all diagnostics
     */
    clearAllDiagnostics(): void;
    /**
     * Handle document opened
     */
    onDocumentOpened(uri: string): Promise<void>;
    /**
     * Handle document changed
     */
    onDocumentChanged(uri: string): void;
    /**
     * Handle document saved
     */
    onDocumentSaved(uri: string): Promise<void>;
    /**
     * Handle document closed
     */
    onDocumentClosed(uri: string): void;
    /**
     * Refresh diagnostics for all open documents
     */
    refreshAllDiagnostics(): Promise<void>;
    /**
     * Refresh diagnostics for specific file
     */
    refreshFileDiagnostics(filePath: string): Promise<void>;
    /**
     * Enable/disable quality analysis
     */
    setEnabled(enabled: boolean): void;
    /**
     * Get statistics
     */
    getStats(): {
        enabled: boolean;
        analysisCount: number;
        publishCount: number;
        pendingUpdates: number;
        diagnosticsStats: ReturnType<DiagnosticsProvider['getStats']>;
    };
    /**
     * Dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=QualityIntegration.d.ts.map