#!/usr/bin/env npx tsx
/**
 * Lint Ability Hints - Validates Application Hints in ability files
 *
 * PRD-014: Ability Application Hints
 *
 * Rules:
 * 1. Application Hints section must be at end of file (after all domain content)
 * 2. Maximum 5 bullet points
 * 3. No scaffold keywords that conflict with PROVER
 * 4. Each hint must be actionable (start with verb or action phrase)
 * 5. No hints longer than 150 characters
 *
 * Usage:
 *   npx tsx tools/lint-ability-hints.ts [--fix] [path]
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Configuration
const CONFIG = {
  maxHints: 5,
  maxHintLength: 150,
  forbiddenKeywords: [
    'step 1',
    'step 2',
    'step 3',
    'step 4',
    'step 5',
    'phase 1',
    'phase 2',
    'phase 3',
    'reflect on',
    'iterate until',
    'chain of thought',
    'reasoning loop',
    'prover',
    'scaffold',
  ],
  hintsHeaderPattern: /^## Application Hints\s*$/m,
  hintBulletPattern: /^- (.+)$/gm,
};

interface LintResult {
  file: string;
  valid: boolean;
  hasHints: boolean;
  errors: string[];
  warnings: string[];
  hints: string[];
}

interface LintSummary {
  total: number;
  withHints: number;
  withoutHints: number;
  valid: number;
  invalid: number;
  errors: number;
  warnings: number;
}

/**
 * Extract the Application Hints section from a file
 */
function extractHintsSection(content: string): string | null {
  const match = content.match(/## Application Hints\s*\n([\s\S]*?)(?=\n## |\n# |$)/);
  return match ? match[1].trim() : null;
}

/**
 * Extract individual hints from the hints section
 */
function extractHints(hintsSection: string): string[] {
  const hints: string[] = [];
  const lines = hintsSection.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      hints.push(trimmed.substring(2).trim());
    }
  }

  return hints;
}

/**
 * Check if a hint starts with an actionable verb/phrase
 */
