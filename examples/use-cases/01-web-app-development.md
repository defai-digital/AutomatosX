# Use Case: Web Application Development

Complete workflow for building a web application with AutomatosX.

## Scenario

Building a task management web app with user authentication, CRUD operations, and real-time updates.

## Prerequisites

```bash
# Initialize project
mkdir task-manager
cd task-manager
npm init -y

# Initialize AutomatosX
automatosx setup

# Set up API keys
automatosx config --set providers.claude.apiKey --value "sk-ant-..."
```

## Step 1: Project Planning

```bash
automatosx chat backend

> "I want to build a task management web app with:
  - User authentication (JWT)
  - Task CRUD operations
  - Real-time updates (WebSocket)
  - RESTful API (Express.js)
  - React frontend

  Please help me plan the architecture and tech stack."

# Agent will suggest:
# - Project structure
# - Technology choices
# - API design
# - Database schema
# - Security considerations
```

## Step 2: Backend Setup

### Generate Express.js Server

```bash
automatosx run backend "Create an Express.js server with:
- TypeScript configuration
- Basic middleware (cors, helmet, morgan)
- Error handling
- Environment variables setup"

# Creates:
# - src/server.ts
# - src/config/env.ts
# - src/middleware/errorHandler.ts
# - tsconfig.json
```

### Database Schema

```bash
automatosx run backend "Create Prisma schema for:
- User model (id, email, password, name, createdAt)
- Task model (id, title, description, status, userId, createdAt, updatedAt)
- Relationships between User and Tasks"

# Creates:
# - prisma/schema.prisma
# - Migration files
```

### Authentication System

```bash
automatosx run backend "Implement JWT authentication with:
- User registration endpoint
- Login endpoint
- Password hashing with bcrypt
- JWT token generation
- Auth middleware for protected routes"

# Creates:
# - src/controllers/auth.controller.ts
# - src/middleware/auth.middleware.ts
# - src/utils/jwt.ts
# - src/routes/auth.routes.ts
```

## Step 3: API Development

### Task CRUD Operations

```bash
automatosx run backend "Create RESTful API for tasks:
- GET /api/tasks - List user's tasks
- GET /api/tasks/:id - Get single task
- POST /api/tasks - Create task
- PUT /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task

Include:
- Request validation
- Error handling
- Pagination for list endpoint"

# Creates:
# - src/controllers/tasks.controller.ts
# - src/routes/tasks.routes.ts
# - src/validators/task.validator.ts
```

## Step 4: Code Review

```bash
# Review authentication logic
automatosx run quality "Review src/controllers/auth.controller.ts for:
- Security vulnerabilities
- Error handling
- Best practices"

# Review API endpoints
automatosx run quality "Review src/routes/ directory for:
- RESTful design
- Validation
- Error responses"
```

## Step 5: Testing

### Unit Tests

```bash
automatosx run backend "Create unit tests for authentication controller using Jest:
- Test user registration with valid data
- Test registration with existing email
- Test login with valid credentials
- Test login with invalid credentials
- Test JWT token generation"

# Creates:
# - src/controllers/__tests__/auth.controller.test.ts
```

### Integration Tests

```bash
automatosx run backend "Create integration tests for task API:
- Test creating task (authenticated)
- Test listing tasks (authenticated)
- Test updating task (owner only)
- Test deleting task (owner only)
- Test 401 for unauthenticated requests"

# Creates:
# - src/routes/__tests__/tasks.routes.test.ts
```

## Step 6: Frontend Development

### React Components

```bash
automatosx run backend "Create React components for task management:
- TaskList component with pagination
- TaskItem component with edit/delete actions
- TaskForm component for create/edit
- Include TypeScript types
- Use React hooks (useState, useEffect)"

# Creates:
# - src/components/TaskList.tsx
# - src/components/TaskItem.tsx
# - src/components/TaskForm.tsx
# - src/types/task.ts
```

### Authentication UI

