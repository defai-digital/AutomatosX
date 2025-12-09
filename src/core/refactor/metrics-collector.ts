/**
 * Metrics Collector for the Refactor Tool
 * Collects code metrics before/after refactoring to measure improvement
 * @module core/refactor/metrics-collector
 * @version 12.7.0
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RefactorMetrics, MetricImprovement } from './types.js';

// ============================================================================
// Metric Calculation Utilities
// ============================================================================

/**
 * Calculate cyclomatic complexity for a function/method
 * McCabe complexity = E - N + 2P where E=edges, N=nodes, P=connected components
 * Simplified: count decision points + 1
 */
function calculateCyclomaticComplexity(code: string): number {
  // Count decision points
  const decisionPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /\bcase\s+[^:]+:/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g, // Ternary
    /&&/g,
    /\|\|/g,
    /\?\?/g, // Nullish coalescing
  ];

  let complexity = 1; // Base complexity

  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculate cognitive complexity (SonarQube-style)
 * Penalizes nested control flow structures
 */
function calculateCognitiveComplexity(code: string): number {
  let complexity = 0;
  let nestingLevel = 0;
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Track nesting
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    // Check for control flow structures (add nesting level as penalty)
    if (/\b(if|else\s+if|while|for|switch)\s*\(/.test(trimmed)) {
      complexity += 1 + nestingLevel;
    }

    // Logical operators add complexity but not nesting penalty
    const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
    complexity += logicalOps;

    // Ternary operators
    const ternaries = (trimmed.match(/\?[^:]*:/g) || []).length;
    complexity += ternaries * (1 + nestingLevel);

    // Update nesting level
    nestingLevel += openBraces - closeBraces;
    nestingLevel = Math.max(0, nestingLevel);
  }

  return complexity;
}

/**
 * Calculate maximum nesting depth
 */
function calculateNestingDepth(code: string): { max: number; avg: number } {
  let currentDepth = 0;
  let maxDepth = 0;
  let totalDepth = 0;
  let depthMeasurements = 0;

  const lines = code.split('\n');

  for (const line of lines) {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;

    currentDepth += openBraces;
    maxDepth = Math.max(maxDepth, currentDepth);

    if (openBraces > 0 || closeBraces > 0) {
      totalDepth += currentDepth;
      depthMeasurements++;
    }

    currentDepth -= closeBraces;
    currentDepth = Math.max(0, currentDepth);
  }

  return {
    max: maxDepth,
    avg: depthMeasurements > 0 ? totalDepth / depthMeasurements : 0,
  };
}

/**
 * Calculate maintainability index (0-100)
 * Based on Halstead Volume, Cyclomatic Complexity, and Lines of Code
 * Simplified formula: 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
 */
function calculateMaintainabilityIndex(
  linesOfCode: number,
  cyclomaticComplexity: number
): number {
  // Simplified Halstead Volume estimate based on code length
  const estimatedHalsteadVolume = Math.max(1, linesOfCode * 5);

  const mi =
    171 -
    5.2 * Math.log(estimatedHalsteadVolume) -
    0.23 * cyclomaticComplexity -
    16.2 * Math.log(Math.max(1, linesOfCode));

  // Normalize to 0-100 scale
  return Math.max(0, Math.min(100, mi));
}

/**
 * Count functions and classes in code
 */
