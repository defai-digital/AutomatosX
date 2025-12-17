---
abilityId: security
displayName: Security Best Practices
category: security
tags: [security, owasp, authentication, authorization]
priority: 95
---

# Security Best Practices

## OWASP Top 10 Prevention

### 1. Injection (SQL, NoSQL, Command)
```javascript
// BAD - SQL injection vulnerable
const query = `SELECT * FROM users WHERE id = ${userId}`;

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE id = $1';
await db.query(query, [userId]);
```

### 2. Broken Authentication
- Use strong password hashing (bcrypt, argon2)
- Implement rate limiting on login
- Use secure session management
- Require MFA for sensitive operations

```javascript
// Password hashing
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(password, hash);
```

### 3. Sensitive Data Exposure
- Encrypt data at rest and in transit
- Use TLS 1.3 for all connections
- Never log sensitive data
- Mask PII in responses

### 4. XML External Entities (XXE)
- Disable XML external entity processing
- Use JSON instead of XML when possible
- Validate and sanitize XML input

### 5. Broken Access Control
```javascript
// Always verify ownership
async function getDocument(userId, docId) {
  const doc = await db.documents.findById(docId);
  if (doc.ownerId !== userId) {
    throw new ForbiddenError('Access denied');
  }
  return doc;
}
```

### 6. Security Misconfiguration
- Remove default credentials
- Disable unnecessary features
- Keep dependencies updated
- Use security headers

```javascript
// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
  }
}));
```

### 7. Cross-Site Scripting (XSS)
```javascript
// BAD - XSS vulnerable
element.innerHTML = userInput;

// GOOD - Escape output
element.textContent = userInput;

// React auto-escapes by default
return <div>{userInput}</div>;
```

### 8. Insecure Deserialization
- Never deserialize untrusted data
- Use signed tokens (JWT with verification)
- Validate input before processing

### 9. Using Components with Known Vulnerabilities
- Regularly audit dependencies
- Use automated security scanning
- Keep dependencies updated

```bash
npm audit
pnpm audit
```

### 10. Insufficient Logging & Monitoring
- Log security events
- Monitor for anomalies
- Set up alerts for suspicious activity

## Authentication Best Practices

### JWT Implementation
```javascript
// Generate token
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '1h', algorithm: 'HS256' }
);

// Verify token
const payload = jwt.verify(token, process.env.JWT_SECRET);
```

### Session Security
- Use secure, httpOnly, sameSite cookies
- Regenerate session ID after login
- Implement session timeout
- Allow users to revoke sessions

## Authorization Patterns

### Role-Based Access Control (RBAC)
```javascript
const permissions = {
  admin: ['read', 'write', 'delete', 'admin'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

function canAccess(userRole, action) {
  return permissions[userRole]?.includes(action) ?? false;
}
```

### Attribute-Based Access Control (ABAC)
```javascript
function canAccess(user, resource, action) {
  return (
    user.department === resource.department &&
    resource.classification <= user.clearanceLevel
  );
}
```

## Input Validation

```javascript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  age: z.number().int().min(0).max(150),
});

// Validate input
const result = UserSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error);
}
```

## Security Checklist

- [ ] All user input validated and sanitized
- [ ] Parameterized queries for database access
- [ ] Authentication with secure password storage
- [ ] Authorization checks on all protected resources
- [ ] HTTPS enforced everywhere
- [ ] Security headers configured
- [ ] Dependencies audited for vulnerabilities
- [ ] Logging for security events
- [ ] Rate limiting on sensitive endpoints
- [ ] CORS properly configured
