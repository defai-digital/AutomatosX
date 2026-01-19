---
abilityId: ci-cd
displayName: CI/CD Best Practices
category: devops
tags: [ci, cd, deployment, automation]
priority: 80
---

# CI/CD Best Practices

## Pipeline Fundamentals

### Pipeline Stages
```yaml
# Typical pipeline structure
stages:
  - build      # Compile, bundle
  - test       # Unit, integration, e2e
  - analyze    # Lint, security scan
  - deploy     # Staging, production
```

### Build Stage
```yaml
build:
  stage: build
  script:
    - npm ci                    # Clean install (reproducible)
    - npm run build             # Build artifacts
  artifacts:
    paths:
      - dist/                   # Save for later stages
    expire_in: 1 hour
  cache:
    key: $CI_COMMIT_REF_SLUG
    paths:
      - node_modules/           # Cache dependencies
```

### Test Stage
```yaml
test:unit:
  stage: test
  script:
    - npm run test:unit -- --coverage
  coverage: '/Statements\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

test:integration:
  stage: test
  services:
    - postgres:14              # Service containers
    - redis:7
  variables:
    DATABASE_URL: postgres://postgres@postgres/test
  script:
    - npm run test:integration
```

## GitHub Actions Example

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          # Deployment script
          ./scripts/deploy.sh production
```

## Deployment Strategies

### Blue-Green Deployment
```yaml
# Two identical environments
deploy:blue-green:
  script:
    - kubectl apply -f k8s/deployment-green.yaml
    - kubectl rollout status deployment/app-green
    - kubectl patch service app -p '{"spec":{"selector":{"version":"green"}}}'
    # Instant rollback: switch selector back to blue
```

### Canary Deployment
```yaml
deploy:canary:
  script:
    # Deploy to 10% of traffic
    - kubectl apply -f k8s/deployment-canary.yaml
    - kubectl scale deployment/app-canary --replicas=1
    # Monitor metrics
    - ./scripts/check-canary-health.sh
    # Gradual rollout
    - kubectl scale deployment/app-canary --replicas=5
```

### Rolling Update
```yaml
# Kubernetes default strategy
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
```

## Best Practices

### Fast Feedback
- Fail fast: run quick checks first
- Parallelize independent jobs
- Cache dependencies between runs
- Use incremental builds

### Security
```yaml
security-scan:
  stage: analyze
  script:
    - npm audit --production     # Dependency vulnerabilities
    - trivy image myapp:latest   # Container scanning
    - gitleaks detect            # Secret detection
```

### Environment Management
```yaml
deploy:staging:
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy:production:
  environment:
    name: production
    url: https://example.com
  only:
    - main
  when: manual                   # Require approval
```

### Secrets Management
```yaml
# Use CI/CD secrets, never commit
deploy:
  script:
    - echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin
    - kubectl create secret generic app-secrets --from-literal=api-key="$API_KEY"
```

## Monitoring Deployments

### Health Checks
```yaml
deploy:
  script:
    - kubectl apply -f k8s/
    - kubectl rollout status deployment/app --timeout=5m
    - ./scripts/smoke-test.sh $DEPLOY_URL
```

### Rollback Strategy
```yaml
rollback:
  when: on_failure
  script:
    - kubectl rollout undo deployment/app
    - slack-notify "Deployment failed, rolled back"
```

## Pipeline Anti-Patterns

- Long-running pipelines (> 15 min)
- No caching of dependencies
- Testing in production
- Manual steps that should be automated
- No rollback strategy
- Secrets in code or logs
- No environment parity
