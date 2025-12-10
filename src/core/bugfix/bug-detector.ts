/**
 * Bug Detector
 *
 * Detects bugs in the codebase using multiple strategies:
 * - Layer 1: Static regex-based detection (fast, <10s)
 * - Layer 2: AST-based detection (medium, <60s) - v12.8.0
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
 * @updated v12.8.0 - Added AST-based detection for missing_destroy (reduced false positives)
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, relative, isAbsolute } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../shared/logging/logger.js';
import { ASTAnalyzer, ALLOWLISTS, createASTAnalyzer } from './ast-analyzer.js';
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
  // Timer leak: setInterval without cleanup
  // v12.8.0: Now uses AST-based detection with variable tracking and destroy() analysis
  // This eliminates false positives from timers that are properly cleaned up
  {
    id: 'timer-leak-interval',
    type: 'timer_leak',
    name: 'setInterval without cleanup',
    description: 'setInterval() without clearInterval or .unref() may block process exit',
    pattern: 'setInterval\\s*\\(',
    // v12.8.0: negativePattern no longer used - AST handles cleanup detection
    negativePattern: undefined,
    withinLines: undefined,
    confidence: 0.92, // Higher confidence with AST-based detection
    severity: 'high',
    autoFixable: true,
    fixTemplate: 'add_unref',
    fileExtensions: ['.ts', '.js', '.mts', '.mjs'],
    // v12.8.0: Flag to use AST-based detection
    useAST: true
  },
  // Timer leak: setTimeout in promise without cleanup
  // v12.8.0: Now uses AST-based detection to identify safe sleep/delay patterns
  // This reduces false positives from simple utilities like sleep() or delay()
  {
    id: 'timer-leak-timeout-promise',
    type: 'promise_timeout_leak',
    name: 'setTimeout in Promise without cleanup',
    description: 'setTimeout in Promise should be cleared in finally block',
    pattern: 'new\\s+Promise[^}]*setTimeout\\s*\\(',
    negativePattern: 'finally|clearTimeout',
    withinLines: 20,
    confidence: 0.85, // Higher with AST-based detection
    severity: 'medium',
    autoFixable: false, // Complex, needs manual review
    fileExtensions: ['.ts', '.js', '.mts', '.mjs'],
    // v12.8.0: Flag to use AST-based detection
    useAST: true
  },
  // Missing destroy: EventEmitter without destroy method
  // v12.8.0: Now uses AST-based detection for accurate class boundary analysis
  // The regex pattern is kept as a pre-filter, but actual detection is done via AST
  // This eliminates false positives from large classes where destroy() is far from class declaration
  {
    id: 'missing-destroy-eventemitter',
    type: 'missing_destroy',
    name: 'EventEmitter without destroy',
    description: 'Classes extending EventEmitter should have destroy() method',
    pattern: 'class\\s+\\w+\\s+extends\\s+(?:EventEmitter|DisposableEventEmitter)',
    // v12.8.0: negativePattern no longer used - AST handles method detection
    negativePattern: undefined,
    withinLines: undefined,
    confidence: 0.95, // Higher confidence with AST-based detection
    severity: 'high',
    autoFixable: true,
    fixTemplate: 'add_destroy_method',
    fileExtensions: ['.ts', '.js', '.mts', '.mjs'],
    // v12.8.0: Flag to use AST-based detection
    useAST: true
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
 * v12.8.0: Added AST-based detection for improved accuracy.
 */
export class BugDetector {
  private rules: DetectionRule[];
  private config: BugfixConfig;
  private astAnalyzer: ASTAnalyzer;
  private astInitialized = false;

  constructor(config: BugfixConfig, customRules?: DetectionRule[]) {
    this.config = config;
    this.rules = customRules || DEFAULT_DETECTION_RULES;
    this.astAnalyzer = createASTAnalyzer();

    // Filter rules by configured bug types (defensive check for undefined)
    if (config.bugTypes && config.bugTypes.length > 0) {
      this.rules = this.rules.filter(rule =>
        config.bugTypes.includes(rule.type)
      );
    }

    logger.debug('BugDetector initialized', {
      ruleCount: this.rules.length,
      bugTypes: config.bugTypes,
      scope: config.scope,
      astEnabled: true
    });
  }

