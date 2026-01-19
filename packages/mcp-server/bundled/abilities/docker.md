---
abilityId: docker
displayName: Docker Best Practices
category: devops
tags: [docker, containers, devops]
priority: 75
---

# Docker Best Practices

## Dockerfile Best Practices

### Multi-Stage Builds
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Layer Optimization
```dockerfile
# BAD - cache invalidation on every change
COPY . .
RUN npm install

# GOOD - dependencies cached separately
COPY package*.json ./
RUN npm ci
COPY . .
```

### Security Best Practices
```dockerfile
# Use specific versions, not latest
FROM node:20.10.0-alpine3.19

# Run as non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001
USER nextjs

# Don't expose secrets in build
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc \
    && npm ci \
    && rm ~/.npmrc

# Use .dockerignore
# .git
# node_modules
# .env
# *.log
```

### Minimize Image Size
```dockerfile
# Use alpine images
FROM node:20-alpine

# Remove unnecessary files
RUN npm ci --only=production \
    && npm cache clean --force

# Use distroless for production
FROM gcr.io/distroless/nodejs20-debian11
COPY --from=builder /app/dist /app
CMD ["app/server.js"]
```

## Docker Compose

### Development Setup
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume for node_modules
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Production Setup
```yaml
version: '3.8'

services:
  app:
    image: myapp:${VERSION:-latest}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```typescript
// Health endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
    },
  };

  const allHealthy = Object.values(health.checks).every(c => c.status === 'ok');
  res.status(allHealthy ? 200 : 503).json(health);
});
```

## Networking

```yaml
services:
  frontend:
    networks:
      - frontend

  backend:
    networks:
      - frontend
      - backend

  database:
    networks:
      - backend

networks:
  frontend:
  backend:
    internal: true  # No external access
```

## Volume Management

```yaml
volumes:
  # Named volume (managed by Docker)
  postgres_data:
    driver: local

  # Bind mount (development)
  # ./src:/app/src

  # tmpfs (ephemeral, memory-only)
  cache:
    driver_opts:
      type: tmpfs
      device: tmpfs
```

## Environment Variables

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## Common Commands

```bash
# Build and run
docker compose up --build -d

# View logs
docker compose logs -f app

# Execute command in container
docker compose exec app sh

# Scale services
docker compose up -d --scale app=3

# Clean up
docker compose down -v --rmi local
docker system prune -af

# Inspect
docker inspect container_name
docker stats
```

## Anti-Patterns

- Using `latest` tag in production
- Running as root
- Storing secrets in images
- Large image sizes
- Missing health checks
- No resource limits
- Hardcoded configuration
