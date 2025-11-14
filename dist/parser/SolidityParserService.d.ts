/**
 * SolidityParserService.ts
 *
 * Solidity language parser using Tree-sitter
 * Extracts symbols from Ethereum smart contract code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * SolidityParserService - Extracts symbols from Solidity smart contracts
 */
export declare class SolidityParserService extends BaseLanguageParser {
    readonly language = "solidity";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract contract declaration
     */
    private extractContract;
    /**
     * Extract interface declaration
     */
    private extractInterface;
    /**
     * Extract library declaration
     */
    private extractLibrary;
    /**
     * Extract function, constructor, or fallback/receive
     */
    private extractFunction;
    /**
     * Extract modifier definition
     */
    private extractModifier;
    /**
     * Extract event definition
     */
    private extractEvent;
    /**
     * Extract struct declaration
     */
    private extractStruct;
    /**
     * Extract enum declaration
     */
    private extractEnum;
    /**
     * Extract state variable declaration
     */
    private extractStateVariable;
}
//# sourceMappingURL=SolidityParserService.d.ts.map