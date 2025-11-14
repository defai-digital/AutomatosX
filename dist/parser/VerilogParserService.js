/**
 * VerilogParserService.ts
 *
 * Verilog HDL parser using Tree-sitter
 * Extracts symbols from Verilog hardware description language source code
 *
 * Verilog is used for FPGA and ASIC design.
 */
import Verilog from 'tree-sitter-verilog';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * VerilogParserService - Extracts symbols from Verilog code
 */
export class VerilogParserService extends BaseLanguageParser {
    language = 'verilog';
    extensions = ['.v', '.vh'];
    constructor() {
        super(Verilog);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'module_declaration':
                return this.extractModule(node);
            case 'task_declaration':
                return this.extractTask(node);
            case 'function_declaration':
                return this.extractFunction(node);
            case 'net_declaration':
            case 'reg_declaration':
                return this.extractVariable(node);
            case 'parameter_declaration':
            case 'localparam_declaration':
                return this.extractParameter(node);
            default:
                return null;
        }
    }
    /**
     * Extract module declaration
     */
    extractModule(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract task declaration
     */
    extractTask(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract function declaration
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract variable declaration (net or reg)
     */
    extractVariable(node) {
        // Get list of identifiers
        const identifiers = node.descendantsOfType('simple_identifier');
        if (identifiers.length === 0)
            return null;
        // Take the first identifier
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
}
//# sourceMappingURL=VerilogParserService.js.map