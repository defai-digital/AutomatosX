# Tree-sitter Phase 2 — Test Corpus Definition

**Planning Session:** Tuesday, January 21, 2025 (13:00-15:00 PT)
**Attendees:** Bob (Backend Lead), Felix (Fullstack), Queenie (QA Lead - observer)
**Purpose:** Define test corpus for Python, Go, and Rust language support validation

---

## Executive Summary

Tree-sitter Phase 2 test corpus spans **370 total files** across 3 languages:
- **Python:** 150 files (42K LoC)
- **Go:** 120 files (38K LoC)
- **Rust:** 100 files (35K LoC)

Test corpus selected to cover diverse syntax patterns, real-world code structures, and edge cases for each language. Performance baseline: ≤10% latency regression threshold confirmed.

---

## 1. Python Test Corpus (150 files, 42K LoC)

### File Selection Criteria
- **Standard Library Samples:** 50 files from Python stdlib (asyncio, collections, itertools, typing modules)
- **Popular OSS Projects:** 60 files from Django, Flask, Pandas, NumPy, Requests
- **Syntax Edge Cases:** 40 files covering decorators, metaclasses, async/await, type hints, f-strings

### Coverage Requirements
- **Grammar Coverage:** 95%+ of Python 3.10 grammar rules
- **Symbol Extraction:** Functions, classes, variables, imports, decorators
- **AST Patterns:** List comprehensions, lambda expressions, context managers, async generators

### Sample File Breakdown
| Source | Files | LoC | Patterns Covered |
|--------|-------|-----|------------------|
| Python stdlib | 50 | 14,000 | Standard patterns, typing annotations, async constructs |
| Django ORM | 20 | 8,500 | Class-based views, model definitions, querysets |
| Pandas | 20 | 10,200 | DataFrame operations, NumPy integration |
| Flask | 15 | 5,800 | Decorators, blueprints, request handling |
| Type Hints | 10 | 1,200 | Generic types, protocols, overloads |
| Edge Cases | 35 | 2,300 | Metaclasses, __slots__, descriptor protocol |

### Performance Baseline
- **Target:** Parse 150 files within ≤10% latency regression vs baseline
- **Baseline p95 Latency:** 62.1 ms per file
- **Threshold:** ≤68.3 ms per file (62.1 ms × 1.10)
- **Cache Hit Rate:** >85% for incremental parsing

---

## 2. Go Test Corpus (120 files, 38K LoC)

### File Selection Criteria
- **Standard Library Samples:** 40 files from Go stdlib (net/http, encoding/json, context, sync packages)
- **Popular OSS Projects:** 50 files from Kubernetes, Docker, Prometheus, etcd
- **Syntax Edge Cases:** 30 files covering generics, interfaces, goroutines, channels

### Coverage Requirements
- **Grammar Coverage:** 95%+ of Go 1.19 grammar rules (including generics)
- **Symbol Extraction:** Functions, structs, interfaces, methods, package imports
- **AST Patterns:** Defer statements, select/case, type assertions, embedding

### Sample File Breakdown
| Source | Files | LoC | Patterns Covered |
|--------|-------|-----|------------------|
| Go stdlib | 40 | 12,500 | Standard patterns, concurrency primitives, interfaces |
| Kubernetes API | 25 | 11,200 | Custom resources, controllers, informers |
| Docker Engine | 20 | 8,300 | Container runtime, image handling, networking |
| Prometheus | 15 | 4,500 | Metrics collection, time series data structures |
| Generics | 10 | 900 | Type parameters, constraints, generic functions |
| Edge Cases | 10 | 600 | Unsafe pointers, CGO, build tags |

### Performance Baseline
- **Target:** Parse 120 files within ≤10% latency regression vs baseline
- **Baseline p95 Latency:** 71.3 ms per file
- **Threshold:** ≤78.4 ms per file (71.3 ms × 1.10)
- **Module Cache:** Pre-load standard library, reduce cold-start parse time by 15%

---

## 3. Rust Test Corpus (100 files, 35K LoC)

### File Selection Criteria
- **Standard Library Samples:** 30 files from Rust stdlib (collections, io, sync, futures modules)
- **Popular OSS Projects:** 50 files from Tokio, Serde, Actix, Diesel
- **Syntax Edge Cases:** 20 files covering macros, lifetimes, trait bounds, async/await

### Coverage Requirements
- **Grammar Coverage:** 90%+ of Rust 2021 edition grammar rules
- **Symbol Extraction:** Functions, structs, traits, enums, macros, impl blocks
- **AST Patterns:** Pattern matching, trait implementations, lifetime annotations, macro expansions

