/**
 * SymbolIndex - Symbol Resolution and Namespace Classification
 *
 * Builds a searchable index of all symbols with namespace classification
 * (value/type/both) and export tracking. Handles declaration merging,
 * re-exports, and ambient declarations.
 *
 * @module core/refactor/semantic/symbol-index
 * @since v12.9.0
 */

import { relative } from 'path';
import { logger } from '../../../shared/logging/logger.js';
import type { TSProgramManager } from './ts-program-manager.js';
import type {
  SymbolEntry,
  SymbolKind,
  SymbolNamespace,
  DeclarationInfo,
  SymbolIndexOptions,
} from './types.js';

// Type-only import for TypeScript API types
import type * as TypeScriptTypes from 'typescript';

// Lazy-loaded TypeScript module reference
let ts: typeof TypeScriptTypes | null = null;

/**
 * SymbolIndex - Indexes all symbols in a TypeScript program
 *
 * Features:
 * - Full symbol extraction using TypeChecker
 * - Namespace classification (value/type/both)
 * - Export tracking (direct, re-export, barrel)
 * - Declaration merging handling
 * - Ambient declaration detection
 */
export class SymbolIndex {
  private symbols: Map<string, SymbolEntry> = new Map();
  private symbolsByFile: Map<string, Set<string>> = new Map();
  private exportedSymbols: Map<string, Set<string>> = new Map();
  private programManager: TSProgramManager;
  private options: Required<SymbolIndexOptions>;
  private rootDir: string;
  private indexed = false;

  constructor(
    programManager: TSProgramManager,
    rootDir: string,
    options: SymbolIndexOptions = {}
  ) {
    this.programManager = programManager;
    this.rootDir = rootDir;
    this.options = {
      includeAmbient: options.includeAmbient ?? false,
      includeNodeModules: options.includeNodeModules ?? false,
      maxSymbols: options.maxSymbols ?? 100000,
    };
  }

  /**
   * Build the symbol index from the TypeScript program
   */
  async buildIndex(): Promise<void> {
    const startTime = Date.now();

    // Get TypeScript module
    ts = await import('typescript');

    const program = await this.programManager.getProgram();
    const typeChecker = program.getTypeChecker();

    // Clear previous index
    this.symbols.clear();
    this.symbolsByFile.clear();
    this.exportedSymbols.clear();

    // Process each source file
    for (const sourceFile of program.getSourceFiles()) {
      // Skip declaration files unless includeAmbient
      if (sourceFile.isDeclarationFile && !this.options.includeAmbient) {
        continue;
      }

      // Skip node_modules unless includeNodeModules
      if (sourceFile.fileName.includes('node_modules') && !this.options.includeNodeModules) {
        continue;
      }

      // Check symbol limit
      if (this.symbols.size >= this.options.maxSymbols) {
        logger.warn('Symbol limit reached', { limit: this.options.maxSymbols });
        break;
      }

      await this.indexSourceFile(sourceFile, typeChecker);
    }

    this.indexed = true;

    const duration = Date.now() - startTime;
    logger.debug('Symbol index built', {
      symbols: this.symbols.size,
      files: this.symbolsByFile.size,
      durationMs: duration,
    });
  }

  /**
   * Check if index is built
   */
  isIndexed(): boolean {
    return this.indexed;
  }

  /**
   * Get a symbol by ID
   */
  getSymbol(id: string): SymbolEntry | undefined {
    return this.symbols.get(id);
  }

