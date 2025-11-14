/**
 * LSP Types and Data Structures
 *
 * Type definitions for Language Server Protocol entities.
 * Maps LSP protocol types to TypeScript interfaces.
 */
/**
 * Symbol kind enumeration
 */
export var SymbolKind;
(function (SymbolKind) {
    SymbolKind[SymbolKind["File"] = 1] = "File";
    SymbolKind[SymbolKind["Module"] = 2] = "Module";
    SymbolKind[SymbolKind["Namespace"] = 3] = "Namespace";
    SymbolKind[SymbolKind["Package"] = 4] = "Package";
    SymbolKind[SymbolKind["Class"] = 5] = "Class";
    SymbolKind[SymbolKind["Method"] = 6] = "Method";
    SymbolKind[SymbolKind["Property"] = 7] = "Property";
    SymbolKind[SymbolKind["Field"] = 8] = "Field";
    SymbolKind[SymbolKind["Constructor"] = 9] = "Constructor";
    SymbolKind[SymbolKind["Enum"] = 10] = "Enum";
    SymbolKind[SymbolKind["Interface"] = 11] = "Interface";
    SymbolKind[SymbolKind["Function"] = 12] = "Function";
    SymbolKind[SymbolKind["Variable"] = 13] = "Variable";
    SymbolKind[SymbolKind["Constant"] = 14] = "Constant";
    SymbolKind[SymbolKind["String"] = 15] = "String";
    SymbolKind[SymbolKind["Number"] = 16] = "Number";
    SymbolKind[SymbolKind["Boolean"] = 17] = "Boolean";
    SymbolKind[SymbolKind["Array"] = 18] = "Array";
    SymbolKind[SymbolKind["Object"] = 19] = "Object";
    SymbolKind[SymbolKind["Key"] = 20] = "Key";
    SymbolKind[SymbolKind["Null"] = 21] = "Null";
    SymbolKind[SymbolKind["EnumMember"] = 22] = "EnumMember";
    SymbolKind[SymbolKind["Struct"] = 23] = "Struct";
    SymbolKind[SymbolKind["Event"] = 24] = "Event";
    SymbolKind[SymbolKind["Operator"] = 25] = "Operator";
    SymbolKind[SymbolKind["TypeParameter"] = 26] = "TypeParameter";
})(SymbolKind || (SymbolKind = {}));
/**
 * Completion item kind enumeration
 */
export var CompletionItemKind;
(function (CompletionItemKind) {
    CompletionItemKind[CompletionItemKind["Text"] = 1] = "Text";
    CompletionItemKind[CompletionItemKind["Method"] = 2] = "Method";
    CompletionItemKind[CompletionItemKind["Function"] = 3] = "Function";
    CompletionItemKind[CompletionItemKind["Constructor"] = 4] = "Constructor";
    CompletionItemKind[CompletionItemKind["Field"] = 5] = "Field";
    CompletionItemKind[CompletionItemKind["Variable"] = 6] = "Variable";
    CompletionItemKind[CompletionItemKind["Class"] = 7] = "Class";
    CompletionItemKind[CompletionItemKind["Interface"] = 8] = "Interface";
    CompletionItemKind[CompletionItemKind["Module"] = 9] = "Module";
    CompletionItemKind[CompletionItemKind["Property"] = 10] = "Property";
    CompletionItemKind[CompletionItemKind["Unit"] = 11] = "Unit";
    CompletionItemKind[CompletionItemKind["Value"] = 12] = "Value";
    CompletionItemKind[CompletionItemKind["Enum"] = 13] = "Enum";
    CompletionItemKind[CompletionItemKind["Keyword"] = 14] = "Keyword";
    CompletionItemKind[CompletionItemKind["Snippet"] = 15] = "Snippet";
    CompletionItemKind[CompletionItemKind["Color"] = 16] = "Color";
    CompletionItemKind[CompletionItemKind["File"] = 17] = "File";
    CompletionItemKind[CompletionItemKind["Reference"] = 18] = "Reference";
    CompletionItemKind[CompletionItemKind["Folder"] = 19] = "Folder";
    CompletionItemKind[CompletionItemKind["EnumMember"] = 20] = "EnumMember";
    CompletionItemKind[CompletionItemKind["Constant"] = 21] = "Constant";
    CompletionItemKind[CompletionItemKind["Struct"] = 22] = "Struct";
    CompletionItemKind[CompletionItemKind["Event"] = 23] = "Event";
    CompletionItemKind[CompletionItemKind["Operator"] = 24] = "Operator";
    CompletionItemKind[CompletionItemKind["TypeParameter"] = 25] = "TypeParameter";
})(CompletionItemKind || (CompletionItemKind = {}));
/**
 * Diagnostic severity
 */
export var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 1] = "Error";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 2] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 3] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 4] = "Hint";
})(DiagnosticSeverity || (DiagnosticSeverity = {}));
/**
 * Map symbol kind string to LSP SymbolKind enum
 */
export function mapSymbolKind(kind) {
    const kindMap = {
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
export function mapCompletionItemKind(kind) {
    const kindMap = {
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
export function rangeContainsPosition(range, position) {
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
export function rangesOverlap(a, b) {
    return (rangeContainsPosition(a, b.start) ||
        rangeContainsPosition(a, b.end) ||
        rangeContainsPosition(b, a.start) ||
        rangeContainsPosition(b, a.end));
}
/**
 * Compare two positions
 */
export function comparePositions(a, b) {
    if (a.line !== b.line) {
        return a.line - b.line;
    }
    return a.character - b.character;
}
//# sourceMappingURL=lsp-types.js.map