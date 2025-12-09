/**
 * Bug Detector
 *
 * Detects bugs in the codebase using multiple strategies:
 * - Layer 1: Static regex-based detection (fast, <10s)
 * - Layer 2: AST-based detection (medium, <60s)
 * - Layer 3: Test-based detection (slow, <5min)
 *
 * Supports ignore comments:
 * - // ax-ignore - Ignore all bugs on next line
 * - // ax-ignore timer_leak - Ignore specific bug type
 * - // ax-ignore-start ... // ax-ignore-end - Ignore block
 *
 * @module core/bugfix/bug-detector
 * @since v12.4.0
 * @updated v12.6.0 - Added ignore comments support
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, relative, isAbsolute } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import type {
  BugFinding,
  BugType,
  BugSeverity,
  DetectionRule,
  BugfixConfig
} from './types.js';

/**
 * Patterns for ignore comments
 */
const IGNORE_PATTERNS = {
  // Match: // ax-ignore or // ax-ignore timer_leak
  nextLine: /\/\/\s*ax-ignore(?:\s+(\w+))?\s*$/,
  // Match: // ax-ignore-start
  blockStart: /\/\/\s*ax-ignore-start\s*$/,
  // Match: // ax-ignore-end
  blockEnd: /\/\/\s*ax-ignore-end\s*$/
};

/**
 * Default detection rules for common bug patterns
 */
const DEFAULT_DETECTION_RULES: DetectionRule[] = [
  // Timer leak: setInterval without .unref()
  // v12.6.0: Increased withinLines from 5 to 50 to handle multi-line callbacks
  // where .unref() is called after the closing brace (some callbacks are 35+ lines)
  // NOTE: This is a workaround - proper fix would use AST-based detection
  {
    id: 'timer-leak-interval',
    type: 'timer_leak',
    name: 'setInterval without unref',
    description: 'setInterval() without .unref() blocks process exit',
    pattern: 'setInterval\\s*\\(',
    negativePattern: '\\.unref\\s*\\(\\)',
    withinLines: 50,
    confidence: 0.9,
    severity: 'high',
    autoFixable: true,
    fixTemplate: 'add_unref',
    fileExtensions: ['.ts', '.js', '.mts', '.mjs']
  },
  // Timer leak: setTimeout in promise without cleanup
  {
    id: 'timer-leak-timeout-promise',
    type: 'promise_timeout_leak',
    name: 'setTimeout in Promise without cleanup',
    description: 'setTimeout in Promise should be cleared in finally block',
    pattern: 'new\\s+Promise[^}]*setTimeout\\s*\\(',
    negativePattern: 'finally|clearTimeout',
    withinLines: 20,
    confidence: 0.7,
    severity: 'medium',
    autoFixable: false, // Complex, needs manual review
    fileExtensions: ['.ts', '.js', '.mts', '.mjs']
  },
  // Missing destroy: EventEmitter without destroy method
  // v12.6.0: Increased withinLines from 100 to 800 to scan entire class
  // Classes can be large - need to check the whole class for destroy() method
  {
    id: 'missing-destroy-eventemitter',
    type: 'missing_destroy',
    name: 'EventEmitter without destroy',
    description: 'Classes extending EventEmitter should have destroy() method',
    pattern: 'class\\s+\\w+\\s+extends\\s+(?:EventEmitter|DisposableEventEmitter)',
    negativePattern: 'destroy\\s*\\(\\s*\\)',
    withinLines: 800,
    confidence: 0.85,
    severity: 'high',
    autoFixable: true,
    fixTemplate: 'add_destroy_method',
    fileExtensions: ['.ts', '.js', '.mts', '.mjs']
  },
  // Event leak: .on() without corresponding cleanup
  {
    id: 'event-leak-on',
    type: 'event_leak',
    name: 'Event listener without cleanup',
    description: '.on() or .addListener() without corresponding .off() or .removeListener()',
    pattern: '\\.(on|addListener)\\s*\\([\'"`]\\w+[\'"`]',
    negativePattern: '\\.(off|removeListener|removeAllListeners)\\s*\\(',
    withinLines: 50,
    confidence: 0.6, // Lower confidence - may have false positives
    severity: 'medium',
    autoFixable: false,
    fileExtensions: ['.ts', '.js', '.mts', '.mjs']
  },
  // Uncaught promise: Promise without catch
  {
    id: 'uncaught-promise',
    type: 'uncaught_promise',
    name: 'Promise without error handling',
    description: 'Promise should have .catch() or be awaited in try/catch',
    pattern: 'new\\s+Promise\\s*\\([^)]+\\)',
    negativePattern: '\\.catch\\s*\\(|try\\s*\\{',
    withinLines: 10,
    confidence: 0.5, // Low confidence - many false positives
    severity: 'low',
    autoFixable: false,
    fileExtensions: ['.ts', '.js', '.mts', '.mjs']
  }
];

