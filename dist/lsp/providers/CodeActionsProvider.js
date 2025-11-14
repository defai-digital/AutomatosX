/**
 * Code Actions Provider
 *
 * Provides code actions (quick fixes) for diagnostics.
 * Suggests refactorings and fixes for quality issues.
 * Supports "organize imports" and "extract function" actions.
 */
import { uriToFilePath } from '../utils/lsp-utils.js';
/**
 * Code action kind
 */
export var CodeActionKind;
(function (CodeActionKind) {
    CodeActionKind["QuickFix"] = "quickfix";
    CodeActionKind["Refactor"] = "refactor";
    CodeActionKind["RefactorExtract"] = "refactor.extract";
    CodeActionKind["RefactorInline"] = "refactor.inline";
    CodeActionKind["RefactorRewrite"] = "refactor.rewrite";
    CodeActionKind["Source"] = "source";
    CodeActionKind["SourceOrganizeImports"] = "source.organizeImports";
    CodeActionKind["SourceFixAll"] = "source.fixAll";
})(CodeActionKind || (CodeActionKind = {}));
/**
 * Code Actions Provider
 * Provides quick fixes and refactoring actions
 */
export class CodeActionsProvider {
    documentManager;
    integrationService;
    constructor(documentManager, integrationService) {
        this.documentManager = documentManager;
        this.integrationService = integrationService;
    }
    /**
     * Provide code actions for a range
     */
    async provideCodeActions(uri, range, diagnostics) {
        try {
            const actions = [];
            // Add quick fixes for diagnostics
            for (const diagnostic of diagnostics) {
                const quickFixes = this.getQuickFixesForDiagnostic(uri, diagnostic);
                actions.push(...quickFixes);
            }
            // Add refactoring actions
            const refactorActions = await this.getRefactoringActions(uri, range);
            actions.push(...refactorActions);
            // Add source actions
            const sourceActions = await this.getSourceActions(uri);
            actions.push(...sourceActions);
            return actions;
        }
        catch (error) {
            console.error(`Error providing code actions for ${uri}:`, error);
            return [];
        }
    }
    /**
     * Get quick fixes for a diagnostic
     */
    getQuickFixesForDiagnostic(uri, diagnostic) {
        const actions = [];
        const code = diagnostic.code?.toString();
        // Quick fix for high complexity
        if (code === 'high-complexity') {
            actions.push({
                title: 'Extract complex logic to separate function',
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: true,
                command: {
                    title: 'Extract Function',
                    command: 'automatosx.extractFunction',
                    arguments: [uri, diagnostic.range],
                },
            });
            actions.push({
                title: 'Simplify conditional logic',
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                command: {
                    title: 'Simplify Logic',
                    command: 'automatosx.simplifyLogic',
                    arguments: [uri, diagnostic.range],
                },
            });
        }
        // Quick fix for low maintainability
        if (code === 'low-maintainability') {
            actions.push({
                title: 'Refactor to improve maintainability',
                kind: CodeActionKind.Refactor,
                diagnostics: [diagnostic],
                command: {
                    title: 'Refactor',
                    command: 'automatosx.refactorCode',
                    arguments: [uri, diagnostic.range],
                },
            });
        }
        // Quick fix for code smells
        if (code === 'code-smell' || code === 'long-function') {
            actions.push({
                title: 'Extract function to reduce length',
                kind: CodeActionKind.RefactorExtract,
                diagnostics: [diagnostic],
                command: {
                    title: 'Extract Function',
                    command: 'automatosx.extractFunction',
                    arguments: [uri, diagnostic.range],
                },
            });
        }
        // Quick fix for unused imports (if we can detect them)
        if (code === 'unused-import') {
            actions.push({
                title: 'Remove unused import',
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [uri]: [
                            {
                                range: diagnostic.range,
                                newText: '',
                            },
                        ],
                    },
                },
            });
        }
        return actions;
    }
    /**
     * Get refactoring actions for a range
     */
    async getRefactoringActions(uri, range) {
        const actions = [];
        // Extract function action
        actions.push({
            title: 'Extract to function',
            kind: CodeActionKind.RefactorExtract,
            command: {
                title: 'Extract Function',
                command: 'automatosx.extractFunction',
                arguments: [uri, range],
            },
        });
        // Extract variable action
        actions.push({
            title: 'Extract to constant',
            kind: CodeActionKind.RefactorExtract,
            command: {
                title: 'Extract Constant',
                command: 'automatosx.extractConstant',
                arguments: [uri, range],
            },
        });
        // Simplify expression action
        actions.push({
            title: 'Simplify expression',
            kind: CodeActionKind.RefactorRewrite,
            command: {
                title: 'Simplify',
                command: 'automatosx.simplifyExpression',
                arguments: [uri, range],
            },
        });
        return actions;
    }
    /**
     * Get source actions
     */
    async getSourceActions(uri) {
        const actions = [];
        // Organize imports action
        actions.push({
            title: 'Organize imports',
            kind: CodeActionKind.SourceOrganizeImports,
            command: {
                title: 'Organize Imports',
                command: 'automatosx.organizeImports',
                arguments: [uri],
            },
        });
        // Fix all action
        actions.push({
            title: 'Fix all auto-fixable issues',
            kind: CodeActionKind.SourceFixAll,
            command: {
                title: 'Fix All',
                command: 'automatosx.fixAll',
                arguments: [uri],
            },
        });
        // Add type annotations action (TypeScript)
        const filePath = uriToFilePath(uri);
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            actions.push({
                title: 'Add missing type annotations',
                kind: CodeActionKind.Source,
                command: {
                    title: 'Add Types',
                    command: 'automatosx.addTypeAnnotations',
                    arguments: [uri],
                },
            });
        }
        return actions;
    }
    /**
     * Create text edit to remove lines
     */
    createRemoveLinesEdit(startLine, endLine) {
        return {
            range: {
                start: { line: startLine, character: 0 },
                end: { line: endLine + 1, character: 0 },
            },
            newText: '',
        };
    }
    /**
     * Create text edit to replace text
     */
    createReplaceEdit(range, newText) {
        return {
            range,
            newText,
        };
    }
    /**
     * Organize imports in document
     */
    async organizeImports(uri) {
        try {
            const content = this.documentManager.getDocumentText(uri);
            if (!content) {
                return [];
            }
            const tree = this.documentManager.getDocumentTree(uri);
            if (!tree) {
                return [];
            }
            // Extract all import statements
            const imports = tree.rootNode.descendantsOfType('import_statement');
            if (imports.length === 0) {
                return [];
            }
            // Sort imports (simplified version)
            const sortedImports = [...imports].sort((a, b) => {
                return a.text.localeCompare(b.text);
            });
            // Create edits to replace imports
            const edits = [];
            for (let i = 0; i < imports.length; i++) {
                const originalImport = imports[i];
                const sortedImport = sortedImports[i];
                if (originalImport.text !== sortedImport.text) {
                    edits.push({
                        range: {
                            start: {
                                line: originalImport.startPosition.row,
                                character: originalImport.startPosition.column,
                            },
                            end: {
                                line: originalImport.endPosition.row,
                                character: originalImport.endPosition.column,
                            },
                        },
                        newText: sortedImport.text,
                    });
                }
            }
            return edits;
        }
        catch (error) {
            console.error(`Error organizing imports for ${uri}:`, error);
            return [];
        }
    }
    /**
     * Extract function from selected code
     */
    async extractFunction(uri, range) {
        try {
            const content = this.documentManager.getDocumentText(uri);
            if (!content) {
                return [];
            }
            // Extract selected text
            const lines = content.split('\n');
            const selectedLines = lines.slice(range.start.line, range.end.line + 1);
            const selectedText = selectedLines.join('\n');
            // Generate function name
            const functionName = 'extractedFunction';
            // Create new function
            const newFunction = `\nfunction ${functionName}() {\n  ${selectedText}\n}\n`;
            // Create edits
            const edits = [
                // Replace selected text with function call
                {
                    range,
                    newText: `${functionName}();`,
                },
                // Insert new function before current location
                {
                    range: {
                        start: { line: range.start.line, character: 0 },
                        end: { line: range.start.line, character: 0 },
                    },
                    newText: newFunction,
                },
            ];
            return edits;
        }
        catch (error) {
            console.error(`Error extracting function for ${uri}:`, error);
            return [];
        }
    }
}
//# sourceMappingURL=CodeActionsProvider.js.map