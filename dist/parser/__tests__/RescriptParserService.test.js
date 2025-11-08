/**
 * RescriptParserService.test.ts
 *
 * Tests for ReScript language parser using Tree-sitter OCaml grammar
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RescriptParserService } from '../RescriptParserService.js';
import * as fs from 'fs';
import * as path from 'path';
describe('RescriptParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new RescriptParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('rescript');
        });
        it('should support ReScript file extensions', () => {
            expect(parser.extensions).toContain('.res');
            expect(parser.extensions).toContain('.resi');
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should extract type definitions', () => {
            const code = `
type point = {x: float, y: float}

type shape = Circle(float) | Rectangle(float, float)
`;
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types.length).toBeGreaterThanOrEqual(2);
            expect(types.map(t => t.name)).toContain('point');
            expect(types.map(t => t.name)).toContain('shape');
        });
        it('should extract simple functions', () => {
            const code = `
let add = (a, b) => a + b

let multiply = (x, y) => x * y
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(2);
            expect(functions.map(f => f.name)).toContain('add');
            expect(functions.map(f => f.name)).toContain('multiply');
        });
        it('should extract constants', () => {
            const code = `
let pi = 3.14159

let maxValue = 1000
`;
            const result = parser.parse(code);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(2);
        });
        it('should extract module definitions', () => {
            const code = `
module Math = {
  let square = x => x * x
}

module Utils = {
  let abs = x => if x < 0 { -x } else { x }
}
`;
            const result = parser.parse(code);
            const modules = result.symbols.filter(s => s.kind === 'module');
            expect(modules.length).toBeGreaterThanOrEqual(2);
            expect(modules.map(m => m.name)).toContain('Math');
            expect(modules.map(m => m.name)).toContain('Utils');
        });
        it('should extract recursive functions', () => {
            const code = `
let rec factorial = n =>
  if n <= 1 {
    1
  } else {
    n * factorial(n - 1)
  }
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(1);
            expect(functions[0].name).toBe('factorial');
        });
        it('should extract external declarations', () => {
            const code = `
@val external setTimeout: (unit => unit, int) => int = "setTimeout"

@module("path") external join: (string, string) => string = "join"
`;
            const result = parser.parse(code);
            const externals = result.symbols.filter(s => s.kind === 'function');
            expect(externals.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle pattern matching', () => {
            const code = `
let colorToString = color =>
  switch color {
  | Red => "red"
  | Green => "green"
  | Blue => "blue"
  }
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(1);
            expect(functions[0].name).toBe('colorToString');
        });
    });
    describe('fixture files', () => {
        it('should parse sample1.res (basic features)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'rescript', 'sample1.res');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types.length).toBeGreaterThanOrEqual(3);
            expect(types.map(t => t.name)).toContain('point');
            expect(types.map(t => t.name)).toContain('circle');
            const modules = result.symbols.filter(s => s.kind === 'module');
            expect(modules.length).toBeGreaterThanOrEqual(2);
            expect(modules.map(m => m.name)).toContain('Math');
            expect(modules.map(m => m.name)).toContain('Geometry');
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(3);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(2);
        });
        it('should parse sample2.res (advanced features)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'rescript', 'sample2.res');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types.length).toBeGreaterThanOrEqual(5);
            expect(types.map(t => t.name)).toContain('color');
            expect(types.map(t => t.name)).toContain('tree');
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(8);
            expect(functions.map(f => f.name)).toContain('factorial');
            expect(functions.map(f => f.name)).toContain('fibonacci');
            const modules = result.symbols.filter(s => s.kind === 'module');
            expect(modules.length).toBeGreaterThanOrEqual(2);
            expect(modules.map(m => m.name)).toContain('Status');
        });
        it('should parse sample3.res (modern patterns)', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'rescript', 'sample3.res');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types.length).toBeGreaterThanOrEqual(2);
            expect(types.map(t => t.name)).toContain('user');
            const externals = result.symbols.filter(s => s.kind === 'function' && s.name.includes('external'));
            // External functions should be extracted
            const allFunctions = result.symbols.filter(s => s.kind === 'function');
            expect(allFunctions.length).toBeGreaterThanOrEqual(5);
            const modules = result.symbols.filter(s => s.kind === 'module');
            expect(modules.length).toBeGreaterThanOrEqual(3);
            expect(modules.map(m => m.name)).toContain('Constants');
            expect(modules.map(m => m.name)).toContain('Utils');
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(3);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `
let incomplete = (a, b =>
  // Missing closing parenthesis
`;
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
let valid = x => x + 1

let invalid = (a, b
  // Incomplete

let anotherValid = y => y * 2
`;
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            const lines = ['// Large ReScript file'];
            for (let i = 0; i < 50; i++) {
                lines.push(`type type${i} = { value: int }`);
                lines.push(`let func${i} = x => x + ${i}`);
                lines.push(`module Module${i} = { let helper = () => ${i} }`);
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            const functions = result.symbols.filter(s => s.kind === 'function');
            const modules = result.symbols.filter(s => s.kind === 'module');
            expect(types.length).toBeGreaterThanOrEqual(40);
            expect(functions.length).toBeGreaterThanOrEqual(40);
            expect(modules.length).toBeGreaterThanOrEqual(40);
            expect(result.parseTime).toBeLessThan(200);
        });
    });
});
//# sourceMappingURL=RescriptParserService.test.js.map