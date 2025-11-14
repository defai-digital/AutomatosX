/**
 * SystemVerilogParserService.ts
 *
 * SystemVerilog HDL parser using Tree-sitter
 * Extracts symbols from SystemVerilog hardware description language source code
 *
 * SystemVerilog extends Verilog with OOP features, assertions, and testbench constructs.
 * Used for FPGA, ASIC design, and verification.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * SystemVerilogParserService - Extracts symbols from SystemVerilog code
 */
export declare class SystemVerilogParserService extends BaseLanguageParser {
    readonly language = "systemverilog";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract module declaration
     */
    private extractModule;
    /**
     * Extract class declaration
     */
    private extractClass;
    /**
     * Extract interface declaration
     */
    private extractInterface;
    /**
     * Extract package declaration
     */
    private extractPackage;
    /**
     * Extract task declaration
     */
    private extractTask;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract variable declaration
     */
    private extractVariable;
    /**
     * Extract parameter declaration
     */
    private extractParameter;
    /**
     * Extract typedef declaration
     */
    private extractTypedef;
}
//# sourceMappingURL=SystemVerilogParserService.d.ts.map