  /**
   * Get a symbol by name and file
   */
  getSymbolByName(name: string, file: string): SymbolEntry | undefined {
    const fileSymbols = this.symbolsByFile.get(file);
    if (!fileSymbols) return undefined;

    for (const id of fileSymbols) {
      const symbol = this.symbols.get(id);
      if (symbol?.name === name) {
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * Get all symbols in a file
   */
  getSymbolsInFile(file: string): SymbolEntry[] {
    const fileSymbols = this.symbolsByFile.get(file);
    if (!fileSymbols) return [];

    const result: SymbolEntry[] = [];
    for (const id of fileSymbols) {
      const symbol = this.symbols.get(id);
      if (symbol) result.push(symbol);
    }
    return result;
  }

  /**
   * Get all exported symbols from a file
   */
  getExportedSymbols(file: string): SymbolEntry[] {
    const exported = this.exportedSymbols.get(file);
    if (!exported) return [];

    const result: SymbolEntry[] = [];
    for (const id of exported) {
      const symbol = this.symbols.get(id);
      if (symbol) result.push(symbol);
    }
    return result;
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): SymbolEntry[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Get symbols by kind
   */
  getSymbolsByKind(kind: SymbolKind): SymbolEntry[] {
    return Array.from(this.symbols.values()).filter(s => s.kind === kind);
  }

  /**
   * Get symbols by namespace
   */
  getSymbolsByNamespace(namespace: SymbolNamespace): SymbolEntry[] {
    return Array.from(this.symbols.values()).filter(s => s.namespace === namespace);
  }

  /**
   * Search symbols by name pattern
   */
  searchSymbols(pattern: string | RegExp): SymbolEntry[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return Array.from(this.symbols.values()).filter(s => regex.test(s.name));
  }

  /**
   * Index a single source file
   */
  private async indexSourceFile(
    sourceFile: TypeScriptTypes.SourceFile,
    typeChecker: TypeScriptTypes.TypeChecker
  ): Promise<void> {
    if (!ts) return;

    const fileName = sourceFile.fileName;
    const relativePath = relative(this.rootDir, fileName);

    // Initialize file sets
    if (!this.symbolsByFile.has(fileName)) {
      this.symbolsByFile.set(fileName, new Set());
    }
    if (!this.exportedSymbols.has(fileName)) {
      this.exportedSymbols.set(fileName, new Set());
    }

    // Get module symbol for export analysis
    const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
    const exportedNames = new Set<string>();

    if (moduleSymbol) {
      const exports = typeChecker.getExportsOfModule(moduleSymbol);
      for (const exp of exports) {
        exportedNames.add(exp.name);
      }
    }

    // Visit all nodes
    const visit = (node: TypeScriptTypes.Node): void => {
      if (!ts) return;

      // Check symbol limit
      if (this.symbols.size >= this.options.maxSymbols) {
        return;
      }

      const symbol = this.extractSymbolFromNode(node, typeChecker, sourceFile);
      if (symbol) {
        // Check if exported
        symbol.isExported = exportedNames.has(symbol.name) ||
          this.hasExportModifier(node);

        // Add to indexes
        this.symbols.set(symbol.id, symbol);
        this.symbolsByFile.get(fileName)?.add(symbol.id);

        if (symbol.isExported) {
          this.exportedSymbols.get(fileName)?.add(symbol.id);
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  /**
   * Extract symbol entry from an AST node
   */
  private extractSymbolFromNode(
    node: TypeScriptTypes.Node,
    typeChecker: TypeScriptTypes.TypeChecker,
    sourceFile: TypeScriptTypes.SourceFile
  ): SymbolEntry | null {
    if (!ts) return null;

    const symbol = typeChecker.getSymbolAtLocation(
      this.getNameNode(node) || node
    );

    if (!symbol) return null;

    // Get symbol kind
    const kind = this.classifySymbolKind(node, symbol);
    if (kind === 'unknown') return null;

    // Get position
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    // Create ID
    const name = symbol.name;
    const file = sourceFile.fileName;
    const id = `${file}:${name}:${kind}`;

    // Check for existing (declaration merging)
    const existing = this.symbols.get(id);
    if (existing) {
      // Add declaration to existing symbol
      existing.declarations.push(this.createDeclarationInfo(node, sourceFile, line, character));
      // Update namespace if needed
      existing.namespace = this.mergeNamespaces(existing.namespace, this.classifyNamespace(symbol));
      return null; // Don't create new entry
    }

    // Classify namespace
    const namespace = this.classifyNamespace(symbol);

    // Check if ambient
    const isAmbient = this.isAmbientNode(node);

    // Check if re-export
    const { isReExport, originalModule } = this.checkReExport(node, typeChecker);

    return {
      id,
      name,
      kind,
      flags: symbol.flags,
      declarations: [this.createDeclarationInfo(node, sourceFile, line, character)],
      isExported: false, // Set by caller
      isAmbient,
      namespace,
      file,
      line: line + 1, // 1-indexed
      isReExport,
      originalModule,
    };
  }

  /**
   * Get the name node from a declaration
   */
  private getNameNode(node: TypeScriptTypes.Node): TypeScriptTypes.Node | undefined {
    if (!ts) return undefined;

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name;
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name;
    }
    if (ts.isClassDeclaration(node) && node.name) {
      return node.name;
    }
    if (ts.isInterfaceDeclaration(node)) {
      return node.name;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      return node.name;
    }
    if (ts.isEnumDeclaration(node)) {
      return node.name;
    }
    if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name;
    }
    if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name;
    }
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      return node.name;
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      return node.name;
    }

    return undefined;
  }

  /**
   * Classify symbol kind from node and symbol
   */
  private classifySymbolKind(
    node: TypeScriptTypes.Node,
    _symbol: TypeScriptTypes.Symbol
  ): SymbolKind {
    if (!ts) return 'unknown';

    if (ts.isVariableDeclaration(node)) return 'variable';
    if (ts.isFunctionDeclaration(node)) return 'function';
    if (ts.isClassDeclaration(node)) return 'class';
    if (ts.isInterfaceDeclaration(node)) return 'interface';
    if (ts.isTypeAliasDeclaration(node)) return 'type';
    if (ts.isEnumDeclaration(node)) return 'enum';
    if (ts.isEnumMember(node)) return 'enum_member';
    if (ts.isModuleDeclaration(node)) return 'namespace';
    if (ts.isPropertyDeclaration(node)) return 'property';
    if (ts.isMethodDeclaration(node)) return 'method';
    if (ts.isGetAccessorDeclaration(node)) return 'getter';
    if (ts.isSetAccessorDeclaration(node)) return 'setter';
    if (ts.isConstructorDeclaration(node)) return 'constructor';
    if (ts.isParameter(node)) return 'parameter';
    if (ts.isIndexSignatureDeclaration(node)) return 'index_signature';
    if (ts.isCallSignatureDeclaration(node)) return 'call_signature';

    return 'unknown';
  }

  /**
   * Classify symbol namespace (value/type/both)
   */
  private classifyNamespace(symbol: TypeScriptTypes.Symbol): SymbolNamespace {
    if (!ts) return 'value';

    const flags = symbol.flags;

    // Type-only: Interface, TypeAlias, TypeParameter
    const typeOnlyFlags =
      ts.SymbolFlags.Interface |
      ts.SymbolFlags.TypeAlias |
      ts.SymbolFlags.TypeParameter;

    // Value-only: FunctionScopedVariable, BlockScopedVariable, Function (non-overloaded)
    const valueOnlyFlags =
      ts.SymbolFlags.FunctionScopedVariable |
      ts.SymbolFlags.BlockScopedVariable |
      ts.SymbolFlags.Function;

    // Both: Class, Enum, Module/Namespace
    const bothFlags =
      ts.SymbolFlags.Class |
      ts.SymbolFlags.Enum |
      ts.SymbolFlags.Module |
      ts.SymbolFlags.ValueModule;

    // Check 'both' first (more specific)
    if (flags & bothFlags) return 'both';

    // Check type-only
    if ((flags & typeOnlyFlags) && !(flags & valueOnlyFlags)) return 'type';

    // Default to value
    return 'value';
  }

  /**
   * Merge namespaces (for declaration merging)
   */
  private mergeNamespaces(a: SymbolNamespace, b: SymbolNamespace): SymbolNamespace {
    if (a === 'both' || b === 'both') return 'both';
    if (a !== b) return 'both';
    return a;
  }

  /**
   * Create declaration info from a node
   */
  private createDeclarationInfo(
    node: TypeScriptTypes.Node,
    sourceFile: TypeScriptTypes.SourceFile,
    line: number,
    column: number
  ): DeclarationInfo {
    if (!ts) {
      return {
        file: sourceFile.fileName,
        line: line + 1,
        column,
        syntaxKind: node.kind,
        isTypeOnly: false,
        isAmbient: false,
        text: '',
      };
    }

    // Get text (truncated)
    let text = node.getText(sourceFile);
    if (text.length > 200) {
      text = text.substring(0, 197) + '...';
    }

    return {
      file: sourceFile.fileName,
      line: line + 1, // 1-indexed
      column,
      syntaxKind: node.kind,
      isTypeOnly: this.isTypeOnlyDeclaration(node),
      isAmbient: this.isAmbientNode(node),
      text,
    };
  }

  /**
   * Check if a node is a type-only declaration
   */
  private isTypeOnlyDeclaration(node: TypeScriptTypes.Node): boolean {
    if (!ts) return false;

    // import type { X }
    if (ts.isImportSpecifier(node)) {
      const importClause = node.parent?.parent;
      if (importClause && ts.isImportClause(importClause)) {
        return importClause.isTypeOnly;
      }
    }

    // export type { X }
    if (ts.isExportSpecifier(node)) {
      const exportDecl = node.parent?.parent;
      if (exportDecl && ts.isExportDeclaration(exportDecl)) {
        return exportDecl.isTypeOnly;
      }
    }

    // Interface, type alias
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return true;
    }

    return false;
  }

  /**
   * Check if a node is ambient (declare, .d.ts)
   */
  private isAmbientNode(node: TypeScriptTypes.Node): boolean {
    const typescript = ts;
    if (!typescript) return false;

    // Check for declare modifier
    const modifiers = typescript.canHaveModifiers(node) ? typescript.getModifiers(node) : undefined;
    if (modifiers?.some(m => m.kind === typescript.SyntaxKind.DeclareKeyword)) {
      return true;
    }

    // Check if in .d.ts file
    const sourceFile = node.getSourceFile();
    if (sourceFile.isDeclarationFile) {
      return true;
    }

    // Check parent for ambient context
    let parent = node.parent;
    while (parent) {
      if (typescript.isModuleDeclaration(parent)) {
        const parentModifiers = typescript.canHaveModifiers(parent) ? typescript.getModifiers(parent) : undefined;
        if (parentModifiers?.some(m => m.kind === typescript.SyntaxKind.DeclareKeyword)) {
          return true;
        }
      }
      parent = parent.parent;
    }

    return false;
  }

  /**
   * Check if node has export modifier
   */
  private hasExportModifier(node: TypeScriptTypes.Node): boolean {
    const typescript = ts;
    if (!typescript) return false;

    const modifiers = typescript.canHaveModifiers(node) ? typescript.getModifiers(node) : undefined;
    return modifiers?.some(m => m.kind === typescript.SyntaxKind.ExportKeyword) ?? false;
  }

  /**
   * Check if this is a re-export
   */
  private checkReExport(
    node: TypeScriptTypes.Node,
    typeChecker: TypeScriptTypes.TypeChecker
  ): { isReExport: boolean; originalModule?: string } {
    if (!ts) return { isReExport: false };

    // export { X } from './module'
    if (ts.isExportSpecifier(node)) {
      const exportDecl = node.parent?.parent;
      if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier) {
        const moduleSymbol = typeChecker.getSymbolAtLocation(exportDecl.moduleSpecifier);
        if (moduleSymbol) {
          return {
            isReExport: true,
            originalModule: moduleSymbol.name,
          };
        }
      }
    }

    // export * from './module'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.exportClause) {
      const moduleSymbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);
      if (moduleSymbol) {
        return {
          isReExport: true,
          originalModule: moduleSymbol.name,
        };
      }
    }

    return { isReExport: false };
  }
}

/**
 * Create a SymbolIndex instance
 */
export function createSymbolIndex(
  programManager: TSProgramManager,
  rootDir: string,
  options?: SymbolIndexOptions
): SymbolIndex {
  return new SymbolIndex(programManager, rootDir, options);
}
