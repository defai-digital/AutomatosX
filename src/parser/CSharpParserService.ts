/**
 * CSharpParserService.ts
 *
 * C# language parser using Tree-sitter
 * Extracts symbols from C# source code
 */

import Parser from 'tree-sitter';
import CSharp from 'tree-sitter-c-sharp';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * CSharpParserService - Extracts symbols from C# code
 */
export class CSharpParserService extends BaseLanguageParser {
  readonly language = 'csharp';
  readonly extensions = ['.cs'];

  constructor() {
    super(CSharp);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'class_declaration':
        return this.extractClass(node);

      case 'interface_declaration':
        return this.extractInterface(node);

      case 'struct_declaration':
        return this.extractStruct(node);

      case 'enum_declaration':
        return this.extractEnum(node);

      case 'method_declaration':
      case 'constructor_declaration':
        return this.extractMethod(node);

      case 'property_declaration':
        return this.extractProperty(node);

      case 'field_declaration':
        return this.extractField(node);

      case 'delegate_declaration':
        return this.extractDelegate(node);

      case 'event_declaration':
      case 'event_field_declaration':
        return this.extractEvent(node);

      default:
        return null;
    }
  }

  /**
   * Extract class declaration
   * Example: public class Calculator { }
   * Example: public class Calculator<T> where T : struct { }
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'class');
  }

  /**
   * Extract interface declaration
   * Example: public interface ICalculator { }
   * Example: public interface IRepository<T> { }
   */
  private extractInterface(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'interface');
  }

  /**
   * Extract struct declaration
   * Example: public struct Point { }
   * Example: public readonly struct Vector3 { }
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract enum declaration
   * Example: public enum Status { Active, Inactive }
   * Example: public enum HttpStatusCode : int { }
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract method or constructor declaration
   * Example: public void Calculate(int x, int y) { }
   * Example: public Calculator() { }
   */
  private extractMethod(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;

    // For methods, try to get the containing class name
    let parent = node.parent;
    while (parent) {
      if (
        parent.type === 'class_declaration' ||
        parent.type === 'struct_declaration' ||
        parent.type === 'interface_declaration'
      ) {
        const parentNameNode = parent.childForFieldName('name');
        if (parentNameNode) {
          const parentName = parentNameNode.text;
          return this.createSymbol(node, `${parentName}.${name}`, 'method');
        }
      }
      parent = parent.parent;
    }

    // If no parent class found, just use the method name
    return this.createSymbol(node, name, 'method');
  }

  /**
   * Extract property declaration
   * Example: public int Count { get; set; }
   * Example: public string Name { get; private set; }
   */
  private extractProperty(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract field declaration
   * Example: private int _count;
   * Example: public const int MaxSize = 100;
   */
  private extractField(node: Parser.SyntaxNode): Symbol | null {
    // Field declarations can have multiple variable declarators
    const declaratorNode = node.child(0);
    if (!declaratorNode) return null;

    // Look for variable_declaration node
    let variableDeclaration = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'variable_declaration') {
        variableDeclaration = child;
        break;
      }
    }

    if (!variableDeclaration) return null;

    // Get the first variable declarator
    let declarator = null;
    for (let i = 0; i < variableDeclaration.childCount; i++) {
      const child = variableDeclaration.child(i);
      if (child?.type === 'variable_declarator') {
        declarator = child;
        break;
      }
    }

    if (!declarator) return null;

    // Get the name from the declarator
    const nameNode = declarator.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;

    // Check if it's a const field
    const modifiers = this.getModifiers(node);
    if (modifiers.includes('const')) {
      return this.createSymbol(node, name, 'constant');
    }

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Extract delegate declaration
   * Example: public delegate void EventHandler(object sender, EventArgs e);
   */
  private extractDelegate(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'type');
  }

  /**
   * Extract event declaration
   * Example: public event EventHandler Click;
   * Example: public event EventHandler<T> DataReceived { add; remove; }
   */
  private extractEvent(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Get modifiers from a node (public, private, static, const, etc.)
   */
  private getModifiers(node: Parser.SyntaxNode): string[] {
    const modifiers: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'modifier') {
        modifiers.push(child.text);
      }
    }

    return modifiers;
  }
}
