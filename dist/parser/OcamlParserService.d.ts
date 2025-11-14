/**
 * OcamlParserService.ts
 *
 * OCaml/ReScript language parser using Tree-sitter
 * Extracts symbols from OCaml and ReScript source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * OcamlParserService - Extracts symbols from OCaml/ReScript code
 */
export declare class OcamlParserService extends BaseLanguageParser {
    readonly language = "ocaml";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract value definition (let binding)
     */
    private extractValue;
    /**
     * Extract type definition
     */
    private extractType;
    /**
     * Extract module definition
     */
    private extractModule;
    /**
     * Extract external declaration
     */
    private extractExternal;
}
//# sourceMappingURL=OcamlParserService.d.ts.map