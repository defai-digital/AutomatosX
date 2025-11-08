/**
 * PhpParserService.ts
 *
 * PHP language parser using Tree-sitter
 * Extracts symbols from PHP source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * PhpParserService - Extracts symbols from PHP code
 *
 * Supports PHP constructs:
 * - Functions
 * - Classes (with methods and properties)
 * - Interfaces
 * - Traits
 * - Constants
 * - Namespaces
 */
export declare class PhpParserService extends BaseLanguageParser {
    readonly language = "php";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function definition
     * Example: function calculateTotal($items) { ... }
     */
    private extractFunction;
    /**
     * Extract method declaration (inside a class)
     * Example: public function getTotal(): float { ... }
     */
    private extractMethod;
    /**
     * Extract class declaration
     * Example: class Calculator extends BaseCalculator { ... }
     */
    private extractClass;
    /**
     * Extract interface declaration
     * Example: interface CalculatorInterface { ... }
     */
    private extractInterface;
    /**
     * Extract trait declaration
     * Example: trait Timestampable { ... }
     */
    private extractTrait;
    /**
     * Extract constant declaration
     * Example: const STATUS_ACTIVE = 1;
     * Example: define('APP_VERSION', '2.0.0');
     */
    private extractConstant;
    /**
     * Extract property declaration (class properties)
     * Example: private $total = 0;
     * Example: protected string $name;
     */
    private extractProperty;
    /**
     * Override walkTree to handle PHP-specific patterns
     */
    protected walkTree(node: Parser.SyntaxNode, symbols: Symbol[]): void;
}
//# sourceMappingURL=PhpParserService.d.ts.map