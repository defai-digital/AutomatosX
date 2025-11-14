/**
 * LSP Server
 *
 * Main Language Server Protocol server implementation.
 * Handles LSP lifecycle, connection, and request routing.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  TextDocumentPositionParams,
  DefinitionParams,
  ReferenceParams,
  HoverParams,
  CompletionParams,
  DocumentSymbolParams,
  RenameParams,
  PrepareRenameParams,
  CodeActionParams,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  WorkspaceSymbolParams,
} from 'vscode-languageserver/node.js';

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
import type { Location, Hover, ReferenceContext } from '../types/lsp-types.js';

/**
 * LSP Server Configuration
 */
export interface LSPServerConfig {
  name: string;
  version: string;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: LSPServerConfig = {
  name: 'AutomatosX Language Server',
  version: '2.0.0',
  enableLogging: true,
};

/**
 * LSP Server
 * Main entry point for Language Server Protocol implementation
 */
export class LSPServer {
  private connection = createConnection(ProposedFeatures.all);
  private documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  private documentManager: DocumentManager;
  private integrationService: IntegrationService;
  private definitionProvider: DefinitionProvider;
  private referencesProvider: ReferencesProvider;
  private hoverProvider: HoverProvider;
  private completionProvider: CompletionProvider;
  private documentSymbolsProvider: DocumentSymbolsProvider;
  private renameProvider: RenameProvider;
  private codeActionsProvider: CodeActionsProvider;
  private formattingProvider: FormattingProvider;
  private workspaceSymbolsProvider: WorkspaceSymbolsProvider;
  private qualityIntegration: QualityIntegration;
  private config: LSPServerConfig;
  private initialized = false;

  constructor(config: Partial<LSPServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services
    this.documentManager = new DocumentManager();
    this.integrationService = new IntegrationService();

    // Initialize providers
    this.definitionProvider = new DefinitionProvider(
      this.documentManager,
      this.integrationService
    );
    this.referencesProvider = new ReferencesProvider(
      this.documentManager,
      this.integrationService
    );
    this.hoverProvider = new HoverProvider(this.documentManager, this.integrationService);
    this.completionProvider = new CompletionProvider(
      this.documentManager,
      this.integrationService
    );
    this.documentSymbolsProvider = new DocumentSymbolsProvider(
      this.documentManager,
      this.integrationService
    );
    this.renameProvider = new RenameProvider(this.documentManager, this.integrationService);
    this.codeActionsProvider = new CodeActionsProvider(
      this.documentManager,
      this.integrationService
    );
    this.formattingProvider = new FormattingProvider(this.documentManager);
    this.workspaceSymbolsProvider = new WorkspaceSymbolsProvider(this.integrationService);
    this.qualityIntegration = new QualityIntegration(this.connection, this.documentManager);

    // Register handlers
    this.registerHandlers();
  }

