/**
 * UsageTracker - Usage Context Analysis
 *
 * Tracks every symbol usage with its context (value position, type position,
 * JSDoc, generic, decorator) to distinguish runtime-relevant usage from
 * type-only usage.
 *
 * @module core/refactor/semantic/usage-tracker
 * @since v12.9.0
 */

import { logger } from '../../../shared/logging/logger.js';
import type { TSProgramManager } from './ts-program-manager.js';
import type { SymbolIndex } from './symbol-index.js';
import type {
  UsageContext,
  UsageContextType,
  SymbolUsageSummary,
  UsageTrackerOptions,
} from './types.js';
import { createEmptyUsageSummary } from './types.js';

// Type-only import for TypeScript API types
import type * as TypeScriptTypes from 'typescript';

// Lazy-loaded TypeScript module reference
let ts: typeof TypeScriptTypes | null = null;

/**
 * UsageTracker - Tracks symbol usages with context
 *
 * Features:
 * - AST traversal with context tracking
 * - Type position vs value position detection
 * - JSDoc comment parsing
 * - Generic type parameter tracking
 * - Decorator metadata tracking
 * - Runtime relevance classification
 */
export class UsageTracker {
  private usages: Map<string, UsageContext[]> = new Map();
  private summaries: Map<string, SymbolUsageSummary> = new Map();
  private programManager: TSProgramManager;
  private symbolIndex: SymbolIndex;
  private options: Required<UsageTrackerOptions>;
  private tracked = false;

  constructor(
    programManager: TSProgramManager,
    symbolIndex: SymbolIndex,
    options: UsageTrackerOptions = {}
  ) {
    this.programManager = programManager;
    this.symbolIndex = symbolIndex;
    this.options = {
      trackJsDoc: options.trackJsDoc ?? true,
      trackGenerics: options.trackGenerics ?? true,
      trackDecorators: options.trackDecorators ?? true,
      maxUsagesPerSymbol: options.maxUsagesPerSymbol ?? 1000,
    };
  }

  /**
   * Track all usages in the program
   */
  async trackUsages(): Promise<void> {
    const startTime = Date.now();

    // Get TypeScript module
    ts = await import('typescript');

    const program = await this.programManager.getProgram();
    const typeChecker = program.getTypeChecker();

    // Clear previous tracking
    this.usages.clear();
    this.summaries.clear();

    // Process each source file
    for (const sourceFile of program.getSourceFiles()) {
      // Skip declaration files and node_modules
      if (sourceFile.isDeclarationFile) continue;
      if (sourceFile.fileName.includes('node_modules')) continue;

      await this.trackFileUsages(sourceFile, typeChecker);
    }

    // Build summaries
    this.buildSummaries();

    this.tracked = true;

    const duration = Date.now() - startTime;
    logger.debug('Usage tracking complete', {
      symbols: this.usages.size,
      totalUsages: Array.from(this.usages.values()).reduce((sum, u) => sum + u.length, 0),
      durationMs: duration,
    });
  }

  /**
   * Check if tracking is complete
   */
  isTracked(): boolean {
    return this.tracked;
  }

  /**
   * Get usages for a symbol
   */
  getUsages(symbolId: string): UsageContext[] {
    return this.usages.get(symbolId) || [];
  }

  /**
   * Get usage summary for a symbol
   */
  getSummary(symbolId: string): SymbolUsageSummary {
    return this.summaries.get(symbolId) || createEmptyUsageSummary(symbolId);
  }

  /**
   * Check if symbol has runtime usage
   */
  hasRuntimeUsage(symbolId: string): boolean {
    return this.getSummary(symbolId).hasRuntimeUsage;
  }

  /**
   * Check if symbol is only used in type positions
   */
  isTypeOnlyUsed(symbolId: string): boolean {
    return this.getSummary(symbolId).isTypeOnlyUsed;
  }

  /**
   * Get all symbols with no usages
   */
  getUnusedSymbols(): string[] {
    const allSymbols = this.symbolIndex.getAllSymbols();
    return allSymbols
      .filter(s => this.getSummary(s.id).totalUsages === 0)
      .map(s => s.id);
  }

