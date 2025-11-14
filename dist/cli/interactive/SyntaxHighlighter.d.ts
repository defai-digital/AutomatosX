/**
 * AutomatosX v8.0.0 - Syntax Highlighter
 *
 * Syntax highlighting for code blocks using highlight.js + chalk
 */
export declare class SyntaxHighlighter {
    private readonly languageMap;
    /**
     * Highlight code with syntax coloring
     * @param code - Raw code string
     * @param language - Optional language hint (auto-detect if not provided)
     * @returns Syntax-highlighted code with chalk colors
     */
    highlightCode(code: string, language?: string): string;
    /**
     * Resolve language alias to full name
     */
    private resolveLanguage;
    /**
     * Convert highlight.js HTML to chalk-colored terminal output
     */
    private applyChalkColors;
    /**
     * Detect code blocks in markdown and highlight them
     * @param markdown - Markdown text with ``` code blocks
     * @returns Markdown with highlighted code blocks
     */
    highlightMarkdownCodeBlocks(markdown: string): string;
}
//# sourceMappingURL=SyntaxHighlighter.d.ts.map