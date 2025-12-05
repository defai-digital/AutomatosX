import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpClient } from '../../../src/providers/mcp/mcp-client.js';

class TestMcpClient extends McpClient {
  public async send(method: string, params: unknown, timeout?: number): Promise<unknown> {
    return this.sendRequest(method, params, timeout);
  }
}

describe('McpClient sendRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans up pending request when stdin.write throws', async () => {
    vi.useFakeTimers();

    const client = new TestMcpClient({
      command: 'fake',
      args: []
    });

    const writeError = new Error('stream destroyed');
    const mockStdin = {
      write: vi.fn(() => {
        throw writeError;
      })
    };

    // Inject a fake process with a failing stdin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).process = { stdin: mockStdin };

    await expect(client.send('test/method', {}, 5)).rejects.toThrow('stream destroyed');

    // Pending request should be cleared and timer should be removed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).pendingRequests.size).toBe(0);
  });
});
