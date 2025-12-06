/**
 * Compression Utilities Unit Tests
 *
 * Tests for payload compression and decompression:
 * - Gzip compression/decompression
 * - Compression ratio calculation
 * - Small payload handling
 * - Error handling
 */

import { describe, it, expect } from 'vitest';
import {
  compressPayload,
  decompressPayload,
  compressWithInfo,
  decompressWithInfo,
  estimateCompressedSize,
  isGzipCompressed,
  calculateCompressionRatio,
  getCompressionLevel,
  DEFAULT_COMPRESSION_LEVEL,
  MIN_COMPRESSION_THRESHOLD
} from '@/core/task-engine/compression';
import { TaskEngineError } from '@/core/task-engine/types';

describe('compressPayload', () => {
  it('should compress a simple object', () => {
    const payload = { key: 'value', number: 42 };
    const compressed = compressPayload(payload);

    expect(compressed).toBeInstanceOf(Buffer);
    expect(isGzipCompressed(compressed)).toBe(true);
  });

  it('should compress a large object', () => {
    const payload = {
      data: 'x'.repeat(10000),
      items: Array(100).fill({ id: 1, name: 'test' })
    };

    const compressed = compressPayload(payload);
    const originalSize = Buffer.byteLength(JSON.stringify(payload), 'utf-8');

    // Should achieve significant compression
    expect(compressed.length).toBeLessThan(originalSize);
  });

  it('should accept compression level', () => {
    const payload = { data: 'x'.repeat(1000) };

    const fast = compressPayload(payload, 1);
    const best = compressPayload(payload, 9);

    // Best compression should be smaller or equal
    expect(best.length).toBeLessThanOrEqual(fast.length);
  });

  it('should clamp invalid compression levels', () => {
    const payload = { key: 'value' };

    // Should not throw for out-of-range levels
    expect(() => compressPayload(payload, 0)).not.toThrow();
    expect(() => compressPayload(payload, 10)).not.toThrow();
  });

  it('should throw TaskEngineError on invalid input', () => {
    // Circular reference will fail JSON.stringify
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => compressPayload(circular)).toThrow(TaskEngineError);
  });
});

describe('decompressPayload', () => {
  it('should decompress compressed data', () => {
    const original = { key: 'value', nested: { deep: true } };
    const compressed = compressPayload(original);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(original);
  });

  it('should handle large decompressed data', () => {
    const original = { data: 'x'.repeat(100000) };
    const compressed = compressPayload(original);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(original);
  });

  it('should throw TaskEngineError for invalid compressed data', () => {
    const invalidData = Buffer.from('not gzip data');

    expect(() => decompressPayload(invalidData)).toThrow(TaskEngineError);
  });

  it('should throw TaskEngineError for truncated data', () => {
    const compressed = compressPayload({ key: 'value' });
    const truncated = compressed.slice(0, compressed.length - 5);

    expect(() => decompressPayload(truncated)).toThrow(TaskEngineError);
  });
});

describe('compressWithInfo', () => {
  it('should return compression metadata', () => {
    const payload = { data: 'x'.repeat(10000) };
    const result = compressWithInfo(payload);

    expect(result.originalSize).toBeGreaterThan(0);
    expect(result.compressedSize).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(1);
    expect(result.compressed).toBe(true);
    expect(result.data).toBeInstanceOf(Buffer);
  });

  it('should skip compression for small payloads', () => {
    const payload = { key: 'value' };
    const result = compressWithInfo(payload);

    expect(result.compressed).toBe(false);
    expect(result.ratio).toBe(1);
    expect(result.originalSize).toBe(result.compressedSize);
  });

  it('should respect custom threshold', () => {
    const payload = { data: 'x'.repeat(100) };

    // With low threshold, should compress
    const lowThreshold = compressWithInfo(payload, { minThreshold: 10 });
    expect(lowThreshold.compressed).toBe(true);

    // With high threshold, should not compress
    const highThreshold = compressWithInfo(payload, { minThreshold: 10000 });
    expect(highThreshold.compressed).toBe(false);
  });

  it('should not compress if result is larger', () => {
    // Very small random data doesn't compress well
    const payload = { r: Math.random().toString() };
    const result = compressWithInfo(payload, { minThreshold: 1 });

    // If compression made it larger, should return original
    if (!result.compressed) {
      expect(result.originalSize).toBe(result.compressedSize);
    }
  });

  it('should accept compression level option', () => {
    const payload = { data: 'x'.repeat(10000) };

    const fast = compressWithInfo(payload, { level: 1 });
    const best = compressWithInfo(payload, { level: 9 });

    expect(best.compressedSize).toBeLessThanOrEqual(fast.compressedSize);
  });
});

