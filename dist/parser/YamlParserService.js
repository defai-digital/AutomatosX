/**
 * YamlParserService.ts
 *
 * YAML language parser using Tree-sitter
 * Extracts keys and structure from YAML files
 */
import YAML from 'tree-sitter-yaml';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * YamlParserService - Extracts structure from YAML files
 */
export class YamlParserService extends BaseLanguageParser {
    language = 'yaml';
    extensions = ['.yaml', '.yml'];
    constructor() {
        super(YAML);
    }
    /**
     * Extract symbol from AST node
     * For YAML, we extract top-level keys as constants
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'block_mapping_pair':
                return this.extractKey(node);
            default:
                return null;
        }
    }
    /**
     * Extract YAML key as a symbol
     */
    extractKey(node) {
        const key = node.childForFieldName('key');
        if (!key)
            return null;
        // Only extract top-level keys
        const parent = node.parent;
        if (!parent || parent.type !== 'block_mapping')
            return null;
        const grandparent = parent.parent;
        if (grandparent && grandparent.type !== 'stream' && grandparent.type !== 'document')
            return null;
        const name = key.text;
        return this.createSymbol(node, name, 'constant');
    }
}
//# sourceMappingURL=YamlParserService.js.map