/**
 * VerilogParserService.ts
 *
 * Verilog HDL parser using Tree-sitter
 * Extracts symbols from Verilog hardware description language source code
 *
 * Verilog is used for FPGA and ASIC design.
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * VerilogParserService - Extracts symbols from Verilog code
 */
export declare class VerilogParserService extends BaseLanguageParser {
    readonly language = "verilog";
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
     * Extract task declaration
     */
    private extractTask;
    /**
     * Extract function declaration
     */
    private extractFunction;
    /**
     * Extract variable declaration (net or reg)
     */
    private extractVariable;
    /**
     * Extract parameter declaration
     */
    private extractParameter;
}
//# sourceMappingURL=VerilogParserService.d.ts.map