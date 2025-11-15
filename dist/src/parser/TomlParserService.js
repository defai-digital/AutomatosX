/**
 * TomlParserService.ts
 *
 * TOML language parser using Tree-sitter
 * Extracts keys and structure from TOML files
 */
import TOML from 'tree-sitter-toml';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * TomlParserService - Extracts structure from TOML files
 */
export class TomlParserService extends BaseLanguageParser {
    language = 'toml';
    extensions = ['.toml'];
    constructor() {
        super(TOML);
    }
    /**
     * Extract symbol from AST node
     * For TOML, we extract sections and top-level keys
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'table':
                return this.extractTable(node);
            case 'pair':
                return this.extractKey(node);
            default:
                return null;
        }
    }
    /**
     * Extract TOML table (section) as a symbol
     */
    extractTable(node) {
        // Get table name from header
        const header = node.descendantsOfType('bare_key')[0] ||
            node.descendantsOfType('quoted_key')[0];
        if (!header)
            return null;
        const name = header.text.replace(/^["']|["']$/g, '');
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract TOML key as a symbol
     */
    extractKey(node) {
        const key = node.childForFieldName('key') ||
            node.descendantsOfType('bare_key')[0] ||
            node.descendantsOfType('quoted_key')[0];
        if (!key)
            return null;
        const name = key.text.replace(/^["']|["']$/g, '');
        return this.createSymbol(node, name, 'constant');
    }
}
//# sourceMappingURL=TomlParserService.js.map