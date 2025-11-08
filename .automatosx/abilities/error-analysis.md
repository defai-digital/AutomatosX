# Error Analysis Ability

Analyze and understand error messages to find solutions.

## Error Analysis Process

1. **Read the Error Carefully**
   - Full error message
   - Error code/type
   - Stack trace
   - Context information

2. **Identify Error Type**
   - Syntax error (typo, missing character)
   - Runtime error (execution failure)
   - Logic error (wrong output)
   - Configuration error (missing setup)

3. **Locate the Source**
   - File name and line number
   - Stack trace (call chain)
   - Relevant code section
   - Recent changes

4. **Understand the Cause**
   - What was the code trying to do?
   - Why did it fail?
   - What assumption was wrong?
   - What conditions triggered it?

5. **Research if Needed**
   - Search error message
   - Check documentation
   - Review similar issues
   - Ask for help (with context)

## Common Error Patterns

### Null/Undefined Errors

```
TypeError: Cannot read property 'x' of undefined
```

- Cause: Accessing property on null/undefined
- Fix: Check if object exists first
- Prevention: Use optional chaining (?.)

### Type Errors

```
TypeError: 'int' object is not callable
```

- Cause: Using wrong type for operation
- Fix: Convert type or use correct type
- Prevention: Type annotations, validation

### Import/Module Errors

```
ModuleNotFoundError: No module named 'x'
```

- Cause: Missing dependency or wrong path
- Fix: Install dependency or fix import path
- Prevention: Requirements file, path checks

### Network Errors

```
ConnectionError: Connection refused
```

- Cause: Service not running, wrong address, firewall
- Fix: Start service, check URL, check network
- Prevention: Health checks, retry logic

### Permission Errors

```
PermissionError: Permission denied
```

- Cause: Insufficient file/resource permissions
- Fix: Grant permissions or run as correct user
- Prevention: Check permissions, use appropriate user

## Error Message Anatomy

```
TypeError: Cannot read property 'name' of undefined
    at getUserName (app.js:42:18)
    at handleRequest (app.js:15:10)
    at Server.<anonymous> (app.js:8:5)
```

Parts:

1. **Error Type**: TypeError
2. **Error Message**: Cannot read property 'name' of undefined
3. **Stack Trace**: Call chain showing where error occurred
4. **Location**: app.js:42:18 (file:line:column)

## Debugging Workflow

1. Read error → 2. Identify location → 3. Examine code → 4. Form hypothesis → 5. Add logging → 6. Test fix → 7. Verify solution
