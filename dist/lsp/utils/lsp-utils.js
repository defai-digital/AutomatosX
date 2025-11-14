/**
 * LSP Utilities
 *
 * Helper functions for LSP operations:
 * - URI/file path conversion
 * - Position calculations
 * - Range extraction from AST nodes
 */
import { URI } from 'vscode-uri';
/**
 * Convert file path to URI
 */
export function filePathToUri(filePath) {
    return URI.file(filePath).toString();
}
/**
 * Convert URI to file path
 */
export function uriToFilePath(uri) {
    return URI.parse(uri).fsPath;
}
/**
 * Normalize file path (resolve relative paths, normalize separators)
 */
export function normalizeFilePath(filePath) {
    return filePath.replace(/\\/g, '/');
}
/**
 * Convert byte offset to position (line, character)
 *
 * @param content - Document content
 * @param offset - Byte offset in document
 * @returns Position with line and character
 */
export function offsetToPosition(content, offset) {
    // Count newlines up to (but not including) the offset position
    let line = 0;
    let character = 0;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') {
            line++;
            character = 0;
        }
        else {
            character++;
        }
    }
    // If we're positioned AT a newline, treat it as the start of the next line
    if (offset < content.length && content[offset] === '\n') {
        line++;
        character = 0;
    }
    return { line, character };
}
/**
 * Convert position (line, character) to byte offset
 *
 * @param content - Document content
 * @param position - Position with line and character
 * @returns Byte offset in document
 */
export function positionToOffset(content, position) {
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for newline
    }
    offset += Math.min(position.character, lines[position.line]?.length ?? 0);
    return offset;
}
/**
 * Extract position from Tree-sitter node
 */
export function nodeToPosition(node, isEnd = false) {
    if (isEnd) {
        return {
            line: node.endPosition.row,
            character: node.endPosition.column,
        };
    }
    return {
        line: node.startPosition.row,
        character: node.startPosition.column,
    };
}
/**
 * Extract range from Tree-sitter node
 */
export function nodeToRange(node) {
    return {
        start: nodeToPosition(node, false),
        end: nodeToPosition(node, true),
    };
}
/**
 * Get word at position in document
 *
 * @param content - Document content
 * @param position - Position to get word at
 * @returns Word at position or empty string
 */
export function getWordAtPosition(content, position) {
    const offset = positionToOffset(content, position);
    const before = content.substring(0, offset);
    const after = content.substring(offset);
    // Match word characters (letters, digits, underscore)
    const beforeMatch = before.match(/[\w$]*$/);
    const afterMatch = after.match(/^[\w$]*/);
    const wordBefore = beforeMatch ? beforeMatch[0] : '';
    const wordAfter = afterMatch ? afterMatch[0] : '';
    return wordBefore + wordAfter;
}
/**
 * Get line content at position
 */
export function getLineAtPosition(content, position) {
    const lines = content.split('\n');
    return lines[position.line] ?? '';
}
/**
 * Get range for word at position
 */
export function getWordRangeAtPosition(content, position) {
    const offset = positionToOffset(content, position);
    const before = content.substring(0, offset);
    const after = content.substring(offset);
    const beforeMatch = before.match(/[\w$]*$/);
    const afterMatch = after.match(/^[\w$]*/);
    if (!beforeMatch || !afterMatch) {
        return null;
    }
    const wordBefore = beforeMatch[0];
    const wordAfter = afterMatch[0];
    if (wordBefore.length === 0 && wordAfter.length === 0) {
        return null;
    }
    const startOffset = offset - wordBefore.length;
    const endOffset = offset + wordAfter.length;
    return {
        start: offsetToPosition(content, startOffset),
        end: offsetToPosition(content, endOffset),
    };
}
/**
 * Find node at position in Tree-sitter tree
 */
export function findNodeAtPosition(rootNode, position) {
    let currentNode = rootNode.descendantForPosition({ row: position.line, column: position.character }, { row: position.line, column: position.character });
    return currentNode;
}
/**
 * Get identifier node at position
 * Traverses up the tree to find the identifier or named node
 */
export function getIdentifierAtPosition(rootNode, position) {
    let node = findNodeAtPosition(rootNode, position);
    if (!node) {
        return null;
    }
    // Traverse up to find identifier
    while (node && !isIdentifierNode(node)) {
        if (node.parent) {
            node = node.parent;
        }
        else {
            break;
        }
    }
    return isIdentifierNode(node) ? node : null;
}
/**
 * Check if node is an identifier
 */
export function isIdentifierNode(node) {
    const identifierTypes = [
        'identifier',
        'property_identifier',
        'type_identifier',
        'field_identifier',
        'shorthand_property_identifier',
        'shorthand_property_identifier_pattern',
    ];
    return identifierTypes.includes(node.type);
}
/**
 * Get function/method signature from node
 */
