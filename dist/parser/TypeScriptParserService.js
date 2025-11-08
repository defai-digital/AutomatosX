/**
 * TypeScriptParserService.ts
 *
 * TypeScript/JavaScript language parser using Tree-sitter
 * Extracts symbols from TypeScript and JavaScript source code
 */
import TypeScript from 'tree-sitter-typescript';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * TypeScriptParserService - Extracts symbols from TypeScript/JavaScript code
 */
export class TypeScriptParserService extends BaseLanguageParser {
    language = 'typescript';
    extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    constructor() {
        // Use TSX grammar to support JSX/React syntax
        // The tsx grammar is a superset that handles both .ts and .tsx files
        super(TypeScript.tsx);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'function_declaration':
                return this.extractFunction(node);
            case 'class_declaration':
                return this.extractClass(node);
            case 'interface_declaration':
                return this.extractInterface(node);
            case 'type_alias_declaration':
                return this.extractTypeAlias(node);
            case 'lexical_declaration': // const, let
                return this.extractVariable(node);
            case 'variable_declaration': // var
                return this.extractVariable(node);
            case 'method_definition':
                return this.extractMethod(node);
            case 'enum_declaration':
                return this.extractEnum(node);
            default:
                return null;
        }
    }
    /**
     * Extract function declaration
     * Enhanced to detect React components (functions returning JSX)
     */
    extractFunction(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Check if this is a React component (returns JSX)
        if (this.returnsJSX(node)) {
            return this.createSymbol(node, name, 'function', { isReactComponent: true });
        }
        // Check if this is a custom hook (starts with "use")
        if (name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase()) {
            return this.createSymbol(node, name, 'function', { isHook: true });
        }
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract class declaration
     * Enhanced to detect React class components
     */
    extractClass(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        // Check if this extends React.Component or Component
        if (this.extendsReactComponent(node)) {
            return this.createSymbol(node, name, 'class', { isReactComponent: true });
        }
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract interface declaration
     */
    extractInterface(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'interface');
    }
    /**
     * Extract type alias declaration
     */
    extractTypeAlias(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'type');
    }
    /**
     * Extract enum declaration
     */
    extractEnum(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'enum');
    }
    /**
     * Extract variable/constant declaration
     * Enhanced to detect React arrow function components
     */
    extractVariable(node) {
        // Get the declarator (the actual variable name + value)
        const declarator = node.descendantsOfType('variable_declarator')[0];
        if (!declarator)
            return null;
        const nameNode = declarator.childForFieldName('name');
        if (!nameNode)
            return null;
        const name = nameNode.text;
        // Determine if const or let/var by checking the actual keyword
        let isConst = false;
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && child.text === 'const') {
                isConst = true;
                break;
            }
        }
        // Check if this is a React component (arrow function returning JSX)
        const value = declarator.childForFieldName('value');
        if (value && this.isArrowFunctionReturningJSX(value)) {
            return {
                name,
                kind: 'function',
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
                endLine: node.endPosition.row + 1,
                endColumn: node.endPosition.column,
                metadata: { isReactComponent: true, isArrowFunction: true },
            };
        }
        // Check if this is a custom hook
        if (name.startsWith('use') && name.length > 3 && name[3] === name[3].toUpperCase()) {
            return {
                name,
                kind: 'function',
                line: node.startPosition.row + 1,
                column: node.startPosition.column,
                endLine: node.endPosition.row + 1,
                endColumn: node.endPosition.column,
                metadata: { isHook: true },
            };
        }
        return {
            name,
            kind: isConst ? 'constant' : 'variable',
            line: node.startPosition.row + 1,
            column: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
        };
    }
    /**
     * Extract method definition (class method)
     */
    extractMethod(node) {
        const name = this.getFieldText(node, 'name');
        if (!name)
            return null;
        return this.createSymbol(node, name, 'method');
    }
    /**
     * Check if a function returns JSX
     */
    returnsJSX(node) {
        // Look for return statements with JSX
        const returnStatements = node.descendantsOfType('return_statement');
        for (const returnStmt of returnStatements) {
            if (this.containsJSX(returnStmt)) {
                return true;
            }
        }
        // Check for arrow function with implicit JSX return
        const body = node.childForFieldName('body');
        if (body && this.containsJSX(body)) {
            return true;
        }
        return false;
    }
    /**
     * Check if a class extends React.Component or Component
     */
    extendsReactComponent(node) {
        // Check for extends clause - try multiple possible field names
        let heritage = node.childForFieldName('heritage');
        if (!heritage) {
            heritage = node.childForFieldName('extends_clause');
        }
        if (!heritage) {
            // Fallback: search children for class_heritage or extends keyword
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child && (child.type === 'class_heritage' || child.type === 'extends_clause')) {
                    heritage = child;
                    break;
                }
            }
        }
        if (!heritage)
            return false;
        const text = heritage.text;
        return text.includes('React.Component') ||
            text.includes('React.PureComponent') ||
            text.includes('Component') ||
            text.includes('PureComponent');
    }
    /**
     * Check if an arrow function returns JSX
     */
    isArrowFunctionReturningJSX(node) {
        if (node.type !== 'arrow_function')
            return false;
        const body = node.childForFieldName('body');
        if (!body)
            return false;
        // Check for implicit return (JSX without braces)
        if (this.containsJSX(body)) {
            return true;
        }
        // Check for explicit return in statement block
        const returnStatements = body.descendantsOfType('return_statement');
        for (const returnStmt of returnStatements) {
            if (this.containsJSX(returnStmt)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if a node contains JSX elements
     */
    containsJSX(node) {
        // Check for JSX element types
        const jsxTypes = [
            'jsx_element',
            'jsx_self_closing_element',
            'jsx_fragment',
        ];
        // Check current node
        if (jsxTypes.includes(node.type)) {
            return true;
        }
        // Check descendants
        for (const jsxType of jsxTypes) {
            const jsxNodes = node.descendantsOfType(jsxType);
            if (jsxNodes.length > 0) {
                return true;
            }
        }
        return false;
    }
}
//# sourceMappingURL=TypeScriptParserService.js.map