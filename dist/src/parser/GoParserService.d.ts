/**
 * GoParserService.ts
 *
 * Go language parser using Tree-sitter
 * Extracts symbols from Go source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * GoParserService - Extracts symbols from Go code
 */
export declare class GoParserService extends BaseLanguageParser {
    readonly language = "go";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration (package-level functions)
     * Example: func NewCalculator() *Calculator { ... }
     */
    private extractFunction;
    /**
     * Extract method declaration (methods with receivers)
     * Example: func (c *Calculator) Add(a, b float64) float64 { ... }
     */
    private extractMethod;
    /**
     * Extract type declaration (struct, interface, type alias)
     * Go uses type_declaration which contains type_spec children
     * Example: type Calculator struct { ... }
     * Example: type Adder interface { ... }
     * Example: type String string
     */
    private extractTypeDeclaration;
    /**
     * Extract constant declaration
     * Example: const StatusOK StatusCode = 200
     * Example: const ( ... )
     */
    private extractConstant;
    /**
     * Extract variable declaration
     * Example: var timeout time.Duration
     * Example: var ( ... )
     */
    private extractVariable;
}
//# sourceMappingURL=GoParserService.d.ts.map