/**
 * Bug Fixer
 *
 * Applies fixes for detected bugs with atomic operations and rollback support.
 *
 * Features:
 * - Atomic file operations (backup before fix)
 * - Rollback on verification failure
 * - Fix template library
 * - Import management
 *
 * @module core/bugfix/bug-fixer
 * @since v12.4.0
 */

import { readFile, writeFile, copyFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import type {
  BugFinding,
  FixAttempt,
  FixStatus,
  FixTemplate,
  BugType
} from './types.js';

/**
 * Default fix templates
 */
const DEFAULT_FIX_TEMPLATES: FixTemplate[] = [
  {
    id: 'add_unref',
    name: 'Add .unref() to interval',
    description: 'Add .unref() call after setInterval to prevent blocking process exit',
    bugType: 'timer_leak',
    template: `
// Replace setInterval with createSafeInterval for automatic cleanup
import { createSafeInterval } from '@/shared/utils';

// Or add .unref() manually:
// const interval = setInterval(callback, ms);
// if (interval.unref) interval.unref();
`,
    imports: ['createSafeInterval from "@/shared/utils"'],
    confidence: 0.9
  },
  {
    id: 'add_destroy_method',
    name: 'Add destroy() method',
    description: 'Add destroy() method that calls removeAllListeners()',
    bugType: 'missing_destroy',
    template: `
  /**
   * Clean up resources and remove all event listeners.
   */
  destroy(): void {
    this.removeAllListeners();
  }
`,
    confidence: 0.85
  },
  {
    id: 'use_disposable_eventemitter',
    name: 'Extend DisposableEventEmitter',
    description: 'Replace EventEmitter with DisposableEventEmitter for automatic cleanup',
    bugType: 'missing_destroy',
    template: `
// Change: extends EventEmitter
// To: extends DisposableEventEmitter

import { DisposableEventEmitter } from '@/shared/utils';

// Then implement onDestroy() hook:
protected onDestroy(): void {
  // Custom cleanup logic
}
`,
    imports: ['DisposableEventEmitter from "@/shared/utils"'],
    confidence: 0.9
  },
  {
    id: 'wrap_with_timeout',
    name: 'Wrap with withTimeout',
    description: 'Use withTimeout() utility for automatic cleanup',
    bugType: 'promise_timeout_leak',
    template: `
import { withTimeout } from '@/shared/utils';

// Replace manual timeout handling with:
const result = await withTimeout(promise, timeoutMs, {
  message: 'Operation timed out'
});
`,
    imports: ['withTimeout from "@/shared/utils"'],
    confidence: 0.85
  }
];

/**
 * Bug Fixer class
 *
 * Applies fixes for detected bugs with safety mechanisms.
 */
export class BugFixer {
  private templates: Map<string, FixTemplate>;
  private backupDir: string;
  private backups: Map<string, string>; // filePath -> backupPath

  constructor(backupDir?: string) {
    this.templates = new Map();
    this.backupDir = backupDir || join(process.cwd(), '.automatosx', 'backups');
    this.backups = new Map();

    // Load default templates
    for (const template of DEFAULT_FIX_TEMPLATES) {
      this.templates.set(template.id, template);
    }

    logger.debug('BugFixer initialized', {
      templateCount: this.templates.size,
      backupDir: this.backupDir
    });
  }

  /**
   * Apply a fix for a bug finding
   *
   * @param finding - Bug finding to fix
   * @param rootDir - Root directory of the project
   * @param dryRun - If true, don't actually modify files
   * @returns Fix attempt result
   */
  async applyFix(
    finding: BugFinding,
    rootDir: string,
    dryRun: boolean = false
  ): Promise<FixAttempt> {
    const startTime = Date.now();
    const attemptId = randomUUID();
    const filePath = join(rootDir, finding.file);

    logger.info('Applying fix', {
      bugId: finding.id,
      file: finding.file,
      type: finding.type,
      dryRun
    });

    try {
      // Read current file content
      const originalContent = await readFile(filePath, 'utf-8');
      const lines = originalContent.split('\n');

      // Determine fix strategy
      const strategy = this.determineStrategy(finding);

      if (!strategy) {
        return this.createAttempt(attemptId, finding.id, 1, 'manual_review', '', 'skipped', startTime, 'No automatic fix available');
      }

      // Generate fix
      const { fixedContent, diff } = await this.generateFix(finding, originalContent, lines, strategy);

      if (!fixedContent || fixedContent === originalContent) {
        return this.createAttempt(attemptId, finding.id, 1, strategy, '', 'skipped', startTime, 'No changes needed');
      }

      if (dryRun) {
        logger.info('Dry run - fix not applied', {
          bugId: finding.id,
          strategy,
          diffLength: diff.length
        });

        return this.createAttempt(attemptId, finding.id, 1, strategy, diff, 'applied', startTime);
      }

      // Create backup
      await this.createBackup(filePath);

      // Apply fix
      await writeFile(filePath, fixedContent, 'utf-8');

      logger.info('Fix applied', {
        bugId: finding.id,
        file: finding.file,
        strategy
      });

      return this.createAttempt(attemptId, finding.id, 1, strategy, diff, 'applied', startTime);

    } catch (error) {
      logger.error('Fix application failed', {
        bugId: finding.id,
        file: finding.file,
        error: (error as Error).message
      });

      return this.createAttempt(attemptId, finding.id, 1, 'unknown', '', 'failed', startTime, (error as Error).message);
    }
  }

  /**
   * Rollback a fix
   *
   * @param filePath - File to rollback
   * @returns True if rollback successful
   */
  async rollback(filePath: string): Promise<boolean> {
    const backupPath = this.backups.get(filePath);

    if (!backupPath || !existsSync(backupPath)) {
      logger.warn('No backup found for rollback', { filePath });
      return false;
    }

    try {
      await copyFile(backupPath, filePath);
      await unlink(backupPath);
      this.backups.delete(filePath);

      logger.info('Fix rolled back', { filePath });
      return true;

    } catch (error) {
      logger.error('Rollback failed', {
        filePath,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Rollback all fixes in this session
   */
  async rollbackAll(): Promise<number> {
    let rolledBack = 0;

    for (const filePath of this.backups.keys()) {
      if (await this.rollback(filePath)) {
        rolledBack++;
      }
    }

    logger.info('All fixes rolled back', { count: rolledBack });
    return rolledBack;
  }

  /**
   * Clean up backups (call after successful verification)
   */
  async cleanupBackups(): Promise<void> {
    for (const [filePath, backupPath] of this.backups.entries()) {
      try {
        if (existsSync(backupPath)) {
          await unlink(backupPath);
        }
        this.backups.delete(filePath);
      } catch (error) {
        logger.warn('Failed to cleanup backup', {
          filePath,
          backupPath,
          error: (error as Error).message
        });
      }
    }

    logger.debug('Backups cleaned up');
  }

  /**
   * Determine fix strategy for a finding
   */
  private determineStrategy(finding: BugFinding): string | null {
    // Use specified fix strategy if available
    if (finding.fixStrategy) {
      return finding.fixStrategy;
    }

    // Find matching template by bug type
    for (const template of this.templates.values()) {
      if (template.bugType === finding.type) {
        return template.id;
      }
    }

    // Check if bug type is auto-fixable
    const autoFixableTypes: BugType[] = ['timer_leak', 'missing_destroy'];
    if (autoFixableTypes.includes(finding.type)) {
      return `auto_fix_${finding.type}`;
    }

    return null;
  }

  /**
   * Generate fix for a finding
   */
  private async generateFix(
    finding: BugFinding,
    originalContent: string,
    lines: string[],
    strategy: string
  ): Promise<{ fixedContent: string; diff: string }> {
    let fixedContent = originalContent;
    let diff = '';

    switch (strategy) {
      case 'add_unref':
        ({ fixedContent, diff } = this.applyAddUnrefFix(finding, originalContent, lines));
        break;

      case 'add_destroy_method':
        ({ fixedContent, diff } = this.applyAddDestroyMethodFix(finding, originalContent, lines));
        break;

      case 'use_disposable_eventemitter':
        ({ fixedContent, diff } = this.applyUseDisposableEventEmitterFix(finding, originalContent, lines));
        break;

      case 'auto_fix_timer_leak':
        ({ fixedContent, diff } = this.applyAddUnrefFix(finding, originalContent, lines));
        break;

      case 'auto_fix_missing_destroy':
        ({ fixedContent, diff } = this.applyAddDestroyMethodFix(finding, originalContent, lines));
        break;

      default:
        logger.warn('Unknown fix strategy', { strategy });
    }

    return { fixedContent, diff };
  }

  /**
   * Apply add .unref() fix
   */
  private applyAddUnrefFix(
    finding: BugFinding,
    originalContent: string,
    lines: string[]
  ): { fixedContent: string; diff: string } {
    const lineIndex = finding.lineStart - 1;
    const line = lines[lineIndex];

    if (!line) {
      return { fixedContent: originalContent, diff: '' };
    }

    // Find setInterval pattern and add .unref()
    const setIntervalPattern = /(\w+)\s*=\s*setInterval\s*\([^)]+\)\s*;?/;
    const match = line.match(setIntervalPattern);

    if (match) {
      const varName = match[1];

      // Check if there's already an unref on the next lines
      const nextLines = lines.slice(lineIndex + 1, lineIndex + 5).join('\n');
      if (nextLines.includes(`${varName}.unref`) || nextLines.includes(`${varName}?.unref`)) {
        return { fixedContent: originalContent, diff: '' };
      }

      // Add unref call after the setInterval line
      const indent = line.match(/^(\s*)/)?.[1] || '';
      const unrefLine = `${indent}if (${varName}.unref) ${varName}.unref();`;

      const newLines = [...lines];
      newLines.splice(lineIndex + 1, 0, unrefLine);

      const fixedContent = newLines.join('\n');
      const diff = `@@ -${finding.lineStart},1 +${finding.lineStart},2 @@\n ${line}\n+${unrefLine}`;

      return { fixedContent, diff };
    }

    // Direct setInterval without assignment - wrap it
    const directSetIntervalPattern = /setInterval\s*\(/;
    if (directSetIntervalPattern.test(line)) {
      // Replace line with assigned version + unref
      const newLine = line.replace(
        /(setInterval\s*\([^)]+\))/,
        'const _interval = $1; if (_interval.unref) _interval.unref()'
      );

      const newLines = [...lines];
      newLines[lineIndex] = newLine;

      const fixedContent = newLines.join('\n');
      const diff = `@@ -${finding.lineStart},1 +${finding.lineStart},1 @@\n-${line}\n+${newLine}`;

      return { fixedContent, diff };
    }

    return { fixedContent: originalContent, diff: '' };
  }

  /**
   * Apply add destroy() method fix
   */
  private applyAddDestroyMethodFix(
    finding: BugFinding,
    originalContent: string,
    lines: string[]
  ): { fixedContent: string; diff: string } {
    // Find the class definition
    const classPattern = /class\s+(\w+)\s+extends\s+(?:EventEmitter|DisposableEventEmitter)/;
    let classStartLine = -1;
    let className = '';

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i];
      if (!currentLine) continue;

      const match = currentLine.match(classPattern);
      if (match && match[1]) {
        classStartLine = i;
        break;
      }
    }

    if (classStartLine === -1) {
      return { fixedContent: originalContent, diff: '' };
    }

    // Find the closing brace of the class
    let braceCount = 0;
    let classEndLine = -1;

    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount === 0 && i > classStartLine) {
        classEndLine = i;
        break;
      }
    }

    if (classEndLine === -1) {
      return { fixedContent: originalContent, diff: '' };
    }

    // Get indentation from class body
    let indent = '  ';
    for (let i = classStartLine + 1; i < classEndLine; i++) {
      const indentLine = lines[i];
      if (!indentLine) continue;

      const indentMatch = indentLine.match(/^(\s+)\S/);
      if (indentMatch && indentMatch[1]) {
        indent = indentMatch[1];
        break;
      }
    }

    // Create destroy method
    const destroyMethod = [
      '',
      `${indent}/**`,
      `${indent} * Clean up resources and remove all event listeners.`,
      `${indent} */`,
      `${indent}destroy(): void {`,
      `${indent}  this.removeAllListeners();`,
      `${indent}}`
    ].join('\n');

    // Insert before closing brace
    const newLines = [...lines];
    newLines.splice(classEndLine, 0, destroyMethod);

    const fixedContent = newLines.join('\n');
    const diff = `@@ -${classEndLine + 1},1 +${classEndLine + 1},8 @@\n+${destroyMethod}\n ${lines[classEndLine]}`;

    return { fixedContent, diff };
  }

  /**
   * Apply use DisposableEventEmitter fix
   */
  private applyUseDisposableEventEmitterFix(
    finding: BugFinding,
    originalContent: string,
    _lines: string[]
  ): { fixedContent: string; diff: string } {
    // Replace EventEmitter with DisposableEventEmitter
    let fixedContent = originalContent.replace(
      /extends\s+EventEmitter\b/g,
      'extends DisposableEventEmitter'
    );

    // Check if import needs to be added
    if (!originalContent.includes('DisposableEventEmitter')) {
      // Find existing imports
      const importPattern = /^import\s+.*from\s+['"][^'"]+['"];?\s*$/m;
      const lastImportMatch = originalContent.match(new RegExp(importPattern.source + '(?!.*' + importPattern.source + ')', 's'));

      if (lastImportMatch) {
        const importStatement = `import { DisposableEventEmitter } from '@/shared/utils';`;
        const insertPos = lastImportMatch.index! + lastImportMatch[0].length;
        fixedContent = fixedContent.slice(0, insertPos) + '\n' + importStatement + fixedContent.slice(insertPos);
      }
    }

    const diff = '--- EventEmitter\n+++ DisposableEventEmitter\n+ import { DisposableEventEmitter } from "@/shared/utils";';

    return { fixedContent, diff };
  }

  /**
   * Create backup of a file
   */
  private async createBackup(filePath: string): Promise<string> {
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }

    const backupName = `${basename(filePath)}.${Date.now()}.bak`;
    const backupPath = join(this.backupDir, backupName);

    await copyFile(filePath, backupPath);
    this.backups.set(filePath, backupPath);

    logger.debug('Backup created', { filePath, backupPath });

    return backupPath;
  }

  /**
   * Create a fix attempt result
   */
  private createAttempt(
    id: string,
    bugId: string,
    attemptNumber: number,
    strategy: string,
    diff: string,
    status: FixStatus,
    startTime: number,
    error?: string
  ): FixAttempt {
    return {
      id,
      bugId,
      attemptNumber,
      strategy,
      diff,
      status,
      error,
      attemptedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Add a custom fix template
   */
  addTemplate(template: FixTemplate): void {
    this.templates.set(template.id, template);
    logger.debug('Fix template added', { templateId: template.id });
  }

  /**
   * Get all fix templates
   */
  getTemplates(): FixTemplate[] {
    return Array.from(this.templates.values());
  }
}