```bash
automatosx run backend "Create authentication components:
- LoginForm with email/password validation
- RegisterForm with password confirmation
- Protected route wrapper
- Auth context for global state"

# Creates:
# - src/components/auth/LoginForm.tsx
# - src/components/auth/RegisterForm.tsx
# - src/contexts/AuthContext.tsx
# - src/components/ProtectedRoute.tsx
```

## Step 7: WebSocket Integration

```bash
automatosx run backend "Add WebSocket support for real-time task updates:
- Socket.io server setup
- Emit events on task create/update/delete
- Client-side socket connection
- Auto-update UI on socket events"

# Creates:
# - src/socket/server.ts
# - src/socket/client.ts
# - Event handlers
```

## Step 8: Documentation

```bash
# API Documentation
automatosx run writer "Create API documentation for all endpoints:
- Authentication endpoints
- Task endpoints
- Request/response examples
- Error codes
- Use OpenAPI/Swagger format"

# Creates:
# - docs/api.md
# - swagger.yaml

# Setup Guide
automatosx run writer "Create development setup guide including:
- Prerequisites
- Installation steps
- Environment variables
- Database setup
- Running the app
- Running tests"

# Creates:
# - docs/setup.md
```

## Step 9: Debugging

```bash
# If you encounter errors:
automatosx run debugger "I'm getting this error when creating a task:
Error: Cannot read property 'userId' of undefined
at createTask (src/controllers/tasks.controller.ts:45)"

# Agent will:
# - Analyze the error
# - Identify the root cause
# - Suggest fixes
# - Provide code corrections
```

## Step 10: Deployment Preparation

```bash
# Environment Configuration
automatosx run backend "Create production-ready configuration:
- Separate dev/prod configs
- Docker Compose setup
- Environment variables validation
- Health check endpoint
- Graceful shutdown"

# Creates:
# - docker-compose.yml
# - Dockerfile
# - .env.example
# - src/health.ts

# Deployment Guide
automatosx run writer "Create deployment guide for:
- Docker deployment
- Environment setup
- Database migrations
- SSL/TLS configuration
- Monitoring and logging"

# Creates:
# - docs/deployment.md
```

## Complete Project Structure

After following this workflow, you'll have:

```
task-manager/
├── src/
│   ├── server.ts
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── validators/
│   ├── socket/
│   ├── components/
│   └── types/
├── prisma/
│   └── schema.prisma
├── docs/
│   ├── api.md
│   ├── setup.md
│   └── deployment.md
├── tests/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Tips for Success

1. **Start with Planning**: Always use assistant/chat mode to plan before coding
2. **Incremental Development**: Build one feature at a time, test, then move on
3. **Regular Reviews**: Review code after each major component
4. **Documentation First**: Document as you build, not after
5. **Use Memory**: AutomatosX remembers context across sessions
6. **Iterate**: Don't expect perfect code first time, refine iteratively

## Common Issues

### Agent Gives Generic Code

**Problem**: Generated code is too generic
**Solution**: Provide more context and specific requirements

```bash
# Instead of:
automatosx run backend "Create user model"

# Do this:
automatosx run backend "Create Prisma User model with:
- UUID primary key
- Email (unique, validated)
- Password (hashed with bcrypt, min 8 chars)
- Name (required)
- Role (enum: user, admin)
- CreatedAt, UpdatedAt timestamps
- Soft delete support"
```

### Code Doesn't Match Project Style

**Problem**: Generated code doesn't follow your conventions
**Solution**: Create a custom agent with style guidelines

```yaml
# .automatosx/agents/project-coder.yaml
name: project-coder
systemPrompt: |
  You are a code generator for this specific project.

  Code Style:
  - Use functional components (React)
  - Async/await (no promises)
  - Named exports (no default)
  - 2 spaces indentation
  - Single quotes
  - Trailing commas

  Follow these patterns exactly when generating code.
```

## Next Steps

- Explore [API Design Use Case](./02-api-design.md)
- Learn about [Code Migration](./03-code-migration.md)
- See [Security Audit Workflow](./04-security-audit.md)

---

**Questions?** Open an issue at [GitHub Issues](https://github.com/defai-digital/automatosx/issues) (use "question" label)
