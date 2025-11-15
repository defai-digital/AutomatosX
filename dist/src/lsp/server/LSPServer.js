/**
 * LSP Server
 *
 * Main Language Server Protocol server implementation.
 * Handles LSP lifecycle, connection, and request routing.
 */
import { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind, } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from './DocumentManager.js';
import { IntegrationService } from './IntegrationService.js';
import { DefinitionProvider } from '../providers/DefinitionProvider.js';
import { ReferencesProvider } from '../providers/ReferencesProvider.js';
import { HoverProvider } from '../providers/HoverProvider.js';
import { CompletionProvider } from '../providers/CompletionProvider.js';
import { DocumentSymbolsProvider } from '../providers/DocumentSymbolsProvider.js';
import { RenameProvider } from '../providers/RenameProvider.js';
import { CodeActionsProvider } from '../providers/CodeActionsProvider.js';
import { FormattingProvider } from '../providers/FormattingProvider.js';
import { WorkspaceSymbolsProvider } from '../providers/WorkspaceSymbolsProvider.js';
import { QualityIntegration } from '../services/QualityIntegration.js';
const DEFAULT_CONFIG = {
    name: 'AutomatosX Language Server',
    version: '2.0.0',
    enableLogging: true,
};
/**
 * LSP Server
 * Main entry point for Language Server Protocol implementation
 */