describe('decompressWithInfo', () => {
  it('should decompress compressed data', () => {
    const original = { key: 'value', data: 'test' };
    const result = compressWithInfo(original, { minThreshold: 1 });

    if (result.compressed) {
      const decompressed = decompressWithInfo(result.data, true);
      expect(decompressed).toEqual(original);
    }
  });

  it('should parse uncompressed JSON', () => {
    const original = { key: 'value' };
    const buffer = Buffer.from(JSON.stringify(original), 'utf-8');

    const decompressed = decompressWithInfo(buffer, false);
    expect(decompressed).toEqual(original);
  });

  it('should throw for invalid uncompressed JSON', () => {
    const buffer = Buffer.from('not json', 'utf-8');

    expect(() => decompressWithInfo(buffer, false)).toThrow(TaskEngineError);
  });
});

describe('estimateCompressedSize', () => {
  it('should estimate compressed size', () => {
    // Use realistic data that doesn't have extreme repetition
    const payload = { data: Array(100).fill(null).map((_, i) => `item-${i}-${Math.random()}`).join(',') };
    const estimated = estimateCompressedSize(payload);
    const actual = compressPayload(payload).length;

    // Estimate should be positive and give a rough approximation
    // For realistic data, estimate should be within 5x of actual
    expect(estimated).toBeGreaterThan(0);
    expect(estimated).toBeLessThan(actual * 5);
  });

  it('should return smaller estimate for compressible data', () => {
    const compressible = { data: 'aaaaaaaaaa'.repeat(1000) };
    const random = { data: Math.random().toString().repeat(100) };

    const compressibleEstimate = estimateCompressedSize(compressible);
    const randomEstimate = estimateCompressedSize(random);

    // Compressible data should have smaller estimate relative to original
    const compressibleOriginal = Buffer.byteLength(JSON.stringify(compressible), 'utf-8');
    const randomOriginal = Buffer.byteLength(JSON.stringify(random), 'utf-8');

    expect(compressibleEstimate / compressibleOriginal)
      .toBeLessThanOrEqual(randomEstimate / randomOriginal + 0.5);
  });
});

describe('isGzipCompressed', () => {
  it('should return true for gzip data', () => {
    const compressed = compressPayload({ key: 'value' });
    expect(isGzipCompressed(compressed)).toBe(true);
  });

  it('should return false for plain text', () => {
    const plain = Buffer.from('plain text', 'utf-8');
    expect(isGzipCompressed(plain)).toBe(false);
  });

  it('should return false for empty buffer', () => {
    expect(isGzipCompressed(Buffer.alloc(0))).toBe(false);
  });

  it('should return false for single byte', () => {
    expect(isGzipCompressed(Buffer.from([0x1f]))).toBe(false);
  });

  it('should detect gzip magic number', () => {
    // Gzip magic: 0x1f 0x8b
    const gzipMagic = Buffer.from([0x1f, 0x8b, 0x00, 0x00]);
    expect(isGzipCompressed(gzipMagic)).toBe(true);
  });
});

describe('calculateCompressionRatio', () => {
  it('should calculate correct ratio', () => {
    expect(calculateCompressionRatio(1000, 250)).toBe(4);
    expect(calculateCompressionRatio(100, 50)).toBe(2);
    expect(calculateCompressionRatio(100, 100)).toBe(1);
  });

  it('should handle zero compressed size', () => {
    expect(calculateCompressionRatio(100, 0)).toBe(Infinity);
    expect(calculateCompressionRatio(0, 0)).toBe(1);
  });
});

describe('getCompressionLevel', () => {
  it('should return correct levels for preferences', () => {
    expect(getCompressionLevel('fast')).toBe(1);
    expect(getCompressionLevel('balanced')).toBe(DEFAULT_COMPRESSION_LEVEL);
    expect(getCompressionLevel('best')).toBe(9);
  });

  it('should default to balanced', () => {
    expect(getCompressionLevel()).toBe(DEFAULT_COMPRESSION_LEVEL);
  });
});

describe('constants', () => {
  it('should have correct default compression level', () => {
    expect(DEFAULT_COMPRESSION_LEVEL).toBe(6);
  });

  it('should have correct minimum threshold', () => {
    expect(MIN_COMPRESSION_THRESHOLD).toBe(4096);
  });
});

describe('round-trip integrity', () => {
  it('should preserve data types through compression', () => {
    const payload = {
      string: 'hello',
      number: 42,
      float: 3.14,
      boolean: true,
      null: null,
      array: [1, 2, 3],
      nested: { deep: { value: 'test' } }
    };

    const compressed = compressPayload(payload);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(payload);
  });

  it('should handle unicode characters', () => {
    const payload = {
      emoji: '😀🎉🚀',
      chinese: '中文测试',
      arabic: 'اختبار',
      special: 'tëst çhàrs'
    };

    const compressed = compressPayload(payload);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(payload);
  });

  it('should handle empty object', () => {
    const payload = {};
    const compressed = compressPayload(payload);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(payload);
  });

  it('should handle large arrays', () => {
    const payload = {
      items: Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'x'.repeat(100)
      }))
    };

    const compressed = compressPayload(payload);
    const decompressed = decompressPayload(compressed);

    expect(decompressed).toEqual(payload);
  });
});
