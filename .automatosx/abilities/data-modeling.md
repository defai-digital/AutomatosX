# Data Modeling

## Overview
Design efficient, scalable data models for relational and NoSQL databases. Focus on normalization, relationships, and schema design that supports business requirements while maintaining data integrity.

## Core Principles

### 1. Normalization (Relational)
Eliminate data redundancy through normal forms (1NF, 2NF, 3NF, BCNF).

### 2. Denormalization (When Needed)
Strategic denormalization for read-heavy workloads and performance optimization.

### 3. Schema Design Patterns
- **Star Schema**: Dimensional modeling for analytics (fact + dimension tables)
- **Snowflake Schema**: Normalized dimensional model
- **Data Vault**: Flexible, auditable data warehouse modeling

## Do's ✅

### Relational Data Model
```sql
-- ✅ Good: Normalized design
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_amount DECIMAL(10,2),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  price DECIMAL(10,2)
);
```

### Indexes
```sql
-- ✅ Good: Index frequently queried columns
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ✅ Good: Composite index for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

### NoSQL Data Model (MongoDB)
```javascript
// ✅ Good: Embedded documents for one-to-few
{
  _id: ObjectId("..."),
  user_email: "user@example.com",
  addresses: [
    { type: "home", street: "123 Main St", city: "NYC" },
    { type: "work", street: "456 Office Ave", city: "LA" }
  ]
}

// ✅ Good: References for one-to-many
// User document
{
  _id: ObjectId("user123"),
  email: "user@example.com"
}

// Order documents (separate collection)
{
  _id: ObjectId("order456"),
  user_id: ObjectId("user123"),
  items: [...],
  total: 99.99
}
```

## Don'ts ❌

### Over-Normalization
```sql
-- ❌ Bad: Excessive normalization
CREATE TABLE user_first_names (
  user_id INTEGER REFERENCES users(id),
  first_name VARCHAR(100)
);

CREATE TABLE user_last_names (
  user_id INTEGER REFERENCES users(id),
  last_name VARCHAR(100)
);

-- ✅ Good: Appropriate normalization
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE
);
```

### Missing Constraints
```sql
-- ❌ Bad: No constraints
CREATE TABLE orders (
  id INTEGER,
  user_id INTEGER,
  total DECIMAL
);

-- ✅ Good: Proper constraints
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total DECIMAL(10,2) CHECK (total >= 0),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Embedding Large Arrays (NoSQL)
```javascript
// ❌ Bad: Unbounded array growth
{
  user_id: "user123",
  orders: [ /* Could grow to thousands */ ]
}

// ✅ Good: Reference pattern
{
  user_id: "user123",
  recent_orders: [ /* Last 5 orders */ ],
  total_order_count: 1247
}
// Store full orders in separate collection
```

## Best Practices

### 1. Use Appropriate Data Types
- `TIMESTAMP` for dates (not VARCHAR)
- `DECIMAL` for money (not FLOAT)
- `ENUM` or `CHECK` constraints for fixed options
- `UUID` for distributed primary keys

### 2. Plan for Growth
- Partition large tables by date/region
- Use sharding for horizontal scalability
- Implement archival strategy for old data

### 3. Document Relationships
```
Users (1) ← (M) Orders (1) ← (M) OrderItems (M) → (1) Products
```

### 4. Version Schema Changes
Use migration tools (Flyway, Liquibase, Alembic) for schema versioning.

## Resources

- [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization)
- [MongoDB Schema Design Patterns](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