  /**
   * Initialize AST analyzer (lazy loading to avoid bundling issues)
   */
  private async initAST(): Promise<void> {
    if (!this.astInitialized) {
      await this.astAnalyzer.init();
      this.astInitialized = true;
    }
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

      // v12.8.0: Use AST-based detection for rules that support it
      if (rule.useAST) {
        const astFindings = await this.applyASTRule(rule, content, lines, filePath, relativePath, ignoreState);
        findings.push(...astFindings);
      } else {
        // Apply regex-based detection
        const ruleFindings = this.applyRule(rule, content, lines, relativePath, ignoreState);
        findings.push(...ruleFindings);
      }
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
   * Apply AST-based detection rule
   * v12.8.0: Uses TypeScript AST for accurate analysis
   */
  private async applyASTRule(
    rule: DetectionRule,
    content: string,
    lines: string[],
    filePath: string,
    relativePath: string,
    ignoreState: IgnoreState
  ): Promise<BugFinding[]> {
    // Initialize AST analyzer (lazy loading to avoid bundling issues on Windows)
    await this.initAST();

    try {
      // Route to specific AST detection based on rule type
      switch (rule.type) {
        case 'missing_destroy':
          return this.detectMissingDestroyAST(rule, content, lines, filePath, relativePath, ignoreState);
        case 'promise_timeout_leak':
          return this.detectPromiseTimeoutLeakAST(rule, content, lines, filePath, relativePath, ignoreState);
        case 'timer_leak':
          return this.detectTimerLeakAST(rule, content, lines, filePath, relativePath, ignoreState);
        default:
          // Fallback to regex for unsupported AST rule types
          logger.warn('AST detection not implemented for rule type', { type: rule.type });
          return this.applyRule(rule, content, lines, relativePath, ignoreState);
      }
    } catch (error) {
      logger.warn('AST rule application failed', {
        ruleId: rule.id,
        file: filePath,
        error: (error as Error).message
      });
      // Fallback to regex detection on AST failure
      return this.applyRule(rule, content, lines, relativePath, ignoreState);
    }
  }

  /**
   * AST-based detection for missing_destroy bug type
   * v12.8.0: Accurate class boundary detection eliminates false positives
   */
  private detectMissingDestroyAST(
    rule: DetectionRule,
    content: string,
    lines: string[],
    filePath: string,
    relativePath: string,
    ignoreState: IgnoreState
  ): BugFinding[] {
    const findings: BugFinding[] = [];

    // Parse AST
    const sourceFile = this.astAnalyzer.parseFile(content, filePath);

    // Find classes extending EventEmitter or DisposableEventEmitter
    const eventEmitterPattern = /^(EventEmitter|DisposableEventEmitter|SafeEventEmitter)$/;
    const classes = this.astAnalyzer.findClassesExtending(sourceFile, eventEmitterPattern);

    for (const classInfo of classes) {
      // Check if line should be ignored
      if (this.shouldIgnore(classInfo.startLine, rule.type, ignoreState)) {
        logger.debug('Class ignored by comment', {
          file: relativePath,
          class: classInfo.name,
          line: classInfo.startLine
        });
        continue;
      }

      // Check 1: Does class already have a destroy-like method?
      if (this.astAnalyzer.classHasDestroyMethod(classInfo)) {
        logger.debug('Class has destroy method - no bug', {
          file: relativePath,
          class: classInfo.name,
          methods: classInfo.methods.map(m => m.name)
        });
        continue;
      }

      // Check 2: Does parent class handle destroy (allowlisted base classes)?
      const extendsAllowlistedBase = classInfo.extendsClause.some(base =>
        ALLOWLISTS.missingDestroy.baseClassesWithDestroy.includes(base)
      );
      if (extendsAllowlistedBase) {
        logger.debug('Class extends base with destroy - no bug', {
          file: relativePath,
          class: classInfo.name,
          extends: classInfo.extendsClause
        });
        continue;
      }

      // Check 3: Does class implement allowlisted interface?
      const implementsDestroyInterface = classInfo.implementsClause.some(iface =>
        ALLOWLISTS.missingDestroy.interfacesWithDestroy.includes(iface)
      );
      if (implementsDestroyInterface) {
        logger.debug('Class implements destroy interface - no bug', {
          file: relativePath,
          class: classInfo.name,
          implements: classInfo.implementsClause
        });
        continue;
      }

      // Check 4: Is this an abstract class? (subclasses may implement destroy)
      if (classInfo.isAbstract) {
        // Still flag but with lower confidence
        logger.debug('Abstract class without destroy - flagging with lower confidence', {
          file: relativePath,
          class: classInfo.name
        });
      }

      // Extract context (first few lines of class)
      const contextStart = Math.max(0, classInfo.startLine - 2);
      const contextEnd = Math.min(lines.length, classInfo.startLine + 5);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      // Bug found - class extends EventEmitter but has no destroy method
      const finding: BugFinding = {
        id: randomUUID(),
        file: relativePath,
        lineStart: classInfo.startLine,
        lineEnd: Math.min(classInfo.startLine + 10, classInfo.endLine),
        type: rule.type,
        severity: rule.severity,
        message: `Class '${classInfo.name}' extends ${classInfo.extendsClause.join(', ')} but has no destroy() method. ` +
                 `EventEmitter subclasses should implement destroy() to clean up listeners.`,
        context,
        fixStrategy: rule.autoFixable ? rule.fixTemplate : undefined,
        confidence: classInfo.isAbstract ? rule.confidence * 0.7 : rule.confidence,
        detectionMethod: 'ast',
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          className: classInfo.name,
          extendsClause: classInfo.extendsClause,
          implementsClause: classInfo.implementsClause,
          isAbstract: classInfo.isAbstract,
          existingMethods: classInfo.methods.map(m => m.name)
        },
        detectedAt: new Date().toISOString()
      };

      findings.push(finding);

      logger.debug('Missing destroy bug detected (AST)', {
        file: relativePath,
        class: classInfo.name,
        line: classInfo.startLine,
        confidence: finding.confidence
      });
    }

    return findings;
  }

