/**
 * LSP Types and Data Structures
 *
 * Type definitions for Language Server Protocol entities.
 * Maps LSP protocol types to TypeScript interfaces.
 */

import type {
  Position as LSPPosition,
  Range as LSPRange,
  Location as LSPLocation,
  SymbolKind as LSPSymbolKind,
  CompletionItemKind as LSPCompletionItemKind,
} from 'vscode-languageserver/node.js';

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
export enum SymbolKind {
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
  TypeParameter = 26,
}

/**
 * Completion item kind enumeration
 */
export enum CompletionItemKind {
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
  TypeParameter = 25,
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
export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
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
export function mapSymbolKind(kind: string): LSPSymbolKind {
  const kindMap: Record<string, LSPSymbolKind> = {
    file: 1,
    module: 2,
    namespace: 3,
    package: 4,
    class: 5,
    method: 6,
    property: 7,
    field: 8,
    constructor: 9,
    enum: 10,
    interface: 11,
    function: 12,
    variable: 13,
    constant: 14,
    string: 15,
    number: 16,
    boolean: 17,
    array: 18,
    object: 19,
    key: 20,
    null: 21,
    enummember: 22,
    struct: 23,
    event: 24,
    operator: 25,
    typeparameter: 26,
  };

  const normalized = kind.toLowerCase().replace(/[_-]/g, '');
  return kindMap[normalized] ?? 12; // Default to Function
}

/**
 * Map symbol kind string to CompletionItemKind
 */
export function mapCompletionItemKind(kind: string): LSPCompletionItemKind {
  const kindMap: Record<string, LSPCompletionItemKind> = {
    text: 1,
    method: 2,
    function: 3,
    constructor: 4,
    field: 5,
    variable: 6,
    class: 7,
    interface: 8,
    module: 9,
    property: 10,
    unit: 11,
    value: 12,
    enum: 13,
    keyword: 14,
    snippet: 15,
    color: 16,
    file: 17,
    reference: 18,
    folder: 19,
    enummember: 20,
    constant: 21,
    struct: 22,
    event: 23,
    operator: 24,
    typeparameter: 25,
  };

  const normalized = kind.toLowerCase().replace(/[_-]/g, '');
  return kindMap[normalized] ?? 6; // Default to Variable
}

/**
 * Check if a range contains a position
 */
export function rangeContainsPosition(range: Range, position: Position): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }

  if (position.line === range.end.line && position.character > range.end.character) {
    return false;
  }

  return true;
}

/**
 * Check if two ranges overlap
 */
export function rangesOverlap(a: Range, b: Range): boolean {
  return (
    rangeContainsPosition(a, b.start) ||
    rangeContainsPosition(a, b.end) ||
    rangeContainsPosition(b, a.start) ||
    rangeContainsPosition(b, a.end)
  );
}

/**
 * Compare two positions
 */
export function comparePositions(a: Position, b: Position): number {
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  return a.character - b.character;
}
