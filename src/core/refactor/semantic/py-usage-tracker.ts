/**
 * PyUsageTracker - Python Symbol Usage Tracking
 *
 * Tracks usages of Python symbols across files, distinguishing between
 * value and type annotation contexts.
 *
 * @module core/refactor/semantic/py-usage-tracker
 * @since v12.10.0
 */

import { resolve } from 'path';
import { logger } from '../../../shared/logging/logger.js';
import type { PyProgramManager } from './py-program-manager.js';
import type { PySymbolIndex } from './py-symbol-index.js';
import type {
  PySymbol,
  PyUsage,
  PyUsageSummary,
  PyUsageContextType,
  PyUsageTrackerOptions,
  PyBridgeUsage,
  PyDynamicPattern,
} from './py-types.js';
import { createEmptyPyUsageSummary } from './py-types.js';

/**
 * PyUsageTracker - Tracks symbol usages across Python files
 *
 * Features:
 * - Track value vs type annotation usages
 * - Track decorator usages
 * - Generate usage summaries per symbol
 * - Identify type-only usage patterns
 * - Detect dynamic access patterns
 */
export class PyUsageTracker {
  private usages: Map<string, PyUsage[]> = new Map();
  private summaries: Map<string, PyUsageSummary> = new Map();
  private dynamicPatterns: Map<string, PyDynamicPattern[]> = new Map();
  private programManager: PyProgramManager;
  private symbolIndex: PySymbolIndex;
  private options: Required<PyUsageTrackerOptions>;

  constructor(
    programManager: PyProgramManager,
    symbolIndex: PySymbolIndex,
    options: PyUsageTrackerOptions = {}
  ) {
    this.programManager = programManager;
    this.symbolIndex = symbolIndex;
    this.options = {
      trackTypeAnnotations: options.trackTypeAnnotations ?? true,
      trackDecorators: options.trackDecorators ?? true,
      maxUsagesPerSymbol: options.maxUsagesPerSymbol ?? 1000,
    };
  }

  /**
   * Track usages from a Python file
   */
  async trackFile(filePath: string): Promise<number> {
    const absolutePath = resolve(filePath);

    // Get usages and dynamic patterns from Python bridge
    const rawUsages = await this.programManager.getUsages(absolutePath);
    const patterns = await this.programManager.getDynamicPatterns(absolutePath);

    // Store dynamic patterns for this file
    this.dynamicPatterns.set(absolutePath, patterns);

    let trackedCount = 0;

    // Process usages for each symbol name
    for (const [symbolName, bridgeUsages] of Object.entries(rawUsages)) {
      // Find matching symbols in the index
      const symbols = this.symbolIndex.getSymbolsByName(symbolName);

      for (const symbol of symbols) {
        const existingUsages = this.usages.get(symbol.id) || [];

        for (const raw of bridgeUsages) {
          // Check max usages limit
          if (existingUsages.length >= this.options.maxUsagesPerSymbol) {
            break;
          }

          const usage = this.createUsage(raw, absolutePath);

          // Filter based on options
          if (!this.options.trackTypeAnnotations && usage.contextType === 'type') {
            continue;
          }
          if (!this.options.trackDecorators && usage.contextType === 'decorator') {
            continue;
          }

          existingUsages.push(usage);
          trackedCount++;
        }

        this.usages.set(symbol.id, existingUsages);

        // Mark symbol as dynamic if patterns affect it
        if (patterns.length > 0) {
          symbol.isDynamic = true;
        }

        // Invalidate cached summary
        this.summaries.delete(symbol.id);
      }
    }

    logger.debug('PyUsageTracker tracked file', {
      file: absolutePath,
      usages: trackedCount,
      dynamicPatterns: patterns.length,
    });

    return trackedCount;
  }

  /**
   * Track usages from multiple Python files
   */
  async trackFiles(filePaths: string[]): Promise<number> {
    let total = 0;
    for (const filePath of filePaths) {
      const count = await this.trackFile(filePath);
      total += count;
    }
    return total;
  }

  /**
   * Get all usages of a symbol
   */
  getUsages(symbolId: string): PyUsage[] {
    return this.usages.get(symbolId) || [];
  }

  /**
   * Get usages by symbol name (across all files)
   */
  getUsagesByName(symbolName: string): PyUsage[] {
    const allUsages: PyUsage[] = [];
    const symbols = this.symbolIndex.getSymbolsByName(symbolName);

    for (const symbol of symbols) {
      allUsages.push(...this.getUsages(symbol.id));
    }

    return allUsages;
  }

  /**
   * Get usage summary for a symbol
   */
  getSummary(symbol: PySymbol): PyUsageSummary {
    // Return cached summary if available
    const cached = this.summaries.get(symbol.id);
    if (cached) return cached;

    const usages = this.getUsages(symbol.id);
    const summary = this.buildSummary(symbol, usages);

    this.summaries.set(symbol.id, summary);
    return summary;
  }

