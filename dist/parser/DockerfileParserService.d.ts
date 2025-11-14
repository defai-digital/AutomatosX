/**
 * DockerfileParserService.ts
 *
 * Dockerfile language parser using Tree-sitter
 * Extracts structure from Dockerfiles
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * DockerfileParserService - Extracts structure from Dockerfiles
 */
export declare class DockerfileParserService extends BaseLanguageParser {
    readonly language = "dockerfile";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     * For Dockerfiles, we extract FROM, ARG, ENV as symbols
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract FROM instruction
     */
    private extractFrom;
    /**
     * Extract ARG instruction
     */
    private extractArg;
    /**
     * Extract ENV instruction
     */
    private extractEnv;
    /**
     * Extract LABEL instruction
     */
    private extractLabel;
}
//# sourceMappingURL=DockerfileParserService.d.ts.map