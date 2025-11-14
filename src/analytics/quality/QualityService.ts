// QualityService.ts - Code quality analysis orchestrator
// Day 67: Code Quality Analyzer Implementation
// Orchestrates complexity analysis, maintainability calculation, and quality reporting

import { ComplexityAnalyzer, FileComplexity } from './ComplexityAnalyzer.js';
import { MaintainabilityCalculator, MaintainabilityMetrics, QualityThresholds } from './MaintainabilityCalculator.js';
import { Language } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface QualityReport {
  filePath: string;
  language: Language;
  timestamp: Date;
  complexity: FileComplexity;
  maintainability: MaintainabilityMetrics;
  summary: QualitySummary;
}

export interface QualitySummary {
  overallGrade: string;
  qualityScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  technicalDebtHours: number;
  criticalIssuesCount: number;
  topRecommendations: string[];
}

export interface ProjectQualityReport {
  projectPath: string;
  timestamp: Date;
  fileReports: QualityReport[];
  aggregateMetrics: AggregateMetrics;
  trends: QualityTrends;
}

export interface AggregateMetrics {
  totalFiles: number;
  averageComplexity: number;
  averageMaintainability: number;
  averageQualityScore: number;
  totalTechnicalDebtHours: number;
  totalCodeSmells: number;
  gradeDistribution: Record<string, number>;
  riskDistribution: Record<string, number>;
}

export interface QualityTrends {
  complexityTrend: 'improving' | 'stable' | 'degrading';
  maintainabilityTrend: 'improving' | 'stable' | 'degrading';
  debtTrend: 'improving' | 'stable' | 'degrading';
}

export interface QualityServiceOptions {
  thresholds?: Partial<QualityThresholds>;
  includeAllFunctions?: boolean;
  excludePatterns?: string[];
}

// ============================================================================
// QUALITY SERVICE
// ============================================================================

export class QualityService {
  private complexityAnalyzer: ComplexityAnalyzer;
  private maintainabilityCalculator: MaintainabilityCalculator;
  private options: QualityServiceOptions;

  constructor(options?: QualityServiceOptions, complexityAnalyzer?: ComplexityAnalyzer) {
    this.options = options || {};
    this.complexityAnalyzer = complexityAnalyzer || new ComplexityAnalyzer();
    this.maintainabilityCalculator = new MaintainabilityCalculator(options?.thresholds);
  }

  /**
   * Analyze quality for a single file
   */
  async analyzeFile(filePath: string, language: Language): Promise<QualityReport> {
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Analyze complexity
    const complexity = await this.complexityAnalyzer.analyzeFile(filePath, content, language);

    // Calculate maintainability
    const maintainability = this.maintainabilityCalculator.calculateMaintainability(complexity);

    // Generate summary
    const summary = this.generateSummary(complexity, maintainability);

    return {
      filePath,
      language,
      timestamp: new Date(),
      complexity,
      maintainability,
      summary,
    };
  }

  /**
   * Analyze quality for entire project
   */
  async analyzeProject(projectPath: string, languages: Language[]): Promise<ProjectQualityReport> {
    const fileReports: QualityReport[] = [];

    // Find all relevant files
    const files = await this.findSourceFiles(projectPath, languages);

    // Analyze each file
    for (const { filePath, language } of files) {
      try {
        const report = await this.analyzeFile(filePath, language);
        fileReports.push(report);
      } catch (error) {
        console.error(`Failed to analyze ${filePath}:`, error);
      }
    }

    // Calculate aggregate metrics
    const aggregateMetrics = this.calculateAggregateMetrics(fileReports);

    // Calculate trends (requires historical data - placeholder for now)
    const trends: QualityTrends = {
      complexityTrend: 'stable',
      maintainabilityTrend: 'stable',
      debtTrend: 'stable',
    };

    return {
      projectPath,
      timestamp: new Date(),
      fileReports,
      aggregateMetrics,
      trends,
    };
  }

