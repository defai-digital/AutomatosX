/**
 * AssemblyScriptParserService.ts
 *
 * AssemblyScript language parser using TypeScript Tree-sitter grammar
 * Extracts symbols from AssemblyScript source code
 *
 * AssemblyScript is a TypeScript-like language that compiles to WebAssembly.
 * It uses TypeScript syntax but with WebAssembly-specific features:
 * - WebAssembly primitive types (i32, i64, f32, f64, u32, u64, etc.)
 * - @inline, @external, @unsafe decorators
 * - Memory management operations
 * - Strict typing for WASM compatibility
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * AssemblyScriptParserService - Extracts symbols from AssemblyScript code
 *
 * Uses TypeScript Tree-sitter grammar since AssemblyScript is TypeScript syntax.
 *
 * Supported Features:
 * - Functions (with WASM types: i32, i64, f32, f64, etc.)
 * - Classes (compiled to WebAssembly linear memory)
 * - Exports (compiled to WASM exports)
 * - Decorators (@inline, @external, @unsafe)
 * - WebAssembly-specific APIs (memory operations)
 * - Namespaces/modules
 * - Type declarations
 *
 * File Extensions:
 * - .as.ts (AssemblyScript-specific convention to distinguish from regular TypeScript)
 *
 * Note: AssemblyScript is a strict subset of TypeScript optimized for WebAssembly.
 * All TypeScript syntax works, but with restrictions:
 * - No dynamic typing (everything must be statically typed)
 * - Limited standard library (WebAssembly-compatible only)
 * - Manual memory management for advanced use cases
 *
 * Note: Regular .ts files are handled by TypeScriptParserService.
 * Use .as.ts extension to explicitly mark AssemblyScript files.
 */
export declare class AssemblyScriptParserService extends BaseLanguageParser {
    readonly language = "assemblyscript";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * Reuses TypeScript patterns since AssemblyScript IS TypeScript syntax
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract ambient declaration (declare function, declare class, etc.)
     * Used for @external declarations in AssemblyScript
     */
    private extractAmbientDeclaration;
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
     * Extract method definition
     */
    private extractMethod;
    /**
     * Extract enum declaration
     */
    private extractEnum;
    /**
     * Find parent class of a node
     */
    private findParentClass;
    /**
     * Get class name from class declaration
     */
    private getClassName;
    /**
     * Get method name from method definition
     */
    private getMethodName;
}
//# sourceMappingURL=AssemblyScriptParserService.d.ts.map