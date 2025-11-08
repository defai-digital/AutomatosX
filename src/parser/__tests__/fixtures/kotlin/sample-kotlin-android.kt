/**
 * sample-kotlin-android.kt
 * Android and JVM Kotlin patterns
 */

package com.example.android

import androidx.lifecycle.ViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

// ===== Android ViewModel =====

class UserViewModel : ViewModel() {
    private val _users = MutableLiveData<List<User>>()
    val users: LiveData<List<User>> = _users

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    fun loadUsers() {
        _loading.value = true
        // Simulate data loading
        _users.value = listOf(
            User(1, "Alice"),
            User(2, "Bob")
        )
        _loading.value = false
    }

    fun addUser(user: User) {
        val currentList = _users.value.orEmpty().toMutableList()
        currentList.add(user)
        _users.value = currentList
    }
}

// ===== Data Classes for Android =====

data class User(
    val id: Int,
    val name: String,
    val email: String? = null
)

data class Post(
    val id: Int,
    val userId: Int,
    val title: String,
    val body: String,
    val timestamp: Long = System.currentTimeMillis()
)

data class Comment(
    val id: Int,
    val postId: Int,
    val authorId: Int,
    val text: String
)

// ===== Repository Pattern =====

interface UserRepository {
    suspend fun getUsers(): List<User>
    suspend fun getUserById(id: Int): User?
    suspend fun createUser(user: User): Result<User>
    suspend fun updateUser(user: User): Result<User>
    suspend fun deleteUser(id: Int): Result<Boolean>
}

class UserRepositoryImpl(
    private val apiService: ApiService,
    private val database: AppDatabase
) : UserRepository {
    override suspend fun getUsers(): List<User> {
        return try {
            val users = apiService.fetchUsers()
            database.userDao().insertAll(users)
            users
        } catch (e: Exception) {
            database.userDao().getAll()
        }
    }

    override suspend fun getUserById(id: Int): User? {
        return database.userDao().getUserById(id)
            ?: apiService.fetchUserById(id)
    }

    override suspend fun createUser(user: User): Result<User> {
        return try {
            val createdUser = apiService.createUser(user)
            database.userDao().insert(createdUser)
            Result.Success(createdUser)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to create user", 500)
        }
    }

    override suspend fun updateUser(user: User): Result<User> {
        return try {
            val updatedUser = apiService.updateUser(user)
            database.userDao().update(updatedUser)
            Result.Success(updatedUser)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to update user", 500)
        }
    }

    override suspend fun deleteUser(id: Int): Result<Boolean> {
        return try {
            apiService.deleteUser(id)
            database.userDao().deleteById(id)
            Result.Success(true)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to delete user", 500)
        }
    }
}

// ===== API Service =====

interface ApiService {
    suspend fun fetchUsers(): List<User>
    suspend fun fetchUserById(id: Int): User
    suspend fun createUser(user: User): User
    suspend fun updateUser(user: User): User
    suspend fun deleteUser(id: Int)
    suspend fun fetchPosts(userId: Int): List<Post>
}

class ApiServiceImpl(private val baseUrl: String) : ApiService {
    override suspend fun fetchUsers(): List<User> {
        // HTTP call implementation
        return emptyList()
    }

    override suspend fun fetchUserById(id: Int): User {
        // HTTP call implementation
        return User(id, "User $id")
    }

    override suspend fun createUser(user: User): User {
        // HTTP POST implementation
        return user.copy(id = generateId())
    }

    override suspend fun updateUser(user: User): User {
        // HTTP PUT implementation
        return user
    }

    override suspend fun deleteUser(id: Int) {
        // HTTP DELETE implementation
    }

    override suspend fun fetchPosts(userId: Int): List<Post> {
        // HTTP call implementation
        return emptyList()
    }

    private fun generateId(): Int {
        return (1..10000).random()
    }
}

// ===== Database Interfaces =====

