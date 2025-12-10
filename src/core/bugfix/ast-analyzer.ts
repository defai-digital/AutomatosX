/**
 * AST Analyzer for Bug Detection
 *
 * Provides TypeScript AST-based analysis for accurate bug detection.
 * Reduces false positives by understanding code structure and semantics.
 *
 * @module core/bugfix/ast-analyzer
 * @since v12.8.0
 */

import * as ts from 'typescript';
import { logger } from '../../shared/logging/logger.js';

/**
 * Information about a class found in the AST
 */
export interface ClassInfo {
  /** Class name */
  name: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Classes this extends */
  extendsClause: string[];
  /** Interfaces this implements */
  implementsClause: string[];
  /** Methods defined in the class */
  methods: MethodInfo[];
  /** Properties defined in the class */
  properties: PropertyInfo[];
  /** Whether the class is abstract */
  isAbstract: boolean;
}

/**
 * Information about a method
 */
export interface MethodInfo {
  /** Method name */
  name: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Modifiers (async, public, private, protected, static) */
  modifiers: string[];
  /** Whether method is abstract */
  isAbstract: boolean;
}

/**
 * Information about a property
 */
export interface PropertyInfo {
  /** Property name */
  name: string;
  /** Start line (1-indexed) */
  line: number;
  /** Type annotation (if present) */
  type?: string;
  /** Modifiers (public, private, protected, static, readonly) */
  modifiers: string[];
}

/**
 * Information about a function call
 */
export interface CallInfo {
  /** Function name being called */
  name: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number */
  column: number;
  /** Arguments passed (as source text) */
  arguments: string[];
  /** Whether return value is captured in a variable */
  isReturnCaptured: boolean;
  /** Variable name if return is captured */
  capturedVariable?: string;
  /** Whether .unref() is chained directly (e.g., setInterval(...).unref()) */
  hasChainedUnref?: boolean;
}

/**
 * Information about variable usage
 */
export interface VariableUsage {
  /** Variable name */
  name: string;
  /** Declaration line */
  declarationLine: number;
  /** Lines where variable is used */
  usageLines: number[];
  /** Whether variable is used in a cleanup call */
  usedInCleanup: boolean;
  /** Cleanup method name if applicable */
  cleanupMethod?: string;
}

/**
 * Information about an enclosing function
 */
export interface FunctionInfo {
  /** Function name (empty for anonymous) */
  name: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Function body as source text */
  body: string;
  /** Whether function is async */
  isAsync: boolean;
  /** Whether function is a generator */
  isGenerator: boolean;
}

/**
 * AST cache entry
 */
interface CacheEntry {
  sourceFile: ts.SourceFile;
  hash: string;
  accessedAt: number;
}

/**
 * AST Analyzer class
 *
 * Provides TypeScript AST parsing and analysis for bug detection.
 * Uses LRU caching to optimize repeated analysis of the same files.
 */
export class ASTAnalyzer {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheSize: number;

  constructor(maxCacheSize = 100) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Parse a TypeScript/JavaScript file into an AST
   */
  parseFile(content: string, filePath: string): ts.SourceFile {
    const hash = this.hashContent(content);
    const cacheKey = filePath;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.hash === hash) {
      cached.accessedAt = Date.now();
      return cached.sourceFile;
    }

