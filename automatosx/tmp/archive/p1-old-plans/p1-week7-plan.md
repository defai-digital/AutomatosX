# Phase 1 Week 7 Plan - Rust Parser & Configuration Enhancements

**Status**: Planned 📋
**Timeline**: Week 7 of P1 (Days 1-5)
**Date**: 2025-11-06
**Goal**: Add Rust language support + Enhanced configuration system with validation

---

## Week 7 Overview

### Primary Objectives
1. **Rust Parser Integration** (Days 1-3) - Add tree-sitter-rust with trait/impl/mod support
2. **Configuration Enhancements** (Days 4-5) - Add validation CLI, language-specific configs, init command

### Success Metrics
- Rust symbol extraction accuracy > 95%
- 4 languages fully supported (TS, Python, Go, Rust)
- Configuration validation catches 100% of schema errors
- Config loading with validation < 20ms
- All existing functionality maintained

---

## Day 1: Rust Parser - Part 1 (Setup & Basic Symbols)

**Goal**: Install tree-sitter-rust and extract basic Rust symbols (fn, struct, enum, trait)

### Tasks

#### 1. Install Dependencies (15 min)
```bash
npm install tree-sitter-rust@^0.21.0
```

**package.json**:
```json
{
  "dependencies": {
    "tree-sitter": "^0.21.1",
    "tree-sitter-typescript": "^0.23.2",
    "tree-sitter-python": "^0.21.0",
    "tree-sitter-go": "^0.21.0",
    "tree-sitter-rust": "^0.21.0"
  }
}
```

#### 2. Create RustParserService (4 hours)
**Objective**: Implement Rust parser with unique Rust constructs

**Implementation**:
```typescript
// src/parser/RustParserService.ts

import Parser from 'tree-sitter';
import Rust from 'tree-sitter-rust';
import { BaseLanguageParser, Symbol, SymbolKind } from './LanguageParser.js';

/**
 * RustParserService - Extracts symbols from Rust source code
 *
 * Rust-specific symbol types:
 * - fn (functions)
 * - struct (structs)
 * - enum (enums)
 * - trait (traits)
 * - impl (implementations)
 * - mod (modules)
 * - const (constants)
 * - static (static variables)
 */
export class RustParserService extends BaseLanguageParser {
  readonly language = 'rust';
  readonly extensions = ['.rs'];

  constructor() {
    super(Rust);
  }

  /**
   * Extract symbol from AST node
   */
  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_item':
        return this.extractFunction(node);

      case 'struct_item':
        return this.extractStruct(node);

      case 'enum_item':
        return this.extractEnum(node);

      case 'trait_item':
        return this.extractTrait(node);

      case 'impl_item':
        return this.extractImpl(node);

      case 'mod_item':
        return this.extractMod(node);

      case 'const_item':
        return this.extractConst(node);

      case 'static_item':
        return this.extractStatic(node);

      default:
        return null;
    }
  }

  /**
   * Extract function declaration
   * Example: fn main() { ... }
   *          pub fn helper(x: i32) -> String { ... }
   */
  private extractFunction(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    // Check if this is a method inside impl block
    if (this.isInsideImpl(node)) {
      return this.createSymbol(node, name, 'method');
    }

    return this.createSymbol(node, name, 'function');
  }

  /**
   * Extract struct declaration
   * Example:
   *   struct User { name: String, age: u32 }
   *   pub struct Point(i32, i32);
   */
  private extractStruct(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'struct');
  }

  /**
   * Extract enum declaration
   * Example:
   *   enum Status { Active, Inactive }
   *   pub enum Result<T, E> { Ok(T), Err(E) }
   */
  private extractEnum(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'enum');
  }

  /**
   * Extract trait declaration
   * Example:
   *   trait Display { fn fmt(&self) -> String; }
   *   pub trait Iterator { type Item; fn next(&mut self) -> Option<Self::Item>; }
   */
  private extractTrait(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'trait');
  }

  /**
   * Extract impl block
   * Example:
   *   impl User { fn new() -> Self { ... } }
   *   impl Display for User { ... }
   *
   * Note: We create a symbol for the impl itself (for indexing),
   * but methods inside will be extracted separately
   */
  private extractImpl(node: Parser.SyntaxNode): Symbol | null {
    // Get the type being implemented
    const typeNode = node.childForFieldName('type');
    if (!typeNode) return null;

    const typeName = typeNode.text;

    // Check if this is a trait impl
    const traitNode = node.childForFieldName('trait');
    const symbolName = traitNode
      ? `impl ${traitNode.text} for ${typeName}`
      : `impl ${typeName}`;

    // Create a special "impl" kind symbol
    // Note: This is Rust-specific, we'll need to extend SymbolKind
    return {
      name: symbolName,
      kind: 'class', // Use 'class' kind for impls (closest semantic match)
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    };
  }

  /**
   * Extract module declaration
   * Example:
   *   mod utils;
   *   pub mod config { ... }
   */
  private extractMod(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'module');
  }

  /**
   * Extract const declaration
   * Example: const MAX_SIZE: usize = 100;
   */
  private extractConst(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'constant');
  }

  /**
   * Extract static variable
   * Example: static GLOBAL_CONFIG: Config = Config::default();
   */
  private extractStatic(node: Parser.SyntaxNode): Symbol | null {
    const name = this.getFieldText(node, 'name');
    if (!name) return null;

    return this.createSymbol(node, name, 'variable');
  }

  /**
   * Check if a node is inside an impl block
   */
  private isInsideImpl(node: Parser.SyntaxNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === 'impl_item') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Override walkTree to handle Rust-specific patterns
   */
  protected walkTree(node: Parser.SyntaxNode, symbols: Symbol[]): void {
    // Extract symbol based on node type
    const symbol = this.extractSymbol(node);
    if (symbol) {
      symbols.push(symbol);
    }

    // Walk into children
    for (const child of node.children) {
      this.walkTree(child, symbols);
    }
  }
}
```

