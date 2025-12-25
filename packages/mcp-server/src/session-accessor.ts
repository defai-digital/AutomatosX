/**
 * Session Accessor
 *
 * Provides shared access to session store and manager across MCP components.
 * Ensures all components use the same session state.
 *
 * This avoids the bug where multiple modules create their own session store/manager
 * leading to disconnected session state.
 */

import {
  createSessionStore,
  createSessionManager,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionStore,
  type SessionManager,
} from '@defai.digital/session-domain';

// Lazy-initialized singleton instances
let _store: SessionStore | null = null;
let _manager: SessionManager | null = null;

/**
 * Get the shared session store instance
 */
export function getSharedSessionStore(): SessionStore {
  if (_store === null) {
    _store = createSessionStore();
  }
  return _store;
}

/**
 * Get the shared session manager instance
 */
export function getSharedSessionManager(): SessionManager {
  if (_manager === null) {
    _manager = createSessionManager(getSharedSessionStore(), DEFAULT_SESSION_DOMAIN_CONFIG);
  }
  return _manager;
}

/**
 * Reset shared session instances (for testing)
 */
export function resetSharedSession(): void {
  _store = null;
  _manager = null;
}