function countFunctionsAndClasses(code: string): {
  functions: number;
  classes: number;
} {
  const functionPatterns = [
    /\bfunction\s+\w+/g,
    /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /\blet\s+\w+\s*=\s*(?:async\s*)?\(/g,
    /\b\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /\b(?:async\s+)?(?:get|set)\s+\w+\s*\(/g,
    /\b\w+\s*\([^)]*\)\s*{/g, // Method shorthand
  ];

  const classPattern = /\bclass\s+\w+/g;

  let functionCount = 0;
  for (const pattern of functionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      functionCount += matches.length;
    }
  }

  const classMatches = code.match(classPattern);
  const classCount = classMatches ? classMatches.length : 0;

  // Deduplicate (rough estimate)
  return {
    functions: Math.ceil(functionCount * 0.7), // Account for overlapping patterns
    classes: classCount,
  };
}

/**
 * Count TypeScript any types
 */
function countAnyTypes(code: string): number {
  const anyPatterns = [
    /:\s*any\b/g,
    /as\s+any\b/g,
    /<any>/g,
    /\bany\[\]/g,
  ];

  let count = 0;
  for (const pattern of anyPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Count unused imports (basic detection)
 */
/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countUnusedImports(code: string): number {
  const importMatches = code.match(/import\s+{([^}]+)}\s+from/g);
  if (!importMatches) return 0;

  let unusedCount = 0;
  const codeWithoutImports = code.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g, '');

  for (const importMatch of importMatches) {
    const namedImports = importMatch.match(/{([^}]+)}/);
    const namedImportContent = namedImports?.[1];
    if (namedImportContent) {
      const names = namedImportContent
        .split(',')
        .map((n) => {
          // Handle "type Foo" imports by extracting just the name
          const trimmed = n.trim();
          const withoutType = trimmed.replace(/^type\s+/, '');
          return withoutType.split(/\s+as\s+/).pop()?.trim() ?? '';
        })
        .filter((name) => name.length > 0 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name));
      for (const name of names) {
        try {
          if (!new RegExp(`\\b${escapeRegex(name)}\\b`).test(codeWithoutImports)) {
            unusedCount++;
          }
        } catch {
          // Skip invalid regex patterns
        }
      }
    }
  }

  return unusedCount;
}

/**
 * Detect duplicate code blocks (token-based, simplified)
 */
