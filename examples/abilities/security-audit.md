# Security Audit Ability

Identify and mitigate security vulnerabilities in code.

## OWASP Top 10 Focus

1. **Injection Attacks**
   - SQL injection
   - Command injection
   - XSS (Cross-Site Scripting)
   - Prevention: Input validation, parameterized queries

2. **Broken Authentication**
   - Weak passwords
   - Session management issues
   - Missing MFA
   - Prevention: Strong auth mechanisms, secure sessions

3. **Sensitive Data Exposure**
   - Unencrypted data
   - Hardcoded secrets
   - Logging sensitive info
   - Prevention: Encryption, secret management

4. **Access Control**
   - Missing authorization checks
   - Privilege escalation
   - IDOR (Insecure Direct Object References)
   - Prevention: Proper authorization, RBAC

5. **Security Misconfiguration**
   - Default credentials
   - Unnecessary services enabled
   - Debug mode in production
   - Prevention: Secure defaults, hardening

## Security Checklist

Input Validation:

- [ ] Validate all user inputs
- [ ] Whitelist > blacklist
- [ ] Sanitize outputs
- [ ] Check file upload types and sizes

Authentication & Authorization:

- [ ] Strong password requirements
- [ ] Secure session management
- [ ] Proper authorization checks
- [ ] Rate limiting on auth endpoints

Data Protection:

- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS for data in transit
- [ ] No secrets in code/logs
- [ ] Secure key management

Code Security:

- [ ] No eval() or dangerous functions
- [ ] Parameterized queries (no string concat)
- [ ] Secure random number generation
- [ ] Dependency vulnerability scanning
