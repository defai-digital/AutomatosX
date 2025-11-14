/**
 * RegexParserService.ts
 *
 * Regular Expression parser using Tree-sitter
 * Extracts patterns and structure from regex
 */
import Regex from 'tree-sitter-regex';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * RegexParserService - Extracts structure from regular expressions
 */
export class RegexParserService extends BaseLanguageParser {
    language = 'regex';
    extensions = ['.regex', '.re'];
    constructor() {
        super(Regex);
    }
    /**
     * Extract symbol from AST node
     * For regex, we extract named groups as symbols
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'named_group':
            case 'named_capturing_group':
                return this.extractNamedGroup(node);
            case 'group_name':
                return this.extractGroupName(node);
            default:
                return null;
        }
    }
    /**
     * Extract named capturing group
     */
    extractNamedGroup(node) {
        const name = this.getFieldText(node, 'name');
        if (!name) {
            // Try to find group_name child
            const groupName = node.descendantsOfType('group_name')[0];
            if (groupName) {
                return this.createSymbol(node, groupName.text, 'variable');
            }
            return null;
        }
        return this.createSymbol(node, name, 'variable');
    }
    /**
     * Extract group name
     */
    extractGroupName(node) {
        const name = node.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'variable');
    }
}
//# sourceMappingURL=RegexParserService.js.map