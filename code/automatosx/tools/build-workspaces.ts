#!/usr/bin/env node
import { buildAllWorkspaces } from './workspace-build.ts';

try {
  await buildAllWorkspaces();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
