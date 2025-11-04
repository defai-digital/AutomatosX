/**
 * Inline Diff Renderer
 *
 * Shows file changes as color-coded patches like Claude Code
 * Phase 3 P1: Claude-style diff visualization
 */

import chalk from 'chalk';
import { diffLines, Change } from 'diff';

export interface DiffOptions {
  context?: number;      // Lines of context around changes (default: 3)
  showLineNumbers?: boolean;  // Show line numbers (default: true)
  colorize?: boolean;    // Use colors (default: true)
  unified?: boolean;     // Use unified diff format (default: true)
  compact?: boolean;     // Use compact output (default: false)
}

export interface FileDiff {
  path: string;
  oldContent: string;
  newContent: string;
  isNew?: boolean;      // File is being created
  isDeleted?: boolean;  // File is being deleted
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

/**
 * Render a single file diff in Claude-style format
 */
export function renderFileDiff(diff: FileDiff, options: DiffOptions = {}): string {
  const {
    context = 3,
    showLineNumbers = true,
    colorize = true,
    unified = true
  } = options;

  const lines: string[] = [];

  // File header
  const fileHeader = renderFileHeader(diff, colorize);
  lines.push(fileHeader);
  lines.push('');

  // Handle special cases
  if (diff.isNew) {
    lines.push(colorize ? chalk.green('+ New file') : '+ New file');
    lines.push('');
    const preview = diff.newContent.split('\n').slice(0, 10);
    preview.forEach((line, idx) => {
      const lineNum = showLineNumbers ? chalk.dim(`${idx + 1}`.padStart(4)) + ' ' : '';
      lines.push(lineNum + (colorize ? chalk.green(`+ ${line}`) : `+ ${line}`));
    });
    if (diff.newContent.split('\n').length > 10) {
      lines.push(chalk.dim('  ... (truncated)'));
    }
    return lines.join('\n');
  }

  if (diff.isDeleted) {
    lines.push(colorize ? chalk.red('- File deleted') : '- File deleted');
    return lines.join('\n');
  }

  // Generate diff
  const changes = diffLines(diff.oldContent, diff.newContent);

  // Render changes with context
  if (unified) {
    renderUnifiedDiff(changes, lines, { showLineNumbers, colorize, context });
  } else {
    renderSideBySideDiff(changes, lines, { showLineNumbers, colorize });
  }

  return lines.join('\n');
}

/**
 * Render multiple file diffs with summary
 */
export function renderMultiFileDiff(diffs: FileDiff[], options: DiffOptions = {}): string {
  const lines: string[] = [];
  const stats = calculateDiffStats(diffs);

  // Summary header (Claude-style)
  lines.push('');
  lines.push(chalk.bold.cyan('╭─ Changes ─────────────────────────────────────╮'));
  lines.push(chalk.bold.cyan(`│ ${stats.filesChanged} file${stats.filesChanged !== 1 ? 's' : ''} changed, ${chalk.green(`+${stats.additions}`)} ${chalk.red(`-${stats.deletions}`)} lines │`));
  lines.push(chalk.bold.cyan('╰───────────────────────────────────────────────╯'));
  lines.push('');

  // Render each file diff
  diffs.forEach((diff, idx) => {
    lines.push(renderFileDiff(diff, options));

    if (idx < diffs.length - 1) {
      lines.push('');
      lines.push(chalk.dim('─'.repeat(50)));
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * Render file header (Claude-style)
 */
function renderFileHeader(diff: FileDiff, colorize: boolean): string {
  const icon = diff.isNew ? '📄' : diff.isDeleted ? '🗑️' : '✎';
  const status = diff.isNew ? 'new' : diff.isDeleted ? 'deleted' : 'modified';

  if (colorize) {
    const statusColor = diff.isNew ? chalk.green : diff.isDeleted ? chalk.red : chalk.yellow;
    return `${icon} ${chalk.bold.white(diff.path)} ${statusColor(`(${status})`)}`;
  }

  return `${icon} ${diff.path} (${status})`;
}

/**
 * Render unified diff format
 */
function renderUnifiedDiff(
  changes: Change[],
  lines: string[],
  options: { showLineNumbers: boolean; colorize: boolean; context: number }
): void {
  let oldLineNum = 1;
  let newLineNum = 1;
  let contextCount = 0;
  let inHunk = false;

  changes.forEach((change) => {
    const changeLines = change.value.split('\n').filter(l => l !== '' || change.value.endsWith('\n'));

    changeLines.forEach((line) => {
      if (change.added) {
        // Addition
        inHunk = true;
        contextCount = options.context;

        const lineNumStr = options.showLineNumbers
          ? chalk.dim('    ') + chalk.green(`${newLineNum}`.padStart(4)) + ' '
          : '';

        lines.push(lineNumStr + (options.colorize ? chalk.green(`+ ${line}`) : `+ ${line}`));
        newLineNum++;

      } else if (change.removed) {
        // Deletion
        inHunk = true;
        contextCount = options.context;

        const lineNumStr = options.showLineNumbers
          ? chalk.red(`${oldLineNum}`.padStart(4)) + chalk.dim('    ') + ' '
          : '';

        lines.push(lineNumStr + (options.colorize ? chalk.red(`- ${line}`) : `- ${line}`));
        oldLineNum++;

      } else {
        // Context line
        if (inHunk && contextCount > 0) {
          const lineNumStr = options.showLineNumbers
            ? chalk.dim(`${oldLineNum}`.padStart(4)) + chalk.dim(`${newLineNum}`.padStart(4)) + ' '
            : '';

          lines.push(lineNumStr + chalk.dim(`  ${line}`));
          contextCount--;
        } else if (!inHunk && contextCount === 0) {
          // Skip lines outside hunks
        }

        oldLineNum++;
        newLineNum++;
      }
    });
  });
}

/**
 * Render side-by-side diff (simplified)
 */
function renderSideBySideDiff(
  changes: Change[],
  lines: string[],
  options: { showLineNumbers: boolean; colorize: boolean }
): void {
  let oldLineNum = 1;
  let newLineNum = 1;

  changes.forEach((change) => {
    const changeLines = change.value.split('\n').filter(l => l !== '');

    changeLines.forEach((line) => {
      if (change.added) {
        const lineNumStr = options.showLineNumbers ? `    ${newLineNum}`.padStart(8) + ' ' : '';
        lines.push(lineNumStr + (options.colorize ? chalk.green(`+ ${line}`) : `+ ${line}`));
        newLineNum++;
      } else if (change.removed) {
        const lineNumStr = options.showLineNumbers ? `${oldLineNum}    `.padStart(8) + ' ' : '';
        lines.push(lineNumStr + (options.colorize ? chalk.red(`- ${line}`) : `- ${line}`));
        oldLineNum++;
      } else {
        const lineNumStr = options.showLineNumbers
          ? `${oldLineNum} ${newLineNum}`.padStart(8) + ' '
          : '';
        lines.push(lineNumStr + chalk.dim(`  ${line}`));
        oldLineNum++;
        newLineNum++;
      }
    });
  });
}

/**
 * Calculate diff statistics
 */
export function calculateDiffStats(diffs: FileDiff[]): DiffStats {
  let additions = 0;
  let deletions = 0;

  diffs.forEach(diff => {
    if (diff.isNew) {
      additions += diff.newContent.split('\n').length;
    } else if (diff.isDeleted) {
      deletions += diff.oldContent.split('\n').length;
    } else {
      const changes = diffLines(diff.oldContent, diff.newContent);
      changes.forEach(change => {
        if (change.added) {
          additions += change.count || 0;
        } else if (change.removed) {
          deletions += change.count || 0;
        }
      });
    }
  });

  return {
    filesChanged: diffs.length,
    additions,
    deletions
  };
}

/**
 * Create approval prompt with diff preview (Claude-style)
 */
export function renderApprovalPrompt(diffs: FileDiff[], options: DiffOptions = {}): string {
  const lines: string[] = [];
  const stats = calculateDiffStats(diffs);

  lines.push('');
  lines.push(chalk.bold.yellow('📦 Review Changes'));
  lines.push('');
  lines.push(chalk.white(`${stats.filesChanged} file${stats.filesChanged !== 1 ? 's' : ''} will be modified:`));
  lines.push('');

  // Show file list with stats
  diffs.forEach(diff => {
    const icon = diff.isNew ? chalk.green('●') : diff.isDeleted ? chalk.red('●') : chalk.yellow('●');
    const status = diff.isNew ? 'new' : diff.isDeleted ? 'deleted' : 'modified';

    if (!diff.isDeleted) {
      const lineCount = diff.newContent.split('\n').length;
      lines.push(`  ${icon} ${chalk.bold(diff.path)} ${chalk.dim(`(${status}, ${lineCount} lines)`)}`);
    } else {
      lines.push(`  ${icon} ${chalk.bold(diff.path)} ${chalk.dim(`(${status})`)}`);
    }
  });

  lines.push('');
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push('');

  // Show preview of changes
  if (diffs.length === 1 && diffs[0]) {
    lines.push(renderFileDiff(diffs[0], { ...options, context: 2 }));
  } else if (diffs.length <= 3) {
    // Show all diffs for small change sets
    diffs.forEach((diff, idx) => {
      lines.push(renderFileDiff(diff, { ...options, context: 1 }));
      if (idx < diffs.length - 1) {
        lines.push('');
      }
    });
  } else {
    // Show summary for large change sets
    lines.push(chalk.dim('Too many files to preview. Use [Show diffs] to view all changes.'));
  }

  lines.push('');
  lines.push(chalk.dim('─'.repeat(50)));
  lines.push('');

  // Actions
  lines.push(chalk.cyan('[Approve all]') + '  ' +
             chalk.cyan('[Review individually]') + '  ' +
             chalk.cyan('[Show diffs]') + '  ' +
             chalk.red('[Cancel]'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Parse git diff output to FileDiff objects
 */
export function parseGitDiff(gitDiffOutput: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const fileSections = gitDiffOutput.split('diff --git ').slice(1);

  fileSections.forEach(section => {
    const lines = section.split('\n');
    const pathLine = lines[0];
    if (!pathLine) return;

    const match = pathLine.match(/a\/(.*?) b\/(.*)/);

    if (!match || !match[2]) return;

    const path = match[2];
    let oldContent = '';
    let newContent = '';
    let isNew = false;
    let isDeleted = false;

    // Check for new/deleted file
    if (section.includes('new file mode')) {
      isNew = true;
    } else if (section.includes('deleted file mode')) {
      isDeleted = true;
    }

    // Extract content (simplified - real implementation would parse hunks)
    const contentStartIdx = lines.findIndex(l => l.startsWith('@@'));
    if (contentStartIdx !== -1) {
      const contentLines = lines.slice(contentStartIdx + 1);
      contentLines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          newContent += line.substring(1) + '\n';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          oldContent += line.substring(1) + '\n';
        } else if (line.startsWith(' ')) {
          oldContent += line.substring(1) + '\n';
          newContent += line.substring(1) + '\n';
        }
      });
    }

    diffs.push({
      path,
      oldContent,
      newContent,
      isNew,
      isDeleted
    });
  });

  return diffs;
}
