# Database Modeling

## Overview
Design efficient, scalable, and maintainable database schemas for relational and NoSQL databases, focusing on data integrity, performance, and evolution.

## Core Principles

### 1. Normalization & Denormalization
- 3NF for transactional systems
- Strategic denormalization for read-heavy workloads
- Balance between data integrity and query performance

### 2. Data Integrity
- Primary keys on all tables
- Foreign key constraints
- Check constraints for data validation
- Unique constraints for business rules

### 3. Indexing Strategy
- Primary key indexes (clustered)
- Secondary indexes for frequent queries
- Composite indexes for multi-column filters
- Index maintenance and statistics

### 4. Schema Evolution
- Migration strategy (forward-only)
- Backward compatibility during deploys
- Column additions vs. breaking changes
- Versioning for schema changes

## Relational Database Design

### Table Design Essentials
- Primary key (BIGSERIAL, UUID)
- Timestamps (created_at, updated_at)
- Soft delete (deleted_at)
- Proper data types

### Relationship Patterns
- One-to-Many: Foreign key in child table
- Many-to-Many: Junction table with composite primary key
- One-to-One: Rare; consider column addition instead

### Partitioning Strategies
- Range partitioning (dates, IDs)
- List partitioning (regions, categories)
- Hash partitioning (even distribution)
- When to partition: >10M rows, predictable access patterns

## NoSQL Design Patterns

### Document Stores (MongoDB, DynamoDB)
- Embed vs. reference decision tree
- Avoid unbounded arrays
- Duplicate data strategically
- Query pattern drives schema

### Key-Value Stores (Redis, DynamoDB)
- Compound key design
- TTL for expiring data
- Secondary indexes trade-offs

### Graph Databases (Neo4j)
- Node and relationship properties
- Index on frequently queried properties
- Cypher query optimization

## Performance Optimization

### Query Performance
- EXPLAIN ANALYZE for execution plans
- Index usage verification
- Avoid N+1 queries (eager loading)
- Connection pooling configuration

### Write Optimization
- Batch inserts for bulk data
- Async writes for non-critical data
- Write-ahead logging (WAL) tuning

### Read Optimization
- Read replicas for scaling
- Query result caching
- Materialized views for complex aggregations

## Data Types Best Practices

### Choosing Types
- VARCHAR vs. TEXT vs. CHAR
- INTEGER vs. BIGINT (consider growth)
- DECIMAL for money (never FLOAT)
- TIMESTAMPTZ for dates (always use timezone)
- JSON/JSONB for semi-structured data

### Type Performance
- Smaller types = better performance
- Fixed-length types for indexes
- Avoid TEXT in WHERE clauses without indexes

## Migration Strategies

### Safe Migration Patterns
1. Add nullable column → Backfill → Add NOT NULL
2. Create new table → Dual write → Swap → Drop old
3. Add index CONCURRENTLY (PostgreSQL)
4. Rename via view (zero-downtime)

### Rollback Strategies
- Idempotent migrations
- Reversible changes
- Feature flags for data migrations
- Separate schema and data migrations

## Security & Compliance

### Access Control
- Principle of least privilege
- Row-level security (RLS)
- Column-level permissions
- Audit logging for sensitive data

### Data Encryption
- Encryption at rest
- Encryption in transit (SSL/TLS)
- Column-level encryption for PII
- Key rotation policies

### GDPR/Privacy
- Soft delete vs. hard delete
- Data retention policies
- PII identification and protection
- Right to be forgotten implementation

## Common Patterns

### Soft Delete
Use `deleted_at` timestamp with partial index

### Audit Trails
Track created_at, created_by, updated_at, updated_by

### Status/State Machine
Use CHECK constraints for valid states

## Design Checklist

- [ ] All tables have primary keys
- [ ] Foreign key constraints defined
- [ ] Indexes cover frequent query patterns
- [ ] Data types appropriately sized
- [ ] Nullable columns justified
- [ ] Constraints enforce business rules
- [ ] Migration scripts tested
- [ ] Rollback plan documented
- [ ] Performance testing completed
- [ ] Schema documented
- [ ] Backup/restore verified
- [ ] Security audit completed
