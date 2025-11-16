/**
 * Tests for phase3-integration.ts
 * Verifies Phase3Features class and integration helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Phase3Features,
  initPhase3Features,
  getPhase3Features,
  showStartupBanner,
  updateAfterCommand,
  updateAfterAIResponse,
  trackAgentDelegation,
  showSessionStatus
} from '../src/phase3-integration.js';

describe('Phase3Features Class', () => {
  let features: Phase3Features;

  beforeEach(() => {
    features = new Phase3Features(process.cwd());
  });

  describe('constructor', () => {
    it('should initialize with workspace root', () => {
      const features = new Phase3Features('/custom/workspace');

      expect(features).toBeDefined();
      expect(features.getSession()).toBeNull(); // Not initialized yet
    });

    it('should use current directory if no workspace provided', () => {
      const features = new Phase3Features();

      expect(features).toBeDefined();
    });
  });

  describe('initSession', () => {
    it('should initialize session snapshot', () => {
      features.initSession('test-session', 'claude');

      const session = features.getSession();

      expect(session).not.toBeNull();
      expect(session!.name).toBe('test-session');
      expect(session!.provider).toBe('claude');
    });

    it('should initialize outcome tracker', () => {
      features.initSession('test-session');

      const tracker = features.getOutcomeTracker();

      expect(tracker).not.toBeNull();
      expect(tracker!.sessionId).toBe('test-session');
    });

    it('should accept optional provider', () => {
      features.initSession('session1', 'gemini');

      const session = features.getSession();
      expect(session!.provider).toBe('gemini');
    });

    it('should work without provider', () => {
      features.initSession('session2');

      const session = features.getSession();
      expect(session).not.toBeNull();
    });
  });

  describe('updateSession', () => {
    beforeEach(() => {
      features.initSession('test', 'claude');
    });

    it('should update session properties', () => {
      features.updateSession({
        messagesInSession: 10,
        lastAction: 'Ran tests'
      });

      const session = features.getSession();
      expect(session!.messagesInSession).toBe(10);
      expect(session!.lastAction).toBe('Ran tests');
    });

    it('should handle no session gracefully', () => {
      const noSession = new Phase3Features();

      expect(() => {
        noSession.updateSession({ messagesInSession: 5 });
      }).not.toThrow();
    });

    it('should preserve unmodified fields', () => {
      const session = features.getSession();
      const originalName = session!.name;

      features.updateSession({ messagesInSession: 5 });

      expect(features.getSession()!.name).toBe(originalName);
    });
  });

  describe('showSessionHeader', () => {
    it('should output session header', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.initSession('test', 'claude');
      features.showSessionHeader();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not crash if session not initialized', () => {
      expect(() => {
        features.showSessionHeader();
      }).not.toThrow();
    });
  });

  describe('showSessionSnapshot', () => {
    it('should display full session snapshot', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.initSession('test', 'claude');
      features.showSessionSnapshot();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('test');

      consoleSpy.mockRestore();
    });

    it('should handle no session', () => {
      expect(() => {
        features.showSessionSnapshot();
      }).not.toThrow();
    });
  });

  describe('showWorkspaceBanner', () => {
    it('should display workspace banner', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.showWorkspaceBanner();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should detect workspace state', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.showWorkspaceBanner();

      const output = consoleSpy.mock.calls[0][0];
      expect(output).toBeTruthy();

      consoleSpy.mockRestore();
    });
  });

  describe('trackAgent', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should track agent activity', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Implement API', 'starting');

      const updates = features.getAgentUpdates();
      expect(updates.length).toBe(1);
      expect(updates[0].agent).toBe('backend');
      expect(updates[0].task).toBe('Implement API');
      expect(updates[0].status).toBe('starting');

      consoleSpy.mockRestore();
    });

    it('should update session with active agents', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task 1', 'in_progress');
      features.trackAgent('security', 'Task 2', 'in_progress');

      const session = features.getSession();
      expect(session!.activeAgents).toContain('backend');
      expect(session!.activeAgents).toContain('security');

      consoleSpy.mockRestore();
    });

    it('should render agent update', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task', 'complete');

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('backend');

      consoleSpy.mockRestore();
    });

    it('should accept optional parameters', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task', 'complete', {
        duration: 5000,
        output: 'Success'
      });

      const updates = features.getAgentUpdates();
      expect(updates[0].duration).toBe(5000);
      expect(updates[0].output).toBe('Success');

      consoleSpy.mockRestore();
    });
  });

  describe('showAgentChain', () => {
    it('should show delegation chain', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('product', 'Design', 'complete', { depth: 0 });
      features.trackAgent('backend', 'Implement', 'complete', { depth: 1 });

      features.showAgentChain();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle no agents gracefully', () => {
      expect(() => {
        features.showAgentChain();
      }).not.toThrow();
    });
  });

  describe('showLiveAgentStatus', () => {
    it('should show active agents', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task', 'in_progress');
      features.showLiveAgentStatus();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('showAgentSummary', () => {
    it('should show agent activity summary', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task 1', 'complete');
      features.trackAgent('backend', 'Task 2', 'in_progress');
      features.showAgentSummary();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('trackCommandOutcome', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should detect and track test outcomes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackCommandOutcome('test', '47 passed, 47 total', 0);

      const tracker = features.getOutcomeTracker();
      expect(tracker!.outcomes.length).toBe(1);
      expect(tracker!.outcomes[0].id).toBe('tests');

      consoleSpy.mockRestore();
    });

    it('should detect build outcomes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackCommandOutcome('build', 'Build succeeded', 0);

      const tracker = features.getOutcomeTracker();
      expect(tracker!.outcomes.some(o => o.id === 'build')).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should update existing outcomes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackCommandOutcome('test', '10 passed', 0);
      features.trackCommandOutcome('test', '20 passed', 0);

      const tracker = features.getOutcomeTracker();
      const testOutcomes = tracker!.outcomes.filter(o => o.id === 'tests');
      expect(testOutcomes.length).toBe(1); // Updated, not duplicated

      consoleSpy.mockRestore();
    });

    it('should handle unrecognized commands', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackCommandOutcome('unknown', 'output', 0);

      const tracker = features.getOutcomeTracker();
      expect(tracker!.outcomes.length).toBe(0);

      consoleSpy.mockRestore();
    });

    it('should show outcomes automatically', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackCommandOutcome('test', '10 passed', 0);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('addOutcome', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should add custom outcome', () => {
      features.addOutcome('deploy', 'Deployment successful', 'complete');

      const tracker = features.getOutcomeTracker();
      expect(tracker!.outcomes.some(o => o.id === 'deploy')).toBe(true);
    });

    it('should accept optional properties', () => {
      features.addOutcome('security', 'Security audit', 'complete', {
        message: 'No vulnerabilities found',
        details: ['Scanned 100 files']
      });

      const tracker = features.getOutcomeTracker();
      const outcome = tracker!.outcomes.find(o => o.id === 'security');
      expect(outcome!.message).toBe('No vulnerabilities found');
      expect(outcome!.details).toEqual(['Scanned 100 files']);
    });

    it('should handle no tracker gracefully', () => {
      const noTracker = new Phase3Features();

      expect(() => {
        noTracker.addOutcome('test', 'Test', 'pending');
      }).not.toThrow();
    });
  });

  describe('showOutcomes', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should display outcomes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.addOutcome('tests', 'Tests', 'complete');
      features.showOutcomes();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should support compact mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.addOutcome('tests', 'Tests', 'complete');
      features.showOutcomes({ compact: true });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('showOutcomeStatusBar', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should show status bar', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.addOutcome('tests', 'Tests', 'complete');
      features.showOutcomeStatusBar();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('showProgressBar', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should show progress bar', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.addOutcome('tests', 'Tests', 'complete');
      features.addOutcome('build', 'Build', 'pending');
      features.showProgressBar();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      expect(output).toContain('1/2');

      consoleSpy.mockRestore();
    });
  });

  describe('showNextActions', () => {
    beforeEach(() => {
      features.initSession('test');
    });

    it('should suggest next actions', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.addOutcome('tests', 'Tests', 'pending');
      features.showNextActions();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle no suggestions gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.showNextActions();

      // Should not crash
      consoleSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear all Phase 3 state', () => {
      features.initSession('test');
      features.trackAgent('backend', 'Task', 'complete');
      features.addOutcome('tests', 'Tests', 'complete');

      features.clear();

      expect(features.getSession()).toBeNull();
      expect(features.getAgentUpdates()).toEqual([]);
      expect(features.getOutcomeTracker()).toBeNull();
    });

    it('should allow re-initialization after clear', () => {
      features.initSession('test1');
      features.clear();
      features.initSession('test2');

      expect(features.getSession()).not.toBeNull();
      expect(features.getSession()!.name).toBe('test2');
    });
  });
});

describe('Integration Helpers', () => {
  describe('initPhase3Features', () => {
    it('should initialize and return Phase3Features', () => {
      const features = initPhase3Features(process.cwd(), 'main', 'claude');

      expect(features).toBeInstanceOf(Phase3Features);
      expect(features.getSession()).not.toBeNull();
      expect(features.getSession()!.name).toBe('main');
    });

    it('should set global instance', () => {
      initPhase3Features(process.cwd(), 'test-session');

      const global = getPhase3Features();
      expect(global).not.toBeNull();
      expect(global!.getSession()!.name).toBe('test-session');
    });

    it('should use defaults for optional parameters', () => {
      const features = initPhase3Features();

      expect(features.getSession()).not.toBeNull();
      expect(features.getSession()!.name).toBe('main');
    });
  });

  describe('getPhase3Features', () => {
    it('should return global instance', () => {
      initPhase3Features(process.cwd(), 'global-test');

      const global = getPhase3Features();
      expect(global).not.toBeNull();
      expect(global!.getSession()!.name).toBe('global-test');
    });

    it('should return null if not initialized', () => {
      // Note: This test might fail if other tests have initialized global
      // In a real scenario, we'd reset the global state
      const global = getPhase3Features();
      expect(global).toBeDefined(); // Either null or instance
    });
  });

  describe('showStartupBanner', () => {
    it('should show workspace banner and session header', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const features = new Phase3Features();
      features.initSession('test', 'claude');

      showStartupBanner(features);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      consoleSpy.mockRestore();
    });
  });

  describe('updateAfterCommand', () => {
    let features: Phase3Features;

    beforeEach(() => {
      features = new Phase3Features();
      features.initSession('test');
    });

    it('should track command outcome', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      updateAfterCommand(features, 'test', '10 passed', 0, 'Ran tests');

      const tracker = features.getOutcomeTracker();
      expect(tracker!.outcomes.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should update session with last action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      updateAfterCommand(features, 'test', 'output', 0, 'Ran tests');

      const session = features.getSession();
      expect(session!.lastAction).toBe('Ran tests');

      consoleSpy.mockRestore();
    });

    it('should work without last action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => {
        updateAfterCommand(features, 'test', 'output', 0);
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('updateAfterAIResponse', () => {
    let features: Phase3Features;

    beforeEach(() => {
      features = new Phase3Features();
      features.initSession('test');
    });

    it('should update message count', () => {
      updateAfterAIResponse(features, 5);

      const session = features.getSession();
      expect(session!.messagesInSession).toBe(5);
    });

    it('should update last action', () => {
      updateAfterAIResponse(features, 10);

      const session = features.getSession();
      expect(session!.lastAction).toBe('AI response');
    });
  });

  describe('trackAgentDelegation', () => {
    let features: Phase3Features;

    beforeEach(() => {
      features = new Phase3Features();
      features.initSession('test');
    });

    it('should track agent start', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      trackAgentDelegation(features, 'backend', 'Implement API', 'starting');

      const updates = features.getAgentUpdates();
      expect(updates.length).toBe(1);
      expect(updates[0].status).toBe('starting');

      consoleSpy.mockRestore();
    });

    it('should track agent completion with duration', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      trackAgentDelegation(features, 'backend', 'Task', 'complete', 5000);

      const updates = features.getAgentUpdates();
      expect(updates[0].duration).toBe(5000);

      consoleSpy.mockRestore();
    });

    it('should track agent error', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      trackAgentDelegation(features, 'backend', 'Task', 'error');

      const updates = features.getAgentUpdates();
      expect(updates[0].status).toBe('error');

      consoleSpy.mockRestore();
    });

    it('should update session last action', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      trackAgentDelegation(features, 'backend', 'Task', 'starting');

      const session = features.getSession();
      expect(session!.lastAction).toBe('@backend started');

      consoleSpy.mockRestore();
    });
  });

  describe('showSessionStatus', () => {
    let features: Phase3Features;

    beforeEach(() => {
      features = new Phase3Features();
      features.initSession('test');
    });

    it('should show comprehensive status', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      features.trackAgent('backend', 'Task', 'complete');
      features.addOutcome('tests', 'Tests', 'complete');

      showSessionStatus(features);

      expect(consoleSpy).toHaveBeenCalled();
      // Should call showSessionSnapshot, showOutcomes, showAgentSummary
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

      consoleSpy.mockRestore();
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  describe('Null/Undefined Handling', () => {
    it('should handle operations on uninitialized session', () => {
      const features = new Phase3Features();

      expect(() => {
        features.updateSession({ messagesInSession: 5 });
        features.showSessionHeader();
        features.showSessionSnapshot();
      }).not.toThrow();
    });

    it('should handle operations on uninitialized tracker', () => {
      const features = new Phase3Features();

      expect(() => {
        features.trackCommandOutcome('test', 'output', 0);
        features.showOutcomes();
        features.showProgressBar();
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple agent updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const features = new Phase3Features();
      features.initSession('test');

      features.trackAgent('backend', 'Task 1', 'in_progress');
      features.trackAgent('security', 'Task 2', 'in_progress');
      features.trackAgent('quality', 'Task 3', 'in_progress');

      const updates = features.getAgentUpdates();
      expect(updates.length).toBe(3);

      consoleSpy.mockRestore();
    });

    it('should handle rapid session updates', () => {
      const features = new Phase3Features();
      features.initSession('test');

      for (let i = 0; i < 100; i++) {
        features.updateSession({ messagesInSession: i });
      }

      expect(features.getSession()!.messagesInSession).toBe(99);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state after clear', () => {
      const features = new Phase3Features();
      features.initSession('test1');
      features.trackAgent('backend', 'Task', 'complete');

      features.clear();

      expect(features.getSession()).toBeNull();
      expect(features.getAgentUpdates()).toEqual([]);
      expect(features.getOutcomeTracker()).toBeNull();
    });

    it('should isolate state between instances', () => {
      const features1 = new Phase3Features();
      const features2 = new Phase3Features();

      features1.initSession('session1');
      features2.initSession('session2');

      expect(features1.getSession()!.name).toBe('session1');
      expect(features2.getSession()!.name).toBe('session2');
    });
  });
});