  /**
   * Generate quality summary
   */
  private generateSummary(complexity: FileComplexity, maintainability: MaintainabilityMetrics): QualitySummary {
    const qualityScore = maintainability.qualityScore;
    const technicalDebtHours = maintainability.technicalDebt.totalHours;

    // Determine overall grade (worst of complexity and maintainability)
    const complexityGrade = ComplexityAnalyzer.getComplexityGrade(complexity.averageComplexity);
    const maintainabilityGrade = maintainability.grade;
    const overallGrade = this.getWorseGrade(complexityGrade, maintainabilityGrade);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (qualityScore >= 70 && technicalDebtHours < 2) {
      riskLevel = 'low';
    } else if (qualityScore >= 50 && technicalDebtHours < 8) {
      riskLevel = 'medium';
    } else if (qualityScore >= 30 && technicalDebtHours < 24) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    // Count critical issues
    const criticalIssuesCount = maintainability.codeSmells.filter(s => s.severity === 'high').length;

    // Get top recommendations
    const topRecommendations = maintainability.recommendations.slice(0, 3);

    return {
      overallGrade,
      qualityScore,
      riskLevel,
      technicalDebtHours,
      criticalIssuesCount,
      topRecommendations,
    };
  }

  /**
   * Calculate aggregate metrics across all files
   */
  private calculateAggregateMetrics(reports: QualityReport[]): AggregateMetrics {
    if (reports.length === 0) {
      return {
        totalFiles: 0,
        averageComplexity: 0,
        averageMaintainability: 0,
        averageQualityScore: 0,
        totalTechnicalDebtHours: 0,
        totalCodeSmells: 0,
        gradeDistribution: {},
        riskDistribution: {},
      };
    }

    const totalFiles = reports.length;

    // Calculate averages
    const averageComplexity = reports.reduce((sum, r) => sum + r.complexity.averageComplexity, 0) / totalFiles;
    const averageMaintainability = reports.reduce((sum, r) => sum + r.maintainability.maintainabilityIndex, 0) / totalFiles;
    const averageQualityScore = reports.reduce((sum, r) => sum + r.maintainability.qualityScore, 0) / totalFiles;

    // Calculate totals
    const totalTechnicalDebtHours = reports.reduce((sum, r) => sum + r.maintainability.technicalDebt.totalHours, 0);
    const totalCodeSmells = reports.reduce((sum, r) => sum + r.maintainability.codeSmells.length, 0);

    // Calculate distributions
    const gradeDistribution: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {};

    for (const report of reports) {
      const grade = report.summary.overallGrade;
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;

      const risk = report.summary.riskLevel;
      riskDistribution[risk] = (riskDistribution[risk] || 0) + 1;
    }

    return {
      totalFiles,
      averageComplexity,
      averageMaintainability,
      averageQualityScore,
      totalTechnicalDebtHours,
      totalCodeSmells,
      gradeDistribution,
      riskDistribution,
    };
  }

