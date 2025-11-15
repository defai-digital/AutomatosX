/**
 * ParserService.ts
 *
 * Code parsing service using Tree-sitter
 * Extracts symbols from source code files
 */
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
}
/**
 * Symbol types we extract
 */
export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'method';
/**
 * Parse result
 */
export interface ParseResult {
    symbols: Symbol[];
    parseTime: number;
    nodeCount: number;
}
/**
 * ParserService - Extracts symbols from source code
 */
export declare class ParserService {
    private parser;
    constructor();
    /**
     * Parse TypeScript/JavaScript code and extract symbols
     *
     * @param content - Source code content
     * @returns Parse result with extracted symbols
     */
    parseTypeScript(content: string): ParseResult;
    /**
     * Walk AST tree and extract symbols
     */
    private walkTree;
    /**
     * Extract symbol from AST node
     */
    private extractSymbol;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract class declaration
     */
    private extractClass;
    /**
     * Extract interface declaration
     */
    private extractInterface;
    /**
     * Extract type alias declaration
     */
    private extractTypeAlias;
    /**
     * Extract variable/constant declaration
     */
    private extractVariable;
    /**
     * Extract method definition (class method)
     */
    private extractMethod;
}
//# sourceMappingURL=ParserService.d.ts.map