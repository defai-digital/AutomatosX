/**
 * SqlParserService.ts
 *
 * SQL language parser using Tree-sitter
 * Extracts symbols from SQL source code
 */
import Parser from 'tree-sitter';
import { BaseLanguageParser, Symbol } from './LanguageParser.js';
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
export declare class SqlParserService extends BaseLanguageParser {
    readonly language = "sql";
    readonly extensions: string[];
    constructor();
    /**
     * Extract symbol from AST node
     */
    protected extractSymbol(node: Parser.SyntaxNode): Symbol | null;
    /**
     * Extract CREATE TABLE statement
     *
     * Example:
     * CREATE TABLE users (
     *   id INT PRIMARY KEY,
     *   name VARCHAR(100)
     * );
     */
    private extractTable;
    /**
     * Extract CREATE VIEW statement
     *
     * Example:
     * CREATE VIEW active_users AS
     * SELECT * FROM users WHERE active = 1;
     */
    private extractView;
    /**
     * Extract CREATE INDEX statement
     *
     * Example:
     * CREATE INDEX idx_email ON users(email);
     */
    private extractIndex;
    /**
     * Extract CREATE FUNCTION statement
     *
     * Example:
     * CREATE FUNCTION get_user(user_id INT)
     * RETURNS TABLE(id INT, name VARCHAR)
     * AS $$ ... $$;
     */
    private extractFunction;
    /**
     * Extract CREATE PROCEDURE statement
     *
     * Example:
     * CREATE PROCEDURE update_user(p_id INT, p_name VARCHAR)
     * AS BEGIN ... END;
     */
    private extractProcedure;
    /**
     * Extract CREATE TRIGGER statement
     *
     * Example:
     * CREATE TRIGGER update_timestamp
     * BEFORE UPDATE ON users
     * FOR EACH ROW EXECUTE FUNCTION update_modified_column();
     */
    private extractTrigger;
    /**
     * Extract column definition from CREATE TABLE
     *
     * Example:
     * id INT PRIMARY KEY
     * name VARCHAR(100) NOT NULL
     */
    private extractColumn;
    /**
     * Extract name from object_reference node
     *
     * Pattern: object_reference > identifier
     */
    private extractNameFromObjectReference;
    /**
     * Find parent node of specific type
     */
    private findParentOfType;
}
//# sourceMappingURL=SqlParserService.d.ts.map