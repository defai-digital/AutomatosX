#!/usr/bin/env node

/**
 * Check CI Environment - Prevent Manual npm Publish
 *
 * This script prevents accidental manual npm publish by enforcing
 * that all npm publishes must go through GitHub Actions.
 *
 * Usage: Add to package.json prepublishOnly script
 */

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

if (!isCI) {
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ ERROR: Manual npm publish is not allowed');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error('All npm publishes must be done via GitHub Actions for:');
  console.error('  ✓ Automated testing');
  console.error('  ✓ Consistent builds');
  console.error('  ✓ npm provenance');
  console.error('  ✓ Audit trail');
  console.error('');
  console.error('To release a new version:');
  console.error('');
  console.error('  1. Tag the release:');
  console.error('     git tag -a v1.0.0 -m "Release v1.0.0"');
  console.error('     git push origin v1.0.0');
  console.error('');
  console.error('  2. Or use manual workflow trigger:');
  console.error('     gh workflow run release.yml -f version=1.0.0 -f npm_tag=latest');
  console.error('');
  console.error('  3. Or use the GitHub UI:');
  console.error('     https://github.com/defai-digital/automatosx/actions/workflows/release.yml');
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  process.exit(1);
}

console.log('✅ Publishing via CI - OK');
console.log('   CI Environment: ' + (process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Other CI'));
