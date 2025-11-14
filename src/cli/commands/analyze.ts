// analyze.ts - CLI command for code quality analysis
// Day 67: Code Quality Analyzer Implementation
// Analyzes code quality with complexity, maintainability, and technical debt metrics

import { Command } from 'commander';
import { QualityService } from '../../analytics/quality/QualityService.js';
import { ExportService } from '../../analytics/export/ExportService.js';
import type { QualityReport as ExportQualityReport } from '../../analytics/export/types.js';
import { Language } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export function createAnalyzeCommand(): Command {
  const cmd = new Command('analyze')
    .description('Analyze code quality, complexity, and technical debt')
    .argument('[path]', 'File or directory path to analyze', '.')
    .option('-l, --language <lang>', 'Language filter (typescript, javascript, python, etc.)')
    .option('--format <format>', 'Output format (text, json, summary)', 'text')
    .option('--export <format>', 'Export report (json, csv, pdf)')
    .option('--output <path>', 'Output file path for export')
    .option('--threshold <score>', 'Quality score threshold (0-100)', '60')
    .option('--save', 'Save results to database', false)
    .option('--top <n>', 'Show top N files by debt', '10')
    .option('--grade <grade>', 'Filter by grade (A, B, C, D, F)')
    .option('--risk <level>', 'Filter by risk level (low, medium, high, critical)')
    .action(analyzeAction);

  return cmd;
}

// ============================================================================
// ACTION HANDLER
// ============================================================================

