/**
 * KotlinParserService.test.ts
 *
 * Tests for Kotlin language parser using Tree-sitter
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { KotlinParserService } from '../KotlinParserService.js';
import * as fs from 'fs';
import * as path from 'path';
describe('KotlinParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new KotlinParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('kotlin');
        });
        it('should support Kotlin file extensions', () => {
            expect(parser.extensions).toContain('.kt');
            expect(parser.extensions).toContain('.kts');
        });
    });
    describe('parse', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
            expect(result.nodeCount).toBeGreaterThanOrEqual(0);
        });
        it('should extract top-level function definitions', () => {
            const code = `
fun add(a: Int, b: Int): Int {
    return a + b
}

fun multiply(a: Int, b: Int): Int = a * b
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(2);
            expect(functions[0].name).toBe('add');
            expect(functions[0].kind).toBe('function');
            expect(functions[1].name).toBe('multiply');
            expect(functions[1].kind).toBe('function');
        });
        it('should extract class definitions', () => {
            const code = `
class Calculator {
    fun add(a: Double, b: Double): Double {
        return a + b
    }
}

class Counter {
    private var count: Int = 0
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('Calculator');
            expect(classes[1].name).toBe('Counter');
        });
        it('should extract methods from classes', () => {
            const code = `
class Calculator {
    fun add(a: Int, b: Int): Int {
        return a + b
    }

    fun subtract(a: Int, b: Int): Int {
        return a - b
    }

    private fun log(message: String) {
        println(message)
    }
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(3);
            expect(methods[0].name).toBe('Calculator.add');
            expect(methods[1].name).toBe('Calculator.subtract');
            expect(methods[2].name).toBe('Calculator.log');
        });
        it('should extract data class definitions', () => {
            const code = `
data class Person(val name: String, val age: Int)

data class Point(val x: Double, val y: Double)

data class Product(
    val id: Int,
    val name: String,
    val price: Double
)
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(3);
            const dataClasses = classes.filter(c => ['Person', 'Point', 'Product'].includes(c.name));
            expect(dataClasses).toHaveLength(3);
        });
        it('should extract interface-like classes', () => {
            const code = `
interface Logger {
    fun log(message: String)
    fun error(message: String)
}

interface Repository {
    fun find(id: Int)
    fun save(entity: Any): Boolean
}
`;
            const result = parser.parse(code);
            // Note: Kotlin grammar treats interfaces as class_declaration
            // Our parser attempts to detect interfaces heuristically
            const interfaceLike = result.symbols.filter(s => s.kind === 'interface' || s.kind === 'class');
            expect(interfaceLike.length).toBeGreaterThanOrEqual(2);
        });
        it('should extract object declarations (singleton)', () => {
            const code = `
object Constants {
    const val PI = 3.14
    const val APP_VERSION = "1.0.0"
}

object StringUtils {
    fun capitalize(text: String): String {
        return text.uppercase()
    }
}
`;
            const result = parser.parse(code);
            const objects = result.symbols.filter(s => s.kind === 'class' && ['Constants', 'StringUtils'].includes(s.name));
            expect(objects).toHaveLength(2);
        });
        it('should extract properties', () => {
            const code = `
object Config {
    const val API_URL = "https://api.example.com"
    const val TIMEOUT = 30000
    val appName = "MyApp"
    var debugMode = false
}
`;
            const result = parser.parse(code);
            const properties = result.symbols.filter(s => s.kind === 'constant' || s.kind === 'variable');
            expect(properties.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle sealed classes', () => {
            const code = `
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(1);
            const resultClass = classes.find(c => c.name === 'Result');
            expect(resultClass).toBeDefined();
        });
        it('should handle companion objects', () => {
            const code = `
class Database private constructor(val url: String) {
    companion object {
        private var instance: Database? = null

        fun getInstance(url: String): Database {
            if (instance == null) {
                instance = Database(url)
            }
            return instance!!
        }
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(1);
            const dbClass = classes.find(c => c.name === 'Database');
            expect(dbClass).toBeDefined();
        });
        it('should handle extension functions', () => {
            const code = `
fun String.toTitleCase(): String {
    return this.split(" ").joinToString(" ") {
        it.capitalize()
    }
}

fun Int.isEven(): Boolean = this % 2 == 0
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle enum classes', () => {
            const code = `
enum class Status {
    PENDING,
    ACTIVE,
    INACTIVE,
    DELETED
}

enum class LogLevel {
    DEBUG,
    INFO,
    WARNING,
    ERROR
}
`;
            const result = parser.parse(code);
            const enums = result.symbols.filter(s => s.kind === 'enum' || s.kind === 'class');
            expect(enums.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle abstract classes', () => {
            const code = `
abstract class Animal(val name: String) {
    abstract fun makeSound(): String

    fun describe(): String {
        return "Animal says something"
    }
}

class Dog(name: String) : Animal(name) {
    override fun makeSound(): String {
        return "Woof!"
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('Animal');
            expect(classes[1].name).toBe('Dog');
        });
        it('should handle class inheritance', () => {
            const code = `
open class BaseModel {
    open fun save() {
        // save logic
    }
}

class User : BaseModel() {
    private val name: String = "User"

    override fun save() {
        super.save()
        // additional logic
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('BaseModel');
            expect(classes[1].name).toBe('User');
        });
        it('should handle generic classes', () => {
            const code = `
class Box<T>(val value: T) {
    fun get(): T = value

    fun <R> map(transform: (T) -> R): Box<R> {
        return Box(transform(value))
    }
}

class Repository<T>(private val storage: MutableList<T>) {
    fun add(item: T) {
        storage.add(item)
    }

    fun getAll(): List<T> = storage.toList()
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('Box');
            expect(classes[1].name).toBe('Repository');
        });
        it('should handle inline functions', () => {
            const code = `
inline fun measureTimeMillis(block: () -> Unit): Long {
    val start = System.currentTimeMillis()
    block()
    return System.currentTimeMillis() - start
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(1);
            expect(functions[0].name).toBe('measureTimeMillis');
        });
        it('should handle higher-order functions', () => {
            const code = `
fun <T, R> List<T>.mapIndexedNotNull(transform: (Int, T) -> R?): List<R> {
    val result = mutableListOf<R>()
    for ((index, item) in this.withIndex()) {
        val transformed = transform(index, item)
        if (transformed != null) {
            result.add(transformed)
        }
    }
    return result
}

fun repeat(times: Int, action: (Int) -> Unit) {
    for (i in 0 until times) {
        action(i)
    }
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(2);
        });
        it('should handle nested classes', () => {
            const code = `
class Outer {
    private val bar: Int = 1

    class Nested {
        fun foo() = 2
    }

    inner class Inner {
        fun foo() = bar
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(1);
            const outerClass = classes.find(c => c.name === 'Outer');
            expect(outerClass).toBeDefined();
        });
        it('should include position information', () => {
            const code = `
fun hello(): String {
    return "Hello"
}
`;
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
        it('should handle coroutines and suspend functions', () => {
            const code = `
class ApiService {
    suspend fun fetchUser(id: Int): User {
        delay(1000)
        return User(id, "User $id")
    }

    suspend fun fetchPosts(): List<Post> {
        delay(500)
        return emptyList()
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('ApiService');
            expect(methods.length).toBeGreaterThanOrEqual(2);
        });
        it('should handle type aliases', () => {
            const code = `
typealias UserId = Int
typealias UserName = String
typealias Callback<T> = (Result<T>) -> Unit

class UserService {
    fun fetchUser(id: UserId): User {
        return User(id, "User")
    }
}
`;
            const result = parser.parse(code);
            // Type aliases are not extracted as symbols (they're type definitions)
            // But the class should be extracted
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(1);
        });
        it('should handle lambda expressions in property initialization', () => {
            const code = `
class User {
    val name: String by lazy {
        fetchNameFromDb()
    }

    private fun fetchNameFromDb(): String {
        return "John Doe"
    }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('User');
        });
    });
    describe('fixtures', () => {
        it('should parse sample-kotlin-basic.kt', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'kotlin', 'sample-kotlin-basic.kt');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract multiple symbols
            expect(result.symbols.length).toBeGreaterThan(15);
            const functions = result.symbols.filter(s => s.kind === 'function');
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(functions.length).toBeGreaterThanOrEqual(3);
            expect(classes.length).toBeGreaterThanOrEqual(8);
        });
        it('should parse sample-kotlin-advanced.kt', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'kotlin', 'sample-kotlin-advanced.kt');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract many symbols from the advanced fixture
            expect(result.symbols.length).toBeGreaterThan(20);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes.length).toBeGreaterThanOrEqual(8);
        });
        it('should parse sample-kotlin-android.kt', () => {
            const fixturePath = path.join(__dirname, 'fixtures', 'kotlin', 'sample-kotlin-android.kt');
            const code = fs.readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract many symbols from Android patterns
            expect(result.symbols.length).toBeGreaterThan(25);
            const classes = result.symbols.filter(s => s.kind === 'class');
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(classes.length).toBeGreaterThanOrEqual(10);
            expect(methods.length).toBeGreaterThanOrEqual(15);
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `
fun incomplete_function(
    // Missing closing parenthesis
`;
            // Should not throw, tree-sitter is error-tolerant
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            expect(result.parseTime).toBeGreaterThan(0);
        });
        it('should handle mixed valid and invalid code', () => {
            const code = `
fun validFunction(): Int {
    return 42
}

class InvalidClass {
    // Missing closing brace

fun anotherValidFunction(): String {
    return "test"
}
`;
            const result = parser.parse(code);
            // Should extract at least some valid symbols
            expect(result.symbols.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('performance', () => {
        it('should parse large files quickly', () => {
            // Generate a large Kotlin file
            const lines = [];
            for (let i = 0; i < 100; i++) {
                lines.push(`fun testFunction${i}(): Int {`);
                lines.push(`    return ${i}`);
                lines.push(`}`);
                lines.push('');
            }
            const code = lines.join('\n');
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(100);
            // Should parse in reasonable time (< 200ms for 100 functions)
            expect(result.parseTime).toBeLessThan(200);
        });
    });
});
//# sourceMappingURL=KotlinParserService.test.js.map