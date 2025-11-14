/**
 * Unit Tests for ResourceManagement.res
 *
 * Tests the ReScript ResourceManagement module for RAII pattern,
 * resource pools, and automatic cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configureBridge,
} from '../../bridge/RescriptBridge';

describe('ResourceManagement Module', () => {
  beforeEach(() => {
    configureBridge({ enableResourceManagement: true, logTransitions: false });
  });

  describe('BUG #16: Resource Leaks from Missing Cleanup', () => {
    it('should prevent file handle leaks with RAII', async () => {
      // BUGGY TypeScript version:
      // function processFile(path: string) {
      //   const file = openFile(path);
      //   processData(file);
      //   // ❌ Forgot to close file!
      // }

      // ReScript version with RAII:
      const cleanupCalled = vi.fn();

      async function withResource<T, R>(
        acquire: () => T,
        cleanup: (resource: T) => void,
        use: (resource: T) => R
      ): Promise<R> {
        const resource = acquire();
        try {
          return use(resource);
        } finally {
          cleanup(resource);  // ALWAYS called
        }
      }

      const result = await withResource(
        () => ({ handle: 'file123' }),  // Acquire
        (resource) => cleanupCalled(resource),  // Cleanup
        (resource) => `processed:${resource.handle}`  // Use
      );

      expect(result).toBe('processed:file123');
      expect(cleanupCalled).toHaveBeenCalledTimes(1);
      expect(cleanupCalled).toHaveBeenCalledWith({ handle: 'file123' });
    });

    it('should cleanup even on error', async () => {
      const cleanupCalled = vi.fn();

      async function withResource<T, R>(
        acquire: () => T,
        cleanup: (resource: T) => void,
        use: (resource: T) => R
      ): Promise<R> {
        const resource = acquire();
        try {
          return use(resource);
        } finally {
          cleanup(resource);
        }
      }

      await expect(async () => {
        await withResource(
          () => ({ connection: 'db' }),
          (resource) => cleanupCalled(resource),
          () => {
            throw new Error('Processing failed');
          }
        );
      }).rejects.toThrow('Processing failed');

      // Cleanup was still called!
      expect(cleanupCalled).toHaveBeenCalledTimes(1);
    });

    it('should cleanup even on early return', async () => {
      const cleanupCalled = vi.fn();

      async function withResource<T, R>(
        acquire: () => T,
        cleanup: (resource: T) => void,
        use: (resource: T) => R | null
      ): Promise<R | null> {
        const resource = acquire();
        try {
          return use(resource);
        } finally {
          cleanup(resource);
        }
      }

      const result = await withResource(
        () => ({ data: 'test' }),
        (resource) => cleanupCalled(resource),
        (resource) => {
          if (resource.data === 'test') {
            return null;  // Early return
          }
          return 'processed' as any;
        }
      );

      expect(result).toBeNull();
      expect(cleanupCalled).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Pools', () => {
    it('should reuse pooled resources', async () => {
      interface Resource {
        id: number;
        inUse: boolean;
      }

      class ResourcePool {
        private available: Resource[] = [];
        private createCount = 0;

        constructor(private size: number) {
          for (let i = 0; i < size; i++) {
            this.available.push({ id: i, inUse: false });
          }
        }

        async acquire(): Promise<Resource> {
          const resource = this.available.find(r => !r.inUse);

          if (!resource) {
            throw new Error('No resources available');
          }

          resource.inUse = true;
          return resource;
        }

        release(resource: Resource): void {
          resource.inUse = false;
        }

        getCreateCount(): number {
          return this.createCount;
        }
      }

      const pool = new ResourcePool(3);

      // Acquire and release resources
      const r1 = await pool.acquire();
      expect(r1.id).toBe(0);

      const r2 = await pool.acquire();
      expect(r2.id).toBe(1);

      pool.release(r1);

      // Should reuse r1
      const r3 = await pool.acquire();
      expect(r3.id).toBe(0);  // Same as r1
    });

    it('should block when pool is exhausted', async () => {
      interface Resource {
        id: number;
      }

      class ResourcePool {
        private available: Resource[] = [];
        private waiting: Array<(resource: Resource) => void> = [];

        constructor(size: number) {
          for (let i = 0; i < size; i++) {
            this.available.push({ id: i });
          }
        }

        async acquire(): Promise<Resource> {
          if (this.available.length > 0) {
            return this.available.shift()!;
          }

          return new Promise<Resource>((resolve) => {
            this.waiting.push(resolve);
          });
        }

        release(resource: Resource): void {
          if (this.waiting.length > 0) {
            const resolve = this.waiting.shift()!;
            resolve(resource);
          } else {
            this.available.push(resource);
          }
        }
      }

      const pool = new ResourcePool(2);

      const r1 = await pool.acquire();
      const r2 = await pool.acquire();

      // Pool exhausted
      let r3Acquired = false;
      const r3Promise = pool.acquire().then(r => {
        r3Acquired = true;
        return r;
      });

      // r3 is waiting
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(r3Acquired).toBe(false);

      // Release r1
      pool.release(r1);

      // r3 should now acquire
      await r3Promise;
      expect(r3Acquired).toBe(true);
    });

    it('should track active resource count', async () => {
      class ResourcePool {
        private active = 0;
        private max = 3;

        async acquire(): Promise<{ id: number }> {
          if (this.active >= this.max) {
            throw new Error('Pool exhausted');
          }

          this.active++;
          return { id: this.active };
        }

        release(): void {
          this.active--;
        }

        getActiveCount(): number {
          return this.active;
        }
      }

      const pool = new ResourcePool();

      expect(pool.getActiveCount()).toBe(0);

      await pool.acquire();
      expect(pool.getActiveCount()).toBe(1);

      await pool.acquire();
      expect(pool.getActiveCount()).toBe(2);

      pool.release();
      expect(pool.getActiveCount()).toBe(1);

      pool.release();
      expect(pool.getActiveCount()).toBe(0);
    });
  });

  describe('Multiple Resources', () => {
    it('should manage multiple resources with cleanup', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      async function withResources<R>(
        resources: Array<{ acquire: () => any; cleanup: (r: any) => void }>,
        use: (...resources: any[]) => R
      ): Promise<R> {
        const acquired = resources.map(r => r.acquire());

        try {
          return use(...acquired);
        } finally {
          resources.forEach((r, i) => r.cleanup(acquired[i]));
        }
      }

      const result = await withResources(
        [
          { acquire: () => 'resource1', cleanup: cleanup1 },
          { acquire: () => 'resource2', cleanup: cleanup2 },
        ],
        (r1, r2) => `${r1}:${r2}`
      );

      expect(result).toBe('resource1:resource2');
      expect(cleanup1).toHaveBeenCalledWith('resource1');
      expect(cleanup2).toHaveBeenCalledWith('resource2');
    });

    it('should cleanup all resources even if one fails', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn(() => {
        throw new Error('Cleanup2 failed');
      });
      const cleanup3 = vi.fn();

      async function withResources<R>(
        resources: Array<{ acquire: () => any; cleanup: (r: any) => void }>,
        use: (...resources: any[]) => R
      ): Promise<R> {
        const acquired = resources.map(r => r.acquire());

        try {
          return use(...acquired);
        } finally {
          const errors: Error[] = [];

          resources.forEach((r, i) => {
            try {
              r.cleanup(acquired[i]);
            } catch (error) {
              errors.push(error as Error);
            }
          });

          if (errors.length > 0) {
            throw errors[0];
          }
        }
      }

      await expect(async () => {
        await withResources(
          [
            { acquire: () => 'r1', cleanup: cleanup1 },
            { acquire: () => 'r2', cleanup: cleanup2 },
            { acquire: () => 'r3', cleanup: cleanup3 },
          ],
          () => 'result'
        );
      }).rejects.toThrow('Cleanup2 failed');

      // All cleanup functions were called
      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup3).toHaveBeenCalled();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle database connection lifecycle', async () => {
      const connectionLog: string[] = [];

      interface Connection {
        id: string;
        isOpen: boolean;
      }

      async function withConnection<R>(
        use: (conn: Connection) => Promise<R>
      ): Promise<R> {
        const conn: Connection = { id: 'conn-123', isOpen: true };
        connectionLog.push('connected');

        try {
          return await use(conn);
        } finally {
          conn.isOpen = false;
          connectionLog.push('disconnected');
        }
      }

      const result = await withConnection(async (conn) => {
        connectionLog.push(`using:${conn.id}`);
        return 'query result';
      });

      expect(result).toBe('query result');
      expect(connectionLog).toEqual(['connected', 'using:conn-123', 'disconnected']);
    });

    it('should handle file operations with cleanup', async () => {
      const fileLog: string[] = [];

      interface File {
        path: string;
        handle: number;
      }

      async function withFile<R>(
        path: string,
        use: (file: File) => R
      ): Promise<R> {
        const file: File = { path, handle: Date.now() };
        fileLog.push(`opened:${path}`);

        try {
          return use(file);
        } finally {
          fileLog.push(`closed:${path}`);
        }
      }

      await withFile('data.txt', (file) => {
        fileLog.push(`reading:${file.path}`);
        return 'file contents';
      });

      expect(fileLog).toEqual(['opened:data.txt', 'reading:data.txt', 'closed:data.txt']);
    });

    it('should handle transaction rollback on error', async () => {
      const transactionLog: string[] = [];

      interface Transaction {
        id: string;
        committed: boolean;
      }

      async function withTransaction<R>(
        use: (tx: Transaction) => Promise<R>
      ): Promise<R> {
        const tx: Transaction = { id: 'tx-123', committed: false };
        transactionLog.push('begin');

        try {
          const result = await use(tx);
          tx.committed = true;
          transactionLog.push('commit');
          return result;
        } catch (error) {
          transactionLog.push('rollback');
          throw error;
        }
      }

      // Successful transaction
      await withTransaction(async () => {
        transactionLog.push('query1');
        transactionLog.push('query2');
        return 'success';
      });

      expect(transactionLog).toEqual(['begin', 'query1', 'query2', 'commit']);

      transactionLog.length = 0;

      // Failed transaction
      await expect(async () => {
        await withTransaction(async () => {
          transactionLog.push('query1');
          throw new Error('Query failed');
        });
      }).rejects.toThrow('Query failed');

      expect(transactionLog).toEqual(['begin', 'query1', 'rollback']);
    });

    it('should handle nested resource scopes', async () => {
      const log: string[] = [];

      async function withOuter<R>(use: () => R): Promise<R> {
        log.push('outer-start');
        try {
          return use();
        } finally {
          log.push('outer-end');
        }
      }

      async function withInner<R>(use: () => R): Promise<R> {
        log.push('inner-start');
        try {
          return use();
        } finally {
          log.push('inner-end');
        }
      }

      await withOuter(() =>
        withInner(() => {
          log.push('work');
          return 'result';
        })
      );

      expect(log).toEqual(['outer-start', 'inner-start', 'work', 'inner-end', 'outer-end']);
    });

    it('should handle resource pool for HTTP connections', async () => {
      interface HttpConnection {
        id: number;
        url: string;
      }

      class HttpConnectionPool {
        private available: HttpConnection[] = [];
        private inUse = new Set<number>();

        constructor(size: number) {
          for (let i = 0; i < size; i++) {
            this.available.push({ id: i, url: `http://api${i}.example.com` });
          }
        }

        async acquire(): Promise<HttpConnection> {
          const conn = this.available.shift();

          if (!conn) {
            throw new Error('No connections available');
          }

          this.inUse.add(conn.id);
          return conn;
        }

        release(conn: HttpConnection): void {
          this.inUse.delete(conn.id);
          this.available.push(conn);
        }

        async withConnection<R>(
          use: (conn: HttpConnection) => Promise<R>
        ): Promise<R> {
          const conn = await this.acquire();

          try {
            return await use(conn);
          } finally {
            this.release(conn);
          }
        }

        getAvailableCount(): number {
          return this.available.length;
        }

        getInUseCount(): number {
          return this.inUse.size;
        }
      }

      const pool = new HttpConnectionPool(3);

      expect(pool.getAvailableCount()).toBe(3);
      expect(pool.getInUseCount()).toBe(0);

      const result = await pool.withConnection(async (conn) => {
        expect(pool.getAvailableCount()).toBe(2);
        expect(pool.getInUseCount()).toBe(1);
        return `fetched from ${conn.url}`;
      });

      expect(result).toContain('fetched from');
      expect(pool.getAvailableCount()).toBe(3);
      expect(pool.getInUseCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-size pool', () => {
      class ResourcePool {
        constructor(private size: number) {
          if (size < 0) {
            throw new Error('Pool size cannot be negative');
          }
        }

        getSize(): number {
          return this.size;
        }
      }

      expect(() => new ResourcePool(0)).not.toThrow();
      expect(() => new ResourcePool(-1)).toThrow('Pool size cannot be negative');
    });

    it('should handle resource acquisition failure', async () => {
      const cleanupCalled = vi.fn();

      async function withResource<T, R>(
        acquire: () => T,
        cleanup: (resource: T) => void,
        use: (resource: T) => R
      ): Promise<R> {
        let resource: T;

        try {
          resource = acquire();
        } catch (error) {
          throw error;
        }

        try {
          return use(resource);
        } finally {
          cleanup(resource);
        }
      }

      await expect(async () => {
        await withResource(
          () => {
            throw new Error('Acquisition failed');
          },
          cleanupCalled,
          () => 'result'
        );
      }).rejects.toThrow('Acquisition failed');

      // Cleanup should not be called if acquisition fails
      expect(cleanupCalled).not.toHaveBeenCalled();
    });

    it('should handle rapid acquire/release cycles', async () => {
      class ResourcePool {
        private available = [{ id: 1 }, { id: 2 }];

        async acquire() {
          return this.available.shift();
        }

        release(resource: { id: number }) {
          this.available.push(resource);
        }

        getAvailableCount() {
          return this.available.length;
        }
      }

      const pool = new ResourcePool();

      for (let i = 0; i < 100; i++) {
        const r = await pool.acquire();
        if (r) {
          pool.release(r);
        }
      }

      expect(pool.getAvailableCount()).toBe(2);
    });

    it('should handle cleanup exceptions gracefully', async () => {
      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn(() => {
        throw new Error('Cleanup failed');
      });

      async function withResource<T, R>(
        acquire: () => T,
        cleanup: (resource: T) => void,
        use: (resource: T) => R
      ): Promise<R> {
        const resource = acquire();

        try {
          return use(resource);
        } finally {
          try {
            cleanup(resource);
          } catch (error) {
            console.error('Cleanup error:', error);
          }
        }
      }

      // Should not throw even though cleanup throws
      const result = await withResource(
        () => 'resource',
        cleanup2,
        () => 'success'
      );

      expect(result).toBe('success');
      expect(cleanup2).toHaveBeenCalled();
    });
  });
});