/**
 * Ignore state for a file
 */
interface IgnoreState {
  /** Lines with next-line ignores: Map<lineNumber, bugType | '*'> */
  nextLineIgnores: Map<number, string>;
  /** Ranges of block ignores: Array<[startLine, endLine]> */
  blockIgnores: Array<[number, number]>;
}

/**
 * Bug Detector class
 *
 * Scans codebase for bugs using configurable detection rules.
 */
export class BugDetector {
  private rules: DetectionRule[];
  private config: BugfixConfig;

  constructor(config: BugfixConfig, customRules?: DetectionRule[]) {
    this.config = config;
    this.rules = customRules || DEFAULT_DETECTION_RULES;

    // Filter rules by configured bug types (defensive check for undefined)
    if (config.bugTypes && config.bugTypes.length > 0) {
      this.rules = this.rules.filter(rule =>
        config.bugTypes.includes(rule.type)
      );
    }

    logger.debug('BugDetector initialized', {
      ruleCount: this.rules.length,
      bugTypes: config.bugTypes,
      scope: config.scope
    });
  }

  /**
   * Parse ignore comments from file lines
   *
   * Supports:
   * - // ax-ignore - Ignore all bugs on next line
   * - // ax-ignore timer_leak - Ignore specific bug type on next line
   * - // ax-ignore-start ... // ax-ignore-end - Ignore block
   */
  private parseIgnoreComments(lines: string[]): IgnoreState {
    const state: IgnoreState = {
      nextLineIgnores: new Map(),
      blockIgnores: []
    };

    let blockStartLine: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const lineNumber = i + 1; // 1-based line numbers

      // Check for block start
      if (IGNORE_PATTERNS.blockStart.test(line)) {
        blockStartLine = lineNumber;
        continue;
      }

      // Check for block end
      if (IGNORE_PATTERNS.blockEnd.test(line)) {
        if (blockStartLine !== null) {
          state.blockIgnores.push([blockStartLine, lineNumber]);
          blockStartLine = null;
        }
        continue;
      }

      // Check for next-line ignore
      const nextLineMatch = line.match(IGNORE_PATTERNS.nextLine);
      if (nextLineMatch) {
        // The ignore applies to the NEXT line
        const bugType = nextLineMatch[1] || '*'; // '*' means ignore all
        state.nextLineIgnores.set(lineNumber + 1, bugType);
      }
    }

    // Handle unclosed block (ignore to end of file)
    if (blockStartLine !== null) {
      state.blockIgnores.push([blockStartLine, lines.length]);
    }

