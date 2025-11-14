/**
 * GleamParserService.ts
 *
 * Gleam language parser using Tree-sitter
 * Extracts symbols from Gleam functional programming code (BEAM VM)
 */
import Gleam from 'tree-sitter-gleam';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * GleamParserService - Extracts symbols from Gleam code
 */
export class GleamParserService extends BaseLanguageParser {
    language = 'gleam';
    extensions = ['.gleam'];
    constructor() {
        super(Gleam);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function':
            case 'function_declaration':
                return this.extractFunction(node);
            case 'type_alias':
                return this.extractTypeAlias(node);
            case 'custom_type':
                return this.extractCustomType(node);
            case 'external_function':
                return this.extractExternalFunction(node);
            case 'import':
                return this.extractImport(node);
            case 'constant':
                return this.extractConstant(node);
            default:
                return null;
        }
    }
    /**
     * Extract function declaration
     */
    extractFunction(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'function');
    }
    /**
     * Extract type alias
     */
    extractTypeAlias(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('type_identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'type');
    }
    /**
     * Extract custom type (algebraic data type)
     */
    extractCustomType(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('type_identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'struct');
    }
    /**
     * Extract external function (FFI)
     */
    extractExternalFunction(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'function');
    }
    /**
     * Extract import statement
     */
    extractImport(node) {
        const moduleNode = node.childForFieldName('module') ||
            node.descendantsOfType('module_path')[0];
        if (!moduleNode)
            return null;
        return this.createSymbol(node, moduleNode.text, 'module');
    }
    /**
     * Extract constant declaration
     */
    extractConstant(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'constant');
    }
}
//# sourceMappingURL=GleamParserService.js.map