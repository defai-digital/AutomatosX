/**
 * RParserService.ts
 *
 * R language parser using Tree-sitter
 * Extracts symbols from R source code
 */
import R from 'tree-sitter-r';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * RParserService - Extracts symbols from R code
 */
export class RParserService extends BaseLanguageParser {
    language = 'r';
    extensions = ['.r', '.R', '.Rmd'];
    constructor() {
        super(R);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'binary_operator':
                return this.extractAssignment(node);
            case 'function_definition':
                return this.extractFunction(node);
            default:
                return null;
        }
    }
    /**
     * Extract assignment (variable/function assignment)
     */
    extractAssignment(node) {
        const operator = node.childForFieldName('operator');
        if (!operator)
            return null;
        // Check if it's an assignment operator
        const opText = operator.text;
        if (![' <-', '=', '<<-'].includes(opText))
            return null;
        const lhs = node.childForFieldName('lhs');
        if (!lhs)
            return null;
        // Get the variable name
        const name = lhs.text;
        // Check if RHS is a function definition
        const rhs = node.childForFieldName('rhs');
        if (rhs && rhs.type === 'function_definition') {
            return this.createSymbol(node, name, 'function');
        }
        return this.createSymbol(node, name, 'variable');
    }
    /**
     * Extract function definition
     */
    extractFunction(node) {
        // R functions are typically assigned, handled in extractAssignment
        // This handles standalone function definitions if any
        const parent = node.parent;
        if (!parent)
            return null;
        if (parent.type === 'binary_operator') {
            const lhs = parent.childForFieldName('lhs');
            if (lhs) {
                return this.createSymbol(node, lhs.text, 'function');
            }
        }
        return null;
    }
}
//# sourceMappingURL=RParserService.js.map