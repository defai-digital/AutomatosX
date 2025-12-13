#!/usr/bin/env node

/**
 * Validate Native Modules - Check better-sqlite3 and sqlite-vec binary compatibility
 *
 * This script validates that native modules are correctly compiled for the current
 * Node.js version. Run after `npm install` or when switching Node.js versions.
 *
 * Usage:
 *   node tools/validate-native-modules.js
 *   npm run validate:native
 *
 * Exit codes:
 *   0 - All native modules loaded successfully
 *   1 - One or more native modules failed to load
 */

const MODULES_TO_CHECK = [
  {
    name: 'better-sqlite3',
    test: (mod) => {
      const Database = mod.default || mod;
      const db = new Database(':memory:');
      const result = db.prepare('SELECT sqlite_version() as version').get();
      db.close();
      return result.version;
    },
    rebuildCmd: 'npm rebuild better-sqlite3'
  },
  {
    name: 'sqlite-vec',
    test: (mod) => {
      // sqlite-vec just needs to load; it's an extension
      return mod.version || 'loaded';
    },
    rebuildCmd: 'npm rebuild sqlite-vec',
    optional: true // Don't fail if not installed
  }
];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${colors.reset} ${message}`);
}

async function checkModule(moduleInfo) {
  const { name, test, rebuildCmd, optional } = moduleInfo;

  try {
    const mod = await import(name);
    const result = test(mod);
    log(colors.green, '✓', `${name}: OK (${result})`);
    return { name, success: true, result };
  } catch (error) {
    const errorMessage = error.message || String(error);

    // Check for common native module errors
    const isNativeError =
      errorMessage.includes('NODE_MODULE_VERSION') ||
      errorMessage.includes('was compiled against a different Node.js version') ||
      errorMessage.includes('.node') ||
      errorMessage.includes('module did not self-register') ||
      errorMessage.includes('symbol not found') ||
      errorMessage.includes('cannot load such file');

    if (optional && errorMessage.includes('Cannot find module')) {
      log(colors.dim, '○', `${name}: Not installed (optional)`);
      return { name, success: true, skipped: true };
    }

    if (isNativeError) {
      log(colors.red, '✗', `${name}: Binary incompatible with Node.js ${process.version}`);
      log(colors.dim, ' ', `  Error: ${errorMessage.split('\n')[0]}`);
      log(colors.yellow, '→', `  Fix: ${rebuildCmd}`);
    } else {
      log(colors.red, '✗', `${name}: Failed to load`);
      log(colors.dim, ' ', `  Error: ${errorMessage.split('\n')[0]}`);
    }

    return { name, success: false, error: errorMessage, isNativeError };
  }
}

async function main() {
  console.log('');
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}  Native Module Validation${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');
  log(colors.dim, '○', `Node.js: ${process.version}`);
  log(colors.dim, '○', `Platform: ${process.platform}-${process.arch}`);
  console.log('');

  const results = [];
  for (const moduleInfo of MODULES_TO_CHECK) {
    results.push(await checkModule(moduleInfo));
  }

  console.log('');

  const failures = results.filter((r) => !r.success);
  const nativeFailures = failures.filter((r) => r.isNativeError);

  if (failures.length === 0) {
    log(colors.green, '✓', 'All native modules validated successfully');
    console.log('');
    process.exit(0);
  }

  // Print summary and fix instructions
  console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.red}  ${failures.length} module(s) failed to load${colors.reset}`);
  console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');

  if (nativeFailures.length > 0) {
    console.log(`${colors.yellow}Quick fix - rebuild all native modules:${colors.reset}`);
    console.log('');
    console.log(`  ${colors.cyan}npm run rebuild:native${colors.reset}`);
    console.log('');
    console.log(`${colors.dim}Or rebuild individual modules:${colors.reset}`);
    for (const failure of nativeFailures) {
      const moduleInfo = MODULES_TO_CHECK.find((m) => m.name === failure.name);
      if (moduleInfo) {
        console.log(`  ${colors.dim}${moduleInfo.rebuildCmd}${colors.reset}`);
      }
    }
    console.log('');
    console.log(`${colors.dim}If rebuild fails, try a clean install:${colors.reset}`);
    console.log(`  ${colors.dim}rm -rf node_modules && npm install${colors.reset}`);
    console.log('');
  }

  process.exit(1);
}

main().catch((error) => {
  console.error('Validation script error:', error);
  process.exit(1);
});
