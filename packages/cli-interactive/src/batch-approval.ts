/**
 * Batch Approval System
 *
 * Reduces approval fatigue by batching file operations and showing
 * a single comprehensive approval prompt instead of multiple interruptions.
 *
 * Phase 4 P2: Batch approval for file operations
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { renderFileDiff, renderMultiFileDiff, type FileDiff } from './diff-renderer.js';

export type BatchOperationType = 'read' | 'write' | 'edit' | 'delete' | 'create';

export interface BatchOperation {
  id: string;
  type: BatchOperationType;
  path: string;
  description: string;
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: string;
  diff?: FileDiff;
  metadata?: Record<string, unknown>;
}

export interface BatchApprovalResult {
  approved: boolean;
  selectedOperations: string[]; // IDs of operations to execute
  rejectedOperations: string[]; // IDs of operations rejected
  feedback?: string;
}

export interface BatchApprovalOptions {
  showDiffs?: boolean;
  allowPartialApproval?: boolean;
  requireConfirmation?: boolean;
  groupByRisk?: boolean;
}

/**
 * Batch multiple operations for single approval
 */
export class BatchApprovalManager {
  private pendingOperations: Map<string, BatchOperation> = new Map();
  private executedOperations: BatchOperation[] = [];

  /**
   * Add operation to batch
   */
  addOperation(operation: BatchOperation): void {
    this.pendingOperations.set(operation.id, operation);
  }

  /**
   * Add multiple operations to batch
   */
  addOperations(operations: BatchOperation[]): void {
    operations.forEach(op => this.addOperation(op));
  }

  /**
   * Get all pending operations
   */
  getPendingOperations(): BatchOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  /**
   * Get operations by type
   */
  getOperationsByType(type: BatchOperationType): BatchOperation[] {
    return this.getPendingOperations().filter(op => op.type === type);
  }

  /**
   * Get operations by risk level
   */
  getOperationsByRisk(risk: BatchOperation['risk']): BatchOperation[] {
    return this.getPendingOperations().filter(op => op.risk === risk);
  }

  /**
   * Clear all pending operations
   */
  clearPending(): void {
    this.pendingOperations.clear();
  }

  /**
   * Mark operations as executed
   */
  markExecuted(operationIds: string[]): void {
    operationIds.forEach(id => {
      const op = this.pendingOperations.get(id);
      if (op) {
        this.executedOperations.push(op);
        this.pendingOperations.delete(id);
      }
    });
  }

  /**
   * Get count of pending operations
   */
  getPendingCount(): number {
    return this.pendingOperations.size;
  }

  /**
   * Check if batch is ready for approval
   */
  isReadyForApproval(): boolean {
    return this.pendingOperations.size > 0;
  }

  /**
   * Get executed operations history
   */
  getExecutedOperations(): BatchOperation[] {
    return [...this.executedOperations];
  }
}

/**
 * Render batch approval prompt
 */
