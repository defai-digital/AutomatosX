# ADR-013: Parser Orchestration and Toolchain Governance

**Status**: Accepted
**Date**: 2025-11-07
**Deciders**: Architecture Team
**Context**: Phase 0-1 (P0/P1) Implementation

---

## Context and Problem Statement

AutomatosX v2 requires code intelligence across multiple programming languages (13+ languages). This necessitates a unified parser orchestration strategy that can:
1. Parse diverse language syntaxes efficiently
2. Extract symbols, definitions, and code structure consistently
3. Scale to support new languages without architectural changes
4. Maintain high performance across large codebases

**Key Questions**:
1. Which parsing technology should we use as the foundation?
2. How do we standardize symbol extraction across different languages?
3. How do we manage parser lifecycle (registration, lookup, caching)?
4. What's the strategy for adding new language support?

---

## Decision Drivers

- **Multi-Language Support**: Must handle 13+ languages with diverse syntaxes
- **Performance**: Fast parsing for large codebases (target: 2000+ files/sec)
- **Extensibility**: Easy to add new languages without core changes
- **Consistency**: Uniform symbol extraction API across all parsers
- **Maintainability**: Clear patterns for parser implementation
- **Ecosystem**: Leverage existing parsing tools where possible
- **Type Safety**: Strong typing for parser APIs

---

## Considered Options

### Option 1: Language-Specific Parsers (No Standardization)

**Approach**: Use native compiler/parser for each language (tsc for TypeScript, babel for JS, rustc for Rust, etc.)

**Pros**:
- Most accurate parsing (official compiler implementations)
- Language-specific features fully supported
- No abstraction overhead

**Cons**:
- ❌ Massive dependency footprint (13+ compiler packages)
- ❌ Inconsistent APIs across languages
- ❌ Performance varies wildly (some compilers are slow)
- ❌ Hard to standardize symbol extraction
- ❌ Difficult to manage dependencies and versioning

**Verdict**: ❌ Rejected - Too complex and inconsistent

### Option 2: Tree-sitter with Unified Abstraction Layer

**Approach**: Use Tree-sitter as the primary parsing engine with a unified `BaseLanguageParser` abstraction

**Pros**:
- ✅ Single parsing technology for all languages
- ✅ Fast, incremental parsing (< 10ms per file)
- ✅ Unified AST traversal API
- ✅ Rich ecosystem (40+ language grammars)
- ✅ Consistent performance characteristics
- ✅ Standardized symbol extraction via base class
- ✅ TypeScript-native bindings

**Cons**:
- Tree-sitter grammars may lag behind language evolution
- Some niche language features might not parse correctly
- Requires grammar compatibility testing

**Verdict**: ✅ **SELECTED**

### Option 3: Hybrid Approach (Tree-sitter + Language-Specific)

**Approach**: Use Tree-sitter for most languages, fallback to native parsers for complex cases

**Pros**:
- Best of both worlds (speed + accuracy)
- Can handle edge cases with native parsers

**Cons**:
- ❌ Significantly more complex to implement
- ❌ Two code paths to maintain
- ❌ Inconsistent performance
- ❌ Testing complexity increases

**Verdict**: ❌ Rejected - Unnecessary complexity for v2

---

## Decision Outcome

**Chosen Option**: **Option 2 - Tree-sitter with Unified Abstraction Layer**

### Architecture

#### 1. Core Abstraction: BaseLanguageParser

**Location**: `src/parser/BaseLanguageParser.ts`

**Purpose**: Abstract base class that all language parsers inherit from

**Key Responsibilities**:
- Initialize Tree-sitter grammar
- Traverse AST nodes
- Extract symbols (functions, classes, methods, variables)
- Compute symbol locations (line, column)
- Generate symbol metadata (signature, docstring)

**Contract**:
```typescript
export abstract class BaseLanguageParser {
  abstract readonly language: string;
  abstract readonly extensions: string[];

  protected abstract extractSymbol(node: Parser.SyntaxNode): Symbol | null;

  public parse(code: string, filePath: string): ParseResult;
  protected createSymbol(node: Parser.SyntaxNode, name: string, kind: SymbolKind): Symbol;
}
```

#### 2. Parser Registry

**Location**: `src/parser/ParserRegistry.ts`

**Purpose**: Central registry for all language parsers

**Key Features**:
- **Dynamic Registration**: `registerParser(parser: BaseLanguageParser)`
- **File Extension Mapping**: `.ts` → TypeScriptParserService
- **Language Lookup**: `getParser('typescript')` → TypeScriptParserService
- **Supported Languages**: `getSupportedExtensions()` → `['.ts', '.py', '.go', ...]`

