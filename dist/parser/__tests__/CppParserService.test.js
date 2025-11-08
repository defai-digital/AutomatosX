/**
 * CppParserService.test.ts
 *
 * Tests for C++ language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CppParserService } from '../CppParserService.js';
import * as fs from 'fs';
import * as path from 'path';
describe('CppParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new CppParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('cpp');
        });
        it('should support C++ file extensions', () => {
            expect(parser.extensions).toContain('.cpp');
            expect(parser.extensions).toContain('.h');
            expect(parser.extensions).toContain('.hpp');
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should extract class declarations', () => {
            const code = `
class Calculator {
public:
    double add(double a, double b);
};

class Helper {
    void help();
};
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(2);
            expect(classes.map(c => c.name)).toContain('Calculator');
            expect(classes.map(c => c.name)).toContain('Helper');
        });
        it('should extract struct declarations', () => {
            const code = `
struct Point {
    double x, y;
};

struct Rectangle {
    double width, height;
};
`;
            const result = parser.parse(code);
            const structs = result.symbols.filter(s => s.kind === 'struct');
            expect(structs).toHaveLength(2);
            expect(structs.map(s => s.name)).toContain('Point');
        });
        it('should extract enum declarations', () => {
            const code = `
enum Status {
    Active,
    Inactive
};

enum class Color {
    Red,
    Green,
    Blue
};
`;
            const result = parser.parse(code);
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(enums).toHaveLength(2);
        });
        it('should extract function definitions', () => {
            const code = `
void calculate(int x, int y) {
    return x + y;
}

double process(double value) {
    return value * 2;
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(2);
        });
        it('should extract template classes', () => {
            const code = `
template<typename T>
class Container {
    T value;
public:
    T get() const;
};
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(1);
            expect(classes[0].name).toBe('Container');
        });
        it('should extract template functions', () => {
            const code = `
template<typename T>
T maximum(T a, T b) {
    return (a > b) ? a : b;
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(1);
        });
        it('should extract namespaces', () => {
            const code = `
namespace math {
    double abs(double x);
}

namespace utils {
    void helper();
}
`;
            const result = parser.parse(code);
            const namespaces = result.symbols.filter(s => s.kind === 'module');
            expect(namespaces).toHaveLength(2);
            expect(namespaces.map(n => n.name)).toContain('math');
        });
        it('should extract constants', () => {
            const code = `
const int MAX_SIZE = 100;
const double PI = 3.14159;
`;
            const result = parser.parse(code);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle inheritance', () => {
            const code = `
class Shape {
public:
    virtual double area() = 0;
};

class Circle : public Shape {
public:
    double area() override;
};
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
        });
    });
    describe('fixture files', () => {
        it('should parse sample1.cpp (basic features)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'cpp', 'sample1.cpp');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(3);
            expect(classes.map(c => c.name)).toContain('Point');
            expect(classes.map(c => c.name)).toContain('Circle');
            const structs = result.symbols.filter(s => s.kind === 'struct');
            expect(structs.length).toBeGreaterThanOrEqual(1);
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(enums.length).toBeGreaterThanOrEqual(2);
        });
        it('should parse sample2.cpp (templates)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'cpp', 'sample2.cpp');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(5);
            const structs = result.symbols.filter(s => s.kind === 'struct');
            expect(structs.length).toBeGreaterThanOrEqual(1);
            const namespaces = result.symbols.filter(s => s.kind === 'module');
            expect(namespaces.length).toBeGreaterThanOrEqual(2);
        });
        it('should parse sample3.cpp (modern patterns)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'cpp', 'sample3.cpp');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(5);
            expect(classes.map(c => c.name)).toContain('Configuration');
            expect(classes.map(c => c.name)).toContain('QueryBuilder');
            const structs = result.symbols.filter(s => s.kind === 'struct');
            expect(structs.length).toBeGreaterThanOrEqual(1);
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(enums.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `
class Incomplete {
    void method(
        // Missing parts
`;
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
class Valid {
    void method() {}
};

class Invalid {
    void incomplete(

class AnotherValid {
    void method() {}
};
`;
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            const lines = ['#include <iostream>'];
            for (let i = 0; i < 50; i++) {
                lines.push(`class Class${i} {`);
                lines.push(`public:`);
                lines.push(`    void method${i}() {}`);
                lines.push(`};`);
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(50);
            expect(result.parseTime).toBeLessThan(100);
        });
    });
});
//# sourceMappingURL=CppParserService.test.js.map