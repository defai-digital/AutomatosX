/**
 * File Operations Manager
 *
 * Handles file read/write/edit operations with security validation and approval.
 * Integrates with SecurityValidator and ApprovalManager.
 */

import { readFile, writeFile, copyFile } from 'fs/promises';
import { basename } from 'path';
import { SecurityValidator } from './security-validator.js';
import { ApprovalManager, OperationRisk } from './approval-system.js';
import type {
  FileOperation,
  FileMetadata,
  ReadOptions,
  WriteOptions,
  EditOptions
} from './types.js';

export interface FileOperationsConfig {
  workspaceRoot: string;
  allowedExtensions?: string[];
  maxFileSize?: number;
  autoApprove?: boolean;
  defaultYes?: boolean;
}

export class FileOperationsManager {
  private securityValidator: SecurityValidator;
  private approvalManager: ApprovalManager;
  private config: FileOperationsConfig;

  constructor(config: FileOperationsConfig) {
    this.config = config;

    this.securityValidator = new SecurityValidator({
      workspaceRoot: config.workspaceRoot,
      allowedExtensions: config.allowedExtensions,
      maxFileSize: config.maxFileSize,
      allowDotfiles: false,
      allowHiddenDirs: false
    });

    this.approvalManager = new ApprovalManager({
      autoApprove: config.autoApprove || false,
      defaultYes: config.defaultYes || false,
      showPreview: true
    });
  }

  /**
   * Read file contents
   */
  async readFile(filepath: string, options: ReadOptions = {}): Promise<string> {
    const {
      lines = undefined,
      from = 1,
      syntax = true
    } = options;

    // Validate path
    const validation = await this.securityValidator.validatePath(filepath, 'read');
    if (!validation.valid) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }

    if (!validation.absolutePath) {
      throw new Error('Failed to resolve file path');
    }

    if (!validation.metadata?.exists) {
      throw new Error(`File not found: ${filepath}`);
    }

    // Read file
    const content = await readFile(validation.absolutePath, 'utf-8');

    // Apply line filtering if requested
    if (lines !== undefined || from !== 1) {
      const allLines = content.split('\n');
      const startIndex = from - 1;
      const endIndex = lines ? startIndex + lines : allLines.length;
      const selectedLines = allLines.slice(startIndex, endIndex);

      return this.formatOutput(selectedLines, from, filepath, syntax);
    }