  /**
   * Get all symbols with type-only usage
   */
  getTypeOnlySymbols(): string[] {
    return Array.from(this.summaries.values())
      .filter(s => s.isTypeOnlyUsed && s.totalUsages > 0)
      .map(s => s.symbolId);
  }

  /**
   * Track usages in a single file
   */
  private async trackFileUsages(
    sourceFile: TypeScriptTypes.SourceFile,
    typeChecker: TypeScriptTypes.TypeChecker
  ): Promise<void> {
    if (!ts) return;

    const visit = (node: TypeScriptTypes.Node): void => {
      if (!ts) return;

      // Track identifier usages
      if (ts.isIdentifier(node)) {
        this.trackIdentifierUsage(node, sourceFile, typeChecker);
      }

      // Track JSDoc if enabled
      if (this.options.trackJsDoc) {
        this.trackJsDocUsages(node, sourceFile, typeChecker);
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  /**
   * Track an identifier usage
   */
  private trackIdentifierUsage(
    node: TypeScriptTypes.Identifier,
    sourceFile: TypeScriptTypes.SourceFile,
    typeChecker: TypeScriptTypes.TypeChecker
  ): void {
    if (!ts) return;

    // Skip if this is the declaration itself
    if (this.isDeclaration(node)) return;

    // Get the symbol
    const symbol = typeChecker.getSymbolAtLocation(node);
    if (!symbol) return;

    // Find the symbol in our index
    const symbolEntry = this.findSymbolEntry(symbol, node, sourceFile);
    if (!symbolEntry) return;

    // Determine context type
    const contextType = this.classifyContext(node);
    const isRuntimeRelevant = this.isRuntimeRelevantContext(contextType, node);

    // Get position
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Create usage context
    const usage: UsageContext = {
      file: sourceFile.fileName,
      line: line + 1,
      column: character,
      contextType,
      isRuntimeRelevant,
      enclosingNode: this.getEnclosingNodeDescription(node),
      text: node.getText(sourceFile),
    };

    // Add to usages
    this.addUsage(symbolEntry.id, usage);
  }

  /**
   * Track JSDoc type references
   */
  private trackJsDocUsages(
    node: TypeScriptTypes.Node,
    sourceFile: TypeScriptTypes.SourceFile,
    typeChecker: TypeScriptTypes.TypeChecker
  ): void {
    if (!ts) return;

    // Check for JSDoc comments
    const jsDocs = ts.getJSDocTags(node);
    for (const tag of jsDocs) {
      // @param {Type} name
      // @returns {Type}
      // @type {Type}
      if (tag.comment) {
        const commentText = typeof tag.comment === 'string'
          ? tag.comment
          : tag.comment.map(c => c.text).join('');

        // Extract type references from JSDoc
        const typeMatches = commentText.match(/\{([^}]+)\}/g);
        if (typeMatches) {
          for (const match of typeMatches) {
            const typeName = match.slice(1, -1).trim();
            this.trackJsDocTypeReference(typeName, node, sourceFile, typeChecker);
          }
        }
      }
    }
  }

  /**
   * Track a type reference from JSDoc
   */
  private trackJsDocTypeReference(
    typeName: string,
    node: TypeScriptTypes.Node,
    sourceFile: TypeScriptTypes.SourceFile,
    _typeChecker: TypeScriptTypes.TypeChecker
  ): void {
    // Try to find the symbol by name
    const symbolEntry = this.symbolIndex.getSymbolByName(typeName, sourceFile.fileName);
    if (!symbolEntry) return;

    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    const usage: UsageContext = {
      file: sourceFile.fileName,
      line: line + 1,
      column: character,
      contextType: 'jsdoc',
      isRuntimeRelevant: false,
      enclosingNode: 'JSDoc comment',
      text: typeName,
    };

    this.addUsage(symbolEntry.id, usage);
  }

  /**
   * Check if node is a declaration (not a usage)
   */
  private isDeclaration(node: TypeScriptTypes.Identifier): boolean {
    if (!ts) return false;

    const parent = node.parent;

    // Variable declaration
    if (ts.isVariableDeclaration(parent) && parent.name === node) return true;

    // Function declaration
    if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;

    // Class declaration
    if (ts.isClassDeclaration(parent) && parent.name === node) return true;

    // Interface declaration
    if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;

    // Type alias declaration
    if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;

    // Enum declaration
    if (ts.isEnumDeclaration(parent) && parent.name === node) return true;

    // Property declaration
    if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;

    // Method declaration
    if (ts.isMethodDeclaration(parent) && parent.name === node) return true;

    // Parameter declaration
    if (ts.isParameter(parent) && parent.name === node) return true;

    // Import specifier (declaration, not usage)
    if (ts.isImportSpecifier(parent)) return true;

    // Export specifier (the name being exported)
    if (ts.isExportSpecifier(parent) && parent.name === node) return true;

    return false;
  }

  /**
   * Find symbol entry from TypeScript symbol
   */
  private findSymbolEntry(
    symbol: TypeScriptTypes.Symbol,
    node: TypeScriptTypes.Node,
    sourceFile: TypeScriptTypes.SourceFile
  ): { id: string } | null {
    // Try to find by name in the same file first
    const entry = this.symbolIndex.getSymbolByName(symbol.name, sourceFile.fileName);
    if (entry) return entry;

    // Try to find in all files
    const allSymbols = this.symbolIndex.searchSymbols(`^${symbol.name}$`);
    if (allSymbols.length > 0) {
      return allSymbols[0] ?? null;
    }

    return null;
  }

  /**
   * Classify the context type of a usage
   */
  private classifyContext(node: TypeScriptTypes.Identifier): UsageContextType {
    if (!ts) return 'unknown';

    const parent = node.parent;

    // Type annotation: x: Type
    if (ts.isTypeReferenceNode(parent)) return 'type';

    // Type assertion: x as Type
    if (ts.isAsExpression(parent) && parent.type && this.isInType(node, parent.type)) {
      return 'type';
    }

    // Type assertion (old style): <Type>x
    if (
      parent.kind === ts.SyntaxKind.TypeAssertionExpression &&
      'type' in parent &&
      this.isInType(node, parent.type as TypeScriptTypes.TypeNode)
    ) {
      return 'type';
    }

    // typeof X
    if (ts.isTypeQueryNode(parent)) return 'typeof';

    // Generic type parameter: <T extends Type>
    if (ts.isTypeParameterDeclaration(parent)) return 'generic';

    // implements Y
    if (ts.isHeritageClause(parent) && parent.token === ts.SyntaxKind.ImplementsKeyword) {
      return 'implements';
    }

    // extends Y (for class)
    if (ts.isHeritageClause(parent) && parent.token === ts.SyntaxKind.ExtendsKeyword) {
      return 'extends';
    }

    // Decorator: @Decorator
    if (ts.isDecorator(parent) || this.isInDecorator(node)) {
      return 'decorator';
    }

    // Import
    if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) {
      const importDecl = this.findAncestor(parent, ts.isImportDeclaration);
      if (importDecl && ts.isImportDeclaration(importDecl)) {
        const clause = importDecl.importClause;
        if (clause?.isTypeOnly) return 'import_type';
      }
      return 'import';
    }

    // Export
    if (ts.isExportSpecifier(parent)) {
      const exportDecl = this.findAncestor(parent, ts.isExportDeclaration);
      if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.isTypeOnly) {
        return 'export_type';
      }
      return 'export';
    }

    // Call expression: x()
    if (ts.isCallExpression(parent) && parent.expression === node) return 'value';

    // New expression: new X()
    if (ts.isNewExpression(parent) && parent.expression === node) return 'value';

    // Property access: x.y
    if (ts.isPropertyAccessExpression(parent) && parent.expression === node) return 'value';

    // Element access: x[y]
    if (ts.isElementAccessExpression(parent) && parent.expression === node) return 'value';

    // Binary expression: x + y, x = y
    if (ts.isBinaryExpression(parent)) return 'value';

    // Default: value
    return 'value';
  }