  /**
   * AST-based detection for promise_timeout_leak bug type
   * v12.8.0: Phase 3 - Identifies safe sleep/delay patterns to reduce false positives
   */
  private detectPromiseTimeoutLeakAST(
    rule: DetectionRule,
    content: string,
    lines: string[],
    filePath: string,
    relativePath: string,
    ignoreState: IgnoreState
  ): BugFinding[] {
    const findings: BugFinding[] = [];

    // Skip test files entirely (allowlisted)
    if (this.astAnalyzer.isTestFile(filePath)) {
      logger.debug('Skipping test file for promise_timeout_leak', { file: relativePath });
      return findings;
    }

    // Check if file matches allowlisted patterns
    for (const pattern of ALLOWLISTS.promiseTimeout.filePatterns) {
      if (pattern.test(filePath)) {
        logger.debug('Skipping allowlisted file pattern', { file: relativePath, pattern: pattern.source });
        return findings;
      }
    }

    // Parse AST and analyze Promise+setTimeout patterns
    const sourceFile = this.astAnalyzer.parseFile(content, filePath);
    const promiseTimeouts = this.astAnalyzer.analyzePromiseTimeouts(sourceFile, content);

    for (const info of promiseTimeouts) {
      // Check if line should be ignored
      if (this.shouldIgnore(info.promiseLine, rule.type, ignoreState)) {
        logger.debug('Promise+setTimeout ignored by comment', {
          file: relativePath,
          line: info.promiseLine
        });
        continue;
      }

      // Skip if this is an allowlisted pattern (simple sleep/delay)
      if (info.isAllowlisted) {
        logger.debug('Promise+setTimeout is allowlisted', {
          file: relativePath,
          line: info.promiseLine,
          reason: info.allowlistReason
        });
        continue;
      }

      // Skip if cleanup is already present
      if (info.hasCleanup) {
        logger.debug('Promise+setTimeout has cleanup', {
          file: relativePath,
          line: info.promiseLine
        });
        continue;
      }

      // Extract context
      const contextStart = Math.max(0, info.promiseLine - 2);
      const contextEnd = Math.min(lines.length, info.timeoutLine + 3);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      // Calculate confidence based on factors
      let confidence = rule.confidence;

      // Lower confidence if timeout ID is captured (might have cleanup elsewhere)
      if (info.timeoutIdCaptured) {
        confidence *= 0.8; // 20% reduction
      }

      // Lower confidence for anonymous functions (harder to track)
      if (!info.enclosingFunction) {
        confidence *= 0.9; // 10% reduction
      }

      // Bug found
      const finding: BugFinding = {
        id: randomUUID(),
        file: relativePath,
        lineStart: info.promiseLine,
        lineEnd: info.timeoutLine,
        type: rule.type,
        severity: rule.severity,
        message: `Promise contains setTimeout without cleanup. ` +
                 `If the Promise is rejected before the timeout fires, the timer will still run. ` +
                 `Consider using try/finally with clearTimeout or Promise.race with AbortController.`,
        context,
        fixStrategy: undefined, // Complex, needs manual review
        confidence,
        detectionMethod: 'ast',
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          promiseLine: info.promiseLine,
          timeoutLine: info.timeoutLine,
          enclosingFunction: info.enclosingFunction,
          timeoutIdCaptured: info.timeoutIdCaptured
        },
        detectedAt: new Date().toISOString()
      };

      findings.push(finding);

      logger.debug('Promise timeout leak detected (AST)', {
        file: relativePath,
        line: info.promiseLine,
        confidence: finding.confidence
      });
    }

