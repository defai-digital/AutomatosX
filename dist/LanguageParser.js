"use strict";
/**
 * LanguageParser.ts
 *
 * Unified interface for language-specific parsers
 * Allows multiple language parsers to be used interchangeably
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseLanguageParser = void 0;
var tree_sitter_1 = require("tree-sitter");
/**
 * Base class for language parsers
 * Provides common functionality for tree-walking and symbol extraction
 */
var BaseLanguageParser = /** @class */ (function () {
    function BaseLanguageParser(grammar) {
        this.parser = new tree_sitter_1.default();
        this.parser.setLanguage(grammar);
    }
    /**
     * Parse source code and extract symbols
     */
    BaseLanguageParser.prototype.parse = function (content) {
        var startTime = performance.now();
        var tree = this.parser.parse(content);
        var symbols = [];
        // Walk the AST and extract symbols
        this.walkTree(tree.rootNode, symbols);
        var endTime = performance.now();
        return {
            symbols: symbols,
            parseTime: endTime - startTime,
            nodeCount: tree.rootNode.descendantCount,
        };
    };
    /**
     * Get the tree-sitter parser instance
     */
    BaseLanguageParser.prototype.getParser = function () {
        return this.parser;
    };
    /**
     * Walk AST tree and extract symbols
     * Subclasses can override for language-specific behavior
     */
    BaseLanguageParser.prototype.walkTree = function (node, symbols) {
        // Extract symbol based on node type
        var symbol = this.extractSymbol(node);
        if (symbol) {
            symbols.push(symbol);
        }
        // Recursively walk children
        for (var _i = 0, _a = node.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.walkTree(child, symbols);
        }
    };
    /**
     * Helper: Get text of a named field from a node
     */
    BaseLanguageParser.prototype.getFieldText = function (node, fieldName) {
        var child = node.childForFieldName(fieldName);
        return child ? child.text : null;
    };
    /**
     * Helper: Create a symbol from a node
     */
    BaseLanguageParser.prototype.createSymbol = function (node, name, kind, metadata) {
        var symbol = {
            name: name,
            kind: kind,
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
        };
        if (metadata) {
            symbol.metadata = metadata;
        }
        return symbol;
    };
    return BaseLanguageParser;
}());
exports.BaseLanguageParser = BaseLanguageParser;
