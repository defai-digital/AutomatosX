/**
 * Export Types
 *
 * Type definitions for quality report export functionality
 */

export type ExportFormat = 'json' | 'csv' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  outputPath?: string;
  includeDetails?: boolean;
  includeCharts?: boolean;
}

export interface ExportResult {
  format: ExportFormat;
  outputPath?: string;
  content?: string | Buffer;
  size: number;
  generatedAt: number;
}

export interface QualityReport {
  summary: {
    totalFiles: number;
    averageComplexity: number;
    maintainabilityScore: number;
    codeSmellCount: number;
    analysisDate: number;
  };
  files: FileQualityReport[];
  codeSmells: CodeSmellReport[];
  metrics: QualityMetrics;
}

export interface FileQualityReport {
  filePath: string;
  language: string;
  complexity: number;
  maintainability: number;
  linesOfCode: number;
  codeSmells: number;
}

export interface CodeSmellReport {
  type: string;
  severity: 'low' | 'medium' | 'high';
  filePath: string;
  line: number;
  message: string;
  suggestion?: string;
}

export interface QualityMetrics {
  complexityDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  maintainabilityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  languageBreakdown: Record<string, number>;
  codeSmellsByType: Record<string, number>;
}