**Implementation**:
```typescript
export class ParserRegistry {
  private parsers: Map<string, BaseLanguageParser> = new Map();
  private extensionMap: Map<string, string> = new Map();

  public registerParser(parser: BaseLanguageParser): void {
    this.parsers.set(parser.language, parser);
    for (const ext of parser.extensions) {
      this.extensionMap.set(ext, parser.language);
    }
  }

  public getParserForFile(filePath: string): BaseLanguageParser | null {
    const ext = path.extname(filePath);
    const language = this.extensionMap.get(ext);
    return language ? this.parsers.get(language) ?? null : null;
  }
}
```

#### 3. Language-Specific Parser Services

**Pattern**: Each language has a dedicated service class

**Example**: `TypeScriptParserService.ts`, `PythonParserService.ts`, `GoParserService.ts`

**Implementation Pattern**:
```typescript
export class TypeScriptParserService extends BaseLanguageParser {
  readonly language = 'typescript';
  readonly extensions = ['.ts', '.tsx', '.mts', '.cts'];

  constructor() {
    super(TypeScript.tsx); // Tree-sitter grammar
  }

  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    switch (node.type) {
      case 'function_declaration': return this.extractFunction(node);
      case 'class_declaration': return this.extractClass(node);
      case 'interface_declaration': return this.extractInterface(node);
      // ... language-specific node types
    }
  }

  private extractFunction(node: Parser.SyntaxNode): Symbol {
    // TypeScript-specific function extraction
  }
}
```

#### 4. Supported Languages (Phase 1 Complete)

| Language | Parser Service | Extensions | Tree-sitter Grammar | Status |
|----------|----------------|------------|---------------------|--------|
| TypeScript/JavaScript | TypeScriptParserService | .ts, .tsx, .js, .jsx, .mjs, .cjs | tree-sitter-typescript | ✅ |
| Python | PythonParserService | .py, .pyi | tree-sitter-python | ✅ |
| Go | GoParserService | .go | tree-sitter-go | ✅ |
| Java | JavaParserService | .java | tree-sitter-java | ✅ |
| Rust | RustParserService | .rs | tree-sitter-rust | ✅ |
| Ruby | RubyParserService | .rb | tree-sitter-ruby | ✅ |
| C# | CSharpParserService | .cs | tree-sitter-c-sharp | ✅ |
| C++ | CppParserService | .cpp, .cc, .cxx, .hpp, .h | tree-sitter-cpp | ✅ |
| PHP | PhpParserService | .php, .php3, .phtml | tree-sitter-php | ✅ |
| Kotlin | KotlinParserService | .kt, .kts | tree-sitter-kotlin | ✅ |
| Swift | SwiftParserService | .swift | tree-sitter-swift | ✅ |
| SQL | SqlParserService | .sql, .ddl, .dml | tree-sitter-sql (PostgreSQL dialect) | ✅ |
| AssemblyScript | AssemblyScriptParserService | .as.ts | tree-sitter-typescript | ✅ |
| ReScript | RescriptParserService | .res | tree-sitter-rescript | ⚠️ Disabled* |

*ReScript parser disabled due to grammar compatibility issues (Sprint 8)

**Total**: 15 parser services (14 active + 1 disabled)

---

## Parser Lifecycle

### 1. Initialization

```typescript
// On application startup
const registry = new ParserRegistry();

// Register all default parsers
registry.registerParser(new TypeScriptParserService());
registry.registerParser(new PythonParserService());
registry.registerParser(new GoParserService());
// ... etc for all 15 parsers
```

### 2. File Parsing

```typescript
// In IngestionService
const parser = registry.getParserForFile('/path/to/file.ts');
if (parser) {
  const result = parser.parse(fileContent, filePath);
  // result.symbols → Array<Symbol>
  // result.chunks → Array<CodeChunk>
}
```

### 3. Symbol Extraction

**Unified Symbol Type**:
```typescript
interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'variable';
  signature: string;
  startLine: number;
  endLine: number;
  docstring?: string;
}
```

---

## Toolchain Governance

### Version Management

**Dependency Pinning Strategy**:
- Tree-sitter core: `^0.21.0` (peer dependency)
- Language grammars: Exact versions pinned in `package.json`
- Reason: Ensures consistent parsing behavior across environments

**Example** (`package.json`):
```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "0.20.4",
    "tree-sitter-python": "0.20.4",
    "tree-sitter-go": "0.20.0"
  }
}
```

### Grammar Compatibility Testing

**Testing Strategy**:
- Each parser has 18-20 dedicated tests
- Test fixtures cover common patterns and edge cases
- Grammar upgrades require full test suite pass

**Test Pattern** (example):
```typescript
describe('TypeScriptParserService', () => {
  it('should extract function declarations', () => { /* ... */ });
  it('should extract class declarations', () => { /* ... */ });
  it('should extract interface declarations', () => { /* ... */ });
  it('should handle generics', () => { /* ... */ });
  it('should extract JSDoc comments', () => { /* ... */ });
  // ... 15 more tests
});
```

### Adding New Languages

**Sprint-Based Expansion Model** (Proven in Sprints 7-14):

