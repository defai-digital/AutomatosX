/**
 * AutomatosX LSP Client
 * Manages connection to AutomatosX Language Server
 */

import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import * as path from 'path';
import { ConfigurationProvider } from '../config/ConfigurationProvider.js';

export class LSPClient implements vscode.Disposable {
  private client: LanguageClient | undefined;
  private context: vscode.ExtensionContext;
  private configProvider: ConfigurationProvider;

  constructor(context: vscode.ExtensionContext, configProvider: ConfigurationProvider) {
    this.context = context;
    this.configProvider = configProvider;
  }

  /**
   * Start LSP client and connect to server
   */
  async start(): Promise<void> {
    try {
      const serverModule = this.getServerPath();

      // Server options: stdio transport
      const serverOptions: ServerOptions = {
        run: {
          module: serverModule,
          transport: TransportKind.stdio,
        },
        debug: {
          module: serverModule,
          transport: TransportKind.stdio,
          options: {
            execArgv: ['--nolazy', '--inspect=6009'],
          },
        },
      };

      // Client options: document selectors and synchronization
      const clientOptions: LanguageClientOptions = {
        documentSelector: [
          { scheme: 'file', language: 'typescript' },
          { scheme: 'file', language: 'javascript' },
          { scheme: 'file', language: 'python' },
          { scheme: 'file', language: 'go' },
          { scheme: 'file', language: 'rust' },
        ],
        synchronize: {
          fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{ts,js,py,go,rs}'),
        },
        initializationOptions: {
          config: this.configProvider.getConfig(),
        },
      };

      // Create and start client
      this.client = new LanguageClient(
        'automatosx',
        'AutomatosX Language Server',
        serverOptions,
        clientOptions
      );

      await this.client.start();
      console.log('AutomatosX LSP client started');
    } catch (error) {
      console.error('Failed to start LSP client:', error);
      throw new Error(`LSP client start failed: ${error}`);
    }
  }

  /**
   * Stop LSP client
   */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = undefined;
      console.log('AutomatosX LSP client stopped');
    }
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string): Promise<void> {
    if (!this.client) {
      throw new Error('LSP client not started');
    }

    await this.client.sendRequest('automatosx/indexFile', { filePath });
  }

  /**
   * Index a directory
   */
  async indexDirectory(dirPath: string): Promise<void> {
    if (!this.client) {
      throw new Error('LSP client not started');
    }

    await this.client.sendRequest('automatosx/indexDirectory', { dirPath });
  }

  /**
   * Get document symbols
   */
  async getDocumentSymbols(uri: vscode.Uri): Promise<any[]> {
    if (!this.client) {
      return [];
    }

    try {
      const symbols = await this.client.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: uri.toString() },
      });
      return Array.isArray(symbols) ? symbols : [];
    } catch (error) {
      console.error('Failed to get document symbols:', error);
      return [];
    }
  }

  /**
   * Get quality metrics for file
   */
  async getQualityMetrics(filePath: string): Promise<any> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.sendRequest('automatosx/qualityMetrics', { filePath });
    } catch (error) {
      console.error('Failed to get quality metrics:', error);
      return null;
    }
  }

  /**
   * Get dependencies for file
   */
  async getDependencies(filePath: string): Promise<any> {
    if (!this.client) {
      return null;
    }

    try {
      return await this.client.sendRequest('automatosx/dependencies', { filePath });
    } catch (error) {
      console.error('Failed to get dependencies:', error);
      return null;
    }
  }

  /**
   * Find references for symbol
   */
  async findReferences(uri: vscode.Uri, position: vscode.Position): Promise<vscode.Location[]> {
    if (!this.client) {
      return [];
    }

    try {
      const refs = await this.client.sendRequest('textDocument/references', {
        textDocument: { uri: uri.toString() },
        position: { line: position.line, character: position.character },
        context: { includeDeclaration: true },
      });
      return Array.isArray(refs) ? refs : [];
    } catch (error) {
      console.error('Failed to find references:', error);
      return [];
    }
  }

  /**
   * Get server path (bundled or custom)
   */
  private getServerPath(): string {
    const customPath = this.configProvider.getConfig().serverPath;
    if (customPath) {
      return customPath;
    }

    // Use bundled server
    return path.join(
      this.context.extensionPath,
      'out',
      'server',
      'LSPServer.js'
    );
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.client !== undefined;
  }

  dispose(): void {
    this.stop();
  }
}
