/**
 * RescriptParserService.ts
 *
 * ReScript language parser using Tree-sitter OCaml grammar
 * Extracts symbols from ReScript source code
 *
 * Note: ReScript is based on OCaml syntax, so we use the OCaml tree-sitter grammar
 * which is compatible with ReScript's syntax.
 */
// @ts-ignore - tree-sitter-ocaml doesn't have TypeScript types
import OCaml from 'tree-sitter-ocaml/bindings/node/index.js';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * RescriptParserService - Extracts symbols from ReScript code
 */
export class RescriptParserService extends BaseLanguageParser {
    language = 'rescript';
    extensions = ['.res', '.resi'];
    constructor() {
        // tree-sitter-ocaml exports { ocaml, ocaml_interface }
        // Use the main OCaml parser
        const grammar = OCaml.ocaml || OCaml;
        super(grammar);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'module_definition':
            case 'module_binding':
                return this.extractModule(node);
            case 'type_definition':
                return this.extractType(node);
            case 'value_definition':
            case 'let_binding':
                return this.extractValueDefinition(node);
            case 'external_declaration':
            case 'external':
                return this.extractExternal(node);
            default:
                return null;
        }
    }
    /**
     * Extract module definition
     * Example: module Math = { let add = (a, b) => a + b }
     * Example: module type Comparable = { type t; let compare: (t, t) => int }
     */
    extractModule(node) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) {
            // Try to find module name in children
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'module_name' || child?.type === 'module_path') {
                    return this.createSymbol(node, child.text, 'module');
                }
            }
            return null;
        }
        const name = nameNode.text;
        return this.createSymbol(node, name, 'module');
    }
    /**
     * Extract type definition
     * Example: type point = {x: float, y: float}
     * Example: type shape = Circle(float) | Rectangle(float, float)
     * Example: type t<'a> = option<'a>
     */
    extractType(node) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) {
            // Try to find type name in children
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'type_constructor_path' ||
                    child?.type === 'type_constructor' ||
                    child?.type === 'lower_case_identifier') {
                    return this.createSymbol(node, child.text, 'type');
                }
            }
            return null;
        }
        const name = nameNode.text;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract value definition (functions, constants)
     * Example: let add = (a, b) => a + b
     * Example: let pi = 3.14159
     * Example: let rec factorial = n => n <= 1 ? 1 : n * factorial(n - 1)
     */
    extractValueDefinition(node) {
        // Get the let binding pattern
        const pattern = node.childForFieldName('pattern');
        if (!pattern) {
            // Try to find value name in children
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'value_name' || child?.type === 'value_pattern') {
                    const name = this.extractValueName(child);
                    if (name) {
                        const kind = this.isFunction(node) ? 'function' : 'constant';
                        return this.createSymbol(node, name, kind);
                    }
                }
            }
            return null;
        }
        const name = this.extractValueName(pattern);
        if (!name)
            return null;
        // Determine if this is a function or constant
        const kind = this.isFunction(node) ? 'function' : 'constant';
        return this.createSymbol(node, name, kind);
    }
    /**
     * Extract value name from pattern node
     */
    extractValueName(pattern) {
        if (pattern.type === 'value_name' ||
            pattern.type === 'lower_case_identifier' ||
            pattern.type === 'identifier') {
            return pattern.text;
        }
        // For function patterns like (functionName)
        if (pattern.type === 'parenthesized_pattern' ||
            pattern.type === 'value_pattern') {
            for (let i = 0; i < pattern.childCount; i++) {
                const child = pattern.child(i);
                if (child) {
                    const result = this.extractValueName(child);
                    if (result)
                        return result;
                }
            }
        }
        // Search children
        for (let i = 0; i < pattern.childCount; i++) {
            const child = pattern.child(i);
            if (child?.type === 'value_name' ||
                child?.type === 'lower_case_identifier') {
                return child.text;
            }
        }
        return null;
    }
    /**
     * Check if a value definition is a function
     * Functions typically have function expressions, fun expressions, or arrow syntax
     */
    isFunction(node) {
        const body = node.childForFieldName('body');
        if (!body)
            return false;
        // Check if body is a function expression
        if (body.type === 'function_expression' ||
            body.type === 'fun_expression' ||
            body.type === 'function') {
            return true;
        }
        // Check for arrow function syntax (might be wrapped in other expressions)
        return this.containsFunction(body);
    }
    /**
     * Recursively check if node contains function-like constructs
     */
    containsFunction(node) {
        if (node.type === 'function_expression' ||
            node.type === 'fun_expression' ||
            node.type === 'function') {
            return true;
        }
        // Check parameters - functions have parameter lists
        if (node.type === 'parameter' || node.type === 'parameter_list') {
            return true;
        }
        // For shallow check, only look at immediate structure
        // to avoid false positives from nested functions
        return false;
    }
    /**
     * Extract external declaration
     * Example: external setTimeout: (unit => unit, int) => int = "setTimeout"
     * Example: @module("path") external join: (string, string) => string = "join"
     */
    extractExternal(node) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) {
            // Try to find external name in children
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'value_name' ||
                    child?.type === 'lower_case_identifier') {
                    return this.createSymbol(node, child.text, 'function');
                }
            }
            return null;
        }
        const name = nameNode.text;
        return this.createSymbol(node, name, 'function');
    }
}
//# sourceMappingURL=RescriptParserService.js.map