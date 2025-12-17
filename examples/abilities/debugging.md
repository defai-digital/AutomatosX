---
abilityId: debugging
displayName: Debugging
category: engineering
tags: [debugging, troubleshooting, problem-solving]
priority: 90
---

# Debugging Best Practices

## Systematic Debugging Process

### 1. Reproduce the Issue
- Get exact steps to reproduce
- Identify minimum reproduction case
- Document environment and conditions
- Note frequency (always, intermittent, specific conditions)

### 2. Gather Information
- Error messages and stack traces
- Log files and timestamps
- Recent changes (code, config, dependencies)
- User reports and screenshots

### 3. Form Hypotheses
- What could cause this behavior?
- What assumptions might be wrong?
- What changed recently?
- Where are the likely failure points?

### 4. Test Hypotheses
- One change at a time
- Document each test and result
- Use binary search to narrow down
- Verify fixes don't introduce new issues

## Debugging Techniques

### Print/Log Debugging
```javascript
console.log('[DEBUG] Function entry:', { args, timestamp: Date.now() });
console.log('[DEBUG] State before:', JSON.stringify(state, null, 2));
// ... operation
console.log('[DEBUG] State after:', JSON.stringify(state, null, 2));
```

### Breakpoint Debugging
- Set breakpoints at suspected locations
- Inspect variable values
- Step through execution
- Watch expressions for changes

### Binary Search Debugging
1. Find known good state
2. Find known bad state
3. Test midpoint
4. Repeat until root cause found

### Rubber Duck Debugging
- Explain the problem out loud
- Walk through code line by line
- Question every assumption
- Often reveals the issue

## Common Bug Categories

### Logic Errors
- Off-by-one errors
- Incorrect conditionals
- Wrong operator (== vs ===)
- Missing edge cases

### State Bugs
- Race conditions
- Stale state
- Uninitialized variables
- State mutation side effects

### Integration Bugs
- API contract mismatches
- Timing issues
- Data format differences
- Missing error handling

### Resource Bugs
- Memory leaks
- Connection leaks
- File handle leaks
- Deadlocks

## Debugging Tools

### Browser DevTools
- Console for logging
- Network tab for API calls
- Sources for breakpoints
- Performance for profiling

### Node.js
- `node --inspect` for Chrome DevTools
- `console.trace()` for stack traces
- `process.memoryUsage()` for memory
- Debug module for conditional logging

### Database
- Query execution plans (EXPLAIN)
- Slow query logs
- Connection pool monitoring
- Transaction isolation issues

## Prevention Strategies

- Write tests before fixing
- Add logging for future debugging
- Document known issues
- Improve error messages
- Add assertions for invariants