function isActionable(hint: string): boolean {
  const actionableStarters = [
    // Verbs
    'prioritize',
    'validate',
    'check',
    'verify',
    'ensure',
    'test',
    'review',
    'identify',
    'analyze',
    'apply',
    'consider',
    'document',
    'avoid',
    'use',
    'implement',
    'design',
    'create',
    'define',
    'establish',
    'measure',
    'monitor',
    'optimize',
    'minimize',
    'maximize',
    'balance',
    'focus',
    'start',
    'begin',
    'end',
    'run',
    'execute',
    'perform',
    'maintain',
    'update',
    'track',
    'log',
    'debug',
    'fix',
    'resolve',
    'isolate',
    'reproduce',
    'simulate',
    'profile',
    'benchmark',
    'target',
    'aim',
    'seek',
    'prefer',
    'favor',
    'choose',
    'select',
    'decide',
    'determine',
    'assess',
    'evaluate',
    'judge',
    'rate',
    'score',
    'rank',
    'order',
    'sort',
    'group',
    'categorize',
    'classify',
    'organize',
    'structure',
    'format',
    'style',
    'name',
    'label',
    'tag',
    'mark',
    'flag',
    'highlight',
    'annotate',
    'comment',
    'explain',
    'describe',
    'summarize',
    'report',
    'communicate',
    'share',
    'publish',
    'deploy',
    'release',
    'ship',
    'deliver',
    'launch',
    'roll',
    'push',
    'pull',
    'fetch',
    'get',
    'set',
    'put',
    'post',
    'delete',
    'remove',
    'add',
    'insert',
    'append',
    'prepend',
    'replace',
    'substitute',
    'swap',
    'exchange',
    'convert',
    'transform',
    'translate',
    'map',
    'reduce',
    'filter',
    'find',
    'search',
    'lookup',
    'query',
    'scan',
    'parse',
    'read',
    'write',
    'load',
    'save',
    'store',
    'cache',
    'buffer',
    'queue',
    'stack',
    'push',
    'pop',
    'shift',
    'unshift',
    'split',
    'join',
    'merge',
    'combine',
    'aggregate',
    'collect',
    'gather',
    'accumulate',
    'compute',
    'calculate',
    'count',
    'sum',
    'average',
    'mean',
    'median',
    'mode',
    'min',
    'max',
    'limit',
    'cap',
    'bound',
    'constrain',
    'restrict',
    'allow',
    'permit',
    'grant',
    'deny',
    'reject',
    'accept',
    'approve',
    'confirm',
    'acknowledge',
    'handle',
    'process',
    'manage',
    'control',
    'govern',
    'regulate',
    'enforce',
    'require',
    'demand',
    'expect',
    'assume',
    'presume',
    'suppose',
    'guess',
    'estimate',
    'approximate',
    'round',
    'truncate',
    'clip',
    'clamp',
    'normalize',
    'standardize',
    'sanitize',
    'clean',
    'purge',
    'clear',
    'reset',
    'initialize',
    'setup',
    'configure',
    'customize',
    'adapt',
    'adjust',
    'tune',
    'tweak',
    'calibrate',
    'align',
    'synchronize',
    'coordinate',
    'orchestrate',
    'automate',
    'schedule',
    'trigger',
    'fire',
    'emit',
    'dispatch',
    'send',
    'receive',
    'listen',
    'watch',
    'observe',
    'subscribe',
    'unsubscribe',
    'register',
    'unregister',
    'bind',
    'unbind',
    'attach',
    'detach',
    'connect',
    'disconnect',
    'open',
    'close',
    'start',
    'stop',
    'pause',
    'resume',
    'restart',
    'retry',
    'repeat',
    'loop',
    'iterate',
    'recurse',
    'traverse',
    'visit',
    'explore',
    'discover',
    'detect',
    'recognize',
    'understand',
    'comprehend',
    'interpret',
    'infer',
    'deduce',
    'conclude',
    'decide',
    'resolve',
    'settle',
    'finalize',
    'complete',
    'finish',
    'done',
    'wrap',
    'seal',
    'sign',
    'encrypt',
    'decrypt',
    'encode',
    'decode',
    'compress',
    'decompress',
    'zip',
    'unzip',
    'pack',
    'unpack',
    'serialize',
    'deserialize',
    'marshal',
    'unmarshal',
    'stringify',
    'never',
    'always',
    'only',
    'do',
    "don't",
    'be',
    'keep',
    'make',
    'let',
    'have',
    'take',
    'give',
    'get',
    'put',
  ];

  const lowerHint = hint.toLowerCase();
  return actionableStarters.some(
    (starter) => lowerHint.startsWith(starter) || lowerHint.startsWith(starter + ' ')
  );
}

/**
 * Lint a single ability file
 */
function lintFile(filePath: string): LintResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: LintResult = {
    file: filePath,
    valid: true,
    hasHints: false,
    errors: [],
    warnings: [],
    hints: [],
  };

  // Check if file has Application Hints section
  const hintsSection = extractHintsSection(content);

  if (!hintsSection) {
    result.hasHints = false;
    result.warnings.push('No Application Hints section found');
    return result;
  }

  result.hasHints = true;

  // Extract hints
  result.hints = extractHints(hintsSection);

  // Rule 1: Check hints section is at end of file
  const hintsIndex = content.indexOf('## Application Hints');
  const afterHints = content.substring(hintsIndex + '## Application Hints'.length);
  const hasContentAfter = /\n## [^A]/.test(afterHints) || /\n# /.test(afterHints);

  if (hasContentAfter) {
    result.errors.push('Application Hints section must be at the end of the file');
    result.valid = false;
  }

  // Rule 2: Check max hints
  if (result.hints.length > CONFIG.maxHints) {
    result.errors.push(
      `Too many hints: ${result.hints.length} (max ${CONFIG.maxHints})`
    );
    result.valid = false;
  }

  // Check each hint
  for (let i = 0; i < result.hints.length; i++) {
    const hint = result.hints[i];

    // Rule 3: Check for forbidden keywords
    for (const keyword of CONFIG.forbiddenKeywords) {
      if (hint.toLowerCase().includes(keyword)) {
        result.errors.push(
          `Hint ${i + 1}: Contains forbidden scaffold keyword "${keyword}"`
        );
        result.valid = false;
      }
    }

    // Rule 4: Check if actionable
    if (!isActionable(hint)) {
      result.warnings.push(
        `Hint ${i + 1}: Should start with an action verb (e.g., "Prioritize", "Validate", "Check")`
      );
    }

    // Rule 5: Check length
    if (hint.length > CONFIG.maxHintLength) {
      result.warnings.push(
        `Hint ${i + 1}: Exceeds ${CONFIG.maxHintLength} characters (${hint.length} chars)`
      );
    }
  }

  // Check for empty hints section
  if (result.hints.length === 0) {
    result.errors.push('Application Hints section is empty');
    result.valid = false;
  }

  return result;
}

