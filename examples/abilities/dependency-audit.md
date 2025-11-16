# Dependency Audit

Scan and manage third-party dependencies for known vulnerabilities. Keep dependencies updated and minimize supply chain risks.

## Do's ✅

```bash
# ✅ Good: Regular scanning
npm audit
npm audit fix

npx snyk test
npx snyk monitor
```

```yaml
# ✅ Good: Automated CI scanning
name: Security
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

```json
// ✅ Good: Pin versions
{
  "dependencies": {
    "express": "4.18.2"
  }
}
```

## Don'ts ❌

```bash
# ❌ Bad: Ignoring warnings
npm audit
# 15 vulnerabilities found
# (deploys anyway)
```

```javascript
// ❌ Bad: Unmaintained packages
const pkg = require('abandoned-library');  // Last update 5 years ago
```

## Best Practices
- Run `npm audit` in CI pipeline
- Use Dependabot/Renovate for auto-updates
- Review changelogs before updating
- Have rollback plan
- Monitor security advisories
- Use minimal dependencies
