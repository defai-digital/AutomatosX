/**
 * SwiftParserService.test.ts
 *
 * Tests for Swift language parser using Tree-sitter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SwiftParserService } from '../SwiftParserService.js';
import { Symbol, SymbolKind } from '../LanguageParser.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SwiftParserService', () => {
  let parser: SwiftParserService;

  beforeEach(() => {
    parser = new SwiftParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('swift');
    });

    it('should support Swift file extensions', () => {
      expect(parser.extensions).toContain('.swift');
    });
  });

  describe('parse', () => {
    it('should parse empty file', () => {
      const result = parser.parse('');

      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.nodeCount).toBeGreaterThanOrEqual(0);
    });

    it('should extract top-level function definitions', () => {
      const code = `
func add(a: Int, b: Int) -> Int {
    return a + b
}

func multiply(a: Int, b: Int) -> Int {
    return a * b
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions).toHaveLength(2);

      expect(functions[0].name).toBe('add');
      expect(functions[0].kind).toBe('function');

      expect(functions[1].name).toBe('multiply');
      expect(functions[1].kind).toBe('function');
    });

    it('should extract class definitions', () => {
      const code = `
class Calculator {
    func add(a: Double, b: Double) -> Double {
        return a + b
    }
}

class Counter {
    private var count: Int = 0
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(2);

      expect(classes[0].name).toBe('Calculator');
      expect(classes[1].name).toBe('Counter');
    });

    it('should extract methods from classes', () => {
      const code = `
class Calculator {
    func add(a: Int, b: Int) -> Int {
        return a + b
    }

    func subtract(a: Int, b: Int) -> Int {
        return a - b
    }

    private func log(message: String) {
        print(message)
    }
}
`;

      const result = parser.parse(code);

      const methods = result.symbols.filter(s => s.kind === 'method');
      expect(methods).toHaveLength(3);

      expect(methods[0].name).toBe('Calculator.add');
      expect(methods[1].name).toBe('Calculator.subtract');
      expect(methods[2].name).toBe('Calculator.log');
    });

    it('should extract struct definitions', () => {
      const code = `
struct Point {
    var x: Double
    var y: Double
}

struct Person {
    var name: String
    var age: Int
}
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'class');
      expect(structs.length).toBeGreaterThanOrEqual(2);

      const structNames = structs.map(s => s.name);
      expect(structNames).toContain('Point');
      expect(structNames).toContain('Person');
    });

    it('should extract enum definitions', () => {
      const code = `
enum Result {
    case success
    case failure
}

enum Status {
    case pending
    case active
    case inactive
}
`;

      const result = parser.parse(code);

      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums.length).toBeGreaterThanOrEqual(2);

      const enumNames = enums.map(s => s.name);
      expect(enumNames).toContain('Result');
      expect(enumNames).toContain('Status');
    });

    it('should extract protocol definitions', () => {
      const code = `
protocol Logger {
    func log(message: String)
    func error(message: String)
}

protocol Repository {
    func find(id: Int) -> Any?
    func save(entity: Any) -> Bool
}
`;

      const result = parser.parse(code);

      const protocols = result.symbols.filter(s => s.kind === 'interface');
      expect(protocols).toHaveLength(2);

      expect(protocols[0].name).toBe('Logger');
      expect(protocols[1].name).toBe('Repository');
    });

    it('should extract properties', () => {
      const code = `
struct Product {
    let id: Int
    var name: String
    var price: Double
}
`;

      const result = parser.parse(code);

      const properties = result.symbols.filter(s =>
        s.kind === 'constant' || s.kind === 'variable'
      );
      expect(properties.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle class inheritance', () => {
      const code = `
class Animal {
    let name: String

    init(name: String) {
        self.name = name
    }

    func makeSound() -> String {
        return "Some sound"
    }
}

class Dog: Animal {
    override func makeSound() -> String {
        return "Woof!"
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(2);

      expect(classes[0].name).toBe('Animal');
      expect(classes[1].name).toBe('Dog');
    });

    it('should handle static members', () => {
      const code = `
class MathUtils {
    static let pi = 3.14159

    static func square(x: Double) -> Double {
        return x * x
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('MathUtils');
    });

    it('should handle computed properties', () => {
      const code = `
struct Rectangle {
    var width: Double
    var height: Double

    var area: Double {
        return width * height
    }
}
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'class');
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe('Rectangle');
    });

    it('should include position information', () => {
      const code = `
func hello() -> String {
    return "Hello"
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions).toHaveLength(1);

      const func = functions[0];
      expect(func.line).toBeGreaterThan(0);
      expect(func.column).toBeGreaterThanOrEqual(0);
      expect(func.endLine).toBeDefined();
      expect(func.endColumn).toBeDefined();
      expect(func.endLine).toBeGreaterThanOrEqual(func.line);
    });

    it('should handle initializers', () => {
      const code = `
class User {
    let id: Int
    var username: String

    init(id: Int, username: String) {
        self.id = id
        self.username = username
    }
}
`;

      const result = parser.parse(code);

      const classes = result.symbols.filter(s => s.kind === 'class');
      expect(classes).toHaveLength(1);
      expect(classes[0].name).toBe('User');
    });

    it('should handle extensions', () => {
      const code = `
extension String {
    func toTitleCase() -> String {
        return self.capitalized
    }
}

extension Int {
    func isEven() -> Bool {
        return self % 2 == 0
    }
}
`;

      const result = parser.parse(code);

      // Extensions may create symbols for their methods
      const functions = result.symbols.filter(s =>
        s.kind === 'function' || s.kind === 'method'
      );
      expect(functions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('fixtures', () => {
    it('should parse sample-swift-basic.swift', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'swift', 'sample-swift-basic.swift');
      const code = fs.readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols
      expect(result.symbols.length).toBeGreaterThan(10);

      const functions = result.symbols.filter(s => s.kind === 'function');
      const classes = result.symbols.filter(s => s.kind === 'class');
      const protocols = result.symbols.filter(s => s.kind === 'interface');
      const enums = result.symbols.filter(s => s.kind === 'enum');

      expect(functions.length).toBeGreaterThanOrEqual(3);
      expect(classes.length).toBeGreaterThanOrEqual(5);
      expect(protocols.length).toBeGreaterThanOrEqual(2);
      expect(enums.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully', () => {
      const code = `
func incomplete_function(
    // Missing closing parenthesis
`;

      // Should not throw, tree-sitter is error-tolerant
      const result = parser.parse(code);

      expect(result.symbols).toBeDefined();
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
func validFunction() -> Int {
    return 42
}

class InvalidClass {
    // Missing closing brace

func anotherValidFunction() -> String {
    return "test"
}
`;

      const result = parser.parse(code);

      // Should extract at least some valid symbols
      expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('performance', () => {
    it('should parse large files quickly', () => {
      // Generate a large Swift file
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`func testFunction${i}() -> Int {`);
        lines.push(`    return ${i}`);
        lines.push(`}`);
        lines.push('');
      }
      const code = lines.join('\n');

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions).toHaveLength(100);

      // Should parse in reasonable time (< 200ms for 100 functions)
      expect(result.parseTime).toBeLessThan(200);
    });
  });
});