    return state;
  }

  /**
   * Check if a line should be ignored for a specific bug type
   */
  private shouldIgnore(lineNumber: number, bugType: BugType, ignoreState: IgnoreState): boolean {
    // Check next-line ignores
    const nextLineIgnore = ignoreState.nextLineIgnores.get(lineNumber);
    if (nextLineIgnore) {
      if (nextLineIgnore === '*' || nextLineIgnore === bugType) {
        return true;
      }
    }

    // Check block ignores
    for (const [start, end] of ignoreState.blockIgnores) {
      if (lineNumber >= start && lineNumber <= end) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan codebase for bugs
   *
   * @param rootDir - Root directory to scan
   * @param fileFilter - Optional list of files to scan (for git-aware scanning)
   * @returns Array of bug findings
   */
  async scan(rootDir: string, fileFilter?: string[]): Promise<BugFinding[]> {
    const startTime = Date.now();
    const findings: BugFinding[] = [];

    logger.info('Starting bug scan', {
      rootDir,
      scope: this.config.scope,
      ruleCount: this.rules.length,
      fileFilter: fileFilter ? fileFilter.length : undefined
    });

    // Get files to scan
    let files: string[];

    if (fileFilter && fileFilter.length > 0) {
      // Use provided file filter (git-aware scanning)
      // BUG FIX: Use isAbsolute() instead of startsWith('/') for cross-platform support
      files = fileFilter
        .map(f => isAbsolute(f) ? f : join(rootDir, f))
        .filter(f => {
          const ext = extname(f);
          return ['.ts', '.js', '.mts', '.mjs', '.tsx', '.jsx'].includes(ext);
        })
        .filter(f => !this.isExcluded(relative(rootDir, f)));
    } else {
      // Determine scan directory
      const scanDir = this.config.scope
        ? join(rootDir, this.config.scope)
        : rootDir;

      // Get all files to scan
      files = await this.getFilesToScan(scanDir, rootDir);
    }

    logger.debug('Files to scan', { count: files.length });

    // Scan each file
    for (const file of files) {
      try {
        const fileFindings = await this.scanFile(file, rootDir);
        findings.push(...fileFindings);
      } catch (error) {
        logger.warn('Error scanning file', {
          file,
          error: (error as Error).message
        });
      }
    }

    // Filter by severity threshold
    const filteredFindings = this.filterBySeverity(findings);

    // Sort by severity (highest first) then by confidence
    filteredFindings.sort((a, b) => {
      const severityOrder: Record<BugSeverity, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1
      };

      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      return b.confidence - a.confidence;
    });

    const duration = Date.now() - startTime;

    logger.info('Bug scan complete', {
      totalFindings: filteredFindings.length,
      filesScanned: files.length,
      durationMs: duration
    });

    return filteredFindings;
  }

  /**
   * Scan a single file for bugs
   */
  private async scanFile(filePath: string, rootDir: string): Promise<BugFinding[]> {
    const findings: BugFinding[] = [];

    // Read file content
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = relative(rootDir, filePath);

    // Parse ignore comments
    const ignoreState = this.parseIgnoreComments(lines);

    // Apply each rule
    for (const rule of this.rules) {
      // Check file extension
      if (rule.fileExtensions && rule.fileExtensions.length > 0) {
        const ext = extname(filePath);
        if (!rule.fileExtensions.includes(ext)) {
          continue;
        }
      }

      // Apply regex-based detection
      const ruleFindings = this.applyRule(rule, content, lines, relativePath, ignoreState);
      findings.push(...ruleFindings);
    }

    return findings;
  }

  /**
   * Apply a detection rule to file content
   */
  private applyRule(
    rule: DetectionRule,
    content: string,
    lines: string[],
    filePath: string,
    ignoreState: IgnoreState
  ): BugFinding[] {
    const findings: BugFinding[] = [];

    if (!rule.pattern) {
      return findings;
    }

    try {
      const regex = new RegExp(rule.pattern, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        // Find the line number of this match
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        // Check if this line should be ignored
        if (this.shouldIgnore(lineNumber, rule.type, ignoreState)) {
          logger.debug('Bug ignored by comment', {
            file: filePath,
            line: lineNumber,
            type: rule.type
          });
          continue;
        }

        // Check negative pattern (within specified lines)
        if (rule.negativePattern) {
          const withinLines = rule.withinLines || 5;
          const startLine = Math.max(0, lineNumber - 1);
          const endLine = Math.min(lines.length, lineNumber + withinLines);
          const contextLines = lines.slice(startLine, endLine).join('\n');

          const negativeRegex = new RegExp(rule.negativePattern);
          if (negativeRegex.test(contextLines)) {
            // Negative pattern found - not a bug
            continue;
          }
        }

        // Extract context (surrounding lines)
        const contextStart = Math.max(0, lineNumber - 3);
        const contextEnd = Math.min(lines.length, lineNumber + 3);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        // Create finding
        const finding: BugFinding = {
          id: randomUUID(),
          file: filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber + (rule.withinLines ? Math.min(rule.withinLines, 5) : 1),
          type: rule.type,
          severity: rule.severity,
          message: rule.description,
          context,
          fixStrategy: rule.autoFixable ? rule.fixTemplate : undefined,
          confidence: rule.confidence,
          detectionMethod: 'regex',
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            matchedText: match[0].substring(0, 100)
          },
          detectedAt: new Date().toISOString()
        };

        findings.push(finding);

        logger.debug('Bug detected', {
          file: filePath,
          line: lineNumber,
          type: rule.type,
          rule: rule.id
        });
      }
    } catch (error) {
      logger.warn('Rule application failed', {
        ruleId: rule.id,
        file: filePath,
        error: (error as Error).message
      });
    }

    return findings;
  }

  /**
   * Get all files to scan
   */
  private async getFilesToScan(scanDir: string, rootDir: string): Promise<string[]> {
    const files: string[] = [];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const relativePath = relative(rootDir, fullPath);

          // Skip excluded patterns
          if (this.isExcluded(relativePath)) {
            continue;
          }

          const stats = await stat(fullPath);

          if (stats.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (stats.isFile()) {
            // Check if file has a supported extension
            const ext = extname(fullPath);
            if (['.ts', '.js', '.mts', '.mjs', '.tsx', '.jsx'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn('Error reading directory', {
          dir,
          error: (error as Error).message
        });
      }
    };

    await scanDirectory(scanDir);
    return files;
  }

  /**
   * Check if a path should be excluded
   */
  private isExcluded(relativePath: string): boolean {
    // Default exclusions
    const defaultExclusions = [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '.nyc_output',
      '*.test.ts',
      '*.spec.ts',
      '__tests__',
      '__mocks__'
    ];

    const exclusions = [...defaultExclusions, ...(this.config.excludePatterns || [])];

    for (const pattern of exclusions) {
      // Simple glob matching
      if (pattern.includes('*')) {
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(regexPattern);
        if (regex.test(relativePath)) {
          return true;
        }
      } else {
        if (relativePath.includes(pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Filter findings by severity threshold
   */
  private filterBySeverity(findings: BugFinding[]): BugFinding[] {
    const severityOrder: Record<BugSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    const threshold = severityOrder[this.config.severityThreshold];

    return findings.filter(finding =>
      severityOrder[finding.severity] >= threshold
    );
  }

  /**
   * Get detection rules
   */
  getRules(): DetectionRule[] {
    return [...this.rules];
  }

  /**
   * Add a custom detection rule
   */
  addRule(rule: DetectionRule): void {
    this.rules.push(rule);
    logger.debug('Detection rule added', { ruleId: rule.id });
  }

  /**
   * Load rules from YAML file
   */
  async loadRulesFromFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const yaml = await import('js-yaml');
      const parsed = yaml.load(content) as { rules?: DetectionRule[] };

      if (parsed.rules && Array.isArray(parsed.rules)) {
        for (const rule of parsed.rules) {
          this.addRule(rule);
        }
        logger.info('Detection rules loaded from file', {
          filePath,
          ruleCount: parsed.rules.length
        });
      }
    } catch (error) {
      logger.warn('Failed to load detection rules', {
        filePath,
        error: (error as Error).message
      });
    }
  }
}

/**
 * Create default bugfix configuration
 *
 * v12.6.0: Default maxDurationMinutes set to 45 minutes.
 * Users can stop the process anytime via MCP cancellation.
 */
export function createDefaultBugfixConfig(overrides?: Partial<BugfixConfig>): BugfixConfig {
  return {
    maxBugs: 10,
    maxDurationMinutes: 45,
    maxTokens: 500000,
    maxRetriesPerBug: 3,
    minConfidence: 0.7,
    bugTypes: ['timer_leak', 'missing_destroy', 'promise_timeout_leak'],
    severityThreshold: 'medium',
    excludePatterns: [],
    dryRun: false,
    requireTests: true,
    requireTypecheck: true,
    generateTests: false,
    verbose: false,
    ...overrides
  };
}
