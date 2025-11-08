/**
 * RustParserService.ts
 *
 * Rust language parser using Tree-sitter
 * Extracts symbols from Rust source code
 */

import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * RustParserService - Extracts symbols from Rust code
 */
export class RustParserService extends BaseLanguageParser {
  readonly language = 'rust';
  readonly extensions = ['.rs'];

  constructor() {
    super(Rust);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_item':
        return this.extractFunction(node);

      case 'struct_item':
        return this.extractStruct(node);

      case 'enum_item':
        return this.extractEnum(node);

      case 'trait_item':
        return this.extractTrait(node);

      case 'impl_item':
        return this.extractImplBlock(node);

      case 'const_item':
        return this.extractConstant(node);

      case 'static_item':
        return this.extractStatic(node);

      case 'type_item':
        return this.extractTypeAlias(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   * Example: fn calculate(x: i32, y: i32) -> i32 { ... }
   * Example: pub fn new() -> Self { ... }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract struct declaration
   * Example: struct Point { x: f64, y: f64 }
   * Example: pub struct Calculator<T> { ... }
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract enum declaration
   * Example: enum Status { Active, Inactive }
   * Example: pub enum Option<T> { Some(T), None }
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract trait declaration
   * Example: trait Drawable { fn draw(&self); }
   * Example: pub trait Iterator { type Item; ... }
   */
  private extractTrait(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract impl block (implementation)
   * Example: impl Calculator { fn new() -> Self { ... } }
   * Example: impl<T> Display for Point<T> { ... }
   *
   * Note: We extract the impl block itself as a symbol for navigation,
   * and individual methods within will be extracted separately
   */
  private extractImplBlock(node: Parser.SyntaxNode): Symbol | null {
    // Get the type being implemented
    const typeNode = node.childForFieldName('type');
    if (!typeNode) return null;

    let typeName = typeNode.text;

    // Check if this is a trait implementation (impl Trait for Type)
    const traitNode = node.childForFieldName('trait');
    if (traitNode) {
      // This is a trait impl: impl Trait for Type
      typeName = `${traitNode.text} for ${typeName}`;
    }

    return this.createSymbol(node, `impl ${typeName}`, 'class');
  }

  /**
   * Extract constant declaration
   * Example: const MAX_SIZE: usize = 100;
   * Example: pub const PI: f64 = 3.14159;
   */
  private extractConstant(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'constant');
  }

  /**
   * Extract static variable declaration
   * Example: static mut COUNTER: i32 = 0;
   * Example: pub static VERSION: &str = "1.0.0";
   */
  private extractStatic(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract type alias declaration
   * Example: type Result<T> = std::result::Result<T, Error>;
   * Example: pub type Point = (f64, f64);
   */
  private extractTypeAlias(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'type');
  }
}
