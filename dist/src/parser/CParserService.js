/**
 * CParserService.ts
 *
 * C language parser using Tree-sitter
 * Extracts symbols from C source code
 */
import C from 'tree-sitter-c';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * CParserService - Extracts symbols from C code
 */
export class CParserService extends BaseLanguageParser {
    language = 'c';
    extensions = ['.c', '.h'];
    constructor() {
        super(C);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'declaration':
                return this.extractDeclaration(node);
            case 'struct_specifier':
                return this.extractStruct(node);
            case 'enum_specifier':
                return this.extractEnum(node);
            case 'type_definition':
                return this.extractTypedef(node);
            default:
                return null;
        }
    }
    /**
     * Extract function definition
     */
    extractFunction(node) {
        // Get function declarator
        const declarator = node.childForFieldName('declarator');
        if (!declarator)
            return null;
        // Handle function_declarator or pointer_declarator wrapping it
        let funcDeclarator = declarator;
        if (declarator.type === 'pointer_declarator') {
            funcDeclarator = declarator.childForFieldName('declarator') || declarator;
        }
        // Get function name from declarator
        const name = this.getFieldText(funcDeclarator, 'declarator');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract struct definition
     */
    extractStruct(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'struct');
    }
    /**
     * Extract enum definition
     */
    extractEnum(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'enum');
    }
    /**
     * Extract typedef
     */
    extractTypedef(node) {
        // Get the declarator to find the typedef name
        const declarator = node.childForFieldName('declarator');
        if (!declarator)
            return null;
        // Extract name from type_identifier
        const name = this.getFieldText(declarator, 'name') || declarator.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract variable/constant declaration
     */
    extractDeclaration(node) {
        // Get declarator
        const declarator = node.descendantsOfType('init_declarator')[0] ||
            node.descendantsOfType('declarator')[0];
        if (!declarator)
            return null;
        // Check if it's a constant (const keyword)
        const isConst = node.text.includes('const');
        // Get identifier
        const identifier = declarator.descendantsOfType('identifier')[0];
        if (!identifier)
            return null;
        const name = identifier.text;
        return {
            name,
            kind: isConst ? 'constant' : 'variable',
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
        };
    }
}
//# sourceMappingURL=CParserService.js.map