/**
 * ScalaParserService.ts
 *
 * Scala language parser using Tree-sitter
 * Extracts symbols from Scala source code
 */
import Scala from 'tree-sitter-scala';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * ScalaParserService - Extracts symbols from Scala code
 */
export class ScalaParserService extends BaseLanguageParser {
    language = 'scala';
    extensions = ['.scala', '.sc'];
    constructor() {
        super(Scala);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
            case 'function_declaration':
                return this.extractFunction(node);
            case 'class_definition':
                return this.extractClass(node);
            case 'object_definition':
                return this.extractObject(node);
            case 'trait_definition':
                return this.extractTrait(node);
            case 'type_definition':
                return this.extractType(node);
            case 'val_definition':
            case 'val_declaration':
                return this.extractVal(node);
            case 'var_definition':
            case 'var_declaration':
                return this.extractVar(node);
            default:
                return null;
        }
    }
    /**
     * Extract function definition
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract class definition
     */
    extractClass(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract object definition (Scala singleton)
     */
    extractObject(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract trait definition
     */
    extractTrait(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'trait');
    }
    /**
     * Extract type definition
     */
    extractType(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract val definition (immutable)
     */
    extractVal(node) {
        const pattern = node.childForFieldName('pattern');
        if (!pattern)
            return null;
        const identifier = pattern.descendantsOfType('identifier')[0];
        if (!identifier)
            return null;
        return this.createSymbol(node, identifier.text, 'constant');
    }
    /**
     * Extract var definition (mutable)
     */
    extractVar(node) {
        const pattern = node.childForFieldName('pattern');
        if (!pattern)
            return null;
        const identifier = pattern.descendantsOfType('identifier')[0];
        if (!identifier)
            return null;
        return this.createSymbol(node, identifier.text, 'variable');
    }
}
//# sourceMappingURL=ScalaParserService.js.map