**Step 1: Research**
- Identify Tree-sitter grammar package
- Check grammar maturity and maintenance status
- Test grammar compatibility with sample code

**Step 2: Implementation**
```typescript
// 1. Create parser service
export class NewLanguageParserService extends BaseLanguageParser {
  readonly language = 'newlang';
  readonly extensions = ['.newlang'];

  constructor() {
    super(NewLangGrammar); // Import grammar
  }

  protected extractSymbol(node: Parser.SyntaxNode): Symbol | null {
    // Implement language-specific extraction
  }
}

// 2. Register in ParserRegistry
registry.registerParser(new NewLanguageParserService());

// 3. Add to language detection
const LANGUAGE_MAP = {
  '.newlang': 'newlang',
  // ...
};
```

**Step 3: Testing**
- Create test fixtures (basic + advanced patterns)
- Write 18-20 comprehensive tests
- Ensure 100% test pass rate

**Step 4: Documentation**
- Update README language support section
- Create sprint completion document
- Add to parser service table

**Average Implementation Time**: 2-4 hours per language (proven via Sprints 7-14)

---

## Consequences

### Positive

1. **✅ Unified API**: All parsers use identical interface via `BaseLanguageParser`
2. **✅ Fast Performance**: Tree-sitter provides < 10ms parsing for typical files
3. **✅ Scalability**: Added 11 languages in Sprints 7-14 (2-4 hours each)
4. **✅ Consistency**: Symbol extraction standardized across all languages
5. **✅ Type Safety**: Full TypeScript typing for parser APIs
6. **✅ Testability**: Clear testing pattern (18-20 tests per parser)
7. **✅ Extensibility**: New languages require minimal code (150-250 lines)

### Negative

1. **⚠️ Grammar Limitations**: Some advanced language features may not parse correctly
   - **Mitigation**: Test grammar with real-world code before integration
   - **Example**: ReScript grammar compatibility issues (Sprint 8)

2. **⚠️ Grammar Maintenance**: Dependent on Tree-sitter community for grammar updates
   - **Mitigation**: Pin grammar versions, test before upgrading

3. **⚠️ Learning Curve**: Developers need to understand AST node types
   - **Mitigation**: BaseLanguageParser provides helper methods, comprehensive tests serve as examples

### Neutral

1. **Tree-sitter Dependency**: Core dependency on Tree-sitter ecosystem
   - **Assessment**: Tree-sitter is mature, widely adopted (GitHub uses it)

2. **Node Type Variance**: Each language has different AST node types
   - **Assessment**: Abstracted via `extractSymbol()` method

---

## Performance Characteristics

### Benchmarks (P1 Testing)

| Language | Avg Parse Time | File Size | Symbols Extracted |
|----------|----------------|-----------|-------------------|
| TypeScript | 8ms | 500 LOC | 15-25 symbols |
| Python | 6ms | 400 LOC | 12-20 symbols |
| Go | 7ms | 450 LOC | 10-18 symbols |
| Rust | 9ms | 600 LOC | 20-30 symbols |
| C++ | 12ms | 700 LOC | 25-35 symbols |

**Target Performance**: 2000+ files/sec ingestion rate
**Actual Performance**: Achieved in P1 testing

### Memory Efficiency

- **Parser Reuse**: Single parser instance per language (singleton pattern)
- **AST Disposal**: AST trees discarded after symbol extraction
- **Memory Footprint**: ~10MB per language grammar loaded

---

## Related Decisions

- **ADR-011**: ReScript Integration Strategy - Complements parser system (ReScript parser disabled but foundation exists)
- **ADR-014**: Zod Validation - Parser output validated via Zod schemas

---

## Future Enhancements (P2/P3)

### P2: Optimization
1. **Parallel Parsing**: Parse multiple files concurrently
2. **Incremental Updates**: Update AST only for changed files
3. **Grammar Caching**: Cache compiled grammars in memory

### P3: Advanced Features
1. **Semantic Analysis**: Beyond syntax (type inference, control flow)
2. **Custom Queries**: Tree-sitter queries for pattern matching
3. **Language Server Integration**: LSP support for IDE features

---

## References

- **Tree-sitter Documentation**: https://tree-sitter.github.io/tree-sitter/
- **BaseLanguageParser Implementation**: `src/parser/BaseLanguageParser.ts`
- **ParserRegistry Implementation**: `src/parser/ParserRegistry.ts`
- **Sprint Completion Reports**: `automatosx/tmp/sprints/PHASE-1.0-SPRINT-{7-14}-STATUS.md`
- **P0/P1 Verification**: `automatosx/tmp/P0-P1-VERIFICATION-2025-11-07.md`

---

**Status**: ✅ **Accepted and Implemented**
**Language Support**: 13 active languages (14 parsers + 1 disabled)
**Test Coverage**: 260+ parser tests (18-20 per language)
**Performance**: Exceeds targets (< 10ms per file, 2000+ files/sec)
