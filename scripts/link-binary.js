#!/usr/bin/env node
/**
 * Copyright 2025 DEFAI Private Limited
 *
 * Automatically link AutomatosX CLI binary after installation
 * This allows developers to use `ax` command directly instead of `pnpm run cli`
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliPath = path.join(__dirname, '../dist/cli/index.js');

// Only link if dist/cli/index.js exists (after build)
if (fs.existsSync(cliPath)) {
  try {
    console.log('🔗 Linking AutomatosX CLI binary...');

    // Make CLI executable
    execSync(`chmod +x "${cliPath}"`, { stdio: 'inherit' });

    // Link globally with pnpm
    execSync('pnpm link --global', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

    console.log('✅ AutomatosX CLI linked successfully!');
    console.log('');
    console.log('You can now use:');
    console.log('  ax find "Calculator"');
    console.log('  ax def "getUserById"');
    console.log('  ax cli  # Interactive mode');
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not link binary automatically.');
    console.log('');
    console.log('To link manually, run:');
    console.log('  pnpm link --global');
    console.log('');
    console.log('Or use the CLI with:');
    console.log('  pnpm run cli -- <command>');
    console.log('');
  }
} else {
  console.log('⚠️  CLI binary not built yet.');
  console.log('');
  console.log('Please run:');
  console.log('  pnpm run build');
  console.log('  pnpm link --global');
  console.log('');
  console.log('Or use:');
  console.log('  pnpm run cli -- <command>');
  console.log('');
}
