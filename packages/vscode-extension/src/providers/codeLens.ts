/**
 * Code Lens Provider
 *
 * Adds clickable "Ask Agent" and "Generate Tests" links above functions.
 *
 * @module @ax/vscode-extension/providers/codeLens
 */

import * as vscode from 'vscode';

// =============================================================================
// Types
// =============================================================================

interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'method';
  range: vscode.Range;
}

// =============================================================================
// Code Lens Provider
// =============================================================================

export class AgentCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private enabled = true;

  constructor() {
    // Watch for configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('automatosx.enableCodeLens')) {
        this.enabled = vscode.workspace
          .getConfiguration('automatosx')
          .get<boolean>('enableCodeLens', true);
        this._onDidChangeCodeLenses.fire();
      }
    });

    this.enabled = vscode.workspace
      .getConfiguration('automatosx')
      .get<boolean>('enableCodeLens', true);
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (!this.enabled) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];
    const symbols = this.findSymbols(document);

    for (const symbol of symbols) {
      // "Ask Agent" lens
      lenses.push(
        new vscode.CodeLens(symbol.range, {
          title: '$(robot) Ask Agent',
          command: 'automatosx.askAboutSymbol',
          arguments: [document.uri, symbol],
          tooltip: 'Ask an AI agent about this code',
        })
      );

      // "Generate Tests" lens for functions
      if (symbol.kind === 'function' || symbol.kind === 'method') {
        lenses.push(
          new vscode.CodeLens(symbol.range, {
            title: '$(beaker) Tests',
            command: 'automatosx.generateTestsForSymbol',
            arguments: [document.uri, symbol],
            tooltip: 'Generate tests for this function',
          })
        );
      }

      // "Security Review" lens
      lenses.push(
        new vscode.CodeLens(symbol.range, {
          title: '$(shield) Security',
          command: 'automatosx.securityReviewSymbol',
          arguments: [document.uri, symbol],
          tooltip: 'Security review this code',
        })
      );
    }

    return lenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.CodeLens {
    return codeLens;
  }

  /**
   * Find functions, classes, and methods in document
   */
  private findSymbols(document: vscode.TextDocument): CodeSymbol[] {
    const text = document.getText();
    const symbols: CodeSymbol[] = [];
    const languageId = document.languageId;

    // Language-specific patterns
    const patterns = this.getPatternsForLanguage(languageId);

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);

        symbols.push({
          name: match[1] || match[2] || 'unknown',
          kind: pattern.kind,
          range: new vscode.Range(startPos, startPos), // Just the start line
        });
      }
    }

    return symbols;
  }

  private getPatternsForLanguage(
    languageId: string
  ): { regex: RegExp; kind: 'function' | 'class' | 'method' }[] {
    const patterns: { regex: RegExp; kind: 'function' | 'class' | 'method' }[] = [];

    switch (languageId) {
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        // Function declarations
        patterns.push({
          regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
          kind: 'function',
        });
        // Arrow functions assigned to const/let
        patterns.push({
          regex: /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g,
          kind: 'function',
        });
        // Class declarations
        patterns.push({
          regex: /(?:export\s+)?class\s+(\w+)/g,
          kind: 'class',
        });
        // Method definitions in classes
        patterns.push({
          regex: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm,
          kind: 'method',
        });
        break;

      case 'python':
        // Function definitions
        patterns.push({
          regex: /(?:async\s+)?def\s+(\w+)/g,
          kind: 'function',
        });
        // Class definitions
        patterns.push({
          regex: /class\s+(\w+)/g,
          kind: 'class',
        });
        break;

      case 'go':
        // Function declarations
        patterns.push({
          regex: /func\s+(\w+)/g,
          kind: 'function',
        });
        // Method declarations
        patterns.push({
          regex: /func\s+\([^)]+\)\s+(\w+)/g,
          kind: 'method',
        });
        // Type/struct declarations
        patterns.push({
          regex: /type\s+(\w+)\s+struct/g,
          kind: 'class',
        });
        break;

      case 'rust':
        // Function declarations
        patterns.push({
          regex: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
          kind: 'function',
        });
        // Struct declarations
        patterns.push({
          regex: /(?:pub\s+)?struct\s+(\w+)/g,
          kind: 'class',
        });
        // Impl blocks
        patterns.push({
          regex: /impl(?:<[^>]+>)?\s+(\w+)/g,
          kind: 'class',
        });
        break;

      case 'java':
      case 'kotlin':
        // Class declarations
        patterns.push({
          regex: /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)/g,
          kind: 'class',
        });
        // Method declarations
        patterns.push({
          regex:
            /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g,
          kind: 'method',
        });
        break;

      case 'csharp':
        // Class declarations
        patterns.push({
          regex:
            /(?:public|private|protected|internal)?\s*(?:abstract|sealed|static)?\s*class\s+(\w+)/g,
          kind: 'class',
        });
        // Method declarations
        patterns.push({
          regex:
            /(?:public|private|protected|internal)?\s*(?:static|async|virtual|override)?\s*(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/g,
          kind: 'method',
        });
        break;

      case 'ruby':
        // Method definitions
        patterns.push({
          regex: /def\s+(\w+)/g,
          kind: 'function',
        });
        // Class definitions
        patterns.push({
          regex: /class\s+(\w+)/g,
          kind: 'class',
        });
        break;

      case 'php':
        // Function declarations
        patterns.push({
          regex: /function\s+(\w+)/g,
          kind: 'function',
        });
        // Class declarations
        patterns.push({
          regex: /class\s+(\w+)/g,
          kind: 'class',
        });
        break;

      default:
        // Generic patterns for other languages
        patterns.push({
          regex: /function\s+(\w+)/g,
          kind: 'function',
        });
        patterns.push({
          regex: /class\s+(\w+)/g,
          kind: 'class',
        });
    }

    return patterns;
  }
}

