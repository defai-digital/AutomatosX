/**
 * MakefileParserService.ts
 *
 * Makefile language parser using Tree-sitter
 * Extracts targets and variables from Makefiles
 */
import Make from 'tree-sitter-make';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * MakefileParserService - Extracts structure from Makefiles
 */
export class MakefileParserService extends BaseLanguageParser {
    language = 'makefile';
    extensions = ['Makefile', 'makefile', '.mk', 'GNUmakefile'];
    constructor() {
        super(Make);
    }
    /**
     * Extract symbol from AST node
     * For Makefiles, we extract targets and variables
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'rule':
                return this.extractTarget(node);
            case 'variable_assignment':
                return this.extractVariable(node);
            default:
                return null;
        }
    }
    /**
     * Extract make target
     */
    extractTarget(node) {
        const targets = node.childForFieldName('targets');
        if (!targets)
            return null;
        // Get first target name
        const target = targets.descendantsOfType('word')[0] ||
            targets.descendantsOfType('target')[0];
        if (!target)
            return null;
        const name = target.text;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract make variable
     */
    extractVariable(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Check if it's a constant-style variable (all caps)
        const isConst = name === name.toUpperCase();
        return this.createSymbol(node, name, isConst ? 'constant' : 'variable');
    }
}
//# sourceMappingURL=MakefileParserService.js.map