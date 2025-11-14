/**
 * Diagnostics Provider
 *
 * Provides code quality diagnostics for documents.
 * Integrates with QualityService to analyze code quality.
 * Publishes diagnostics for complexity, maintainability, and code smells.
 */

import type { Diagnostic as LSPDiagnostic, DiagnosticSeverity as LSPDiagnosticSeverity } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { QualityReport } from '../../analytics/quality/QualityService.js';
import { QualityService } from '../../analytics/quality/QualityService.js';
import type { Language } from '../../types/index.js';
import { uriToFilePath, getLanguageId } from '../utils/lsp-utils.js';
import type { Range } from '../types/lsp-types.js';

/**
 * Diagnostic configuration
 */
export interface DiagnosticsConfig {
  enabled: boolean;
  complexityThreshold: number;
  maintainabilityThreshold: number;
  debounceMs: number;
}

const DEFAULT_CONFIG: DiagnosticsConfig = {
  enabled: true,
  complexityThreshold: 15,
  maintainabilityThreshold: 50,
  debounceMs: 300,
};

/**
 * Diagnostics Provider
 * Analyzes code quality and publishes diagnostics
 */
export class DiagnosticsProvider {
  private qualityService: QualityService;
  private config: DiagnosticsConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private diagnosticsCache: Map<string, LSPDiagnostic[]> = new Map();

  constructor(
    private documentManager: DocumentManager,
    config?: Partial<DiagnosticsConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.qualityService = new QualityService();
  }

  /**
   * Analyze document and return diagnostics
   */
  async provideDiagnostics(uri: string): Promise<LSPDiagnostic[]> {
    try {
      // Check cache first
      const cached = this.diagnosticsCache.get(uri);
      if (cached) {
        return cached;
      }

      const filePath = uriToFilePath(uri);
      const languageId = getLanguageId(filePath);
      const language = this.mapLanguageId(languageId);

      if (!language) {
        return [];
      }

      // Analyze file quality
      const qualityReport = await this.qualityService.analyzeFile(filePath, language);

      // Convert quality report to diagnostics
      const diagnostics = this.convertQualityReportToDiagnostics(qualityReport);

      // Cache diagnostics
      this.diagnosticsCache.set(uri, diagnostics);

      return diagnostics;
    } catch (error) {
      console.error(`Error providing diagnostics for ${uri}:`, error);
      return [];
    }
  }

