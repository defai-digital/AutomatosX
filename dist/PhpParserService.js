"use strict";
/**
 * PhpParserService.ts
 *
 * PHP language parser using Tree-sitter
 * Extracts symbols from PHP source code
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhpParserService = void 0;
var tree_sitter_php_1 = require("tree-sitter-php");
var LanguageParser_js_1 = require("./LanguageParser.js");
/**
 * PhpParserService - Extracts symbols from PHP code
 *
 * Supports PHP constructs:
 * - Functions
 * - Classes (with methods and properties)
 * - Interfaces
 * - Traits
 * - Constants
 * - Namespaces
 */
var PhpParserService = /** @class */ (function (_super) {
    __extends(PhpParserService, _super);
    function PhpParserService() {
        // Use the full PHP grammar (supports PHP embedded in HTML)
        var _this = _super.call(this, tree_sitter_php_1.default.php) || this;
        _this.language = 'php';
        _this.extensions = ['.php', '.php3', '.php4', '.php5', '.phtml'];
        return _this;
    }
    /**
     * Extract symbol from AST node
     */
    PhpParserService.prototype.extractSymbol = function (node) {
        switch (node.type) {
            case 'function_definition':
                return this.extractFunction(node);
            case 'method_declaration':
                return this.extractMethod(node);
            case 'class_declaration':
                return this.extractClass(node);
            case 'interface_declaration':
                return this.extractInterface(node);
            case 'trait_declaration':
                return this.extractTrait(node);
            case 'const_declaration':
                return this.extractConstant(node);
            case 'property_declaration':
                return this.extractProperty(node);
            default:
                return null;
        }
    };
    /**
     * Extract function definition
     * Example: function calculateTotal($items) { ... }
     */
    PhpParserService.prototype.extractFunction = function (node) {
        var name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    };
    /**
     * Extract method declaration (inside a class)
     * Example: public function getTotal(): float { ... }
     */
    PhpParserService.prototype.extractMethod = function (node) {
        var name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'method');
    };
    /**
     * Extract class declaration
     * Example: class Calculator extends BaseCalculator { ... }
     */
    PhpParserService.prototype.extractClass = function (node) {
        var name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    };
    /**
     * Extract interface declaration
     * Example: interface CalculatorInterface { ... }
     */
    PhpParserService.prototype.extractInterface = function (node) {
        var name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    };
    /**
     * Extract trait declaration
     * Example: trait Timestampable { ... }
     */
    PhpParserService.prototype.extractTrait = function (node) {
        var name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Use 'class' kind for traits (they're similar to classes)
        return this.createSymbol(node, name, 'class');
    };
    /**
     * Extract constant declaration
     * Example: const STATUS_ACTIVE = 1;
     * Example: define('APP_VERSION', '2.0.0');
     */
    PhpParserService.prototype.extractConstant = function (node) {
        // const_declaration contains const_element children
        var constElements = node.descendantsOfType('const_element');
        if (constElements.length > 0) {
            // Get the first constant name - it's the first child of type 'name'
            var nameNodes = constElements[0].descendantsOfType('name');
            if (nameNodes.length === 0)
                return null;
            var name_1 = nameNodes[0].text;
            return this.createSymbol(node, name_1, 'constant');
        }
        return null;
    };
    /**
     * Extract property declaration (class properties)
     * Example: private $total = 0;
     * Example: protected string $name;
     */
    PhpParserService.prototype.extractProperty = function (node) {
        // property_declaration contains property_element children
        var propertyElements = node.descendantsOfType('property_element') ||
            node.descendantsOfType('variable_name');
        if (propertyElements.length > 0) {
            var nameNode = propertyElements[0];
            if (!nameNode)
                return null;
            var name_2 = nameNode.text;
            // Remove $ prefix from variable names
            if (name_2.startsWith('$')) {
                name_2 = name_2.substring(1);
            }
            return this.createSymbol(node, name_2, 'variable');
        }
        return null;
    };
    /**
     * Override walkTree to handle PHP-specific patterns
     */
    PhpParserService.prototype.walkTree = function (node, symbols) {
        // Extract symbol based on node type
        var symbol = this.extractSymbol(node);
        if (symbol) {
            symbols.push(symbol);
        }
        // Walk into children
        for (var _i = 0, _a = node.children; _i < _a.length; _i++) {
            var child = _a[_i];
            this.walkTree(child, symbols);
        }
    };
    return PhpParserService;
}(LanguageParser_js_1.BaseLanguageParser));
exports.PhpParserService = PhpParserService;
