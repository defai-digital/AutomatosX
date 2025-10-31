# End-to-End (E2E) Testing Procedure

This document describes how to run and write E2E tests for AutomatosX.

## Overview

E2E tests validate complete user workflows from start to finish, ensuring the entire system works together correctly.

## Test Structure

```
tests/
└── e2e/
    ├── complete-workflow.test.ts    # Main E2E test suite
    └── fixtures/
        ├── test-agent.yaml          # Test agent profiles
        └── test-ability.md          # Test abilities
```

## Running E2E Tests

### With Mock Providers (Default)

```bash
# All E2E tests with mock providers (fast, no costs)
npm run test:all

# Only E2E tests
npm test e2e
```

### With Real Providers

```bash
# Set up API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="your-key"
export OPENAI_API_KEY="sk-..."

# Run with real providers
export AUTOMATOSX_MOCK_PROVIDERS=false
npm test e2e

# Or use the dedicated script
./tools/real-provider-test.sh
```

**Warning**: Real provider tests will incur API costs (~$0.01-0.10 per run).

## E2E Test Scenarios

### 1. Complete Workflow Test

**File**: `tests/e2e/complete-workflow.test.ts`

**Scenarios Tested**:

- Project initialization
- Configuration management
- Agent creation and execution
- Memory storage and retrieval
- Multi-turn conversations
- Export/import functionality

**Example**:

```typescript
describe('Complete Workflow', () => {
  it('should complete full user journey', async () => {
    // 1. Initialize project
    await execCLI(['init', '--quiet']);

    // 2. Configure API key
    await execCLI(['config', '--set', 'providers.claude.apiKey',
                   '--value', 'sk-ant-test']);

    // 3. Run agent
    const result = await execCLI(['run', 'assistant', 'Hello']);
    expect(result.stdout).toContain('response');

    // 4. Check memory
    const memories = await execCLI(['memory', 'list']);
    expect(memories.stdout).toContain('Hello');

    // 5. Export data
    await execCLI(['memory', 'export', '--output', 'test.json']);
    expect(fs.existsSync('test.json')).toBe(true);
  });
});
```

### 2. Error Handling Test

**Validates**:

- Graceful failure on invalid input
- Clear error messages
- Proper exit codes

**Example**:

```typescript
it('should handle errors gracefully', async () => {
  // Invalid command
  const result = await execCLI(['invalid-command']);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Unknown command');

  // Missing required argument
  const result2 = await execCLI(['run']);
  expect(result2.exitCode).toBe(1);
  expect(result2.stderr).toContain('required');
});
```

### 3. Provider Fallback Test

**Validates**:

- Automatic fallback when primary provider fails
- Correct provider selection
- Retry logic

**Example**:

```typescript
it('should fallback to secondary provider', async () => {
  // Configure primary (invalid key) and fallback
  await execCLI(['config', '--set', 'providers.claude.apiKey',
                 '--value', 'invalid']);
  await execCLI(['config', '--set', 'providers.gemini.apiKey',
                 '--value', process.env.GOOGLE_API_KEY]);
  await execCLI(['config', '--set', 'providers.preferred',
                 '--value', 'claude']);

  // Should fall back to Gemini
  const result = await execCLI(['run', 'assistant', 'test']);
  expect(result.exitCode).toBe(0);
});
```

## Writing E2E Tests

### Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

