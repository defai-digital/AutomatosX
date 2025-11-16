/**
 * AutomatosX Interactive CLI
 *
 * Entry point for ax-cli conversational interface
 * MVP v0.1.0 - Week 1 Implementation
 */

import { REPLManager } from './repl.js';

export { REPLManager };
export * from './types.js';
export * from './conversation.js';
export * from './renderer.js';
export * from './commands.js';

/**
 * Start the interactive CLI
 */
export async function startInteractiveCLI(): Promise<void> {
  const repl = new REPLManager({
    welcomeMessage: true,
    colors: true,
    spinner: true,
    autoSave: true,
    autoSaveInterval: 30000
  });

  await repl.start();
}

/**
 * CLI entry point (when run directly)
 *
 * NOTE: This is intentionally commented out to prevent double-execution
 * in the bundled environment. The CLI should only be started via the
 * command handler in src/cli/commands/cli-interactive.ts
 */
// if (import.meta.url === `file://${process.argv[1]}`) {
//   startInteractiveCLI().catch((error) => {
//     console.error('Failed to start interactive CLI:', error);
//     process.exit(1);
//   });
// }