// =============================================================================
// Code Lens Commands
// =============================================================================

export async function askAboutSymbol(
  uri: vscode.Uri,
  symbol: CodeSymbol,
  _client: { executeTask: (task: string, agent?: string) => Promise<unknown> }
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);

  // Find the full extent of the symbol (up to 50 lines)
  const startLine = symbol.range.start.line;
  const endLine = Math.min(startLine + 50, document.lineCount - 1);
  const code = document.getText(new vscode.Range(startLine, 0, endLine, 0));

  const languageId = document.languageId;
  const _task = `Explain this ${symbol.kind} "${symbol.name}" in ${languageId}:

\`\`\`${languageId}
${code}
\`\`\`

Provide:
1. What this ${symbol.kind} does
2. Parameters/properties and their purposes
3. Return value (if applicable)
4. Usage examples
5. Any important notes or edge cases`;

  await vscode.commands.executeCommand('automatosx.runWithAgent', 'standard');
}

export async function generateTestsForSymbol(
  uri: vscode.Uri,
  symbol: CodeSymbol,
  _client: { executeTask: (task: string, agent?: string) => Promise<unknown> }
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);

  const startLine = symbol.range.start.line;
  const endLine = Math.min(startLine + 50, document.lineCount - 1);
  const code = document.getText(new vscode.Range(startLine, 0, endLine, 0));

  const languageId = document.languageId;
  const fileName = uri.fsPath.split('/').pop();

  const _task = `Generate comprehensive unit tests for this ${symbol.kind} "${symbol.name}" from ${fileName}:

\`\`\`${languageId}
${code}
\`\`\`

Requirements:
1. Cover all main functionality
2. Include edge cases and error conditions
3. Use appropriate testing framework for ${languageId}
4. Include setup/teardown if needed
5. Use descriptive test names`;

  await vscode.commands.executeCommand('automatosx.runWithAgent', 'quality');
}

export async function securityReviewSymbol(
  uri: vscode.Uri,
  symbol: CodeSymbol,
  _client: { executeTask: (task: string, agent?: string) => Promise<unknown> }
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);

  const startLine = symbol.range.start.line;
  const endLine = Math.min(startLine + 50, document.lineCount - 1);
  const code = document.getText(new vscode.Range(startLine, 0, endLine, 0));

  const languageId = document.languageId;

  const _task = `Security review this ${symbol.kind} "${symbol.name}":

\`\`\`${languageId}
${code}
\`\`\`

Check for:
1. Input validation issues
2. Injection vulnerabilities
3. Authentication/authorization issues
4. Sensitive data exposure
5. Error handling security
6. Language-specific vulnerabilities

Provide severity ratings and remediation suggestions.`;

  await vscode.commands.executeCommand('automatosx.runWithAgent', 'security');
}
