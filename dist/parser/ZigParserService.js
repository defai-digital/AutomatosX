/**
 * ZigParserService.ts
 *
 * Zig language parser using Tree-sitter
 * Extracts symbols from Zig systems programming code
 */
import Zig from 'tree-sitter-zig';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * ZigParserService - Extracts symbols from Zig code
 */
export class ZigParserService extends BaseLanguageParser {
    language = 'zig';
    extensions = ['.zig'];
    constructor() {
        super(Zig);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'FnProto':
            case 'FnDecl':
                return this.extractFunction(node);
            case 'VarDecl':
                return this.extractVariable(node);
            case 'ContainerDecl':
                return this.extractContainer(node);
            case 'TestDecl':
                return this.extractTest(node);
            default:
                return null;
        }
    }
    /**
     * Extract function declaration
     */
    extractFunction(node) {
        const identifiers = node.descendantsOfType('IDENTIFIER');
        if (identifiers.length === 0)
            return null;
        const name = identifiers[0].text;
        // Check if it's a method inside a struct/union/enum
        const kind = this.isInsideContainer(node) ? 'method' : 'function';
        return this.createSymbol(node, name, kind);
    }
    /**
     * Extract variable declaration (const, var)
     */
    extractVariable(node) {
        const identifiers = node.descendantsOfType('IDENTIFIER');
        if (identifiers.length === 0)
            return null;
        const name = identifiers[0].text;
        // Check if it's inside a container (would be a field/property)
        if (this.isInsideContainer(node)) {
            return this.createSymbol(node, name, 'variable');
        }
        // Top-level constants and variables
        const text = node.text;
        const kind = text.startsWith('const') ? 'constant' : 'variable';
        return this.createSymbol(node, name, kind);
    }
    /**
     * Extract container declaration (struct, union, enum, opaque)
     */
    extractContainer(node) {
        // Look for the container keyword
        const text = node.text;
        let kind = 'struct';
        if (text.includes('enum')) {
            kind = 'enum';
        }
        else if (text.includes('union')) {
            kind = 'struct';
        }
        else if (text.includes('struct')) {
            kind = 'struct';
        }
        // Get the name from parent VarDecl if exists
        const parent = node.parent;
        if (parent?.type === 'VarDecl') {
            const identifiers = parent.descendantsOfType('IDENTIFIER');
            if (identifiers.length > 0) {
                return this.createSymbol(node, identifiers[0].text, kind);
            }
        }
        return null;
    }
    /**
     * Extract test declaration
     */
    extractTest(node) {
        const stringLiterals = node.descendantsOfType('STRINGLITERALSINGLE');
        if (stringLiterals.length === 0)
            return null;
        // Test name is the string literal
        const name = stringLiterals[0].text.replace(/"/g, '');
        return this.createSymbol(node, `test: ${name}`, 'function');
    }
    /**
     * Check if node is inside a container (struct/union/enum)
     */
    isInsideContainer(node) {
        let parent = node.parent;
        while (parent) {
            if (parent.type === 'ContainerDecl') {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }
}
//# sourceMappingURL=ZigParserService.js.map