#### 3. Register Rust Parser (15 min)
```typescript
// src/parser/ParserRegistry.ts

import { RustParserService } from './RustParserService.js';

export class ParserRegistry {
  private registerDefaultParsers(): void {
    this.registerParser(new TypeScriptParserService());
    this.registerParser(new PythonParserService());
    this.registerParser(new GoParserService());
    this.registerParser(new RustParserService()); // NEW
  }
}
```

#### 4. Basic Tests (2 hours)
```typescript
// src/parser/__tests__/RustParserService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { RustParserService } from '../RustParserService.js';

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

  describe('function parsing', () => {
    it('should extract function declarations', () => {
      const code = `
fn main() {
    println!("Hello, world!");
}

fn helper(x: i32) -> i32 {
    x + 1
}

pub fn public_func() {}
`;

      const result = parser.parse(code);

      const functions = result.symbols.filter(s => s.kind === 'function');
      expect(functions).toHaveLength(3);

      const funcNames = functions.map(s => s.name);
      expect(funcNames).toContain('main');
      expect(funcNames).toContain('helper');
      expect(funcNames).toContain('public_func');
    });
  });

  describe('struct parsing', () => {
    it('should extract struct declarations', () => {
      const code = `
struct User {
    name: String,
    age: u32,
}

pub struct Point(i32, i32);

struct Empty;
`;

      const result = parser.parse(code);

      const structs = result.symbols.filter(s => s.kind === 'struct');
      expect(structs).toHaveLength(3);

      const structNames = structs.map(s => s.name);
      expect(structNames).toContain('User');
      expect(structNames).toContain('Point');
      expect(structNames).toContain('Empty');
    });
  });

  describe('enum parsing', () => {
    it('should extract enum declarations', () => {
      const code = `
enum Status {
    Active,
    Inactive,
    Pending,
}

pub enum Result<T, E> {
    Ok(T),
    Err(E),
}
`;

      const result = parser.parse(code);

      const enums = result.symbols.filter(s => s.kind === 'enum');
      expect(enums).toHaveLength(2);

      const enumNames = enums.map(s => s.name);
      expect(enumNames).toContain('Status');
      expect(enumNames).toContain('Result');
    });
  });

  describe('trait parsing', () => {
    it('should extract trait declarations', () => {
      const code = `
trait Display {
    fn fmt(&self) -> String;
}

pub trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}
`;

      const result = parser.parse(code);

      const traits = result.symbols.filter(s => s.kind === 'trait');
      expect(traits).toHaveLength(2);

      const traitNames = traits.map(s => s.name);
      expect(traitNames).toContain('Display');
      expect(traitNames).toContain('Iterator');
    });
  });
});
```

