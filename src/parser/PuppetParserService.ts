import Parser from 'tree-sitter';
import Puppet from 'tree-sitter-puppet';
import { BaseLanguageParser, Symbol, SymbolKind, SymbolKindValue, Call, Import } from './LanguageParser.js';

/**
 * Parser for Puppet configuration management language
 *
 * Puppet is a configuration management tool that uses a declarative DSL
 * to describe system configuration. This parser extracts:
 * - Classes: Puppet classes for grouping resources
 * - Defined types: Custom resource types
 * - Resources: Individual configuration items
 * - Variables: Variable declarations
 * - Functions: Puppet functions
 * - Modules: Module imports
 *
 * Use cases:
 * - DevOps infrastructure as code
 * - Configuration management
 * - Server provisioning
 * - Continuous deployment
 *
 * File extensions: .pp
 */
export class PuppetParserService extends BaseLanguageParser {
  readonly language = 'puppet';
  readonly extensions = ['.pp'];

  protected getGrammar(): Parser.Language {
    return Puppet as Parser.Language;
  }

  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'class_definition':
        return this.extractClass(node);
      case 'defined_type':
        return this.extractDefinedType(node);
      case 'resource_declaration':
        return this.extractResource(node);
      case 'variable_assignment':
        return this.extractVariable(node);
      case 'function_definition':
        return this.extractFunction(node);
      default:
        return null;
    }
  }

  /**
   * Extract Puppet class definition
   * Example: class myclass { ... }
   */
  private extractClass(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const paramsNode = node.childForFieldName('parameters');
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];

    return {
      name,
      kind: SymbolKindValue.CLASS,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `class ${name}${parameters.length > 0 ? `(${parameters.join(', ')})` : ''}`,
      metadata: {
        parameters,
        isInherited: this.hasInherits(node),
      },
    };
  }

  /**
   * Extract Puppet defined type (custom resource type)
   * Example: define mytype { ... }
   */
  private extractDefinedType(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const paramsNode = node.childForFieldName('parameters');
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];

    return {
      name,
      kind: SymbolKindValue.TYPE,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `define ${name}${parameters.length > 0 ? `(${parameters.join(', ')})` : ''}`,
      metadata: {
        parameters,
        isDefinedType: true,
      },
    };
  }

  /**
   * Extract Puppet resource declaration
   * Example: file { '/path': ensure => present }
   */
  private extractResource(node: Parser.SyntaxNode): Symbol | null {
    const typeNode = node.childForFieldName('type');
    const titleNode = node.childForFieldName('title');

    if (!typeNode) return null;

    const resourceType = typeNode.text;
    const title = titleNode?.text || 'unnamed';

    return {
      name: `${resourceType}[${title}]`,
      kind: SymbolKindValue.VARIABLE,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `${resourceType} { ${title} }`,
      metadata: {
        resourceType,
        title,
        isResource: true,
      },
    };
  }

  /**
   * Extract Puppet variable assignment
   * Example: $myvar = 'value'
   */
  private extractVariable(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;

    return {
      name,
      kind: SymbolKindValue.VARIABLE,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: name,
      metadata: {
        isPuppetVariable: true,
      },
    };
  }

  /**
   * Extract Puppet function definition
   * Example: function myfunc() { ... }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const paramsNode = node.childForFieldName('parameters');
    const parameters = paramsNode ? this.extractParameters(paramsNode) : [];

    return {
      name,
      kind: SymbolKindValue.FUNCTION,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      signature: `function ${name}(${parameters.join(', ')})`,
      metadata: {
        parameters,
      },
    };
  }

  protected extractCall(node: Parser.SyntaxNode): Call | null {
    if (node.type === 'function_call') {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) return null;

      const functionName = nameNode.text;
      const argsNode = node.childForFieldName('arguments');
      const args = argsNode ? this.extractCallArguments(argsNode) : [];

      return {
        caller: 'unknown',
        callee: functionName,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        metadata: {
          args,
        },
      };
    }
    return null;
  }

  protected extractImport(node: Parser.SyntaxNode): Import | null {
    if (node.type === 'include') {
      const nameNode = node.childForFieldName('class');
      if (!nameNode) return null;

      return {
        source: nameNode.text,
        symbols: [],
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        metadata: {
          importType: 'include',
        },
      };
    }

    if (node.type === 'require') {
      const nameNode = node.childForFieldName('class');
      if (!nameNode) return null;

      return {
        source: nameNode.text,
        symbols: [],
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        metadata: {
          importType: 'require',
        },
      };
    }

    return null;
  }

  /**
   * Extract parameters from parameter list node
   */
  private extractParameters(node: Parser.SyntaxNode): string[] {
    const params: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'parameter') {
        const nameNode = child.childForFieldName('name');
        if (nameNode) {
          params.push(nameNode.text);
        }
      }
    }

    return params;
  }

  /**
   * Extract function call arguments
   */
  private extractCallArguments(node: Parser.SyntaxNode): string[] {
    const args: string[] = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== ',' && child.type !== '(' && child.type !== ')') {
        args.push(child.text);
      }
    }

    return args;
  }

  /**
   * Check if class has inherits clause
   */
  private hasInherits(node: Parser.SyntaxNode): boolean {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === 'inherits') {
        return true;
      }
    }
    return false;
  }
}
