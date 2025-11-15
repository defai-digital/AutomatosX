import Parser from 'tree-sitter';
import Thrift from 'tree-sitter-thrift';
import { BaseLanguageParser, Symbol, SymbolKind, SymbolKindValue, Call, Import } from './LanguageParser.js';


/**
 * Parser for Apache Thrift IDL (Interface Definition Language)
 *
 * Thrift is an RPC framework and IDL for building scalable cross-language services.
 * This parser extracts:
 * - Services: Service definitions with RPC methods
 * - Structs: Data structure definitions
 * - Enums: Enumeration types
 * - Exceptions: Exception types
 * - Typedefs: Type aliases
 * - Constants: Constant declarations
 * - Functions: RPC method definitions
 * - Includes: File imports
 *
 * Use cases:
 * - Microservices communication
 * - Cross-language RPC
 * - API schema definition
 * - Distributed systems
 *
 * File extensions: .thrift
 */
export class ThriftParserService extends BaseLanguageParser {
  readonly language = 'thrift';
  readonly extensions = ['.thrift'];

  constructor() {
    super(Thrift as Parser.Language);
  }

  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'service':
        return this.extractService(node);
      case 'struct':
        return this.extractStruct(node);
      case 'enum':
        return this.extractEnum(node);
      case 'exception':
        return this.extractException(node);
      case 'typedef':
        return this.extractTypedef(node);
      case 'const':
        return this.extractConstant(node);
      case 'function':
        return this.extractFunction(node);
      default:
        return null;
    }
  }

  /**
   * Extract Thrift service definition
   * Example: service MyService { ... }
   */
  private extractService(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const extendsNode = node.childForFieldName('extends');
    const extendedService = extendsNode?.text;

    return {
      name,
      kind: SymbolKindValue.INTERFACE,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `service ${name}${extendedService ? ` extends ${extendedService}` : ''}`,
      metadata: {
        extendedService,
        isService: true,
      },
    };
  }

  /**
   * Extract Thrift struct definition
   * Example: struct User { 1: string name, 2: i32 age }
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const fields = this.extractStructFields(node);

    return {
      name,
      kind: SymbolKindValue.STRUCT,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `struct ${name}`,
      metadata: {
        fields,
        fieldCount: fields.length,
      },
    };
  }

  /**
   * Extract Thrift enum definition
   * Example: enum Status { OK = 0, ERROR = 1 }
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const values = this.extractEnumValues(node);

    return {
      name,
      kind: SymbolKindValue.ENUM,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `enum ${name}`,
      metadata: {
        values,
        valueCount: values.length,
      },
    };
  }

  /**
   * Extract Thrift exception definition
   * Example: exception MyException { 1: string message }
   */
  private extractException(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const fields = this.extractStructFields(node);

    return {
      name,
      kind: SymbolKindValue.CLASS,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `exception ${name}`,
      metadata: {
        fields,
        isException: true,
      },
    };
  }

  /**
   * Extract Thrift typedef
   * Example: typedef map<string, string> StringMap
   */
  private extractTypedef(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('type');

    if (!nameNode) return null;

    const name = nameNode.text;
    const baseType = typeNode?.text || 'unknown';

    return {
      name,
      kind: SymbolKindValue.TYPE,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `typedef ${baseType} ${name}`,
      metadata: {
        baseType,
        isTypedef: true,
      },
    };
  }

  /**
   * Extract Thrift constant
   * Example: const i32 MY_CONSTANT = 42
   */
  private extractConstant(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('type');

    if (!nameNode) return null;

    const name = nameNode.text;
    const type = typeNode?.text || 'unknown';

    return {
      name,
      kind: SymbolKindValue.CONSTANT,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `const ${type} ${name}`,
      metadata: {
        type,
      },
    };
  }

  /**
   * Extract Thrift function (RPC method in service)
   * Example: string getName(1: i32 userId)
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    const returnTypeNode = node.childForFieldName('return_type');

    if (!nameNode) return null;

    const name = nameNode.text;
    const returnType = returnTypeNode?.text || 'void';
    const parameters = this.extractFunctionParameters(node);

    return {
      name,
      kind: SymbolKindValue.METHOD,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `${returnType} ${name}(${parameters.join(', ')})`,
      metadata: {
        returnType,
        parameters,
        isRpcMethod: true,
      },
    };
  }

  protected extractCall(node: Parser.SyntaxNode): Call | null {
    // Thrift is an IDL, not executable code, so no call extraction
    return null;
  }

  protected extractImport(node: Parser.SyntaxNode): Import | null {
    if (node.type === 'include') {
      const pathNode = node.childForFieldName('path');
      if (!pathNode) return null;

      const path = pathNode.text.replace(/['"]/g, '');

      return {
        source: path,
        imported: [],
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      };
    }

    if (node.type === 'cpp_include') {
      const pathNode = node.childForFieldName('path');
      if (!pathNode) return null;

      const path = pathNode.text.replace(/['"]/g, '');

      return {
        source: path,
        imported: [],
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      };
    }

    return null;
  }

  /**
   * Extract struct fields
   */
  private extractStructFields(node: Parser.SyntaxNode): string[] {
    const fields: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'field') {
        const nameNode = child.childForFieldName('name');
        const typeNode = child.childForFieldName('type');

        if (nameNode && typeNode) {
          fields.push(`${typeNode.text} ${nameNode.text}`);
        }
      }
    }

    return fields;
  }

  /**
   * Extract enum values
   */
  private extractEnumValues(node: Parser.SyntaxNode): string[] {
    const values: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'enum_value') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          values.push(nameNode.text);
        }
      }
    }

    return values;
  }

  /**
   * Extract function parameters
   */
  private extractFunctionParameters(node: Parser.SyntaxNode): string[] {
    const params: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'field') {
        const nameNode = child.childForFieldName('name');
        const typeNode = child.childForFieldName('type');

        if (nameNode && typeNode) {
          params.push(`${typeNode.text} ${nameNode.text}`);
        }
      }
    }

    return params;
  }
}
