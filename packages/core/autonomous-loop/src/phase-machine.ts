/**
 * Phase Machine
 *
 * State machine for autonomous loop phase transitions.
 *
 * Invariants:
 * - INV-ALO-006: Valid phase transitions only
 * - INV-ALO-004: Breakpoints pause execution
 */

import type {
  AutonomousLoopPhase,
  AutonomousLoopState,
  AutonomousLoopConfig,
} from '@defai.digital/contracts';
import {
  PHASE_TRANSITIONS,
  isValidPhaseTransition,
} from '@defai.digital/contracts';

/**
 * Error for invalid phase transitions
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: AutonomousLoopPhase,
    public readonly to: AutonomousLoopPhase
  ) {
    super(`Invalid phase transition from '${from}' to '${to}'`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Phase machine for managing loop transitions
 */
export interface PhaseMachine {
  /**
   * Get current phase
   */
  getCurrentPhase(): AutonomousLoopPhase;

  /**
   * Transition to next phase
   * INV-ALO-006: Validates transition is allowed
   */
  transition(to: AutonomousLoopPhase): void;

  /**
   * Check if transition is valid
   */
  canTransitionTo(to: AutonomousLoopPhase): boolean;

  /**
   * Get valid next phases
   */
  getValidNextPhases(): AutonomousLoopPhase[];

  /**
   * Check if current phase is a breakpoint
   * INV-ALO-004: Breakpoints pause execution
   */
  isBreakpoint(): boolean;

  /**
   * Check if loop is complete
   */
  isComplete(): boolean;

  /**
   * Reset to initial phase
   */
  reset(): void;
}

/**
 * Creates a phase machine instance
 */
export function createPhaseMachine(
  initialPhase: AutonomousLoopPhase,
  config: AutonomousLoopConfig
): PhaseMachine {
  let currentPhase = initialPhase;
  const breakpoints = new Set(config.breakpoints);

  return {
    getCurrentPhase(): AutonomousLoopPhase {
      return currentPhase;
    },

    transition(to: AutonomousLoopPhase): void {
      // INV-ALO-006: Valid phase transitions only
      if (!isValidPhaseTransition(currentPhase, to)) {
        throw new InvalidTransitionError(currentPhase, to);
      }

      // INV-ALO-002: Test must pass before verify (when requireTestPass=true)
      // When requireTestPass is enabled, only allow verify from test phase
      if (to === 'verify' && config.requireTestPass && currentPhase !== 'test') {
        throw new InvalidTransitionError(currentPhase, to);
      }

      currentPhase = to;
    },

    canTransitionTo(to: AutonomousLoopPhase): boolean {
      if (!isValidPhaseTransition(currentPhase, to)) {
        return false;
      }
      // INV-ALO-002: When requireTestPass is enabled, only allow verify from test phase
      if (to === 'verify' && config.requireTestPass && currentPhase !== 'test') {
        return false;
      }
      return true;
    },

    getValidNextPhases(): AutonomousLoopPhase[] {
      const phases = PHASE_TRANSITIONS[currentPhase];

      // INV-ALO-002: Filter out verify if requireTestPass is true and we're not on test phase
      if (config.requireTestPass && currentPhase !== 'test') {
        return phases.filter((p) => p !== 'verify');
      }

      return phases;
    },

    isBreakpoint(): boolean {
      // INV-ALO-004: Check if current phase is a breakpoint
      return breakpoints.has(currentPhase);
    },

    isComplete(): boolean {
      return currentPhase === 'complete';
    },

    reset(): void {
      currentPhase = 'plan';
    },
  };
}

/**
 * Determine next phase based on current state and results
 */
export function determineNextPhase(
  state: AutonomousLoopState,
  testPassed?: boolean,
  guardPassed?: boolean
): AutonomousLoopPhase {
  const { phase, config, currentFixAttempts } = state;

  switch (phase) {
    case 'plan':
      return 'write';

    case 'write':
      // After write, always go to test if requireTestPass
      // INV-ALO-002: Test phase before verify
      if (config.requireTestPass) {
        return 'test';
      }
      // If not requiring tests, go directly to verify
      return 'verify';

    case 'test':
      if (testPassed) {
        return 'verify';
      }
      // Tests failed - try to fix
      // INV-ALO-003: Check fix attempts
      if (currentFixAttempts < config.maxFixAttempts) {
        return 'fix';
      }
      // Max fix attempts reached - fail or go back to write
      return 'write';

    case 'fix':
      // After fix, run tests again
      return 'test';

    case 'verify':
      if (guardPassed !== false) {
        return 'complete';
      }
      // Verification failed - go back to write
      return 'write';

    case 'complete':
      // Terminal state
      return 'complete';

    default:
      return 'plan';
  }
}

/**
 * Get phase display name for UI
 */
export function getPhaseDisplayName(phase: AutonomousLoopPhase): string {
  const names: Record<AutonomousLoopPhase, string> = {
    plan: 'Planning',
    write: 'Writing Code',
    test: 'Running Tests',
    fix: 'Fixing Issues',
    verify: 'Verifying',
    complete: 'Complete',
  };
  return names[phase];
}

/**
 * Get phase emoji for display
 */
export function getPhaseEmoji(phase: AutonomousLoopPhase): string {
  const emojis: Record<AutonomousLoopPhase, string> = {
    plan: '📋',
    write: '✍️',
    test: '🧪',
    fix: '🔧',
    verify: '✅',
    complete: '🎉',
  };
  return emojis[phase];
}

/**
 * Calculate progress percentage based on phase
 */
export function calculateProgress(state: AutonomousLoopState): number {
  const phaseWeights: Record<AutonomousLoopPhase, number> = {
    plan: 10,
    write: 30,
    test: 20,
    fix: 15,
    verify: 20,
    complete: 100,
  };

  const baseProgress = phaseWeights[state.phase];

  // Adjust for iterations
  if (state.iteration > 0 && state.phase !== 'complete') {
    const iterationPenalty = Math.min(state.iteration * 5, 20);
    return Math.max(baseProgress - iterationPenalty, 5);
  }

  return baseProgress;
}
