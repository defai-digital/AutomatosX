/**
 * GoParserService.test.ts
 *
 * Tests for Go language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GoParserService } from '../GoParserService.js';
describe('GoParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new GoParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('go');
        });
        it('should support Go file extensions', () => {
            expect(parser.extensions).toEqual(['.go']);
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
package main

func Hello() string {
    return "Hello"
}

func Greet(name string) string {
    return "Hello, " + name
}
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(2);
            // First function
            expect(result.symbols[0].name).toBe('Hello');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].line).toBe(4);
            // Second function
            expect(result.symbols[1].name).toBe('Greet');
            expect(result.symbols[1].kind).toBe('function');
            expect(result.symbols[1].line).toBe(8);
        });
        it('should extract struct type declarations', () => {
            const code = `
package main

type User struct {
    Name string
    Email string
}

type Admin struct {
    User
    Permissions []string
}
`;
            const result = parser.parse(code);
            const structs = result.symbols.filter(s => s.kind === 'struct');
            expect(structs).toHaveLength(2);
            expect(structs[0].name).toBe('User');
            expect(structs[0].line).toBe(4);
            expect(structs[1].name).toBe('Admin');
            expect(structs[1].line).toBe(9);
        });
        it('should extract interface type declarations', () => {
            const code = `
package main

type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].name).toBe('Reader');
            expect(interfaces[0].line).toBe(4);
            expect(interfaces[1].name).toBe('Writer');
            expect(interfaces[1].line).toBe(8);
        });
        it('should extract method declarations', () => {
            const code = `
package main

type Calculator struct {
    Memory float64
}

func (c *Calculator) Add(a, b float64) float64 {
    return a + b
}

func (c Calculator) Subtract(a, b float64) float64 {
    return a - b
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
            expect(methods[0].name).toContain('Add');
            expect(methods[0].kind).toBe('method');
            expect(methods[1].name).toContain('Subtract');
            expect(methods[1].kind).toBe('method');
        });
        it('should distinguish between functions and methods', () => {
            const code = `
package main

func StandaloneFunction() {}

type MyType struct {}

func (m MyType) MyMethod() {}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('StandaloneFunction');
            expect(methods).toHaveLength(1);
            expect(methods[0].name).toContain('MyMethod');
        });
        it('should extract type aliases', () => {
            const code = `
package main

type String string
type Int int
type Callback func(string) error
`;
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types.length).toBeGreaterThanOrEqual(3);
            expect(types[0].name).toBe('String');
            expect(types[1].name).toBe('Int');
            expect(types[2].name).toBe('Callback');
        });
        it('should extract constants', () => {
            const code = `
package main

const MaxSize = 100

const (
    StatusOK = 200
    StatusNotFound = 404
)
`;
            const result = parser.parse(code);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(1);
            // At least the first const should be extracted
            expect(constants[0].name).toBe('MaxSize');
        });
        it('should extract variables', () => {
            const code = `
package main

var GlobalVar string

var (
    Config map[string]string
    Timeout int
)
`;
            const result = parser.parse(code);
            const variables = result.symbols.filter(s => s.kind === 'variable');
            expect(variables.length).toBeGreaterThanOrEqual(1);
            expect(variables[0].name).toBe('GlobalVar');
        });
        it('should include position information', () => {
            const code = `package main

func Hello() string {
    return "Hello"
}`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            const symbol = result.symbols[0];
            expect(symbol.line).toBe(3);
            expect(symbol.column).toBe(0);
            expect(symbol.endLine).toBeDefined();
            expect(symbol.endColumn).toBeDefined();
            expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
        });
        it('should handle complex Go code', () => {
            const code = `
package http

import (
    "context"
    "net/http"
    "time"
)

type Server struct {
    addr string
    handler http.Handler
}

type Config struct {
    Address string
    Port    int
}

type Handler func(w http.ResponseWriter, r *http.Request) error

func NewServer(addr string) *Server {
    return &Server{addr: addr}
}

func (s *Server) Start(ctx context.Context) error {
    return nil
}

func (s *Server) Stop() error {
    return nil
}

const DefaultPort = 8080

var DefaultConfig = Config{
    Address: "localhost",
    Port:    DefaultPort,
}
`;
            const result = parser.parse(code);
            // Should extract: 3 structs, 1 type alias, 1 function, 2 methods, 1 const, 1 var
            expect(result.symbols.length).toBeGreaterThanOrEqual(7);
            const structs = result.symbols.filter(s => s.kind === 'struct');
            const types = result.symbols.filter(s => s.kind === 'type');
            const functions = result.symbols.filter(s => s.kind === 'function');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(structs.length).toBeGreaterThanOrEqual(2);
            expect(types.length).toBeGreaterThanOrEqual(1);
            expect(functions.length).toBeGreaterThanOrEqual(1);
            expect(methods.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle generics (Go 1.18+)', () => {
            const code = `
package main

type Processor[T any] struct {
    value T
}

func NewProcessor[T any](value T) *Processor[T] {
    return &Processor[T]{value: value}
}

func (p *Processor[T]) Get() T {
    return p.value
}
`;
            const result = parser.parse(code);
            const structs = result.symbols.filter(s => s.kind === 'struct');
            const functions = result.symbols.filter(s => s.kind === 'function');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(structs).toHaveLength(1);
            expect(structs[0].name).toBe('Processor');
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('NewProcessor');
            expect(methods).toHaveLength(1);
            expect(methods[0].name).toContain('Get');
        });
        it('should handle interfaces with multiple methods', () => {
            const code = `
package main

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Logger interface {
    Info(msg string)
    Error(msg string, err error)
    Debug(msg string)
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].name).toBe('Shape');
            expect(interfaces[1].name).toBe('Logger');
        });
        it('should handle embedded interfaces', () => {
            const code = `
package main

type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type ReadWriter interface {
    Reader
    Writer
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(3);
            expect(interfaces[0].name).toBe('Reader');
            expect(interfaces[1].name).toBe('Writer');
            expect(interfaces[2].name).toBe('ReadWriter');
        });
        it('should handle init functions', () => {
            const code = `
package main

func init() {
    // Initialization code
}

func main() {
    // Main code
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(2);
            expect(functions.some(f => f.name === 'init')).toBe(true);
            expect(functions.some(f => f.name === 'main')).toBe(true);
        });
        it('should handle variadic functions', () => {
            const code = `
package main

func Sum(numbers ...int) int {
    total := 0
    for _, n := range numbers {
        total += n
    }
    return total
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('Sum');
        });
        it('should handle anonymous functions assigned to variables', () => {
            const code = `
package main

var handler = func(w http.ResponseWriter, r *http.Request) {
    // Handler code
}
`;
            const result = parser.parse(code);
            // Anonymous functions should extract the variable name
            const variables = result.symbols.filter(s => s.kind === 'variable');
            expect(variables.length).toBeGreaterThanOrEqual(1);
            expect(variables[0].name).toBe('handler');
        });
        it('should handle methods with pointer and value receivers', () => {
            const code = `
package main

type Point struct {
    X, Y float64
}

func (p *Point) Scale(factor float64) {
    p.X *= factor
    p.Y *= factor
}

func (p Point) Distance() float64 {
    return p.X + p.Y
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
            // Both pointer and value receivers should be extracted
            expect(methods[0].name).toContain('Scale');
            expect(methods[1].name).toContain('Distance');
        });
        it('should handle iota constants', () => {
            const code = `
package main

type CalculatorMode int

const (
    StandardMode CalculatorMode = iota
    ScientificMode
    ProgrammerMode
)
`;
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(types.length).toBeGreaterThanOrEqual(1);
            expect(types[0].name).toBe('CalculatorMode');
            // Should extract at least the first constant
            expect(constants.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            // Tree-sitter parsers are error-tolerant
            const code = `
package main

func incomplete(
    // Missing closing parenthesis and body
`;
            // Should not throw, but parse what it can
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
package main

func ValidFunction() {}

func InvalidFunction(
    // Missing parts

func AnotherValid() {}
`;
            const result = parser.parse(code);
            // Should extract the valid functions
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            // Generate a large Go file
            const lines = ['package main', ''];
            for (let i = 0; i < 100; i++) {
                lines.push(`func Function${i}() int {`);
                lines.push(`    return ${i}`);
                lines.push('}');
                lines.push('');
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(100);
            // Should parse in reasonable time (< 100ms for 100 functions)
            expect(result.parseTime).toBeLessThan(100);
        });
    });
});
//# sourceMappingURL=GoParserService.test.js.map