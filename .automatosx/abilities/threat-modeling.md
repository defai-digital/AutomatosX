# Threat Modeling

Identify, assess, and mitigate security threats systematically using frameworks like STRIDE to analyze attack vectors.

## STRIDE Framework

- **S**poofing: Impersonating user/system
- **T**ampering: Modifying data/code
- **R**epudiation: Denying actions
- **I**nformation Disclosure: Exposing sensitive data
- **D**enial of Service: Making system unavailable
- **E**levation of Privilege: Gaining unauthorized access

## Do's ✅

```markdown
# ✅ Good: Document threats per asset
## Asset: User Password
- Spoofing: Attacker uses stolen credentials → Mitigation: MFA
- Tampering: Hash modified in DB → Mitigation: Hash with bcrypt
- Information Disclosure: Leaked in logs → Mitigation: No passwords in logs
- Elevation: Admin password compromised → Mitigation: Rate limiting, complexity
```

```javascript
// ✅ Good: Validate and sanitize
const path = require('path');
const filename = path.basename(req.body.filename);
const safePath = path.join('./uploads', filename);
if (!safePath.startsWith('./uploads/')) {
  return res.status(400).send('Invalid filename');
}
```

## Don'ts ❌

```javascript
// ❌ Bad: Assuming input is safe
const filename = req.body.filename;
fs.writeFile(`./uploads/${filename}`, content);
// What if filename = "../../etc/passwd"?
```

## Best Practices
- Perform threat modeling early in design
- Update when architecture changes
- Prioritize by risk (likelihood × impact)
- Document mitigations
- Review with security team
