/**
 * LanguageParser.ts
 *
 * Unified interface for language-specific parsers
 * Allows multiple language parsers to be used interchangeably
 */
import Parser from 'tree-sitter';
/**
 * SymbolKind as a runtime value for use in parser implementations
 */
export const SymbolKindValue = {
    FUNCTION: 'function',
    CLASS: 'class',
    INTERFACE: 'interface',
    TYPE: 'type',
    VARIABLE: 'variable',
    CONSTANT: 'constant',
    METHOD: 'method',
    ENUM: 'enum',
    STRUCT: 'struct',
    TRAIT: 'trait',
    MODULE: 'module',
};
/**
 * Base class for language parsers
 * Provides common functionality for tree-walking and symbol extraction
 */
export class BaseLanguageParser {
    parser;
    constructor(grammar) {
        this.parser = new Parser();
        this.parser.setLanguage(grammar);
    }
    /**
     * Parse source code and extract symbols
     */
    parse(content) {
        const startTime = performance.now();
        const tree = this.parser.parse(content);
        const symbols = [];
        // Walk the AST and extract symbols
        this.walkTree(tree.rootNode, symbols);
        const endTime = performance.now();
        return {
            symbols,
            parseTime: endTime - startTime,
            nodeCount: tree.rootNode.descendantCount,
        };
    }
    /**
     * Get the tree-sitter parser instance
     */
    getParser() {
        return this.parser;
    }
    /**
     * Walk AST tree and extract symbols
     * Subclasses can override for language-specific behavior
     */
    walkTree(node, symbols) {
        // Extract symbol based on node type
        const symbol = this.extractSymbol(node);
        if (symbol) {
            symbols.push(symbol);
        }
        // Recursively walk children
        for (const child of node.children) {
            this.walkTree(child, symbols);
        }
    }
    /**
     * Helper: Get text of a named field from a node
     */
    getFieldText(node, fieldName) {
        const child = node.childForFieldName(fieldName);
        return child ? child.text : null;
    }
    /**
     * Helper: Create a symbol from a node
     */
    createSymbol(node, name, kind, metadata) {
        const symbol = {
            name,
            kind,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
        };
        if (metadata) {
            symbol.metadata = metadata;
        }
        return symbol;
    }
}
//# sourceMappingURL=LanguageParser.js.map