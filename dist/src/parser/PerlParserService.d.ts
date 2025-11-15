/**
 * PerlParserService.ts
 *
 * Perl language parser using Tree-sitter
 * Extracts symbols from Perl scripting code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * PerlParserService - Extracts symbols from Perl code
 */
export declare class PerlParserService extends BaseLanguageParser {
    readonly language = "perl";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract subroutine declaration (Perl function)
     */
    private extractSubroutine;
    /**
     * Extract package declaration (Perl module)
     */
    private extractPackage;
    /**
     * Extract variable declaration (my, our, state)
     */
    private extractVariable;
    /**
     * Extract use statement (imports/modules)
     */
    private extractUse;
}
//# sourceMappingURL=PerlParserService.d.ts.map