  /**
   * Analyze document with debouncing
   */
  async provideDiagnosticsDebounced(
    uri: string,
    callback: (diagnostics: LSPDiagnostic[]) => void
  ): Promise<void> {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      const diagnostics = await this.provideDiagnostics(uri);
      callback(diagnostics);
      this.debounceTimers.delete(uri);
    }, this.config.debounceMs);

    this.debounceTimers.set(uri, timer);
  }

  /**
   * Clear diagnostics for document
   */
  clearDiagnostics(uri: string): void {
    this.diagnosticsCache.delete(uri);

    const timer = this.debounceTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(uri);
    }
  }

  /**
   * Convert QualityReport to LSP diagnostics
   */
  private convertQualityReportToDiagnostics(report: QualityReport): LSPDiagnostic[] {
    const diagnostics: LSPDiagnostic[] = [];

    // Add complexity diagnostics
    if (report.complexity.averageComplexity > this.config.complexityThreshold) {
      diagnostics.push({
        severity: this.getSeverityForComplexity(report.complexity.averageComplexity),
        range: this.createFileRange(),
        message: `High cyclomatic complexity: ${report.complexity.averageComplexity.toFixed(1)} (threshold: ${this.config.complexityThreshold})`,
        source: 'automatosx-quality',
        code: 'high-complexity',
      });
    }

    // Add maintainability diagnostics
    if (report.maintainability.maintainabilityIndex < this.config.maintainabilityThreshold) {
      diagnostics.push({
        severity: this.getSeverityForMaintainability(report.maintainability.maintainabilityIndex),
        range: this.createFileRange(),
        message: `Low maintainability index: ${report.maintainability.maintainabilityIndex.toFixed(1)} (threshold: ${this.config.maintainabilityThreshold})`,
        source: 'automatosx-quality',
        code: 'low-maintainability',
      });
    }

    // Add code smell diagnostics
    for (const smell of report.maintainability.codeSmells) {
      const diagnostic: LSPDiagnostic = {
        severity: this.mapSmellSeverity(smell.severity),
        range: this.createRangeFromSmell(smell),
        message: smell.message,
        source: 'automatosx-quality',
        code: smell.type || 'code-smell',
      };

      diagnostics.push(diagnostic);
    }

    // Add quality score diagnostic
    if (report.summary.qualityScore < 50) {
      diagnostics.push({
        severity: 2, // Warning
        range: this.createFileRange(),
        message: `Quality score is ${report.summary.qualityScore.toFixed(1)}/100. ${report.summary.topRecommendations[0] || 'Consider refactoring.'}`,
        source: 'automatosx-quality',
        code: 'low-quality-score',
      });
    }

    // Add technical debt diagnostic
    if (report.summary.technicalDebtHours > 8) {
      diagnostics.push({
        severity: 2, // Warning
        range: this.createFileRange(),
        message: `High technical debt: ${report.summary.technicalDebtHours.toFixed(1)} hours estimated to fix`,
        source: 'automatosx-quality',
        code: 'high-technical-debt',
      });
    }

    return diagnostics;
  }

  /**
   * Get diagnostic severity for complexity
   */
  private getSeverityForComplexity(complexity: number): LSPDiagnosticSeverity {
    if (complexity > 30) {
      return 1; // Error
    } else if (complexity > 20) {
      return 2; // Warning
    } else {
      return 3; // Information
    }
  }

  /**
   * Get diagnostic severity for maintainability
   */
  private getSeverityForMaintainability(maintainability: number): LSPDiagnosticSeverity {
    if (maintainability < 30) {
      return 1; // Error
    } else if (maintainability < 50) {
      return 2; // Warning
    } else {
      return 3; // Information
    }
  }

  /**
   * Map code smell severity to LSP severity
   */
  private mapSmellSeverity(severity: string): LSPDiagnosticSeverity {
    switch (severity) {
      case 'high':
        return 1; // Error
      case 'medium':
        return 2; // Warning
      case 'low':
        return 3; // Information
      default:
        return 4; // Hint
    }
  }

  /**
   * Create range from code smell
   */
  private createRangeFromSmell(smell: any): Range {
    // If smell has location info, use it
    if (smell.line !== undefined) {
      return {
        start: { line: smell.line, character: 0 },
        end: { line: smell.line, character: 9999 },
      };
    }

    // Otherwise, use file range
    return this.createFileRange();
  }

  /**
   * Create file-level range (line 0)
   */
  private createFileRange(): Range {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 9999 },
    };
  }

  /**
   * Map language ID to Language enum
   */
  private mapLanguageId(languageId: string): Language | null {
    const languageMap: Record<string, Language> = {
      typescript: 'typescript',
      typescriptreact: 'typescript',
      javascript: 'javascript',
      javascriptreact: 'javascript',
      python: 'python',
      go: 'go',
      rust: 'rust',
      ruby: 'ruby',
      java: 'java',
      csharp: 'csharp',
      php: 'php',
      kotlin: 'kotlin',
      swift: 'swift',
      ocaml: 'ocaml',
    };

    return languageMap[languageId] || null;
  }

  /**
   * Get statistics
   */
  getStats(): {
    cachedFiles: number;
    pendingAnalysis: number;
  } {
    return {
      cachedFiles: this.diagnosticsCache.size,
      pendingAnalysis: this.debounceTimers.size,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.diagnosticsCache.clear();
  }
}
