# Smoke Tests

Smoke tests verify that the packaged npm distribution works correctly in a clean environment.

## What They Test

1. **Package Installation**: Can install from tarball
2. **CLI Availability**: Both `automatosx` and `ax` commands work
3. **Basic Commands**: `--version`, `--help`, `list agents`, `status`
4. **File Structure**: Examples, dist, documentation present
5. **File Exclusions**: No source files, tests, or source maps
6. **Bin Configuration**: Shebang and permissions correct

## Running Locally

```bash
npm run test:smoke
```

This will:
1. Build the project
2. Create a tarball with `npm pack`
3. Install in a temporary directory
4. Run verification tests
5. Clean up

## CI/CD

Smoke tests run automatically:
- On every push (CI workflow)
- Before every release (release workflow)
- As part of `npm test`

## Troubleshooting

If smoke tests fail:

1. **"command not available"**: Check bin entries in package.json
2. **"missing files"**: Check files array in package.json
3. **"source maps found"**: Verify tsup.config.ts has `sourcemap: false`
4. **"shebang missing"**: Check tsup.config.ts banner configuration
