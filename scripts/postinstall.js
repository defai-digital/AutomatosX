#!/usr/bin/env node
/**
 * Copyright 2025 DEFAI Private Limited
 *
 * Post-installation script for AutomatosX
 * 1. Rebuilds native modules (tree-sitter) for the current platform
 * 2. Links CLI binary if in development mode
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isGlobalInstall = process.env.npm_config_global === 'true' ||
                        process.env.PNPM_GLOBAL === 'true';

console.log('🔧 AutomatosX Post-Install Setup...\n');

// Step 1: Rebuild native modules
try {
  console.log('🔨 Rebuilding native modules for your platform...');

  // Rebuild tree-sitter native bindings
  execSync('node-gyp-build', {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore'
  });

  console.log('✅ Native modules rebuilt successfully!\n');
} catch (error) {
  console.log('⚠️  Native module rebuild skipped (this is normal for published packages)\n');
}

// Step 2: Link binary for development installs
const cliPath = path.join(__dirname, '../dist/cli/index.js');

if (!isGlobalInstall && fs.existsSync(cliPath)) {
  try {
    console.log('🔗 Linking AutomatosX CLI binary...');

    // Make CLI executable
    execSync(`chmod +x "${cliPath}"`, { stdio: 'inherit' });

    // Try to link globally with pnpm (only in dev mode)
    try {
      execSync('pnpm link --global', {
        stdio: 'ignore',
        cwd: path.join(__dirname, '..')
      });

      console.log('✅ AutomatosX CLI linked successfully!\n');
      console.log('You can now use:');
      console.log('  ax find "Calculator"');
      console.log('  ax def "getUserById"');
      console.log('  ax cli  # Interactive mode\n');
    } catch (linkError) {
      // Linking failed, but that's okay
      console.log('ℹ️  Global linking skipped (use "pnpm link --global" to link manually)\n');
    }
  } catch (error) {
    console.log('⚠️  Could not set up CLI binary.\n');
  }
} else if (isGlobalInstall) {
  console.log('✅ AutomatosX installed globally!');
  console.log('');
  console.log('You can now use:');
  console.log('  ax find "Calculator"');
  console.log('  ax def "getUserById"');
  console.log('  ax cli  # Interactive mode');
  console.log('');
}

console.log('Done! ✨\n');