  /**
   * Check if a context is runtime relevant
   */
  private isRuntimeRelevantContext(
    contextType: UsageContextType,
    _node: TypeScriptTypes.Node
  ): boolean {
    switch (contextType) {
      case 'value':
      case 'extends':  // Class extension is runtime
      case 'decorator':  // Decorators run at runtime
        return true;

      case 'type':
      case 'typeof':
      case 'generic':
      case 'implements':
      case 'jsdoc':
      case 'import_type':
      case 'export_type':
        return false;

      case 'import':
      case 'export':
        // Import/export could be either - check if used elsewhere
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if node is within a type node
   */
  private isInType(node: TypeScriptTypes.Node, typeNode: TypeScriptTypes.Node): boolean {
    let current: TypeScriptTypes.Node | undefined = node;
    while (current) {
      if (current === typeNode) return true;
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if node is within a decorator
   */
  private isInDecorator(node: TypeScriptTypes.Node): boolean {
    if (!ts) return false;

    let current: TypeScriptTypes.Node | undefined = node;
    while (current) {
      if (ts.isDecorator(current)) return true;
      current = current.parent;
    }
    return false;
  }

  /**
   * Find ancestor node of specific type
   */
  private findAncestor(
    node: TypeScriptTypes.Node,
    predicate: (n: TypeScriptTypes.Node) => boolean
  ): TypeScriptTypes.Node | undefined {
    let current: TypeScriptTypes.Node | undefined = node.parent;
    while (current) {
      if (predicate(current)) return current;
      current = current.parent;
    }
    return undefined;
  }

  /**
   * Get description of enclosing node for debugging
   */
  private getEnclosingNodeDescription(node: TypeScriptTypes.Node): string {
    if (!ts) return 'unknown';

    const parent = node.parent;

    if (ts.isCallExpression(parent)) return 'call expression';
    if (ts.isNewExpression(parent)) return 'new expression';
    if (ts.isPropertyAccessExpression(parent)) return 'property access';
    if (ts.isTypeReferenceNode(parent)) return 'type reference';
    if (ts.isVariableDeclaration(parent)) return 'variable declaration';
    if (ts.isParameter(parent)) return 'parameter';
    if (ts.isBinaryExpression(parent)) return 'binary expression';
    if (ts.isReturnStatement(parent)) return 'return statement';
    if (ts.isIfStatement(parent)) return 'if statement';

    return parent.kind.toString();
  }

  /**
   * Add a usage to the tracking map
   */
  private addUsage(symbolId: string, usage: UsageContext): void {
    let usages = this.usages.get(symbolId);
    if (!usages) {
      usages = [];
      this.usages.set(symbolId, usages);
    }

    // Check limit
    if (usages.length < this.options.maxUsagesPerSymbol) {
      usages.push(usage);
    }
  }

  /**
   * Build usage summaries from raw usages
   */
  private buildSummaries(): void {
    // Initialize summaries for all symbols
    for (const symbol of this.symbolIndex.getAllSymbols()) {
      const usages = this.usages.get(symbol.id) || [];
      const summary = createEmptyUsageSummary(symbol.id);

      for (const usage of usages) {
        summary.totalUsages++;
        summary.usageLocations.push(usage);

        switch (usage.contextType) {
          case 'value':
          case 'extends':
          case 'decorator':
            summary.valueUsages++;
            break;
          case 'type':
          case 'typeof':
          case 'generic':
          case 'implements':
            summary.typeUsages++;
            break;
          case 'jsdoc':
            summary.jsDocUsages++;
            break;
          case 'import':
          case 'import_type':
            summary.importUsages++;
            break;
          case 'export':
          case 'export_type':
            summary.exportUsages++;
            break;
        }

        if (usage.isRuntimeRelevant) {
          summary.hasRuntimeUsage = true;
        }
      }

      // Determine if type-only used
      summary.isTypeOnlyUsed = summary.totalUsages > 0 &&
        !summary.hasRuntimeUsage &&
        (summary.typeUsages > 0 || summary.jsDocUsages > 0);

      this.summaries.set(symbol.id, summary);
    }
  }
}

/**
 * Create a UsageTracker instance
 */
export function createUsageTracker(
  programManager: TSProgramManager,
  symbolIndex: SymbolIndex,
  options?: UsageTrackerOptions
): UsageTracker {
  return new UsageTracker(programManager, symbolIndex, options);
}
