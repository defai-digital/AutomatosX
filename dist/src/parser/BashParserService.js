/**
 * BashParserService.ts
 *
 * Bash language parser using Tree-sitter
 * Extracts symbols from Bash/shell scripts
 */
import Bash from 'tree-sitter-bash';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * BashParserService - Extracts symbols from Bash code
 */
export class BashParserService extends BaseLanguageParser {
    language = 'bash';
    extensions = ['.sh', '.bash', '.zsh'];
    constructor() {
        super(Bash);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'variable_assignment':
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
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Check if readonly/declare -r (constant)
        const parent = node.parent;
        const isConst = parent?.text.includes('readonly') ||
            parent?.text.includes('declare -r') ||
            false;
        return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
    }
}
//# sourceMappingURL=BashParserService.js.map