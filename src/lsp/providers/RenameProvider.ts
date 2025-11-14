/**
 * Rename Provider
 *
 * Provides rename refactoring functionality.
 * Finds all references to a symbol and creates a WorkspaceEdit.
 * Supports cross-file renames with validation.
 */

import type { WorkspaceEdit as LSPWorkspaceEdit, TextEdit as LSPTextEdit } from 'vscode-languageserver/node.js';
import type { DocumentManager } from '../server/DocumentManager.js';
import type { IntegrationService } from '../server/IntegrationService.js';
import type { Position, Range } from '../types/lsp-types.js';
import { getWordAtPosition, uriToFilePath, filePathToUri } from '../utils/lsp-utils.js';

/**
 * Rename validation result
 */
interface RenameValidation {
  valid: boolean;
  error?: string;
}

/**
 * Rename Provider
 * Handles symbol renaming across workspace
 */
export class RenameProvider {
  constructor(
    private documentManager: DocumentManager,
    private integrationService: IntegrationService
  ) {}

  /**
   * Provide rename edits for a symbol
   */
  async provideRename(
    uri: string,
    position: Position,
    newName: string
  ): Promise<LSPWorkspaceEdit | null> {
    try {
      const filePath = uriToFilePath(uri);
      const content = this.documentManager.getDocumentText(uri);

      if (!content) {
        return null;
      }

      // Get symbol at position
      const symbolName = getWordAtPosition(content, position);
      if (!symbolName) {
        return null;
      }

      // Validate new name
      const validation = this.validateNewName(newName, symbolName);
      if (!validation.valid) {
        console.error(`Rename validation failed: ${validation.error}`);
        return null;
      }

      // Find all references to the symbol
      const references = await this.integrationService.findSymbolReferences(
        symbolName,
        true // Include declaration
      );

      if (references.length === 0) {
        return null;
      }

      // Group references by file
      const changesByFile = new Map<string, LSPTextEdit[]>();

      for (const ref of references) {
        const refUri = filePathToUri(ref.filePath);
        const range: Range = {
          start: {
            line: ref.startLine,
            character: ref.startColumn,
          },
          end: {
            line: ref.endLine,
            character: ref.endColumn,
          },
        };

        const textEdit: LSPTextEdit = {
          range,
          newText: newName,
        };

        const edits = changesByFile.get(refUri) || [];
        edits.push(textEdit);
        changesByFile.set(refUri, edits);
      }

      // Create WorkspaceEdit
      const changes: Record<string, LSPTextEdit[]> = {};
      for (const [fileUri, edits] of changesByFile.entries()) {
        changes[fileUri] = edits;
      }

      return { changes };
    } catch (error) {
      console.error(`Error providing rename for ${uri}:`, error);
      return null;
    }
  }

  /**
   * Prepare rename (validate that rename is possible at position)
   */
  async prepareRename(
    uri: string,
    position: Position
  ): Promise<{ range: Range; placeholder: string } | null> {
    try {
      const content = this.documentManager.getDocumentText(uri);

      if (!content) {
        return null;
      }

      // Get symbol at position
      const symbolName = getWordAtPosition(content, position);
      if (!symbolName) {
        return null;
      }

      // Find symbol in database
      const filePath = uriToFilePath(uri);
      const symbol = await this.integrationService.findSymbolAtPosition(
        filePath,
        position.line,
        position.character
      );

      if (!symbol) {
        return null;
      }

      // Return range and placeholder
      const range: Range = {
        start: {
          line: symbol.startLine,
          character: symbol.startColumn,
        },
        end: {
          line: symbol.endLine,
          character: symbol.endColumn,
        },
      };

      return {
        range,
        placeholder: symbolName,
      };
    } catch (error) {
      console.error(`Error preparing rename for ${uri}:`, error);
      return null;
    }
  }

  /**
   * Validate new name for symbol
   */
  private validateNewName(newName: string, oldName: string): RenameValidation {
    // Check if new name is empty
    if (!newName || newName.trim() === '') {
      return {
        valid: false,
        error: 'New name cannot be empty',
      };
    }

    // Check if new name is same as old name
    if (newName === oldName) {
      return {
        valid: false,
        error: 'New name is the same as the current name',
      };
    }

    // Check if new name is a valid identifier
    if (!this.isValidIdentifier(newName)) {
      return {
        valid: false,
        error: 'New name is not a valid identifier',
      };
    }

    // Check if new name is a reserved keyword
    if (this.isReservedKeyword(newName)) {
      return {
        valid: false,
        error: 'New name is a reserved keyword',
      };
    }

    return { valid: true };
  }

  /**
   * Check if string is a valid identifier
   */
  private isValidIdentifier(name: string): boolean {
    // Must start with letter, underscore, or dollar sign
    // Can contain letters, digits, underscores, or dollar signs
    const identifierPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    return identifierPattern.test(name);
  }

  /**
   * Check if string is a reserved keyword
   */
  private isReservedKeyword(name: string): boolean {
    const keywords = new Set([
      // JavaScript/TypeScript keywords
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'debugger',
      'default',
      'delete',
      'do',
      'else',
      'enum',
      'export',
      'extends',
      'false',
      'finally',
      'for',
      'function',
      'if',
      'import',
      'in',
      'instanceof',
      'new',
      'null',
      'return',
      'super',
      'switch',
      'this',
      'throw',
      'true',
      'try',
      'typeof',
      'var',
      'void',
      'while',
      'with',
      'yield',
      // TypeScript-specific
      'interface',
      'type',
      'namespace',
      'declare',
      'abstract',
      'as',
      'async',
      'await',
      'implements',
      'let',
      'package',
      'private',
      'protected',
      'public',
      'static',
      // Python keywords
      'and',
      'as',
      'assert',
      'async',
      'await',
      'break',
      'class',
      'continue',
      'def',
      'del',
      'elif',
      'else',
      'except',
      'False',
      'finally',
      'for',
      'from',
      'global',
      'if',
      'import',
      'in',
      'is',
      'lambda',
      'None',
      'nonlocal',
      'not',
      'or',
      'pass',
      'raise',
      'return',
      'True',
      'try',
      'while',
      'with',
      'yield',
    ]);

    return keywords.has(name);
  }
}
