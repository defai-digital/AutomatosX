# Debugging Ability

Systematically identify and fix bugs in code.

## Debugging Process

1. **Reproduce** the issue
   - Understand error messages
   - Identify conditions that trigger the bug
   - Create minimal reproduction case

2. **Investigate** the problem
   - Read stack traces carefully
   - Add logging and breakpoints
   - Check recent changes (git diff)
   - Verify assumptions

3. **Isolate** the root cause
   - Use binary search (comment out code blocks)
   - Test components individually
   - Check inputs and outputs
   - Trace execution flow

4. **Fix** the bug
   - Implement targeted fix
   - Avoid introducing new bugs
   - Update related code if needed
   - Add regression test

5. **Verify** the solution
   - Test the fix thoroughly
   - Check for side effects
   - Run full test suite
   - Document the fix

## Common Bug Types

- Off-by-one errors
- Null/undefined reference errors
- Race conditions and timing issues
- Type mismatches
- Resource leaks (memory, file handles)
- Logic errors in conditionals
