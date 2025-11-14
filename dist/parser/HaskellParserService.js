/**
 * HaskellParserService.ts
 *
 * Haskell language parser using Tree-sitter
 * Extracts symbols from Haskell functional programming code
 */
import Haskell from 'tree-sitter-haskell';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * HaskellParserService - Extracts symbols from Haskell code
 */
export class HaskellParserService extends BaseLanguageParser {
    language = 'haskell';
    extensions = ['.hs', '.lhs'];
    constructor() {
        super(Haskell);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function':
            case 'signature':
                return this.extractFunction(node);
            case 'data':
            case 'newtype':
                return this.extractDataType(node);
            case 'type_synonym':
                return this.extractTypeSynonym(node);
            case 'class':
                return this.extractTypeClass(node);
            case 'instance':
                return this.extractInstance(node);
            default:
                return null;
        }
    }
    /**
     * Extract function definition or signature
     */
    extractFunction(node) {
        const variable = node.childForFieldName('name') ||
            node.descendantsOfType('variable')[0] ||
            node.descendantsOfType('identifier')[0];
        if (!variable)
            return null;
        const name = variable.text;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract data type or newtype
     */
    extractDataType(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('type')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract type synonym
     */
    extractTypeSynonym(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('type')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract type class
     */
    extractTypeClass(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('type')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract type class instance
     */
    extractInstance(node) {
        const typeNode = node.descendantsOfType('type')[0];
        if (!typeNode)
            return null;
        return this.createSymbol(node, typeNode.text, 'class');
    }
}
//# sourceMappingURL=HaskellParserService.js.map