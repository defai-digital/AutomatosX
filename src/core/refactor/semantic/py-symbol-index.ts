/**
 * PySymbolIndex - Python Symbol Indexing
 *
 * Indexes Python symbols extracted from the AST bridge for efficient
 * lookup by file, name, and kind.
 *
 * @module core/refactor/semantic/py-symbol-index
 * @since v12.10.0
 */

import { resolve } from 'path';
import { logger } from '../../../shared/logging/logger.js';
import type { PyProgramManager } from './py-program-manager.js';
import type {
  PySymbol,
  PySymbolKind,
  PySymbolNamespace,
  PySymbolIndexOptions,
  PyBridgeSymbol,
} from './py-types.js';
import { classifyPyNamespace } from './py-types.js';

/**
 * PySymbolIndex - Indexes Python symbols for efficient lookup
 *
 * Features:
 * - Index by file, name, and unique ID
 * - Filter by privacy, exports, and kind
 * - Memory-efficient with configurable limits
 */
export class PySymbolIndex {
  private symbols: Map<string, PySymbol> = new Map();
  private byFile: Map<string, PySymbol[]> = new Map();
  private byName: Map<string, PySymbol[]> = new Map();
  private byKind: Map<PySymbolKind, PySymbol[]> = new Map();
  private programManager: PyProgramManager;
  private options: Required<PySymbolIndexOptions>;

  constructor(programManager: PyProgramManager, options: PySymbolIndexOptions = {}) {
    this.programManager = programManager;
    this.options = {
      includePrivate: options.includePrivate ?? true,
      exportsOnly: options.exportsOnly ?? false,
      maxSymbols: options.maxSymbols ?? 100000,
    };
  }

  /**
   * Index symbols from a Python file
   */
  async indexFile(filePath: string): Promise<PySymbol[]> {
    const absolutePath = resolve(filePath);
    const rawSymbols = await this.programManager.getSymbols(absolutePath);
    const indexed: PySymbol[] = [];

    for (const raw of rawSymbols) {
      // Filter based on options
      if (!this.options.includePrivate && raw.isPrivate) continue;
      if (this.options.exportsOnly && !raw.isExported) continue;
      if (this.symbols.size >= this.options.maxSymbols) {
        logger.warn('PySymbolIndex reached max symbols limit', {
          limit: this.options.maxSymbols,
        });
        break;
      }

      const symbol = this.createSymbol(raw, absolutePath);
      this.addSymbol(symbol);
      indexed.push(symbol);
    }

    logger.debug('PySymbolIndex indexed file', {
      file: absolutePath,
      symbols: indexed.length,
    });

    return indexed;
  }

  /**
   * Index symbols from multiple Python files
   */
  async indexFiles(filePaths: string[]): Promise<number> {
    let total = 0;
    for (const filePath of filePaths) {
      const symbols = await this.indexFile(filePath);
      total += symbols.length;
    }
    return total;
  }

  /**
   * Get a symbol by its unique ID
   */
  getSymbol(id: string): PySymbol | undefined {
    return this.symbols.get(id);
  }

  /**
   * Get all symbols in a specific file
   */
  getSymbolsInFile(filePath: string): PySymbol[] {
    return this.byFile.get(resolve(filePath)) || [];
  }

  /**
   * Get all symbols with a specific name
   */
  getSymbolsByName(name: string): PySymbol[] {
    return this.byName.get(name) || [];
  }

  /**
   * Get all symbols of a specific kind
   */
  getSymbolsByKind(kind: PySymbolKind): PySymbol[] {
    return this.byKind.get(kind) || [];
  }

  /**
   * Get all indexed symbols
   */
  getAllSymbols(): PySymbol[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Get all import symbols
   */
  getImports(): PySymbol[] {
    return this.getSymbolsByKind('import');
  }

  /**
   * Get all function symbols (including methods)
   */
  getFunctions(): PySymbol[] {
    return [
      ...this.getSymbolsByKind('function'),
      ...this.getSymbolsByKind('method'),
    ];
  }

  /**
   * Get all class symbols
   */
  getClasses(): PySymbol[] {
    return this.getSymbolsByKind('class');
  }

  /**
   * Get all variable symbols
   */
  getVariables(): PySymbol[] {
    return this.getSymbolsByKind('variable');
  }

  /**
   * Check if a symbol exists
   */
  hasSymbol(id: string): boolean {
    return this.symbols.has(id);
  }

  /**
   * Get the number of indexed symbols
   */
  get size(): number {
    return this.symbols.size;
  }

  /**
   * Get indexed file count
   */
  get fileCount(): number {
    return this.byFile.size;
  }

  /**
   * Clear all indexed symbols
   */
  clear(): void {
    this.symbols.clear();
    this.byFile.clear();
    this.byName.clear();
    this.byKind.clear();
    logger.debug('PySymbolIndex cleared');
  }

  /**
   * Remove symbols for a specific file
   */
  removeFile(filePath: string): number {
    const absolutePath = resolve(filePath);
    const fileSymbols = this.byFile.get(absolutePath) || [];

    for (const symbol of fileSymbols) {
      this.symbols.delete(symbol.id);

      // Remove from name index
      const nameSymbols = this.byName.get(symbol.name);
      if (nameSymbols) {
        const filtered = nameSymbols.filter(s => s.id !== symbol.id);
        if (filtered.length > 0) {
          this.byName.set(symbol.name, filtered);
        } else {
          this.byName.delete(symbol.name);
        }
      }

      // Remove from kind index
      const kindSymbols = this.byKind.get(symbol.kind);
      if (kindSymbols) {
        const filtered = kindSymbols.filter(s => s.id !== symbol.id);
        if (filtered.length > 0) {
          this.byKind.set(symbol.kind, filtered);
        } else {
          this.byKind.delete(symbol.kind);
        }
      }
    }

    this.byFile.delete(absolutePath);
    return fileSymbols.length;
  }

  /**
   * Create a PySymbol from raw bridge data
   */
  private createSymbol(raw: PyBridgeSymbol, file: string): PySymbol {
    const kind = raw.kind as PySymbolKind;
    const id = `${file}:${raw.name}:${kind}`;

    return {
      id,
      name: raw.name,
      kind,
      file,
      line: raw.line,
      column: raw.column,
      isPrivate: raw.isPrivate,
      isDunder: raw.isDunder,
      isExported: raw.isExported,
      isDynamic: false, // Will be set by usage tracker
      decorators: raw.decorators,
      parentClass: raw.parentClass,
      namespace: classifyPyNamespace(kind),
    };
  }

  /**
   * Add a symbol to all indexes
   */
  private addSymbol(symbol: PySymbol): void {
    // Main index
    this.symbols.set(symbol.id, symbol);

    // By file
    if (!this.byFile.has(symbol.file)) {
      this.byFile.set(symbol.file, []);
    }
    this.byFile.get(symbol.file)!.push(symbol);

    // By name
    if (!this.byName.has(symbol.name)) {
      this.byName.set(symbol.name, []);
    }
    this.byName.get(symbol.name)!.push(symbol);

    // By kind
    if (!this.byKind.has(symbol.kind)) {
      this.byKind.set(symbol.kind, []);
    }
    this.byKind.get(symbol.kind)!.push(symbol);
  }
}

/**
 * Create a PySymbolIndex instance
 */
export function createPySymbolIndex(
  programManager: PyProgramManager,
  options?: PySymbolIndexOptions
): PySymbolIndex {
  return new PySymbolIndex(programManager, options);
}