**Success Criteria**:
- ✅ tree-sitter-rust installed
- ✅ RustParserService extracts functions, structs, enums, traits
- ✅ Basic tests passing (12+ tests)
- ✅ Build successful

---

## Day 2: Rust Parser - Part 2 (Impl Blocks & Methods)

**Goal**: Complete Rust parser with impl blocks and methods

### Tasks

#### 1. Impl Block Tests (2 hours)
```typescript
describe('impl parsing', () => {
  it('should extract impl blocks', () => {
    const code = `
struct User {
    name: String,
}

impl User {
    fn new(name: String) -> Self {
        User { name }
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}
`;

    const result = parser.parse(code);

    // Should have: User struct, impl block, 2 methods
    expect(result.symbols.length).toBeGreaterThanOrEqual(4);

    const implBlocks = result.symbols.filter(s => s.name.startsWith('impl'));
    expect(implBlocks).toHaveLength(1);
    expect(implBlocks[0].name).toBe('impl User');

    const methods = result.symbols.filter(s => s.kind === 'method');
    expect(methods).toHaveLength(2);
    expect(methods.map(m => m.name)).toContain('new');
    expect(methods.map(m => m.name)).toContain('get_name');
  });

  it('should extract trait implementations', () => {
    const code = `
struct User {
    name: String,
}

impl Display for User {
    fn fmt(&self, f: &mut Formatter) -> Result {
        write!(f, "{}", self.name)
    }
}
`;

    const result = parser.parse(code);

    const implBlocks = result.symbols.filter(s => s.name.includes('impl'));
    expect(implBlocks.some(i => i.name.includes('Display for User'))).toBe(true);
  });
});
```

#### 2. Module & Constant Tests (1.5 hours)
```typescript
describe('module parsing', () => {
  it('should extract module declarations', () => {
    const code = `
mod utils;

pub mod config {
    pub const DEFAULT_PORT: u16 = 8080;
}

mod internal {
    fn helper() {}
}
`;

    const result = parser.parse(code);

    const modules = result.symbols.filter(s => s.kind === 'module');
    expect(modules.length).toBeGreaterThanOrEqual(2);

    const moduleNames = modules.map(s => s.name);
    expect(moduleNames).toContain('utils');
    expect(moduleNames).toContain('config');
  });
});

describe('constant parsing', () => {
  it('should extract const declarations', () => {
    const code = `
const MAX_SIZE: usize = 100;
pub const VERSION: &str = "1.0.0";
`;

    const result = parser.parse(code);

    const constants = result.symbols.filter(s => s.kind === 'constant');
    expect(constants).toHaveLength(2);

    const constNames = constants.map(s => s.name);
    expect(constNames).toContain('MAX_SIZE');
    expect(constNames).toContain('VERSION');
  });

  it('should extract static variables', () => {
    const code = `
static GLOBAL_CONFIG: Config = Config::default();
pub static mut COUNTER: u32 = 0;
`;

    const result = parser.parse(code);

    const statics = result.symbols.filter(s => s.kind === 'variable');
    expect(statics).toHaveLength(2);
  });
});
```

#### 3. Complex Rust Code Test (2 hours)
```typescript
describe('complex Rust code', () => {
  it('should handle real-world Rust code', () => {
    const code = `
use std::fmt::{Display, Formatter, Result};

pub struct Server {
    port: u16,
    host: String,
}

impl Server {
    pub fn new(port: u16, host: String) -> Self {
        Server { port, host }
    }

