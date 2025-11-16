# Secrets Management Policy

Securely store, rotate, and access secrets (API keys, passwords, certificates). Never commit secrets to version control.

## Do's ✅

```bash
# ✅ Good: Environment variables
export DATABASE_URL="postgresql://user:password@localhost/db"
export API_KEY="sk_live_abc123"

# Access in code
const dbUrl = process.env.DATABASE_URL;
```

```javascript
// ✅ Good: AWS Secrets Manager
const AWS = require('aws-sdk');
const client = new AWS.SecretsManager({ region: 'us-east-1' });

async function getSecret(name) {
  const data = await client.getSecretValue({ SecretId: name }).promise();
  return JSON.parse(data.SecretString);
}
```

```
# ✅ Good: .gitignore secrets
.env
.env.local
secrets/
*.pem
*.key
```

## Don'ts ❌

```javascript
// ❌ Bad: Hardcoded secrets
const API_KEY = "sk_live_abc123xyz";
const DB_PASSWORD = "SuperSecret123!";

// ❌ Bad: Logging secrets
logger.info('DB connection', { password: dbPassword });

// ❌ Bad: Secrets in URLs
fetch(`https://api.com/data?api_key=${apiKey}`);
// ✅ Good: In headers
fetch('https://api.com/data', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

## Best Practices
- Never commit secrets to git
- Use secret management tools (Vault, AWS Secrets Manager)
- Rotate secrets regularly (90 days)
- Different secrets for dev/staging/prod
- Audit secret access
- Encrypt at rest and in transit
- Use pre-commit hooks (detect-secrets)
