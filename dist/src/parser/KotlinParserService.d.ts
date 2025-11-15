/**
 * KotlinParserService.ts
 *
 * Kotlin language parser using Tree-sitter
 * Extracts symbols from Kotlin source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * KotlinParserService - Extracts symbols from Kotlin code
 *
 * Supports:
 * - Functions (top-level and class methods)
 * - Classes (regular, data, sealed, inner, abstract)
 * - Interfaces
 * - Objects (singleton pattern)
 * - Properties (val/var)
 * - Companion objects
 */
export declare class KotlinParserService extends BaseLanguageParser {
    readonly language = "kotlin";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     * Handles both top-level functions and class methods
     *
     * Examples:
     * - fun add(a: Int, b: Int): Int = a + b
     * - fun multiply(a: Int, b: Int): Int { return a * b }
     */
    private extractFunction;
    /**
     * Extract class declaration
     * Handles: class, data class, sealed class, interface, enum class
     *
     * Examples:
     * - class Calculator { ... }
     * - data class Person(val name: String, val age: Int)
     * - interface Logger { fun log(message: String) }
     * - sealed class Result<out T>
     */
    private extractClass;
    /**
     * Extract object declaration
     * Kotlin objects are singleton instances
     *
     * Examples:
     * - object Constants { const val PI = 3.14 }
     * - companion object { fun create() = ... }
     */
    private extractObject;
    /**
     * Extract property declaration
     * Handles val (immutable) and var (mutable) properties
     *
     * Examples:
     * - val name: String = "Kotlin"
     * - var count: Int = 0
     * - const val PI = 3.14
     */
    private extractProperty;
    /**
     * Determine class kind based on modifiers and structure
     *
     * Returns:
     * - 'interface' if class_body contains only function declarations
     * - 'enum' if enum_class_body present
     * - 'class' otherwise
     */
    private determineClassKind;
    /**
     * Get class name from class_declaration node
     */
    private getClassName;
    /**
     * Find parent class declaration for a node
     */
    private findParentClass;
}
//# sourceMappingURL=KotlinParserService.d.ts.map