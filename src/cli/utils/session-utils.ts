/**
 * Session Utils - Shared utilities for session management in CLI commands
 *
 * @module cli/utils/session-utils
 * @since v4.7.0
 */

import { SessionManager } from '../../core/session-manager.js';
import { PathResolver } from '../../core/path-resolver.js';
import { join } from 'path';

/**
 * Create SessionManager instance with persistence
 *
 * Detects project root and initializes SessionManager with persistence file.
 * This is the standard way to create SessionManager in CLI commands.
 *
 * @returns Initialized SessionManager instance
 * @throws {Error} If project root cannot be detected or initialization fails
 *
 * @example
 * ```typescript
 * try {
 *   const sessionManager = await createSessionManager();
 *   const session = await sessionManager.createSession('Task', 'agent');
 * } catch (error) {
 *   console.error('Failed to initialize session manager:', error.message);
 *   process.exit(1);
 * }
 * ```
 */
export async function createSessionManager(): Promise<SessionManager> {
  try {
    // v5.2: agentWorkspace path kept for PathResolver compatibility (directory not created)
    const projectDir = await new PathResolver({
      projectDir: process.cwd(),
      workingDir: process.cwd(),
      agentWorkspace: join(process.cwd(), '.automatosx', 'workspaces')
    }).detectProjectRoot();

    const sessionManager = new SessionManager({
      persistencePath: join(projectDir, '.automatosx', 'sessions', 'sessions.json')
    });

    await sessionManager.initialize();
    return sessionManager;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Failed to initialize SessionManager: ${err.message}\n` +
      `Make sure you're in an AutomatosX project directory or run 'automatosx setup' first.`
    );
  }
}
