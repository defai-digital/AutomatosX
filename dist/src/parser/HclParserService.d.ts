/**
 * HclParserService.ts
 *
 * HCL (HashiCorp Configuration Language) parser using Tree-sitter
 * Extracts symbols from Terraform, Vault, Waypoint, and Nomad configurations
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * HclParserService - Extracts symbols from HCL/Terraform code
 */
export declare class HclParserService extends BaseLanguageParser {
    readonly language = "hcl";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract generic block (terraform, provider, etc.)
     */
    private extractBlock;
    /**
     * Extract attribute/variable assignment
     */
    private extractAttribute;
    /**
     * Extract variable declaration
     */
    private extractVariable;
    /**
     * Extract output declaration
     */
    private extractOutput;
    /**
     * Extract resource declaration
     */
    private extractResource;
    /**
     * Extract data source declaration
     */
    private extractData;
    /**
     * Extract module declaration
     */
    private extractModule;
    /**
     * Extract locals block
     */
    private extractLocals;
}
//# sourceMappingURL=HclParserService.d.ts.map