describe('My E2E Test Suite', () => {
  let testDir: string;
  let cliPath: string;

  beforeEach(() => {
    // Create isolated test directory
    testDir = mkdtempSync(join(tmpdir(), 'automatosx-e2e-'));
    cliPath = join(__dirname, '../../dist/index.js');

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should test complete workflow', async () => {
    // Your test code here
  });
});
```

### Helper Function: Execute CLI

```typescript
async function execCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: testDir,
      env: {
        ...process.env,
        AUTOMATOSX_MOCK_PROVIDERS: 'true'
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({
        stdout,
        stderr,
        exitCode: -1
      });
    }, 30000);
  });
}
```

### Best Practices

1. **Isolation**: Each test runs in separate temporary directory
2. **Cleanup**: Always remove test data after test completes
3. **Timeouts**: Set reasonable timeouts to prevent hanging tests
4. **Mock by Default**: Use mock providers unless testing real integration
5. **Clear Assertions**: Verify specific behaviors, not just "no error"
6. **Independent Tests**: Tests should not depend on each other

## E2E Test Checklist

When adding new features, ensure E2E tests cover:

- [ ] **Happy Path**: Feature works as intended
- [ ] **Error Cases**: Feature fails gracefully
- [ ] **Edge Cases**: Boundary conditions handled
- [ ] **Integration**: Feature works with other components
- [ ] **Performance**: Feature completes within reasonable time

## Debugging E2E Tests

### Run Specific Test

```bash
npm test e2e -- --grep "specific test name"
```

### Enable Debug Output

```typescript
const child = spawn('node', [cliPath, ...args, '--debug'], {
  stdio: 'inherit' // Show all output
});
```

### Keep Test Directory

```typescript
afterEach(() => {
  // Comment out cleanup to inspect files
  // if (testDir) {
  //   rmSync(testDir, { recursive: true, force: true });
  // }
  console.log('Test directory:', testDir);
});
```

### Run with Real Providers

```bash
export AUTOMATOSX_MOCK_PROVIDERS=false
export ANTHROPIC_API_KEY="sk-ant-..."
npm test e2e -- --grep "specific test"
```

## Performance Benchmarks

E2E tests should complete within:

- **Mock providers**: 30 seconds total
- **Real providers**: 2 minutes total
- **Single test**: 5 seconds (mock), 20 seconds (real)

If tests are slower, investigate:

- Unnecessary waits/sleeps
- Network timeouts
- Large file operations
- Database operations

## Continuous Integration

E2E tests run automatically on:

- Pull requests
- Commits to main branch
- Release tags

CI configuration: `.github/workflows/ci.yml`

```yaml
- name: Run E2E tests
  run: npm run test:all
  env:
    AUTOMATOSX_MOCK_PROVIDERS: 'true'
```

## Manual E2E Testing

For release validation, perform manual E2E testing:

### 1. Clean Installation

```bash
# Remove any existing installation
npm uninstall -g automatosx

# Install from tarball
npm install -g ./automatosx-4.0.0.tgz

# Verify version
automatosx --version
```

### 2. Fresh Project Setup

```bash
# Create new project
mkdir fresh-e2e-test
cd fresh-e2e-test

# Initialize
automatosx init

# Configure
automatosx config --set providers.claude.apiKey --value "sk-ant-..."
```

### 3. Real-World Workflow

```bash
# Status check
automatosx status

# List resources
automatosx list agents
automatosx list abilities

# Run agent
automatosx run assistant "Explain TypeScript interfaces"

# Check memory
automatosx memory list
automatosx memory search "TypeScript"

# Export data
automatosx memory export --output backup.json

# Verify export
cat backup.json | jq .
```

### 4. Edge Cases

```bash
# Very long prompt
automatosx run assistant "$(cat long-file.txt)"

# Special characters
automatosx run assistant "Test with Hello émojis 🎉"

# Network interruption
# (Disconnect internet during execution)

# Invalid API key
automatosx config --set providers.claude.apiKey --value "invalid"
automatosx run assistant "test" # Should show clear error
```

## Reporting E2E Test Failures

When E2E tests fail, include:

1. **Test name**: Which test failed
2. **Environment**: OS, Node version, AutomatosX version
3. **Mode**: Mock or real providers
4. **Error output**: Full error message
5. **Steps to reproduce**: How to trigger the failure
6. **Expected vs Actual**: What should happen vs what happened

Example report:

```markdown
**Test**: Complete workflow E2E test
**Environment**: Ubuntu 22.04, Node 20.10, AutomatosX 4.0.0-beta.1
**Mode**: Real providers (Claude)
**Error**:
```

Error: Request timeout after 30000ms
at completeWorkflow.test.ts:45

```
**Steps**:
1. Run `npm test e2e -- --grep "complete workflow"`
2. Test hangs at agent execution step

**Expected**: Agent responds within 10 seconds
**Actual**: Request times out after 30 seconds
```

## Resources

- [Vitest E2E Testing](https://vitest.dev/guide/testing-types.html#e2e-testing)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Questions?** Open an issue at [GitHub Issues](https://github.com/defai-digital/automatosx/issues) (use "question" label)
