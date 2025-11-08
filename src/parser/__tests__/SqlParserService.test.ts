/**
 * SqlParserService.test.ts
 *
 * Tests for SQL language parser using Tree-sitter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SqlParserService } from '../SqlParserService.js';
import { Symbol, SymbolKind } from '../LanguageParser.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SqlParserService', () => {
  let parser: SqlParserService;

  beforeEach(() => {
    parser = new SqlParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('sql');
    });

    it('should support SQL file extensions', () => {
      expect(parser.extensions).toContain('.sql');
      expect(parser.extensions).toContain('.ddl');
      expect(parser.extensions).toContain('.dml');
    });
  });

  describe('parse', () => {
    it('should parse empty file', () => {
      const result = parser.parse('');

      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.nodeCount).toBeGreaterThanOrEqual(0);
    });

    it('should extract CREATE TABLE statements', () => {
      const code = `
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255)
);

CREATE TABLE posts (
  id INT PRIMARY KEY,
  user_id INT,
  title VARCHAR(200)
);
`;

      const result = parser.parse(code);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      expect(tables.length).toBeGreaterThanOrEqual(2);

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('posts');
    });

    it('should extract columns from CREATE TABLE', () => {
      const code = `
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  price DECIMAL(10, 2),
  stock INT
);
`;

      const result = parser.parse(code);

      const columns = result.symbols.filter(s => s.kind === 'variable' && s.name.includes('.'));
      expect(columns.length).toBeGreaterThanOrEqual(3);

      const columnNames = columns.map(c => c.name);
      expect(columnNames.some(n => n.includes('products.'))).toBe(true);
    });

    it('should extract CREATE VIEW statements', () => {
      const code = `
CREATE VIEW active_users AS
SELECT id, username, email
FROM users
WHERE active = 1;

CREATE VIEW recent_posts AS
SELECT * FROM posts WHERE created_at > NOW() - INTERVAL 7 DAY;
`;

      const result = parser.parse(code);

      const views = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      expect(views.length).toBeGreaterThanOrEqual(2);

      const viewNames = views.map(v => v.name);
      expect(viewNames).toContain('active_users');
      expect(viewNames).toContain('recent_posts');
    });

    it('should extract CREATE INDEX statements', () => {
      const code = `
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE UNIQUE INDEX idx_unique_username ON users(username);
`;

      const result = parser.parse(code);

      const indexes = result.symbols.filter(s => s.kind === 'variable' && !s.name.includes('.'));
      expect(indexes.length).toBeGreaterThanOrEqual(3);

      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_posts_user_id');
      expect(indexNames).toContain('idx_unique_username');
    });

    it('should extract CREATE FUNCTION statements', () => {
      const code = `
CREATE FUNCTION get_user_count()
RETURNS INT
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM users);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION calculate_total(a INT, b INT)
RETURNS INT
AS $$
BEGIN
  RETURN a + b;
END;
$$ LANGUAGE plpgsql;
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(2);

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('get_user_count');
      expect(functionNames).toContain('calculate_total');
    });

    it('should extract CREATE PROCEDURE statements', () => {
      const code = `
CREATE PROCEDURE create_user(
  p_username VARCHAR,
  p_email VARCHAR
)
AS $$
BEGIN
  INSERT INTO users (username, email)
  VALUES (p_username, p_email);
END;
$$ LANGUAGE plpgsql;

CREATE PROCEDURE update_user(p_id INT, p_name VARCHAR)
AS $$
BEGIN
  UPDATE users SET name = p_name WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
`;

      const result = parser.parse(code);

      const procedures = result.symbols.filter(s => s.kind === 'function');
      expect(procedures.length).toBeGreaterThanOrEqual(2);

      const procedureNames = procedures.map(p => p.name);
      expect(procedureNames).toContain('create_user');
      expect(procedureNames).toContain('update_user');
    });

    it('should extract CREATE TRIGGER statements', () => {
      const code = `
CREATE TRIGGER update_timestamp
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER validate_email
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION validate_email_format();
`;

      const result = parser.parse(code);

      const triggers = result.symbols.filter(s => s.kind === 'method');
      expect(triggers.length).toBeGreaterThanOrEqual(2);

      const triggerNames = triggers.map(t => t.name);
      expect(triggerNames).toContain('update_timestamp');
      expect(triggerNames).toContain('validate_email');
    });

    it('should handle multiple statement types', () => {
      const code = `
CREATE TABLE orders (
  id INT PRIMARY KEY,
  total DECIMAL(10, 2)
);

CREATE VIEW order_summary AS SELECT * FROM orders;

CREATE INDEX idx_orders_total ON orders(total);

CREATE FUNCTION get_order_total(order_id INT) RETURNS DECIMAL
AS $$ SELECT total FROM orders WHERE id = order_id; $$ LANGUAGE sql;
`;

      const result = parser.parse(code);

      expect(result.symbols.length).toBeGreaterThan(0);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      const views = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      const indexes = result.symbols.filter(s => s.kind === 'variable' && !s.name.includes('.'));
      const functions = result.symbols.filter(s => s.kind === 'function');

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(indexes.length).toBeGreaterThanOrEqual(1);
      expect(functions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include position information', () => {
      const code = `
CREATE TABLE test_table (
  id INT PRIMARY KEY
);
`;

      const result = parser.parse(code);

      const tables = result.symbols.filter(s => s.kind === 'class');
      expect(tables.length).toBeGreaterThanOrEqual(1);

      const table = tables[0];
      expect(table.line).toBeGreaterThan(0);
      expect(table.column).toBeGreaterThanOrEqual(0);
      expect(table.endLine).toBeDefined();
      expect(table.endColumn).toBeDefined();
      expect(table.endLine).toBeGreaterThanOrEqual(table.line);
    });

    it('should handle table with multiple columns', () => {
      const code = `
CREATE TABLE employees (
  employee_id INT PRIMARY KEY,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  email VARCHAR(100),
  hire_date DATE,
  salary DECIMAL(10, 2)
);
`;

      const result = parser.parse(code);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('employees');

      const columns = result.symbols.filter(s => s.kind === 'variable' && s.name.startsWith('employees.'));
      expect(columns.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle foreign key constraints', () => {
      const code = `
CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT,
  product_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
`;

      const result = parser.parse(code);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0].name).toBe('orders');
    });

    it('should handle complex function with parameters', () => {
      const code = `
CREATE FUNCTION get_employee_by_id(emp_id INT)
RETURNS TABLE(id INT, name VARCHAR, salary DECIMAL)
AS $$
BEGIN
  RETURN QUERY
  SELECT employee_id, first_name, salary
  FROM employees
  WHERE employee_id = emp_id;
END;
$$ LANGUAGE plpgsql;
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThanOrEqual(1);
      expect(functions[0].name).toBe('get_employee_by_id');
    });

    it('should handle materialized views', () => {
      const code = `
CREATE MATERIALIZED VIEW sales_summary AS
SELECT
  product_id,
  SUM(amount) as total_sales,
  COUNT(*) as transaction_count
FROM sales
GROUP BY product_id;
`;

      const result = parser.parse(code);

      // Materialized views should be extracted as views
      const views = result.symbols.filter(s => s.kind === 'class');
      expect(views.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('fixtures', () => {
    it('should parse sample-sql-basic.sql', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'sql', 'sample-sql-basic.sql');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols
      expect(result.symbols.length).toBeGreaterThan(15);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      const functions = result.symbols.filter(s => s.kind === 'function');
      const indexes = result.symbols.filter(s => s.kind === 'variable' && !s.name.includes('.'));
      const triggers = result.symbols.filter(s => s.kind === 'method');

      expect(tables.length).toBeGreaterThanOrEqual(5);
      expect(functions.length).toBeGreaterThanOrEqual(5);
      expect(indexes.length).toBeGreaterThanOrEqual(3);
      expect(triggers.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse sample-sql-advanced.sql', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'sql', 'sample-sql-advanced.sql');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols
      expect(result.symbols.length).toBeGreaterThan(15);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      const functions = result.symbols.filter(s => s.kind === 'function');
      const indexes = result.symbols.filter(s => s.kind === 'variable' && !s.name.includes('.'));

      expect(tables.length).toBeGreaterThanOrEqual(4);
      expect(functions.length).toBeGreaterThanOrEqual(3);
      expect(indexes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
CREATE TABLE incomplete_table (
  id INT PRIMARY KEY
  -- Missing closing parenthesis
`;

      // Should not throw, tree-sitter is error-tolerant
      const result = parser.parse(code);

      expect(result.symbols).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
CREATE TABLE valid_table (
  id INT PRIMARY KEY
);

CREATE TABLE invalid_table (
  -- Missing column definitions

CREATE VIEW valid_view AS SELECT * FROM valid_table;
`;

      const result = parser.parse(code);

      // Should extract at least some valid symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance', () => {
    it('should parse large SQL files quickly', () => {
      // Generate a large SQL file
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`CREATE TABLE table_${i} (`);
        lines.push(`  id INT PRIMARY KEY,`);
        lines.push(`  name VARCHAR(100)`);
        lines.push(`);`);
        lines.push('');
      }
      const code = lines.join('\n');

      const result = parser.parse(code);

      const tables = result.symbols.filter(s => s.kind === 'class' && !s.name.includes('.'));
      expect(tables).toHaveLength(50);

      // Should parse in reasonable time (< 300ms for 50 tables)
      expect(result.parseTime).toBeLessThan(300);
    });
  });
});