### Sample File Breakdown
| Source | Files | LoC | Patterns Covered |
|--------|-------|-----|------------------|
| Rust stdlib | 30 | 10,500 | Standard patterns, traits, collections, async runtime |
| Tokio | 20 | 9,800 | Async runtime, task spawning, futures |
| Serde | 15 | 6,200 | Serialization, derive macros, custom serializers |
| Actix Web | 10 | 4,100 | HTTP handlers, middleware, routing |
| Diesel ORM | 10 | 3,200 | Database models, query DSL, migrations |
| Edge Cases | 15 | 1,200 | Procedural macros, unsafe blocks, complex lifetimes |

### Performance Baseline
- **Target:** Parse 100 files within ≤10% latency regression vs baseline
- **Baseline p95 Latency:** 79.4 ms per file
- **Threshold:** ≤87.3 ms per file (79.4 ms × 1.10)
- **Trait System:** Handle complex trait bounds, associated types

---

## 4. Test Corpus Validation Plan

### Validation Stages
1. **Grammar Integration:** Verify Tree-sitter grammar loads without errors
2. **Symbol Extraction:** Validate all expected symbols extracted correctly
3. **Test Execution:** Run full test corpus, measure pass rate and performance
4. **Incremental Parsing:** Test cache hit rate with file edits

### Pass Criteria
| Language | Test Files | Target Pass Rate | Actual Pass Rate (Week 3) | Status |
|----------|------------|------------------|---------------------------|--------|
| Python | 150 | ≥98% | 98.7% (148/150) | ✅ Exceeded |
| Go | 120 | ≥98% | 98.3% (118/120) | ✅ Exceeded |
| Rust | 100 | ≥95% | 95.0% (95/100) | ✅ Met |

### Performance Validation
| Language | Baseline p95 | Week 3 p95 | Regression | Threshold | Status |
|----------|-------------|-----------|------------|-----------|--------|
| Python | 62.1 ms | 64.1 ms | +3.2% | ≤10% | ✅ Met |
| Go | 71.3 ms | 74.2 ms | +4.1% | ≤10% | ✅ Met |
| Rust | 79.4 ms | 84.0 ms | +5.8% | ≤10% | ✅ Met |

---

## 5. Test Corpus Maintenance

### Update Frequency
- **Quarterly:** Review and update OSS project samples to latest stable versions
- **Per Language Release:** Add new syntax patterns when language versions update (e.g., Python 3.11, Rust 2024)
- **Bug-Driven:** Add regression test files when parser bugs discovered

### Corpus Storage
- **Location:** `automatosx/test-corpus/tree-sitter-phase2/`
- **Structure:**
  ```
  tree-sitter-phase2/
  ├── python/
  │   ├── stdlib/       (50 files)
  │   ├── django/       (20 files)
  │   ├── pandas/       (20 files)
  │   ├── flask/        (15 files)
  │   ├── typing/       (10 files)
  │   └── edge-cases/   (35 files)
  ├── go/
  │   ├── stdlib/       (40 files)
  │   ├── kubernetes/   (25 files)
  │   ├── docker/       (20 files)
  │   ├── prometheus/   (15 files)
  │   ├── generics/     (10 files)
  │   └── edge-cases/   (10 files)
  └── rust/
      ├── stdlib/       (30 files)
      ├── tokio/        (20 files)
      ├── serde/        (15 files)
      ├── actix/        (10 files)
      ├── diesel/       (10 files)
      └── edge-cases/   (15 files)
  ```

### Version Control
- Test corpus files committed to git repository
- Git LFS used for large OSS project samples (>100KB per file)
- SHA256 checksums maintained for corpus integrity validation

---

## 6. Integration with CI/CD

### CI Test Execution
- **Trigger:** Every PR touching Tree-sitter integration code
- **Execution Time:** 3-5 minutes for full 370-file corpus
- **Pass Criteria:** ≥98% pass rate (Python/Go), ≥95% pass rate (Rust), ≤10% latency regression

### Performance Regression Detection
- Automated benchmark comparison vs baseline (stored in CI artifacts)
- Alert on >5% regression (WARN), block merge on >10% regression (FAIL)
- Latency heatmap visualization in CI dashboard

---

## Conclusion

Tree-sitter Phase 2 test corpus provides comprehensive coverage across 370 files spanning Python, Go, and Rust ecosystems. Week 3 validation demonstrated:
- ✅ Python: 98.7% pass rate, +3.2% latency (within threshold)
- ✅ Go: 98.3% pass rate, +4.1% latency (within threshold)
- ✅ Rust: 95.0% pass rate, +5.8% latency (within threshold)

Test corpus ready for production validation and ongoing maintenance.

---

**Prepared By:** Bob (Backend Lead) + Felix (Fullstack)
**Reviewed By:** Queenie (QA Lead)
**Date:** Tuesday, January 21, 2025
