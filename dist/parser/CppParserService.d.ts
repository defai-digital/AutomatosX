/**
 * CppParserService.ts
 *
 * C++ language parser using Tree-sitter
 * Extracts symbols from C++ source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * CppParserService - Extracts symbols from C++ code
 */
export declare class CppParserService extends BaseLanguageParser {
    readonly language = "cpp";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract class declaration
     * Example: class Calculator { };
     * Example: template<typename T> class Container { };
     */
    private extractClass;
    /**
     * Extract struct declaration
     * Example: struct Point { double x, y; };
     * Example: template<typename T> struct Pair { };
     */
    private extractStruct;
    /**
     * Extract enum declaration
     * Example: enum Status { Active, Inactive };
     * Example: enum class Color { Red, Green, Blue };
     */
    private extractEnum;
    /**
     * Extract function definition
     * Example: void calculate(int x, int y) { }
     * Example: double Calculator::add(double a, double b) { }
     */
    private extractFunction;
    /**
     * Extract function name from declarator node
     */
    private extractFunctionName;
    /**
     * Extract identifier from node
     */
    private extractIdentifier;
    /**
     * Extract declaration (variables, constants, function declarations)
     * Example: const int MAX_SIZE = 100;
     * Example: extern void calculate(int x);
     */
    private extractDeclaration;
    /**
     * Extract variable name from declarator
     */
    private extractVariableName;
    /**
     * Check if declaration has const qualifier
     * Recursively searches type specifiers for const
     */
    private hasConstQualifier;
    /**
     * Recursively check if node contains const
     */
    private hasConstInNode;
    /**
     * Check if node has a specific modifier
     */
    private hasModifier;
    /**
     * Extract template declaration
     * Example: template<typename T> class Container { };
     * Example: template<typename T> T max(T a, T b) { }
     */
    private extractTemplate;
    /**
     * Extract namespace definition
     * Example: namespace math { }
     * Example: namespace std::chrono { }
     */
    private extractNamespace;
}
//# sourceMappingURL=CppParserService.d.ts.map