/**
 * PhpParserService.ts
 *
 * PHP language parser using Tree-sitter
 * Extracts symbols from PHP source code
 */
import PHP from 'tree-sitter-php';
import { BaseLanguageParser } from './LanguageParser.js';
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
export class PhpParserService extends BaseLanguageParser {
    constructor() {
        // Use the full PHP grammar (supports PHP embedded in HTML)
        super(PHP.php);
        this.language = 'php';
        this.extensions = ['.php', '.php3', '.php4', '.php5', '.phtml'];
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
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
    }
    /**
     * Extract function definition
     * Example: function calculateTotal($items) { ... }
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract method declaration (inside a class)
     * Example: public function getTotal(): float { ... }
     */
    extractMethod(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'method');
    }
    /**
     * Extract class declaration
     * Example: class Calculator extends BaseCalculator { ... }
     */
    extractClass(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract interface declaration
     * Example: interface CalculatorInterface { ... }
     */
    extractInterface(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract trait declaration
     * Example: trait Timestampable { ... }
     */
    extractTrait(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Use 'class' kind for traits (they're similar to classes)
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract constant declaration
     * Example: const STATUS_ACTIVE = 1;
     * Example: define('APP_VERSION', '2.0.0');
     */
    extractConstant(node) {
        // const_declaration contains const_element children
        const constElements = node.descendantsOfType('const_element');
        if (constElements.length > 0) {
            // Get the first constant name - it's the first child of type 'name'
            const nameNodes = constElements[0].descendantsOfType('name');
            if (nameNodes.length === 0)
                return null;
            const name = nameNodes[0].text;
            return this.createSymbol(node, name, 'constant');
        }
        return null;
    }
    /**
     * Extract property declaration (class properties)
     * Example: private $total = 0;
     * Example: protected string $name;
     */
    extractProperty(node) {
        // property_declaration contains property_element children
        const propertyElements = node.descendantsOfType('property_element') ||
            node.descendantsOfType('variable_name');
        if (propertyElements.length > 0) {
            const nameNode = propertyElements[0];
            if (!nameNode)
                return null;
            let name = nameNode.text;
            // Remove $ prefix from variable names
            if (name.startsWith('$')) {
                name = name.substring(1);
            }
            return this.createSymbol(node, name, 'variable');
        }
        return null;
    }
    /**
     * Override walkTree to handle PHP-specific patterns
     */
    walkTree(node, symbols) {
        // Extract symbol based on node type
        const symbol = this.extractSymbol(node);
        if (symbol) {
            symbols.push(symbol);
        }
        // Walk into children
        for (const child of node.children) {
            this.walkTree(child, symbols);
        }
    }
}
