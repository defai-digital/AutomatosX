/**
 * References Provider
 *
 * Implements textDocument/references LSP request.
 * Finds all references to a symbol across the workspace.
 */
import { filePathToUri, uriToFilePath, getWordAtPosition, getIdentifierAtPosition, } from '../utils/lsp-utils.js';
/**
 * References Provider
 */
export class ReferencesProvider {
    documentManager;
    integrationService;
    constructor(documentManager, integrationService) {
        this.documentManager = documentManager;
        this.integrationService = integrationService;
    }
    /**
     * Handle textDocument/references request
     *
     * @param uri - Document URI
     * @param position - Cursor position
     * @param context - Reference context (include declaration?)
     * @returns Array of reference locations or null
     */
    async provideReferences(uri, position, context) {
        try {
            const filePath = uriToFilePath(uri);
            const content = this.documentManager.getDocumentText(uri);
            if (!content) {
                return null;
            }
            // Get symbol name at position
            const symbolName = this.getSymbolAtPosition(uri, position, content);
            if (!symbolName) {
                return null;
            }
            // Find all references to the symbol
            const references = await this.findAllReferences(symbolName, filePath, context.includeDeclaration);
            if (references.length === 0) {
                return null;
            }
            return references;
        }
        catch (error) {
            console.error('Error in provideReferences:', error);
            return null;
        }
    }
    /**
     * Get symbol name at position
     */
    getSymbolAtPosition(uri, position, content) {
        // Try using Tree-sitter AST
        const tree = this.documentManager.getDocumentTree(uri);
        if (tree) {
            const identifierNode = getIdentifierAtPosition(tree.rootNode, position);
            if (identifierNode) {
                return identifierNode.text;
            }
        }
        // Fallback to text-based word extraction
        const word = getWordAtPosition(content, position);
        return word || null;
    }
    /**
     * Find all references to symbol
     */
    async findAllReferences(symbolName, currentFile, includeDeclaration) {
        const references = [];
        // Search in database for all symbols with this name
        const symbols = await this.integrationService.findSymbolReferences(symbolName, includeDeclaration);
        // Convert symbols to locations
        for (const symbol of symbols) {
            references.push(this.symbolToLocation(symbol));
        }
        // Search in open documents (may have unsaved changes)
        const openDocRefs = this.findReferencesInOpenDocuments(symbolName, includeDeclaration);
        references.push(...openDocRefs);
        // Deduplicate by URI and position
        return this.deduplicateLocations(references);
    }
    /**
     * Find references in open documents
     */
    findReferencesInOpenDocuments(symbolName, includeDeclaration) {
        const references = [];
        for (const uri of this.documentManager.getAllDocumentUris()) {
            const symbols = this.documentManager.getDocumentSymbols(uri);
            for (const symbol of symbols) {
                if (symbol.name === symbolName) {
                    // Check if we should include declarations
                    if (!includeDeclaration && this.isDeclaration(symbol)) {
                        continue;
                    }
                    references.push(this.symbolToLocation(symbol));
                }
            }
            // Also search in document text for non-declaration references
            const textRefs = this.findTextReferences(uri, symbolName);
            references.push(...textRefs);
        }
        return references;
    }
    /**
     * Find references in document text (simple text search)
     */
    findTextReferences(uri, symbolName) {
        const content = this.documentManager.getDocumentText(uri);
        if (!content) {
            return [];
        }
        const references = [];
        const lines = content.split('\n');
        // Simple regex-based search
        const pattern = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, 'g');
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            let match;
            while ((match = pattern.exec(line)) !== null) {
                references.push({
                    uri,
                    range: {
                        start: { line: lineIndex, character: match.index },
                        end: { line: lineIndex, character: match.index + symbolName.length },
                    },
                });
            }
        }
        return references;
    }
    /**
     * Check if symbol is a declaration
     */
    isDeclaration(symbol) {
        // Heuristic: functions, classes, variables with kind indicating declaration
        const declarationKinds = [
            'function',
            'class',
            'interface',
            'type',
            'variable',
            'constant',
            'method',
            'constructor',
        ];
        return declarationKinds.includes(symbol.kind.toLowerCase());
    }
    /**
     * Convert SymbolInfo to Location
     */
    symbolToLocation(symbol) {
        return {
            uri: filePathToUri(symbol.filePath),
            range: {
                start: {
                    line: symbol.startLine,
                    character: symbol.startColumn,
                },
                end: {
                    line: symbol.endLine,
                    character: symbol.endColumn,
                },
            },
        };
    }
    /**
     * Deduplicate locations by URI and position
     */
    deduplicateLocations(locations) {
        const seen = new Set();
        const unique = [];
        for (const loc of locations) {
            const key = `${loc.uri}:${loc.range.start.line}:${loc.range.start.character}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(loc);
            }
        }
        return unique;
    }
    /**
     * Escape regex special characters
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Count references to a symbol
     */
    async countReferences(uri, position) {
        const references = await this.provideReferences(uri, position, {
            includeDeclaration: false,
        });
        return references?.length ?? 0;
    }
    /**
     * Group references by file
     */
    async groupReferencesByFile(uri, position, context) {
        const references = await this.provideReferences(uri, position, context);
        if (!references) {
            return new Map();
        }
        const grouped = new Map();
        for (const ref of references) {
            const fileRefs = grouped.get(ref.uri) ?? [];
            fileRefs.push(ref);
            grouped.set(ref.uri, fileRefs);
        }
        return grouped;
    }
}
//# sourceMappingURL=ReferencesProvider.js.map