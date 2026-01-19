---
abilityId: db-modeling
displayName: Database Modeling
category: backend
tags: [database, sql, modeling, schema]
priority: 80
---

# Database Modeling Best Practices

## Schema Design Principles

### Normalization Levels

**1NF (First Normal Form)**
- Eliminate repeating groups
- Each column contains atomic values

**2NF (Second Normal Form)**
- Meet 1NF
- Remove partial dependencies

**3NF (Third Normal Form)**
- Meet 2NF
- Remove transitive dependencies

### When to Denormalize
- Read-heavy workloads
- Complex joins hurting performance
- Reporting and analytics
- Caching frequently accessed data

## Table Design

### Primary Keys
```sql
-- UUID for distributed systems
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);

-- Serial for single-database systems
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  ...
);

-- Composite key for junction tables
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

### Foreign Keys
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index foreign keys for join performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

### Timestamps and Audit Fields
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- Auto-update timestamp trigger
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Indexing Strategy

### Index Types
```sql
-- B-tree (default) - equality and range queries
CREATE INDEX idx_users_email ON users(email);

-- Hash - equality only (faster for exact matches)
CREATE INDEX idx_users_username ON users USING hash(username);

-- GIN - full-text search, arrays, JSONB
CREATE INDEX idx_documents_content ON documents USING gin(to_tsvector('english', content));
CREATE INDEX idx_users_tags ON users USING gin(tags);

-- GiST - geometric data, full-text
CREATE INDEX idx_locations_geom ON locations USING gist(geom);
```

### Composite Indexes
```sql
-- Order matters! Most selective first
CREATE INDEX idx_orders_status_date ON orders(status, created_at);

-- Covering index (includes all needed columns)
CREATE INDEX idx_orders_covering ON orders(user_id) INCLUDE (status, total);
```

### Partial Indexes
```sql
-- Only index active records
CREATE INDEX idx_users_active_email ON users(email) WHERE active = true;

-- Only index non-null values
CREATE INDEX idx_orders_shipped ON orders(shipped_at) WHERE shipped_at IS NOT NULL;
```

## Query Optimization

### EXPLAIN ANALYZE
```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 10;
```

### Common Optimizations
```sql
-- Use EXISTS instead of IN for large subqueries
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- Avoid SELECT *
SELECT id, name, email FROM users WHERE active = true;

-- Use LIMIT with ORDER BY
SELECT * FROM logs ORDER BY created_at DESC LIMIT 100;

-- Batch inserts
INSERT INTO logs (level, message, created_at)
VALUES
  ('info', 'msg1', NOW()),
  ('error', 'msg2', NOW()),
  ('warn', 'msg3', NOW());
```

## Data Types

### Choosing Types
```sql
-- Text types
VARCHAR(n)  -- Variable length with limit
TEXT        -- Unlimited length
CHAR(n)     -- Fixed length (padded)

-- Numeric types
INTEGER     -- -2B to 2B
BIGINT      -- Larger range
NUMERIC(p,s)-- Exact decimal (money)
REAL/DOUBLE -- Approximate (scientific)

-- Date/Time
TIMESTAMPTZ -- Always use with timezone
DATE        -- Date only
INTERVAL    -- Duration

-- Other
UUID        -- Universally unique ID
JSONB       -- Binary JSON (indexed)
BOOLEAN     -- true/false
BYTEA       -- Binary data
```

## Migrations Best Practices

```sql
-- Always use transactions
BEGIN;

-- Add columns as nullable first
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- Backfill data
UPDATE users SET phone = '' WHERE phone IS NULL;

-- Then add constraints
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

COMMIT;

-- For large tables, use batched updates
DO $$
DECLARE
  batch_size INT := 10000;
BEGIN
  LOOP
    UPDATE users SET phone = ''
    WHERE phone IS NULL
    AND id IN (SELECT id FROM users WHERE phone IS NULL LIMIT batch_size);

    EXIT WHEN NOT FOUND;
    COMMIT;
  END LOOP;
END $$;
```

## Anti-Patterns to Avoid

- Using `SELECT *` in production code
- Missing indexes on foreign keys
- Not using transactions
- Storing comma-separated values
- Using reserved words as column names
- Not handling NULL properly
- Over-indexing (indexes slow writes)
