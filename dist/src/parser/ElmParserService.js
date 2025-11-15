/**
 * ElmParserService.ts
 *
 * Elm language parser using Tree-sitter
 * Extracts symbols from Elm source code
 */
import Elm from 'tree-sitter-elm';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * ElmParserService - Extracts symbols from Elm code
 */
export class ElmParserService extends BaseLanguageParser {
    language = 'elm';
    extensions = ['.elm'];
    constructor() {
        // Elm exports the language directly via the native binding
        super(Elm);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'value_declaration':
                return this.extractValue(node);
            case 'type_alias_declaration':
                return this.extractTypeAlias(node);
            case 'type_declaration':
                return this.extractType(node);
            case 'port_annotation':
                return this.extractPort(node);
            default:
                return null;
        }
    }
    /**
     * Extract value declaration (function or constant)
     */
    extractValue(node) {
        const functionDeclaration = node.descendantsOfType('function_declaration_left')[0];
        if (!functionDeclaration)
            return null;
        const name = this.getFieldText(functionDeclaration, 'name') ||
            functionDeclaration.descendantsOfType('lower_case_identifier')[0]?.text;
        if (!name)
            return null;
        // Check if it has parameters (is a function)
        const patterns = functionDeclaration.descendantsOfType('pattern');
        const isFunction = patterns.length > 1; // First pattern is the name itself
        return this.createSymbol(node, name, isFunction ? 'function' : 'constant');
    }
    /**
     * Extract type alias declaration
     */
    extractTypeAlias(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('upper_case_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract type declaration
     */
    extractType(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('upper_case_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract port annotation
     */
    extractPort(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('lower_case_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
}
//# sourceMappingURL=ElmParserService.js.map