    pub fn start(&self) -> Result<(), std::io::Error> {
        println!("Server starting on {}:{}", self.host, self.port);
        Ok(())
    }
}

impl Display for Server {
    fn fmt(&self, f: &mut Formatter) -> Result {
        write!(f, "Server({}:{})", self.host, self.port)
    }
}

pub trait Handler {
    fn handle(&self, request: &Request) -> Response;
}

pub enum Status {
    Ok,
    Error(String),
}

pub const DEFAULT_PORT: u16 = 8080;

pub mod utils {
    pub fn helper() -> String {
        String::from("helper")
    }
}
`;

    const result = parser.parse(code);

    // Should extract: Server struct, 2 methods, 1 function (new), 2 impl blocks,
    // Handler trait, Status enum, DEFAULT_PORT const, utils module, helper function
    expect(result.symbols.length).toBeGreaterThanOrEqual(9);

    // Verify key symbols
    const structs = result.symbols.filter(s => s.kind === 'struct');
    expect(structs.some(s => s.name === 'Server')).toBe(true);

    const traits = result.symbols.filter(s => s.kind === 'trait');
    expect(traits.some(s => s.name === 'Handler')).toBe(true);

    const enums = result.symbols.filter(s => s.kind === 'enum');
    expect(enums.some(s => s.name === 'Status')).toBe(true);

    const constants = result.symbols.filter(s => s.kind === 'constant');
    expect(constants.some(s => s.name === 'DEFAULT_PORT')).toBe(true);

    const modules = result.symbols.filter(s => s.kind === 'module');
    expect(modules.some(s => s.name === 'utils')).toBe(true);
  });
});
```

#### 4. End-to-End Integration Test (1.5 hours)
```typescript
// src/services/__tests__/FileService-Rust.test.ts

import { describe, it, expect } from 'vitest';
import { FileService } from '../FileService.js';

let counter = 0;
const u = (name: string) => `/test-rust-${Date.now()}-${++counter}-${name}`;

describe('FileService - Rust Integration', () => {
  const fileService = new FileService();

  it('should index Rust file with structs and traits', () => {
    const code = `
pub struct User {
    name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }
}

pub trait Display {
    fn display(&self) -> String;
}
`;

    const filePath = u('user.rs');
    const result = fileService.indexFile(filePath, code);

    expect(result.symbolCount).toBeGreaterThanOrEqual(4); // User struct, impl, new method, Display trait

    const file = fileService.getFileWithSymbols(filePath);
    expect(file).not.toBeNull();
    expect(file!.language).toBe('rust');

    const symbolNames = file!.symbols.map(s => s.name);
    expect(symbolNames).toContain('User');
    expect(symbolNames).toContain('new');
    expect(symbolNames).toContain('Display');
  });

  it('should index multi-language project (TS + Python + Go + Rust)', () => {
    const tsCode = 'export class TSClass {}';
    const pyCode = 'class PyClass:\n    pass';
    const goCode = 'package main\n\ntype GoStruct struct {}';
    const rsCode = 'pub struct RustStruct {}';

    fileService.indexFile(u('file.ts'), tsCode);
    fileService.indexFile(u('file.py'), pyCode);
    fileService.indexFile(u('file.go'), goCode);
    fileService.indexFile(u('file.rs'), rsCode);

    const stats = fileService.getStats();

    // Should have symbols from all 4 languages
    expect(stats.totalSymbols).toBeGreaterThanOrEqual(4);
  });

  it('should search Rust symbols with filters', () => {
    const code = `
pub struct User {}
pub fn create_user() -> User { User {} }
`;

    fileService.indexFile(u('user.rs'), code);

    // Search with language filter
    const results = fileService.search('lang:rust User');

    expect(results.results.length).toBeGreaterThan(0);
    results.results.forEach(r => {
      expect(r.file_path).toMatch(/\.rs$/);
    });
  });
});
```

**Success Criteria**:
- ✅ Rust parser handles impl blocks and trait impls
- ✅ Rust parser extracts modules and constants
- ✅ Comprehensive tests (25+ Rust parser tests)
- ✅ End-to-end integration working
- ✅ **4 languages fully supported (TS, Python, Go, Rust)**

---

## Day 3: Rust Parser - Part 3 (Optimization & Edge Cases)

**Goal**: Handle Rust edge cases and optimize parser performance

### Tasks

#### 1. Lifetime & Generic Handling (1.5 hours)
```typescript
describe('advanced Rust features', () => {
  it('should handle generics', () => {
    const code = `
pub struct Wrapper<T> {
    value: T,
}

impl<T> Wrapper<T> {
    pub fn new(value: T) -> Self {
        Wrapper { value }
    }
}

pub fn swap<T>(a: &mut T, b: &mut T) {
    std::mem::swap(a, b);
}
`;

    const result = parser.parse(code);

    const structs = result.symbols.filter(s => s.kind === 'struct');
    expect(structs.some(s => s.name === 'Wrapper')).toBe(true);

    const functions = result.symbols.filter(s => s.kind === 'function');
    expect(functions.some(s => s.name === 'swap')).toBe(true);
  });

  it('should handle lifetimes', () => {
    const code = `