export function renderBatchApprovalPrompt(
  operations: BatchOperation[],
  options: BatchApprovalOptions = {}
): string {
  const {
    showDiffs = true,
    groupByRisk = true
  } = options;

  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('╭─ Batch Operation Approval ─╮'));
  lines.push('');

  // Summary
  const summary = generateOperationSummary(operations);
  lines.push(chalk.white(`${operations.length} operations pending approval:`));
  lines.push('');

  // Group by risk if enabled
  if (groupByRisk) {
    const grouped = groupOperationsByRisk(operations);

    Object.entries(grouped).forEach(([risk, ops]) => {
      if (ops.length === 0) return;

      const riskColor = getRiskColor(risk as BatchOperation['risk']);
      const riskIcon = getRiskIcon(risk as BatchOperation['risk']);

      lines.push(`${riskIcon} ${riskColor(chalk.bold(`${risk.toUpperCase()} RISK`))} (${ops.length})`);

      ops.forEach(op => {
        const typeIcon = getOperationIcon(op.type);
        lines.push(`  ${typeIcon} ${chalk.white(op.path)}`);
        lines.push(`     ${chalk.dim(op.description)}`);

        if (op.estimatedImpact) {
          lines.push(`     ${chalk.dim('Impact:')} ${chalk.yellow(op.estimatedImpact)}`);
        }
      });

      lines.push('');
    });
  } else {
    // List operations sequentially
    operations.forEach((op, idx) => {
      const typeIcon = getOperationIcon(op.type);
      const riskIcon = getRiskIcon(op.risk);

      lines.push(`${idx + 1}. ${typeIcon} ${riskIcon} ${chalk.white(op.path)}`);
      lines.push(`   ${chalk.dim(op.description)}`);

      if (op.estimatedImpact) {
        lines.push(`   ${chalk.dim('Impact:')} ${chalk.yellow(op.estimatedImpact)}`);
      }

      lines.push('');
    });
  }

  // Show diffs if available and enabled
  if (showDiffs) {
    const diffs = operations.filter(op => op.diff).map(op => op.diff!);
    if (diffs.length > 0) {
      lines.push(chalk.bold.yellow('File Changes Preview:'));
      lines.push('');
      lines.push(renderMultiFileDiff(diffs, { compact: true }));
      lines.push('');
    }
  }

  // Summary stats
  lines.push(chalk.bold.white('Summary:'));
  Object.entries(summary).forEach(([key, value]) => {
    if (value > 0) {
      lines.push(`  ${chalk.cyan('•')} ${key}: ${chalk.white(value.toString())}`);
    }
  });
  lines.push('');

  // Actions
  lines.push(chalk.bold.green('Actions:'));
  lines.push(`  ${chalk.green('[A]')} Approve all`);
  lines.push(`  ${chalk.yellow('[R]')} Review individually`);
  lines.push(`  ${chalk.blue('[S]')} Select specific operations`);
  lines.push(`  ${chalk.red('[C]')} Cancel all`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Prompt user for batch approval
 */
export async function promptBatchApproval(
  operations: BatchOperation[],
  options: BatchApprovalOptions = {}
): Promise<BatchApprovalResult> {
  const {
    allowPartialApproval = true,
    requireConfirmation = true
  } = options;

  // Show prompt
  console.log(renderBatchApprovalPrompt(operations, options));

  // Get user decision
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { name: 'Approve all operations', value: 'approve_all' },
        { name: 'Review individually', value: 'review_individual' },
        ...(allowPartialApproval ? [{ name: 'Select specific operations', value: 'select_specific' }] : []),
        { name: 'Cancel all operations', value: 'cancel' }
      ]
    }
  ]);

  if (action === 'cancel') {
    return {
      approved: false,
      selectedOperations: [],
      rejectedOperations: operations.map(op => op.id)
    };
  }

  if (action === 'approve_all') {
    // Require confirmation for high/critical risk operations
    const highRiskOps = operations.filter(op => op.risk === 'high' || op.risk === 'critical');

    if (requireConfirmation && highRiskOps.length > 0) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: chalk.yellow(`⚠️  This includes ${highRiskOps.length} high/critical risk operation(s). Confirm?`),
          default: false
        }
      ]);

      if (!confirmed) {
        return {
          approved: false,
          selectedOperations: [],
          rejectedOperations: operations.map(op => op.id)
        };
      }
    }

    return {
      approved: true,
      selectedOperations: operations.map(op => op.id),
      rejectedOperations: []
    };
  }

  if (action === 'review_individual') {
    const selected: string[] = [];
    const rejected: string[] = [];

    for (const op of operations) {
      console.log('');
      console.log(chalk.bold.cyan(`─── Operation ${operations.indexOf(op) + 1} of ${operations.length} ───`));
      console.log(renderOperationDetails(op));

      const { approve } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approve',
          message: 'Approve this operation?',
          default: op.risk !== 'critical'
        }
      ]);

      if (approve) {
        selected.push(op.id);
      } else {
        rejected.push(op.id);
      }
    }

    return {
      approved: selected.length > 0,
      selectedOperations: selected,
      rejectedOperations: rejected
    };
  }

  if (action === 'select_specific') {
    const { selectedIds } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedIds',
        message: 'Select operations to approve:',
        choices: operations.map(op => ({
          name: `${getOperationIcon(op.type)} ${op.path} - ${op.description}`,
          value: op.id,
          checked: op.risk !== 'critical'
        }))
      }
    ]);

    return {
      approved: selectedIds.length > 0,
      selectedOperations: selectedIds,
      rejectedOperations: operations.filter(op => !selectedIds.includes(op.id)).map(op => op.id)
    };
  }

  return {
    approved: false,
    selectedOperations: [],
    rejectedOperations: operations.map(op => op.id)
  };
}

/**
 * Render individual operation details
 */
