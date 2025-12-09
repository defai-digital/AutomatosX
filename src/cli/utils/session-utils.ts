/**
 * Session Utils - Shared utilities for session management in CLI commands
 *
 * @module cli/utils/session-utils
 * @since v4.7.0
 */

import { SessionManager } from '../../core/session/manager.js';
import { PathResolver } from '../../shared/validation/path-resolver.js';
import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { AX_PATHS } from '../../core/validation-limits.js';

// Global registry of active session managers (for cleanup on exit)
const activeSessionManagers = new Set<SessionManager>();
let exitHandlerInstalled = false;

/**
 * Install global exit handler to flush all session managers before process exit
 * This ensures pending saves complete even when process.exit() is called
 */
function installExitHandler(): void {
  if (exitHandlerInstalled) {
    return;
  }

  const flushAllSessions = async () => {
    if (activeSessionManagers.size === 0) {
      return;
    }

    logger.debug('Flushing session managers before exit', {
      count: activeSessionManagers.size
    });

    await Promise.all(
      Array.from(activeSessionManagers).map(async (manager) => {
        try {
          await manager.flushSave();
        } catch (error) {
          logger.error('Failed to flush session manager on exit', {
            error: (error as Error).message
          });
        }
      })
    );
  };

  // Register exit handlers
  process.on('beforeExit', () => {
    void flushAllSessions();
  });

  process.on('exit', () => {
    // Synchronous flush attempt (best effort)
    // Note: process.exit() doesn't wait for async operations
    // The real fix is to remove process.exit() calls and let Node exit naturally
  });

  // v12.5.3: Use void wrapper to properly handle async in signal handlers
  // Signal handlers can't be truly async, but we can fire-and-forget with proper error handling
  process.on('SIGINT', () => {
    void flushAllSessions()
      .catch(err => logger.error('SIGINT flush failed', { error: (err as Error).message }))
      .finally(() => process.exit(130)); // Standard exit code for SIGINT
  });

  process.on('SIGTERM', () => {
    void flushAllSessions()
      .catch(err => logger.error('SIGTERM flush failed', { error: (err as Error).message }))
      .finally(() => process.exit(143)); // Standard exit code for SIGTERM
  });

  exitHandlerInstalled = true;
  logger.debug('Session manager exit handler installed');
}

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
    // Install exit handler on first session manager creation
    installExitHandler();

    // v5.2: agentWorkspace path kept for PathResolver compatibility (directory not created)
    const projectDir = await new PathResolver({
      projectDir: process.cwd(),
      workingDir: process.cwd(),
      agentWorkspace: join(process.cwd(), AX_PATHS.WORKSPACES)
    }).detectProjectRoot();

    const sessionManager = new SessionManager({
      persistencePath: join(projectDir, AX_PATHS.SESSIONS, 'sessions.json')
    });

    await sessionManager.initialize();

    // Register for cleanup on exit
    activeSessionManagers.add(sessionManager);

    return sessionManager;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Failed to initialize SessionManager: ${err.message}\n` +
      `Make sure you're in an AutomatosX project directory or run 'automatosx setup' first.`
    );
  }
}

/**
 * Unregister a session manager from exit cleanup
 * Call this when done with a session manager to prevent memory leaks
 * @since v12.5.3
 */
export function unregisterSessionManager(manager: SessionManager): void {
  activeSessionManagers.delete(manager);
}

/**
 * Get count of active session managers (for debugging)
 * @since v12.5.3
 */
export function getActiveSessionManagerCount(): number {
  return activeSessionManagers.size;
}
