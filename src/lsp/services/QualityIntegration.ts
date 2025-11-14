/**
 * Quality Integration Service
 *
 * Bridge between LSP diagnostics and QualityService.
 * Manages diagnostics lifecycle: analysis, caching, publishing, clearing.
 * Debounces updates and batches diagnostics for performance.
 */

import type { Connection, Diagnostic as LSPDiagnostic } from 'vscode-languageserver/node.js';
import { DiagnosticsProvider } from '../providers/DiagnosticsProvider.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import { filePathToUri } from '../utils/lsp-utils.js';

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

const DEFAULT_CONFIG: QualityIntegrationConfig = {
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
  private diagnosticsProvider: DiagnosticsProvider;
  private config: QualityIntegrationConfig;
  private pendingUpdates: Set<string> = new Set();
  private updateTimer?: NodeJS.Timeout;
  private analysisCount = 0;
  private publishCount = 0;

  constructor(
    private connection: Connection,
    private documentManager: DocumentManager,
    config?: Partial<QualityIntegrationConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.diagnosticsProvider = new DiagnosticsProvider(documentManager, {
      debounceMs: this.config.debounceMs,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for document changes
   */
  private setupEventHandlers(): void {
    // Note: Event handlers should be registered by LSPServer
    // This method is a placeholder for future enhancements
  }

  /**
   * Analyze document and publish diagnostics
   */
  async analyzeAndPublish(uri: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      this.analysisCount++;

      const diagnostics = await this.diagnosticsProvider.provideDiagnostics(uri);

      this.publishDiagnostics(uri, diagnostics);
    } catch (error) {
      console.error(`Error analyzing and publishing diagnostics for ${uri}:`, error);
    }
  }

  /**
   * Analyze document with debouncing
   */
  analyzeDebounced(uri: string): void {
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
  private async processPendingUpdates(): Promise<void> {
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
  private publishDiagnostics(uri: string, diagnostics: LSPDiagnostic[]): void {
    this.connection.sendDiagnostics({
      uri,
      diagnostics,
    });

    this.publishCount++;
  }

  /**
   * Clear diagnostics for document
   */
  clearDiagnostics(uri: string): void {
    this.diagnosticsProvider.clearDiagnostics(uri);
    this.publishDiagnostics(uri, []);
    this.pendingUpdates.delete(uri);
  }

  /**
   * Clear all diagnostics
   */
  clearAllDiagnostics(): void {
    const uris = this.documentManager.getAllDocumentUris();

    for (const uri of uris) {
      this.clearDiagnostics(uri);
    }
  }

  /**
   * Handle document opened
   */
  async onDocumentOpened(uri: string): Promise<void> {
    if (this.config.enabled) {
      await this.analyzeAndPublish(uri);
    }
  }

  /**
   * Handle document changed
   */
  onDocumentChanged(uri: string): void {
    if (this.config.autoAnalyzeOnChange) {
      this.analyzeDebounced(uri);
    }
  }

  /**
   * Handle document saved
   */
  async onDocumentSaved(uri: string): Promise<void> {
    if (this.config.autoAnalyzeOnSave) {
      await this.analyzeAndPublish(uri);
    }
  }

  /**
   * Handle document closed
   */
  onDocumentClosed(uri: string): void {
    this.clearDiagnostics(uri);
  }

  /**
   * Refresh diagnostics for all open documents
   */
  async refreshAllDiagnostics(): Promise<void> {
    const uris = this.documentManager.getAllDocumentUris();

    for (const uri of uris) {
      await this.analyzeAndPublish(uri);
    }
  }

  /**
   * Refresh diagnostics for specific file
   */
  async refreshFileDiagnostics(filePath: string): Promise<void> {
    const uri = filePathToUri(filePath);
    await this.analyzeAndPublish(uri);
  }

  /**
   * Enable/disable quality analysis
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (!enabled) {
      this.clearAllDiagnostics();
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    enabled: boolean;
    analysisCount: number;
    publishCount: number;
    pendingUpdates: number;
    diagnosticsStats: ReturnType<DiagnosticsProvider['getStats']>;
  } {
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
  dispose(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.pendingUpdates.clear();
    this.diagnosticsProvider.dispose();
  }
}
