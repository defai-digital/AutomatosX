/**
 * SystemVerilogParserService.ts
 *
 * SystemVerilog HDL parser using Tree-sitter
 * Extracts symbols from SystemVerilog hardware description language source code
 *
 * SystemVerilog extends Verilog with OOP features, assertions, and testbench constructs.
 * Used for FPGA, ASIC design, and verification.
 */
import SystemVerilog from 'tree-sitter-systemverilog';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * SystemVerilogParserService - Extracts symbols from SystemVerilog code
 */
export class SystemVerilogParserService extends BaseLanguageParser {
    language = 'systemverilog';
    extensions = ['.sv', '.svh'];
    constructor() {
        super(SystemVerilog);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'module_declaration':
                return this.extractModule(node);
            case 'class_declaration':
                return this.extractClass(node);
            case 'interface_declaration':
                return this.extractInterface(node);
            case 'package_declaration':
                return this.extractPackage(node);
            case 'task_declaration':
                return this.extractTask(node);
            case 'function_declaration':
                return this.extractFunction(node);
            case 'data_declaration':
            case 'net_declaration':
                return this.extractVariable(node);
            case 'parameter_declaration':
            case 'local_parameter_declaration':
                return this.extractParameter(node);
            case 'typedef_declaration':
                return this.extractTypedef(node);
            default:
                return null;
        }
    }
    /**
     * Extract module declaration
     */
    extractModule(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract class declaration
     */
    extractClass(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('class_identifier')[0]?.text ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract interface declaration
     */
    extractInterface(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('interface_identifier')[0]?.text ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract package declaration
     */
    extractPackage(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('package_identifier')[0]?.text ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract task declaration
     */
    extractTask(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('task_identifier')[0]?.text ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract function declaration
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name') ||
            node.descendantsOfType('function_identifier')[0]?.text ||
            node.descendantsOfType('simple_identifier')[0]?.text;
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract variable declaration
     */
    extractVariable(node) {
        const identifiers = node.descendantsOfType('simple_identifier');
        if (identifiers.length === 0)
            return null;
        const name = identifiers[0].text;
        return this.createSymbol(node, name, 'variable');
    }
    /**
     * Extract parameter declaration
     */
    extractParameter(node) {
        const identifiers = node.descendantsOfType('simple_identifier');
        if (identifiers.length === 0)
            return null;
        const name = identifiers[0].text;
        return this.createSymbol(node, name, 'constant');
    }
    /**
     * Extract typedef declaration
     */
    extractTypedef(node) {
        const identifiers = node.descendantsOfType('type_identifier');
        if (identifiers.length === 0) {
            // Fallback to simple_identifier
            const simpleIds = node.descendantsOfType('simple_identifier');
            if (simpleIds.length === 0)
                return null;
            const name = simpleIds[simpleIds.length - 1].text; // Last identifier is usually the typedef name
            return this.createSymbol(node, name, 'type');
        }
        const name = identifiers[0].text;
        return this.createSymbol(node, name, 'type');
    }
}
//# sourceMappingURL=SystemVerilogParserService.js.map