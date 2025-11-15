/**
 * MarkdownParserService.ts
 *
 * Markdown language parser using Tree-sitter
 * Extracts headings and structure from Markdown files
 */
import Markdown from 'tree-sitter-markdown';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * MarkdownParserService - Extracts structure from Markdown files
 */
export class MarkdownParserService extends BaseLanguageParser {
    language = 'markdown';
    extensions = ['.md', '.markdown', '.mdown', '.mkd'];
    constructor() {
        super(Markdown.parser());
    }
    /**
     * Extract symbol from AST node
     * For Markdown, we extract headings as sections
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'atx_heading':
            case 'setext_heading':
                return this.extractHeading(node);
            default:
                return null;
        }
    }
    /**
     * Extract heading as a symbol
     */
    extractHeading(node) {
        // Get heading content
        const content = node.descendantsOfType('heading_content')[0] ||
            node.descendantsOfType('paragraph')[0];
        if (!content)
            return null;
        const name = content.text.trim();
        return this.createSymbol(node, name, 'module');
    }
}
//# sourceMappingURL=MarkdownParserService.js.map