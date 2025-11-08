/**
 * RustParserService.test.ts
 *
 * Tests for Rust language parser using Tree-sitter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RustParserService } from '../RustParserService.js';
import { Symbol, SymbolKind } from '../LanguageParser.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('RustParserService', () => {
  let parser: RustParserService;

  beforeEach(() => {
    parser = new RustParserService();
  });

  describe('metadata', () => {
    it('should have correct language identifier', () => {
      expect(parser.language).toBe('rust');
    });

    it('should support Rust file extensions', () => {
      expect(parser.extensions).toEqual(['.rs']);
    });
  });

  describe('parse', () => {
    it('should parse empty file', () => {
      const result = parser.parse('');

      expect(result.symbols).toEqual([]);
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    it('should extract function declarations', () => {
      const code = `
fn hello() -> String {
    String::from("Hello")
}

pub fn greet(name: &str) -> String {
    format!("Hello, {}", name)
}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions).toHaveLength(2);

      // First function
      expect(functions[0].name).toBe('hello');
      expect(functions[0].kind).toBe('function');
      expect(functions[0].line).toBeGreaterThan(0);

      // Second function
      expect(functions[1].name).toBe('greet');
      expect(functions[1].kind).toBe('function');
    });

    it('should extract struct declarations', () => {
      const code = `
pub struct Point {
    pub x: f64,
    pub y: f64,
}

struct Rectangle {
    width: f64,
    height: f64,
}
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs).toHaveLength(2);

      expect(structs[0].name).toBe('Point');
      expect(structs[0].kind).toBe('struct');

      expect(structs[1].name).toBe('Rectangle');
      expect(structs[1].kind).toBe('struct');
    });

    it('should extract enum declarations', () => {
      const code = `
pub enum Status {
    Active,
    Inactive,
}

enum Color {
    Red,
    Green,
    Blue,
    RGB(u8, u8, u8),
}
`;

      const result = parser.parse(code);

      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums).toHaveLength(2);

      expect(enums[0].name).toBe('Status');
      expect(enums[0].kind).toBe('enum');

      expect(enums[1].name).toBe('Color');
      expect(enums[1].kind).toBe('enum');
    });

    it('should extract trait declarations', () => {
      const code = `
pub trait Drawable {
    fn draw(&self) -> String;
}

trait Serializable {
    fn serialize(&self) -> Vec<u8>;
    fn deserialize(data: &[u8]) -> Self;
}
`;

      const result = parser.parse(code);

      const traits = result.symbols.filter(s => s.kind === 'interface');
      expect(traits).toHaveLength(2);

      expect(traits[0].name).toBe('Drawable');
      expect(traits[0].kind).toBe('interface');

      expect(traits[1].name).toBe('Serializable');
      expect(traits[1].kind).toBe('interface');
    });

    it('should extract impl blocks', () => {
      const code = `
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }
}
`;

      const result = parser.parse(code);

      const impls = result.symbols.filter(s => s.kind === 'class');
      expect(impls.length).toBeGreaterThan(0);

      const pointImpl = impls.find(s => s.name.includes('Point'));
      expect(pointImpl).toBeDefined();
      expect(pointImpl?.name).toContain('impl');
    });

    it('should extract trait implementations', () => {
      const code = `
trait Display {
    fn display(&self) -> String;
}

struct Point {
    x: f64,
    y: f64,
}

impl Display for Point {
    fn display(&self) -> String {
        format!("({}, {})", self.x, self.y)
    }
}
`;

      const result = parser.parse(code);

      const traitImpls = result.symbols.filter(s =>
        s.kind === 'class' && s.name.includes('for')
      );
      expect(traitImpls.length).toBeGreaterThan(0);
    });

    it('should extract constant declarations', () => {
      const code = `
const MAX_SIZE: usize = 100;
pub const PI: f64 = 3.14159;
const VERSION: &str = "1.0.0";
`;

      const result = parser.parse(code);

      const constants = result.symbols.filter(s => s.kind === 'constant');
      expect(constants).toHaveLength(3);

      expect(constants[0].name).toBe('MAX_SIZE');
      expect(constants[1].name).toBe('PI');
      expect(constants[2].name).toBe('VERSION');
    });

    it('should extract static declarations', () => {
      const code = `
static APP_VERSION: &str = "2.0.0";
pub static mut COUNTER: i32 = 0;
`;

      const result = parser.parse(code);

      const statics = result.symbols.filter(s => s.kind === 'variable');
      expect(statics).toHaveLength(2);

      expect(statics[0].name).toBe('APP_VERSION');
      expect(statics[1].name).toBe('COUNTER');
    });

    it('should extract type aliases', () => {
      const code = `
type Result<T> = std::result::Result<T, Error>;
pub type Point = (f64, f64);
type Callback = fn(String) -> bool;
`;

      const result = parser.parse(code);

      const types = result.symbols.filter(s => s.kind === 'type');
      expect(types).toHaveLength(3);

      expect(types[0].name).toBe('Result');
      expect(types[1].name).toBe('Point');
      expect(types[2].name).toBe('Callback');
    });

    it('should handle generic structs', () => {
      const code = `
pub struct Container<T> {
    value: T,
}

impl<T> Container<T> {
    pub fn new(value: T) -> Self {
        Container { value }
    }
}
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs).toHaveLength(1);
      expect(structs[0].name).toBe('Container');
    });

    it('should handle generic enums', () => {
      const code = `
pub enum Option<T> {
    Some(T),
    None,
}

pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
`;

      const result = parser.parse(code);

      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums).toHaveLength(2);
      expect(enums[0].name).toBe('Option');
      expect(enums[1].name).toBe('Result');
    });

    it('should handle complex Rust code', () => {
      const code = `
pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}

pub struct Counter {
    count: u32,
}

impl Counter {
    pub fn new() -> Self {
        Counter { count: 0 }
    }
}

impl Iterator for Counter {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        self.count += 1;
        Some(self.count)
    }
}

const MAX_COUNT: u32 = 100;

pub fn create_counter() -> Counter {
    Counter::new()
}
`;

      const result = parser.parse(code);

      // Should extract trait, struct, impl blocks, const, and function
      expect(result.symbols.length).toBeGreaterThan(4);

      const trait = result.symbols.find(s => s.kind === 'interface' && s.name === 'Iterator');
      expect(trait).toBeDefined();

      const struct = result.symbols.find(s => s.kind === 'struct' && s.name === 'Counter');
      expect(struct).toBeDefined();

      const constant = result.symbols.find(s => s.kind === 'constant' && s.name === 'MAX_COUNT');
      expect(constant).toBeDefined();

      const func = result.symbols.find(s => s.kind === 'function' && s.name === 'create_counter');
      expect(func).toBeDefined();
    });

    it('should handle syntax errors gracefully', () => {
      const code = `
pub struct Point {
    x: f64
    // Missing comma
    y: f64
}

fn incomplete(
`;

      const result = parser.parse(code);

      // Should still extract the struct
      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs.length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid code', () => {
      const code = `
pub struct ValidStruct {
    field: i32,
}

fn valid_function() {
    let x = 42;
}

pub fn another_valid() -> i32 {
    100
}

struct {
    // Invalid
`;

      const result = parser.parse(code);

      // Should extract valid symbols
      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs.length).toBeGreaterThan(0);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions.length).toBeGreaterThan(0);
    });

    it('should provide accurate position information', () => {
      const code = `
pub struct Point {
    x: f64,
    y: f64,
}

pub fn new_point(x: f64, y: f64) -> Point {
    Point { x, y }
}
`;

      const result = parser.parse(code);

      const struct = result.symbols.find(s => s.kind === 'struct' && s.name === 'Point');
      expect(struct).toBeDefined();
      expect(struct?.line).toBe(2);
      expect(struct?.column).toBeGreaterThanOrEqual(0);

      const func = result.symbols.find(s => s.kind === 'function' && s.name === 'new_point');
      expect(func).toBeDefined();
      expect(func?.line).toBe(7);
    });
  });

  describe('fixture files', () => {
    it('should parse sample1.rs (basic features)', () => {
      const fixturePath = join(__dirname, 'fixtures', 'rust', 'sample1.rs');
      const code = readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract multiple symbols
      expect(result.symbols.length).toBeGreaterThan(10);

      // Check for specific structs
      const point = result.symbols.find(s => s.kind === 'struct' && s.name === 'Point');
      expect(point).toBeDefined();

      const circle = result.symbols.find(s => s.kind === 'struct' && s.name === 'Circle');
      expect(circle).toBeDefined();

      const calculator = result.symbols.find(s => s.kind === 'struct' && s.name === 'Calculator');
      expect(calculator).toBeDefined();

      // Check for enums
      const color = result.symbols.find(s => s.kind === 'enum' && s.name === 'Color');
      expect(color).toBeDefined();

      const operation = result.symbols.find(s => s.kind === 'enum' && s.name === 'Operation');
      expect(operation).toBeDefined();

      // Check for constants
      const maxCalc = result.symbols.find(s => s.kind === 'constant' && s.name === 'MAX_CALC_VALUE');
      expect(maxCalc).toBeDefined();

      // Check for functions
      const pointFromTuple = result.symbols.find(s => s.kind === 'function' && s.name === 'point_from_tuple');
      expect(pointFromTuple).toBeDefined();
    });

    it('should parse sample2.rs (traits and generics)', () => {
      const fixturePath = join(__dirname, 'fixtures', 'rust', 'sample2.rs');
      const code = readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract many symbols
      expect(result.symbols.length).toBeGreaterThan(15);

      // Check for traits
      const drawable = result.symbols.find(s => s.kind === 'interface' && s.name === 'Drawable');
      expect(drawable).toBeDefined();

      const serializable = result.symbols.find(s => s.kind === 'interface' && s.name === 'Serializable');
      expect(serializable).toBeDefined();

      const iterator = result.symbols.find(s => s.kind === 'interface' && s.name === 'Iterator');
      expect(iterator).toBeDefined();

      // Check for generic structs
      const container = result.symbols.find(s => s.kind === 'struct' && s.name === 'Container');
      expect(container).toBeDefined();

      const pair = result.symbols.find(s => s.kind === 'struct' && s.name === 'Pair');
      expect(pair).toBeDefined();

      // Check for generic enums
      const rustResult = result.symbols.find(s => s.kind === 'enum' && s.name === 'Result');
      expect(rustResult).toBeDefined();

      const rustOption = result.symbols.find(s => s.kind === 'enum' && s.name === 'Option');
      expect(rustOption).toBeDefined();
    });

    it('should parse sample3.rs (advanced patterns)', () => {
      const fixturePath = join(__dirname, 'fixtures', 'rust', 'sample3.rs');
      const code = readFileSync(fixturePath, 'utf-8');

      const result = parser.parse(code);

      // Should extract many symbols
      expect(result.symbols.length).toBeGreaterThan(20);

      // Check for error enum
      const appError = result.symbols.find(s => s.kind === 'enum' && s.name === 'AppError');
      expect(appError).toBeDefined();

      // Check for state enum
      const state = result.symbols.find(s => s.kind === 'enum' && s.name === 'State');
      expect(state).toBeDefined();

      // Check for structs with lifetimes
      const wrapper = result.symbols.find(s => s.kind === 'struct' && s.name === 'Wrapper');
      expect(wrapper).toBeDefined();

      const processor = result.symbols.find(s => s.kind === 'struct' && s.name === 'DataProcessor');
      expect(processor).toBeDefined();

      // Check for builder pattern
      const configBuilder = result.symbols.find(s => s.kind === 'struct' && s.name === 'ConfigBuilder');
      expect(configBuilder).toBeDefined();

      // Check for traits
      const cloneable = result.symbols.find(s => s.kind === 'interface' && s.name === 'Cloneable');
      expect(cloneable).toBeDefined();

      const resettable = result.symbols.find(s => s.kind === 'interface' && s.name === 'Resettable');
      expect(resettable).toBeDefined();

      // Check for type aliases
      const appResult = result.symbols.find(s => s.kind === 'type' && s.name === 'AppResult');
      expect(appResult).toBeDefined();

      const callback = result.symbols.find(s => s.kind === 'type' && s.name === 'Callback');
      expect(callback).toBeDefined();
    });
  });

  describe('performance', () => {
    it('should parse large files efficiently', () => {
      // Generate a large Rust file with 50 structs
      const structs = Array.from({ length: 50 }, (_, i) => `
pub struct Struct${i} {
    field1: i32,
    field2: String,
    field3: f64,
}

impl Struct${i} {
    pub fn new() -> Self {
        Struct${i} {
            field1: ${i},
            field2: String::from("test"),
            field3: ${i}.0,
        }
    }

    pub fn get_field1(&self) -> i32 {
        self.field1
    }
}
`).join('\n');

      const start = Date.now();
      const result = parser.parse(structs);
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);

      // Should extract all structs
      const extractedStructs = result.symbols.filter(s => s.kind === 'struct');
      expect(extractedStructs).toHaveLength(50);
    });
  });
});