  /**
   * Register LSP request handlers
   */
  private registerHandlers(): void {
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
  private onInitialize(params: InitializeParams): InitializeResult {
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
  private onInitialized(): void {
    this.initialized = true;
    this.log('Server initialized successfully');
  }

  /**
   * Handle shutdown request
   */
  private async onShutdown(): Promise<void> {
    this.log('Shutting down server...');
    this.initialized = false;

    // Cleanup resources
    this.documentManager.clear();
    this.integrationService.dispose();
  }

  /**
   * Handle exit notification
   */
  private onExit(): void {
    this.log('Server exited');
    process.exit(0);
  }

  /**
   * Handle document opened
   */
  private async onDocumentOpened(event: { document: TextDocument }): Promise<void> {
    const { uri, languageId, version } = event.document;
    const text = event.document.getText();

    this.log(`Document opened: ${uri}`);

    await this.documentManager.onDocumentOpened(uri, languageId, version, text);
    await this.qualityIntegration.onDocumentOpened(uri);
  }

  /**
   * Handle document changed
   */
  private async onDocumentChanged(event: { document: TextDocument }): Promise<void> {
    const { uri, version } = event.document;
    const text = event.document.getText();

    this.log(`Document changed: ${uri} (v${version})`);

    await this.documentManager.onDocumentChanged(uri, version, text);
    this.qualityIntegration.onDocumentChanged(uri);
  }

  /**
   * Handle document closed
   */
  private onDocumentClosed(event: { document: TextDocument }): void {
    const { uri } = event.document;

    this.log(`Document closed: ${uri}`);

    this.documentManager.onDocumentClosed(uri);
    this.qualityIntegration.onDocumentClosed(uri);
  }

  /**
   * Handle document saved
   */
  private async onDocumentSaved(event: { document: TextDocument }): Promise<void> {
    const { uri } = event.document;
    const text = event.document.getText();

    this.log(`Document saved: ${uri}`);

    await this.documentManager.onDocumentSaved(uri, text);
    await this.qualityIntegration.onDocumentSaved(uri);
  }

  /**
   * Handle textDocument/definition request
   */
  private async onDefinition(
    params: DefinitionParams
  ): Promise<Location | Location[] | null> {
    const { textDocument, position } = params;

    this.log(`Definition request: ${textDocument.uri} at ${position.line}:${position.character}`);

    try {
      const result = await this.definitionProvider.provideDefinition(
        textDocument.uri,
        position
      );
      this.log(`Definition result: ${result ? 'found' : 'not found'}`);
      return result;
    } catch (error) {
      this.logError('Error in onDefinition:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/references request
   */
  private async onReferences(params: ReferenceParams): Promise<Location[] | null> {
    const { textDocument, position, context } = params;

    this.log(
      `References request: ${textDocument.uri} at ${position.line}:${position.character}`
    );

    try {
      const result = await this.referencesProvider.provideReferences(
        textDocument.uri,
        position,
        context as ReferenceContext
      );
      this.log(`References result: ${result?.length ?? 0} found`);
      return result;
    } catch (error) {
      this.logError('Error in onReferences:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/hover request
   */
  private async onHover(params: HoverParams): Promise<Hover | null> {
    const { textDocument, position } = params;

    this.log(`Hover request: ${textDocument.uri} at ${position.line}:${position.character}`);

    try {
      const result = await this.hoverProvider.provideHover(textDocument.uri, position);
      this.log(`Hover result: ${result ? 'found' : 'not found'}`);
      return result;
    } catch (error) {
      this.logError('Error in onHover:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/completion request
   */
  private async onCompletion(params: CompletionParams): Promise<CompletionItem[] | null> {
    const { textDocument, position, context } = params;

    this.log(
      `Completion request: ${textDocument.uri} at ${position.line}:${position.character}`
    );

    try {
      const result = await this.completionProvider.provideCompletions(
        textDocument.uri,
        position,
        context as any
      );
      this.log(`Completion result: ${result?.length ?? 0} items`);
      return result as CompletionItem[] | null;
    } catch (error) {
      this.logError('Error in onCompletion:', error);
      return null;
    }
  }

  /**
   * Handle completionItem/resolve request
   */
  private async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
    // Currently no-op, but can be used to lazily resolve completion details
    return item;
  }

  /**
   * Handle textDocument/documentSymbol request
   */
  private async onDocumentSymbol(params: DocumentSymbolParams): Promise<any> {
    const { textDocument } = params;

    this.log(`Document symbol request: ${textDocument.uri}`);

    try {
      const result = await this.documentSymbolsProvider.provideDocumentSymbols(
        textDocument.uri
      );
      this.log(`Document symbol result: ${result?.length ?? 0} symbols`);
      return result;
    } catch (error) {
      this.logError('Error in onDocumentSymbol:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/rename request
   */
  private async onRename(params: RenameParams): Promise<any> {
    const { textDocument, position, newName } = params;

    this.log(
      `Rename request: ${textDocument.uri} at ${position.line}:${position.character} to "${newName}"`
    );

    try {
      const result = await this.renameProvider.provideRename(
        textDocument.uri,
        position,
        newName
      );
      this.log(`Rename result: ${result ? 'edits created' : 'no edits'}`);
      return result;
    } catch (error) {
      this.logError('Error in onRename:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/prepareRename request
   */
  private async onPrepareRename(params: PrepareRenameParams): Promise<any> {
    const { textDocument, position } = params;

    this.log(`Prepare rename request: ${textDocument.uri} at ${position.line}:${position.character}`);

    try {
      const result = await this.renameProvider.prepareRename(textDocument.uri, position);
      this.log(`Prepare rename result: ${result ? 'valid' : 'invalid'}`);
      return result;
    } catch (error) {
      this.logError('Error in onPrepareRename:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/codeAction request
   */
  private async onCodeAction(params: CodeActionParams): Promise<any> {
    const { textDocument, range, context } = params;

    this.log(`Code action request: ${textDocument.uri}`);

    try {
      const result = await this.codeActionsProvider.provideCodeActions(
        textDocument.uri,
        range,
        context.diagnostics
      );
      this.log(`Code action result: ${result?.length ?? 0} actions`);
      return result;
    } catch (error) {
      this.logError('Error in onCodeAction:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/formatting request
   */
  private async onDocumentFormatting(params: DocumentFormattingParams): Promise<any> {
    const { textDocument, options } = params;

    this.log(`Document formatting request: ${textDocument.uri}`);

    try {
      const result = await this.formattingProvider.provideFormatting(textDocument.uri, options);
      this.log(`Document formatting result: ${result?.length ?? 0} edits`);
      return result;
    } catch (error) {
      this.logError('Error in onDocumentFormatting:', error);
      return null;
    }
  }

  /**
   * Handle textDocument/rangeFormatting request
   */
  private async onDocumentRangeFormatting(params: DocumentRangeFormattingParams): Promise<any> {
    const { textDocument, range, options } = params;

    this.log(`Document range formatting request: ${textDocument.uri}`);

    try {
      const result = await this.formattingProvider.provideRangeFormatting(
        textDocument.uri,
        range,
        options
      );
      this.log(`Document range formatting result: ${result?.length ?? 0} edits`);
      return result;
    } catch (error) {
      this.logError('Error in onDocumentRangeFormatting:', error);
      return null;
    }
  }

  /**
   * Handle workspace/symbol request
   */
  private async onWorkspaceSymbol(params: WorkspaceSymbolParams): Promise<any> {
    const { query } = params;

    this.log(`Workspace symbol request: "${query}"`);

    try {
      const result = await this.workspaceSymbolsProvider.provideWorkspaceSymbols(query);
      this.log(`Workspace symbol result: ${result?.length ?? 0} symbols`);
      return result;
    } catch (error) {
      this.logError('Error in onWorkspaceSymbol:', error);
      return null;
    }
  }

  /**
   * Start the server
   */
  start(): void {
    // Listen on the connection
    this.documents.listen(this.connection);
    this.connection.listen();

    this.log('LSP Server started and listening');
  }

  /**
   * Stop the server
   */
  stop(): void {
    this.connection.dispose();
    this.log('LSP Server stopped');
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[LSP Server] ${message}`);
    }
  }

  /**
   * Log error
   */
  private logError(message: string, error: unknown): void {
    console.error(`[LSP Server ERROR] ${message}`, error);
  }

  /**
   * Get server statistics
   */
  getStats(): {
    initialized: boolean;
    documents: number;
    cacheStats: ReturnType<IntegrationService['getCacheStats']>;
    documentStats: ReturnType<DocumentManager['getStats']>;
  } {
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
export function startLSPServer(config?: Partial<LSPServerConfig>): LSPServer {
  const server = new LSPServer(config);
  server.start();
  return server;
}