function calculateDuplicationPercentage(code: string): number {
  const lines = code.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 10) return 0;

  // Normalize lines for comparison
  const normalized = lines.map((l) =>
    l.trim().replace(/\s+/g, ' ').replace(/['"`][^'"`]*['"`]/g, 'STRING')
  );

  // Look for repeated sequences of 3+ lines
  const blockSize = 3;
  const blocks = new Map<string, number>();
  let duplicateLines = 0;

  for (let i = 0; i <= normalized.length - blockSize; i++) {
    const block = normalized.slice(i, i + blockSize).join('\n');
    const count = blocks.get(block) || 0;
    blocks.set(block, count + 1);
  }

  for (const [, count] of blocks) {
    if (count > 1) {
      duplicateLines += (count - 1) * blockSize;
    }
  }

  return Math.min(100, (duplicateLines / lines.length) * 100);
}

// ============================================================================
// MetricsCollector Class
// ============================================================================

export class MetricsCollector {
  private excludePatterns: string[];

  constructor(excludePatterns: string[] = ['node_modules', 'dist', '.git']) {
    this.excludePatterns = excludePatterns;
  }

  /**
   * Collect metrics for a directory or file
   */
  async collect(targetPath: string): Promise<RefactorMetrics> {
    const stats = fs.statSync(targetPath);
    let allCode = '';

    if (stats.isDirectory()) {
      allCode = await this.readDirectory(targetPath);
    } else {
      allCode = fs.readFileSync(targetPath, 'utf-8');
    }

    return this.analyzeCode(allCode);
  }

  /**
   * Collect metrics for specific files
   */
  async collectForFiles(files: string[]): Promise<RefactorMetrics> {
    let allCode = '';

    for (const file of files) {
      if (fs.existsSync(file)) {
        const ext = path.extname(file);
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
          allCode += fs.readFileSync(file, 'utf-8') + '\n';
        }
      }
    }

    return this.analyzeCode(allCode);
  }

  /**
   * Read all TypeScript/JavaScript files in a directory
   */
  private async readDirectory(dir: string): Promise<string> {
    let allCode = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Check exclusions
      if (this.excludePatterns.some((pattern) => entry.name.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        allCode += await this.readDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
          allCode += fs.readFileSync(fullPath, 'utf-8') + '\n';
        }
      }
    }

    return allCode;
  }

  /**
   * Analyze code and calculate metrics
   */
  private analyzeCode(code: string): RefactorMetrics {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
    const linesOfCode = nonEmptyLines.length;

    // Calculate per-function metrics
    const { functions, classes } = countFunctionsAndClasses(code);
    const cyclomatic = calculateCyclomaticComplexity(code);
    const cognitive = calculateCognitiveComplexity(code);
    const nesting = calculateNestingDepth(code);

    // Normalize complexity by function count
    const avgCyclomatic = functions > 0 ? cyclomatic / functions : cyclomatic;
    const avgCognitive = functions > 0 ? cognitive / functions : cognitive;

    return {
      linesOfCode,
      numberOfFunctions: functions,
      numberOfClasses: classes,
      avgCyclomaticComplexity: Math.round(avgCyclomatic * 100) / 100,
      maxCyclomaticComplexity: cyclomatic,
      avgCognitiveComplexity: Math.round(avgCognitive * 100) / 100,
      maxCognitiveComplexity: cognitive,
      duplicationPercentage: Math.round(calculateDuplicationPercentage(code) * 100) / 100,
      maintainabilityIndex: Math.round(calculateMaintainabilityIndex(linesOfCode, cyclomatic) * 100) / 100,
      maxNestingDepth: nesting.max,
      avgNestingDepth: Math.round(nesting.avg * 100) / 100,
      anyTypeCount: countAnyTypes(code),
      unusedExports: 0, // Requires full AST analysis
      unusedImports: countUnusedImports(code),
    };
  }

  /**
   * Compare metrics and calculate improvements
   */
  static compareMetrics(
    before: RefactorMetrics,
    after: RefactorMetrics,
    minImprovementThreshold: number = 0.1
  ): MetricImprovement[] {
    const improvements: MetricImprovement[] = [];

    const metricsToCompare: Array<{
      key: keyof RefactorMetrics;
      higherIsBetter: boolean;
    }> = [
      { key: 'linesOfCode', higherIsBetter: false },
      { key: 'avgCyclomaticComplexity', higherIsBetter: false },
      { key: 'maxCyclomaticComplexity', higherIsBetter: false },
      { key: 'avgCognitiveComplexity', higherIsBetter: false },
      { key: 'maxCognitiveComplexity', higherIsBetter: false },
      { key: 'duplicationPercentage', higherIsBetter: false },
      { key: 'maintainabilityIndex', higherIsBetter: true },
      { key: 'maxNestingDepth', higherIsBetter: false },
      { key: 'avgNestingDepth', higherIsBetter: false },
      { key: 'anyTypeCount', higherIsBetter: false },
      { key: 'unusedImports', higherIsBetter: false },
    ];

    for (const { key, higherIsBetter } of metricsToCompare) {
      const beforeVal = before[key];
      const afterVal = after[key];

      if (beforeVal === 0 && afterVal === 0) {
        continue;
      }

      let improvementPercent: number;
      if (beforeVal === 0) {
        improvementPercent = higherIsBetter ? 100 : -100;
      } else {
        const diff = afterVal - beforeVal;
        improvementPercent = (diff / Math.abs(beforeVal)) * 100;
        if (!higherIsBetter) {
          improvementPercent = -improvementPercent; // Invert for metrics where lower is better
        }
      }

      improvements.push({
        metric: key,
        before: beforeVal,
        after: afterVal,
        improvementPercent: Math.round(improvementPercent * 100) / 100,
        meetsThreshold: improvementPercent >= minImprovementThreshold * 100,
      });
    }

    return improvements;
  }

  /**
   * Check if overall metrics improved
   */
  static hasOverallImprovement(improvements: MetricImprovement[]): boolean {
    const positiveImprovements = improvements.filter((i) => i.improvementPercent > 0);
    const negativeImprovements = improvements.filter((i) => i.improvementPercent < 0);

    // Net positive improvement
    const totalPositive = positiveImprovements.reduce((sum, i) => sum + i.improvementPercent, 0);
    const totalNegative = Math.abs(negativeImprovements.reduce((sum, i) => sum + i.improvementPercent, 0));

    return totalPositive > totalNegative;
  }
}

export default MetricsCollector;