pub struct Ref<'a> {
    data: &'a str,
}

pub fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
`;

    const result = parser.parse(code);

    expect(result.symbols.some(s => s.name === 'Ref')).toBe(true);
    expect(result.symbols.some(s => s.name === 'longest')).toBe(true);
  });
});
```

#### 2. Macro Handling (1 hour)
```typescript
describe('macro handling', () => {
  it('should skip macro definitions', () => {
    const code = `
macro_rules! create_function {
    ($func_name:ident) => {
        fn $func_name() {
            println!("Called {}", stringify!($func_name));
        }
    };
}

create_function!(foo);
create_function!(bar);

pub fn real_function() {}
`;

    const result = parser.parse(code);

    // Should extract real_function but not macro-generated ones
    const functions = result.symbols.filter(s => s.kind === 'function');
    expect(functions.some(s => s.name === 'real_function')).toBe(true);
  });
});
```

#### 3. Performance Optimization (2 hours)
- Profile parser on large Rust files
- Optimize symbol extraction
- Add caching for repeated patterns

#### 4. Documentation (30 min)
- Document Rust-specific symbol kinds
- Add examples to README
- Update language support matrix

**Success Criteria**:
- ✅ Handles generics and lifetimes
- ✅ Parses large Rust files (1000+ lines) in < 100ms
- ✅ All edge case tests passing
- ✅ Rust language documentation complete

---

## Day 4: Configuration Enhancements - Part 1

**Goal**: Add configuration validation CLI and language-specific configs

### Tasks

#### 1. Language-Specific Configuration (2 hours)
```typescript
// src/types/schemas/config.ts

export const LanguageConfigSchema = z.object({
  enabled: z.boolean().default(true),
  extensions: z.array(z.string()),
  symbolKinds: z.array(z.string()).optional(),
  maxFileSize: z.number().optional(), // bytes
});

export const LanguagesConfigSchema = z.object({
  typescript: LanguageConfigSchema.default({
    enabled: true,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  }),
  python: LanguageConfigSchema.default({
    enabled: true,
    extensions: ['.py', '.pyi'],
  }),
  go: LanguageConfigSchema.default({
    enabled: true,
    extensions: ['.go'],
  }),
  rust: LanguageConfigSchema.default({
    enabled: true,
    extensions: ['.rs'],
  }),
});

export const ConfigSchema = z.object({
  indexing: IndexingConfigSchema.default({}),
  search: SearchConfigSchema.default({}),
  performance: PerformanceConfigSchema.default({}),
  ui: UIConfigSchema.default({}),
  languages: LanguagesConfigSchema.default({}), // NEW
});
```

#### 2. Config Validation Command (2.5 hours)
```typescript
// src/config/ConfigValidator.ts

import { ConfigSchema, type Config } from '../types/schemas/config.js';
import { ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  config?: Config;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

export class ConfigValidator {
  /**
   * Validate configuration object
   */
  validate(config: unknown): ValidationResult {
    try {
      const validated = ConfigSchema.parse(config);

      const warnings = this.checkWarnings(validated);

      return {
        valid: true,
        config: validated,
        errors: [],
        warnings,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        return {
          valid: false,
          errors,
          warnings: [],
        };
      }

      throw error;
    }
  }

  /**
   * Check for configuration warnings (not errors)
   */
  private checkWarnings(config: Config): Array<{ path: string; message: string }> {
    const warnings: Array<{ path: string; message: string }> = [];

    // Warning: Cache disabled
    if (!config.search.cacheEnabled) {
      warnings.push({
        path: 'search.cacheEnabled',
        message: 'Cache is disabled. This may impact search performance.',
      });
    }

    // Warning: High worker count
    if (config.performance.maxWorkers > 8) {
      warnings.push({
        path: 'performance.maxWorkers',
        message: 'High worker count may cause resource contention.',
      });
    }

    // Warning: Low cache size
    if (config.search.cacheSize < 100) {
      warnings.push({
        path: 'search.cacheSize',
        message: 'Low cache size may reduce cache effectiveness.',
      });
    }

    // Warning: All languages disabled
    const allDisabled = Object.values(config.languages).every(lang => !lang.enabled);
    if (allDisabled) {
      warnings.push({
        path: 'languages',
        message: 'All languages are disabled. No files will be indexed.',
      });
    }

    return warnings;
  }

  /**
   * Validate configuration file
   */
  validateFile(filePath: string): ValidationResult {
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        errors: [{ path: 'file', message: `File not found: ${filePath}`, code: 'FILE_NOT_FOUND' }],
        warnings: [],
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);
      return this.validate(config);
    } catch (error) {
      return {
        valid: false,
        errors: [{ path: 'file', message: `Invalid JSON: ${error.message}`, code: 'INVALID_JSON' }],
        warnings: [],
      };
    }
  }

  /**
   * Format validation result for display
   */
  formatResult(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✓ Configuration is valid');

      if (result.warnings.length > 0) {
        lines.push('\nWarnings:');
        result.warnings.forEach(warning => {
          lines.push(`  - ${warning.path}: ${warning.message}`);
        });
      }
    } else {
      lines.push('✗ Configuration is invalid\n');
      lines.push('Errors:');
      result.errors.forEach(error => {
        lines.push(`  - ${error.path}: ${error.message}`);
      });
    }

    return lines.join('\n');
  }
}
```

