/**
 * DartParserService.ts
 *
 * Dart language parser using Tree-sitter
 * Extracts symbols from Dart code (Flutter/mobile development)
 */
import Dart from 'tree-sitter-dart';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * DartParserService - Extracts symbols from Dart code
 */
export class DartParserService extends BaseLanguageParser {
    language = 'dart';
    extensions = ['.dart'];
    constructor() {
        super(Dart);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_signature':
            case 'function_declaration':
            case 'method_signature':
                return this.extractFunction(node);
            case 'class_definition':
                return this.extractClass(node);
            case 'enum_declaration':
                return this.extractEnum(node);
            case 'mixin_declaration':
                return this.extractMixin(node);
            case 'extension_declaration':
                return this.extractExtension(node);
            case 'constant_constructor_signature':
            case 'constructor_signature':
                return this.extractConstructor(node);
            default:
                return null;
        }
    }
    /**
     * Extract function or method declaration
     */
    extractFunction(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        const name = nameNode.text;
        const kind = node.parent?.type === 'class_definition' ? 'method' : 'function';
        return this.createSymbol(node, name, kind);
    }
    /**
     * Extract class definition
     */
    extractClass(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'class');
    }
    /**
     * Extract enum declaration
     */
    extractEnum(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'enum');
    }
    /**
     * Extract mixin declaration
     */
    extractMixin(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'interface');
    }
    /**
     * Extract extension declaration
     */
    extractExtension(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'interface');
    }
    /**
     * Extract constructor
     */
    extractConstructor(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'method');
    }
}
//# sourceMappingURL=DartParserService.js.map