#!/usr/bin/env node
import { runStdioServer } from './stdio.js';

runStdioServer().catch((error: unknown) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
