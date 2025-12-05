/**
 * Mode State Manager
 *
 * Persists workflow mode state to disk for cross-invocation persistence.
 * Mode state is stored in .automatosx/state/mode.json
 *
 * @since v11.3.1
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { z } from 'zod';
import { logger } from '../../shared/logging/logger.js';
import { type WorkflowMode, isValidWorkflowMode } from './workflow-mode.js';
import { detectProjectRoot } from '../../shared/validation/path-resolver.js';

/**
 * Mode state schema for validation
 */
const ModeStateSchema = z.object({
  mode: z.enum(['default', 'plan', 'iterate', 'review']),
  setAt: z.number(),
  setBy: z.string().optional(),
  reason: z.string().optional(),
  expiresAt: z.number().optional()
});

export type ModeState = z.infer<typeof ModeStateSchema>;

/**
 * Default state file path relative to project root
 */
const STATE_FILE_PATH = '.automatosx/state/mode.json';

/**
 * Default expiration time for mode state (4 hours)
 * Modes expire to prevent stale state from persisting indefinitely
 */
const DEFAULT_EXPIRATION_MS = 4 * 60 * 60 * 1000;

/**
 * Get the full path to the state file
 */
async function getStateFilePath(): Promise<string> {
  const projectRoot = await detectProjectRoot(process.cwd());
  return join(projectRoot, STATE_FILE_PATH);
}

/**
 * Load the current mode state from disk
 * Returns null if no state exists or state is invalid/expired
 */
export async function loadModeState(): Promise<ModeState | null> {
  try {
    const statePath = await getStateFilePath();

    if (!existsSync(statePath)) {
      logger.debug('No mode state file found', { path: statePath });
      return null;
    }

    const content = readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = ModeStateSchema.safeParse(parsed);

    if (!result.success) {
      logger.warn('Invalid mode state file', {
        path: statePath,
        error: result.error.message
      });
      return null;
    }

    const state = result.data;

    // Check if state has expired
    if (state.expiresAt && Date.now() > state.expiresAt) {
      logger.debug('Mode state expired', {
        mode: state.mode,
        expiredAt: new Date(state.expiresAt).toISOString()
      });
      return null;
    }

    logger.debug('Loaded mode state', {
      mode: state.mode,
      setAt: new Date(state.setAt).toISOString()
    });

    return state;
  } catch (error) {
    logger.error('Failed to load mode state', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Save mode state to disk
 */
export async function saveModeState(
  mode: WorkflowMode,
  options?: {
    setBy?: string;
    reason?: string;
    expiresIn?: number; // ms, defaults to DEFAULT_EXPIRATION_MS
  }
): Promise<boolean> {
  try {
    const statePath = await getStateFilePath();
    const stateDir = dirname(statePath);

    // Ensure state directory exists
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    const state: ModeState = {
      mode,
      setAt: Date.now(),
      setBy: options?.setBy ?? 'cli',
      reason: options?.reason,
      expiresAt: Date.now() + (options?.expiresIn ?? DEFAULT_EXPIRATION_MS)
    };

    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');

    logger.debug('Saved mode state', {
      mode,
      expiresAt: new Date(state.expiresAt!).toISOString()
    });

    return true;
  } catch (error) {
    logger.error('Failed to save mode state', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Clear the persisted mode state (reset to default)
 */
export async function clearModeState(): Promise<boolean> {
  try {
    const statePath = await getStateFilePath();

    if (existsSync(statePath)) {
      // Write default state instead of deleting
      await saveModeState('default', {
        setBy: 'cli',
        reason: 'mode cleared'
      });
    }

    logger.debug('Cleared mode state');
    return true;
  } catch (error) {
    logger.error('Failed to clear mode state', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Get the current persisted mode
 * Returns 'default' if no state exists or state is invalid/expired
 */
export async function getCurrentPersistedMode(): Promise<WorkflowMode> {
  const state = await loadModeState();
  return state?.mode ?? 'default';
}

/**
 * Check if mode persistence is enabled
 * Can be disabled via environment variable
 */
export function isModePersistenceEnabled(): boolean {
  return process.env.AX_DISABLE_MODE_PERSISTENCE !== 'true';
}
