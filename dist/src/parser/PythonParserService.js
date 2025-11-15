/**
 * PythonParserService.ts
 *
 * Python language parser using Tree-sitter
 * Extracts symbols from Python source code
 */
import Python from 'tree-sitter-python';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * PythonParserService - Extracts symbols from Python code
 */
export class PythonParserService extends BaseLanguageParser {
    language = 'python';
    extensions = ['.py', '.pyi'];
    constructor() {
        super(Python);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'class_definition':
                return this.extractClass(node);
            case 'decorated_definition':
                // Handle @decorator syntax
                return this.extractDecoratedDefinition(node);
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
        // Determine if this is a method (inside a class) or a function
        const isMethod = this.isInsideClass(node);
        return this.createSymbol(node, name, isMethod ? 'method' : 'function');
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
     * Extract decorated definition (e.g., @property, @staticmethod)
     */
    extractDecoratedDefinition(node) {
        // Find the actual definition node (function or class)
        const definition = node.childForFieldName('definition');
        if (!definition)
            return null;
        return this.extractSymbol(definition);
    }
    /**
     * Check if a node is inside a class definition
     */
    isInsideClass(node) {
        let current = node.parent;
        while (current) {
            if (current.type === 'class_definition') {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    /**
     * Override walkTree to handle Python-specific patterns
     */
    walkTree(node, symbols) {
        // Extract symbol based on node type
        const symbol = this.extractSymbol(node);
        if (symbol) {
            symbols.push(symbol);
        }
        // Special handling for decorated_definition:
        // Don't walk into children because we already extracted the definition
        if (node.type === 'decorated_definition') {
            return;
        }
        // Walk into other children
        for (const child of node.children) {
            this.walkTree(child, symbols);
        }
    }
}
//# sourceMappingURL=PythonParserService.js.map