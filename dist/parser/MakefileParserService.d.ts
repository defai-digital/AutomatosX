/**
 * MakefileParserService.ts
 *
 * Makefile language parser using Tree-sitter
 * Extracts targets and variables from Makefiles
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * MakefileParserService - Extracts structure from Makefiles
 */
export declare class MakefileParserService extends BaseLanguageParser {
    readonly language = "makefile";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For Makefiles, we extract targets and variables
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract make target
     */
    private extractTarget;
    /**
     * Extract make variable
     */
    private extractVariable;
}
//# sourceMappingURL=MakefileParserService.d.ts.map