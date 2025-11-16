# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.3.x   | :white_check_mark: |
| 5.2.x   | :white_check_mark: |
| < 5.2   | :x:                |

## Package Provenance

All AutomatosX releases from v5.3.8+ are published with npm provenance, which:

- Verifies packages were built in our GitHub Actions environment
- Links each package to its source code commit
- Provides cryptographic proof of authenticity
- Follows [SLSA Build Level 2](https://slsa.dev/spec/v1.0/levels)

### Verify Provenance

```bash
npm view @defai.digital/automatosx --json | jq .dist.attestations
```

## Reporting a Vulnerability

If you discover a security vulnerability, please email security@defai.digital or open a private security advisory:

https://github.com/defai-digital/automatosx/security/advisories/new

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond within 48 hours.

## Security Best Practices

When using AutomatosX:

1. Always use the latest stable version
2. Verify package provenance before installation
3. Use `npm ci` instead of `npm install` in CI/CD
4. Enable dependency scanning (Dependabot)
5. Review the CHANGELOG.md for security updates
