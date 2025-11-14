/**
 * Quality Integration Service
 *
 * Bridge between LSP diagnostics and QualityService.
 * Manages diagnostics lifecycle: analysis, caching, publishing, clearing.
 * Debounces updates and batches diagnostics for performance.
 */
import { DiagnosticsProvider } from '../providers/DiagnosticsProvider.js';
import { filePathToUri } from '../utils/lsp-utils.js';
const DEFAULT_CONFIG = {
    enabled: true,
    debounceMs: 300,
    batchSize: 10,
    autoAnalyzeOnSave: true,
    autoAnalyzeOnChange: true,
};
/**
 * Quality Integration Service
 * Manages quality analysis and diagnostics publishing
 */
export class QualityIntegration {
    connection;
    documentManager;
    diagnosticsProvider;
    config;
    pendingUpdates = new Set();
    updateTimer;
    analysisCount = 0;
    publishCount = 0;
    constructor(connection, documentManager, config) {
        this.connection = connection;
        this.documentManager = documentManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.diagnosticsProvider = new DiagnosticsProvider(documentManager, {
            debounceMs: this.config.debounceMs,
        });
        this.setupEventHandlers();
    }
    /**
     * Setup event handlers for document changes
     */
    setupEventHandlers() {
        // Note: Event handlers should be registered by LSPServer
        // This method is a placeholder for future enhancements
    }
    /**
     * Analyze document and publish diagnostics
     */
    async analyzeAndPublish(uri) {
        if (!this.config.enabled) {
            return;
        }
        try {
            this.analysisCount++;
            const diagnostics = await this.diagnosticsProvider.provideDiagnostics(uri);
            this.publishDiagnostics(uri, diagnostics);
        }
        catch (error) {
            console.error(`Error analyzing and publishing diagnostics for ${uri}:`, error);
        }
    }
    /**
     * Analyze document with debouncing
     */
    analyzeDebounced(uri) {
        if (!this.config.enabled) {
            return;
        }
        // Add to pending updates
        this.pendingUpdates.add(uri);
        // Clear existing timer
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        // Set new timer
        this.updateTimer = setTimeout(() => {
            this.processPendingUpdates();
        }, this.config.debounceMs);
    }
    /**
     * Process pending diagnostics updates
     */
    async processPendingUpdates() {
        const uris = Array.from(this.pendingUpdates);
        this.pendingUpdates.clear();
        // Process in batches
        for (let i = 0; i < uris.length; i += this.config.batchSize) {
            const batch = uris.slice(i, i + this.config.batchSize);
            await Promise.all(batch.map((uri) => this.analyzeAndPublish(uri)));
        }
    }
    /**
     * Publish diagnostics to client
     */
    publishDiagnostics(uri, diagnostics) {
        this.connection.sendDiagnostics({
            uri,
            diagnostics,
        });
        this.publishCount++;
    }
    /**
     * Clear diagnostics for document
     */
    clearDiagnostics(uri) {
        this.diagnosticsProvider.clearDiagnostics(uri);
        this.publishDiagnostics(uri, []);
        this.pendingUpdates.delete(uri);
    }
    /**
     * Clear all diagnostics
     */
    clearAllDiagnostics() {
        const uris = this.documentManager.getAllDocumentUris();
        for (const uri of uris) {
            this.clearDiagnostics(uri);
        }
    }
    /**
     * Handle document opened
     */
    async onDocumentOpened(uri) {
        if (this.config.enabled) {
            await this.analyzeAndPublish(uri);
        }
    }
    /**
     * Handle document changed
     */
    onDocumentChanged(uri) {
        if (this.config.autoAnalyzeOnChange) {
            this.analyzeDebounced(uri);
        }
    }
    /**
     * Handle document saved
     */
    async onDocumentSaved(uri) {
        if (this.config.autoAnalyzeOnSave) {
            await this.analyzeAndPublish(uri);
        }
    }
    /**
     * Handle document closed
     */
    onDocumentClosed(uri) {
        this.clearDiagnostics(uri);
    }
    /**
     * Refresh diagnostics for all open documents
     */
    async refreshAllDiagnostics() {
        const uris = this.documentManager.getAllDocumentUris();
        for (const uri of uris) {
            await this.analyzeAndPublish(uri);
        }
    }
    /**
     * Refresh diagnostics for specific file
     */
    async refreshFileDiagnostics(filePath) {
        const uri = filePathToUri(filePath);
        await this.analyzeAndPublish(uri);
    }
    /**
     * Enable/disable quality analysis
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        if (!enabled) {
            this.clearAllDiagnostics();
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            enabled: this.config.enabled,
            analysisCount: this.analysisCount,
            publishCount: this.publishCount,
            pendingUpdates: this.pendingUpdates.size,
            diagnosticsStats: this.diagnosticsProvider.getStats(),
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        this.pendingUpdates.clear();
        this.diagnosticsProvider.dispose();
    }
}
//# sourceMappingURL=QualityIntegration.js.map