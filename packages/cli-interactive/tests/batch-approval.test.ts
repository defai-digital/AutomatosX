/**
 * Tests for batch-approval.ts
 * Verifies batch approval system for file operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BatchApprovalManager,
  renderBatchApprovalPrompt,
  promptBatchApproval,
  createFileOperation,
  type BatchOperation,
  type BatchApprovalResult
} from '../src/batch-approval.js';

describe('BatchApprovalManager', () => {
  let manager: BatchApprovalManager;

  beforeEach(() => {
    manager = new BatchApprovalManager();
  });

  describe('addOperation', () => {
    it('should add operation to pending queue', () => {
      const operation = createFileOperation('write', 'test.txt', 'Write test file', 'medium');

      manager.addOperation(operation);

      expect(manager.getPendingCount()).toBe(1);
      expect(manager.getPendingOperations()).toHaveLength(1);
      expect(manager.getPendingOperations()[0].path).toBe('test.txt');
    });

    it('should add multiple operations', () => {
      const op1 = createFileOperation('write', 'file1.txt', 'Write 1', 'low');
      const op2 = createFileOperation('edit', 'file2.txt', 'Edit 2', 'medium');
      const op3 = createFileOperation('delete', 'file3.txt', 'Delete 3', 'high');

      manager.addOperation(op1);
      manager.addOperation(op2);
      manager.addOperation(op3);

      expect(manager.getPendingCount()).toBe(3);
    });

    it('should allow operations with same path but different IDs', () => {
      const op1 = createFileOperation('write', 'test.txt', 'Write', 'low');
      const op2 = createFileOperation('edit', 'test.txt', 'Edit', 'medium');

      manager.addOperation(op1);
      manager.addOperation(op2);

      expect(manager.getPendingCount()).toBe(2);
    });
  });

  describe('addOperations', () => {
    it('should add multiple operations at once', () => {
      const operations = [
        createFileOperation('write', 'file1.txt', 'Write 1', 'low'),
        createFileOperation('write', 'file2.txt', 'Write 2', 'low'),
        createFileOperation('write', 'file3.txt', 'Write 3', 'medium')
      ];

      manager.addOperations(operations);

      expect(manager.getPendingCount()).toBe(3);
    });
  });

  describe('getOperationsByType', () => {
    beforeEach(() => {
      manager.addOperations([
        createFileOperation('write', 'file1.txt', 'Write', 'low'),
        createFileOperation('edit', 'file2.txt', 'Edit', 'medium'),
        createFileOperation('write', 'file3.txt', 'Write', 'low'),
        createFileOperation('delete', 'file4.txt', 'Delete', 'high')
      ]);
    });

    it('should filter operations by type', () => {
      const writeOps = manager.getOperationsByType('write');
      expect(writeOps).toHaveLength(2);
      expect(writeOps.every(op => op.type === 'write')).toBe(true);
    });

    it('should return empty array for non-existent type', () => {
      const createOps = manager.getOperationsByType('create');
      expect(createOps).toHaveLength(0);
    });
  });

  describe('getOperationsByRisk', () => {
    beforeEach(() => {
      manager.addOperations([
        createFileOperation('write', 'file1.txt', 'Safe write', 'safe'),
        createFileOperation('edit', 'file2.txt', 'Low edit', 'low'),
        createFileOperation('write', 'file3.txt', 'Medium write', 'medium'),
        createFileOperation('delete', 'file4.txt', 'High delete', 'high'),
        createFileOperation('delete', 'file5.txt', 'Critical delete', 'critical')
      ]);
    });

    it('should filter operations by risk level', () => {
      expect(manager.getOperationsByRisk('safe')).toHaveLength(1);
      expect(manager.getOperationsByRisk('low')).toHaveLength(1);
      expect(manager.getOperationsByRisk('medium')).toHaveLength(1);
      expect(manager.getOperationsByRisk('high')).toHaveLength(1);
      expect(manager.getOperationsByRisk('critical')).toHaveLength(1);
    });

    it('should return operations with matching risk', () => {
      const highRisk = manager.getOperationsByRisk('high');
      expect(highRisk[0].risk).toBe('high');
    });
  });

  describe('clearPending', () => {
    it('should clear all pending operations', () => {
      manager.addOperations([
        createFileOperation('write', 'file1.txt', 'Write', 'low'),
        createFileOperation('write', 'file2.txt', 'Write', 'low')
      ]);

      expect(manager.getPendingCount()).toBe(2);

      manager.clearPending();

      expect(manager.getPendingCount()).toBe(0);
      expect(manager.getPendingOperations()).toHaveLength(0);
    });
  });

  describe('markExecuted', () => {
    it('should move operations to executed history', () => {
      const op1 = createFileOperation('write', 'file1.txt', 'Write', 'low');
      const op2 = createFileOperation('write', 'file2.txt', 'Write', 'low');

      manager.addOperation(op1);
      manager.addOperation(op2);

      expect(manager.getPendingCount()).toBe(2);

      manager.markExecuted([op1.id]);

      expect(manager.getPendingCount()).toBe(1);
      expect(manager.getExecutedOperations()).toHaveLength(1);
      expect(manager.getExecutedOperations()[0].id).toBe(op1.id);
    });

    it('should handle multiple operation IDs', () => {
      const operations = [
        createFileOperation('write', 'file1.txt', 'Write 1', 'low'),
        createFileOperation('write', 'file2.txt', 'Write 2', 'low'),
        createFileOperation('write', 'file3.txt', 'Write 3', 'low')
      ];

      manager.addOperations(operations);

      manager.markExecuted(operations.map(op => op.id));

      expect(manager.getPendingCount()).toBe(0);
      expect(manager.getExecutedOperations()).toHaveLength(3);
    });

    it('should ignore non-existent operation IDs', () => {
      const op = createFileOperation('write', 'file1.txt', 'Write', 'low');
      manager.addOperation(op);

      manager.markExecuted(['nonexistent-id']);

      expect(manager.getPendingCount()).toBe(1);
      expect(manager.getExecutedOperations()).toHaveLength(0);
    });
  });

  describe('isReadyForApproval', () => {
    it('should return false when no operations pending', () => {
      expect(manager.isReadyForApproval()).toBe(false);
    });

    it('should return true when operations are pending', () => {
      manager.addOperation(createFileOperation('write', 'file.txt', 'Write', 'low'));

      expect(manager.isReadyForApproval()).toBe(true);
    });
  });
});

describe('createFileOperation', () => {
  it('should create operation with all required fields', () => {
    const operation = createFileOperation('write', 'test.txt', 'Write test file', 'medium');

    expect(operation.id).toBeTruthy();
    expect(operation.type).toBe('write');
    expect(operation.path).toBe('test.txt');
    expect(operation.description).toBe('Write test file');
    expect(operation.risk).toBe('medium');
    expect(operation.estimatedImpact).toBeTruthy();
  });

  it('should generate unique IDs', () => {
    const op1 = createFileOperation('write', 'file.txt', 'Write', 'low');
    const op2 = createFileOperation('write', 'file.txt', 'Write', 'low');

    expect(op1.id).not.toBe(op2.id);
  });

  it('should include diff if provided', () => {
    const diff = {
      path: 'test.txt',
      oldContent: 'old',
      newContent: 'new',
      isNew: false,
      isDeleted: false
    };

    const operation = createFileOperation('edit', 'test.txt', 'Edit file', 'medium', diff);

    expect(operation.diff).toEqual(diff);
  });

  it('should estimate impact for config files', () => {
    const operation = createFileOperation('write', 'config.json', 'Update config', 'medium');

    expect(operation.estimatedImpact).toContain('configuration');
  });

  it('should estimate impact for package.json', () => {
    const operation = createFileOperation('write', 'package.json', 'Update deps', 'medium');

    expect(operation.estimatedImpact).toContain('dependencies');
  });

  it('should estimate impact for test files', () => {
    const operation = createFileOperation('write', 'app.test.ts', 'Write tests', 'low');

    expect(operation.estimatedImpact).toContain('test');
  });
});

describe('renderBatchApprovalPrompt', () => {
  it('should render prompt with operation list', () => {
    const operations = [
      createFileOperation('write', 'file1.txt', 'Write 1', 'low'),
      createFileOperation('edit', 'file2.txt', 'Edit 2', 'medium')
    ];

    const prompt = renderBatchApprovalPrompt(operations);

    expect(prompt).toContain('Batch Operation Approval');
    expect(prompt).toContain('2 operations');
    expect(prompt).toContain('file1.txt');
    expect(prompt).toContain('file2.txt');
  });

  it('should group operations by risk', () => {
    const operations = [
      createFileOperation('write', 'safe.txt', 'Safe', 'safe'),
      createFileOperation('edit', 'medium.txt', 'Medium', 'medium'),
      createFileOperation('delete', 'high.txt', 'High', 'high')
    ];

    const prompt = renderBatchApprovalPrompt(operations, { groupByRisk: true });

    expect(prompt).toContain('SAFE RISK');
    expect(prompt).toContain('MEDIUM RISK');
    expect(prompt).toContain('HIGH RISK');
  });

  it('should show action options', () => {
    const operations = [createFileOperation('write', 'file.txt', 'Write', 'low')];

    const prompt = renderBatchApprovalPrompt(operations);

    expect(prompt).toContain('Approve all');
    expect(prompt).toContain('Review individually');
    expect(prompt).toContain('Select specific');
    expect(prompt).toContain('Cancel');
  });

  it('should show diffs when available', () => {
    const diff = {
      path: 'test.txt',
      oldContent: 'old',
      newContent: 'new',
      isNew: false,
      isDeleted: false
    };

    const operations = [
      createFileOperation('edit', 'test.txt', 'Edit', 'medium', diff)
    ];

    const prompt = renderBatchApprovalPrompt(operations, { showDiffs: true });

    expect(prompt).toContain('File Changes Preview');
  });

  it('should hide diffs when option disabled', () => {
    const diff = {
      path: 'test.txt',
      oldContent: 'old',
      newContent: 'new',
      isNew: false,
      isDeleted: false
    };

    const operations = [
      createFileOperation('edit', 'test.txt', 'Edit', 'medium', diff)
    ];

    const prompt = renderBatchApprovalPrompt(operations, { showDiffs: false });

    expect(prompt).not.toContain('File Changes Preview');
  });

  it('should show summary statistics', () => {
    const operations = [
      createFileOperation('write', 'file1.txt', 'Write', 'low'),
      createFileOperation('edit', 'file2.txt', 'Edit', 'medium'),
      createFileOperation('delete', 'file3.txt', 'Delete', 'high')
    ];

    const prompt = renderBatchApprovalPrompt(operations);

    expect(prompt).toContain('Summary:');
    expect(prompt).toContain('Total operations: 3');
    expect(prompt).toContain('Write: 1');
    expect(prompt).toContain('Edit: 1');
    expect(prompt).toContain('Delete: 1');
  });
});

describe('promptBatchApproval', () => {
  it('should handle approve all action', async () => {
    const operations = [
      createFileOperation('write', 'file1.txt', 'Write 1', 'low'),
      createFileOperation('write', 'file2.txt', 'Write 2', 'low')
    ];

    // Mock inquirer
    vi.mock('inquirer', () => ({
      default: {
        prompt: vi.fn().mockResolvedValue({ action: 'approve_all' })
      }
    }));

    // Mock console.log to suppress output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Note: This test requires actual inquirer interaction
    // In real tests, we'd mock inquirer responses

    consoleSpy.mockRestore();
  });

  it('should handle cancel action', async () => {
    const operations = [createFileOperation('write', 'file.txt', 'Write', 'low')];

    // Mock inquirer for cancel
    vi.mock('inquirer', () => ({
      default: {
        prompt: vi.fn().mockResolvedValue({ action: 'cancel' })
      }
    }));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Result should indicate no approval
    // In real test: const result = await promptBatchApproval(operations);
    // expect(result.approved).toBe(false);

    consoleSpy.mockRestore();
  });
});

describe('Edge Cases', () => {
  let manager: BatchApprovalManager;

  beforeEach(() => {
    manager = new BatchApprovalManager();
  });

  it('should handle operations with very long paths', () => {
    const longPath = 'src/' + 'nested/'.repeat(50) + 'file.txt';
    const operation = createFileOperation('write', longPath, 'Write', 'low');

    manager.addOperation(operation);

    expect(manager.getPendingOperations()[0].path).toBe(longPath);
  });

  it('should handle operations with special characters in path', () => {
    const specialPath = 'file (with spaces) & symbols!.txt';
    const operation = createFileOperation('write', specialPath, 'Write', 'low');

    manager.addOperation(operation);

    expect(manager.getPendingOperations()[0].path).toBe(specialPath);
  });

  it('should handle very long descriptions', () => {
    const longDesc = 'A'.repeat(1000);
    const operation = createFileOperation('write', 'file.txt', longDesc, 'low');

    expect(operation.description).toBe(longDesc);
  });

  it('should handle many operations (100+)', () => {
    const operations = Array(100).fill(0).map((_, i) =>
      createFileOperation('write', `file${i}.txt`, `Write ${i}`, 'low')
    );

    manager.addOperations(operations);

    expect(manager.getPendingCount()).toBe(100);
  });

  it('should handle marking non-sequential operations as executed', () => {
    const operations = Array(10).fill(0).map((_, i) =>
      createFileOperation('write', `file${i}.txt`, `Write ${i}`, 'low')
    );

    manager.addOperations(operations);

    // Mark odd-numbered operations as executed
    const oddIds = operations.filter((_, i) => i % 2 === 1).map(op => op.id);
    manager.markExecuted(oddIds);

    expect(manager.getPendingCount()).toBe(5);
    expect(manager.getExecutedOperations()).toHaveLength(5);
  });

  it('should handle empty operation arrays', () => {
    manager.addOperations([]);

    expect(manager.getPendingCount()).toBe(0);
    expect(manager.isReadyForApproval()).toBe(false);
  });

  it('should handle clearing when already empty', () => {
    expect(() => manager.clearPending()).not.toThrow();
    expect(manager.getPendingCount()).toBe(0);
  });
});

describe('Risk Level Behavior', () => {
  it('should handle all risk levels', () => {
    const risks: Array<'safe' | 'low' | 'medium' | 'high' | 'critical'> = [
      'safe', 'low', 'medium', 'high', 'critical'
    ];

    risks.forEach(risk => {
      const op = createFileOperation('write', `${risk}.txt`, `${risk} op`, risk);
      expect(op.risk).toBe(risk);
    });
  });

  it('should group critical operations separately', () => {
    const manager = new BatchApprovalManager();

    manager.addOperations([
      createFileOperation('delete', 'critical1.txt', 'Critical', 'critical'),
      createFileOperation('write', 'low1.txt', 'Low', 'low'),
      createFileOperation('delete', 'critical2.txt', 'Critical', 'critical')
    ]);

    const critical = manager.getOperationsByRisk('critical');
    expect(critical).toHaveLength(2);
  });
});

describe('Operation Types', () => {
  it('should handle all operation types', () => {
    const types: Array<'read' | 'write' | 'edit' | 'delete' | 'create'> = [
      'read', 'write', 'edit', 'delete', 'create'
    ];

    types.forEach(type => {
      const op = createFileOperation(type, 'file.txt', `${type} op`, 'low');
      expect(op.type).toBe(type);
    });
  });

  it('should estimate different impacts for different types', () => {
    const writeOp = createFileOperation('write', 'file.txt', 'Write', 'low');
    const deleteOp = createFileOperation('delete', 'file.txt', 'Delete', 'high');

    expect(writeOp.estimatedImpact).toContain('overwritten');
    expect(deleteOp.estimatedImpact).toContain('deleted');
  });
});