export class LSPServer {
    connection = createConnection(ProposedFeatures.all);
    documents = new TextDocuments(TextDocument);
    documentManager;
    integrationService;
    definitionProvider;
    referencesProvider;
    hoverProvider;
    completionProvider;
    documentSymbolsProvider;
    renameProvider;
    codeActionsProvider;
    formattingProvider;
    workspaceSymbolsProvider;
    qualityIntegration;
    config;
    initialized = false;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize services
        this.documentManager = new DocumentManager();
        this.integrationService = new IntegrationService();
        // Initialize providers
        this.definitionProvider = new DefinitionProvider(this.documentManager, this.integrationService);
        this.referencesProvider = new ReferencesProvider(this.documentManager, this.integrationService);
        this.hoverProvider = new HoverProvider(this.documentManager, this.integrationService);
        this.completionProvider = new CompletionProvider(this.documentManager, this.integrationService);
        this.documentSymbolsProvider = new DocumentSymbolsProvider(this.documentManager, this.integrationService);
        this.renameProvider = new RenameProvider(this.documentManager, this.integrationService);
        this.codeActionsProvider = new CodeActionsProvider(this.documentManager, this.integrationService);
        this.formattingProvider = new FormattingProvider(this.documentManager);
        this.workspaceSymbolsProvider = new WorkspaceSymbolsProvider(this.integrationService);
        this.qualityIntegration = new QualityIntegration(this.connection, this.documentManager);
        // Register handlers
        this.registerHandlers();
    }
    /**
     * Register LSP request handlers
     */
    registerHandlers() {
        // Lifecycle handlers
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));
        this.connection.onExit(this.onExit.bind(this));
        // Document sync handlers
        this.documents.onDidOpen(this.onDocumentOpened.bind(this));
        this.documents.onDidChangeContent(this.onDocumentChanged.bind(this));
        this.documents.onDidClose(this.onDocumentClosed.bind(this));
        this.documents.onDidSave(this.onDocumentSaved.bind(this));
        // Language feature handlers
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onReferences(this.onReferences.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        // Advanced feature handlers
        this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        this.connection.onRenameRequest(this.onRename.bind(this));
        this.connection.onPrepareRename(this.onPrepareRename.bind(this));
        this.connection.onCodeAction(this.onCodeAction.bind(this));
        this.connection.onDocumentFormatting(this.onDocumentFormatting.bind(this));
        this.connection.onDocumentRangeFormatting(this.onDocumentRangeFormatting.bind(this));
        this.connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this));
    }
    /**
     * Handle initialize request
     */
    onInitialize(params) {
        this.log(`Initializing ${this.config.name} v${this.config.version}`);
        this.log(`Client: ${params.clientInfo?.name} ${params.clientInfo?.version}`);
        this.log(`Root URI: ${params.rootUri}`);
        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
                    save: {
                        includeText: true,
                    },
                },
                definitionProvider: true,
                referencesProvider: true,
                hoverProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', ':', '<'],
                },
                documentSymbolProvider: true,
                renameProvider: {
                    prepareProvider: true,
                },
                codeActionProvider: {
                    codeActionKinds: [
                        'quickfix',
                        'refactor',
                        'refactor.extract',
                        'refactor.inline',
                        'refactor.rewrite',
                        'source',
                        'source.organizeImports',
                        'source.fixAll',
                    ],
                },
                documentFormattingProvider: true,
                documentRangeFormattingProvider: true,
                workspaceSymbolProvider: true,
            },
            serverInfo: {
                name: this.config.name,
                version: this.config.version,
            },
        };
    }
    /**
     * Handle initialized notification
     */
    onInitialized() {
        this.initialized = true;
        this.log('Server initialized successfully');
    }
    /**
     * Handle shutdown request
     */
    async onShutdown() {
        this.log('Shutting down server...');
        this.initialized = false;
        // Cleanup resources
        this.documentManager.clear();
        this.integrationService.dispose();
    }
    /**
     * Handle exit notification
     */
    onExit() {
        this.log('Server exited');
        process.exit(0);
    }
    /**
     * Handle document opened
     */
    async onDocumentOpened(event) {
        const { uri, languageId, version } = event.document;
        const text = event.document.getText();
        this.log(`Document opened: ${uri}`);
        await this.documentManager.onDocumentOpened(uri, languageId, version, text);
        await this.qualityIntegration.onDocumentOpened(uri);
    }
    /**
     * Handle document changed
     */
    async onDocumentChanged(event) {
        const { uri, version } = event.document;
        const text = event.document.getText();
        this.log(`Document changed: ${uri} (v${version})`);
        await this.documentManager.onDocumentChanged(uri, version, text);
        this.qualityIntegration.onDocumentChanged(uri);
    }
    /**
     * Handle document closed
     */
    onDocumentClosed(event) {
        const { uri } = event.document;
        this.log(`Document closed: ${uri}`);
        this.documentManager.onDocumentClosed(uri);
        this.qualityIntegration.onDocumentClosed(uri);
    }
    /**
     * Handle document saved
     */
    async onDocumentSaved(event) {
        const { uri } = event.document;
        const text = event.document.getText();
        this.log(`Document saved: ${uri}`);
        await this.documentManager.onDocumentSaved(uri, text);
        await this.qualityIntegration.onDocumentSaved(uri);
    }
    /**
     * Handle textDocument/definition request
     */
    async onDefinition(params) {
        const { textDocument, position } = params;
        this.log(`Definition request: ${textDocument.uri} at ${position.line}:${position.character}`);
        try {
            const result = await this.definitionProvider.provideDefinition(textDocument.uri, position);
            this.log(`Definition result: ${result ? 'found' : 'not found'}`);
            return result;
        }
        catch (error) {
            this.logError('Error in onDefinition:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/references request
     */
    async onReferences(params) {
        const { textDocument, position, context } = params;
        this.log(`References request: ${textDocument.uri} at ${position.line}:${position.character}`);
        try {
            const result = await this.referencesProvider.provideReferences(textDocument.uri, position, context);
            this.log(`References result: ${result?.length ?? 0} found`);
            return result;
        }
        catch (error) {
            this.logError('Error in onReferences:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/hover request
     */
    async onHover(params) {
        const { textDocument, position } = params;
        this.log(`Hover request: ${textDocument.uri} at ${position.line}:${position.character}`);
        try {
            const result = await this.hoverProvider.provideHover(textDocument.uri, position);
            this.log(`Hover result: ${result ? 'found' : 'not found'}`);
            return result;
        }
        catch (error) {
            this.logError('Error in onHover:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/completion request
     */
    async onCompletion(params) {
        const { textDocument, position, context } = params;
        this.log(`Completion request: ${textDocument.uri} at ${position.line}:${position.character}`);
        try {
            const result = await this.completionProvider.provideCompletions(textDocument.uri, position, context);
            this.log(`Completion result: ${result?.length ?? 0} items`);
            return result;
        }
        catch (error) {
            this.logError('Error in onCompletion:', error);
            return null;
        }
    }
    /**
     * Handle completionItem/resolve request
     */
    async onCompletionResolve(item) {
        // Currently no-op, but can be used to lazily resolve completion details
        return item;
    }
    /**
     * Handle textDocument/documentSymbol request
     */
    async onDocumentSymbol(params) {
        const { textDocument } = params;
        this.log(`Document symbol request: ${textDocument.uri}`);
        try {
            const result = await this.documentSymbolsProvider.provideDocumentSymbols(textDocument.uri);
            this.log(`Document symbol result: ${result?.length ?? 0} symbols`);
            return result;
        }
        catch (error) {
            this.logError('Error in onDocumentSymbol:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/rename request
     */
    async onRename(params) {
        const { textDocument, position, newName } = params;
        this.log(`Rename request: ${textDocument.uri} at ${position.line}:${position.character} to "${newName}"`);
        try {
            const result = await this.renameProvider.provideRename(textDocument.uri, position, newName);
            this.log(`Rename result: ${result ? 'edits created' : 'no edits'}`);
            return result;
        }
        catch (error) {
            this.logError('Error in onRename:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/prepareRename request
     */
    async onPrepareRename(params) {
        const { textDocument, position } = params;
        this.log(`Prepare rename request: ${textDocument.uri} at ${position.line}:${position.character}`);
        try {
            const result = await this.renameProvider.prepareRename(textDocument.uri, position);
            this.log(`Prepare rename result: ${result ? 'valid' : 'invalid'}`);
            return result;
        }
        catch (error) {
            this.logError('Error in onPrepareRename:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/codeAction request
     */
    async onCodeAction(params) {
        const { textDocument, range, context } = params;
        this.log(`Code action request: ${textDocument.uri}`);
        try {
            const result = await this.codeActionsProvider.provideCodeActions(textDocument.uri, range, context.diagnostics);
            this.log(`Code action result: ${result?.length ?? 0} actions`);
            return result;
        }
        catch (error) {
            this.logError('Error in onCodeAction:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/formatting request
     */
    async onDocumentFormatting(params) {
        const { textDocument, options } = params;
        this.log(`Document formatting request: ${textDocument.uri}`);
        try {
            const result = await this.formattingProvider.provideFormatting(textDocument.uri, options);
            this.log(`Document formatting result: ${result?.length ?? 0} edits`);
            return result;
        }
        catch (error) {
            this.logError('Error in onDocumentFormatting:', error);
            return null;
        }
    }
    /**
     * Handle textDocument/rangeFormatting request
     */
    async onDocumentRangeFormatting(params) {
        const { textDocument, range, options } = params;
        this.log(`Document range formatting request: ${textDocument.uri}`);
        try {
            const result = await this.formattingProvider.provideRangeFormatting(textDocument.uri, range, options);
            this.log(`Document range formatting result: ${result?.length ?? 0} edits`);
            return result;
        }
        catch (error) {
            this.logError('Error in onDocumentRangeFormatting:', error);
            return null;
        }
    }
    /**
     * Handle workspace/symbol request
     */
    async onWorkspaceSymbol(params) {
        const { query } = params;
        this.log(`Workspace symbol request: "${query}"`);
        try {
            const result = await this.workspaceSymbolsProvider.provideWorkspaceSymbols(query);
            this.log(`Workspace symbol result: ${result?.length ?? 0} symbols`);
            return result;
        }
        catch (error) {
            this.logError('Error in onWorkspaceSymbol:', error);
            return null;
        }
    }
    /**
     * Start the server
     */
    start() {
        // Listen on the connection
        this.documents.listen(this.connection);
        this.connection.listen();
        this.log('LSP Server started and listening');
    }
    /**
     * Stop the server
     */
    stop() {
        this.connection.dispose();
        this.log('LSP Server stopped');
    }
    /**
     * Log message
     */
    log(message) {
        if (this.config.enableLogging) {
            console.log(`[LSP Server] ${message}`);
        }
    }
    /**
     * Log error
     */
    logError(message, error) {
        console.error(`[LSP Server ERROR] ${message}`, error);
    }
    /**
     * Get server statistics
     */
    getStats() {
        return {
            initialized: this.initialized,
            documents: this.documentManager.getDocumentCount(),
            cacheStats: this.integrationService.getCacheStats(),
            documentStats: this.documentManager.getStats(),
        };
    }
}
/**
 * Create and start LSP server
 */
export function startLSPServer(config) {
    const server = new LSPServer(config);
    server.start();
    return server;
}
//# sourceMappingURL=LSPServer.js.map