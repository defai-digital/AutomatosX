/**
 * AutomatosX v8.0.0 - Syntax Highlighter
 *
 * Syntax highlighting for code blocks using highlight.js + chalk
 */
import hljs from 'highlight.js';
import chalk from 'chalk';
export class SyntaxHighlighter {
    languageMap = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'rs': 'rust',
        'go': 'go',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'sh': 'bash',
        'yml': 'yaml',
        'yaml': 'yaml',
        'json': 'json',
        'sql': 'sql',
        'md': 'markdown'
    };
    /**
     * Highlight code with syntax coloring
     * @param code - Raw code string
     * @param language - Optional language hint (auto-detect if not provided)
     * @returns Syntax-highlighted code with chalk colors
     */
    highlightCode(code, language) {
        try {
            const lang = this.resolveLanguage(language);
            if (lang) {
                const highlighted = hljs.highlight(code, { language: lang });
                return this.applyChalkColors(highlighted.value);
            }
            else {
                // Auto-detect language
                const highlighted = hljs.highlightAuto(code);
                return this.applyChalkColors(highlighted.value);
            }
        }
        catch (error) {
            // Fallback to plain text if highlighting fails
            return code;
        }
    }
    /**
     * Resolve language alias to full name
     */
    resolveLanguage(language) {
        if (!language)
            return undefined;
        return this.languageMap[language.toLowerCase()] || language;
    }
    /**
     * Convert highlight.js HTML to chalk-colored terminal output
     */
    applyChalkColors(html) {
        return html
            // Keywords (if, function, class, etc.)
            .replace(/<span class="hljs-keyword">(.*?)<\/span>/g, (_, text) => chalk.blue(text))
            // Strings
            .replace(/<span class="hljs-string">(.*?)<\/span>/g, (_, text) => chalk.green(text))
            // Numbers
            .replace(/<span class="hljs-number">(.*?)<\/span>/g, (_, text) => chalk.yellow(text))
            // Comments
            .replace(/<span class="hljs-comment">(.*?)<\/span>/g, (_, text) => chalk.gray(text))
            // Function names
            .replace(/<span class="hljs-title function_">(.*?)<\/span>/g, (_, text) => chalk.cyan(text))
            // Class names
            .replace(/<span class="hljs-title class_">(.*?)<\/span>/g, (_, text) => chalk.magenta(text))
            // Built-in types
            .replace(/<span class="hljs-built_in">(.*?)<\/span>/g, (_, text) => chalk.blueBright(text))
            // Attributes
            .replace(/<span class="hljs-attr">(.*?)<\/span>/g, (_, text) => chalk.cyan(text))
            // Literals
            .replace(/<span class="hljs-literal">(.*?)<\/span>/g, (_, text) => chalk.yellow(text))
            // Variables
            .replace(/<span class="hljs-variable">(.*?)<\/span>/g, (_, text) => chalk.white(text))
            // Remove remaining HTML tags
            .replace(/<[^>]+>/g, '');
    }
    /**
     * Detect code blocks in markdown and highlight them
     * @param markdown - Markdown text with ``` code blocks
     * @returns Markdown with highlighted code blocks
     */
    highlightMarkdownCodeBlocks(markdown) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        return markdown.replace(codeBlockRegex, (match, lang, code) => {
            const highlighted = this.highlightCode(code, lang);
            const header = lang ? chalk.gray(`\`\`\`${lang}`) : chalk.gray('```');
            return `${header}\n${highlighted}\n${chalk.gray('```')}`;
        });
    }
}
//# sourceMappingURL=SyntaxHighlighter.js.map