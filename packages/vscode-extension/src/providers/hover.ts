/**
 * Hover Provider
 *
 * Shows agent suggestions when hovering over code.
 *
 * @module @ax/vscode-extension/providers/hover
 */

import * as vscode from 'vscode';

// =============================================================================
// Hover Provider
// =============================================================================

export class AgentHoverProvider implements vscode.HoverProvider {
  private enabled = true;

  constructor() {
    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('automatosx.enableHover')) {
        this.enabled = vscode.workspace
          .getConfiguration('automatosx')
          .get<boolean>('enableHover', true);
      }
    });

    this.enabled = vscode.workspace
      .getConfiguration('automatosx')
      .get<boolean>('enableHover', true);
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.enabled) {
      return null;
    }

    // Check if we're hovering over something interesting
    const context = this.getContext(document, position);

    if (!context) {
      return null;
    }

    // Build hover content with agent actions
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    markdown.appendMarkdown('**AutomatosX Actions**\n\n');

    // Add relevant actions based on context
    if (context.type === 'function' || context.type === 'method') {
      markdown.appendMarkdown(
        `[$(robot) Explain](command:automatosx.explainCode) | ` +
          `[$(beaker) Generate Tests](command:automatosx.generateTests) | ` +
          `[$(shield) Security](command:automatosx.securityReview)\n`
      );
    } else if (context.type === 'class') {
      markdown.appendMarkdown(
        `[$(robot) Explain](command:automatosx.explainCode) | ` +
          `[$(tools) Refactor](command:automatosx.refactorCode)\n`
      );
    } else if (context.type === 'complex') {
      markdown.appendMarkdown(
        `[$(robot) Explain](command:automatosx.explainCode) | ` +
          `[$(zap) Optimize](command:automatosx.optimizeCode)\n`
      );
    }

    return new vscode.Hover(markdown);
  }

  /**
   * Determine context at hover position
   */
  private getContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { type: 'function' | 'method' | 'class' | 'complex'; name: string } | null {
    const line = document.lineAt(position.line).text;
    const languageId = document.languageId;

    // Check for function/method definition
    if (this.isFunctionDefinition(line, languageId)) {
      const name = this.extractFunctionName(line, languageId);
      if (name) {
        return { type: 'function', name };
      }
    }

    // Check for class definition
    if (this.isClassDefinition(line, languageId)) {
      const name = this.extractClassName(line, languageId);
      if (name) {
        return { type: 'class', name };
      }
    }

    // Check for complex code patterns
    if (this.isComplexCode(line, document, position)) {
      return { type: 'complex', name: 'code' };
    }

    return null;
  }

  private isFunctionDefinition(line: string, languageId: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /(?:async\s+)?function\s+\w+/,
        /(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
        /^\s*(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
      ],
      javascript: [
        /(?:async\s+)?function\s+\w+/,
        /(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
      ],
      python: [/(?:async\s+)?def\s+\w+/],
      go: [/func\s+(?:\([^)]+\)\s+)?\w+/],
      rust: [/(?:pub\s+)?(?:async\s+)?fn\s+\w+/],
      java: [/(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\(/],
    };

    const langPatterns =
      patterns[languageId] || patterns['typescript'] || [];

    return langPatterns.some((pattern) => pattern.test(line));
  }

  private isClassDefinition(line: string, languageId: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /(?:export\s+)?class\s+\w+/,
      javascript: /class\s+\w+/,
      python: /class\s+\w+/,
      go: /type\s+\w+\s+struct/,
      rust: /(?:pub\s+)?struct\s+\w+/,
      java: /(?:public|private)?\s*class\s+\w+/,
    };

    const pattern = patterns[languageId] || patterns['typescript'];
    return pattern ? pattern.test(line) : false;
  }

  private extractFunctionName(line: string, languageId: string): string | null {
    const patterns: Record<string, RegExp> = {
      typescript: /(?:function|const|let)\s+(\w+)/,
      javascript: /(?:function|const|let)\s+(\w+)/,
      python: /def\s+(\w+)/,
      go: /func\s+(?:\([^)]+\)\s+)?(\w+)/,
      rust: /fn\s+(\w+)/,
      java: /\s+(\w+)\s*\(/,
    };

    const pattern = patterns[languageId] || patterns['typescript'];
    if (pattern) {
      const match = line.match(pattern);
      return match?.[1] || null;
    }
    return null;
  }

  private extractClassName(line: string, languageId: string): string | null {
    const patterns: Record<string, RegExp> = {
      typescript: /class\s+(\w+)/,
      javascript: /class\s+(\w+)/,
      python: /class\s+(\w+)/,
      go: /type\s+(\w+)\s+struct/,
      rust: /struct\s+(\w+)/,
      java: /class\s+(\w+)/,
    };

    const pattern = patterns[languageId] || patterns['typescript'];
    if (pattern) {
      const match = line.match(pattern);
      return match?.[1] || null;
    }
    return null;
  }

  private isComplexCode(
    line: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ): boolean {
    // Check for complex patterns like nested callbacks, long chains, etc.
    const complexPatterns = [
      /\.then\s*\(/,
      /\.catch\s*\(/,
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.reduce\s*\(/,
      /async\s+/,
      /await\s+/,
      /try\s*\{/,
      /\?\./g, // Optional chaining
    ];

    // Count complexity indicators in surrounding lines
    const startLine = Math.max(0, position.line - 2);
    const endLine = Math.min(document.lineCount - 1, position.line + 2);

    let complexityCount = 0;
    for (let i = startLine; i <= endLine; i++) {
      const text = document.lineAt(i).text;
      for (const pattern of complexPatterns) {
        if (pattern.test(text)) {
          complexityCount++;
        }
      }
    }

    return complexityCount >= 2;
  }
}
