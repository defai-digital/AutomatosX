# CI/CD Pipelines

Automate build, test, and deployment processes. Implement continuous integration and continuous delivery for reliable, fast releases.

## Do's ✅

```yaml
# ✅ Good: Comprehensive pipeline (GitHub Actions)
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./deploy.sh production
        env:
          AWS_KEY: ${{ secrets.AWS_KEY }}
```

## Don'ts ❌

```yaml
# ❌ Bad: Deploy without testing
on: push
jobs:
  deploy:
    steps:
      - run: ./deploy.sh  # YOLO!

# ❌ Bad: Secrets in code
env:
  API_KEY: "sk_live_abc123"  # Never!
```

## Best Practices
- Run tests on every commit
- Use secrets management
- Implement rollback strategies
- Use artifact caching
- Implement deployment gates for production
- Monitor deployment health
