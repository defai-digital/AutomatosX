/**
 * ObjectiveCParserService.ts
 *
 * Objective-C language parser using Tree-sitter
 * Extracts symbols from Objective-C source code
 */
import ObjectiveC from 'tree-sitter-objc';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * ObjectiveCParserService - Extracts symbols from Objective-C code
 */
export class ObjectiveCParserService extends BaseLanguageParser {
    language = 'objectivec';
    extensions = ['.m', '.mm', '.h'];
    constructor() {
        super(ObjectiveC);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'class_interface':
            case 'class_implementation':
                return this.extractClass(node);
            case 'protocol_declaration':
                return this.extractProtocol(node);
            case 'method_declaration':
            case 'method_definition':
                return this.extractMethod(node);
            case 'property_declaration':
                return this.extractProperty(node);
            case 'struct_specifier':
                return this.extractStruct(node);
            case 'enum_specifier':
                return this.extractEnum(node);
            default:
                return null;
        }
    }
    /**
     * Extract function definition
     */
    extractFunction(node) {
        const declarator = node.childForFieldName('declarator');
        if (!declarator)
            return null;
        const name = this.getFieldText(declarator, 'declarator');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract class declaration/implementation
     */
    extractClass(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract protocol declaration
     */
    extractProtocol(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract method declaration/definition
     */
    extractMethod(node) {
        // Get method selector which is the method name in Objective-C
        const selectors = node.descendantsOfType('selector');
        if (selectors.length === 0)
            return null;
        // Combine all selector parts to form full method name
        const methodName = selectors.map(s => s.text).join('');
        return this.createSymbol(node, methodName, 'method');
    }
    /**
     * Extract property declaration
     */
    extractProperty(node) {
        const declarator = node.descendantsOfType('property_declarator')[0];
        if (!declarator)
            return null;
        const identifier = declarator.childForFieldName('name');
        if (!identifier)
            return null;
        return this.createSymbol(node, identifier.text, 'variable');
    }
    /**
     * Extract struct definition
     */
    extractStruct(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'struct');
    }
    /**
     * Extract enum definition
     */
    extractEnum(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'enum');
    }
}
//# sourceMappingURL=ObjectiveCParserService.js.map