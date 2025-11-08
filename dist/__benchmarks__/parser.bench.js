/**
 * Parser Performance Benchmarks
 *
 * Measures parser performance across all supported languages
 * Target: < 10ms per file for typical code sizes
 */
import { describe, bench } from 'vitest';
import { TypeScriptParserService } from '../parser/TypeScriptParserService.js';
import { PythonParserService } from '../parser/PythonParserService.js';
import { GoParserService } from '../parser/GoParserService.js';
import { JavaParserService } from '../parser/JavaParserService.js';
import { RustParserService } from '../parser/RustParserService.js';
import { RubyParserService } from '../parser/RubyParserService.js';
import { CSharpParserService } from '../parser/CSharpParserService.js';
import { CppParserService } from '../parser/CppParserService.js';
import { PhpParserService } from '../parser/PhpParserService.js';
import { KotlinParserService } from '../parser/KotlinParserService.js';
import { SwiftParserService } from '../parser/SwiftParserService.js';
import { SqlParserService } from '../parser/SqlParserService.js';
import { AssemblyScriptParserService } from '../parser/AssemblyScriptParserService.js';
// Sample code for each language (typical size: 100-200 lines)
const samples = {
    typescript: `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

class Calculator {
  constructor(private precision: number = 2) {}

  add(a: number, b: number): number {
    return parseFloat((a + b).toFixed(this.precision));
  }

  subtract(a: number, b: number): number {
    return parseFloat((a - b).toFixed(this.precision));
  }
}

interface MathOperation {
  execute(a: number, b: number): number;
}

export { factorial, Calculator, MathOperation };
`.repeat(3), // ~200 lines
    python: `
def factorial(n: int) -> int:
    """Calculate factorial of n"""
    if n <= 1:
        return 1
    return n * factorial(n - 1)

class Calculator:
    """A simple calculator with precision"""

    def __init__(self, precision: int = 2):
        self.precision = precision

    def add(self, a: float, b: float) -> float:
        return round(a + b, self.precision)

    def subtract(self, a: float, b: float) -> float:
        return round(a - b, self.precision)

class MathOperation:
    def execute(self, a: float, b: float) -> float:
        pass
`.repeat(3),
    go: `
package main

import "math"

func factorial(n int) int {
    if n <= 1 {
        return 1
    }
    return n * factorial(n-1)
}

type Calculator struct {
    precision int
}

func NewCalculator(precision int) *Calculator {
    return &Calculator{precision: precision}
}

func (c *Calculator) Add(a, b float64) float64 {
    return math.Round((a+b)*math.Pow(10, float64(c.precision))) / math.Pow(10, float64(c.precision))
}

func (c *Calculator) Subtract(a, b float64) float64 {
    return math.Round((a-b)*math.Pow(10, float64(c.precision))) / math.Pow(10, float64(c.precision))
}
`.repeat(3),
    java: `
public class Calculator {
    private int precision;

    public Calculator(int precision) {
        this.precision = precision;
    }

    public double add(double a, double b) {
        double result = a + b;
        double multiplier = Math.pow(10, precision);
        return Math.round(result * multiplier) / multiplier;
    }

    public double subtract(double a, double b) {
        double result = a - b;
        double multiplier = Math.pow(10, precision);
        return Math.round(result * multiplier) / multiplier;
    }

    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
}
`.repeat(3),
    rust: `
pub fn factorial(n: u32) -> u32 {
    if n <= 1 { 1 } else { n * factorial(n - 1) }
}

pub struct Calculator {
    precision: u32,
}

impl Calculator {
    pub fn new(precision: u32) -> Self {
        Calculator { precision }
    }

    pub fn add(&self, a: f64, b: f64) -> f64 {
        let multiplier = 10_f64.powi(self.precision as i32);
        ((a + b) * multiplier).round() / multiplier
    }

    pub fn subtract(&self, a: f64, b: f64) -> f64 {
        let multiplier = 10_f64.powi(self.precision as i32);
        ((a - b) * multiplier).round() / multiplier
    }
}
`.repeat(3),
};
describe('Parser Performance Benchmarks', () => {
    describe('TypeScript Parser', () => {
        const parser = new TypeScriptParserService();
        bench('parse TypeScript code (small: ~50 LOC)', () => {
            parser.parse(samples.typescript.substring(0, 1000), 'test.ts');
        });
        bench('parse TypeScript code (medium: ~200 LOC)', () => {
            parser.parse(samples.typescript, 'test.ts');
        });
        bench('parse TypeScript code (large: ~1000 LOC)', () => {
            parser.parse(samples.typescript.repeat(5), 'test.ts');
        });
    });
    describe('Python Parser', () => {
        const parser = new PythonParserService();
        bench('parse Python code (small: ~50 LOC)', () => {
            parser.parse(samples.python.substring(0, 1000), 'test.py');
        });
        bench('parse Python code (medium: ~200 LOC)', () => {
            parser.parse(samples.python, 'test.py');
        });
        bench('parse Python code (large: ~1000 LOC)', () => {
            parser.parse(samples.python.repeat(5), 'test.py');
        });
    });
    describe('Go Parser', () => {
        const parser = new GoParserService();
        bench('parse Go code (small: ~50 LOC)', () => {
            parser.parse(samples.go.substring(0, 1000), 'test.go');
        });
        bench('parse Go code (medium: ~200 LOC)', () => {
            parser.parse(samples.go, 'test.go');
        });
        bench('parse Go code (large: ~1000 LOC)', () => {
            parser.parse(samples.go.repeat(5), 'test.go');
        });
    });
    describe('Java Parser', () => {
        const parser = new JavaParserService();
        bench('parse Java code (medium: ~200 LOC)', () => {
            parser.parse(samples.java, 'Test.java');
        });
    });
    describe('Rust Parser', () => {
        const parser = new RustParserService();
        bench('parse Rust code (medium: ~200 LOC)', () => {
            parser.parse(samples.rust, 'test.rs');
        });
    });
    describe('All Parsers Comparison', () => {
        const parsers = [
            { name: 'TypeScript', parser: new TypeScriptParserService(), ext: '.ts' },
            { name: 'Python', parser: new PythonParserService(), ext: '.py' },
            { name: 'Go', parser: new GoParserService(), ext: '.go' },
            { name: 'Java', parser: new JavaParserService(), ext: '.java' },
            { name: 'Rust', parser: new RustParserService(), ext: '.rs' },
            { name: 'Ruby', parser: new RubyParserService(), ext: '.rb' },
            { name: 'C#', parser: new CSharpParserService(), ext: '.cs' },
            { name: 'C++', parser: new CppParserService(), ext: '.cpp' },
            { name: 'PHP', parser: new PhpParserService(), ext: '.php' },
            { name: 'Kotlin', parser: new KotlinParserService(), ext: '.kt' },
            { name: 'Swift', parser: new SwiftParserService(), ext: '.swift' },
            { name: 'SQL', parser: new SqlParserService(), ext: '.sql' },
            { name: 'AssemblyScript', parser: new AssemblyScriptParserService(), ext: '.as.ts' },
        ];
        const testCode = samples.typescript; // Use TypeScript sample for all (same size)
        parsers.forEach(({ name, parser, ext }) => {
            bench(`${name} parser (200 LOC)`, () => {
                parser.parse(testCode, `test${ext}`);
            });
        });
    });
});
describe('Parser Symbol Extraction', () => {
    const parser = new TypeScriptParserService();
    bench('extract symbols from TypeScript (10 functions)', () => {
        const code = `
      function fn1() {}
      function fn2() {}
      function fn3() {}
      function fn4() {}
      function fn5() {}
      function fn6() {}
      function fn7() {}
      function fn8() {}
      function fn9() {}
      function fn10() {}
    `;
        parser.parse(code, 'test.ts');
    });
    bench('extract symbols from TypeScript (10 classes)', () => {
        const code = `
      class C1 {}
      class C2 {}
      class C3 {}
      class C4 {}
      class C5 {}
      class C6 {}
      class C7 {}
      class C8 {}
      class C9 {}
      class C10 {}
    `;
        parser.parse(code, 'test.ts');
    });
    bench('extract symbols from TypeScript (mixed: 5 functions + 5 classes)', () => {
        const code = `
      function fn1() {}
      class C1 {}
      function fn2() {}
      class C2 {}
      function fn3() {}
      class C3 {}
      function fn4() {}
      class C4 {}
      function fn5() {}
      class C5 {}
    `;
        parser.parse(code, 'test.ts');
    });
});
//# sourceMappingURL=parser.bench.js.map