#### 3. Config Init Command (1.5 hours)
```typescript
// src/config/ConfigInitializer.ts

export interface InitOptions {
  outputPath: string;
  interactive?: boolean;
  language?: string[];
  minimal?: boolean;
}

export class ConfigInitializer {
  /**
   * Initialize configuration file
   */
  init(options: InitOptions): void {
    const fs = require('fs');
    const path = require('path');

    // Check if file already exists
    if (fs.existsSync(options.outputPath)) {
      throw new Error(`Configuration file already exists: ${options.outputPath}`);
    }

    // Generate config based on options
    const config = this.generateConfig(options);

    // Ensure directory exists
    const dir = path.dirname(options.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(options.outputPath, JSON.stringify(config, null, 2));
  }

  /**
   * Generate configuration based on options
   */
  private generateConfig(options: InitOptions): Partial<Config> {
    if (options.minimal) {
      return {
        indexing: {
          extensions: ['.ts', '.js', '.py', '.go', '.rs'],
          ignored: ['node_modules', '.git'],
        },
      };
    }

    const config: Partial<Config> = {
      indexing: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'],
        ignored: ['node_modules', '.git', 'dist', 'build', 'target'],
        concurrency: 3,
        batchSize: 100,
      },
      search: {
        cacheEnabled: true,
        cacheSize: 1000,
        cacheTTL: 300000,
        semanticEnabled: false,
      },
      performance: {
        compression: false,
        parallelIndexing: true,
        maxWorkers: 4,
      },
      ui: {
        progressBars: true,
        colorOutput: true,
        verboseErrors: false,
      },
      languages: {
        typescript: { enabled: true, extensions: ['.ts', '.tsx', '.js', '.jsx'] },
        python: { enabled: true, extensions: ['.py', '.pyi'] },
        go: { enabled: true, extensions: ['.go'] },
        rust: { enabled: true, extensions: ['.rs'] },
      },
    };

    // Filter languages if specified
    if (options.language && options.language.length > 0) {
      const enabledLangs = new Set(options.language);
      Object.keys(config.languages!).forEach(lang => {
        config.languages![lang].enabled = enabledLangs.has(lang);
      });
    }

    return config;
  }
}
```

**Success Criteria**:
- ✅ Language-specific configs implemented
- ✅ Config validation command working
- ✅ Config init command working
- ✅ Validation catches 100% of schema errors

---

## Day 5: Configuration Enhancements - Part 2

**Goal**: Complete configuration system with tests and documentation

### Tasks

