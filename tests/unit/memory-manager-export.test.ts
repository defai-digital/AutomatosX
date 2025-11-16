/**
 * Memory Manager Export Tests
 *
 * Tests the memory manager exports
 * v4.11.0: MemoryManagerVec renamed to MemoryManager
 */

import { describe, it, expect } from 'vitest';
import { MemoryManager } from '../../src/core/memory-manager.js';
import type { IMemoryManager } from '../../src/types/memory.js';

describe('Memory Manager Export', () => {
  it('should export MemoryManager class', () => {
    expect(MemoryManager).toBeDefined();
    expect(MemoryManager.name).toBe('MemoryManager');
  });

  it('should export IMemoryManager interface type', () => {
    // Type check - if this compiles, the type is exported correctly
    const checkType = (manager: IMemoryManager) => manager;
    expect(checkType).toBeDefined();
  });

  it('should have create factory method', () => {
    expect(MemoryManager.create).toBeDefined();
    expect(typeof MemoryManager.create).toBe('function');
  });
});