    // Parse new AST
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes - needed for traversal
      this.getScriptKind(filePath)
    );

    // Cache result
    this.cache.set(cacheKey, {
      sourceFile,
      hash,
      accessedAt: Date.now()
    });

    // Evict oldest if over capacity
    this.evictOldest();

    return sourceFile;
  }

  /**
   * Find all class declarations in the file
   */
  findClasses(sourceFile: ts.SourceFile): ClassInfo[] {
    const classes: ClassInfo[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && node.name) {
        classes.push(this.extractClassInfo(node, sourceFile));
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return classes;
  }

  /**
   * Find classes that extend a specific base class
   */
  findClassesExtending(sourceFile: ts.SourceFile, baseClassName: string | RegExp): ClassInfo[] {
    const allClasses = this.findClasses(sourceFile);

    return allClasses.filter(cls => {
      if (typeof baseClassName === 'string') {
        return cls.extendsClause.includes(baseClassName);
      }
      return cls.extendsClause.some(name => baseClassName.test(name));
    });
  }

  /**
   * Check if a class has a specific method
   */
  classHasMethod(classInfo: ClassInfo, methodName: string | RegExp): boolean {
    return classInfo.methods.some(method => {
      if (typeof methodName === 'string') {
        return method.name === methodName;
      }
      return methodName.test(method.name);
    });
  }

  /**
   * Check if a class has destroy, dispose, or cleanup method
   */
  classHasDestroyMethod(classInfo: ClassInfo): boolean {
    const destroyMethodPattern = /^(destroy|dispose|cleanup|close|shutdown|teardown)$/i;
    return this.classHasMethod(classInfo, destroyMethodPattern);
  }

  /**
   * Find all function calls matching a pattern
   */
  findCalls(sourceFile: ts.SourceFile, functionName: string | RegExp): CallInfo[] {
    const calls: CallInfo[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callName = this.getCallExpressionName(node);

        const matches = typeof functionName === 'string'
          ? callName === functionName
          : functionName.test(callName);

        if (matches) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const isReturnCaptured = this.isReturnValueCaptured(node);
          const hasChainedUnref = this.hasChainedUnrefCall(node);

          calls.push({
            name: callName,
            line: line + 1,
            column: character + 1,
            arguments: node.arguments.map(arg => arg.getText(sourceFile)),
            isReturnCaptured,
            capturedVariable: isReturnCaptured ? this.getCapturedVariableName(node) : undefined,
            hasChainedUnref
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return calls;
  }

  /**
   * Find the enclosing function for a given line number
   */
  findEnclosingFunction(sourceFile: ts.SourceFile, lineNumber: number): FunctionInfo | null {
    let result: FunctionInfo | null = null;
    const position = sourceFile.getPositionOfLineAndCharacter(lineNumber - 1, 0);

    const visit = (node: ts.Node): void => {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      if (position >= node.getStart() && position <= node.getEnd()) {
        if (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node)
        ) {
          const funcInfo = this.extractFunctionInfo(node, sourceFile);
          // Keep the innermost (most specific) function
          if (!result || funcInfo.startLine >= result.startLine) {
            result = funcInfo;
          }
        }
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return result;
  }

  /**
   * Track variable usage throughout the file
   */
  trackVariableUsage(sourceFile: ts.SourceFile, variableName: string): VariableUsage | null {
    let declarationLine = -1;
    const usageLines: number[] = [];
    let usedInCleanup = false;
    let cleanupMethod: string | undefined;

    const cleanupMethods = ['clearInterval', 'clearTimeout', 'removeListener', 'removeEventListener', 'off', 'destroy', 'dispose', 'close'];

    const visit = (node: ts.Node): void => {
      // Find declaration
      if (ts.isVariableDeclaration(node)) {
        if (node.name.getText(sourceFile) === variableName) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          declarationLine = line + 1;
        }
      }

      // Find usages
      if (ts.isIdentifier(node) && node.text === variableName) {
        // Skip the declaration itself
        if (!ts.isVariableDeclaration(node.parent) || node.parent.name !== node) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          usageLines.push(line + 1);

          // Check if used in cleanup call
          const parent = node.parent;
          if (ts.isCallExpression(parent)) {
            const callName = this.getCallExpressionName(parent);
            if (cleanupMethods.includes(callName)) {
              usedInCleanup = true;
              cleanupMethod = callName;
            }
          } else if (ts.isCallExpression(parent?.parent)) {
            // Check if passed as argument to cleanup function
            const callName = this.getCallExpressionName(parent.parent);
            if (cleanupMethods.includes(callName)) {
              usedInCleanup = true;
              cleanupMethod = callName;
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    if (declarationLine === -1) {
      return null;
    }

    return {
      name: variableName,
      declarationLine,
      usageLines,
      usedInCleanup,
      cleanupMethod
    };
  }

  /**
   * Check if a method in a class calls clearInterval/clearTimeout on a variable
   */
  methodClearsTimer(sourceFile: ts.SourceFile, classInfo: ClassInfo, methodName: string, variableName: string): boolean {
    const method = classInfo.methods.find(m => m.name === methodName);
    if (!method) return false;

    // Get the source text between method start and end
    const startPos = sourceFile.getPositionOfLineAndCharacter(method.startLine - 1, 0);
    const endPos = sourceFile.getPositionOfLineAndCharacter(method.endLine - 1, 0);
    const methodText = sourceFile.text.substring(startPos, endPos);

    // Check for clearInterval/clearTimeout with the variable
    const clearPatterns = [
      new RegExp(`clearInterval\\s*\\(\\s*(?:this\\.)?${variableName}\\s*\\)`),
      new RegExp(`clearTimeout\\s*\\(\\s*(?:this\\.)?${variableName}\\s*\\)`)
    ];

    return clearPatterns.some(pattern => pattern.test(methodText));
  }

  /**
   * Check if a file is a test file
   */
  isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\.[tj]sx?$/,
      /\.spec\.[tj]sx?$/,
      /\.bench\.[tj]sx?$/,
      /__tests__\//,
      /test\/fixtures\//,
      /tests?\//
    ];
    return testPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Analyze Promise+setTimeout patterns for potential leaks
   * v12.8.0: Phase 3 - Reduced false positives for simple sleep utilities
   */
  analyzePromiseTimeouts(sourceFile: ts.SourceFile, content: string): PromiseTimeoutInfo[] {
    const results: PromiseTimeoutInfo[] = [];

    // First, check if the entire content matches any safe patterns
    for (const safePattern of ALLOWLISTS.promiseTimeout.safePatterns) {
      if (safePattern.test(content)) {
        // Content has safe pattern - still analyze but mark as allowlisted
      }
    }

    const visit = (node: ts.Node): void => {
      // Look for: new Promise(...)
      if (ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'Promise') {

        const promisePos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const promiseLine = promisePos.line + 1;

        // Find setTimeout/setInterval calls within this Promise
        const findTimerCalls = (innerNode: ts.Node): void => {
          if (ts.isCallExpression(innerNode)) {
            const callName = this.getCallExpressionName(innerNode);
            if (callName === 'setTimeout' || callName === 'setInterval') {
              const timerPos = sourceFile.getLineAndCharacterOfPosition(innerNode.getStart());
              const timerLine = timerPos.line + 1;

              // Check if timer ID is captured
              const timeoutIdCaptured = this.isReturnValueCaptured(innerNode);

              // Check for cleanup patterns
              const hasCleanup = this.hasCleanupInPromise(node, sourceFile);

              // Find enclosing function
              const enclosingFunc = this.findEnclosingFunction(sourceFile, promiseLine);

              // Check if this is an allowlisted pattern
              const { isAllowlisted, reason } = this.checkPromiseTimeoutAllowlist(
                enclosingFunc?.name || '',
                node,
                sourceFile
              );

              results.push({
                promiseLine,
                timeoutLine: timerLine,
                isAllowlisted,
                allowlistReason: reason,
                hasCleanup,
                enclosingFunction: enclosingFunc?.name,
                timeoutIdCaptured
              });
            }
          }
          ts.forEachChild(innerNode, findTimerCalls);
        };

        ts.forEachChild(node, findTimerCalls);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return results;
  }

  /**
   * Check if a Promise has cleanup (finally/catch/then with clearTimeout, or clearTimeout in executor)
   */
  private hasCleanupInPromise(promiseNode: ts.NewExpression, sourceFile: ts.SourceFile): boolean {
    // Strategy 1: Check if clearTimeout is called anywhere inside the Promise executor body
    // This handles patterns like:
    //   new Promise((resolve, reject) => {
    //     promise.then(() => { clearTimeout(id); ... })
    //   })
    const promiseText = promiseNode.getText(sourceFile);
    if (/clearTimeout/i.test(promiseText)) {
      return true;
    }

    // Strategy 2: Look at the parent chain for .finally(), .catch(), or .then() with clearTimeout
    // This handles patterns like:
    //   new Promise(...).then(...).catch(() => { clearTimeout(id); })
    let current: ts.Node = promiseNode;

    while (current.parent) {
      const parent = current.parent;

      // Check for .finally(), .catch(), or .then() call with clearTimeout
      if (ts.isCallExpression(parent) &&
          ts.isPropertyAccessExpression(parent.expression)) {
        const propName = parent.expression.name.text;
        // Check .finally(), .catch(), and .then() - all can contain cleanup code
        if (propName === 'finally' || propName === 'catch' || propName === 'then') {
          // Check if clearTimeout is called inside the callback
          const callText = parent.getText(sourceFile);
          if (/clearTimeout/i.test(callText)) {
            return true;
          }
        }
      }

      // Check for try/finally block containing this promise
      if (ts.isTryStatement(parent)) {
        if (parent.finallyBlock) {
          const finallyText = parent.finallyBlock.getText(sourceFile);
          if (/clearTimeout/i.test(finallyText)) {
            return true;
          }
        }
      }

      current = parent;
    }

    return false;
  }

  /**
   * Check if a Promise+setTimeout pattern is allowlisted
   */
  private checkPromiseTimeoutAllowlist(
    functionName: string,
    promiseNode: ts.NewExpression,
    sourceFile: ts.SourceFile
  ): { isAllowlisted: boolean; reason?: string } {
    // Check function name against allowlist
    // Use exact match or prefix match (e.g., "sleepMs" matches "sleep", "delayAsync" matches "delay")
    if (functionName) {
      const normalizedName = functionName.toLowerCase();
      for (const allowedName of ALLOWLISTS.promiseTimeout.functionNames) {
        const lowerAllowed = allowedName.toLowerCase();
        // Match exact name or name starting with the allowed pattern
        // This avoids matching "fetchWithTimeout" as "timeout"
        if (normalizedName === lowerAllowed ||
            normalizedName.startsWith(lowerAllowed)) {
          return {
            isAllowlisted: true,
            reason: `Function name '${functionName}' matches allowlisted pattern '${allowedName}'`
          };
        }
      }
    }

    // Check for simple sleep pattern: new Promise(resolve => setTimeout(resolve, ms))
    const promiseText = promiseNode.getText(sourceFile);
    for (const safePattern of ALLOWLISTS.promiseTimeout.safePatterns) {
      if (safePattern.test(promiseText)) {
        return {
          isAllowlisted: true,
          reason: 'Simple sleep/delay pattern - timeout cleanup not needed'
        };
      }
    }

    // Check for simple pattern: resolve/r is passed directly to setTimeout
    // This covers: new Promise(resolve => setTimeout(resolve, ms)) or new Promise(r => setTimeout(r, ms))
    const promiseArgs = promiseNode.arguments;
    if (promiseArgs && promiseArgs.length > 0) {
      const promiseArg = promiseArgs[0];
      if (promiseArg && ts.isArrowFunction(promiseArg)) {
        const body = promiseArg.body;
        if (ts.isCallExpression(body)) {
          const callName = this.getCallExpressionName(body);
          if (callName === 'setTimeout') {
            // Check if the callback is just the resolve function
            const args = body.arguments;
            if (args.length >= 1) {
              const firstArg = args[0];
              // Get the arrow function parameter name
              const params = promiseArg.parameters;
              if (params.length >= 1) {
                const resolveParam = params[0];
                if (resolveParam && ts.isIdentifier(resolveParam.name)) {
                  const resolveParamName = resolveParam.name.text;
                  // Resolve is passed directly to setTimeout
                  if (firstArg && ts.isIdentifier(firstArg) && firstArg.text === resolveParamName) {
                    return {
                      isAllowlisted: true,
                      reason: 'Simple Promise with direct resolve to setTimeout - no cleanup needed'
                    };
                  }
                }
              }
            }
          }
        }
      }
    }

    // Check if this is an inline await (await new Promise(...))
    if (ts.isAwaitExpression(promiseNode.parent)) {
      // Check if the Promise callback passes resolve directly to setTimeout
      if (promiseArgs && promiseArgs.length > 0) {
        const promiseArg = promiseArgs[0];
        if (promiseArg && ts.isArrowFunction(promiseArg)) {
          const body = promiseArg.body;
          if (ts.isCallExpression(body)) {
            const callName = this.getCallExpressionName(body);
            if (callName === 'setTimeout') {
              return {
                isAllowlisted: true,
                reason: 'Awaited Promise with setTimeout - no leak possible when awaited'
              };
            }
          }
        }
      }
    }

    return { isAllowlisted: false };
  }

  /**
   * Analyze code for unreachable code patterns
   * v12.8.0: Phase 4 - Control flow analysis to reduce false positives
   */
  analyzeUnreachableCode(sourceFile: ts.SourceFile): UnreachableCodeInfo[] {
    const results: UnreachableCodeInfo[] = [];

    const visit = (node: ts.Node): void => {
      // Check blocks (function bodies, if blocks, etc.)
      if (ts.isBlock(node)) {
        this.analyzeBlockForUnreachable(node, sourceFile, results);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return results;
  }

  /**
   * Analyze a block for unreachable statements
   */
  private analyzeBlockForUnreachable(
    block: ts.Block,
    sourceFile: ts.SourceFile,
    results: UnreachableCodeInfo[]
  ): void {
    const statements = block.statements;
    let foundTerminator = false;
    let terminatorLine = 0;
    let terminatorReason: 'return' | 'throw' | 'break' | 'continue' | 'never' = 'return';

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;

      const stmtPos = sourceFile.getLineAndCharacterOfPosition(stmt.getStart());
      const stmtLine = stmtPos.line + 1;

      if (foundTerminator) {
        // This statement is after a terminator - check if it's a false positive

        // Check 1: Is this a case/default label in a switch?
        if (ts.isCaseClause(stmt.parent) || ts.isDefaultClause(stmt.parent)) {
          // This is a case label after break - NOT unreachable
          results.push({
            line: stmtLine,
            code: stmt.getText(sourceFile).substring(0, 80),
            reason: terminatorReason,
            controlFlowLine: terminatorLine,
            isFalsePositive: true,
            falsePositiveReason: 'Case/default clause in switch statement'
          });
          continue;
        }

        // Check 2: Is this inside a switch case block?
        if (this.isInSwitchCase(stmt)) {
          results.push({
            line: stmtLine,
            code: stmt.getText(sourceFile).substring(0, 80),
            reason: terminatorReason,
            controlFlowLine: terminatorLine,
            isFalsePositive: true,
            falsePositiveReason: 'Statement in switch case after break belongs to next case'
          });
          continue;
        }

        // Check 3: Is parent block a switch case?
        const parentCase = this.findParentSwitchCase(block);
        if (parentCase) {
          // Reset - break only affects the case, not the whole block
          foundTerminator = false;
          continue;
        }

        // Check 4: Is the terminator inside a conditional/try that may not always execute?
        // This is a more complex check that would require full control flow analysis

        // This is genuinely unreachable code
        results.push({
          line: stmtLine,
          code: stmt.getText(sourceFile).substring(0, 80),
          reason: terminatorReason,
          controlFlowLine: terminatorLine,
          isFalsePositive: false
        });
      }

      // Check if this statement is a terminator
      if (ts.isReturnStatement(stmt)) {
        foundTerminator = true;
        terminatorLine = stmtLine;
        terminatorReason = 'return';
      } else if (ts.isThrowStatement(stmt)) {
        foundTerminator = true;
        terminatorLine = stmtLine;
        terminatorReason = 'throw';
      } else if (ts.isBreakStatement(stmt)) {
        // Break only terminates within switch/loop context
        if (this.isInSwitchOrLoop(stmt)) {
          // Don't mark as terminator for outer block - break only affects inner construct
        } else {
          foundTerminator = true;
          terminatorLine = stmtLine;
          terminatorReason = 'break';
        }
      } else if (ts.isContinueStatement(stmt)) {
        // Continue only terminates within loop context
        if (!this.isInLoop(stmt)) {
          foundTerminator = true;
          terminatorLine = stmtLine;
          terminatorReason = 'continue';
        }
      }
    }
  }

  /**
   * Check if a node is inside a switch case
   */
  private isInSwitchCase(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isCaseClause(current) || ts.isDefaultClause(current)) {
        return true;
      }
      if (ts.isSwitchStatement(current)) {
        return false; // Found switch but not inside a case
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Find parent switch case clause
   */
  private findParentSwitchCase(node: ts.Node): ts.CaseClause | ts.DefaultClause | null {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isCaseClause(current) || ts.isDefaultClause(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Check if a node is inside a switch statement or loop
   */
  private isInSwitchOrLoop(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isSwitchStatement(current) ||
          ts.isForStatement(current) ||
          ts.isForInStatement(current) ||
          ts.isForOfStatement(current) ||
          ts.isWhileStatement(current) ||
          ts.isDoStatement(current)) {
        return true;
      }
      if (ts.isFunctionDeclaration(current) ||
          ts.isFunctionExpression(current) ||
          ts.isArrowFunction(current)) {
        return false; // Hit function boundary
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if a node is inside a loop
   */
  private isInLoop(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isForStatement(current) ||
          ts.isForInStatement(current) ||
          ts.isForOfStatement(current) ||
          ts.isWhileStatement(current) ||
          ts.isDoStatement(current)) {
        return true;
      }
      if (ts.isFunctionDeclaration(current) ||
          ts.isFunctionExpression(current) ||
          ts.isArrowFunction(current)) {
        return false; // Hit function boundary
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Analyze setInterval/setTimeout calls for potential timer leaks
   * v12.8.0: Phase 5 - Variable tracking and destroy() method analysis
   */
  analyzeTimerLeaks(sourceFile: ts.SourceFile, content: string): TimerLeakInfo[] {
    const results: TimerLeakInfo[] = [];

    // Find all setInterval calls (primary target for leaks)
    const intervalCalls = this.findCalls(sourceFile, 'setInterval');

    for (const call of intervalCalls) {
      const info = this.analyzeTimerCall(call, sourceFile, content, 'setInterval');
      results.push(info);
    }

    return results;
  }

  /**
   * Analyze a single timer call for leak potential
   */
  private analyzeTimerCall(
    call: CallInfo,
    sourceFile: ts.SourceFile,
    content: string,
    timerType: 'setInterval' | 'setTimeout'
  ): TimerLeakInfo {
    const lines = content.split('\n');

    // Find enclosing function
    const enclosingFunc = this.findEnclosingFunction(sourceFile, call.line);

    // Find enclosing class (if any)
    const enclosingClass = this.findEnclosingClass(sourceFile, call.line);

    // Base info
    const info: TimerLeakInfo = {
      line: call.line,
      timerType,
      isValueCaptured: call.isReturnCaptured,
      capturedVariable: call.capturedVariable,
      hasClearCall: false,
      hasUnref: false,
      hasDestroyCleanup: false,
      enclosingClass: enclosingClass?.name,
      enclosingFunction: enclosingFunc?.name,
      isFalsePositive: false,
      falsePositiveReason: undefined
    };

    // Check 1: If value is not captured, it's a definite leak (cannot be cleared)
    if (!call.isReturnCaptured) {
      // Exception: Check if .unref() is chained directly (AST-based detection)
      if (call.hasChainedUnref) {
        info.hasUnref = true;
        info.isFalsePositive = true;
        info.falsePositiveReason = 'Timer has .unref() chained directly';
        return info;
      }
      // No variable captured and no .unref() - definite leak
      return info;
    }

    const variableName = call.capturedVariable!;

    // Check 2: Track variable usage for clearInterval/clearTimeout
    const variableUsage = this.trackVariableUsage(sourceFile, variableName);
    if (variableUsage) {
      if (variableUsage.usedInCleanup) {
        info.hasClearCall = true;
        info.isFalsePositive = true;
        info.falsePositiveReason = `Timer is cleared via ${variableUsage.cleanupMethod}()`;
        return info;
      }
    }

    // Check 3: Check for .unref() call on the variable
    const unrefPattern = new RegExp(`${this.escapeRegex(variableName)}\\s*\\.\\s*unref\\s*\\(\\s*\\)`, 'g');
    if (unrefPattern.test(content)) {
      info.hasUnref = true;
      info.isFalsePositive = true;
      info.falsePositiveReason = 'Timer has .unref() called on it';
      return info;
    }

    // Check 4: Optional chaining .unref?.()
    const optionalUnrefPattern = new RegExp(`${this.escapeRegex(variableName)}\\s*\\?\\.\\s*unref\\s*\\(\\s*\\)`, 'g');
    if (optionalUnrefPattern.test(content)) {
      info.hasUnref = true;
      info.isFalsePositive = true;
      info.falsePositiveReason = 'Timer has optional .unref?.() called on it';
      return info;
    }

    // Check 5: If in a class, check if destroy/cleanup methods clear the timer
    if (enclosingClass) {
      // Check if class extends an allowlisted base
      const extendsAllowlistedBase = enclosingClass.extendsClause.some(base =>
        ALLOWLISTS.timerLeak.baseClasses.includes(base)
      );
      if (extendsAllowlistedBase) {
        // Check if any cleanup method clears this timer
        for (const methodName of ALLOWLISTS.timerLeak.cleanupMethods) {
          if (this.methodClearsTimer(sourceFile, enclosingClass, methodName, variableName)) {
            info.hasDestroyCleanup = true;
            info.isFalsePositive = true;
            info.falsePositiveReason = `Timer is cleared in ${methodName}() method`;
            return info;
          }
        }
      }

      // Also check even if not extending allowlisted base
      for (const methodName of ALLOWLISTS.timerLeak.cleanupMethods) {
        if (this.methodClearsTimer(sourceFile, enclosingClass, methodName, variableName)) {
          info.hasDestroyCleanup = true;
          info.isFalsePositive = true;
          info.falsePositiveReason = `Timer is cleared in ${methodName}() method`;
          return info;
        }
      }
    }

    // Check 6: Check for inline clearInterval in same function scope
    if (enclosingFunc) {
      const clearPattern = timerType === 'setInterval'
        ? new RegExp(`clearInterval\\s*\\(\\s*${this.escapeRegex(variableName)}\\s*\\)`)
        : new RegExp(`clearTimeout\\s*\\(\\s*${this.escapeRegex(variableName)}\\s*\\)`);

      if (clearPattern.test(enclosingFunc.body)) {
        info.hasClearCall = true;
        info.isFalsePositive = true;
        info.falsePositiveReason = 'Timer is cleared in the same function';
        return info;
      }
    }

    // No cleanup found - this is a potential leak
    return info;
  }

  /**
   * Find the enclosing class for a given line
   */
  findEnclosingClass(sourceFile: ts.SourceFile, lineNumber: number): ClassInfo | null {
    const allClasses = this.findClasses(sourceFile);

    // Find the most specific (innermost) class containing this line
    let result: ClassInfo | null = null;
    for (const cls of allClasses) {
      if (lineNumber >= cls.startLine && lineNumber <= cls.endLine) {
        // Keep the innermost class
        if (!result || cls.startLine >= result.startLine) {
          result = cls;
        }
      }
    }

    return result;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clear the AST cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }

  // Private helper methods

  private hashContent(content: string): string {
    // Simple hash for cache invalidation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  private getScriptKind(filePath: string): ts.ScriptKind {
    if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
    if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
    if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
    if (filePath.endsWith('.mjs') || filePath.endsWith('.mts')) return ts.ScriptKind.TS;
    return ts.ScriptKind.JS;
  }

  private evictOldest(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Find oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private extractClassInfo(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): ClassInfo {
    const name = node.name?.getText(sourceFile) || '<anonymous>';
    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const extendsClause: string[] = [];
    const implementsClause: string[] = [];

    // Extract heritage clauses
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            extendsClause.push(type.expression.getText(sourceFile));
          }
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          for (const type of clause.types) {
            implementsClause.push(type.expression.getText(sourceFile));
          }
        }
      }
    }

    // Extract methods
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];

    for (const member of node.members) {
      if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
        const methodName = ts.isConstructorDeclaration(member)
          ? 'constructor'
          : (member.name?.getText(sourceFile) || '<anonymous>');

        const { line: methodStart } = sourceFile.getLineAndCharacterOfPosition(member.getStart());
        const { line: methodEnd } = sourceFile.getLineAndCharacterOfPosition(member.getEnd());

        const modifiers = this.getModifiers(member);

        methods.push({
          name: methodName,
          startLine: methodStart + 1,
          endLine: methodEnd + 1,
          modifiers,
          isAbstract: modifiers.includes('abstract')
        });
      } else if (ts.isPropertyDeclaration(member)) {
        const propName = member.name?.getText(sourceFile) || '<anonymous>';
        const { line } = sourceFile.getLineAndCharacterOfPosition(member.getStart());

        properties.push({
          name: propName,
          line: line + 1,
          type: member.type?.getText(sourceFile),
          modifiers: this.getModifiers(member)
        });
      }
    }

    const isAbstract = node.modifiers?.some(
      mod => mod.kind === ts.SyntaxKind.AbstractKeyword
    ) || false;

    return {
      name,
      startLine: startLine + 1,
      endLine: endLine + 1,
      extendsClause,
      implementsClause,
      methods,
      properties,
      isAbstract
    };
  }

  private extractFunctionInfo(
    node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration,
    sourceFile: ts.SourceFile
  ): FunctionInfo {
    let name = '';

    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      name = node.name?.getText(sourceFile) || '';
    } else if (ts.isFunctionExpression(node)) {
      name = node.name?.getText(sourceFile) || '';
    }
    // Arrow functions don't have names, but we might get it from parent
    if (!name && ts.isVariableDeclaration(node.parent)) {
      name = node.parent.name.getText(sourceFile);
    }

    const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isAsync = modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;

    const isGenerator = !!(
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.asteriskToken
    );

    // Get body text
    let body = '';
    if ('body' in node && node.body) {
      body = node.body.getText(sourceFile);
    }

    return {
      name,
      startLine: startLine + 1,
      endLine: endLine + 1,
      body,
      isAsync,
      isGenerator
    };
  }

  private getModifiers(node: ts.Node): string[] {
    const modifiers: string[] = [];

    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!mods) return modifiers;

    for (const mod of mods) {
      switch (mod.kind) {
        case ts.SyntaxKind.PublicKeyword:
          modifiers.push('public');
          break;
        case ts.SyntaxKind.PrivateKeyword:
          modifiers.push('private');
          break;
        case ts.SyntaxKind.ProtectedKeyword:
          modifiers.push('protected');
          break;
        case ts.SyntaxKind.StaticKeyword:
          modifiers.push('static');
          break;
        case ts.SyntaxKind.AsyncKeyword:
          modifiers.push('async');
          break;
        case ts.SyntaxKind.AbstractKeyword:
          modifiers.push('abstract');
          break;
        case ts.SyntaxKind.ReadonlyKeyword:
          modifiers.push('readonly');
          break;
      }
    }

    return modifiers;
  }

  private getCallExpressionName(node: ts.CallExpression): string {
    const expression = node.expression;

    if (ts.isIdentifier(expression)) {
      return expression.text;
    }

    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text;
    }

    return '';
  }

  private isReturnValueCaptured(node: ts.CallExpression): boolean {
    const parent = node.parent;

    // Check if assigned to a variable
    if (ts.isVariableDeclaration(parent)) {
      return true;
    }

    // Check if part of property assignment
    if (ts.isPropertyAssignment(parent)) {
      return true;
    }

    // Check if assigned with = operator
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return true;
    }

    return false;
  }

  private getCapturedVariableName(node: ts.CallExpression): string | undefined {
    const parent = node.parent;

    if (ts.isVariableDeclaration(parent)) {
      return parent.name.getText();
    }

    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return parent.left.getText();
    }

    return undefined;
  }

  /**
   * Check if a call expression has .unref() chained directly
   * e.g., setInterval(...).unref() or setInterval(...).unref?.()
   */
  private hasChainedUnrefCall(node: ts.CallExpression): boolean {
    const parent = node.parent;

    // Pattern: setInterval(...).unref()
    // AST: CallExpression(PropertyAccessExpression(CallExpression, 'unref'))
    if (ts.isPropertyAccessExpression(parent)) {
      const propertyName = parent.name.text;
      if (propertyName === 'unref') {
        // Check if the property access is called (i.e., .unref())
        const grandParent = parent.parent;
        if (ts.isCallExpression(grandParent) && grandParent.expression === parent) {
          return true;
        }
      }
    }

    // Pattern: setInterval(...).unref?.() (optional chaining)
    // AST structure is different for optional chaining
    if (ts.isCallChain && ts.isCallChain(parent)) {
      // Check if it's calling 'unref' via optional chain
      const expression = (parent as ts.CallExpression).expression;
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'unref') {
        return true;
      }
    }

    return false;
  }
}

/**
 * Allowlists for reducing false positives
 */
export const ALLOWLISTS = {
  /**
   * Patterns that indicate intentional Promise+setTimeout usage (not leaks)
   */
  promiseTimeout: {
    /** Function names that are intentional delays */
    // Note: 'wait' and 'timeout' removed as they are too generic
    // 'waitForCondition' or 'fetchWithTimeout' would be wrongly allowlisted
    functionNames: [
      'sleep', 'delay', 'pause',
      'debounce', 'throttle', 'rateLimitDelay', 'backoff'
    ],

    /** File patterns to skip entirely */
    filePatterns: [
      /\.test\.[tj]sx?$/,
      /\.spec\.[tj]sx?$/,
      /\.bench\.[tj]sx?$/,
      /__tests__\//,
      /test\/fixtures\//,
    ],

    /** Code patterns that are safe (simple delay utilities) */
    safePatterns: [
      // Simple sleep: return new Promise(resolve => setTimeout(resolve, ms))
      /return\s+new\s+Promise\s*\(\s*(?:resolve|r)\s*=>\s*setTimeout\s*\(\s*(?:resolve|r)\s*,\s*\w+\s*\)\s*\)/,
      // Arrow function sleep: const sleep = (ms) => new Promise(r => setTimeout(r, ms))
      /=>\s*new\s+Promise\s*\(\s*(?:resolve|r)\s*=>\s*setTimeout\s*\(\s*(?:resolve|r)\s*,\s*\w+\s*\)\s*\)/,
      // Inline await: await new Promise(r => setTimeout(r, 100))
      /await\s+new\s+Promise\s*\(\s*(?:resolve|r)\s*=>\s*setTimeout\s*\(\s*(?:resolve|r)\s*,\s*\d+\s*\)\s*\)/,
    ]
  },

  /**
   * Patterns that indicate timer cleanup is handled elsewhere
   */
  timerLeak: {
    /** Classes with known lifecycle management */
    baseClasses: [
      'Disposable',
      'DisposableEventEmitter',
      'SafeEventEmitter',
      'Component',  // React
      'BaseService',
    ],

    /** Methods that imply cleanup */
    cleanupMethods: ['destroy', 'dispose', 'cleanup', 'close', 'shutdown', 'teardown', 'componentWillUnmount'],
  },

  /**
   * Patterns that indicate destroy is handled by inheritance
   */
  missingDestroy: {
    /** Base classes that already have destroy() */
    baseClassesWithDestroy: [
      'DisposableEventEmitter',
      'Disposable',
      'SafeEventEmitter',
    ],

    /** Interfaces that imply destroy() exists */
    interfacesWithDestroy: [
      'IDisposable',
      'Destroyable',
      'IClosable',
    ],
  }
};

/**
 * Information about setTimeout/setInterval in Promise
 * @since v12.8.0
 */
export interface PromiseTimeoutInfo {
  /** Line where Promise is created */
  promiseLine: number;
  /** Line where setTimeout is called */
  timeoutLine: number;
  /** Whether this is in an allowlisted function */
  isAllowlisted: boolean;
  /** Reason why it's allowlisted (if applicable) */
  allowlistReason?: string;
  /** Whether the timeout has cleanup in finally/catch */
  hasCleanup: boolean;
  /** Function name containing this code */
  enclosingFunction?: string;
  /** Whether return value is captured */
  timeoutIdCaptured: boolean;
}

/**
 * Information about unreachable code
 * @since v12.8.0
 */
export interface UnreachableCodeInfo {
  /** Line number of unreachable code */
  line: number;
  /** The code that is unreachable */
  code: string;
  /** Type of control flow that makes it unreachable */
  reason: 'return' | 'throw' | 'break' | 'continue' | 'never';
  /** Line of the control flow statement */
  controlFlowLine: number;
  /** Whether this is a false positive (e.g., switch case) */
  isFalsePositive: boolean;
  /** Reason why it's a false positive */
  falsePositiveReason?: string;
}

/**
 * Information about setInterval/setTimeout timer leaks
 * @since v12.8.0 (Phase 5)
 */
export interface TimerLeakInfo {
  /** Line where setInterval/setTimeout is called */
  line: number;
  /** Type of timer (setInterval or setTimeout) */
  timerType: 'setInterval' | 'setTimeout';
  /** Whether return value is captured in a variable */
  isValueCaptured: boolean;
  /** Variable name if captured */
  capturedVariable?: string;
  /** Whether clearInterval/clearTimeout is called on the variable */
  hasClearCall: boolean;
  /** Whether .unref() is called on the timer */
  hasUnref: boolean;
  /** Whether cleanup happens in a destroy/dispose/cleanup method */
  hasDestroyCleanup: boolean;
  /** Enclosing class name (if in a class method) */
  enclosingClass?: string;
  /** Enclosing function name */
  enclosingFunction?: string;
  /** Whether this is a false positive */
  isFalsePositive: boolean;
  /** Reason why it's a false positive */
  falsePositiveReason?: string;
}

/**
 * Create a default AST analyzer instance
 */
export function createASTAnalyzer(cacheSize = 100): ASTAnalyzer {
  return new ASTAnalyzer(cacheSize);
}
