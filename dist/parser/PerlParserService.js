/**
 * PerlParserService.ts
 *
 * Perl language parser using Tree-sitter
 * Extracts symbols from Perl scripting code
 */
import Perl from '@ganezdragon/tree-sitter-perl';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * PerlParserService - Extracts symbols from Perl code
 */
export class PerlParserService extends BaseLanguageParser {
    language = 'perl';
    extensions = ['.pl', '.pm', '.t'];
    constructor() {
        super(Perl);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'subroutine_declaration_statement':
            case 'named_subroutine_expression':
                return this.extractSubroutine(node);
            case 'package_statement':
                return this.extractPackage(node);
            case 'variable_declaration':
            case 'our_declaration':
                return this.extractVariable(node);
            case 'use_statement':
                return this.extractUse(node);
            default:
                return null;
        }
    }
    /**
     * Extract subroutine declaration (Perl function)
     */
    extractSubroutine(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'function');
    }
    /**
     * Extract package declaration (Perl module)
     */
    extractPackage(node) {
        const packageName = node.childForFieldName('name');
        if (!packageName)
            return null;
        return this.createSymbol(node, packageName.text, 'module');
    }
    /**
     * Extract variable declaration (my, our, state)
     */
    extractVariable(node) {
        const variables = node.descendantsOfType('scalar_variable') ||
            node.descendantsOfType('array_variable') ||
            node.descendantsOfType('hash_variable');
        if (!variables || variables.length === 0)
            return null;
        const name = variables[0].text;
        return this.createSymbol(node, name, 'variable');
    }
    /**
     * Extract use statement (imports/modules)
     */
    extractUse(node) {
        const moduleNode = node.childForFieldName('module');
        if (!moduleNode)
            return null;
        return this.createSymbol(node, moduleNode.text, 'module');
    }
}
//# sourceMappingURL=PerlParserService.js.map