    return findings;
  }

  /**
   * AST-based detection for timer_leak bug type
   * v12.8.0: Phase 5 - Variable tracking and destroy() method analysis
   */
  private detectTimerLeakAST(
    rule: DetectionRule,
    content: string,
    lines: string[],
    filePath: string,
    relativePath: string,
    ignoreState: IgnoreState
  ): BugFinding[] {
    const findings: BugFinding[] = [];

    // Skip test files entirely
    if (this.astAnalyzer.isTestFile(filePath)) {
      logger.debug('Skipping test file for timer_leak', { file: relativePath });
      return findings;
    }

    // Parse AST and analyze timer patterns
    const sourceFile = this.astAnalyzer.parseFile(content, filePath);
    const timerLeaks = this.astAnalyzer.analyzeTimerLeaks(sourceFile, content);

    for (const info of timerLeaks) {
      // Check if line should be ignored
      if (this.shouldIgnore(info.line, rule.type, ignoreState)) {
        logger.debug('Timer leak ignored by comment', {
          file: relativePath,
          line: info.line
        });
        continue;
      }

      // Skip if this is a false positive (has proper cleanup)
      if (info.isFalsePositive) {
        logger.debug('Timer has proper cleanup - not a leak', {
          file: relativePath,
          line: info.line,
          reason: info.falsePositiveReason
        });
        continue;
      }

      // Extract context
      const contextStart = Math.max(0, info.line - 2);
      const contextEnd = Math.min(lines.length, info.line + 5);
      const context = lines.slice(contextStart, contextEnd).join('\n');

      // Calculate confidence based on factors
      let confidence = rule.confidence;

      // Higher confidence if value is not captured (definite leak)
      if (!info.isValueCaptured) {
        confidence = 0.98; // Very high confidence - cannot be cleared
      }

      // Build detailed message
      let message = `setInterval() `;
      if (!info.isValueCaptured) {
        message += `return value is not captured - timer cannot be cleared and will block process exit. `;
      } else {
        message += `(${info.capturedVariable}) has no cleanup. `;
        message += `No clearInterval() or .unref() found. `;
      }
      message += `Consider using .unref() for non-blocking timers or clearInterval() in a destroy() method.`;

      // Bug found
      const finding: BugFinding = {
        id: randomUUID(),
        file: relativePath,
        lineStart: info.line,
        lineEnd: info.line + 3,
        type: rule.type,
        severity: rule.severity,
        message,
        context,
        fixStrategy: rule.autoFixable ? rule.fixTemplate : undefined,
        confidence,
        detectionMethod: 'ast',
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          timerType: info.timerType,
          isValueCaptured: info.isValueCaptured,
          capturedVariable: info.capturedVariable,
          enclosingClass: info.enclosingClass,
          enclosingFunction: info.enclosingFunction
        },
        detectedAt: new Date().toISOString()
      };

      findings.push(finding);

      logger.debug('Timer leak detected (AST)', {
        file: relativePath,
        line: info.line,
        confidence: finding.confidence,
        capturedVariable: info.capturedVariable
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
