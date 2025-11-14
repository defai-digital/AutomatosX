/**
 * ZshParserService.ts
 *
 * Zsh language parser using Tree-sitter
 * Extracts symbols from Zsh scripts
 */
import Zsh from 'tree-sitter-zsh';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * ZshParserService - Extracts symbols from Zsh code
 */
export class ZshParserService extends BaseLanguageParser {
    language = 'zsh';
    extensions = ['.zsh', '.zshrc', '.zprofile', '.zshenv'];
    constructor() {
        super(Zsh);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'variable_assignment':
            case 'assignment':
                return this.extractVariable(node);
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
     * Extract variable assignment
     */
    extractVariable(node) {
        // Get variable name
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('variable_name')[0];
        if (!nameNode)
            return null;
        const name = nameNode.text;
        // Check if readonly/typeset -r (constant)
        const parent = node.parent;
        const isConst = parent?.text.includes('readonly') ||
            parent?.text.includes('typeset -r') ||
            false;
        return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
    }
}
//# sourceMappingURL=ZshParserService.js.map