    return this.formatOutput(content.split('\n'), 1, filepath, syntax);
  }

  /**
   * Write file contents
   */
  async writeFile(
    filepath: string,
    content: string,
    options: WriteOptions = {}
  ): Promise<void> {
    const {
      force = false,
      append = false,
      encoding = 'utf8'
    } = options as { force?: boolean; append?: boolean; encoding?: BufferEncoding };

    // Validate path
    const validation = await this.securityValidator.validatePath(filepath, 'write');
    if (!validation.valid) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }

    if (!validation.absolutePath || !validation.metadata) {
      throw new Error('Failed to resolve file path');
    }

    // Check if file exists and force is not set
    if (validation.metadata.exists && !force && !append) {
      throw new Error(`File already exists: ${filepath}. Use --force to overwrite or --append to append.`);
    }

    // Prepare operation
    const operation: FileOperation = {
      type: 'write',
      path: filepath,
      absolutePath: validation.absolutePath,
      content,
      preview: this.generateWritePreview(content, append)
    };

    // Get approval
    const risk = this.approvalManager.classifyRisk(operation, validation.metadata);
    const approved = await this.approvalManager.requestApproval(
      operation,
      validation.metadata,
      risk
    );

    if (!approved) {
      throw new Error('Operation cancelled by user');
    }

    // Write file
    if (append && validation.metadata.exists) {
      const existingContent = await readFile(validation.absolutePath, { encoding });
      const newContent = existingContent + content;
      await writeFile(validation.absolutePath, newContent, { encoding });
    } else {
      await writeFile(validation.absolutePath, content, { encoding });
    }
  }

  /**
   * Edit file contents (search and replace)
   */
  async editFile(
    filepath: string,
    search: string,
    replace: string,
    options: EditOptions = {}
  ): Promise<void> {
    const {
      preview = true,
      all = false,
      backup = false
    } = options;

    // Validate path
    const validation = await this.securityValidator.validatePath(filepath, 'edit');
    if (!validation.valid) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }

    if (!validation.absolutePath || !validation.metadata) {
      throw new Error('Failed to resolve file path');
    }

    if (!validation.metadata.exists) {
      throw new Error(`File not found: ${filepath}`);
    }

    // Read current content
    const content = await readFile(validation.absolutePath, 'utf-8');

    // Find matches
    const matches = this.findMatches(content, search);
    if (matches.length === 0) {
      throw new Error(`Search string not found: "${search}"`);
    }

    // Generate new content
    const newContent = all
      ? content.replaceAll(search, replace)
      : content.replace(search, replace);

    // Generate preview
    const previewText = this.generateEditPreview(content, newContent, search, replace, all);

    // Prepare operation
    const operation: FileOperation = {
      type: 'edit',
      path: filepath,
      absolutePath: validation.absolutePath,
      search,
      replace,
      replaceAll: all,
      preview: preview ? previewText : undefined
    };

    // Get approval
    const risk = this.approvalManager.classifyRisk(operation, validation.metadata);
    const approved = await this.approvalManager.requestApproval(
      operation,
      validation.metadata,
      risk
    );

    if (!approved) {
      throw new Error('Operation cancelled by user');
    }

    // Create backup if requested
    if (backup) {
      const backupPath = `${validation.absolutePath}.bak`;
      await copyFile(validation.absolutePath, backupPath);
    }

    // Write new content
    await writeFile(validation.absolutePath, newContent, 'utf-8');
  }

  /**
   * Format read output with line numbers
   */
  private formatOutput(
    lines: string[],
    startLine: number,
    filepath: string,
    syntax: boolean
  ): string {
    const maxLineNum = startLine + lines.length - 1;
    const lineNumWidth = String(maxLineNum).length;

    const header = `\nFile: ${filepath} (${lines.length} lines)\n${'─'.repeat(60)}`;
    const footer = '─'.repeat(60);

    const formattedLines = lines.map((line, i) => {
      const lineNum = String(startLine + i).padStart(lineNumWidth, ' ');
      return `${lineNum}│ ${line}`;
    });

    return `${header}\n${formattedLines.join('\n')}\n${footer}`;
  }

  /**
   * Generate preview for write operation
   */
  private generateWritePreview(content: string, append: boolean): string {
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 10);

    let preview = append ? '[Appending to existing file]\n\n' : '[New file content]\n\n';

    previewLines.forEach((line, i) => {
      preview += `${String(i + 1).padStart(4, ' ')}│ ${line}\n`;
    });

    if (lines.length > 10) {
      preview += `     │ ...\n`;
      preview += `     │ (${lines.length - 10} more lines)\n`;
    }

    return preview;
  }

  /**
   * Generate preview for edit operation
   */
  private generateEditPreview(
    oldContent: string,
    newContent: string,
    search: string,
    replace: string,
    replaceAll: boolean
  ): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    let preview = `${replaceAll ? 'Replacing ALL occurrences' : 'Replacing FIRST occurrence'}\n`;
    preview += `Search:  "${search}"\n`;
    preview += `Replace: "${replace}"\n\n`;

    // Find first difference
    for (let i = 0; i < oldLines.length; i++) {
      if (oldLines[i] !== newLines[i]) {
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(oldLines.length, i + 3);

        for (let j = contextStart; j < contextEnd; j++) {
          const lineNum = String(j + 1).padStart(4, ' ');

          if (j === i) {
            preview += `\x1b[31m-${lineNum}│ ${oldLines[j]}\x1b[0m\n`;
            preview += `\x1b[32m+${lineNum}│ ${newLines[j]}\x1b[0m\n`;
          } else {
            preview += ` ${lineNum}│ ${oldLines[j] || newLines[j] || ''}\n`;
          }
        }
        break;
      }
    }

    return preview;
  }

  /**
   * Find matches in content
   */
  private findMatches(content: string, search: string): number[] {
    const matches: number[] = [];
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (line.includes(search)) {
        matches.push(i);
      }
    });

    return matches;
  }

  /**
   * Check if a file exists
   */
  async fileExists(filepath: string): Promise<boolean> {
    const validation = await this.securityValidator.validatePath(filepath, 'read');
    return validation.valid && (validation.metadata?.exists ?? false);
  }

  /**
   * Get file metadata
   */
  async getFileInfo(filepath: string): Promise<FileMetadata | null> {
    const validation = await this.securityValidator.validatePath(filepath, 'read');
    if (!validation.valid) {
      return null;
    }
    return validation.metadata || null;
  }

  /**
   * Close approval manager
   */
  close(): void {
    this.approvalManager.close();
  }
}