#### 1. Configuration Tests (3 hours)
```typescript
// src/config/__tests__/ConfigValidator.test.ts

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validation', () => {
    it('should validate correct configuration', () => {
      const config = {
        indexing: { concurrency: 3 },
        search: { cacheEnabled: true },
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should catch invalid concurrency', () => {
      const config = {
        indexing: { concurrency: 20 }, // Max is 16
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path.includes('concurrency'))).toBe(true);
    });

    it('should catch invalid cache TTL', () => {
      const config = {
        search: { cacheTTL: 5000 }, // Min is 10000
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(false);
    });

    it('should provide warnings for suboptimal config', () => {
      const config = {
        search: { cacheEnabled: false },
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.path === 'search.cacheEnabled')).toBe(true);
    });

    it('should validate language-specific configs', () => {
      const config = {
        languages: {
          typescript: { enabled: true, extensions: ['.ts'] },
          python: { enabled: false },
        },
      };

      const result = validator.validate(config);

      expect(result.valid).toBe(true);
      expect(result.config!.languages.typescript.enabled).toBe(true);
      expect(result.config!.languages.python.enabled).toBe(false);
    });
  });

  describe('file validation', () => {
    it('should validate valid config file', () => {
      const tempPath = '/tmp/test-config.json';
      fs.writeFileSync(tempPath, JSON.stringify({ indexing: {} }));

      const result = validator.validateFile(tempPath);

      expect(result.valid).toBe(true);

      fs.unlinkSync(tempPath);
    });

    it('should catch missing file', () => {
      const result = validator.validateFile('/nonexistent.json');

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('FILE_NOT_FOUND');
    });

    it('should catch invalid JSON', () => {
      const tempPath = '/tmp/invalid.json';
      fs.writeFileSync(tempPath, '{ invalid json }');

      const result = validator.validateFile(tempPath);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_JSON');

      fs.unlinkSync(tempPath);
    });
  });
});

// src/config/__tests__/ConfigInitializer.test.ts

describe('ConfigInitializer', () => {
  let initializer: ConfigInitializer;

  beforeEach(() => {
    initializer = new ConfigInitializer();
  });

  it('should create minimal config', () => {
    const tempPath = '/tmp/minimal-config.json';

    initializer.init({
      outputPath: tempPath,
      minimal: true,
    });

    expect(fs.existsSync(tempPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    expect(content.indexing).toBeDefined();
    expect(content.search).toBeUndefined(); // Minimal doesn't include all sections

    fs.unlinkSync(tempPath);
  });

  it('should create full config', () => {
    const tempPath = '/tmp/full-config.json';

    initializer.init({
      outputPath: tempPath,
    });

    const content = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));

    expect(content.indexing).toBeDefined();
    expect(content.search).toBeDefined();
    expect(content.performance).toBeDefined();
    expect(content.ui).toBeDefined();
    expect(content.languages).toBeDefined();

    fs.unlinkSync(tempPath);
  });

  it('should filter languages when specified', () => {
    const tempPath = '/tmp/lang-filtered-config.json';

    initializer.init({
      outputPath: tempPath,
      language: ['typescript', 'python'],
    });

    const content = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));

    expect(content.languages.typescript.enabled).toBe(true);
    expect(content.languages.python.enabled).toBe(true);
    expect(content.languages.go.enabled).toBe(false);
    expect(content.languages.rust.enabled).toBe(false);

    fs.unlinkSync(tempPath);
  });

  it('should throw if file already exists', () => {
    const tempPath = '/tmp/existing-config.json';
    fs.writeFileSync(tempPath, '{}');

    expect(() => {
      initializer.init({ outputPath: tempPath });
    }).toThrow('already exists');

    fs.unlinkSync(tempPath);
  });
});
```

#### 2. Update Documentation (1.5 hours)
```markdown
# Configuration Guide

## Creating Configuration

### Initialize new config
```bash
# Create full configuration
ax config init

# Create minimal configuration
ax config init --minimal

# Create config for specific languages
ax config init --languages typescript,python
```

### Validate configuration
```bash
# Validate .axrc.json
ax config validate

# Validate specific file
ax config validate path/to/config.json
```

## Configuration Schema

### Indexing
- `extensions`: File extensions to index
- `ignored`: Directories to ignore
- `concurrency`: Parallel file processing (1-16)
- `batchSize`: Batch insert size (10-1000)

### Search
- `cacheEnabled`: Enable query caching
- `cacheSize`: Maximum cache entries (100-10000)
- `cacheTTL`: Cache time-to-live in ms (10000-3600000)
- `semanticEnabled`: Enable ML-based reranking

### Languages
Each language can be configured individually:
- `enabled`: Enable/disable language
- `extensions`: File extensions for this language
- `symbolKinds`: Specific symbol types to extract (optional)
- `maxFileSize`: Skip files larger than this (optional)

## Examples

### TypeScript/JavaScript only
```json
{
  "languages": {
    "typescript": { "enabled": true },
    "python": { "enabled": false },
    "go": { "enabled": false },
    "rust": { "enabled": false }
  }
}
```

### High-performance config
```json
{
  "indexing": {
    "concurrency": 8,
    "batchSize": 500
  },
  "search": {
    "cacheSize": 5000,
    "cacheTTL": 600000
  },
  "performance": {
    "maxWorkers": 8,
    "parallelIndexing": true
  }
}
```
```

