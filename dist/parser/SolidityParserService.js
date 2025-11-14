/**
 * SolidityParserService.ts
 *
 * Solidity language parser using Tree-sitter
 * Extracts symbols from Ethereum smart contract code
 */
import Solidity from 'tree-sitter-solidity';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * SolidityParserService - Extracts symbols from Solidity smart contracts
 */
export class SolidityParserService extends BaseLanguageParser {
    language = 'solidity';
    extensions = ['.sol'];
    constructor() {
        super(Solidity);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'contract_declaration':
                return this.extractContract(node);
            case 'interface_declaration':
                return this.extractInterface(node);
            case 'library_declaration':
                return this.extractLibrary(node);
            case 'function_definition':
            case 'constructor_definition':
            case 'fallback_receive_definition':
                return this.extractFunction(node);
            case 'modifier_definition':
                return this.extractModifier(node);
            case 'event_definition':
                return this.extractEvent(node);
            case 'struct_declaration':
                return this.extractStruct(node);
            case 'enum_declaration':
                return this.extractEnum(node);
            case 'state_variable_declaration':
                return this.extractStateVariable(node);
            default:
                return null;
        }
    }
    /**
     * Extract contract declaration
     */
    extractContract(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'class');
    }
    /**
     * Extract interface declaration
     */
    extractInterface(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'interface');
    }
    /**
     * Extract library declaration
     */
    extractLibrary(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'module');
    }
    /**
     * Extract function, constructor, or fallback/receive
     */
    extractFunction(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode) {
            // Constructor, fallback, or receive
            if (node.type === 'constructor_definition') {
                return this.createSymbol(node, 'constructor', 'method');
            }
            else if (node.type === 'fallback_receive_definition') {
                const text = node.text;
                const name = text.includes('fallback') ? 'fallback' : 'receive';
                return this.createSymbol(node, name, 'method');
            }
            return null;
        }
        return this.createSymbol(node, nameNode.text, 'function');
    }
    /**
     * Extract modifier definition
     */
    extractModifier(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'function');
    }
    /**
     * Extract event definition
     */
    extractEvent(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'constant');
    }
    /**
     * Extract struct declaration
     */
    extractStruct(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'struct');
    }
    /**
     * Extract enum declaration
     */
    extractEnum(node) {
        const nameNode = node.childForFieldName('name') ||
            node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        return this.createSymbol(node, nameNode.text, 'enum');
    }
    /**
     * Extract state variable declaration
     */
    extractStateVariable(node) {
        const nameNode = node.descendantsOfType('identifier')[0];
        if (!nameNode)
            return null;
        // Check if it's a constant
        const text = node.text;
        const kind = text.includes('constant') ? 'constant' : 'variable';
        return this.createSymbol(node, nameNode.text, kind);
    }
}
//# sourceMappingURL=SolidityParserService.js.map