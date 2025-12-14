#!/usr/bin/env node
import { run } from './cli.js';

run(process.argv)
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
