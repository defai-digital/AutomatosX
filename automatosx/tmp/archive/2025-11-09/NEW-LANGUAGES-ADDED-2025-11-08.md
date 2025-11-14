# New Languages Added to AutomatosX v2
**Date**: 2025-11-08
**Status**: ✅ COMPLETE

## Summary

Successfully expanded language support from 14 to 30 languages by adding 16 new tree-sitter parsers after upgrading tree-sitter core to 0.25.0.

## Languages Added (16 Total)

### Systems Languages (3)
- ✅ **C** (.c, .h) - Functions, structs, enums, typedefs, variables
- ✅ **Objective-C** (.m, .mm, .h) - Classes, protocols, methods, properties
- ✅ **CUDA** (.cu, .cuh) - Kernels, functions, classes, structs

### JVM Languages (1)
- ✅ **Scala** (.scala, .sc) - Functions, classes, objects, traits, vals, vars

### Shell/Scripting (3)
- ✅ **Lua** (.lua) - Functions, variables, locals
- ✅ **Bash** (.sh, .bash, .zsh) - Functions, variables
- ✅ **Zsh** (.zsh, .zshrc, .zprofile, .zshenv) - Functions, variables

### Config/Data Formats (3)
- ✅ **JSON** (.json, .jsonc, .json5) - Top-level keys
- ✅ **YAML** (.yaml, .yml) - Top-level keys
- ✅ **TOML** (.toml) - Tables and keys

### Documentation (2)
- ✅ **Markdown** (.md, .markdown, .mdown, .mkd) - Headings
- ✅ **CSV** (.csv, .tsv) - Column headers

### Functional Languages (2)
- ✅ **OCaml/ReScript** (.ml, .mli, .res, .resi) - Values, types, modules
- ✅ **Elm** (.elm) - Values, type aliases, types, ports

### DevOps (1)
- ✅ **Makefile** (Makefile, makefile, .mk, GNUmakefile) - Targets, variables

### Utility (1)
- ✅ **Regex** (.regex, .re) - Named groups

## Languages Attempted But Failed (2)

### Failed: Not Available
- ❌ **R** - tree-sitter-r@0.0.1-security is a security placeholder with no actual parser
- ❌ **Dockerfile** - tree-sitter-dockerfile@0.0.1-security is a security placeholder with no actual parser

## GPU Framework Support (Added 2025-11-08)

✅ **AMD ROCm HIP** - Extended CUDA parser to support `.hip`, `.hip.cpp`, `.hip.h`, `.hip.hpp`
✅ **Apple Metal** - Extended C++ parser to support `.metal` shaders
✅ **Apple MLX** - Python API already supported via Python parser

See: `automatosx/tmp/GPU-FRAMEWORK-SUPPORT-2025-11-08.md`

## Complete Language Support Matrix (30 Languages)

| Category | Language | Extensions | Status |
|----------|----------|-----------|--------|
| **JavaScript Ecosystem** | TypeScript | .ts, .tsx | ✅ Existing |
| | JavaScript | .js, .jsx, .mjs, .cjs | ✅ Existing |
| **Modern Systems** | Rust | .rs | ✅ Existing |
| | Go | .go | ✅ Existing |
| | Swift | .swift | ✅ Existing |
| | C | .c, .h | ✅ NEW |
| | C++ | .cpp, .cc, .cxx, .hpp, .h | ✅ Existing |
| | C# | .cs | ✅ Existing |
| | Objective-C | .m, .mm, .h | ✅ NEW |
| | CUDA | .cu, .cuh | ✅ NEW |
| **JVM** | Java | .java | ✅ Existing |
| | Kotlin | .kt, .kts | ✅ Existing |
| | Scala | .scala, .sc | ✅ NEW |
| **Backend** | Python | .py, .pyi | ✅ Existing |
| | Ruby | .rb | ✅ Existing |
| | PHP | .php | ✅ Existing |
| **Shell/Scripting** | Bash | .sh, .bash | ✅ NEW |
| | Zsh | .zsh, .zshrc | ✅ NEW |
| | Lua | .lua | ✅ NEW |
| **Functional** | OCaml/ReScript | .ml, .mli, .res, .resi | ✅ NEW |
| | Elm | .elm | ✅ NEW |
| **Config/Data** | JSON | .json, .jsonc, .json5 | ✅ NEW |
| | YAML | .yaml, .yml | ✅ NEW |
| | TOML | .toml | ✅ NEW |
| | HTML | .html, .htm | ✅ Existing |
| | SQL | .sql | ✅ Existing |
| **Documentation** | Markdown | .md, .markdown | ✅ NEW |
| | CSV | .csv, .tsv | ✅ NEW |
| **DevOps** | Makefile | Makefile, .mk | ✅ NEW |
| **Utility** | Regex | .regex, .re | ✅ NEW |
| **Other** | AssemblyScript | .as.ts | ✅ Existing |

