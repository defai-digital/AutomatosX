/**
 * SwiftParserService.ts
 *
 * Swift language parser using Tree-sitter
 * Extracts symbols from Swift source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * SwiftParserService - Extracts symbols from Swift code
 *
 * Supports:
 * - Functions (top-level and methods)
 * - Classes
 * - Structs
 * - Enums
 * - Protocols (interfaces)
 * - Properties (var/let)
 * - Extensions
 */
export declare class SwiftParserService extends BaseLanguageParser {
    readonly language = "swift";
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
     * - func add(a: Int, b: Int) -> Int { return a + b }
     * - func calculate() -> Double
     */
    private extractFunction;
    /**
     * Extract class-like declaration (class, struct, enum)
     * Swift uses class_declaration for all three types
     *
     * Examples:
     * - class Calculator { ... }
     * - struct Point { var x: Double, var y: Double }
     * - enum Result { case success, case failure }
     */
    private extractClassLike;
    /**
     * Extract protocol declaration (Swift's interface)
     *
     * Examples:
     * - protocol Logger { func log(message: String) }
     * - protocol Drawable { func draw() }
     */
    private extractProtocol;
    /**
     * Extract property declaration
     * Handles both var and let properties
     *
     * Examples:
     * - var count: Int = 0
     * - let name: String = "Swift"
     */
    private extractProperty;
    /**
     * Determine class kind based on body type
     *
     * Returns:
     * - 'enum' if enum_class_body present
     * - 'class' otherwise (includes structs)
     */
    private determineClassKind;
    /**
     * Get type name from class_declaration or protocol_declaration node
     */
    private getTypeName;
    /**
     * Find parent class/struct/enum/protocol declaration for a node
     */
    private findParentType;
}
//# sourceMappingURL=SwiftParserService.d.ts.map