  /**
   * Get external (non-self-reference) usages for a symbol
   */
  getExternalUsages(symbolId: string): PyUsage[] {
    return this.getUsages(symbolId).filter(u => !u.isSelfReference);
  }

  /**
   * Check if a symbol has any runtime usages
   */
  hasRuntimeUsages(symbolId: string): boolean {
    return this.getUsages(symbolId).some(u => u.isRuntimeRelevant);
  }

  /**
   * Check if a symbol is only used in type annotations
   */
  isTypeOnlyUsed(symbolId: string): boolean {
    const usages = this.getExternalUsages(symbolId);
    if (usages.length === 0) return false;
    return usages.every(u => u.contextType === 'type');
  }

  /**
   * Get dynamic patterns for a file
   */
  getDynamicPatterns(filePath: string): PyDynamicPattern[] {
    return this.dynamicPatterns.get(resolve(filePath)) || [];
  }

  /**
   * Check if any dynamic patterns affect a symbol
   */
  hasDynamicAccess(symbol: PySymbol): boolean {
    return symbol.isDynamic || this.getDynamicPatterns(symbol.file).length > 0;
  }

  /**
   * Get the number of tracked usages
   */
  get totalUsages(): number {
    let total = 0;
    for (const usages of this.usages.values()) {
      total += usages.length;
    }
    return total;
  }

  /**
   * Get the number of files with dynamic patterns
   */
  get filesWithDynamicPatterns(): number {
    return this.dynamicPatterns.size;
  }

  /**
   * Clear all tracked usages
   */
  clear(): void {
    this.usages.clear();
    this.summaries.clear();
    this.dynamicPatterns.clear();
    logger.debug('PyUsageTracker cleared');
  }

  /**
   * Remove usages from a specific file
   */
  removeFile(filePath: string): void {
    const absolutePath = resolve(filePath);

    // Remove usages that reference this file
    for (const [symbolId, usages] of this.usages.entries()) {
      const filtered = usages.filter(u => u.file !== absolutePath);
      if (filtered.length !== usages.length) {
        this.usages.set(symbolId, filtered);
        this.summaries.delete(symbolId);
      }
    }

    // Remove dynamic patterns for this file
    this.dynamicPatterns.delete(absolutePath);
  }

  /**
   * Create a PyUsage from raw bridge data
   */
  private createUsage(raw: PyBridgeUsage, file: string): PyUsage {
    const contextType = this.mapContextType(raw.context);
    return {
      file,
      line: raw.line,
      column: raw.column,
      contextType,
      isRuntimeRelevant: this.isRuntimeContext(contextType),
      isSelfReference: raw.isSelfReference,
    };
  }

  /**
   * Map raw context string to PyUsageContextType
   */
  private mapContextType(context: string): PyUsageContextType {
    switch (context) {
      case 'value':
        return 'value';
      case 'type':
        return 'type';
      case 'decorator':
        return 'decorator';
      case 'attribute':
        return 'attribute';
      case 'import':
        return 'import';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if a context type represents runtime usage
   */
  private isRuntimeContext(contextType: PyUsageContextType): boolean {
    switch (contextType) {
      case 'value':
      case 'attribute':
      case 'decorator':
        return true;
      case 'type':
      case 'import':
      case 'unknown':
        return false;
    }
  }

  /**
   * Build usage summary for a symbol
   */
  private buildSummary(symbol: PySymbol, usages: PyUsage[]): PyUsageSummary {
    const summary = createEmptyPyUsageSummary(symbol.id);

    summary.totalUsages = usages.length;

    for (const usage of usages) {
      switch (usage.contextType) {
        case 'value':
        case 'attribute':
          summary.valueUsages++;
          break;
        case 'type':
          summary.typeUsages++;
          break;
        case 'decorator':
          summary.decoratorUsages++;
          break;
        case 'import':
          summary.importUsages++;
          break;
      }
    }

    // Calculate derived properties
    summary.hasRuntimeUsage = usages.some(u => u.isRuntimeRelevant && !u.isSelfReference);

    const externalUsages = usages.filter(u => !u.isSelfReference);
    summary.isTypeOnlyUsed =
      externalUsages.length > 0 &&
      externalUsages.every(u => u.contextType === 'type');

    summary.dynamicAccessPossible = this.hasDynamicAccess(symbol);
    summary.usageLocations = usages;

    return summary;
  }
}

/**
 * Create a PyUsageTracker instance
 */
export function createPyUsageTracker(
  programManager: PyProgramManager,
  symbolIndex: PySymbolIndex,
  options?: PyUsageTrackerOptions
): PyUsageTracker {
  return new PyUsageTracker(programManager, symbolIndex, options);
}
