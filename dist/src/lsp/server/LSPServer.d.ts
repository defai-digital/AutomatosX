/**
 * LSP Server
 *
 * Main Language Server Protocol server implementation.
 * Handles LSP lifecycle, connection, and request routing.
 */
import { DocumentManager } from './DocumentManager.js';
import { IntegrationService } from './IntegrationService.js';
/**
 * LSP Server Configuration
 */
export interface LSPServerConfig {
    name: string;
    version: string;
    enableLogging: boolean;
}
/**
 * LSP Server
 * Main entry point for Language Server Protocol implementation
 */
export declare class LSPServer {
    private connection;
    private documents;
    private documentManager;
    private integrationService;
    private definitionProvider;
    private referencesProvider;
    private hoverProvider;
    private completionProvider;
    private documentSymbolsProvider;
    private renameProvider;
    private codeActionsProvider;
    private formattingProvider;
    private workspaceSymbolsProvider;
    private qualityIntegration;
    private config;
    private initialized;
    constructor(config?: Partial<LSPServerConfig>);
    /**
     * Register LSP request handlers
     */
    private registerHandlers;
    /**
     * Handle initialize request
     */
    private onInitialize;
    /**
     * Handle initialized notification
     */
    private onInitialized;
    /**
     * Handle shutdown request
     */
    private onShutdown;
    /**
     * Handle exit notification
     */
    private onExit;
    /**
     * Handle document opened
     */
    private onDocumentOpened;
    /**
     * Handle document changed
     */
    private onDocumentChanged;
    /**
     * Handle document closed
     */
    private onDocumentClosed;
    /**
     * Handle document saved
     */
    private onDocumentSaved;
    /**
     * Handle textDocument/definition request
     */
    private onDefinition;
    /**
     * Handle textDocument/references request
     */
    private onReferences;
    /**
     * Handle textDocument/hover request
     */
    private onHover;
    /**
     * Handle textDocument/completion request
     */
    private onCompletion;
    /**
     * Handle completionItem/resolve request
     */
    private onCompletionResolve;
    /**
     * Handle textDocument/documentSymbol request
     */
    private onDocumentSymbol;
    /**
     * Handle textDocument/rename request
     */
    private onRename;
    /**
     * Handle textDocument/prepareRename request
     */
    private onPrepareRename;
    /**
     * Handle textDocument/codeAction request
     */
    private onCodeAction;
    /**
     * Handle textDocument/formatting request
     */
    private onDocumentFormatting;
    /**
     * Handle textDocument/rangeFormatting request
     */
    private onDocumentRangeFormatting;
    /**
     * Handle workspace/symbol request
     */
    private onWorkspaceSymbol;
    /**
     * Start the server
     */
    start(): void;
    /**
     * Stop the server
     */
    stop(): void;
    /**
     * Log message
     */
    private log;
    /**
     * Log error
     */
    private logError;
    /**
     * Get server statistics
     */
    getStats(): {
        initialized: boolean;
        documents: number;
        cacheStats: ReturnType<IntegrationService['getCacheStats']>;
        documentStats: ReturnType<DocumentManager['getStats']>;
    };
}
/**
 * Create and start LSP server
 */
export declare function startLSPServer(config?: Partial<LSPServerConfig>): LSPServer;
//# sourceMappingURL=LSPServer.d.ts.map