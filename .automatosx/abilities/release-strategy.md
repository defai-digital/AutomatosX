# Release Strategy

Plan and execute safe, controlled software releases. Use deployment patterns that minimize risk and enable quick rollback.

## Deployment Patterns

### 1. Blue-Green Deployment
```bash
# ✅ Switch traffic instantly
kubectl apply -f deployment-green.yaml
curl http://green.example.com/health
kubectl patch service app -p '{"spec":{"selector":{"version":"green"}}}'
# Rollback if needed: switch back to blue
```

### 2. Canary Deployment
```yaml
# ✅ Good: Gradual rollout (10% canary, 90% stable)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-stable
spec:
  replicas: 9
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-canary
spec:
  replicas: 1
```

### 3. Feature Flags
```javascript
// ✅ Good: Gradual feature rollout
if (featureFlags.isEnabled('new-checkout', user.id)) {
  return <NewCheckout />;
}
```

## Don'ts ❌

```bash
# ❌ Bad: Big bang release on Friday
./deploy-all-changes.sh
# Go home, hope for best

# ❌ Bad: No rollback plan
```

## Best Practices
- Release during low-traffic periods
- Have documented rollback procedure
- Use feature flags for risky changes
- Monitor key metrics during/after release
- Automate deployment process
- Document release notes