async function analyzeAction(
  targetPath: string,
  options: {
    language?: string;
    format: 'text' | 'json' | 'summary';
    export?: 'json' | 'csv' | 'pdf';
    output?: string;
    threshold: string;
    save: boolean;
    top: string;
    grade?: string;
    risk?: string;
  }
) {
  try {
    const service = new QualityService();

    // Parse threshold
    const threshold = parseInt(options.threshold, 10);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      console.error(chalk.red('Error: Threshold must be a number between 0 and 100'));
      process.exit(1);
    }

    // Check if path exists
    const stats = await fs.stat(targetPath).catch(() => null);
    if (!stats) {
      console.error(chalk.red(`Error: Path not found: ${targetPath}`));
      process.exit(1);
    }

    // Determine if analyzing file or directory
    if (stats.isFile()) {
      await analyzeFile(service, targetPath, options, threshold);
    } else if (stats.isDirectory()) {
      await analyzeProject(service, targetPath, options, threshold);
    } else {
      console.error(chalk.red(`Error: Invalid path type: ${targetPath}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error during analysis:'), error);
    process.exit(1);
  }
}

// ============================================================================
// FILE ANALYSIS
// ============================================================================

async function analyzeFile(
  service: QualityService,
  filePath: string,
  options: any,
  threshold: number
) {
  // Detect language from file extension
  const language = detectLanguage(filePath);
  if (!language) {
    console.error(chalk.red(`Error: Unsupported file type: ${path.extname(filePath)}`));
    process.exit(1);
  }

  // Check language filter
  if (options.language && language !== options.language) {
    console.error(chalk.red(`Error: File is ${language}, but filter is set to ${options.language}`));
    process.exit(1);
  }

  console.log(chalk.blue(`\nAnalyzing file: ${filePath}\n`));

  const report = await service.analyzeFile(filePath, language);

  // Apply filters
  if (options.grade && report.summary.overallGrade !== options.grade.toUpperCase()) {
    console.log(chalk.yellow(`File grade ${report.summary.overallGrade} does not match filter ${options.grade.toUpperCase()}`));
    return;
  }

  if (options.risk && report.summary.riskLevel !== options.risk.toLowerCase()) {
    console.log(chalk.yellow(`File risk ${report.summary.riskLevel} does not match filter ${options.risk.toLowerCase()}`));
    return;
  }

  // Format and display report
  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (options.format === 'summary') {
    displayFileSummary(report, threshold);
  } else {
    console.log(service.formatReport(report));
  }

  // Save to database if requested
  if (options.save) {
    console.log(chalk.gray('\nNote: Database save not yet implemented'));
  }
}

// ============================================================================
// PROJECT ANALYSIS
// ============================================================================

async function analyzeProject(
  service: QualityService,
  projectPath: string,
  options: any,
  threshold: number
) {
  // Determine languages to analyze
  const languages: Language[] = options.language
    ? [options.language as Language]
    : ['typescript', 'javascript', 'python'];

  console.log(chalk.blue(`\nAnalyzing project: ${projectPath}`));
  console.log(chalk.gray(`Languages: ${languages.join(', ')}\n`));

  const projectReport = await service.analyzeProject(projectPath, languages);

  // Apply filters
  let filteredReports = projectReport.fileReports;

  if (options.grade) {
    const grade = options.grade.toUpperCase();
    filteredReports = filteredReports.filter(r => r.summary.overallGrade === grade);
  }

  if (options.risk) {
    const risk = options.risk.toLowerCase();
    filteredReports = filteredReports.filter(r => r.summary.riskLevel === risk);
  }

  // Sort by quality score (worst first)
  filteredReports.sort((a, b) => a.summary.qualityScore - b.summary.qualityScore);

  // Format and display report
  if (options.format === 'json') {
    const output = {
      ...projectReport,
      fileReports: filteredReports,
    };
    console.log(JSON.stringify(output, null, 2));
  } else if (options.format === 'summary') {
    displayProjectSummary(projectReport, filteredReports, threshold, parseInt(options.top, 10));
  } else {
    console.log(service.formatProjectReport({
      ...projectReport,
      fileReports: filteredReports,
    }));

    // Show top problematic files
    const topN = parseInt(options.top, 10);
    if (filteredReports.length > 0) {
      displayTopProblematicFiles(filteredReports.slice(0, topN), threshold);
    }
  }

  // Save to database if requested
  if (options.save) {
    console.log(chalk.gray('\nNote: Database save not yet implemented'));
  }

  // Export report if requested
  if (options.export) {
    await exportReport(projectReport, filteredReports, options);
  }
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function displayFileSummary(report: any, threshold: number) {
  const grade = report.summary.overallGrade;
  const score = report.summary.qualityScore;
  const risk = report.summary.riskLevel;

  console.log(chalk.bold(`File: ${path.basename(report.filePath)}`));
  console.log();

  // Grade with color
  const gradeColor = getGradeColor(grade);
  console.log(`Grade: ${chalk[gradeColor].bold(grade)}`);

  // Score with color
  const scoreColor = getScoreColor(score);
  console.log(`Quality Score: ${chalk[scoreColor](score.toFixed(1))}/100`);

  // Risk with color
  const riskColor = getRiskColor(risk);
  console.log(`Risk Level: ${chalk[riskColor](risk.toUpperCase())}`);

  console.log();
  console.log(`Complexity: ${report.complexity.averageComplexity.toFixed(1)} (max: ${report.complexity.maxComplexity})`);
  console.log(`Maintainability: ${report.maintainability.maintainabilityIndex.toFixed(1)}/100`);
  console.log(`Tech Debt: ${report.summary.technicalDebtHours.toFixed(1)} hours`);

  // Show pass/fail based on threshold
  if (score < threshold) {
    console.log();
    console.log(chalk.red.bold(`✗ FAILED (score ${score.toFixed(1)} < threshold ${threshold})`));
  } else {
    console.log();
    console.log(chalk.green.bold(`✓ PASSED (score ${score.toFixed(1)} >= threshold ${threshold})`));
  }
}

function displayProjectSummary(
  projectReport: any,
  filteredReports: any[],
  threshold: number,
  topN: number
) {
  const metrics = projectReport.aggregateMetrics;

  console.log(chalk.bold.underline('\nProject Quality Summary\n'));

  console.log(`Files Analyzed: ${chalk.bold(metrics.totalFiles)}`);
  console.log(`Average Quality Score: ${chalk.bold(metrics.averageQualityScore.toFixed(1))}/100`);
  console.log(`Average Complexity: ${chalk.bold(metrics.averageComplexity.toFixed(1))}`);
  console.log(`Total Tech Debt: ${chalk.bold(metrics.totalTechnicalDebtHours.toFixed(1))} hours`);

  // Grade distribution
  console.log(chalk.bold.underline('\nGrade Distribution:\n'));
  const grades = ['A', 'B', 'C', 'D', 'F'];
  for (const grade of grades) {
    const count = metrics.gradeDistribution[grade] || 0;
    const percentage = (count / metrics.totalFiles * 100).toFixed(1);
    const color = getGradeColor(grade);
    const bar = '█'.repeat(Math.floor(count / metrics.totalFiles * 50));
    console.log(`  ${chalk[color](grade)}: ${count} files (${percentage}%) ${bar}`);
  }

  // Risk distribution
  console.log(chalk.bold.underline('\nRisk Distribution:\n'));
  const risks = ['low', 'medium', 'high', 'critical'];
  for (const risk of risks) {
    const count = metrics.riskDistribution[risk] || 0;
    const percentage = (count / metrics.totalFiles * 100).toFixed(1);
    const color = getRiskColor(risk);
    const bar = '█'.repeat(Math.floor(count / metrics.totalFiles * 50));
    console.log(`  ${chalk[color](risk.toUpperCase())}: ${count} files (${percentage}%) ${bar}`);
  }

  // Top problematic files
  if (filteredReports.length > 0) {
    displayTopProblematicFiles(filteredReports.slice(0, topN), threshold);
  }

  // Overall pass/fail
  console.log();
  if (metrics.averageQualityScore < threshold) {
    console.log(chalk.red.bold(`✗ PROJECT FAILED (avg score ${metrics.averageQualityScore.toFixed(1)} < threshold ${threshold})`));
  } else {
    console.log(chalk.green.bold(`✓ PROJECT PASSED (avg score ${metrics.averageQualityScore.toFixed(1)} >= threshold ${threshold})`));
  }
}

function displayTopProblematicFiles(reports: any[], threshold: number) {
  console.log(chalk.bold.underline(`\nTop Problematic Files:\n`));

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const filename = path.basename(report.filePath);
    const grade = report.summary.overallGrade;
    const score = report.summary.qualityScore;
    const debt = report.summary.technicalDebtHours;
    const risk = report.summary.riskLevel;

    const gradeColor = getGradeColor(grade);
    const scoreColor = getScoreColor(score);
    const riskColor = getRiskColor(risk);

    console.log(`${i + 1}. ${chalk.bold(filename)}`);
    console.log(`   Grade: ${chalk[gradeColor](grade)}  Score: ${chalk[scoreColor](score.toFixed(1))}  Debt: ${debt.toFixed(1)}h  Risk: ${chalk[riskColor](risk.toUpperCase())}`);
    console.log(`   Path: ${chalk.gray(report.filePath)}`);
    console.log();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function detectLanguage(filePath: string): Language | null {
  const ext = path.extname(filePath).toLowerCase();

  const extensionMap: Record<string, Language> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.java': 'java',
    '.cs': 'csharp',
    '.php': 'php',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.ml': 'ocaml',
    '.mli': 'ocaml',
  };

  return extensionMap[ext] || null;
}

function getGradeColor(grade: string): 'green' | 'blue' | 'yellow' | 'red' {
  switch (grade) {
    case 'A': return 'green';
    case 'B': return 'blue';
    case 'C': return 'yellow';
    case 'D':
    case 'F': return 'red';
    default: return 'yellow';
  }
}

function getScoreColor(score: number): 'green' | 'blue' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'yellow';
  return 'red';
}

function getRiskColor(risk: string): 'green' | 'yellow' | 'red' | 'magenta' {
  switch (risk) {
    case 'low': return 'green';
    case 'medium': return 'yellow';
    case 'high': return 'red';
    case 'critical': return 'magenta';
    default: return 'yellow';
  }
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

async function exportReport(
  projectReport: any,
  filteredReports: any[],
  options: any
): Promise<void> {
  const exportService = new ExportService();

  // Convert project report to export format
  const exportReport: ExportQualityReport = convertToExportFormat(projectReport, filteredReports);

  // Determine output path
  let outputPath = options.output;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = path.join(process.cwd(), `quality-report-${timestamp}.${options.export}`);
  }

  try {
    console.log(chalk.blue(`\nExporting report as ${options.export.toUpperCase()}...`));

    const result = await exportService.export(exportReport, {
      format: options.export,
      outputPath,
      includeDetails: true,
      includeCharts: false,
    });

    console.log(chalk.green(`✓ Report exported successfully`));
    console.log(chalk.gray(`  Location: ${outputPath}`));
    console.log(chalk.gray(`  Size: ${(result.size / 1024).toFixed(2)} KB`));
  } catch (error) {
    console.error(chalk.red('Error exporting report:'), error);
    process.exit(1);
  }
}

function convertToExportFormat(projectReport: any, filteredReports: any[]): ExportQualityReport {
  const metrics = projectReport.aggregateMetrics;

  return {
    summary: {
      totalFiles: metrics.totalFiles,
      averageComplexity: metrics.averageComplexity,
      maintainabilityScore: metrics.averageQualityScore,
      codeSmellCount: filteredReports.reduce((sum, r) => sum + (r.codeSmells?.length || 0), 0),
      analysisDate: Date.now(),
    },
    files: filteredReports.map((report: any) => ({
      filePath: report.filePath,
      language: report.language || 'unknown',
      complexity: report.complexity?.averageComplexity || 0,
      maintainability: report.maintainability?.maintainabilityIndex || 0,
      linesOfCode: report.complexity?.totalLines || 0,
      codeSmells: report.codeSmells?.length || 0,
    })),
    codeSmells: filteredReports.flatMap((report: any) =>
      (report.codeSmells || []).map((smell: any) => ({
        type: smell.type || 'UNKNOWN',
        severity: smell.severity || 'medium',
        filePath: report.filePath,
        line: smell.line || 0,
        message: smell.message || '',
        suggestion: smell.suggestion,
      }))
    ),
    metrics: {
      complexityDistribution: {
        low: metrics.complexityDistribution?.low || 0,
        medium: metrics.complexityDistribution?.medium || 0,
        high: metrics.complexityDistribution?.high || 0,
      },
      maintainabilityDistribution: {
        excellent: metrics.gradeDistribution?.A || 0,
        good: metrics.gradeDistribution?.B || 0,
        fair: metrics.gradeDistribution?.C || 0,
        poor: (metrics.gradeDistribution?.D || 0) + (metrics.gradeDistribution?.F || 0),
      },
      languageBreakdown: metrics.languageDistribution || {},
      codeSmellsByType: filteredReports
        .flatMap((r: any) => r.codeSmells || [])
        .reduce((acc: Record<string, number>, smell: any) => {
          const type = smell.type || 'UNKNOWN';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
    },
  };
}
