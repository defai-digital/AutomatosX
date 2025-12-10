/**
 * Comprehensive tests for McpClient (v10.6.0)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { McpClient, createMcpClient } from '../../../../src/providers/mcp/mcp-client.js';

// Create a test subclass to expose protected methods
class TestMcpClient extends McpClient {
  public async testSendRequest(method: string, params: unknown, timeout?: number): Promise<unknown> {
    return this.sendRequest(method, params, timeout);
  }

  public testSendNotification(method: string, params: unknown): void {
    return this.sendNotification(method, params);
  }

  public testHandleMessage(line: string): void {
    return this.handleMessage(line);
  }

  public testHandleProcessError(error: Error): void {
    return this.handleProcessError(error);
  }

  public testHandleProcessExit(code: number | null): void {
    return this.handleProcessExit(code);
  }

  public testRejectAllPending(reason: string): void {
    return this.rejectAllPending(reason);
  }

  public testCleanup(): void {
    return this.cleanup();
  }

  // Expose internals for testing
  public setProcess(proc: any): void {
    (this as any).process = proc;
  }

  public setReadline(rl: any): void {
    (this as any).readline = rl;
  }

  public setState(state: any): void {
    (this as any).state = state;
  }

  public getInternalState(): any {
    return (this as any).state;
  }

  public getPendingRequests(): Map<string | number, any> {
    return (this as any).pendingRequests;
  }

  public getNextRequestId(): number {
    return (this as any).nextRequestId;
  }

  public setNextRequestId(id: number): void {
    (this as any).nextRequestId = id;
  }

  public async testInitialize(): Promise<void> {
    return this.initialize();
  }

  public setServerInfo(info: any): void {
    (this as any).serverInfo = info;
  }
}

describe('McpClient', () => {
  let client: TestMcpClient;

  beforeEach(() => {
    client = new TestMcpClient({
      command: 'test-command',
      args: ['arg1', 'arg2']
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required config', () => {
      const c = new McpClient({
        command: 'test',
        args: []
      });

      expect(c.getState().status).toBe('disconnected');
      expect(c.getState().errorCount).toBe(0);
    });

    it('should apply default timeout', () => {
      const c = new TestMcpClient({
        command: 'test',
        args: []
      });

      // Default timeout is 30000
      expect((c as any).config.timeout).toBe(30000);
    });

    it('should apply custom timeout', () => {
      const c = new TestMcpClient({
        command: 'test',
        args: [],
        timeout: 60000
      });

      expect((c as any).config.timeout).toBe(60000);
    });

    it('should apply default healthCheckInterval', () => {
      const c = new TestMcpClient({
        command: 'test',
        args: []
      });

      expect((c as any).config.healthCheckInterval).toBe(30000);
    });

    it('should apply custom env', () => {
      const c = new TestMcpClient({
        command: 'test',
        args: [],
        env: { MY_VAR: 'value' }
      });

      expect((c as any).config.env).toEqual({ MY_VAR: 'value' });
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const state = client.getState();
      expect(state.status).toBe('disconnected');
      expect(state.errorCount).toBe(0);
      expect(state.lastUsed).toBe(0);
    });
  });

  describe('isConnected', () => {
    it('should return false when disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return false when status is connected but no process', () => {
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when status is connected and process exists', () => {
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.setProcess({ stdin: {} });
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('getServerInfo', () => {
    it('should return null when not initialized', () => {
      expect(client.getServerInfo()).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should do nothing if already disconnected', async () => {
      await client.disconnect();
      expect(client.getState().status).toBe('disconnected');
    });

    it('should clean up resources when connected', async () => {
      const mockProcess = {
        kill: vi.fn(),
        stdin: { write: vi.fn() }
      };
      const mockReadline = {
        close: vi.fn()
      };

      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.setProcess(mockProcess);
      client.setReadline(mockReadline);

      await client.disconnect();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mockReadline.close).toHaveBeenCalled();
      expect(client.getState().status).toBe('disconnected');
    });

    it('should emit disconnected event', async () => {
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.setProcess({ kill: vi.fn() });

      await client.disconnect();

      expect(disconnectedHandler).toHaveBeenCalled();
    });
  });

  describe('callTool', () => {
    it('should throw if not connected', async () => {
      await expect(client.callTool('test-tool', {})).rejects.toThrow(
        'MCP client not connected (status: disconnected)'
      );
    });

    it('should throw if in error state', async () => {
      client.setState({ status: 'error', errorCount: 1, lastUsed: 0 });

      await expect(client.callTool('test-tool', {})).rejects.toThrow(
        'MCP client not connected (status: error)'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return false if not connected', async () => {
      expect(await client.healthCheck()).toBe(false);
    });

    it('should return false if no process', async () => {
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      expect(await client.healthCheck()).toBe(false);
    });

    it('should return true when sendRequest succeeds', async () => {
      const mockStdin = {
        write: vi.fn()
      };
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.setProcess({ stdin: mockStdin });

      // Start health check, then simulate successful response
      const healthPromise = client.healthCheck();

      // Simulate response for the tools/list request (id will be the current nextRequestId - 1)
      const requestId = client.getNextRequestId() - 1;
      client.testHandleMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        result: { tools: [] }
      }));

      const result = await healthPromise;
      expect(result).toBe(true);
    });

    it('should return false when sendRequest fails', async () => {
      const mockStdin = {
        write: vi.fn(() => {
          throw new Error('Write failed');
        })
      };
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.setProcess({ stdin: mockStdin });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('sendRequest', () => {
    it('should throw if no process stdin', async () => {
      await expect(client.testSendRequest('test', {})).rejects.toThrow(
        'MCP client not connected'
      );
    });

    it('should increment request id', async () => {
      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      const initialId = client.getNextRequestId();

      // Start request but don't wait for response
      const promise = client.testSendRequest('test', {}, 100);

      expect(client.getNextRequestId()).toBe(initialId + 1);

      // Clean up - reject the pending request
      await expect(promise).rejects.toThrow('timed out');
    });

    it('should wrap around request id at MAX_REQUEST_ID', async () => {
      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      // Set to max
      client.setNextRequestId(1_000_000_000);

      const promise = client.testSendRequest('test', {}, 100);

      // Should wrap to 1
      expect(client.getNextRequestId()).toBe(1);

      await expect(promise).rejects.toThrow('timed out');
    });

    it('should timeout after configured duration', async () => {
      vi.useFakeTimers();

      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      const promise = client.testSendRequest('test', {}, 5000);

      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow('Request timed out after 5000ms: test');

      vi.useRealTimers();
    });

    it('should clean up pending request on write error', async () => {
      const mockStdin = {
        write: vi.fn(() => {
          throw new Error('Write failed');
        })
      };
      client.setProcess({ stdin: mockStdin });

      await expect(client.testSendRequest('test', {})).rejects.toThrow('Write failed');
      expect(client.getPendingRequests().size).toBe(0);
    });
  });

  describe('sendNotification', () => {
    it('should do nothing if no process', () => {
      // Should not throw
      client.testSendNotification('test', {});
    });

    it('should do nothing if no stdin', () => {
      client.setProcess({});
      // Should not throw
      client.testSendNotification('test', {});
    });

    it('should write notification to stdin', () => {
      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      client.testSendNotification('test/method', { key: 'value' });

      expect(mockStdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"test/method"')
      );
    });

    it('should handle write errors gracefully', () => {
      const mockStdin = {
        write: vi.fn(() => {
          throw new Error('Pipe broken');
        })
      };
      client.setProcess({ stdin: mockStdin });

      // Should not throw
      client.testSendNotification('test', {});
    });
  });

  describe('initialize', () => {
    it('should send initialize request and store server info', async () => {
      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      // Start initialize
      const initPromise = client.testInitialize();

      // Verify request was sent
      expect(mockStdin.write).toHaveBeenCalled();
      const writtenMessage = JSON.parse(mockStdin.write.mock.calls[0]![0]);
      expect(writtenMessage.method).toBe('initialize');
      expect(writtenMessage.params.protocolVersion).toBe('2025-11-25');
      expect(writtenMessage.params.clientInfo.name).toBe('automatosx');

      // Simulate response
      client.testHandleMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: writtenMessage.id,
        result: {
          serverInfo: {
            name: 'test-server',
            version: '1.0.0'
          },
          capabilities: {}
        }
      }));

      await initPromise;

      // Verify server info was stored
      expect(client.getServerInfo()).toEqual({
        name: 'test-server',
        version: '1.0.0'
      });

      // Verify initialized notification was sent (should be the second write call)
      expect(mockStdin.write).toHaveBeenCalledTimes(2);
      const notificationMessage = JSON.parse(mockStdin.write.mock.calls[1]![0]);
      expect(notificationMessage.method).toBe('notifications/initialized');
    });
  });

  describe('handleMessage', () => {
    it('should ignore empty lines', () => {
      // Should not throw
      client.testHandleMessage('');
      client.testHandleMessage('   ');
    });

    it('should handle invalid JSON gracefully', () => {
      // Should not throw
      client.testHandleMessage('not json');
      client.testHandleMessage('{incomplete');
    });

    it('should emit notification for messages without id', () => {
      const notificationHandler = vi.fn();
      client.on('notification', notificationHandler);

      client.testHandleMessage('{"jsonrpc":"2.0","method":"test/notification","params":{}}');

      expect(notificationHandler).toHaveBeenCalled();
    });

    it('should ignore messages with undefined id', () => {
      // Should not throw
      client.testHandleMessage('{"jsonrpc":"2.0","result":{}}');
    });

    it('should ignore messages with null id', () => {
      // Should not throw
      client.testHandleMessage('{"jsonrpc":"2.0","id":null,"result":{}}');
    });

    it('should resolve pending request on success response', async () => {
      vi.useFakeTimers();

      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      const promise = client.testSendRequest('test', {});

      // Get the request ID from the write call
      const writtenMessage = JSON.parse(mockStdin.write.mock.calls[0]![0]);
      const requestId = writtenMessage.id;

      // Simulate response
      client.testHandleMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        result: { success: true }
      }));

      const result = await promise;
      expect(result).toEqual({ success: true });

      vi.useRealTimers();
    });

    it('should reject pending request on error response', async () => {
      vi.useFakeTimers();

      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      const promise = client.testSendRequest('test', {});

      const writtenMessage = JSON.parse(mockStdin.write.mock.calls[0]![0]);
      const requestId = writtenMessage.id;

      // Simulate error response
      client.testHandleMessage(JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        error: { code: -32600, message: 'Invalid request' }
      }));

      await expect(promise).rejects.toThrow('MCP error -32600: Invalid request');

      vi.useRealTimers();
    });

    it('should ignore responses for unknown request ids', () => {
      // Should not throw
      client.testHandleMessage('{"jsonrpc":"2.0","id":999,"result":{}}');
    });
  });

  describe('handleProcessError', () => {
    it('should update state to error', () => {
      // Add error handler to prevent unhandled error
      client.on('error', () => {});

      client.testHandleProcessError(new Error('Process crashed'));

      expect(client.getInternalState().status).toBe('error');
      expect(client.getInternalState().errorCount).toBe(1);
      expect(client.getInternalState().lastError).toBe('Process crashed');
    });

    it('should emit error event', () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const error = new Error('Process crashed');
      client.testHandleProcessError(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should reject all pending requests', async () => {
      // Add error handler to prevent unhandled error
      client.on('error', () => {});

      const mockStdin = {
        write: vi.fn()
      };
      const mockProcess = {
        stdin: mockStdin,
        kill: vi.fn()
      };
      client.setProcess(mockProcess);

      // Use real timers and catch the rejection immediately
      const promise = client.testSendRequest('test', {}, 10000).catch(err => {
        expect(err.message).toBe('Process error: Process crashed');
        return 'rejected';
      });

      client.testHandleProcessError(new Error('Process crashed'));

      const result = await promise;
      expect(result).toBe('rejected');
    });
  });

  describe('handleProcessExit', () => {
    it('should update state to disconnected', () => {
      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.testHandleProcessExit(0);

      expect(client.getInternalState().status).toBe('disconnected');
    });

    it('should emit disconnected when was connected', () => {
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      client.setState({ status: 'connected', errorCount: 0, lastUsed: Date.now() });
      client.testHandleProcessExit(0);

      expect(disconnectedHandler).toHaveBeenCalled();
    });

    it('should emit error when was connecting', () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      client.setState({ status: 'connecting', errorCount: 0, lastUsed: Date.now() });
      client.testHandleProcessExit(1);

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should reject all pending requests', async () => {
      // Add error handler to prevent unhandled error (handleProcessExit can emit 'error')
      client.on('error', () => {});

      const mockStdin = {
        write: vi.fn()
      };
      const mockProcess = {
        stdin: mockStdin,
        kill: vi.fn()
      };
      client.setProcess(mockProcess);

      // Use real timers and catch the rejection immediately
      const promise = client.testSendRequest('test', {}, 10000).catch(err => {
        expect(err.message).toBe('Process exited unexpectedly with code 1');
        return 'rejected';
      });

      client.testHandleProcessExit(1);

      const result = await promise;
      expect(result).toBe('rejected');
    });
  });

  describe('rejectAllPending', () => {
    it('should clear all pending requests', async () => {
      vi.useFakeTimers();

      const mockStdin = {
        write: vi.fn()
      };
      client.setProcess({ stdin: mockStdin });

      const promise1 = client.testSendRequest('test1', {});
      const promise2 = client.testSendRequest('test2', {});

      expect(client.getPendingRequests().size).toBe(2);

      client.testRejectAllPending('Test rejection');

      expect(client.getPendingRequests().size).toBe(0);

      await expect(promise1).rejects.toThrow('Test rejection');
      await expect(promise2).rejects.toThrow('Test rejection');

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should close readline', () => {
      const mockReadline = {
        close: vi.fn()
      };
      client.setReadline(mockReadline);

      client.testCleanup();

      expect(mockReadline.close).toHaveBeenCalled();
    });

    it('should kill process', () => {
      const mockProcess = {
        kill: vi.fn()
      };
      client.setProcess(mockProcess);

      client.testCleanup();

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should handle missing readline and process', () => {
      // Should not throw
      client.testCleanup();
    });
  });

  describe('destroy', () => {
    it('should remove all event listeners', () => {
      client.on('connected', vi.fn());
      client.on('error', vi.fn());

      expect(client.listenerCount('connected')).toBe(1);
      expect(client.listenerCount('error')).toBe(1);

      client.destroy();

      expect(client.listenerCount('connected')).toBe(0);
      expect(client.listenerCount('error')).toBe(0);
    });
  });
});

describe('createMcpClient factory', () => {
  it('should create client for claude provider', () => {
    const client = createMcpClient('claude');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should create client for claude-code alias', () => {
    const client = createMcpClient('claude-code');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should create client for gemini provider', () => {
    const client = createMcpClient('gemini');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should create client for gemini-cli alias', () => {
    const client = createMcpClient('gemini-cli');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should create client for codex provider', () => {
    const client = createMcpClient('codex');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should create client for openai alias', () => {
    const client = createMcpClient('openai');
    expect(client).toBeInstanceOf(McpClient);
  });

  it('should throw for unknown provider', () => {
    expect(() => createMcpClient('unknown-provider')).toThrow(
      'Unknown provider for MCP client: unknown-provider'
    );
  });
});
