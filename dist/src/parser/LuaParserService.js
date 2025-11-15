/**
 * LuaParserService.ts
 *
 * Lua language parser using Tree-sitter
 * Extracts symbols from Lua source code
 */
import Lua from 'tree-sitter-lua';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * LuaParserService - Extracts symbols from Lua code
 */
export class LuaParserService extends BaseLanguageParser {
    language = 'lua';
    extensions = ['.lua'];
    constructor() {
        super(Lua);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_declaration':
            case 'function_definition':
                return this.extractFunction(node);
            case 'variable_declaration':
            case 'assignment_statement':
                return this.extractVariable(node);
            default:
                return null;
        }
    }
    /**
     * Extract function declaration
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract variable declaration
     */
    extractVariable(node) {
        // Get variable list
        const variables = node.descendantsOfType('identifier');
        if (variables.length === 0)
            return null;
        // Take the first variable
        const name = variables[0].text;
        // Check if local (constant-like) or global
        const isLocal = node.parent?.text.startsWith('local') || false;
        return this.createSymbol(node, name, isLocal ? 'constant' : 'variable');
    }
}
//# sourceMappingURL=LuaParserService.js.map