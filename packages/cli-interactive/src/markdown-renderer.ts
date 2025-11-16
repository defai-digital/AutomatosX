/**
 * Markdown Renderer
 *
 * Renders markdown to beautiful terminal output with syntax highlighting
 */

import { marked } from 'marked';
// @ts-ignore - marked-terminal doesn't have types
import { markedTerminal } from 'marked-terminal';
import highlight from 'cli-highlight';
import chalk from 'chalk';

export class MarkdownRenderer {
  private enabled: boolean;

  constructor(options?: { enabled?: boolean }) {
    this.enabled = options?.enabled ?? true;

    if (this.enabled) {
      // Configure marked with terminal renderer
      marked.use(markedTerminal({
        // Code blocks with syntax highlighting
        code: (code: string, lang?: string) => {
          return this.highlightCode(code, lang);
        },
        // Inline code
        codespan: (code: string) => {
          return chalk.cyan(`\`${code}\``);
        },
        // Headers
        heading: (text: string, level: number) => {
          const colors = [chalk.bold.magenta, chalk.bold.blue, chalk.bold.yellow];
          const colorFn = colors[Math.min(level - 1, 2)] || chalk.bold;
          return colorFn(text) + '\n';
        },
        // Bold
        strong: (text: string) => {
          return chalk.bold(text);
        },
        // Italic
        em: (text: string) => {
          return chalk.italic(text);
        },
        // Links
        link: (href: string, title: string, text: string) => {
          return chalk.blue.underline(text) + chalk.dim(` (${href})`);
        },
        // Lists
        list: (body: string, ordered: boolean) => {
          return body + '\n';
        },
        listitem: (text: string) => {
          return '  • ' + text;
        },
        // Blockquotes
        blockquote: (quote: string) => {
          return chalk.dim('│ ') + chalk.italic(quote);
        },
        // Tables
        table: (header: string, body: string) => {
          return header + body + '\n';
        },
        tablerow: (content: string) => {
          return content + '\n';
        },
        tablecell: (content: string) => {
          return content.padEnd(20) + ' ';
        }
      }) as any);
    }
  }

  /**
   * Render markdown string to terminal format
   */
  render(markdown: string): string {
    if (!this.enabled) {
      return markdown;
    }

    try {
      const rendered = marked.parse(markdown, { async: false }) as string;
      return rendered;
    } catch (error) {
      // Fallback to plain text if parsing fails
      console.error('Markdown parsing error:', error);
      return markdown;
    }
  }

