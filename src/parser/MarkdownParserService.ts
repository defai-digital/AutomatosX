/**
 * MarkdownParserService.ts
 *
 * Markdown language parser using Tree-sitter
 * Extracts headings and structure from Markdown files
 */

import Parser from 'tree-sitter';
import Markdown from 'tree-sitter-markdown';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * MarkdownParserService - Extracts structure from Markdown files
 */
export class MarkdownParserService extends BaseLanguageParser {
  readonly language = 'markdown';
  readonly extensions = ['.md', '.markdown', '.mdown', '.mkd'];

  constructor() {
    super(Markdown.parser() as Parser.Language);
  }

  /**
   * Extract symbol from AST node
   * For Markdown, we extract headings as sections
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
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
  private extractHeading(node: Parser.SyntaxNode): Symbol | null {
    // Get heading content
    const content = node.descendantsOfType('heading_content')[0] ||
                    node.descendantsOfType('paragraph')[0];
    if (!content) return null;

    const name = content.text.trim();

    return this.createSymbol(node, name, 'module');
  }
}
