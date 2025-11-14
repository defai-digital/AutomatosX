/**
 * Quality Metrics Tree View Provider
 * Displays code quality metrics in a tree view
 */

import * as vscode from 'vscode';
import { LSPClient } from '../lsp/LSPClient.js';

interface QualityMetrics {
  filePath: string;
  score: number;
  grade: string;
  complexity: number;
  maintainability: number;
  issues: number;
}

export class QualityMetricsProvider implements vscode.TreeDataProvider<QualityTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<QualityTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lspClient: LSPClient;
  private metrics: Map<string, QualityMetrics> = new Map();
  private filterGrade: string | undefined;

  constructor(lspClient: LSPClient) {
    this.lspClient = lspClient;
  }

  /**
   * Refresh tree view
   */
  refresh(): void {
    this.loadMetrics();
  }

  /**
   * Set grade filter
   */
  setFilter(grade?: string): void {
    this.filterGrade = grade;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Load quality metrics for all files
   */
  private async loadMetrics(): Promise<void> {
    this.metrics.clear();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._onDidChangeTreeData.fire();
      return;
    }

    try {
      // Get all files in workspace
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,go,rs}',
        '**/node_modules/**'
      );

      for (const file of files) {
        const metrics = await this.lspClient.getQualityMetrics(file.fsPath);
        if (metrics) {
          this.metrics.set(file.fsPath, metrics);
        }
      }

      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to load quality metrics:', error);
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Get tree item
   */
  getTreeItem(element: QualityTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree item
   */
  async getChildren(element?: QualityTreeItem): Promise<QualityTreeItem[]> {
    if (!element) {
      // Root level: group by grade
      return this.getGradeGroups();
    } else if (element.contextValue === 'grade') {
      // Grade level: show files with that grade
      return this.getFilesForGrade(element.label as string);
    }
    return [];
  }

  /**
   * Get grade groups
   */
  private getGradeGroups(): QualityTreeItem[] {
    const grades = new Map<string, number>();

    for (const [_, metrics] of this.metrics) {
      if (!this.filterGrade || metrics.grade === this.filterGrade) {
        const count = grades.get(metrics.grade) || 0;
        grades.set(metrics.grade, count + 1);
      }
    }

    const items: QualityTreeItem[] = [];
    for (const [grade, count] of grades) {
      const item = new QualityTreeItem(
        grade,
        `${count} file${count !== 1 ? 's' : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = 'grade';
      item.iconPath = new vscode.ThemeIcon(this.getIconForGrade(grade));
      items.push(item);
    }

    // Sort by grade (A, B, C, D, F)
    items.sort((a, b) => {
      const gradeOrder = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'F': 4 };
      const aOrder = gradeOrder[a.label as keyof typeof gradeOrder] ?? 5;
      const bOrder = gradeOrder[b.label as keyof typeof gradeOrder] ?? 5;
      return aOrder - bOrder;
    });

    return items;
  }

  /**
   * Get files for grade
   */
  private getFilesForGrade(grade: string): QualityTreeItem[] {
    const items: QualityTreeItem[] = [];

    for (const [filePath, metrics] of this.metrics) {
      if (metrics.grade === grade) {
        const item = new QualityTreeItem(
          this.getFileName(filePath),
          `Score: ${metrics.score.toFixed(1)} | Complexity: ${metrics.complexity}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.contextValue = 'file';
        item.resourceUri = vscode.Uri.file(filePath);
        item.iconPath = vscode.ThemeIcon.File;
        item.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(filePath)],
        };
        item.tooltip = this.getTooltip(metrics);
        items.push(item);
      }
    }

    // Sort by score (lowest first for attention)
    items.sort((a, b) => {
      const aMetrics = this.getMetricsForFile(a.resourceUri!.fsPath);
      const bMetrics = this.getMetricsForFile(b.resourceUri!.fsPath);
      return aMetrics.score - bMetrics.score;
    });

    return items;
  }

  /**
   * Get metrics for file
   */
  private getMetricsForFile(filePath: string): QualityMetrics {
    return this.metrics.get(filePath)!;
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Get icon for grade
   */
  private getIconForGrade(grade: string): string {
    switch (grade) {
      case 'A':
        return 'pass';
      case 'B':
        return 'info';
      case 'C':
        return 'warning';
      case 'D':
      case 'F':
        return 'error';
      default:
        return 'question';
    }
  }

  /**
   * Get tooltip for metrics
   */
  private getTooltip(metrics: QualityMetrics): string {
    return [
      `Quality Score: ${metrics.score.toFixed(1)}`,
      `Grade: ${metrics.grade}`,
      `Complexity: ${metrics.complexity}`,
      `Maintainability: ${metrics.maintainability.toFixed(1)}`,
      `Issues: ${metrics.issues}`,
    ].join('\n');
  }

  /**
   * Get parent for tree item (not used)
   */
  getParent(element: QualityTreeItem): vscode.ProviderResult<QualityTreeItem> {
    return null;
  }
}

/**
 * Tree item for quality metrics
 */
class QualityTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}
