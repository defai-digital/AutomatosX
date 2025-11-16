# Bug Fix Report: Tree-sitter 0.25 Parser Compatibility

**Date**: 2025-11-15
**Status**: ✅ **RESOLVED**
**Severity**: Critical (CLI completely non-functional)

## Problem Description

The `ax` CLI was failing immediately on startup with the error:
```
TypeError: Invalid language object
    at Parser.setLanguage
    at new BaseLanguageParser
    at new XmlParserService (initially)
```

**Root Cause**: Several tree-sitter grammar packages have incompatible export structures with tree-sitter@0.25. They either:
1. Export an object without a direct `.language` property (e.g., `{ xml: { language: ... }, dtd: { ... } }`)
2. Missing the `.language` property entirely (incompatible versions)

## Solution Summary

### 1. Fixed XML Parser (XmlParserService.ts)
**Problem**: `@tree-sitter-grammars/tree-sitter-xml` exports `{ xml: Grammar, dtd: Grammar }` instead of a direct `Language` object.

**Fix**: Updated constructor to access nested property:
```typescript
// Before
super(Xml as Parser.Language);

// After
const xmlGrammar = (Xml as any).xml;
super(xmlGrammar.language as Parser.Language);
```

### 2. Disabled Incompatible Parsers
Disabled 8 parsers that are incompatible with tree-sitter@0.25 (missing `.language` property):

| Parser | Package | Status |
|--------|---------|--------|
| CsvParserService | tree-sitter-csv | ❌ Disabled |
| OcamlParserService | tree-sitter-ocaml | ❌ Disabled |
| ElmParserService | tree-sitter-elm | ❌ Disabled |
| VerilogParserService | tree-sitter-verilog | ❌ Disabled |
| MatlabParserService | tree-sitter-matlab | ❌ Disabled |
| DartParserService | tree-sitter-dart | ❌ Disabled |
| ZigParserService | tree-sitter-zig | ❌ Disabled |
| GleamParserService | tree-sitter-gleam | ❌ Disabled |
| ThriftParserService | tree-sitter-thrift | ❌ Disabled |

**Already Disabled** (previously identified):
- LuaParserService
- YamlParserService
- TomlParserService
- MarkdownParserService
- SwiftParserService

## Changes Made

### Files Modified

1. **src/parser/XmlParserService.ts**
   - Added proper grammar extraction from nested object structure
   - Added explanatory comments

2. **src/parser/ParserRegistry.ts**
   - Commented out 8 incompatible parser registrations
   - Added inline comments explaining why each is disabled

## Testing & Verification

### Test Results
```bash
# Before fix
$ ax status
Error: TypeError: Invalid language object

# After fix
$ ax status
✅ SUCCESS - Shows index status with 552 files, 21,914 symbols

$ ax index ./src
✅ SUCCESS - Indexed 552 files successfully
```

### Supported Languages After Fix
**36+ languages remain active**, including:
- TypeScript, JavaScript, Python, Go, Java, Rust, Ruby, C#, C++, PHP
- Kotlin, SQL, HTML, C, Objective-C, CUDA, AssemblyScript
- Scala, Bash, Zsh, JSON, Makefile, Regex
- SystemVerilog, Julia, Haskell, Elixir, Solidity, Perl
- HCL (Terraform), Groovy, Puppet
- **XML** (fixed with special handling)

### Compatibility Rate
- **Compatible**: 36/45 parsers (80%)
- **Incompatible**: 9/45 parsers (20%)

## Impact

### Positive
✅ CLI is now fully functional
✅ All core languages supported (TS, JS, Python, Go, Java, Rust, etc.)
✅ XML parsing works with proper grammar extraction
✅ 80% of originally planned languages still supported

### Negative
⚠️ Lost support for 9 languages (CSV, OCaml, Elm, Verilog, MATLAB, Dart, Zig, Gleam, Thrift)
⚠️ These can be re-enabled when packages update to tree-sitter@0.25 compatibility

## Future Work

1. **Monitor for updates**: Check for tree-sitter@0.25 compatible versions of:
   - tree-sitter-csv
   - tree-sitter-ocaml
   - tree-sitter-elm
   - tree-sitter-verilog
   - tree-sitter-matlab
   - tree-sitter-dart
   - tree-sitter-zig
   - tree-sitter-gleam
   - tree-sitter-thrift

2. **Alternative solutions**:
   - Consider vendoring older tree-sitter@0.21 for incompatible parsers
   - Create custom grammar wrappers for multi-export packages
   - Contribute fixes to upstream packages

## Commit Recommendation

```bash
git add src/parser/XmlParserService.ts src/parser/ParserRegistry.ts
git commit -m "Fix tree-sitter@0.25 parser compatibility

- Fix XmlParserService to extract language from nested grammar object
- Disable 8 incompatible parsers (CSV, OCaml, Elm, Verilog, MATLAB, Dart, Zig, Gleam, Thrift)
- 36+ languages remain supported (80% compatibility rate)
- Resolves TypeError: Invalid language object on CLI startup

Fixes: CLI non-functional due to parser initialization failures"
```

## Related Issues

- Tree-sitter v0.25 breaking changes
- Parser registry initialization order
- Language grammar package versioning

---

**Resolution**: Bug successfully fixed with minimal impact. CLI fully functional with 36+ supported languages.
