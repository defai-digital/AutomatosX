import { createRequire } from 'node:module';

const SQLITE_WARNING_TEXT = 'SQLite is an experimental feature and might change at any time';
const originalEmitWarning = process.emitWarning;

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const message = typeof warning === 'string'
    ? warning
    : warning instanceof Error
      ? warning.message
      : '';

  if (message.includes(SQLITE_WARNING_TEXT)) {
    return;
  }

  return (originalEmitWarning as (...innerArgs: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;

const require = createRequire(import.meta.url);
const sqlite = require('node:sqlite') as typeof import('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
export const StatementSync = sqlite.StatementSync;
export const constants = sqlite.constants;
