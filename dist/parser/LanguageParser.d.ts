/**
 * LanguageParser.ts
 *
 * Unified interface for language-specific parsers
 * Allows multiple language parsers to be used interchangeably
 */
import Parser from 'tree-sitter';
/**
 * Symbol extracted from source code
 */
export interface Symbol {
    name: string;
    kind: SymbolKind;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    metadata?: Record<string, any>;
}
/**
 * Symbol types we extract
 * Different languages may support different subsets
 */
export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'method' | 'enum' | 'struct' | 'trait' | 'module';
/**
 * Parse result
 */
export interface ParseResult {
    symbols: Symbol[];
    parseTime: number;
    nodeCount: number;
}
/**
 * Language parser interface
 * All language-specific parsers must implement this interface
 */
export interface LanguageParser {
    /**
     * Language identifier (e.g., 'typescript', 'python', 'go', 'rust')
     */
    readonly language: string;
    /**
     * File extensions this parser handles
     */
    readonly extensions: string[];
    /**
     * Parse source code and extract symbols
     *
     * @param content - Source code content
     * @returns Parse result with extracted symbols
     */
    parse(content: string): ParseResult;
    /**
     * Get the tree-sitter parser instance
     * Useful for advanced use cases
     */
    getParser(): Parser;
}
/**
 * Language detection result
 */
export interface LanguageDetection {
    language: string;
    confidence: number;
    parser?: LanguageParser;
}
/**
 * Base class for language parsers
 * Provides common functionality for tree-walking and symbol extraction
 */
export declare abstract class BaseLanguageParser implements LanguageParser {
    protected parser: Parser;
    abstract readonly language: string;
    abstract readonly extensions: string[];
    constructor(grammar: Parser.Language);
    /**
     * Parse source code and extract symbols
     */
    parse(content: string): ParseResult;
    /**
     * Get the tree-sitter parser instance
     */
    getParser(): Parser;
    /**
     * Walk AST tree and extract symbols
     * Subclasses can override for language-specific behavior
     */
    protected walkTree(node: Parser.SyntaxNode, symbols: Symbol[]): void;
    /**
     * Extract symbol from AST node
     * Must be implemented by language-specific parsers
     */
    protected abstract extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Helper: Get text of a named field from a node
     */
    protected getFieldText(node: Parser.SyntaxNode, fieldName: string): string | null;
    /**
     * Helper: Create a symbol from a node
     */
    protected createSymbol(node: Parser.SyntaxNode, name: string, kind: SymbolKind, metadata?: Record<string, any>): Symbol;
}
//# sourceMappingURL=LanguageParser.d.ts.map