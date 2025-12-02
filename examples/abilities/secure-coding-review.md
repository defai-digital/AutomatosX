# Secure Coding Review

Review code for security vulnerabilities using OWASP Top 10 and secure coding standards. Identify and fix flaws before production.

## OWASP Top 10 Examples

### A01: Broken Access Control
```javascript
// ❌ Bad: No authorization
app.get('/api/users/:id/orders', async (req, res) => {
  const orders = await db.getOrders(req.params.id);
  res.json(orders);  // Any user can view any orders!
});

// ✅ Good: Verify ownership
app.get('/api/users/:id/orders', auth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const orders = await db.getOrders(req.params.id);
  res.json(orders);
});
```

### A02: Cryptographic Failures
```javascript
// ❌ Bad: Weak hashing
const hash = crypto.createHash('md5').update(password).digest('hex');

// ✅ Good: Strong hashing
const hash = await bcrypt.hash(password, 12);
```

### A03: Injection
```javascript
// ❌ Bad: SQL Injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ Good: Parameterized query
const query = 'SELECT * FROM users WHERE email = ?';
const results = await db.query(query, [email]);
```

## Review Checklist
- ✅ MFA for sensitive actions
- ✅ Authorization checks on all endpoints
- ✅ Input validation and sanitization
- ✅ Parameterized queries
- ✅ Secrets not hardcoded
- ✅ TLS 1.2+ required
- ✅ No sensitive data in logs
