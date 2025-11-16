# API Design

## Overview
Design RESTful, GraphQL, and other API architectures following industry best practices, focusing on developer experience, performance, and maintainability.

## Core Principles

### 1. RESTful Design
- Resource-oriented URL structure
- Proper HTTP method usage (GET, POST, PUT, PATCH, DELETE)
- Stateless communication
- HATEOAS when appropriate

### 2. GraphQL Design
- Schema-first approach
- Efficient resolver implementation
- Query complexity analysis
- Pagination and batching strategies

### 3. API Versioning
- URL versioning (`/v1/`, `/v2/`)
- Header versioning (`Accept: application/vnd.api+json; version=1`)
- Deprecation policies and timelines

### 4. Error Handling
- Consistent error response structure
- Meaningful HTTP status codes
- Detailed error messages for debugging
- Error code cataloging

### 5. Authentication & Authorization
- Token-based authentication (JWT, OAuth 2.0)
- API key management
- Rate limiting per user/client
- Scope-based permissions

## Design Patterns

### Request/Response Patterns
```
GET /api/v1/resources/{id}
→ 200 OK with resource
→ 404 Not Found
→ 401 Unauthorized

POST /api/v1/resources
→ 201 Created with Location header
→ 400 Bad Request with validation errors
→ 409 Conflict for duplicates
```

### Pagination
- Cursor-based for large datasets
- Offset/limit for smaller datasets
- Include metadata (total count, has_next, cursors)

### Filtering & Sorting
- Query parameters: `?filter[status]=active&sort=-created_at`
- Standardized field names
- Documentation of supported operators

## Documentation Standards

### OpenAPI/Swagger
- Complete endpoint descriptions
- Request/response schemas
- Example payloads
- Authentication requirements

### API Documentation Must Include
- Quick start guide
- Authentication flow
- Rate limits
- Error codes reference
- Changelog with version history

## Performance Considerations

### 1. Response Optimization
- Minimal payload size
- Field selection (`?fields=id,name`)
- Compression (gzip, brotli)
- Caching headers (ETag, Cache-Control)

### 2. Request Optimization
- Batch endpoints for multiple operations
- Webhook support for async operations
- WebSocket for real-time updates

### 3. Monitoring
- Response time percentiles (p50, p95, p99)
- Error rates by endpoint
- Rate limit hit metrics
- Payload size distribution

## Security Guidelines

### Input Validation
- Schema validation for all requests
- Sanitize user input
- Size limits on payloads
- Content-type verification

### Rate Limiting
- Per-endpoint limits
- User/API key throttling
- Gradual backoff responses
- 429 Too Many Requests with Retry-After

### CORS Configuration
- Explicit origin whitelisting
- Credential handling
- Preflight request caching

## Contract Testing

### Schema Validation
- Request validation against OpenAPI spec
- Response validation
- Breaking change detection

### Backward Compatibility
- Additive changes only (new fields)
- Deprecation warnings before removal
- Versioning for breaking changes

## Tools & Technologies

### Design
- OpenAPI 3.x specification
- Postman/Insomnia for testing
- GraphQL Playground
- API Blueprint

### Testing
- Contract testing (Pact)
- Load testing (k6, JMeter)
- Security scanning (OWASP ZAP)

### Documentation
- Swagger UI
- ReDoc
- GraphQL Voyager
- Stoplight Studio

## Checklist for New API

- [ ] OpenAPI spec created and validated
- [ ] Authentication/authorization implemented
- [ ] Rate limiting configured
- [ ] Error responses standardized
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Response caching strategy defined
- [ ] API documentation published
- [ ] Monitoring/alerting set up
- [ ] Contract tests written
- [ ] Load testing performed
- [ ] Security audit completed
