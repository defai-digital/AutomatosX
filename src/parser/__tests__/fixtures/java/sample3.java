// Advanced Java patterns: abstract classes, inner classes, functional interfaces
package com.example.advanced;

import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Abstract Shape class
 */
public abstract class Shape {
    protected double x;
    protected double y;

    public Shape(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public abstract double area();
    public abstract double perimeter();

    public void moveTo(double newX, double newY) {
        this.x = newX;
        this.y = newY;
    }
}

/**
 * Rectangle implementation
 */
class Rectangle extends Shape {
    private double width;
    private double height;

    public Rectangle(double x, double y, double width, double height) {
        super(x, y);
        this.width = width;
        this.height = height;
    }

    @Override
    public double area() {
        return width * height;
    }

    @Override
    public double perimeter() {
        return 2 * (width + height);
    }

    public double getWidth() {
        return width;
    }

    public double getHeight() {
        return height;
    }
}

/**
 * Circle implementation
 */
class Circle extends Shape {
    private double radius;

    public Circle(double x, double y, double radius) {
        super(x, y);
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }

    @Override
    public double perimeter() {
        return 2 * Math.PI * radius;
    }

    public double getRadius() {
        return radius;
    }
}

/**
 * Functional interface for transformation
 */
@FunctionalInterface
interface Transformer<T, R> {
    R transform(T input);
}

/**
 * Validator functional interface
 */
@FunctionalInterface
interface Validator<T> {
    boolean validate(T value);
}

/**
 * Generic processor with inner classes
 */
public class DataProcessor<T> {
    private T data;

    public DataProcessor(T data) {
        this.data = data;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public <R> R process(Transformer<T, R> transformer) {
        return transformer.transform(data);
    }

    public boolean validate(Validator<T> validator) {
        return validator.validate(data);
    }

    /**
     * Inner class for processing results
     */
    public class ProcessingResult {
        private boolean success;
        private String message;

        public ProcessingResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }

        public boolean isSuccess() {
            return success;
        }

        public String getMessage() {
            return message;
        }

        public T getOriginalData() {
            return DataProcessor.this.data;
        }
    }

    /**
     * Static nested class for configuration
     */
    public static class Config {
        private int batchSize;
        private boolean parallel;

        public Config(int batchSize, boolean parallel) {
            this.batchSize = batchSize;
            this.parallel = parallel;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public boolean isParallel() {
            return parallel;
        }
    }
}

/**
 * Builder pattern example
 */
class QueryBuilder {
    private String table;
    private String whereClause;
    private String orderBy;
    private int limit;

    private QueryBuilder() {
    }

    public static QueryBuilder create() {
        return new QueryBuilder();
    }

    public QueryBuilder from(String table) {
        this.table = table;
        return this;
    }

    public QueryBuilder where(String condition) {
        this.whereClause = condition;
        return this;
    }

    public QueryBuilder orderBy(String field) {
        this.orderBy = field;
        return this;
    }

    public QueryBuilder limit(int limit) {
        this.limit = limit;
        return this;
    }

    public String build() {
        StringBuilder sql = new StringBuilder("SELECT * FROM " + table);
        if (whereClause != null) {
            sql.append(" WHERE ").append(whereClause);
        }
        if (orderBy != null) {
            sql.append(" ORDER BY ").append(orderBy);
        }
        if (limit > 0) {
            sql.append(" LIMIT ").append(limit);
        }
        return sql.toString();
    }
}

/**
 * Singleton pattern example
 */
class DatabaseConnection {
    private static DatabaseConnection instance;
    private String connectionString;

    private DatabaseConnection() {
        this.connectionString = "jdbc:postgresql://localhost:5432/db";
    }

    public static synchronized DatabaseConnection getInstance() {
        if (instance == null) {
            instance = new DatabaseConnection();
        }
        return instance;
    }

    public String getConnectionString() {
        return connectionString;
    }

    public void setConnectionString(String connectionString) {
        this.connectionString = connectionString;
    }
}

/**
 * Exception hierarchy
 */
class DataException extends Exception {
    public DataException(String message) {
        super(message);
    }

    public DataException(String message, Throwable cause) {
        super(message, cause);
    }
}

class ValidationException extends DataException {
    public ValidationException(String message) {
        super(message);
    }
}

class ProcessingException extends DataException {
    public ProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
