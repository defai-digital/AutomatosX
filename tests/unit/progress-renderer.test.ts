/**
 * ProgressRenderer Unit Tests
 *
 * Tests the terminal rendering for progress events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressRenderer } from '../../src/cli/renderers/progress-renderer.js';
import type { ProgressEvent } from '../../src/core/progress-channel.js';

// Mock ora
vi.mock('ora', () => {
  return {
    default: vi.fn((options) => {
      const spinner = {
        text: options?.text || '',
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        info: vi.fn().mockReturnThis(),
      };
      return spinner;
    }),
  };
});

import ora from 'ora';

describe('ProgressRenderer', () => {
  let renderer: ProgressRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (renderer) {
      renderer.stop();
    }
  });

  describe('Basic initialization', () => {
    it('should create renderer with default options', () => {
      renderer = new ProgressRenderer();
      expect(renderer).toBeDefined();
    });

    it('should create renderer in quiet mode', () => {
      renderer = new ProgressRenderer({ quiet: true });
      expect(renderer).toBeDefined();
    });

    it('should start without errors', () => {
      renderer = new ProgressRenderer();
      expect(() => renderer.start()).not.toThrow();
    });

    it('should stop without errors', () => {
      renderer = new ProgressRenderer();
      renderer.start();
      expect(() => renderer.stop()).not.toThrow();
    });
  });

  describe('Stage start events', () => {
    it('should handle stage-start event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      renderer.handleEvent(event);

      // Should create a spinner
      expect(ora).toHaveBeenCalledWith(
        expect.objectContaining({
          spinner: 'dots'
        })
      );
    });

    it('should stop previous spinner on new stage', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start first stage
      const event1: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(event1);

      const firstSpinner = (ora as any).mock.results[0]?.value;

      // Start second stage
      const event2: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 1,
        stageName: 'Implementation'
      };
      renderer.handleEvent(event2);

      // First spinner should be stopped
      expect(firstSpinner?.stop).toHaveBeenCalled();

      // New spinner should be created
      expect(ora).toHaveBeenCalledTimes(2);
    });

    it('should handle unknown stage name', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        // stageName omitted
      };

      expect(() => renderer.handleEvent(event)).not.toThrow();
    });
  });

  describe('Stage progress events', () => {
    it('should handle stage-progress event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage first
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Progress event
      const progressEvent: ProgressEvent = {
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 50
      };
      renderer.handleEvent(progressEvent);

      // Spinner text should be updated
      expect(spinner?.text).toContain('50%');
      expect(spinner?.text).toContain('Planning');
    });

    it('should render progress bar correctly', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // 0% progress
      renderer.handleEvent({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 0
      });
      expect(spinner?.text).toContain('[░░░░░░░░░░░░░░░░░░░░]'); // All empty

      // 50% progress
      renderer.handleEvent({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 50
      });
      expect(spinner?.text).toContain('[██████████░░░░░░░░░░]'); // Half filled

      // 100% progress
      renderer.handleEvent({
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 100
      });
      expect(spinner?.text).toContain('[████████████████████]'); // Fully filled
    });

    it('should handle progress event without active spinner', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // No stage-start event, so no active spinner
      const progressEvent: ProgressEvent = {
        type: 'stage-progress',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        progress: 50
      };

      // Should not throw
      expect(() => renderer.handleEvent(progressEvent)).not.toThrow();
    });
  });

  describe('Stage complete events', () => {
    it('should handle stage-complete event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Complete stage
      const completeEvent: ProgressEvent = {
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(completeEvent);

      // Spinner should succeed
      expect(spinner?.succeed).toHaveBeenCalled();
      expect(spinner?.succeed).toHaveBeenCalledWith(
        expect.stringContaining('✓')
      );
      expect(spinner?.succeed).toHaveBeenCalledWith(
        expect.stringContaining('Planning')
      );
    });

    it('should handle complete event without active spinner', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const completeEvent: ProgressEvent = {
        type: 'stage-complete',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      // Should not throw
      expect(() => renderer.handleEvent(completeEvent)).not.toThrow();
    });
  });

  describe('Stage error events', () => {
    it('should handle stage-error event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Error event
      const errorEvent: ProgressEvent = {
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        message: 'Network timeout'
      };
      renderer.handleEvent(errorEvent);

      // Spinner should fail
      expect(spinner?.fail).toHaveBeenCalled();
      expect(spinner?.fail).toHaveBeenCalledWith(
        expect.stringContaining('✗')
      );
      expect(spinner?.fail).toHaveBeenCalledWith(
        expect.stringContaining('Planning')
      );
      expect(spinner?.fail).toHaveBeenCalledWith(
        expect.stringContaining('Network timeout')
      );
    });

    it('should handle error event without message', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Error event without message
      const errorEvent: ProgressEvent = {
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(errorEvent);

      // Should show "Unknown error"
      expect(spinner?.fail).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error')
      );
    });

    it('should handle error event without active spinner', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const errorEvent: ProgressEvent = {
        type: 'stage-error',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        message: 'Error occurred'
      };

      // Should not throw
      expect(() => renderer.handleEvent(errorEvent)).not.toThrow();
    });
  });

  describe('Token stream events', () => {
    it('should handle token-stream event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const tokenEvent: ProgressEvent = {
        type: 'token-stream',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning',
        token: 'Hello'
      };

      // Should not throw (currently no-op)
      expect(() => renderer.handleEvent(tokenEvent)).not.toThrow();
    });

    it('should handle token-stream without token', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const tokenEvent: ProgressEvent = {
        type: 'token-stream',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      // Should not throw
      expect(() => renderer.handleEvent(tokenEvent)).not.toThrow();
    });
  });

  describe('Checkpoint events', () => {
    it('should handle checkpoint event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Checkpoint event
      const checkpointEvent: ProgressEvent = {
        type: 'checkpoint',
        timestamp: new Date(),
        message: 'Checkpoint saved'
      };
      renderer.handleEvent(checkpointEvent);

      // Spinner should show info
      expect(spinner?.info).toHaveBeenCalled();
      expect(spinner?.info).toHaveBeenCalledWith(
        expect.stringContaining('⏸')
      );
      expect(spinner?.info).toHaveBeenCalledWith(
        expect.stringContaining('Checkpoint saved')
      );
    });

    it('should handle checkpoint event without message', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Checkpoint event without message
      const checkpointEvent: ProgressEvent = {
        type: 'checkpoint',
        timestamp: new Date()
      };
      renderer.handleEvent(checkpointEvent);

      // Should show default message
      expect(spinner?.info).toHaveBeenCalledWith(
        expect.stringContaining('Waiting for user input')
      );
    });
  });

  describe('User prompt events', () => {
    it('should handle user-prompt event', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // User prompt event
      const promptEvent: ProgressEvent = {
        type: 'user-prompt',
        timestamp: new Date(),
        message: 'Continue?'
      };
      renderer.handleEvent(promptEvent);

      // Spinner should be stopped
      expect(spinner?.stop).toHaveBeenCalled();
    });

    it('should handle user-prompt without active spinner', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      const promptEvent: ProgressEvent = {
        type: 'user-prompt',
        timestamp: new Date(),
        message: 'Continue?'
      };

      // Should not throw
      expect(() => renderer.handleEvent(promptEvent)).not.toThrow();
    });
  });

  describe('Quiet mode', () => {
    it('should not render events in quiet mode', () => {
      renderer = new ProgressRenderer({ quiet: true });
      renderer.start();

      const event: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };

      renderer.handleEvent(event);

      // Should not create spinner
      expect(ora).not.toHaveBeenCalled();
    });

    it('should handle all event types in quiet mode', () => {
      renderer = new ProgressRenderer({ quiet: true });
      renderer.start();

      const events: ProgressEvent[] = [
        { type: 'stage-start', timestamp: new Date(), stageIndex: 0, stageName: 'Planning' },
        { type: 'stage-progress', timestamp: new Date(), stageIndex: 0, stageName: 'Planning', progress: 50 },
        { type: 'stage-complete', timestamp: new Date(), stageIndex: 0, stageName: 'Planning' },
        { type: 'stage-error', timestamp: new Date(), stageIndex: 0, stageName: 'Planning', message: 'Error' },
        { type: 'token-stream', timestamp: new Date(), stageIndex: 0, stageName: 'Planning', token: 'test' },
        { type: 'checkpoint', timestamp: new Date(), message: 'Checkpoint' },
        { type: 'user-prompt', timestamp: new Date(), message: 'Continue?' },
      ];

      events.forEach(event => {
        expect(() => renderer.handleEvent(event)).not.toThrow();
      });

      // No spinners should be created
      expect(ora).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should stop active spinner on renderer stop', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      const spinner = (ora as any).mock.results[0]?.value;

      // Stop renderer
      renderer.stop();

      // Spinner should be stopped
      expect(spinner?.stop).toHaveBeenCalled();
    });

    it('should handle stop without active spinner', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Stop without starting any stage
      expect(() => renderer.stop()).not.toThrow();
    });

    it('should allow multiple stop calls', () => {
      renderer = new ProgressRenderer();
      renderer.start();

      // Start stage
      const startEvent: ProgressEvent = {
        type: 'stage-start',
        timestamp: new Date(),
        stageIndex: 0,
        stageName: 'Planning'
      };
      renderer.handleEvent(startEvent);

      // Stop multiple times
      expect(() => {
        renderer.stop();
        renderer.stop();
        renderer.stop();
      }).not.toThrow();
    });
  });
});
