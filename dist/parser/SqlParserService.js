/**
 * SqlParserService.ts
 *
 * SQL language parser using Tree-sitter
 * Extracts symbols from SQL source code
 */
import SQL from '@derekstride/tree-sitter-sql';
import { BaseLanguageParser } from './LanguageParser.js';
/**
 * SqlParserService - Extracts symbols from SQL code
 *
 * Supports:
 * - Tables (CREATE TABLE)
 * - Views (CREATE VIEW)
 * - Indexes (CREATE INDEX)
 * - Functions (CREATE FUNCTION)
 * - Procedures (CREATE PROCEDURE)
 * - Triggers (CREATE TRIGGER)
 * - Columns (from table definitions)
 */
export class SqlParserService extends BaseLanguageParser {
    language = 'sql';
    extensions = ['.sql', '.ddl', '.dml'];
    constructor() {
        super(SQL);
    }
    /**
     * Extract symbol from AST node
     */
    extractSymbol(node) {
        switch (node.type) {
            case 'create_table':
                return this.extractTable(node);
            case 'create_view':
                return this.extractView(node);
            case 'create_index':
                return this.extractIndex(node);
            case 'create_function':
                return this.extractFunction(node);
            case 'create_procedure':
                return this.extractProcedure(node);
            case 'create_trigger':
                return this.extractTrigger(node);
            case 'column_definition':
                return this.extractColumn(node);
            default:
                return null;
        }
    }
    /**
     * Extract CREATE TABLE statement
     *
     * Example:
     * CREATE TABLE users (
     *   id INT PRIMARY KEY,
     *   name VARCHAR(100)
     * );
     */
    extractTable(node) {
        const name = this.extractNameFromObjectReference(node);
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract CREATE VIEW statement
     *
     * Example:
     * CREATE VIEW active_users AS
     * SELECT * FROM users WHERE active = 1;
     */
    extractView(node) {
        const name = this.extractNameFromObjectReference(node);
        if (!name)
            return null;
        return this.createSymbol(node, name, 'class');
    }
    /**
     * Extract CREATE INDEX statement
     *
     * Example:
     * CREATE INDEX idx_email ON users(email);
     */
    extractIndex(node) {
        // For CREATE INDEX, the name is a direct identifier child
        const identifierNode = node.descendantsOfType('identifier').find((n) => n.parent === node);
        if (!identifierNode)
            return null;
        const name = identifierNode.text;
        return this.createSymbol(node, name, 'variable');
    }
    /**
     * Extract CREATE FUNCTION statement
     *
     * Example:
     * CREATE FUNCTION get_user(user_id INT)
     * RETURNS TABLE(id INT, name VARCHAR)
     * AS $$ ... $$;
     */
    extractFunction(node) {
        const name = this.extractNameFromObjectReference(node);
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract CREATE PROCEDURE statement
     *
     * Example:
     * CREATE PROCEDURE update_user(p_id INT, p_name VARCHAR)
     * AS BEGIN ... END;
     */
    extractProcedure(node) {
        const name = this.extractNameFromObjectReference(node);
        if (!name)
            return null;
        return this.createSymbol(node, name, 'function');
    }
    /**
     * Extract CREATE TRIGGER statement
     *
     * Example:
     * CREATE TRIGGER update_timestamp
     * BEFORE UPDATE ON users
     * FOR EACH ROW EXECUTE FUNCTION update_modified_column();
     */
    extractTrigger(node) {
        // For CREATE TRIGGER, the name is typically a direct identifier
        const identifierNode = node.descendantsOfType('identifier')[0];
        if (!identifierNode)
            return null;
        const name = identifierNode.text;
        return this.createSymbol(node, name, 'method');
    }
    /**
     * Extract column definition from CREATE TABLE
     *
     * Example:
     * id INT PRIMARY KEY
     * name VARCHAR(100) NOT NULL
     */
    extractColumn(node) {
        // Get column name - first identifier in column_definition
        const identifierNode = node.descendantsOfType('identifier')[0];
        if (!identifierNode)
            return null;
        const columnName = identifierNode.text;
        // Check if this column is inside a table definition
        const tableNode = this.findParentOfType(node, 'create_table');
        if (!tableNode)
            return null;
        const tableName = this.extractNameFromObjectReference(tableNode);
        if (!tableName)
            return null;
        // Create fully qualified column name
        const fullName = `${tableName}.${columnName}`;
        return this.createSymbol(node, fullName, 'variable');
    }
    /**
     * Extract name from object_reference node
     *
     * Pattern: object_reference > identifier
     */
    extractNameFromObjectReference(node) {
        const objectRefNode = node.descendantsOfType('object_reference')[0];
        if (!objectRefNode)
            return null;
        const identifierNode = objectRefNode.descendantsOfType('identifier')[0];
        if (!identifierNode)
            return null;
        return identifierNode.text;
    }
    /**
     * Find parent node of specific type
     */
    findParentOfType(node, type) {
        let current = node.parent;
        while (current) {
            if (current.type === type) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
}
//# sourceMappingURL=SqlParserService.js.map