/**
 * RustParserService.ts
 *
 * Rust language parser using Tree-sitter
 * Extracts symbols from Rust source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * RustParserService - Extracts symbols from Rust code
 */
export declare class RustParserService extends BaseLanguageParser {
    readonly language = "rust";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract function declaration
     * Example: fn calculate(x: i32, y: i32) -> i32 { ... }
     * Example: pub fn new() -> Self { ... }
     */
    private extractFunction;
    /**
     * Extract struct declaration
     * Example: struct Point { x: f64, y: f64 }
     * Example: pub struct Calculator<T> { ... }
     */
    private extractStruct;
    /**
     * Extract enum declaration
     * Example: enum Status { Active, Inactive }
     * Example: pub enum Option<T> { Some(T), None }
     */
    private extractEnum;
    /**
     * Extract trait declaration
     * Example: trait Drawable { fn draw(&self); }
     * Example: pub trait Iterator { type Item; ... }
     */
    private extractTrait;
    /**
     * Extract impl block (implementation)
     * Example: impl Calculator { fn new() -> Self { ... } }
     * Example: impl<T> Display for Point<T> { ... }
     *
     * Note: We extract the impl block itself as a symbol for navigation,
     * and individual methods within will be extracted separately
     */
    private extractImplBlock;
    /**
     * Extract constant declaration
     * Example: const MAX_SIZE: usize = 100;
     * Example: pub const PI: f64 = 3.14159;
     */
    private extractConstant;
    /**
     * Extract static variable declaration
     * Example: static mut COUNTER: i32 = 0;
     * Example: pub static VERSION: &str = "1.0.0";
     */
    private extractStatic;
    /**
     * Extract type alias declaration
     * Example: type Result<T> = std::result::Result<T, Error>;
     * Example: pub type Point = (f64, f64);
     */
    private extractTypeAlias;
}
//# sourceMappingURL=RustParserService.d.ts.map