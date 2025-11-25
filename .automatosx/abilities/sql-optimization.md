# SQL Optimization

## Overview
Optimize SQL queries for performance through proper indexing, query structure, and execution plan analysis. Focus on reducing query time, minimizing resource usage, and scaling efficiently.

## Do's ✅

### Use Indexes Effectively
```sql
-- ✅ Good: Index on WHERE clause columns
CREATE INDEX idx_users_email ON users(email);
SELECT * FROM users WHERE email = 'user@example.com';

-- ✅ Good: Composite index for multi-column queries
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
SELECT * FROM orders WHERE user_id = 123 AND created_at > '2024-01-01';
```

### Use EXPLAIN to Analyze
```sql
-- ✅ Always check execution plan
EXPLAIN ANALYZE
SELECT * FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.created_at > '2024-01-01';
```

### Limit Result Sets
```sql
-- ✅ Good: Use LIMIT for pagination
SELECT * FROM products
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

-- ✅ Good: Use EXISTS instead of COUNT
SELECT EXISTS(SELECT 1 FROM users WHERE email = 'test@example.com');
```

## Don'ts ❌

### N+1 Query Problem
```sql
-- ❌ Bad: N+1 queries
for each user:
  SELECT * FROM orders WHERE user_id = user.id;

-- ✅ Good: Single JOIN query
SELECT u.*, o.*
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
```

### SELECT *
```sql
-- ❌ Bad: Fetching unnecessary columns
SELECT * FROM users;

-- ✅ Good: Select only needed columns
SELECT id, email, name FROM users;
```

### Function on Indexed Column
```sql
-- ❌ Bad: Function prevents index usage
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';

-- ✅ Good: Function index or direct comparison
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
-- OR store email in lowercase
SELECT * FROM users WHERE email = 'test@example.com';
```

## Best Practices

1. **Index foreign keys** used in JOINs
2. **Use connection pooling** to reduce overhead
3. **Batch operations** instead of row-by-row
4. **Monitor slow queries** with database logs
5. **Use appropriate data types** (INT vs BIGINT)

## Resources
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [MySQL Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)