export function getNodeSignature(node) {
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
        return node.text;
    }
    // For identifiers, get parent signature
    const parent = node.parent;
    if (parent && (parent.type === 'function_declaration' || parent.type === 'method_definition')) {
        return parent.text;
    }
    return null;
}
/**
 * Extract docstring/comment above node
 */
export function getNodeDocstring(node, content) {
    // Look for comment before the node
    const startLine = node.startPosition.row;
    if (startLine === 0) {
        return null;
    }
    const lines = content.split('\n');
    const docLines = [];
    // Check for JSDoc comment
    for (let i = startLine - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('*/')) {
            // End of JSDoc block, collect backwards
            const jsdocLines = [line];
            for (let j = i - 1; j >= 0; j--) {
                jsdocLines.unshift(lines[j].trim());
                if (lines[j].trim().startsWith('/**')) {
                    return jsdocLines.join('\n');
                }
            }
            break;
        }
        else if (line.startsWith('//')) {
            // Single-line comment
            docLines.unshift(line);
        }
        else if (line === '') {
            // Empty line, continue
            continue;
        }
        else {
            // Non-comment line, stop
            break;
        }
    }
    return docLines.length > 0 ? docLines.join('\n') : null;
}
/**
 * Format symbol signature for hover
 */
export function formatSignature(symbolInfo) {
    if (symbolInfo.signature) {
        return symbolInfo.signature;
    }
    return `${symbolInfo.kind} ${symbolInfo.name}`;
}
/**
 * Create markdown hover content
 */
export function createHoverMarkdown(parts) {
    const sections = [];
    if (parts.signature) {
        sections.push('```typescript\n' + parts.signature + '\n```');
    }
    if (parts.docstring) {
        sections.push(parts.docstring);
    }
    if (parts.location) {
        sections.push('---');
        sections.push('*' + parts.location + '*');
    }
    return sections.join('\n\n');
}
/**
 * Check if file is supported language
 */
export function isSupportedLanguage(filePath) {
    const supportedExtensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.py',
        '.go',
        '.rs',
        '.rb',
        '.swift',
        '.java',
        '.cs',
        '.php',
        '.kt',
        '.ml',
        '.mli',
    ];
    return supportedExtensions.some((ext) => filePath.endsWith(ext));
}
/**
 * Get language ID from file path
 */
export function getLanguageId(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const languageMap = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.swift': 'swift',
        '.java': 'java',
        '.cs': 'csharp',
        '.php': 'php',
        '.kt': 'kotlin',
        '.ml': 'ocaml',
        '.mli': 'ocaml',
    };
    return languageMap[ext] ?? 'plaintext';
}
/**
 * Check if a range contains a position
 */
export function rangeContainsPosition(range, position) {
    const afterStart = comparePositions(position, range.start) >= 0;
    const beforeEnd = comparePositions(position, range.end) <= 0;
    return afterStart && beforeEnd;
}
/**
 * Check if two ranges overlap
 */
export function rangesOverlap(range1, range2) {
    return (rangeContainsPosition(range1, range2.start) ||
        rangeContainsPosition(range1, range2.end) ||
        rangeContainsPosition(range2, range1.start) ||
        rangeContainsPosition(range2, range1.end));
}
/**
 * Compare two positions
 * Returns: -1 if pos1 < pos2, 0 if equal, 1 if pos1 > pos2
 */
export function comparePositions(pos1, pos2) {
    if (pos1.line < pos2.line)
        return -1;
    if (pos1.line > pos2.line)
        return 1;
    if (pos1.character < pos2.character)
        return -1;
    if (pos1.character > pos2.character)
        return 1;
    return 0;
}
/**
 * Map Tree-sitter symbol kind to LSP SymbolKind
 */
export function mapSymbolKind(kind) {
    const kindMap = {
        'function': 12, // Function
        'method': 6, // Method
        'class': 5, // Class
        'interface': 11, // Interface
        'variable': 13, // Variable
        'constant': 14, // Constant
        'property': 7, // Property
        'enum': 10, // Enum
        'type': 5, // Class (for type aliases)
    };
    return kindMap[kind] ?? 13; // Default to Variable
}
/**
 * Map symbol kind to LSP CompletionItemKind
 */
export function mapCompletionItemKind(kind) {
    const kindMap = {
        'function': 3, // Function
        'method': 2, // Method
        'class': 7, // Class
        'interface': 8, // Interface
        'variable': 6, // Variable
        'constant': 21, // Constant
        'property': 10, // Property
        'enum': 13, // Enum
        'type': 25, // TypeParameter
    };
    return kindMap[kind] ?? 6; // Default to Variable
}
//# sourceMappingURL=lsp-utils.js.map