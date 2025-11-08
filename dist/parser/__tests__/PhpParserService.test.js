/**
 * PhpParserService.test.ts
 *
 * Tests for PHP language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PhpParserService } from '../PhpParserService.js';
import * as fs from 'fs';
import * as path from 'path';
describe('PhpParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new PhpParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('php');
        });
        it('should support PHP file extensions', () => {
            expect(parser.extensions).toContain('.php');
            expect(parser.extensions).toContain('.php3');
            expect(parser.extensions).toContain('.phtml');
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('<?php ?>');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
            expect(result.nodeCount).toBeGreaterThan(0);
        });
        it('should extract function definitions', () => {
            const code = `<?php
function calculateTotal($items) {
    return array_sum($items);
}

function formatCurrency(float $amount): string {
    return '$' . number_format($amount, 2);
}
?>`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(2);
            expect(functions[0].name).toBe('calculateTotal');
            expect(functions[0].kind).toBe('function');
            expect(functions[1].name).toBe('formatCurrency');
            expect(functions[1].kind).toBe('function');
        });
        it('should extract class definitions', () => {
            const code = `<?php
class Calculator {
    private $history = [];
}

class Product {
    public $name;
    protected $sku;
}
?>`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('Calculator');
            expect(classes[1].name).toBe('Product');
        });
        it('should extract methods from classes', () => {
            const code = `<?php
class Calculator {
    public function add($a, $b) {
        return $a + $b;
    }

    public function subtract($a, $b) {
        return $a - $b;
    }

    private function log($message) {
        // logging
    }
}
?>`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(3);
            expect(methods[0].name).toBe('add');
            expect(methods[1].name).toBe('subtract');
            expect(methods[2].name).toBe('log');
        });
        it('should extract interface definitions', () => {
            const code = `<?php
interface PaymentGateway {
    public function charge(float $amount): bool;
    public function refund(string $transactionId): bool;
}

interface Loggable {
    public function log(string $message): void;
}
?>`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].name).toBe('PaymentGateway');
            expect(interfaces[1].name).toBe('Loggable');
        });
        it('should extract trait definitions', () => {
            const code = `<?php
trait Timestampable {
    protected $createdAt;

    public function touch() {
        $this->updatedAt = time();
    }
}

trait Sluggable {
    public function generateSlug(string $text): string {
        return strtolower($text);
    }
}
?>`;
            const result = parser.parse(code);
            const traits = result.symbols.filter(s => s.kind === 'class' && s.name.match(/able$/));
            expect(traits.length).toBeGreaterThanOrEqual(2);
        });
        it('should extract constants', () => {
            const code = `<?php
const APP_VERSION = '2.0.0';
const STATUS_ACTIVE = 1;
const STATUS_INACTIVE = 0;
?>`;
            const result = parser.parse(code);
            const constants = result.symbols.filter(s => s.kind === 'constant');
            expect(constants.length).toBeGreaterThanOrEqual(1);
            if (constants.length > 0) {
                expect(constants[0].name).toBe('APP_VERSION');
            }
        });
        it('should extract class properties', () => {
            const code = `<?php
class Product {
    public $name;
    public $price;
    protected $sku;
    private $stock;
}
?>`;
            const result = parser.parse(code);
            const properties = result.symbols.filter(s => s.kind === 'variable');
            expect(properties.length).toBeGreaterThanOrEqual(3);
        });
        it('should handle abstract classes', () => {
            const code = `<?php
abstract class BaseController {
    protected $request;

    abstract public function handle();

    public function setRequest($request) {
        $this->request = $request;
    }
}
?>`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('BaseController');
            expect(methods.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle class inheritance', () => {
            const code = `<?php
class BaseModel {
    public function save() {
        // save logic
    }
}

class User extends BaseModel {
    private $name;

    public function getName() {
        return $this->name;
    }
}
?>`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('BaseModel');
            expect(classes[1].name).toBe('User');
        });
        it('should handle static methods', () => {
            const code = `<?php
class StringHelper {
    public static function slugify(string $text): string {
        return strtolower($text);
    }

    public static function truncate(string $text, int $length): string {
        return substr($text, 0, $length);
    }
}
?>`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
            expect(methods[0].name).toBe('slugify');
            expect(methods[1].name).toBe('truncate');
        });
        it('should handle magic methods', () => {
            const code = `<?php
class Model {
    private $attributes = [];

    public function __get($name) {
        return $this->attributes[$name] ?? null;
    }

    public function __set($name, $value) {
        $this->attributes[$name] = $value;
    }

    public function __toString() {
        return json_encode($this->attributes);
    }
}
?>`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods.length).toBeGreaterThanOrEqual(3);
            const magicMethods = methods.filter(m => m.name.startsWith('__'));
            expect(magicMethods.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle typed properties (PHP 7.4+)', () => {
            const code = `<?php
class Customer {
    private int $id;
    private string $name;
    private ?string $phone;
    private array $orders;
}
?>`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('Customer');
        });
        it('should handle interfaces with multiple methods', () => {
            const code = `<?php
interface Repository {
    public function find(int $id);
    public function save($entity): bool;
    public function delete(int $id): bool;
}
?>`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(1);
            expect(interfaces[0].name).toBe('Repository');
        });
        it('should include position information', () => {
            const code = `<?php
function hello() {
    return "Hello";
}
?>`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(1);
            const func = functions[0];
            expect(func.line).toBeGreaterThan(0);
            expect(func.column).toBeGreaterThanOrEqual(0);
            expect(func.endLine).toBeDefined();
            expect(func.endColumn).toBeDefined();
            expect(func.endLine).toBeGreaterThanOrEqual(func.line);
        });
        it('should handle constructor methods', () => {
            const code = `<?php
class Product {
    private $name;

    public function __construct(string $name) {
        $this->name = $name;
    }
}
?>`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(1);
            expect(methods[0].name).toBe('__construct');
        });
        it('should handle class implementing interfaces', () => {
            const code = `<?php
class PayPalGateway implements PaymentGateway {
    public function charge(float $amount): bool {
        return true;
    }

    public function refund(string $transactionId): bool {
        return false;
    }
}
?>`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('PayPalGateway');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
        });
    });
    describe('fixtures', () => {
        it('should parse sample-php-basic.php', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'php', 'sample-php-basic.php');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract multiple symbols
            expect(result.symbols.length).toBeGreaterThan(10);
            const functions = result.symbols.filter(s => s.kind === 'function');
            const classes = result.symbols.filter(s => s.kind === 'class');
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(functions.length).toBeGreaterThanOrEqual(3);
            expect(classes.length).toBeGreaterThanOrEqual(4);
            expect(interfaces.length).toBeGreaterThanOrEqual(2);
        });
        it('should parse sample-php-advanced.php', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'php', 'sample-php-advanced.php');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract many symbols from the advanced fixture
            expect(result.symbols.length).toBeGreaterThan(15);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(5);
        });
        it('should parse sample-php-laravel.php', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'php', 'sample-php-laravel.php');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract many symbols from Laravel patterns
            expect(result.symbols.length).toBeGreaterThan(20);
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(classes.length).toBeGreaterThanOrEqual(8);
            expect(methods.length).toBeGreaterThanOrEqual(15);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `<?php
function incomplete_function(
    // Missing closing parenthesis
?>`;
            // Should not throw, tree-sitter is error-tolerant
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `<?php
function validFunction() {
    return 42;
}

class InvalidClass {
    // Missing closing brace

function anotherValidFunction() {
    return 'test';
}
?>`;
            const result = parser.parse(code);
            // Should extract at least some valid symbols
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            // Generate a large PHP file
            const lines = ['<?php'];
            for (let i = 0; i < 100; i++) {
                lines.push(`function testFunction${i}() {`);
                lines.push(`    return ${i};`);
                lines.push(`}`);
                lines.push('');
            }
            lines.push('?>');
            const code = lines.join('\n');
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(100);
            // Should parse in reasonable time (< 150ms for 100 functions)
            expect(result.parseTime).toBeLessThan(150);
        });
    });
});
//# sourceMappingURL=PhpParserService.test.js.map