// Web service demonstrating annotations, generics, and Spring-like patterns
package com.example.web;

import java.util.List;
import java.util.Optional;
import java.util.Map;

/**
 * Generic Response wrapper
 */
public class Response<T> {
    private int statusCode;
    private T data;
    private String message;

    public Response(int statusCode, T data, String message) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public T getData() {
        return data;
    }

    public String getMessage() {
        return message;
    }

    public static <T> Response<T> success(T data) {
        return new Response<>(200, data, "Success");
    }

    public static <T> Response<T> error(String message) {
        return new Response<>(500, null, message);
    }
}

/**
 * User entity
 */
class User {
    private Long id;
    private String username;
    private String email;
    private boolean active;

    public User(Long id, String username, String email) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.active = true;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}

/**
 * Repository interface for data access
 */
interface UserRepository {
    Optional<User> findById(Long id);
    List<User> findAll();
    User save(User user);
    void delete(Long id);
}

/**
 * Service layer interface
 */
interface UserService {
    Response<User> createUser(String username, String email);
    Response<User> getUser(Long id);
    Response<List<User>> getAllUsers();
    Response<Void> deleteUser(Long id);
}

/**
 * Implementation of UserService
 */
public class UserServiceImpl implements UserService {
    private final UserRepository repository;

    public UserServiceImpl(UserRepository repository) {
        this.repository = repository;
    }

    @Override
    public Response<User> createUser(String username, String email) {
        try {
            User user = new User(generateId(), username, email);
            User saved = repository.save(user);
            return Response.success(saved);
        } catch (Exception e) {
            return Response.error("Failed to create user: " + e.getMessage());
        }
    }

    @Override
    public Response<User> getUser(Long id) {
        Optional<User> user = repository.findById(id);
        if (user.isPresent()) {
            return Response.success(user.get());
        } else {
            return Response.error("User not found");
        }
    }

    @Override
    public Response<List<User>> getAllUsers() {
        try {
            List<User> users = repository.findAll();
            return Response.success(users);
        } catch (Exception e) {
            return Response.error("Failed to fetch users");
        }
    }

    @Override
    public Response<Void> deleteUser(Long id) {
        try {
            repository.delete(id);
            return new Response<>(200, null, "User deleted");
        } catch (Exception e) {
            return Response.error("Failed to delete user");
        }
    }

    private Long generateId() {
        return System.currentTimeMillis();
    }
}

/**
 * HTTP Status codes
 */
enum HttpStatus {
    OK(200),
    CREATED(201),
    BAD_REQUEST(400),
    NOT_FOUND(404),
    INTERNAL_ERROR(500);

    private final int code;

    HttpStatus(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}

/**
 * Generic DAO interface
 */
interface GenericDAO<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void delete(ID id);
    long count();
}

/**
 * Configuration class
 */
public class AppConfig {
    private String databaseUrl;
    private int maxConnections;
    private boolean enableLogging;

    public AppConfig() {
        this.databaseUrl = "jdbc:postgresql://localhost:5432/mydb";
        this.maxConnections = 10;
        this.enableLogging = true;
    }

    public String getDatabaseUrl() {
        return databaseUrl;
    }

    public void setDatabaseUrl(String databaseUrl) {
        this.databaseUrl = databaseUrl;
    }

    public int getMaxConnections() {
        return maxConnections;
    }

    public void setMaxConnections(int maxConnections) {
        this.maxConnections = maxConnections;
    }

    public boolean isEnableLogging() {
        return enableLogging;
    }

    public void setEnableLogging(boolean enableLogging) {
        this.enableLogging = enableLogging;
    }
}