## Technical Implementation

### Grammar Packages Installed (18)
```bash
tree-sitter-c@0.24.1
tree-sitter-objc@3.0.2
tree-sitter-scala@0.24.0
tree-sitter-lua@2.1.3
tree-sitter-bash@0.25.0
tree-sitter-zsh@0.36.0
tree-sitter-json@0.24.8
tree-sitter-yaml@0.5.0
tree-sitter-toml@0.5.1
tree-sitter-markdown@0.7.1
tree-sitter-csv@1.2.0
tree-sitter-ocaml@0.24.2
tree-sitter-elm@4.5.0
tree-sitter-make@1.1.1
tree-sitter-regex@0.25.0
tree-sitter-cuda@0.21.1
tree-sitter-r@0.0.1-security (placeholder, not functional)
tree-sitter-dockerfile@0.0.1-security (placeholder, not functional)
```

### Parser Services Created (16)
- src/parser/CParserService.ts
- src/parser/ObjectiveCParserService.ts
- src/parser/ScalaParserService.ts
- src/parser/LuaParserService.ts
- src/parser/BashParserService.ts
- src/parser/ZshParserService.ts
- src/parser/JsonParserService.ts
- src/parser/YamlParserService.ts
- src/parser/TomlParserService.ts
- src/parser/MarkdownParserService.ts
- src/parser/CsvParserService.ts
- src/parser/OcamlParserService.ts
- src/parser/ElmParserService.ts
- src/parser/MakefileParserService.ts
- src/parser/RegexParserService.ts
- src/parser/CudaParserService.ts

### Type Declarations Added
- src/tree-sitter-grammars.d.ts - Type declarations for grammar packages without @types

### Registry Updates
- src/parser/ParserRegistry.ts - Registered all 16 new parsers

## Compilation Status

✅ **Zero parser-related TypeScript errors**
- All 16 new parser services compile successfully
- No tree-sitter import errors
- All type declarations working correctly

Note: 85 pre-existing TypeScript errors in codebase (unrelated to new parsers)

## Symbol Extraction Capabilities

Each parser extracts language-specific symbols:

- **C/C++/CUDA**: Functions, structs, classes, enums, variables, constants
- **Objective-C**: Classes, protocols, methods, properties
- **Scala**: Functions, classes, objects, traits, vals, vars
- **Lua**: Functions, local variables, global variables
- **Bash/Zsh**: Functions, variables, constants (readonly)
- **JSON/YAML/TOML**: Top-level keys, tables, sections
- **Markdown**: Headings (as modules/sections)
- **CSV**: Column headers
- **OCaml/ReScript**: Values, types, modules, externals
- **Elm**: Value declarations, type aliases, types, ports
- **Makefile**: Targets (as functions), variables
- **Regex**: Named capturing groups

## Testing Status

✅ All parsers registered in ParserRegistry
⏳ Individual parser tests pending (next phase)

## Next Steps

1. Write comprehensive tests for all 16 new parsers
2. Create test fixtures for each language
3. Run full test suite to ensure zero regressions
4. Update documentation with new language support
5. Add CLI examples for new languages

## Impact

- **Language Coverage**: 14 → 30 languages (+114%)
- **Parser Services**: 14 → 30 services (+114%)
- **File Extensions**: ~30 → ~60 extensions supported
- **Symbol Extraction**: Enhanced for systems, functional, and config languages

## Related Documents

- automatosx/tmp/TREE-SITTER-0.25.0-UPGRADE-SUCCESS-2025-11-08.md - tree-sitter upgrade
- automatosx/tmp/LANGUAGE-SUPPORT-TREE-SITTER-0.21.1.md - Initial language analysis
- src/parser/ParserRegistry.ts - Complete parser registration