/**
 * Print results in a formatted way
 */
function printResults(results: LintResult[], verbose: boolean): void {
  const summary: LintSummary = {
    total: results.length,
    withHints: results.filter((r) => r.hasHints).length,
    withoutHints: results.filter((r) => !r.hasHints).length,
    valid: results.filter((r) => r.valid && r.hasHints).length,
    invalid: results.filter((r) => !r.valid && r.hasHints).length,
    errors: results.reduce((sum, r) => sum + r.errors.length, 0),
    warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
  };

  console.log('\n📋 Ability Hints Lint Report\n');
  console.log('═'.repeat(60));

  // Print detailed results
  for (const result of results) {
    if (!verbose && result.valid && result.errors.length === 0 && result.warnings.length === 0) {
      continue;
    }

    const fileName = path.basename(result.file);
    const status = result.hasHints
      ? result.valid
        ? '✅'
        : '❌'
      : '⚠️';

    console.log(`\n${status} ${fileName}`);

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`   ❌ ERROR: ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(`   ⚠️  WARN: ${warning}`);
      }
    }

    if (verbose && result.hints.length > 0) {
      console.log('   📝 Hints:');
      for (const hint of result.hints) {
        const truncated = hint.length > 60 ? hint.substring(0, 60) + '...' : hint;
        console.log(`      - ${truncated}`);
      }
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary\n');
  console.log(`   Total files:      ${summary.total}`);
  console.log(`   With hints:       ${summary.withHints}`);
  console.log(`   Without hints:    ${summary.withoutHints}`);
  console.log(`   Valid:            ${summary.valid}`);
  console.log(`   Invalid:          ${summary.invalid}`);
  console.log(`   Total errors:     ${summary.errors}`);
  console.log(`   Total warnings:   ${summary.warnings}`);

  const passRate =
    summary.withHints > 0
      ? ((summary.valid / summary.withHints) * 100).toFixed(1)
      : 'N/A';
  console.log(`   Pass rate:        ${passRate}%`);
  console.log('');

  // Exit with error code if there are errors
  if (summary.errors > 0) {
    console.log('❌ Lint failed with errors\n');
    process.exit(1);
  } else if (summary.warnings > 0) {
    console.log('⚠️  Lint passed with warnings\n');
  } else {
    console.log('✅ Lint passed\n');
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const pathArg = args.find((a) => !a.startsWith('-'));

  // Determine paths to lint
  let patterns: string[];
  if (pathArg) {
    if (fs.statSync(pathArg).isDirectory()) {
      patterns = [path.join(pathArg, '**/*.md')];
    } else {
      patterns = [pathArg];
    }
  } else {
    patterns = [
      'examples/abilities/*.md',
      '.automatosx/abilities/*.md',
    ];
  }

  // Find all files
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  if (files.length === 0) {
    console.log('No ability files found');
    process.exit(0);
  }

  // Lint all files
  const results = files.map(lintFile);

  // Print results
  printResults(results, verbose);
}

main().catch(console.error);