interface UserDao {
    fun getAll(): List<User>
    fun getUserById(id: Int): User?
    fun insert(user: User)
    fun insertAll(users: List<User>)
    fun update(user: User)
    fun deleteById(id: Int)
}

interface AppDatabase {
    fun userDao(): UserDao
    fun postDao(): PostDao
}

interface PostDao {
    fun getPostsByUserId(userId: Int): List<Post>
    fun insert(post: Post)
}

// ===== Use Cases =====

class GetUsersUseCase(private val repository: UserRepository) {
    suspend operator fun invoke(): Result<List<User>> {
        return try {
            val users = repository.getUsers()
            Result.Success(users)
        } catch (e: Exception) {
            Result.Error(e.message ?: "Failed to get users", 500)
        }
    }
}

class CreateUserUseCase(private val repository: UserRepository) {
    suspend operator fun invoke(name: String, email: String?): Result<User> {
        val user = User(0, name, email)
        return repository.createUser(user)
    }
}

class DeleteUserUseCase(private val repository: UserRepository) {
    suspend operator fun invoke(userId: Int): Result<Boolean> {
        return repository.deleteUser(userId)
    }
}

// ===== Flow-based Data Streams =====

class PostViewModel : ViewModel() {
    fun observePosts(userId: Int): Flow<List<Post>> = flow {
        // Emit initial empty list
        emit(emptyList())

        // Simulate loading posts
        kotlinx.coroutines.delay(1000)
        emit(listOf(
            Post(1, userId, "First Post", "Content 1"),
            Post(2, userId, "Second Post", "Content 2")
        ))
    }

    fun searchPosts(query: String): Flow<List<Post>> = flow {
        // Simulate search with debounce
        kotlinx.coroutines.delay(300)
        emit(emptyList()) // Return filtered results
    }
}

// ===== Sealed Class for UI State =====

sealed class UiState<out T> {
    object Idle : UiState<Nothing>()
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}

class MainViewModel : ViewModel() {
    private val _uiState = MutableLiveData<UiState<List<User>>>(UiState.Idle)
    val uiState: LiveData<UiState<List<User>>> = _uiState

    suspend fun loadData() {
        _uiState.value = UiState.Loading
        try {
            // Simulate API call
            kotlinx.coroutines.delay(1000)
            val users = listOf(User(1, "Alice"), User(2, "Bob"))
            _uiState.value = UiState.Success(users)
        } catch (e: Exception) {
            _uiState.value = UiState.Error(e.message ?: "Unknown error")
        }
    }
}

// ===== Dependency Injection =====

object AppModule {
    fun provideApiService(): ApiService {
        return ApiServiceImpl("https://api.example.com")
    }

    fun provideUserRepository(apiService: ApiService, database: AppDatabase): UserRepository {
        return UserRepositoryImpl(apiService, database)
    }

    fun provideGetUsersUseCase(repository: UserRepository): GetUsersUseCase {
        return GetUsersUseCase(repository)
    }
}

// ===== Event Handling =====

sealed class UserEvent {
    data class LoadUsers(val forceRefresh: Boolean) : UserEvent()
    data class SelectUser(val userId: Int) : UserEvent()
    data class CreateUser(val name: String, val email: String?) : UserEvent()
    data class DeleteUser(val userId: Int) : UserEvent()
}

class UserEventHandler(private val repository: UserRepository) {
    suspend fun handleEvent(event: UserEvent): Result<Any> {
        return when (event) {
            is UserEvent.LoadUsers -> {
                val users = repository.getUsers()
                Result.Success(users)
            }
            is UserEvent.SelectUser -> {
                val user = repository.getUserById(event.userId)
                if (user != null) {
                    Result.Success(user)
                } else {
                    Result.Error("User not found", 404)
                }
            }
            is UserEvent.CreateUser -> {
                val user = User(0, event.name, event.email)
                repository.createUser(user)
            }
            is UserEvent.DeleteUser -> {
                repository.deleteUser(event.userId)
            }
        }
    }
}
