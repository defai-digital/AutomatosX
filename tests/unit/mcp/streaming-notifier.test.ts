/**
 * MCP Streaming Notifier Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  McpStreamingNotifier,
  getGlobalStreamingNotifier,
  resetGlobalStreamingNotifier,
  sendMcpProgress,
  sendMcpProgressBegin,
  sendMcpProgressEnd
} from '../../../src/mcp/streaming-notifier.js';

// Mock event bridge
vi.mock('../../../src/core/events/event-bridge.js', () => ({
  getGlobalEventBridge: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn()
  }),
  EventBridge: vi.fn()
}));

describe('MCP Streaming Notifier', () => {
  let originalStdoutWrite: typeof process.stdout.write;
  let writtenData: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    writtenData = [];

    // Capture stdout writes
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = vi.fn((data: string | Uint8Array) => {
      if (typeof data === 'string') {
        writtenData.push(data);
      }
      return true;
    });

    // Reset global notifier
    resetGlobalStreamingNotifier();
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    resetGlobalStreamingNotifier();
  });

  describe('McpStreamingNotifier', () => {
    it('should initialize with default options', () => {
      const notifier = new McpStreamingNotifier();
      expect(notifier).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const notifier = new McpStreamingNotifier({
        enabled: true,
        throttleMs: 200,
        debug: true
      });
      expect(notifier).toBeDefined();
    });

    it('should start and subscribe to event bridge', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      const mockEventBridge = {
        subscribe: vi.fn().mockReturnValue(() => {}),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier();
      notifier.start();

      expect(mockEventBridge.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
    });

    it('should not start if disabled', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      const mockEventBridge = {
        subscribe: vi.fn().mockReturnValue(() => {}),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: false });
      notifier.start();

      expect(mockEventBridge.subscribe).not.toHaveBeenCalled();
    });

    it('should not start twice', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      const mockEventBridge = {
        subscribe: vi.fn().mockReturnValue(() => {}),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier();
      notifier.start();
      notifier.start();

      expect(mockEventBridge.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should stop and unsubscribe', async () => {
      const unsubscribe = vi.fn();
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      const mockEventBridge = {
        subscribe: vi.fn().mockReturnValue(unsubscribe),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier();
      notifier.start();
      notifier.stop();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should not stop if not started', () => {
      const notifier = new McpStreamingNotifier();
      // Should not throw
      notifier.stop();
    });

    it('should send activity message', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.sendActivityMessage('Test message');

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('notifications/progress');
      expect(notification.params.value.message).toBe('Test message');
    });

    it('should not send activity message if disabled', () => {
      const notifier = new McpStreamingNotifier({ enabled: false });
      notifier.sendActivityMessage('Test message');

      expect(writtenData).toHaveLength(0);
    });

    it('should send activity begin notification', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      const token = notifier.sendActivityBegin('Test Title', 'Test Message');

      expect(token).toBeTruthy();
      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.kind).toBe('begin');
      expect(notification.params.value.title).toBe('Test Title');
      expect(notification.params.value.message).toBe('Test Message');
    });

    it('should return empty token if disabled', () => {
      const notifier = new McpStreamingNotifier({ enabled: false });
      const token = notifier.sendActivityBegin('Test Title');

      expect(token).toBe('');
    });

    it('should send activity end notification', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.sendActivityEnd('test-token', 'Completed');

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.kind).toBe('end');
      expect(notification.params.value.message).toBe('Completed');
    });

    it('should not send activity end if disabled', () => {
      const notifier = new McpStreamingNotifier({ enabled: false });
      notifier.sendActivityEnd('test-token', 'Completed');

      expect(writtenData).toHaveLength(0);
    });
  });

  describe('Global Notifier Functions', () => {
    it('should get or create global notifier', () => {
      const notifier1 = getGlobalStreamingNotifier();
      const notifier2 = getGlobalStreamingNotifier();

      expect(notifier1).toBe(notifier2);
    });

    it('should reset global notifier', () => {
      const notifier1 = getGlobalStreamingNotifier();
      resetGlobalStreamingNotifier();
      const notifier2 = getGlobalStreamingNotifier();

      expect(notifier1).not.toBe(notifier2);
    });

    it('should send progress via global notifier', () => {
      // Initialize global notifier
      getGlobalStreamingNotifier({ enabled: true });

      sendMcpProgress('Progress message');

      expect(writtenData.length).toBeGreaterThan(0);
    });

    it('should not throw when no global notifier', () => {
      resetGlobalStreamingNotifier();

      // These should not throw even without global notifier
      sendMcpProgress('Message');
      sendMcpProgressBegin('Title');
      sendMcpProgressEnd('token');
    });

    it('should send progress begin via global notifier', () => {
      getGlobalStreamingNotifier({ enabled: true });

      const token = sendMcpProgressBegin('Task', 'Starting...');

      expect(token).toBeTruthy();
      expect(writtenData.length).toBeGreaterThan(0);
    });

    it('should send progress end via global notifier', () => {
      getGlobalStreamingNotifier({ enabled: true });

      sendMcpProgressEnd('test-token', 'Done');

      expect(writtenData.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    it('should handle execution.started event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'execution.started',
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: { agent: 'backend', task: 'Test task' }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.kind).toBe('begin');
      expect(notification.params.value.title).toContain('backend');
    });

    it('should handle execution.completed event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'execution.completed',
        timestamp: new Date().toISOString(),
        source: 'test',
        correlationId: 'corr-1',
        payload: { agent: 'backend', latencyMs: 1500, tokens: { total: 500 } }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.kind).toBe('end');
      expect(notification.params.value.message).toContain('1500ms');
    });

    it('should handle execution.error event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'execution.error',
        timestamp: new Date().toISOString(),
        source: 'test',
        correlationId: 'corr-1',
        payload: { error: 'Test error' }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.kind).toBe('end');
      expect(notification.params.value.message).toContain('Test error');
    });

    it('should handle tool.called event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'tool.called',
        timestamp: new Date().toISOString(),
        source: 'test',
        correlationId: 'corr-1',
        payload: { tool: 'run_agent' }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.message).toContain('run_agent');
    });

    it('should handle agent.selected event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'agent.selected',
        timestamp: new Date().toISOString(),
        source: 'test',
        correlationId: 'corr-1',
        payload: { agent: 'backend' }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.message).toContain('backend');
    });

    it('should handle agent.delegated event', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.start();

      // Simulate event
      eventHandler({
        id: 'event-1',
        type: 'agent.delegated',
        timestamp: new Date().toISOString(),
        source: 'test',
        correlationId: 'corr-1',
        payload: { fromAgent: 'backend', toAgent: 'security', task: 'Review authentication' }
      });

      expect(writtenData.length).toBeGreaterThan(0);
      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.value.message).toContain('security');
    });

    it('should ignore non-subscribed event types', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({
        enabled: true,
        eventTypes: ['execution.started']
      });
      notifier.start();

      // Simulate non-subscribed event
      eventHandler({
        id: 'event-1',
        type: 'some.other.event' as any,
        timestamp: new Date().toISOString(),
        source: 'test',
        payload: {}
      });

      expect(writtenData).toHaveLength(0);
    });

    it('should throttle high-frequency events', async () => {
      const { getGlobalEventBridge } = await import('../../../src/core/events/event-bridge.js');
      let eventHandler: (event: any) => void = () => {};
      const mockEventBridge = {
        subscribe: vi.fn().mockImplementation((type, handler) => {
          eventHandler = handler;
          return () => {};
        }),
        emit: vi.fn()
      };
      vi.mocked(getGlobalEventBridge).mockReturnValue(mockEventBridge as any);

      const notifier = new McpStreamingNotifier({
        enabled: true,
        throttleMs: 1000
      });
      notifier.start();

      // Simulate multiple rapid events
      for (let i = 0; i < 10; i++) {
        eventHandler({
          id: `event-${i}`,
          type: 'execution.progress',
          timestamp: new Date().toISOString(),
          source: 'test',
          correlationId: 'corr-1',
          payload: { progress: i * 10 }
        });
      }

      // Should have throttled most events
      expect(writtenData.length).toBeLessThan(10);
    });
  });

  describe('Notification Format', () => {
    it('should use newline-delimited framing', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.sendActivityMessage('Test');

      expect(writtenData[0]).toMatch(/\n$/);
    });

    it('should send valid JSON-RPC 2.0 notifications', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.sendActivityMessage('Test');

      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBeDefined();
      expect(notification.params).toBeDefined();
      expect(notification.id).toBeUndefined(); // Notifications don't have ID
    });

    it('should include progress token in notifications', () => {
      const notifier = new McpStreamingNotifier({ enabled: true });
      notifier.sendActivityMessage('Test', 'custom-token');

      const notification = JSON.parse(writtenData[0]?.replace('\n', '') || '{}');
      expect(notification.params.progressToken).toBe('custom-token');
    });
  });
});
