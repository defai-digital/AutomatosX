/**
 * sample-swift-basic.swift
 * Basic Swift patterns: functions, classes, structs, enums, protocols
 */

import Foundation

// ===== Top-level Functions =====

func add(a: Int, b: Int) -> Int {
    return a + b
}

func multiply(a: Int, b: Int) -> Int {
    return a * b
}

func greet(name: String) -> String {
    return "Hello, \(name)!"
}

// ===== Classes =====

class Calculator {
    private var memory: Double = 0.0

    func add(a: Double, b: Double) -> Double {
        return a + b
    }

    func subtract(a: Double, b: Double) -> Double {
        return a - b
    }

    func storeInMemory(value: Double) {
        memory = value
    }

    func recallMemory() -> Double {
        return memory
    }
}

class Counter {
    private var count: Int = 0

    func increment() {
        count += 1
    }

    func decrement() {
        count -= 1
    }

    func getCount() -> Int {
        return count
    }
}

// ===== Structs =====

struct Point {
    var x: Double
    var y: Double

    func distance(to other: Point) -> Double {
        let dx = x - other.x
        let dy = y - other.y
        return sqrt(dx * dx + dy * dy)
    }
}

struct Person {
    var name: String
    var age: Int
    var email: String

    mutating func haveBirthday() {
        age += 1
    }
}

struct Product {
    let id: Int
    var name: String
    var price: Double
    var inStock: Bool
}

// ===== Enums =====

enum Result {
    case success
    case failure
}

enum Status {
    case pending
    case active
    case inactive
    case deleted
}

enum NetworkError: Error {
    case timeout
    case invalidResponse
    case serverError(statusCode: Int)
}

// ===== Protocols =====

protocol Logger {
    func log(message: String)
    func error(message: String)
}

protocol Repository {
    func find(id: Int) -> Any?
    func save(entity: Any) -> Bool
    func delete(id: Int) -> Bool
}

protocol Drawable {
    func draw()
}

// ===== Class with Init =====

class User {
    let id: Int
    var username: String
    var email: String
    var lastLogin: Date?

    init(id: Int, username: String, email: String) {
        self.id = id
        self.username = username
        self.email = email
        self.lastLogin = nil
    }

    func updateEmail(newEmail: String) {
        email = newEmail
    }

    func recordLogin() {
        lastLogin = Date()
    }
}

// ===== Inheritance =====

class Animal {
    let name: String

    init(name: String) {
        self.name = name
    }

    func makeSound() -> String {
        return "Some sound"
    }

    func describe() -> String {
        return "\(name) says \(makeSound())"
    }
}

class Dog: Animal {
    override func makeSound() -> String {
        return "Woof!"
    }

    func fetch() {
        print("\(name) is fetching")
    }
}

class Cat: Animal {
    override func makeSound() -> String {
        return "Meow!"
    }

    func scratch() {
        print("\(name) is scratching")
    }
}

// ===== Static Members =====

class MathUtils {
    static let pi = 3.14159

    static func square(x: Double) -> Double {
        return x * x
    }

    static func cube(x: Double) -> Double {
        return x * x * x
    }
}

// ===== Computed Properties =====

struct Rectangle {
    var width: Double
    var height: Double

    var area: Double {
        return width * height
    }

    var perimeter: Double {
        return 2 * (width + height)
    }
}

// ===== Extensions =====

extension String {
    func toTitleCase() -> String {
        return self.capitalized
    }
}

extension Int {
    func isEven() -> Bool {
        return self % 2 == 0
    }

    func isOdd() -> Bool {
        return self % 2 != 0
    }
}
