/**
 * RubyParserService.ts
 *
 * Ruby language parser using Tree-sitter
 * Extracts symbols from Ruby source code
 */
import Ruby from 'tree-sitter-ruby';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * RubyParserService - Extracts symbols from Ruby code
 */
export class RubyParserService extends BaseLanguageParser {
    language = 'ruby';
    extensions = ['.rb'];
    constructor() {
        super(Ruby);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'class':
                return this.extractClass(node);
            case 'module':
                return this.extractModule(node);
            case 'method':
            case 'singleton_method':
                return this.extractMethod(node);
            case 'assignment':
                return this.extractAssignment(node);
            default:
                return null;
        }
    }
    /**
     * Extract class declaration
     * Example: class Calculator
     * Example: class ScientificCalculator < Calculator
     */
    extractClass(node) {
        // Get the class name - it's usually in a 'constant' or 'scope_resolution' node
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return null;
        const name = nameNode.text;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract module declaration
     * Example: module Calculable
     * Example: module Math::Advanced
     */
    extractModule(node) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return null;
        const name = nameNode.text;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract method declaration
     * Example: def calculate(x, y)
     * Example: def self.max(a, b)
     */
    extractMethod(node) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode)
            return null;
        let name = nameNode.text;
        // Check if it's a class method (singleton_method or def self.method_name)
        if (node.type === 'singleton_method') {
            // For singleton methods, prepend 'self.' to indicate class method
            name = `self.${name}`;
        }
        return this.createSymbol(node, name, 'method');
    }
    /**
     * Extract constant assignment
     * Example: MAX_SIZE = 100
     * Example: VERSION = "1.0.0"
     */
    extractAssignment(node) {
        // Look for constant assignments (all caps variable names)
        const leftNode = node.childForFieldName('left');
        if (!leftNode)
            return null;
        // Check if it's a constant (starts with uppercase)
        if (leftNode.type === 'constant') {
            const name = leftNode.text;
            return this.createSymbol(node, name, 'constant');
        }
        // Check for class variables (@@variable)
        if (leftNode.type === 'class_variable') {
            const name = leftNode.text;
            return this.createSymbol(node, name, 'variable');
        }
        // Check for instance variables (@variable)
        if (leftNode.type === 'instance_variable') {
            const name = leftNode.text;
            return this.createSymbol(node, name, 'variable');
        }
        return null;
    }
}
//# sourceMappingURL=RubyParserService.js.map