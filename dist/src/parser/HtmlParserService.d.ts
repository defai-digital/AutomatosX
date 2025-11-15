/**
 * HtmlParserService.ts
 *
 * HTML language parser using Tree-sitter
 * Extracts symbols from HTML source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
/**
 * HtmlParserService - Extracts symbols from HTML code
 */
export declare class HtmlParserService extends BaseLanguageParser {
    readonly language = "html";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract HTML element
     * Example: <div id="app" class="container">...</div>
     * Example: <button type="submit">Submit</button>
     * Example: <img src="logo.png" alt="Logo" />
     */
    private extractElement;
    /**
     * Extract script element
     * Example: <script src="app.js"></script>
     * Example: <script>console.log('Hello');</script>
     */
    private extractScriptElement;
    /**
     * Extract style element
     * Example: <style>body { margin: 0; }</style>
     * Example: <link rel="stylesheet" href="styles.css">
     */
    private extractStyleElement;
    /**
     * Extract self-closing tag
     * Example: <img src="logo.png" alt="Logo" />
     * Example: <input type="text" id="name" />
     */
    private extractSelfClosingTag;
    /**
     * Get attribute value from a tag
     */
    private getAttributeValue;
}
//# sourceMappingURL=HtmlParserService.d.ts.map