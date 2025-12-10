/**
 * Refactor Detector - Main detection engine
 * Orchestrates all detection rules and produces findings
 * @module core/refactor/refactor-detector
 * @version 12.7.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  RefactorConfig,
  RefactorFinding,
  RefactorType,
  RefactorSeverity,
  RefactorRule,
  RefactorIgnoreState,
} from './types.js';

// Import individual detectors
import { DUPLICATION_RULES, detectDuplication } from './detectors/duplication-detector.js';
import { READABILITY_RULES, detectReadability } from './detectors/readability-detector.js';
import { PERFORMANCE_RULES, detectPerformance } from './detectors/performance-detector.js';
import { HARDCODE_RULES, detectHardcode } from './detectors/hardcode-detector.js';
import { NAMING_RULES, detectNaming } from './detectors/naming-detector.js';
import { CONDITIONAL_RULES, detectConditionals } from './detectors/conditionals-detector.js';
import { DEAD_CODE_RULES, detectDeadCode } from './detectors/dead-code-detector.js';
import { TYPE_SAFETY_RULES, detectTypeSafety } from './detectors/type-safety-detector.js';

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

// ============================================================================
// RefactorDetector Class
// ============================================================================

export class RefactorDetector {
  private config: RefactorConfig;
  private rules: Map<RefactorType, RefactorRule[]>;

  constructor(config: RefactorConfig) {
    this.config = config;
    this.rules = this.initializeRules();
  }

  /**
   * Initialize all detection rules based on focus areas
   */
  private initializeRules(): Map<RefactorType, RefactorRule[]> {
    const rules = new Map<RefactorType, RefactorRule[]>();

    for (const focusArea of this.config.focusAreas) {
      switch (focusArea) {
        case 'duplication':
          rules.set('duplication', DUPLICATION_RULES);
          break;
        case 'readability':
          rules.set('readability', READABILITY_RULES);
          break;
        case 'performance':
          rules.set('performance', PERFORMANCE_RULES);
          break;
        case 'hardcoded_values':
          rules.set('hardcoded_values', HARDCODE_RULES);
          break;
        case 'naming':
          rules.set('naming', NAMING_RULES);
          break;
        case 'conditionals':
          rules.set('conditionals', CONDITIONAL_RULES);
          break;
        case 'dead_code':
          rules.set('dead_code', DEAD_CODE_RULES);
          break;
        case 'type_safety':
          rules.set('type_safety', TYPE_SAFETY_RULES);
          break;
      }
    }

    return rules;
  }

  /**
   * Scan a directory or file for refactoring opportunities
   */
  async scan(rootDir: string, fileFilter?: string[]): Promise<RefactorFinding[]> {
    const findings: RefactorFinding[] = [];
    const filesToScan = fileFilter || (await this.getFilesToScan(rootDir));

    for (const filePath of filesToScan) {
      if (!fs.existsSync(filePath)) continue;

      const ext = path.extname(filePath);
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileFindings = await this.scanFile(filePath, content);
        findings.push(...fileFindings);

        // Check limit
        if (findings.length >= this.config.maxFindings) {
          break;
        }
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    // Sort by severity and confidence
    return this.sortFindings(findings).slice(0, this.config.maxFindings);
  }

  /**
   * Scan a single file for refactoring opportunities
   */
  async scanFile(filePath: string, content: string): Promise<RefactorFinding[]> {
    const findings: RefactorFinding[] = [];
    const lines = content.split('\n');
    const ignoreState = this.parseIgnoreComments(lines);

    // Run each detector based on focus areas
    for (const focusArea of this.config.focusAreas) {
      // Skip LLM-required detectors if --no-llm mode
      if (!this.config.useLLMForDetection) {
        // Only run static-capable detectors
        if (!this.isStaticCapable(focusArea)) {
          continue;
        }
      }

      const detectorFindings = await this.runDetector(focusArea, filePath, content, lines, ignoreState);
      findings.push(...detectorFindings);
    }

    return findings;
  }

  /**
   * Check if a focus area can run in static-only mode
   */
  private isStaticCapable(focusArea: RefactorType): boolean {
    const staticCapable: RefactorType[] = [
      'dead_code',
      'type_safety',
      'conditionals',
      'hardcoded_values',
      'naming', // Partial - convention checking only
      'duplication', // Partial - clone detection only
      'readability', // Partial - metrics only
      'performance', // Partial - patterns only
    ];
    return staticCapable.includes(focusArea);
  }

  /**
   * Run a specific detector
   */
  private async runDetector(
    focusArea: RefactorType,
    filePath: string,
    content: string,
    lines: string[],
    ignoreState: RefactorIgnoreState
  ): Promise<RefactorFinding[]> {
    const findings: RefactorFinding[] = [];

    switch (focusArea) {
      case 'duplication':
        findings.push(...detectDuplication(filePath, content, lines, ignoreState, this.config));
        break;
      case 'readability':
        findings.push(...detectReadability(filePath, content, lines, ignoreState, this.config));
        break;
      case 'performance':
        findings.push(...detectPerformance(filePath, content, lines, ignoreState, this.config));
        break;
      case 'hardcoded_values':
        findings.push(...detectHardcode(filePath, content, lines, ignoreState, this.config));
        break;
      case 'naming':
        findings.push(...detectNaming(filePath, content, lines, ignoreState, this.config));
        break;
      case 'conditionals':
        findings.push(...detectConditionals(filePath, content, lines, ignoreState, this.config));
        break;
      case 'dead_code':
        findings.push(...await detectDeadCode(filePath, content, lines, ignoreState, this.config));
        break;
      case 'type_safety':
        findings.push(...detectTypeSafety(filePath, content, lines, ignoreState, this.config));
        break;
    }

    // Filter by confidence and severity
    return findings.filter(
      (f) =>
        f.confidence >= this.config.minConfidence &&
        this.severityMeetsThreshold(f.severity, this.config.severityThreshold)
    );
  }

  /**
   * Parse ignore comments from code
   * Supports:
   * - // ax-refactor-ignore
   * - // ax-refactor-ignore duplication
   * - // ax-refactor-ignore-start ... // ax-refactor-ignore-end
   */
  private parseIgnoreComments(lines: string[]): RefactorIgnoreState {
    const state: RefactorIgnoreState = {
      ignoreAllLines: new Set(),
      ignoreTypeLines: new Map(),
      ignoreBlocks: [],
    };

    let blockStart: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const lineNum = i + 1; // 1-indexed

      // Block ignore
      if (/\/\/\s*ax-refactor-ignore-start/.test(line)) {
        blockStart = lineNum;
        continue;
      }

      if (/\/\/\s*ax-refactor-ignore-end/.test(line)) {
        if (blockStart !== null) {
          state.ignoreBlocks.push({ start: blockStart, end: lineNum });
          blockStart = null;
        }
        continue;
      }

      // Line ignore
      const ignoreMatch = line.match(/\/\/\s*ax-refactor-ignore(?:\s+(\w+))?/);
      if (ignoreMatch) {
        const ignoreType = ignoreMatch[1] as RefactorType | undefined;

        if (ignoreType) {
          // Type-specific ignore
          if (!state.ignoreTypeLines.has(lineNum + 1)) {
            state.ignoreTypeLines.set(lineNum + 1, new Set());
          }
          state.ignoreTypeLines.get(lineNum + 1)?.add(ignoreType);
        } else {
          // Ignore all
          state.ignoreAllLines.add(lineNum + 1);
        }
      }
    }

    return state;
  }

  /**
   * Check if a line should be ignored
   */
  shouldIgnore(
    lineNumber: number,
    type: RefactorType,
    ignoreState: RefactorIgnoreState
  ): boolean {
    // Check all-ignore
    if (ignoreState.ignoreAllLines.has(lineNumber)) {
      return true;
    }

    // Check type-specific ignore
    const typeIgnores = ignoreState.ignoreTypeLines.get(lineNumber);
    if (typeIgnores?.has(type)) {
      return true;
    }

    // Check block ignores
    for (const block of ignoreState.ignoreBlocks) {
      if (lineNumber >= block.start && lineNumber <= block.end) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all files to scan in a directory
   */
  private async getFilesToScan(rootDir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Check exclusions
          if (this.config.excludePatterns.some((pattern) => fullPath.includes(pattern))) {
            continue;
          }

          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (SUPPORTED_EXTENSIONS.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    walk(rootDir);
    return files;
  }

  /**
   * Sort findings by severity and confidence
   */
  private sortFindings(findings: RefactorFinding[]): RefactorFinding[] {
    const severityOrder: Record<RefactorSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return findings.sort((a, b) => {
      // First by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by confidence
      return b.confidence - a.confidence;
    });
  }

  /**
   * Check if severity meets threshold
   */
  private severityMeetsThreshold(
    severity: RefactorSeverity,
    threshold: RefactorSeverity
  ): boolean {
    const severityOrder: Record<RefactorSeverity, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };

    return severityOrder[severity] >= severityOrder[threshold];
  }

  /**
   * Get all rules
   */
  getRules(): Map<RefactorType, RefactorRule[]> {
    return this.rules;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a finding object
 */
export function createFinding(
  file: string,
  lineStart: number,
  lineEnd: number,
  type: RefactorType,
  severity: RefactorSeverity,
  message: string,
  context: string,
  ruleId: string,
  confidence: number,
  detectionMethod: 'static' | 'llm' | 'hybrid' = 'static',
  suggestedFix?: string,
  estimatedImpact?: RefactorFinding['estimatedImpact']
): RefactorFinding {
  return {
    id: randomUUID(),
    file,
    lineStart,
    lineEnd,
    type,
    severity,
    message,
    context,
    suggestedFix,
    estimatedImpact: estimatedImpact || {},
    confidence,
    detectionMethod,
    ruleId,
    detectedAt: new Date().toISOString(),
  };
}

export default RefactorDetector;