  /**
   * Syntax highlight code block
   */
  highlightCode(code: string, language?: string): string {
    // Bug #9 fix: Validate input to prevent crashes
    if (!code || typeof code !== 'string') {
      return this.boxCode('', language || 'text');
    }

    try {
      const trimmedCode = code.trim();

      // Determine language for highlighting
      let highlightLang = language || 'javascript';

      // Map common aliases
      const langMap: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'sh': 'bash',
        'shell': 'bash',
        'yml': 'yaml',
        'json': 'json'
      };

      highlightLang = langMap[highlightLang.toLowerCase()] || highlightLang;

      // Highlight with cli-highlight
      const highlighted = highlight(trimmedCode, {
        language: highlightLang,
        ignoreIllegals: true
      });

      // Box the code block
      return this.boxCode(highlighted, highlightLang);

    } catch (error) {
      // Fallback to plain code if highlighting fails
      return this.boxCode(code, language || 'text');
    }
  }

  /**
   * Put code in a nice box
   */
  private boxCode(code: string, language: string): string {
    // Bug #9 fix: Validate input to prevent crashes
    if (!code || typeof code !== 'string') {
      code = '';
    }

    const lines = code.split('\n');

    // Handle empty code (Bug #1 fix)
    if (lines.length === 0 || (lines.length === 1 && lines[0]?.trim() === '')) {
      const emptyWidth = Math.max(language.length + 4, 15);
      const emptyBorder = '─'.repeat(emptyWidth);
      const emptyLabel = `${language}`.padEnd(emptyWidth - 2, ' ');
      return chalk.dim(`┌ ${emptyLabel} ┐\n│ ${' '.repeat(emptyWidth - 2)} │\n│ ${chalk.italic('(empty)').padEnd(emptyWidth - 2)} │\n│ ${' '.repeat(emptyWidth - 2)} │\n└${emptyBorder}┘\n`);
    }

    // Bug #16 fix: Use reduce() instead of spread operator to avoid call stack overflow
    // Spread operator (...array) in Math.max() can exceed max arguments (65K-100K limit)
    const maxLineLength = lines.reduce((max, l) => Math.max(max, this.stripAnsi(l).length), 0);
    const maxLen = Math.max(
      maxLineLength,
      language.length + 2,
      10 // minimum width
    );
    const width = Math.min(maxLen + 2, 80);
    const border = '─'.repeat(width);

    // Language label
    const label = ` ${language} `;
    const labelPadding = '─'.repeat(Math.max(0, width - label.length));

    const result: string[] = [];
    result.push(chalk.dim(`┌${label}${labelPadding}┐`));

    lines.forEach(line => {
      const padding = ' '.repeat(Math.max(0, width - this.stripAnsi(line).length));
      result.push(chalk.dim('│ ') + line + padding + chalk.dim(' │'));
    });

    result.push(chalk.dim(`└${border}┘`));

    return result.join('\n') + '\n';
  }

  /**
   * Strip ANSI codes for length calculation
   */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Check if text contains markdown syntax
   */
  hasMarkdown(text: string): boolean {
    if (!text || text.length < 2) {
      return false;
    }

    // Bug #2 fix: More precise regex patterns to avoid false positives
    const markdownPatterns = [
      /^#{1,6}\s/m,                     // Headers: # Header
      /\*\*[^*]+\*\*/,                  // Bold: **text** (non-greedy, no nested *)
      /(?<!\*)\*(?!\*)[^*\n]+\*(?!\*)/, // Italic: *text* (not part of **)
      /```[\s\S]*?```/,                 // Code blocks: ```code```
      /`[^`\n]+`/,                      // Inline code: `code` (no newlines)
      /^\s*[-*+]\s/m,                   // Unordered lists: - item
      /^\s*\d+\.\s/m,                   // Ordered lists: 1. item
      /\[.+?\]\(.+?\)/,                 // Links: [text](url) (non-greedy)
      /^\s*>/m,                         // Blockquotes: > quote
      /^\|.+\|$/m,                      // Tables: | col | col |
      /^-{3,}$/m,                       // Horizontal rules: 3+ dashes
      /~~[^~\n]+~~/                     // Strikethrough: ~~text~~ (non-greedy)
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Extract code blocks from text
   */
  extractCodeBlocks(text: string): Array<{ language: string; code: string; start: number; end: number }> {
    // Bug #3 fix: Handle optional language and newline
    // Bug #19 fix: Support languages with hyphens, plus signs, and hash symbols (c++, objective-c, c#)
    const codeBlockRegex = /```([\w\-+#]+)?[ \t]*\n?([\s\S]*?)```/g;
    const blocks: Array<{ language: string; code: string; start: number; end: number }> = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: (match[2] || '').trim(), // trim whitespace
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return blocks;
  }

  /**
   * Check if text is currently inside a code block (incomplete)
   */
  isIncompleteCodeBlock(text: string): boolean {
    // Bug #4 fix: More sophisticated detection
    // Remove inline code to avoid false positives
    const withoutInlineCode = text.replace(/`[^`\n]+`/g, '');

    // Remove escaped backticks
    const withoutEscaped = withoutInlineCode.replace(/\\```/g, '');

    // Count remaining ``` markers
    const openMarkers = (withoutEscaped.match(/```/g) || []).length;

    // Odd number means we're inside an unclosed code block
    return openMarkers % 2 === 1;
  }
}
