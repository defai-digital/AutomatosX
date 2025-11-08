/**
 * JavaParserService.test.ts
 *
 * Tests for Java language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JavaParserService } from '../JavaParserService.js';
describe('JavaParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new JavaParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('java');
        });
        it('should support Java file extensions', () => {
            expect(parser.extensions).toEqual(['.java']);
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
            expect(result.nodeCount).toBeGreaterThan(0);
        });
        it('should extract class declarations', () => {
            const code = `
package com.example;

public class Calculator {
    private double memory;
}

class Helper {
    void help() {}
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(2);
            expect(classes[0].name).toBe('Calculator');
            expect(classes[0].kind).toBe('class');
            expect(classes[1].name).toBe('Helper');
        });
        it('should extract interface declarations', () => {
            const code = `
package com.example;

public interface Calculator {
    double add(double a, double b);
}

interface Helper {
    void help();
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].name).toBe('Calculator');
            expect(interfaces[1].name).toBe('Helper');
        });
        it('should extract method declarations', () => {
            const code = `
package com.example;

public class Calculator {
    public double add(double a, double b) {
        return a + b;
    }

    public double subtract(double a, double b) {
        return a - b;
    }
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
            expect(methods[0].name).toBe('Calculator.add');
            expect(methods[1].name).toBe('Calculator.subtract');
        });
        it('should extract static methods', () => {
            const code = `
package com.example;

public class MathUtils {
    public static double max(double a, double b) {
        return a > b ? a : b;
    }
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods.length).toBeGreaterThanOrEqual(1);
            expect(methods[0].name).toBe('max'); // Static methods don't include class name
        });
        it('should extract enum declarations', () => {
            const code = `
package com.example;

enum CalculatorMode {
    STANDARD,
    SCIENTIFIC,
    PROGRAMMER
}

public enum HttpStatus {
    OK,
    NOT_FOUND
}
`;
            const result = parser.parse(code);
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(enums).toHaveLength(2);
            expect(enums[0].name).toBe('CalculatorMode');
            expect(enums[1].name).toBe('HttpStatus');
        });
        it('should extract constructors', () => {
            const code = `
package com.example;

public class Calculator {
    private double memory;

    public Calculator() {
        this.memory = 0;
    }

    public Calculator(double initialMemory) {
        this.memory = initialMemory;
    }
}
`;
            const result = parser.parse(code);
            const constructors = result.symbols.filter(s => s.kind === 'method' && s.name === 'Calculator');
            expect(constructors).toHaveLength(2);
        });
        it('should extract field declarations', () => {
            const code = `
package com.example;

public class Calculator {
    private double memory;
    private String name;
    public int count;
}
`;
            const result = parser.parse(code);
            const fields = result.symbols.filter(s => s.kind === 'variable');
            expect(fields.length).toBeGreaterThanOrEqual(3);
            const fieldNames = fields.map(f => f.name);
            expect(fieldNames).toContain('memory');
            expect(fieldNames).toContain('name');
            expect(fieldNames).toContain('count');
        });
        it('should extract constants (static final fields)', () => {
            const code = `
package com.example;

public class Constants {
    public static final int MAX_SIZE = 100;
    private static final String VERSION = "1.0.0";
}
`;
            const result = parser.parse(code);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(2);
            const constantNames = constants.map(c => c.name);
            expect(constantNames).toContain('MAX_SIZE');
            expect(constantNames).toContain('VERSION');
        });
        it('should handle generic classes', () => {
            const code = `
package com.example;

public class Response<T> {
    private T data;

    public T getData() {
        return data;
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('Response');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods.length).toBeGreaterThanOrEqual(1);
        });
        it('should handle inheritance', () => {
            const code = `
package com.example;

public class BasicCalculator implements Calculator {
    public double add(double a, double b) {
        return a + b;
    }
}

public class ScientificCalculator extends BasicCalculator {
    public double power(double base, double exp) {
        return Math.pow(base, exp);
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('BasicCalculator');
            expect(classes[1].name).toBe('ScientificCalculator');
        });
        it('should include position information', () => {
            const code = `package com.example;

public class Calculator {
    public double add(double a, double b) {
        return a + b;
    }
}`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            const symbol = classes[0];
            expect(symbol.line).toBe(3);
            expect(symbol.column).toBe(0);
            expect(symbol.endLine).toBeDefined();
            expect(symbol.endColumn).toBeDefined();
            expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.line);
        });
        it('should handle complex Java code', () => {
            const code = `
package com.example;

import java.util.List;

public interface UserService {
    Response<User> createUser(String username, String email);
    Response<User> getUser(Long id);
}

public class UserServiceImpl implements UserService {
    private final UserRepository repository;

    public UserServiceImpl(UserRepository repository) {
        this.repository = repository;
    }

    @Override
    public Response<User> createUser(String username, String email) {
        return Response.success(new User(username, email));
    }

    @Override
    public Response<User> getUser(Long id) {
        return repository.findById(id);
    }
}

enum HttpStatus {
    OK,
    NOT_FOUND
}
`;
            const result = parser.parse(code);
            // Should extract: 1 interface, 1 class, 2 methods in interface, 3 methods in class, 1 enum
            expect(result.symbols.length).toBeGreaterThanOrEqual(7);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(interfaces).toHaveLength(1);
            expect(classes).toHaveLength(1);
            expect(methods.length).toBeGreaterThanOrEqual(4);
            expect(enums).toHaveLength(1);
        });
        it('should handle abstract classes', () => {
            const code = `
package com.example;

public abstract class Shape {
    protected double x;
    protected double y;

    public abstract double area();
    public abstract double perimeter();

    public void moveTo(double newX, double newY) {
        this.x = newX;
        this.y = newY;
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('Shape');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods.length).toBeGreaterThanOrEqual(3);
        });
        it('should handle inner classes', () => {
            const code = `
package com.example;

public class Outer {
    private int value;

    public class Inner {
        public int getValue() {
            return Outer.this.value;
        }
    }

    public static class StaticNested {
        public void doSomething() {}
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(3);
            const classNames = classes.map(c => c.name);
            expect(classNames).toContain('Outer');
            expect(classNames).toContain('Inner');
            expect(classNames).toContain('StaticNested');
        });
        it('should handle annotations', () => {
            const code = `
package com.example;

@FunctionalInterface
interface Transformer<T, R> {
    R transform(T input);
}

public class Service {
    @Override
    public void execute() {}

    @Deprecated
    public void oldMethod() {}
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(1);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods.length).toBeGreaterThanOrEqual(3); // 1 interface method + 2 class methods
        });
        it('should handle exception classes', () => {
            const code = `
package com.example;

class DataException extends Exception {
    public DataException(String message) {
        super(message);
    }
}

class ValidationException extends DataException {
    public ValidationException(String message) {
        super(message);
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('DataException');
            expect(classes[1].name).toBe('ValidationException');
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `
package com.example;

public class Incomplete {
    public void method(
        // Missing closing parenthesis and body
`;
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
package com.example;

public class Valid {
    public void method() {}
}

public class Invalid {
    public void incomplete(
    // Missing parts

public class AnotherValid {
    public void method() {}
}
`;
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            const lines = ['package com.example;', ''];
            for (let i = 0; i < 50; i++) {
                lines.push(`public class Class${i} {`);
                lines.push(`    public void method${i}() {}`);
                lines.push('}');
                lines.push('');
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(50);
            expect(result.parseTime).toBeLessThan(100);
        });
    });
});
//# sourceMappingURL=JavaParserService.test.js.map