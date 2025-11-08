/**
 * sample-kotlin-advanced.kt
 * Advanced Kotlin patterns: sealed classes, extensions, generics, coroutines
 */

package com.example.advanced

import kotlinx.coroutines.*

// ===== Sealed Classes =====

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val code: Int) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

sealed class NetworkResponse {
    data class Success(val body: String) : NetworkResponse()
    data class Failure(val error: Throwable) : NetworkResponse()
    object Timeout : NetworkResponse()
}

// ===== Generic Classes =====

class Box<T>(val value: T) {
    fun get(): T = value

    fun <R> map(transform: (T) -> R): Box<R> {
        return Box(transform(value))
    }
}

class Repository<T>(private val storage: MutableList<T> = mutableListOf()) {
    fun add(item: T) {
        storage.add(item)
    }

    fun getAll(): List<T> = storage.toList()

    fun find(predicate: (T) -> Boolean): T? {
        return storage.firstOrNull(predicate)
    }

    fun remove(item: T): Boolean {
        return storage.remove(item)
    }
}

// ===== Extension Functions =====

fun String.toTitleCase(): String {
    return this.split(" ").joinToString(" ") {
        it.replaceFirstChar { char -> char.uppercase() }
    }
}

fun <T> List<T>.second(): T? {
    return if (this.size >= 2) this[1] else null
}

fun Int.isEven(): Boolean = this % 2 == 0

fun Int.isOdd(): Boolean = this % 2 != 0

// ===== Inline Functions =====

inline fun measureTimeMillis(block: () -> Unit): Long {
    val start = System.currentTimeMillis()
    block()
    return System.currentTimeMillis() - start
}

inline fun <T> List<T>.customFilter(predicate: (T) -> Boolean): List<T> {
    val result = mutableListOf<T>()
    for (item in this) {
        if (predicate(item)) {
            result.add(item)
        }
    }
    return result
}

// ===== Higher-Order Functions =====

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

// ===== Delegation =====

interface Base {
    fun printMessage()
    fun printMessageLine()
}

class BaseImpl(val x: Int) : Base {
    override fun printMessage() {
        print(x)
    }

    override fun printMessageLine() {
        println(x)
    }
}

class Derived(b: Base) : Base by b {
    override fun printMessage() {
        print("Derived: ")
    }
}

// ===== Property Delegation =====

class LazyProperty<T>(private val initializer: () -> T) {
    private var value: T? = null

    operator fun getValue(thisRef: Any?, property: Any?): T {
        if (value == null) {
            value = initializer()
        }
        return value!!
    }
}

class User {
    val name: String by lazy { fetchNameFromDb() }
    var address: String by observable("") { prop, old, new ->
        println("Address changed from $old to $new")
    }

    private fun fetchNameFromDb(): String {
        return "John Doe"
    }

    private fun observable(initialValue: String, onChange: (Any?, String, String) -> Unit): Any {
        return initialValue
    }
}

// ===== Coroutines =====

class ApiService {
    suspend fun fetchUser(id: Int): Result<User> {
        delay(1000) // Simulate network delay
        return Result.Success(User())
    }

    suspend fun fetchPosts(): Result<List<Post>> {
        delay(500)
        return Result.Success(listOf())
    }

    fun getUserAsync(id: Int): Deferred<User> = GlobalScope.async {
        delay(1000)
        User()
    }
}

class Post(val id: Int, val title: String, val body: String)

// ===== Builder Pattern =====

class HttpClient private constructor(
    val baseUrl: String,
    val timeout: Long,
    val retries: Int
) {
    class Builder {
        private var baseUrl: String = ""
        private var timeout: Long = 30000
        private var retries: Int = 3

        fun baseUrl(url: String) = apply { this.baseUrl = url }
        fun timeout(ms: Long) = apply { this.timeout = ms }
        fun retries(count: Int) = apply { this.retries = count }

        fun build(): HttpClient {
            require(baseUrl.isNotEmpty()) { "Base URL is required" }
            return HttpClient(baseUrl, timeout, retries)
        }
    }

    companion object {
        fun builder() = Builder()
    }
}

// ===== Type Aliases =====

typealias UserId = Int
typealias UserName = String
typealias Callback<T> = (Result<T>) -> Unit

class UserService {
    fun fetchUser(id: UserId, callback: Callback<User>) {
        // Simulate async operation
        callback(Result.Success(User()))
    }
}

// ===== Nested and Inner Classes =====

class Outer {
    private val bar: Int = 1

    class Nested {
        fun foo() = 2
    }

    inner class Inner {
        fun foo() = bar
    }
}

// ===== Object Expressions =====

interface ClickListener {
    fun onClick()
    fun onLongClick()
}

fun createClickListener(name: String): ClickListener {
    return object : ClickListener {
        override fun onClick() {
            println("$name clicked")
        }

        override fun onLongClick() {
            println("$name long clicked")
        }
    }
}
