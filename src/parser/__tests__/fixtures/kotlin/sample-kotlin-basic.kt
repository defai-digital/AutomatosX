/**
 * sample-kotlin-basic.kt
 * Basic Kotlin patterns: functions, classes, interfaces, objects
 */

package com.example.basic

// ===== Top-level Functions =====

fun add(a: Int, b: Int): Int {
    return a + b
}

fun multiply(a: Int, b: Int): Int = a * b

fun greet(name: String): String {
    return "Hello, $name!"
}

// ===== Simple Classes =====

class Calculator {
    private var memory: Double = 0.0

    fun add(a: Double, b: Double): Double {
        return a + b
    }

    fun subtract(a: Double, b: Double): Double {
        return a - b
    }

    fun storeInMemory(value: Double) {
        memory = value
    }

    fun recallMemory(): Double {
        return memory
    }
}

class Counter {
    private var count: Int = 0

    fun increment() {
        count++
    }

    fun decrement() {
        count--
    }

    fun getCount(): Int {
        return count
    }
}

// ===== Data Classes =====

data class Person(
    val name: String,
    val age: Int,
    val email: String
)

data class Point(val x: Double, val y: Double)

data class Product(
    val id: Int,
    val name: String,
    val price: Double,
    val inStock: Boolean
)

// ===== Interfaces =====

interface Logger {
    fun log(message: String)
    fun error(message: String)
}

interface Repository<T> {
    fun find(id: Int): T?
    fun save(entity: T): Boolean
    fun delete(id: Int): Boolean
}

// ===== Object (Singleton) =====

object Constants {
    const val PI = 3.14159
    const val APP_VERSION = "1.0.0"
    const val MAX_RETRIES = 3
}

object StringUtils {
    fun capitalize(text: String): String {
        return text.replaceFirstChar { it.uppercase() }
    }

    fun slugify(text: String): String {
        return text.lowercase().replace(" ", "-")
    }
}

// ===== Simple Class with Constructor =====

class User(val id: Int, val username: String, var email: String) {
    var lastLogin: Long = 0

    fun updateEmail(newEmail: String) {
        email = newEmail
    }

    fun recordLogin() {
        lastLogin = System.currentTimeMillis()
    }
}

// ===== Class with Companion Object =====

class Database private constructor(val connectionString: String) {
    companion object {
        private var instance: Database? = null

        fun getInstance(connectionString: String): Database {
            if (instance == null) {
                instance = Database(connectionString)
            }
            return instance!!
        }

        fun resetInstance() {
            instance = null
        }
    }

    fun connect(): Boolean {
        println("Connecting to $connectionString")
        return true
    }
}

// ===== Enum Class =====

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

// ===== Abstract Class =====

abstract class Animal(val name: String) {
    abstract fun makeSound(): String

    fun describe(): String {
        return "$name says ${makeSound()}"
    }
}

class Dog(name: String) : Animal(name) {
    override fun makeSound(): String {
        return "Woof!"
    }

    fun fetch() {
        println("$name is fetching")
    }
}

class Cat(name: String) : Animal(name) {
    override fun makeSound(): String {
        return "Meow!"
    }

    fun scratch() {
        println("$name is scratching")
    }
}
