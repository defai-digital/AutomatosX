/**
 * PythonParserService.test.ts
 *
 * Tests for Python language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PythonParserService } from '../PythonParserService.js';
describe('PythonParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new PythonParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('python');
        });
        it('should support Python file extensions', () => {
            expect(parser.extensions).toEqual(['.py', '.pyi']);
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
            expect(result.nodeCount).toBeGreaterThan(0);
        });
        it('should extract function definitions', () => {
            const code = `
def hello():
    return "Hello"

def greet(name):
    return f"Hello, {name}"
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(2);
            // First function
            expect(result.symbols[0].name).toBe('hello');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].line).toBe(2);
            // Second function
            expect(result.symbols[1].name).toBe('greet');
            expect(result.symbols[1].kind).toBe('function');
            expect(result.symbols[1].line).toBe(5);
        });
        it('should extract class definitions', () => {
            const code = `
class User:
    def __init__(self, name):
        self.name = name

class Admin(User):
    def __init__(self, name, permissions):
        super().__init__(name)
        self.permissions = permissions
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('User');
            expect(classes[0].line).toBe(2);
            expect(classes[1].name).toBe('Admin');
            expect(classes[1].line).toBe(6);
        });
        it('should extract methods from classes', () => {
            const code = `
class Calculator:
    def add(self, a, b):
        return a + b

    def subtract(self, a, b):
        return a - b

    @staticmethod
    def multiply(a, b):
        return a * b
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(3);
            expect(methods[0].name).toBe('add');
            expect(methods[1].name).toBe('subtract');
            expect(methods[2].name).toBe('multiply');
        });
        it('should distinguish between functions and methods', () => {
            const code = `
def standalone_function():
    pass

class MyClass:
    def my_method(self):
        pass
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('standalone_function');
            expect(methods).toHaveLength(1);
            expect(methods[0].name).toBe('my_method');
        });
        it('should handle decorated functions', () => {
            const code = `
@decorator
def decorated_function():
    pass

@property
def my_property(self):
    return self._value
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(2);
            expect(result.symbols[0].name).toBe('decorated_function');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[1].name).toBe('my_property');
        });
        it('should handle nested functions', () => {
            const code = `
def outer():
    def inner():
        pass
    return inner
`;
            const result = parser.parse(code);
            // Both outer and inner functions should be extracted
            expect(result.symbols).toHaveLength(2);
            expect(result.symbols[0].name).toBe('outer');
            expect(result.symbols[1].name).toBe('inner');
        });
        it('should handle nested classes', () => {
            const code = `
class Outer:
    class Inner:
        def method(self):
            pass
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('Outer');
            expect(classes[1].name).toBe('Inner');
        });
        it('should include position information', () => {
            const code = `def hello():
    return "Hello"`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            const symbol = result.symbols[0];
            expect(symbol.line).toBe(1);
            expect(symbol.column).toBe(0);
            expect(symbol.endLine).toBeDefined();
            expect(symbol.endColumn).toBeDefined();
            expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
        });
        it('should handle complex Python code', () => {
            const code = `
import os
from typing import List, Optional

class DataProcessor:
    """Process data from various sources."""

    def __init__(self, config: dict):
        self.config = config
        self.data = []

    async def fetch_data(self, url: str) -> List[dict]:
        """Fetch data from URL."""
        pass

    @classmethod
    def from_file(cls, filepath: str):
        """Create processor from file."""
        pass

    @staticmethod
    def validate(data: dict) -> bool:
        """Validate data format."""
        pass

def process_batch(items: List[str]) -> None:
    """Process a batch of items."""
    for item in items:
        print(item)
`;
            const result = parser.parse(code);
            // Should extract: class + 3 methods + 1 function
            expect(result.symbols.length).toBeGreaterThanOrEqual(5);
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('DataProcessor');
            expect(methods).toHaveLength(4); // __init__, fetch_data, from_file, validate
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('process_batch');
        });
        it('should handle async functions', () => {
            const code = `
async def fetch_data():
    pass

class AsyncService:
    async def process(self):
        pass
`;
            const result = parser.parse(code);
            const asyncFunctions = result.symbols.filter(s => s.name === 'fetch_data');
            expect(asyncFunctions).toHaveLength(1);
            expect(asyncFunctions[0].kind).toBe('function');
        });
        it('should handle lambda functions', () => {
            // Lambda functions are not top-level symbols, so they shouldn't be extracted
            const code = `
square = lambda x: x * x
add = lambda a, b: a + b
`;
            const result = parser.parse(code);
            // Lambdas are assignments, not function definitions
            // Parser should not extract them as functions
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(0);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            // Tree-sitter parsers are error-tolerant
            const code = `
def incomplete_function(
    # Missing closing parenthesis and body
`;
            // Should not throw, but parse what it can
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
def valid_function():
    return 42

def invalid_function(
    # Missing parts

def another_valid():
    pass
`;
            const result = parser.parse(code);
            // Should extract the valid functions
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            // Generate a large Python file
            const lines = [];
            for (let i = 0; i < 100; i++) {
                lines.push(`def function_${i}():`);
                lines.push(`    return ${i}`);
                lines.push('');
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(100);
            // Should parse in reasonable time (< 100ms for 100 functions)
            expect(result.parseTime).toBeLessThan(100);
        });
    });
});
//# sourceMappingURL=PythonParserService.test.js.map