  /**
   * Find source files in project
   */
  private async findSourceFiles(projectPath: string, languages: Language[]): Promise<{ filePath: string; language: Language }[]> {
    const files: { filePath: string; language: Language }[] = [];
    const excludePatterns = this.options.excludePatterns || ['node_modules', '.git', 'dist', 'build', 'coverage'];

    const languageExtensions: Record<Language, string[]> = {
      typescript: ['.ts', '.tsx'],
      javascript: ['.js', '.jsx', '.mjs'],
      python: ['.py'],
      go: ['.go'],
      rust: ['.rs'],
      ruby: ['.rb'],
      java: ['.java'],
      csharp: ['.cs'],
      php: ['.php'],
      kotlin: ['.kt'],
      swift: ['.swift'],
      ocaml: ['.ml', '.mli'],
    };

    const traverse = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Check exclude patterns
        if (excludePatterns.some(pattern => fullPath.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile()) {
          // Check if file matches any supported language
          for (const language of languages) {
            const extensions = languageExtensions[language] || [];
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push({ filePath: fullPath, language });
              break;
            }
          }
        }
      }
    };

    await traverse(projectPath);
    return files;
  }

  /**
   * Get worse grade between two grades
   */
  private getWorseGrade(grade1: string, grade2: string): string {
    const gradeOrder = ['A', 'B', 'C', 'D', 'F'];
    const index1 = gradeOrder.indexOf(grade1);
    const index2 = gradeOrder.indexOf(grade2);
    return index1 > index2 ? grade1 : grade2;
  }

  /**
   * Format quality report as text
   */
  formatReport(report: QualityReport): string {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`Quality Report: ${path.basename(report.filePath)}`);
    lines.push(`${'='.repeat(80)}\n`);

    // Summary
    lines.push(`Overall Grade: ${report.summary.overallGrade}`);
    lines.push(`Quality Score: ${report.summary.qualityScore.toFixed(1)}/100`);
    lines.push(`Risk Level: ${report.summary.riskLevel.toUpperCase()}`);
    lines.push(`Technical Debt: ${report.summary.technicalDebtHours.toFixed(1)} hours\n`);

    // Complexity metrics
    lines.push(`Complexity Metrics:`);
    lines.push(`  Average Cyclomatic Complexity: ${report.complexity.averageComplexity.toFixed(1)}`);
    lines.push(`  Max Cyclomatic Complexity: ${report.complexity.maxComplexity}`);
    lines.push(`  Maintainability Index: ${report.maintainability.maintainabilityIndex.toFixed(1)}/100\n`);

    // Code smells
    if (report.maintainability.codeSmells.length > 0) {
      lines.push(`Code Smells (${report.maintainability.codeSmells.length}):`);
      for (const smell of report.maintainability.codeSmells.slice(0, 5)) {
        lines.push(`  [${smell.severity.toUpperCase()}] ${smell.message}`);
      }
      if (report.maintainability.codeSmells.length > 5) {
        lines.push(`  ... and ${report.maintainability.codeSmells.length - 5} more\n`);
      } else {
        lines.push('');
      }
    }

    // Recommendations
    if (report.summary.topRecommendations.length > 0) {
      lines.push(`Top Recommendations:`);
      for (const rec of report.summary.topRecommendations) {
        lines.push(`  • ${rec}`);
      }
      lines.push('');
    }

    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }

  /**
   * Format project quality report as text
   */
  formatProjectReport(report: ProjectQualityReport): string {
    const lines: string[] = [];

    lines.push(`\n${'='.repeat(80)}`);
    lines.push(`Project Quality Report`);
    lines.push(`${'='.repeat(80)}\n`);

    // Aggregate metrics
    const metrics = report.aggregateMetrics;
    lines.push(`Files Analyzed: ${metrics.totalFiles}`);
    lines.push(`Average Complexity: ${metrics.averageComplexity.toFixed(1)}`);
    lines.push(`Average Maintainability: ${metrics.averageMaintainability.toFixed(1)}/100`);
    lines.push(`Average Quality Score: ${metrics.averageQualityScore.toFixed(1)}/100`);
    lines.push(`Total Technical Debt: ${metrics.totalTechnicalDebtHours.toFixed(1)} hours\n`);

    // Grade distribution
    lines.push(`Grade Distribution:`);
    for (const [grade, count] of Object.entries(metrics.gradeDistribution).sort()) {
      const percentage = (count / metrics.totalFiles * 100).toFixed(1);
      lines.push(`  ${grade}: ${count} files (${percentage}%)`);
    }
    lines.push('');

    // Risk distribution
    lines.push(`Risk Distribution:`);
    for (const [risk, count] of Object.entries(metrics.riskDistribution).sort()) {
      const percentage = (count / metrics.totalFiles * 100).toFixed(1);
      lines.push(`  ${risk}: ${count} files (${percentage}%)`);
    }
    lines.push('');

    lines.push(`${'='.repeat(80)}\n`);

    return lines.join('\n');
  }
}
