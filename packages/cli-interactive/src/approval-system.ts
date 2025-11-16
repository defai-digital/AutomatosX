/**
 * Approval System
 *
 * Handles user approval prompts for file operations based on risk level.
 * Provides previews and confirmation dialogs for dangerous operations.
 */

import readline from 'readline';
import type { FileOperation, FileMetadata } from './types.js';

export enum OperationRisk {
  SAFE = 'safe',           // Read operations
  LOW = 'low',             // Write new files
  MEDIUM = 'medium',       // Edit existing files
  HIGH = 'high',           // Overwrite important files
  CRITICAL = 'critical'    // System files, config files
}

export interface ApprovalOptions {
  autoApprove?: boolean;    // Skip prompts (dangerous!)
  defaultYes?: boolean;     // Default to 'yes' on Enter
  showPreview?: boolean;    // Show operation preview
}

export class ApprovalManager {
  private rl: readline.Interface;
  private options: ApprovalOptions;

  // Critical file patterns
  private static readonly CRITICAL_FILES = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vitest.config.ts',
    'vitest.config.js',
    'tsup.config.ts',
    '.git/config',
    '.gitignore',
    'automatosx.config.json',
    'src/config.generated.ts'
  ];

  // Important file patterns
  private static readonly IMPORTANT_FILES = [
    /\.config\.(ts|js|json)$/,
    /^README\.md$/i,
    /^CHANGELOG\.md$/i,
    /^LICENSE$/i,
    /\.env$/
  ];

  constructor(options: ApprovalOptions = {}) {
    this.options = {
      autoApprove: false,
      defaultYes: false,
      showPreview: true,
      ...options
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Classify operation risk level
   */
  classifyRisk(operation: FileOperation, metadata: FileMetadata): OperationRisk {
    const { type, path } = operation;

    // Read operations are always safe
    if (type === 'read') {
      return OperationRisk.SAFE;
    }

    // Check if it's a critical file
    if (this.isCriticalFile(path)) {
      return OperationRisk.CRITICAL;
    }

    // Check if it's an important file
    if (this.isImportantFile(path)) {
      return OperationRisk.HIGH;
    }

    // Overwriting existing files
    if (metadata.exists && type === 'write') {
      return OperationRisk.HIGH;
    }

    // Editing existing files
    if (type === 'edit') {
      return OperationRisk.MEDIUM;
    }

    // Creating new files
    return OperationRisk.LOW;
  }

  /**
   * Request approval for an operation
   */
  async requestApproval(
    operation: FileOperation,
    metadata: FileMetadata,
    risk: OperationRisk
  ): Promise<boolean> {
    // Auto-approve if enabled (dangerous!)
    if (this.options.autoApprove) {
      return true;
    }

    // SAFE operations don't need approval
    if (risk === OperationRisk.SAFE) {
      return true;
    }

    // Show operation details
    this.displayOperationDetails(operation, metadata, risk);

    // Show preview if applicable
    if (this.options.showPreview && operation.preview) {
      this.displayPreview(operation);
    }

    // Get user confirmation
    return await this.getUserConfirmation(risk);
  }

  /**
   * Display operation details
   */
  private displayOperationDetails(
    operation: FileOperation,
    metadata: FileMetadata,
    risk: OperationRisk
  ): void {
    const riskEmoji = this.getRiskEmoji(risk);
    const riskLabel = this.getRiskLabel(risk);

    console.log(`\n${riskEmoji}  ${riskLabel} Operation`);
    console.log('─'.repeat(60));
    console.log(`  Type:     ${operation.type.toUpperCase()}`);
    console.log(`  Path:     ${operation.path}`);

    if (operation.type === 'write' || operation.type === 'edit') {
      console.log(`  Exists:   ${metadata.exists ? 'Yes' : 'No'}`);

      if (metadata.exists && metadata.size) {
        console.log(`  Size:     ${this.formatBytes(metadata.size)}`);
      }
    }

    if (operation.type === 'write' && operation.content) {
      const contentSize = Buffer.byteLength(operation.content, 'utf-8');
      console.log(`  New Size: ${this.formatBytes(contentSize)}`);
    }

    if (operation.type === 'edit') {
      console.log(`  Search:   ${operation.search}`);
      console.log(`  Replace:  ${operation.replace}`);

      if (operation.replaceAll) {
        console.log(`  Mode:     Replace ALL occurrences`);
      } else {
        console.log(`  Mode:     Replace FIRST occurrence`);
      }
    }

    console.log('─'.repeat(60));
  }

  /**
   * Display operation preview
   */
  private displayPreview(operation: FileOperation): void {
    if (!operation.preview) return;

    console.log('\n📋 Preview:');
    console.log('─'.repeat(60));

    if (operation.type === 'edit') {
      // Show diff for edits
      const lines = operation.preview.split('\n');
      lines.forEach(line => {
        if (line.startsWith('-')) {
          console.log(`\x1b[31m${line}\x1b[0m`); // Red for removals
        } else if (line.startsWith('+')) {
          console.log(`\x1b[32m${line}\x1b[0m`); // Green for additions
        } else {
          console.log(line);
        }
      });
    } else if (operation.type === 'write') {
      // Show content preview for writes
      const previewLines = operation.preview.split('\n').slice(0, 10);
      previewLines.forEach((line, i) => {
        console.log(`${String(i + 1).padStart(4, ' ')}│ ${line}`);
      });

      if (operation.preview.split('\n').length > 10) {
        console.log('     │ ...');
        console.log(`     │ (${operation.preview.split('\n').length - 10} more lines)`);
      }
    }

    console.log('─'.repeat(60));
  }

  /**
   * Get user confirmation
   */
  private async getUserConfirmation(risk: OperationRisk): Promise<boolean> {
    const defaultYes = this.options.defaultYes && risk !== OperationRisk.CRITICAL;
    const prompt = defaultYes
      ? 'Proceed? (Y/n): '
      : risk === OperationRisk.CRITICAL
      ? 'Type "yes" to confirm: '
      : 'Proceed? (y/n): ';

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const trimmed = answer.trim().toLowerCase();

        if (risk === OperationRisk.CRITICAL) {
          // CRITICAL operations require explicit "yes"
          resolve(trimmed === 'yes');
        } else if (defaultYes) {
          // Default to yes if Enter pressed
          resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes');
        } else {
          // Require explicit yes
          resolve(trimmed === 'y' || trimmed === 'yes');
        }
      });
    });
  }

  /**
   * Check if file is critical
   */
  private isCriticalFile(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, '/');

    return ApprovalManager.CRITICAL_FILES.some(pattern =>
      normalized.endsWith(pattern)
    );
  }

  /**
   * Check if file is important
   */
  private isImportantFile(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, '/');

    return ApprovalManager.IMPORTANT_FILES.some(pattern => {
      if (typeof pattern === 'string') {
        return normalized.endsWith(pattern);
      }
      return pattern.test(normalized);
    });
  }

  /**
   * Get risk emoji
   */
  private getRiskEmoji(risk: OperationRisk): string {
    switch (risk) {
      case OperationRisk.SAFE:
        return '✅';
      case OperationRisk.LOW:
        return '⚠️ ';
      case OperationRisk.MEDIUM:
        return '⚠️ ';
      case OperationRisk.HIGH:
        return '🔴';
      case OperationRisk.CRITICAL:
        return '💀';
      default:
        return '❓';
    }
  }

  /**
   * Get risk label
   */
  private getRiskLabel(risk: OperationRisk): string {
    switch (risk) {
      case OperationRisk.SAFE:
        return 'Safe';
      case OperationRisk.LOW:
        return 'Low Risk';
      case OperationRisk.MEDIUM:
        return 'Medium Risk';
      case OperationRisk.HIGH:
        return 'High Risk';
      case OperationRisk.CRITICAL:
        return 'CRITICAL';
      default:
        return 'Unknown Risk';
    }
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Close readline interface
   */
  close(): void {
    this.rl.close();
  }
}
