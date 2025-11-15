/**
 * LSP Types and Data Structures
 *
 * Type definitions for Language Server Protocol entities.
 * Maps LSP protocol types to TypeScript interfaces.
 */
import type { Position as LSPPosition, Range as LSPRange, Location as LSPLocation, SymbolKind as LSPSymbolKind, CompletionItemKind as LSPCompletionItemKind } from 'vscode-languageserver/node.js';
export type { LSPPosition, LSPRange, LSPLocation };
/**
 * Position in a text document (zero-based)
 */
export interface Position {
    line: number;
    character: number;
}
/**
 * Range in a text document
 */
export interface Range {
    start: Position;
    end: Position;
}
/**
 * Location in a text document
 */
export interface Location {
    uri: string;
    range: Range;
}
/**
 * Symbol kind enumeration
 */
export declare enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26
}
/**
 * Completion item kind enumeration
 */
export declare enum CompletionItemKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}
/**
 * Completion item
 */
export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: number;
}
/**
 * Hover information
 */
export interface Hover {
    contents: string | string[];
    range?: Range;
}
/**
 * Symbol information from database
 */
export interface SymbolInfo {
    id?: number;
    name: string;
    kind: string;
    filePath: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    signature?: string;
    docstring?: string;
    scope?: string;
}
/**
 * Reference information
 */
export interface ReferenceInfo {
    uri: string;
    range: Range;
    isDeclaration?: boolean;
}
/**
 * Document symbol (for outline)
 */
export interface DocumentSymbol {
    name: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    detail?: string;
    children?: DocumentSymbol[];
}
/**
 * Diagnostic severity
 */
export declare enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}
/**
 * Diagnostic information
 */
export interface Diagnostic {
    range: Range;
    severity?: DiagnosticSeverity;
    code?: string | number;
    source?: string;
    message: string;
}
/**
 * Text document identifier
 */
export interface TextDocumentIdentifier {
    uri: string;
}
/**
 * Text document position params
 */
export interface TextDocumentPositionParams {
    textDocument: TextDocumentIdentifier;
    position: Position;
}
/**
 * Reference context
 */
export interface ReferenceContext {
    includeDeclaration: boolean;
}
/**
 * Reference params
 */
export interface ReferenceParams extends TextDocumentPositionParams {
    context: ReferenceContext;
}
/**
 * Map symbol kind string to LSP SymbolKind enum
 */
export declare function mapSymbolKind(kind: string): LSPSymbolKind;
/**
 * Map symbol kind string to CompletionItemKind
 */
export declare function mapCompletionItemKind(kind: string): LSPCompletionItemKind;
/**
 * Check if a range contains a position
 */
export declare function rangeContainsPosition(range: Range, position: Position): boolean;
/**
 * Check if two ranges overlap
 */
export declare function rangesOverlap(a: Range, b: Range): boolean;
/**
 * Compare two positions
 */
export declare function comparePositions(a: Position, b: Position): number;
//# sourceMappingURL=lsp-types.d.ts.map