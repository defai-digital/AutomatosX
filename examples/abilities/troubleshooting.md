# Troubleshooting Ability

Systematically diagnose and resolve technical issues.

## Troubleshooting Process

1. **Gather Information**
   - What is the expected behavior?
   - What actually happens?
   - Error messages (exact text)
   - Steps to reproduce
   - When did it start?
   - Recent changes

2. **Reproduce** the Issue
   - Follow exact steps
   - Use same environment
   - Note any variations
   - Document reproduction steps

3. **Isolate** the Problem
   - Is it consistent or intermittent?
   - Which components are affected?
   - What works vs what doesn't?
   - Minimum reproduction case

4. **Form Hypothesis**
   - Based on evidence
   - Consider multiple possibilities
   - Most likely cause first
   - Document reasoning

5. **Test Hypothesis**
   - Change one variable at a time
   - Verify results
   - If wrong, revise hypothesis
   - Keep track of what you've tried

6. **Implement Solution**
   - Apply fix
   - Test thoroughly
   - Document solution
   - Prevent recurrence

## Diagnostic Techniques

- **Check Logs**: Application, system, error logs
- **Verify Basics**: Network, permissions, disk space
- **Binary Search**: Disable half, narrow down
- **Compare Environments**: Dev vs prod differences
- **Monitor Resources**: CPU, memory, network
- **Review Recent Changes**: Git history, deployments
- **Test in Isolation**: Minimal setup, mock dependencies

## Common Issues Checklist

Configuration:

- [ ] Environment variables set correctly
- [ ] Config files in right location
- [ ] Paths absolute vs relative

Network:

- [ ] Firewall/security groups allow traffic
- [ ] DNS resolving correctly
- [ ] SSL certificates valid
- [ ] Timeouts configured appropriately

Permissions:

- [ ] File permissions correct
- [ ] User has necessary privileges
- [ ] Database permissions granted

Dependencies:

- [ ] All dependencies installed
- [ ] Correct versions
- [ ] No version conflicts
