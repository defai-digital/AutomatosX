/**
 * HaskellParserService.ts
 *
 * Haskell language parser using Tree-sitter
 * Extracts symbols from Haskell functional programming code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * HaskellParserService - Extracts symbols from Haskell code
 */
export declare class HaskellParserService extends BaseLanguageParser {
    readonly language = "haskell";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function definition or signature
     */
    private extractFunction;
    /**
     * Extract data type or newtype
     */
    private extractDataType;
    /**
     * Extract type synonym
     */
    private extractTypeSynonym;
    /**
     * Extract type class
     */
    private extractTypeClass;
    /**
     * Extract type class instance
     */
    private extractInstance;
}
//# sourceMappingURL=HaskellParserService.d.ts.map