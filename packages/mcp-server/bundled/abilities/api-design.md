---
abilityId: api-design
displayName: API Design
category: backend
tags: [api, rest, graphql, design]
priority: 80
---

# API Design Best Practices

## RESTful API Design

### Resource Naming
- Use nouns, not verbs: `/users` not `/getUsers`
- Use plural forms: `/users`, `/orders`, `/products`
- Use kebab-case for multi-word resources: `/order-items`
- Nest resources logically: `/users/{id}/orders`

### HTTP Methods
- GET: Retrieve resources (idempotent, safe)
- POST: Create new resources
- PUT: Replace entire resource (idempotent)
- PATCH: Partial update (not idempotent)
- DELETE: Remove resource (idempotent)

### Status Codes
- 200 OK: Successful GET/PUT/PATCH
- 201 Created: Successful POST with resource creation
- 204 No Content: Successful DELETE
- 400 Bad Request: Invalid input
- 401 Unauthorized: Missing/invalid authentication
- 403 Forbidden: Valid auth but no permission
- 404 Not Found: Resource doesn't exist
- 409 Conflict: Resource state conflict
- 422 Unprocessable Entity: Validation error
- 500 Internal Server Error: Server-side error

### Pagination
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Filtering and Sorting
- Filter: `?status=active&type=premium`
- Sort: `?sort=createdAt:desc,name:asc`
- Search: `?q=searchterm`

### Versioning
- URL path: `/api/v1/users` (recommended)
- Header: `Accept: application/vnd.api+json;version=1`
- Query: `?version=1` (not recommended)

## GraphQL Design

### Schema Design
- Use meaningful type names
- Keep queries focused and specific
- Use input types for mutations
- Implement pagination with connections

### Query Patterns
```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, first: Int, after: String): UserConnection
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {"field": "email", "message": "Invalid email format"}
    ]
  }
}
```

## Security Considerations

- Always use HTTPS
- Implement rate limiting
- Validate all input
- Use authentication tokens (JWT, OAuth)
- Sanitize output to prevent XSS
- Implement CORS properly