function renderOperationDetails(operation: BatchOperation): string {
  const lines: string[] = [];

  const typeIcon = getOperationIcon(operation.type);
  const riskIcon = getRiskIcon(operation.risk);
  const riskColor = getRiskColor(operation.risk);

  lines.push(`${typeIcon} ${chalk.bold.white(operation.path)}`);
  lines.push(`   ${chalk.dim('Type:')} ${chalk.cyan(operation.type)}`);
  lines.push(`   ${chalk.dim('Risk:')} ${riskIcon} ${riskColor(operation.risk)}`);
  lines.push(`   ${chalk.dim('Description:')} ${chalk.white(operation.description)}`);

  if (operation.estimatedImpact) {
    lines.push(`   ${chalk.dim('Impact:')} ${chalk.yellow(operation.estimatedImpact)}`);
  }

  if (operation.diff) {
    lines.push('');
    lines.push(chalk.bold.yellow('Changes:'));
    lines.push(renderFileDiff(operation.diff, { compact: true }));
  }

  return lines.join('\n');
}

/**
 * Generate operation summary
 */
function generateOperationSummary(operations: BatchOperation[]): Record<string, number> {
  const summary: Record<string, number> = {
    'Total operations': operations.length,
    'Read': 0,
    'Write': 0,
    'Edit': 0,
    'Delete': 0,
    'Create': 0,
    'Safe': 0,
    'Low risk': 0,
    'Medium risk': 0,
    'High risk': 0,
    'Critical risk': 0
  };

  operations.forEach(op => {
    // Count by type
    const typeKey = op.type.charAt(0).toUpperCase() + op.type.slice(1);
    if (typeKey in summary && summary[typeKey as keyof typeof summary] !== undefined) {
      (summary[typeKey as keyof typeof summary] as number)++;
    }

    // Count by risk
    const riskKey = op.risk.charAt(0).toUpperCase() + op.risk.slice(1) + ' risk';
    if (riskKey in summary && summary[riskKey as keyof typeof summary] !== undefined) {
      (summary[riskKey as keyof typeof summary] as number)++;
    }
  });

  return summary;
}

/**
 * Group operations by risk level
 */
function groupOperationsByRisk(operations: BatchOperation[]): Record<string, BatchOperation[]> {
  return {
    critical: operations.filter(op => op.risk === 'critical'),
    high: operations.filter(op => op.risk === 'high'),
    medium: operations.filter(op => op.risk === 'medium'),
    low: operations.filter(op => op.risk === 'low'),
    safe: operations.filter(op => op.risk === 'safe')
  };
}

/**
 * Get operation type icon
 */
function getOperationIcon(type: BatchOperationType): string {
  const icons: Record<BatchOperationType, string> = {
    read: '📖',
    write: '✍️',
    edit: '✎',
    delete: '🗑️',
    create: '📄'
  };
  return icons[type] || '📋';
}

/**
 * Get risk level icon
 */
function getRiskIcon(risk: BatchOperation['risk']): string {
  const icons = {
    safe: chalk.green('✓'),
    low: chalk.blue('ℹ'),
    medium: chalk.yellow('⚠'),
    high: chalk.yellow('⚠️'),
    critical: chalk.red('🚨')
  };
  return icons[risk] || '•';
}

/**
 * Get risk level color function
 */
function getRiskColor(risk: BatchOperation['risk']): (text: string) => string {
  const colors = {
    safe: chalk.green,
    low: chalk.blue,
    medium: chalk.yellow,
    high: chalk.yellow,
    critical: chalk.red
  };
  return colors[risk] || chalk.white;
}

/**
 * Create operation from file operation
 */
export function createFileOperation(
  type: BatchOperationType,
  path: string,
  description: string,
  risk: BatchOperation['risk'] = 'medium',
  diff?: FileDiff
): BatchOperation {
  return {
    id: `${type}-${path}-${Date.now()}`,
    type,
    path,
    description,
    risk,
    estimatedImpact: estimateImpact(type, path),
    diff
  };
}

/**
 * Estimate operation impact
 */
function estimateImpact(type: BatchOperationType, path: string): string {
  const impacts: Record<BatchOperationType, string> = {
    read: 'Read-only, no changes',
    write: 'File will be overwritten',
    edit: 'File will be modified',
    delete: 'File will be permanently deleted',
    create: 'New file will be created'
  };

  let impact = impacts[type] || 'Unknown impact';

  // Add file-specific warnings
  if (path.includes('config') || path.includes('.env')) {
    impact += ', affects configuration';
  }
  if (path.includes('package.json') || path.includes('package-lock.json')) {
    impact += ', may affect dependencies';
  }
  if (path.includes('test') || path.includes('spec')) {
    impact += ', test file';
  }

  return impact;
}
