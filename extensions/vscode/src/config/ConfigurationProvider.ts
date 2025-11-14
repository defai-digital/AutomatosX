/**
 * Configuration Provider
 * Manages extension configuration settings
 */

import * as vscode from 'vscode';

export interface AutomatosXConfig {
  serverPath: string;
  enableDiagnostics: boolean;
  complexityThreshold: number;
  autoIndex: boolean;
  excludePatterns: string[];
  maxFileSize: number;
  enableTelemetry: boolean;
}

export class ConfigurationProvider implements vscode.Disposable {
  private config: AutomatosXConfig;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.config = this.loadConfig();

    // Watch for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('automatosx')) {
          this.reload();
        }
      })
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): AutomatosXConfig {
    return { ...this.config };
  }

  /**
   * Reload configuration from VS Code settings
   */
  reload(): void {
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfig(): AutomatosXConfig {
    const config = vscode.workspace.getConfiguration('automatosx');

    return {
      serverPath: config.get('serverPath', ''),
      enableDiagnostics: config.get('enableDiagnostics', true),
      complexityThreshold: config.get('complexityThreshold', 10),
      autoIndex: config.get('autoIndex', true),
      excludePatterns: config.get('excludePatterns', [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
      ]),
      maxFileSize: config.get('maxFileSize', 1048576),
      enableTelemetry: config.get('enableTelemetry', false),
    };
  }

  /**
   * Update configuration value
   */
  async updateConfig<K extends keyof AutomatosXConfig>(
    key: K,
    value: AutomatosXConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('automatosx');
    await config.update(key, value, target);
    this.reload();
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate complexity threshold
    if (this.config.complexityThreshold < 1 || this.config.complexityThreshold > 100) {
      errors.push('complexityThreshold must be between 1 and 100');
    }

    // Validate max file size
    if (this.config.maxFileSize < 1024) {
      errors.push('maxFileSize must be at least 1024 bytes');
    }

    // Validate exclude patterns
    if (!Array.isArray(this.config.excludePatterns)) {
      errors.push('excludePatterns must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
