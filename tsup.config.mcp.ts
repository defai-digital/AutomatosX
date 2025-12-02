import { defineConfig } from 'tsup';

// MCP Server build configuration - runs sequentially to avoid Windows file locking issues
export default defineConfig({
  entry: ['src/mcp/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,  // Disabled to reduce package size (~25% reduction)
  treeshake: true,   // Enable tree shaking for optimization
  clean: false,      // Don't clean on second build (CLI build ran first)
  shims: true,
  outDir: 'dist/mcp',
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node'
  },
  // External packages that should not be bundled
  external: [
    // Native modules (must be external)
    'better-sqlite3',
    'sqlite-vec',

    // Interactive CLI dependencies (contain dynamic requires or native code)
    'marked',           // Markdown parser
    'marked-terminal',  // Terminal renderer (depends on cardinal)
    'cardinal',         // Syntax highlighter with dynamic require('fs')
    'cli-highlight',    // Alternative syntax highlighter
    'highlight.js',     // Highlight.js library

    // Terminal UI libraries (use ANSI codes, better loaded at runtime)
    'chalk',            // Terminal colors
    'ora',              // Spinners
    'boxen',            // Boxes
    'cli-table3',       // Tables
    'inquirer',         // User input (uses native TTY)

    // Other dependencies with dynamic behavior
    'yargs',            // CLI parser (works better external)
    'find-up',          // File finder
    'js-yaml',          // YAML parser
    'mustache',         // Template engine
    'openai'            // OpenAI SDK
  ]
});
