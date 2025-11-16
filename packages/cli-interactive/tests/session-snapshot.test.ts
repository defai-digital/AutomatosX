/**
 * Tests for session-snapshot.ts
 * Verifies session state tracking and workspace detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSessionSnapshot,
  updateSessionSnapshot,
  renderSessionSnapshot,
  renderSessionBar,
  detectWorkspaceState,
  renderWorkspaceBanner,
  type SessionSnapshot,
  type WorkspaceState
} from '../src/session-snapshot.js';

describe('Session Snapshot', () => {
  describe('createSessionSnapshot', () => {
    it('should create a new session snapshot with defaults', () => {
      const snapshot = createSessionSnapshot('test-session', '/workspace');

      expect(snapshot.name).toBe('test-session');
      expect(snapshot.workspaceRoot).toBe('/workspace');
      expect(snapshot.messagesInSession).toBe(0);
      expect(snapshot.activeAgents).toEqual([]);
      expect(snapshot.branch).toBeDefined();
      expect(snapshot.provider).toBeDefined();
    });

    it('should accept optional provider configuration', () => {
      const snapshot = createSessionSnapshot('test', '/workspace', {
        provider: 'gemini',
        policyMode: 'cost-optimized',
        costToday: 1.50
      });

      expect(snapshot.provider).toBe('gemini');
      expect(snapshot.policyMode).toBe('cost-optimized');
      expect(snapshot.costToday).toBe(1.50);
    });

    it('should detect git branch if available', () => {
      const snapshot = createSessionSnapshot('test', '/workspace');

      // Should either have a branch name or 'no-git'
      expect(snapshot.branch).toBeTruthy();
      expect(typeof snapshot.branch).toBe('string');
    });

    it('should initialize timestamps', () => {
      const snapshot = createSessionSnapshot('test', '/workspace');

      expect(snapshot.startedAt).toBeInstanceOf(Date);
      expect(snapshot.lastActionTime).toBeInstanceOf(Date);
    });
  });

  describe('updateSessionSnapshot', () => {
    let snapshot: SessionSnapshot;

    beforeEach(() => {
      snapshot = createSessionSnapshot('test', '/workspace');
    });

    it('should update message count', () => {
      const updated = updateSessionSnapshot(snapshot, {
        messagesInSession: 5
      });

      expect(updated.messagesInSession).toBe(5);
      expect(snapshot.messagesInSession).toBe(0); // Original unchanged
    });

    it('should update active agents', () => {
      const updated = updateSessionSnapshot(snapshot, {
        activeAgents: ['backend', 'security']
      });

      expect(updated.activeAgents).toEqual(['backend', 'security']);
      expect(updated.activeAgents.length).toBe(2);
    });

    it('should update last action', () => {
      const updated = updateSessionSnapshot(snapshot, {
        lastAction: 'Ran tests',
        lastActionTime: new Date('2024-01-01')
      });

      expect(updated.lastAction).toBe('Ran tests');
      expect(updated.lastActionTime).toEqual(new Date('2024-01-01'));
    });

    it('should update cost tracking', () => {
      const updated = updateSessionSnapshot(snapshot, {
        costToday: 2.75
      });

      expect(updated.costToday).toBe(2.75);
    });

    it('should preserve unmodified fields', () => {
      const updated = updateSessionSnapshot(snapshot, {
        messagesInSession: 10
      });

      expect(updated.name).toBe(snapshot.name);
      expect(updated.workspaceRoot).toBe(snapshot.workspaceRoot);
      expect(updated.branch).toBe(snapshot.branch);
    });

    it('should be immutable', () => {
      const original = { ...snapshot };
      updateSessionSnapshot(snapshot, { messagesInSession: 99 });

      expect(snapshot.messagesInSession).toBe(original.messagesInSession);
    });
  });

  describe('renderSessionSnapshot', () => {
    let snapshot: SessionSnapshot;

    beforeEach(() => {
      snapshot = createSessionSnapshot('dev-session', '/workspace', {
        provider: 'claude',
        policyMode: 'balanced',
        costToday: 0.50
      });
      snapshot.messagesInSession = 12;
      snapshot.activeAgents = ['backend', 'quality'];
      snapshot.lastAction = 'Implemented feature';
      snapshot.branch = 'feature/new-auth';
    });

    it('should render complete session card', () => {
      const result = renderSessionSnapshot(snapshot);

      expect(result).toContain('dev-session');
      expect(result).toContain('feature/new-auth');
      expect(result).toContain('claude');
      expect(result).toContain('12'); // messages
      expect(result).toContain('backend');
      expect(result).toContain('quality');
    });

    it('should show cost information', () => {
      const result = renderSessionSnapshot(snapshot);

      expect(result).toContain('$0.50');
    });

    it('should show last action', () => {
      const result = renderSessionSnapshot(snapshot);

      expect(result).toContain('Implemented feature');
    });

    it('should handle no active agents', () => {
      snapshot.activeAgents = [];
      const result = renderSessionSnapshot(snapshot);

      expect(result).toContain('No active agents');
    });

    it('should handle multiple active agents', () => {
      snapshot.activeAgents = ['backend', 'security', 'quality', 'frontend'];
      const result = renderSessionSnapshot(snapshot);

      expect(result).toContain('backend');
      expect(result).toContain('security');
      expect(result).toContain('quality');
      expect(result).toContain('frontend');
    });

    it('should format elapsed time', () => {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      snapshot.startedAt = oneHourAgo;

      const result = renderSessionSnapshot(snapshot);

      expect(result).toMatch(/1h|hour/i);
    });
  });

  describe('renderSessionBar', () => {
    let snapshot: SessionSnapshot;

    beforeEach(() => {
      snapshot = createSessionSnapshot('test', '/workspace');
      snapshot.branch = 'main';
      snapshot.provider = 'gemini';
    });

    it('should render compact session bar', () => {
      const result = renderSessionBar(snapshot);

      expect(result).toContain('main');
      expect(result).toContain('gemini');
      expect(result).toBeTruthy();
      expect(result.split('\n').length).toBeLessThan(5); // Compact
    });

    it('should show active agents count', () => {
      snapshot.activeAgents = ['backend', 'security'];
      const result = renderSessionBar(snapshot);

      expect(result).toMatch(/2.*agent/i);
    });

    it('should show message count', () => {
      snapshot.messagesInSession = 42;
      const result = renderSessionBar(snapshot);

      expect(result).toContain('42');
    });

    it('should be single line or minimal lines', () => {
      const result = renderSessionBar(snapshot);
      const lines = result.split('\n');

      expect(lines.length).toBeLessThanOrEqual(3);
    });
  });

  describe('detectWorkspaceState', () => {
    it('should detect git repository', () => {
      const state = detectWorkspaceState(process.cwd());

      // AutomatosX itself is a git repo
      expect(state.hasGit).toBe(true);
      expect(state.currentBranch).toBeTruthy();
    });

    it('should detect package.json existence', () => {
      const state = detectWorkspaceState(process.cwd());

      expect(state.hasPackageJson).toBe(true);
    });

    it('should detect test files', () => {
      const state = detectWorkspaceState(process.cwd());

      // AutomatosX has tests
      expect(state.hasTests).toBe(true);
    });

    it('should detect build configuration', () => {
      const state = detectWorkspaceState(process.cwd());

      // AutomatosX has build config
      expect(state.hasBuild).toBe(true);
    });

    it('should detect pending changes', () => {
      const state = detectWorkspaceState(process.cwd());

      // Can't predict, but should be boolean
      expect(typeof state.hasPendingChanges).toBe('boolean');
    });

    it('should handle non-git directories', () => {
      // Use /tmp which typically isn't a git repo
      const state = detectWorkspaceState('/tmp');

      expect(state.hasGit).toBe(false);
      expect(state.currentBranch).toBeNull();
    });

    it('should detect package manager', () => {
      const state = detectWorkspaceState(process.cwd());

      // AutomatosX uses npm
      expect(['npm', 'yarn', 'pnpm']).toContain(state.packageManager);
    });
  });

  describe('renderWorkspaceBanner', () => {
    let state: WorkspaceState;

    beforeEach(() => {
      state = {
        hasGit: true,
        currentBranch: 'main',
        hasPendingChanges: false,
        hasPackageJson: true,
        packageManager: 'npm',
        hasTests: true,
        hasBuild: true,
        hasLinter: true
      };
    });

    it('should render workspace banner with all info', () => {
      const result = renderWorkspaceBanner(state, '/workspace');

      expect(result).toContain('main');
      expect(result).toContain('npm');
      expect(result).toContain('/workspace');
    });

    it('should show git status', () => {
      const result = renderWorkspaceBanner(state, '/workspace');

      expect(result).toContain('main'); // branch
      expect(result).toMatch(/clean|no changes/i);
    });

    it('should warn about pending changes', () => {
      state.hasPendingChanges = true;
      const result = renderWorkspaceBanner(state, '/workspace');

      expect(result).toMatch(/pending|uncommitted|changes/i);
    });

    it('should show available tools', () => {
      const result = renderWorkspaceBanner(state, '/workspace');

      expect(result).toMatch(/test|build|lint/i);
    });

    it('should handle non-git workspace', () => {
      state.hasGit = false;
      state.currentBranch = null;

      const result = renderWorkspaceBanner(state, '/workspace');

      expect(result).toContain('/workspace');
      expect(result).not.toContain('main');
    });

    it('should handle minimal workspace', () => {
      const minimalState: WorkspaceState = {
        hasGit: false,
        currentBranch: null,
        hasPendingChanges: false,
        hasPackageJson: false,
        packageManager: null,
        hasTests: false,
        hasBuild: false,
        hasLinter: false
      };

      const result = renderWorkspaceBanner(minimalState, '/minimal');

      expect(result).toContain('/minimal');
      expect(result).toBeTruthy();
    });

    it('should be visually distinct', () => {
      const result = renderWorkspaceBanner(state, '/workspace');

      // Should have borders or formatting
      expect(result).toMatch(/[╭╯─│┌┐]/); // Box drawing characters
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long workspace paths', () => {
      const longPath = '/very/long/path/' + 'nested/'.repeat(20) + 'workspace';
      const snapshot = createSessionSnapshot('test', longPath);

      expect(snapshot.workspaceRoot).toBe(longPath);

      const result = renderSessionSnapshot(snapshot);
      expect(result).toBeTruthy();
    });

    it('should handle special characters in session names', () => {
      const snapshot = createSessionSnapshot('test-123_session.v2', '/workspace');

      expect(snapshot.name).toBe('test-123_session.v2');

      const result = renderSessionSnapshot(snapshot);
      expect(result).toContain('test-123_session.v2');
    });

    it('should handle very high message counts', () => {
      const snapshot = createSessionSnapshot('test', '/workspace');
      const updated = updateSessionSnapshot(snapshot, {
        messagesInSession: 9999
      });

      const result = renderSessionSnapshot(updated);
      expect(result).toContain('9999');
    });

    it('should handle high cost values', () => {
      const snapshot = createSessionSnapshot('test', '/workspace', {
        costToday: 999.99
      });

      const result = renderSessionSnapshot(snapshot);
      expect(result).toContain('999.99');
    });

    it('should handle zero cost', () => {
      const snapshot = createSessionSnapshot('test', '/workspace', {
        costToday: 0
      });

      const result = renderSessionSnapshot(snapshot);
      expect(result).toMatch(/\$0\.0+|free/i);
    });

    it('should handle many active agents', () => {
      const agents = Array(20).fill(0).map((_, i) => `agent-${i}`);
      const snapshot = createSessionSnapshot('test', '/workspace');
      const updated = updateSessionSnapshot(snapshot, {
        activeAgents: agents
      });

      const result = renderSessionSnapshot(updated);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(100);
    });
  });

  describe('Formatting and Color', () => {
    let snapshot: SessionSnapshot;

    beforeEach(() => {
      snapshot = createSessionSnapshot('test', '/workspace');
    });

    it('should use colors for branches', () => {
      snapshot.branch = 'feature/xyz';
      const result = renderSessionSnapshot(snapshot);

      // Should contain ANSI color codes
      expect(result).toMatch(/\u001b\[\d+m/);
    });

    it('should highlight active agents', () => {
      snapshot.activeAgents = ['backend'];
      const result = renderSessionSnapshot(snapshot);

      expect(result).toMatch(/@backend/);
    });

    it('should format cost with currency symbol', () => {
      const snapshot = createSessionSnapshot('test', '/workspace', {
        costToday: 1.23
      });

      const result = renderSessionSnapshot(snapshot);
      expect(result).toMatch(/\$1\.23/);
    });
  });
});
