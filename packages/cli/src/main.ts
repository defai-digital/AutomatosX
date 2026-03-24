#!/usr/bin/env node
import { executeCli, parseCommand, renderCommandResult } from './index.js';

const argv = process.argv.slice(2);
const parsed = parseCommand(argv);
const result = await executeCli(argv);
const output = renderCommandResult(result, parsed.options);

if (output.length > 0) {
  if (result.exitCode === 0) {
    process.stdout.write(output);
  } else {
    process.stderr.write(output);
  }
}

process.exit(result.exitCode);
