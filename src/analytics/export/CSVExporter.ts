/**
 * CSV Exporter
 *
 * Exports quality reports in CSV format
 */

import { stringify } from 'csv-stringify/sync';
import type { QualityReport, ExportResult, ExportOptions, FileQualityReport, CodeSmellReport } from './types.js';

export class CSVExporter {
  /**
   * Export quality report as CSV (file-level metrics)
   */
  export(report: QualityReport, options: ExportOptions): ExportResult {
    const rows = this.convertToFileRows(report.files);
    const content = stringify(rows, {
      header: true,
      columns: ['filePath', 'language', 'complexity', 'maintainability', 'linesOfCode', 'codeSmells'],
    });

    const buffer = Buffer.from(content, 'utf-8');

    return {
      format: 'csv',
      outputPath: options.outputPath,
      content,
      size: buffer.length,
      generatedAt: Date.now(),
    };
  }

  /**
   * Export code smells as CSV
   */
  exportCodeSmells(report: QualityReport, options: ExportOptions): ExportResult {
    const rows = this.convertToCodeSmellRows(report.codeSmells);
    const content = stringify(rows, {
      header: true,
      columns: ['type', 'severity', 'filePath', 'line', 'message', 'suggestion'],
    });

    const buffer = Buffer.from(content, 'utf-8');

    return {
      format: 'csv',
      outputPath: options.outputPath,
      content,
      size: buffer.length,
      generatedAt: Date.now(),
    };
  }

  /**
   * Export summary metrics as CSV
   */
  exportSummary(report: QualityReport, options: ExportOptions): ExportResult {
    const rows = [
      {
        metric: 'Total Files',
        value: report.summary.totalFiles.toString(),
      },
      {
        metric: 'Average Complexity',
        value: report.summary.averageComplexity.toFixed(2),
      },
      {
        metric: 'Maintainability Score',
        value: report.summary.maintainabilityScore.toFixed(2),
      },
      {
        metric: 'Code Smell Count',
        value: report.summary.codeSmellCount.toString(),
      },
    ];

    const content = stringify(rows, {
      header: true,
      columns: ['metric', 'value'],
    });

    const buffer = Buffer.from(content, 'utf-8');

    return {
      format: 'csv',
      outputPath: options.outputPath,
      content,
      size: buffer.length,
      generatedAt: Date.now(),
    };
  }

  /**
   * Convert file reports to CSV rows
   */
  private convertToFileRows(files: FileQualityReport[]): Record<string, string | number>[] {
    return files.map((file) => ({
      filePath: file.filePath,
      language: file.language,
      complexity: file.complexity,
      maintainability: file.maintainability,
      linesOfCode: file.linesOfCode,
      codeSmells: file.codeSmells,
    }));
  }

  /**
   * Convert code smell reports to CSV rows
   */
  private convertToCodeSmellRows(codeSmells: CodeSmellReport[]): Record<string, string | number>[] {
    return codeSmells.map((smell) => ({
      type: smell.type,
      severity: smell.severity,
      filePath: smell.filePath,
      line: smell.line,
      message: smell.message,
      suggestion: smell.suggestion || '',
    }));
  }
}
