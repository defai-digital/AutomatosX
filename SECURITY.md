# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 11.0.x  | :white_check_mark: |
| < 11.0  | :x:                |

## Package Provenance

All AutomatosX releases are published with npm provenance, which:

- Verifies packages were built in our GitHub Actions environment
- Links each package to its source code commit
- Provides cryptographic proof of authenticity
- Follows [SLSA Build Level 2](https://slsa.dev/spec/v1.0/levels)

### Verify Provenance

```bash
npm view @defai.digital/automatosx --json | jq .dist.attestations
```

## Reporting a Vulnerability

We take security vulnerabilities seriously. **Please DO NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email**: Send details to [support@defai.digital](mailto:support@defai.digital)
   - Use subject line: `[SECURITY] Brief description`

2. **GitHub Security Advisory**: https://github.com/defai-digital/automatosx/security/advisories/new

### What to Include

- **Type of vulnerability** (e.g., command injection, XSS, SQL injection)
- **Affected component** (file path and line number if possible)
- **Steps to reproduce** (detailed reproduction steps)
- **Proof of concept** (code snippet or screenshot)
- **Impact assessment** (what an attacker could achieve)
- **Suggested fix** (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium: 30-60 days
  - Low: Next release cycle

### Disclosure Policy

- We follow **coordinated disclosure**
- We'll credit you in the security advisory (unless you prefer anonymity)
- We'll publish a security advisory after the fix is released
- Please allow us reasonable time to fix before public disclosure

## Security Best Practices

### For Users

#### 1. Environment Variables

Never commit sensitive data to the repository:

```bash
# Store API keys in .env (already in .gitignore)
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
GOOGLE_API_KEY=your-key-here
```

#### 2. Provider CLI Security

- Install provider CLIs from official sources only
- Keep provider CLIs updated to latest versions
- Review provider CLI permissions and capabilities

#### 3. Agent Profiles

- Review agent profiles before running (`~/.automatosx/agents/`)
- Be cautious with custom agents from untrusted sources
- Agents can execute code - only use trusted profiles

#### 4. File Operations

AutomatosX respects path validation settings in `ax.config.json`:

```json
{
  "advanced": {
    "security": {
      "pathValidation": true,
      "allowedExtensions": [".js", ".ts", ".py", ".md", ".json", ".yaml"]
    }
  }
}
```

#### 5. Package Security

- Always use the latest stable version
- Verify package provenance before installation
- Use `npm ci` instead of `npm install` in CI/CD
- Enable dependency scanning (Dependabot)
- Review the GitHub Releases (https://github.com/defai-digital/automatosx/releases) for security updates

#### 6. Memory Database

- Memory is stored locally in `.automatosx/memory/memories.db`
- Contains conversation history and context
- Backup regularly if it contains important data
- Never commit to version control

## Known Security Considerations

### Command Injection Protection

- Provider names are whitelisted (`BaseProvider.ALLOWED_PROVIDER_NAMES`)
- Path validation enabled by default
- SQL injection prevented via prepared statements

### Data Privacy

- All data stored locally by default
- No telemetry sent to AutomatosX servers
- AI provider calls respect your privacy settings
- Review each provider's privacy policy

### Supply Chain Security

- Dependencies audited regularly via `npm audit`
- Native modules (`better-sqlite3`, `sqlite-vec`) from trusted sources
- Lock file (`package-lock.json`) committed to repo

## Security Updates

Security updates are published via:

1. **GitHub Security Advisories**
2. **Release notes** in `GitHub Releases (https://github.com/defai-digital/automatosx/releases)`
3. **npm security advisories**

To stay informed:

```bash
# Check for updates
npm outdated -g @defai.digital/automatosx

# Update to latest
npm update -g @defai.digital/automatosx
```

## Security Hall of Fame

We appreciate security researchers who help make AutomatosX safer:

- *Be the first to responsibly disclose a vulnerability!*

## Questions?

If you have questions about security but don't have a vulnerability to report:

- Open a [GitHub Discussion](https://github.com/defai-digital/AutomatosX/discussions)
- Email us at [support@defai.digital](mailto:support@defai.digital)

---

**Thank you for helping keep AutomatosX and our users safe!**