#### 3. Integration with Existing Code (30 min)
- Update ConfigLoader to use validator
- Add language filtering to ParserRegistry
- Integrate language configs into FileService

#### 4. Final Testing & Cleanup (30 min)
- Run full test suite
- Verify all 4 languages working
- Update main README

**Success Criteria**:
- ✅ 15+ configuration tests passing
- ✅ Config validation CLI working
- ✅ Config init CLI working
- ✅ Documentation complete
- ✅ Configuration loading < 20ms

---

## Week 7 Deliverables

### Code (12 new files)
1. `src/parser/RustParserService.ts` - Rust parser
2. `src/parser/__tests__/RustParserService.test.ts` - Rust parser tests
3. `src/services/__tests__/FileService-Rust.test.ts` - Rust integration tests
4. `src/config/ConfigValidator.ts` - Config validator
5. `src/config/ConfigInitializer.ts` - Config initializer
6. `src/config/__tests__/ConfigValidator.test.ts` - Validator tests
7. `src/config/__tests__/ConfigInitializer.test.ts` - Initializer tests
8. `docs/configuration-guide.md` - Configuration documentation
9. Updated: `src/types/schemas/config.ts` - Language configs

### Tests
- 25+ Rust parser tests
- 15+ configuration tests
- 3+ Rust integration tests
- **Target: 155 → 200+ total tests**

### Features
- Rust language support (4 languages total: TS, Python, Go, Rust)
- Configuration validation CLI
- Configuration initialization CLI
- Language-specific configuration
- Enhanced configuration warnings

---

## Success Metrics

| Metric | Week 6 Target | Week 7 Target | Measurement |
|--------|---------------|---------------|-------------|
| Supported languages | 3 (TS, Python, Go) | 4 (+ Rust) | Parser count |
| Rust extraction accuracy | N/A | > 95% | Manual validation |
| Config validation errors | N/A | 100% caught | Test coverage |
| Config loading time | < 10ms | < 20ms | Benchmark |
| Total tests | 155 | 200+ | Test count |

---

## Risk Mitigation

### Medium Risks
1. **Rust parser complexity** - Rust has unique features (traits, impl, lifetimes)
   - Mitigation: Incremental implementation, focus on core constructs first
   - Defer advanced features (macros, unsafe) to P1.1

2. **Config validation overhead** - Zod validation could add latency
   - Mitigation: Benchmark validation, cache parsed schemas
   - Validation only runs on config load, not on every query

### Low Risks
1. **tree-sitter-rust API changes** - Using stable version 0.21.0
2. **Config breaking changes** - Strict schema versioning
3. **Language-specific edge cases** - Comprehensive test coverage

---

## Week 8 Preview (Semantic Reranking)

### ML Integration
- Research ML library options (@xenova/transformers vs Python subprocess)
- Implement embedding generation
- Build hybrid BM25 + semantic scoring
- Add `--semantic` flag to search

**Preparation**:
- Research sentence transformer models
- Evaluate ONNX runtime performance
- Plan embedding cache strategy

---

## Daily Execution Checklist

### Day 1
- [ ] Install tree-sitter-rust
- [ ] Implement RustParserService (fn, struct, enum, trait)
- [ ] Write 12+ basic tests
- [ ] All tests passing

### Day 2
- [ ] Add impl block and method parsing
- [ ] Add module and constant parsing
- [ ] Write 13+ advanced tests
- [ ] Create end-to-end Rust integration test

### Day 3
- [ ] Handle generics and lifetimes
- [ ] Test edge cases
- [ ] Optimize parser performance
- [ ] Update documentation

### Day 4
- [ ] Add language-specific configs to schema
- [ ] Implement ConfigValidator
- [ ] Implement ConfigInitializer
- [ ] Test validation and init

### Day 5
- [ ] Write 15+ config tests
- [ ] Update documentation
- [ ] Integrate with existing code
- [ ] Full test suite passing

---

**Total Estimated Time**: ~22 hours over 5 days
**Expected Test Count**: 200+ tests (155 current + 45 Week 7)
**Expected Outcome**: 4 languages, config validation/init, comprehensive config system
