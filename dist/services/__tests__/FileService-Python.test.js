/**
 * FileService-Python.test.ts
 *
 * End-to-end tests for Python file indexing with FileService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { FileService } from '../FileService.js';
import { runMigrations } from '../../database/migrations.js';
describe('FileService - Python Integration', () => {
    let db;
    let fileService;
    beforeEach(() => {
        // Create unique in-memory database for each test
        db = new Database(':memory:');
        runMigrations(db);
        fileService = new FileService();
    });
    describe('Python file indexing', () => {
        it('should index Python file with functions and classes', () => {
            const pythonCode = `
# User management module

class User:
    """User class for authentication."""

    def __init__(self, name, email):
        self.name = name
        self.email = email

    def validate(self):
        """Validate user data."""
        return bool(self.name and self.email)

def create_user(name, email):
    """Create a new user instance."""
    return User(name, email)

def authenticate_user(username, password):
    """Authenticate user credentials."""
    # Authentication logic here
    pass
`;
            const result = fileService.indexFile('/app/user.py', pythonCode);
            // Verify indexing succeeded
            expect(result.fileId).toBeGreaterThan(0);
            expect(result.symbolCount).toBe(5); // User class + 3 methods + 2 functions
            expect(result.chunkCount).toBeGreaterThan(0);
            expect(result.totalTime).toBeGreaterThan(0);
            // Retrieve and verify file
            const indexed = fileService.getFileWithSymbols('/app/user.py');
            expect(indexed).not.toBeNull();
            expect(indexed.path).toBe('/app/user.py');
            expect(indexed.language).toBe('python');
            expect(indexed.symbols).toHaveLength(5);
            // Verify symbols
            const symbolNames = indexed.symbols.map(s => s.name);
            expect(symbolNames).toContain('User');
            expect(symbolNames).toContain('__init__');
            expect(symbolNames).toContain('validate');
            expect(symbolNames).toContain('create_user');
            expect(symbolNames).toContain('authenticate_user');
            // Verify symbol kinds
            const classes = indexed.symbols.filter(s => s.kind === 'class');
            const methods = indexed.symbols.filter(s => s.kind === 'method');
            const functions = indexed.symbols.filter(s => s.kind === 'function');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('User');
            expect(methods).toHaveLength(2); // __init__, validate
            expect(functions).toHaveLength(2); // create_user, authenticate_user
        });
        it('should search Python symbols by name', () => {
            const pythonCode = `
class DataProcessor:
    def process(self, data):
        return data

def process_batch(items):
    return [process_item(item) for item in items]

def process_item(item):
    return item.strip()
`;
            fileService.indexFile('/app/processor.py', pythonCode);
            // Search for "process" - should find all process-related symbols
            const results = fileService.searchSymbols('process');
            expect(results.length).toBeGreaterThan(0);
            // Should find at least the method
            const processMethod = results.find(r => r.name === 'process');
            expect(processMethod).toBeDefined();
            expect(processMethod.kind).toBe('method');
            expect(processMethod.file_path).toBe('/app/processor.py');
        });
        it('should handle async Python functions', () => {
            const pythonCode = `
import asyncio

class AsyncService:
    async def fetch_data(self, url):
        """Fetch data asynchronously."""
        pass

    async def save_data(self, data):
        """Save data asynchronously."""
        pass

async def main():
    """Main async function."""
    service = AsyncService()
    await service.fetch_data("https://api.example.com")
`;
            const result = fileService.indexFile('/app/async_service.py', pythonCode);
            expect(result.symbolCount).toBe(4); // AsyncService class + 2 async methods + 1 async function
            const indexed = fileService.getFileWithSymbols('/app/async_service.py');
            const symbolNames = indexed.symbols.map(s => s.name);
            expect(symbolNames).toContain('AsyncService');
            expect(symbolNames).toContain('fetch_data');
            expect(symbolNames).toContain('save_data');
            expect(symbolNames).toContain('main');
        });
        it('should handle decorated Python functions', () => {
            const pythonCode = `
from functools import lru_cache

@lru_cache(maxsize=100)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

class Calculator:
    @staticmethod
    def add(a, b):
        return a + b

    @classmethod
    def from_string(cls, s):
        return cls()

    @property
    def value(self):
        return self._value
`;
            const result = fileService.indexFile('/app/decorators.py', pythonCode);
            // Should extract: fibonacci function, Calculator class, add, from_string, value
            expect(result.symbolCount).toBe(5);
            const indexed = fileService.getFileWithSymbols('/app/decorators.py');
            const symbolNames = indexed.symbols.map(s => s.name);
            expect(symbolNames).toContain('fibonacci');
            expect(symbolNames).toContain('Calculator');
            expect(symbolNames).toContain('add');
            expect(symbolNames).toContain('from_string');
            expect(symbolNames).toContain('value');
        });
        it('should re-index modified Python file', () => {
            const originalCode = `
def hello():
    return "Hello"
`;
            const modifiedCode = `
def hello():
    return "Hello"

def goodbye():
    return "Goodbye"
`;
            // Index original
            const result1 = fileService.indexFile('/app/greetings.py', originalCode);
            expect(result1.symbolCount).toBe(1);
            // Re-index with modifications
            const result2 = fileService.reindexFile('/app/greetings.py', modifiedCode);
            expect(result2.symbolCount).toBe(2);
            // Verify updated symbols
            const indexed = fileService.getFileWithSymbols('/app/greetings.py');
            const symbolNames = indexed.symbols.map(s => s.name);
            expect(symbolNames).toContain('hello');
            expect(symbolNames).toContain('goodbye');
        });
        it('should handle nested Python classes', () => {
            const pythonCode = `
class Outer:
    class Inner:
        def inner_method(self):
            pass

    def outer_method(self):
        pass
`;
            const result = fileService.indexFile('/app/nested.py', pythonCode);
            // Should extract: Outer class, Inner class, inner_method, outer_method
            expect(result.symbolCount).toBe(4);
            const indexed = fileService.getFileWithSymbols('/app/nested.py');
            const classes = indexed.symbols.filter(s => s.kind === 'class');
            const methods = indexed.symbols.filter(s => s.kind === 'method');
            expect(classes).toHaveLength(2);
            expect(methods).toHaveLength(2);
        });
        it('should handle Python type hints', () => {
            const pythonCode = `
from typing import List, Dict, Optional

def process_data(items: List[str]) -> Dict[str, int]:
    """Process list of strings into a dictionary."""
    return {item: len(item) for item in items}

def find_user(user_id: int) -> Optional[str]:
    """Find user by ID."""
    return None

class TypedClass:
    name: str
    age: int

    def __init__(self, name: str, age: int) -> None:
        self.name = name
        self.age = age
`;
            const result = fileService.indexFile('/app/typed.py', pythonCode);
            // Should extract: process_data, find_user, TypedClass, __init__
            expect(result.symbolCount).toBe(4);
            const indexed = fileService.getFileWithSymbols('/app/typed.py');
            const symbolNames = indexed.symbols.map(s => s.name);
            expect(symbolNames).toContain('process_data');
            expect(symbolNames).toContain('find_user');
            expect(symbolNames).toContain('TypedClass');
            expect(symbolNames).toContain('__init__');
        });
        it('should search Python code using natural language', () => {
            const pythonCode = `
class UserAuthentication:
    """Handle user authentication and authorization."""

    def authenticate(self, username, password):
        """Verify user credentials."""
        return self._check_credentials(username, password)

    def _check_credentials(self, username, password):
        """Internal method to check credentials."""
        # Database lookup
        return True
`;
            fileService.indexFile('/app/auth.py', pythonCode);
            // Natural language search
            const results = fileService.searchNaturalLanguage('user authentication');
            expect(results.length).toBeGreaterThan(0);
            // Should find chunks related to authentication
            const authChunk = results.find(r => r.content.includes('authenticate'));
            expect(authChunk).toBeDefined();
            expect(authChunk.file_path).toBe('/app/auth.py');
        });
        it('should delete Python file and its symbols', () => {
            const pythonCode = `
def test_function():
    pass
`;
            fileService.indexFile('/app/test.py', pythonCode);
            // Verify file exists
            let indexed = fileService.getFileWithSymbols('/app/test.py');
            expect(indexed).not.toBeNull();
            // Delete file
            const deleted = fileService.deleteFile('/app/test.py');
            expect(deleted).toBe(true);
            // Verify file is gone
            indexed = fileService.getFileWithSymbols('/app/test.py');
            expect(indexed).toBeNull();
        });
        it('should get statistics for Python files', () => {
            const pythonCode1 = `
class User:
    def save(self):
        pass
`;
            const pythonCode2 = `
def helper():
    pass
`;
            fileService.indexFile('/app/models.py', pythonCode1);
            fileService.indexFile('/app/utils.py', pythonCode2);
            const stats = fileService.getStats();
            expect(stats.totalFiles).toBe(2);
            expect(stats.totalSymbols).toBe(3); // User class + save method + helper function
            expect(stats.totalChunks).toBeGreaterThan(0);
            expect(stats.symbolsByKind.class).toBe(1);
            expect(stats.symbolsByKind.method).toBe(1);
            expect(stats.symbolsByKind.function).toBe(1);
        });
    });
    describe('Multi-language support', () => {
        it('should index both TypeScript and Python files', () => {
            const tsCode = `
export class TypeScriptClass {
  method(): void {}
}
`;
            const pyCode = `
class PythonClass:
    def method(self):
        pass
`;
            const tsResult = fileService.indexFile('/app/typescript.ts', tsCode);
            const pyResult = fileService.indexFile('/app/python.py', pyCode);
            expect(tsResult.symbolCount).toBeGreaterThan(0);
            expect(pyResult.symbolCount).toBeGreaterThan(0);
            // Verify languages are detected correctly
            const tsFile = fileService.getFileWithSymbols('/app/typescript.ts');
            const pyFile = fileService.getFileWithSymbols('/app/python.py');
            expect(tsFile.language).toBe('typescript');
            expect(pyFile.language).toBe('python');
            const stats = fileService.getStats();
            expect(stats.totalFiles).toBe(2);
        });
    });
});
//# sourceMappingURL=FileService-Python.test.js.map