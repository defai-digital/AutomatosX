/**
 * Compression Utilities
 *
 * Provides gzip compression/decompression for task payloads.
 * Achieves 50-70% size reduction for JSON data.
 *
 * @module core/task-engine/compression
 * @version 1.0.0
 */

import { gzipSync, gunzipSync, constants } from 'zlib';
import { TaskEngineError } from './types';

/**
 * Default compression level (1-9, higher = better compression but slower)
 * Level 6 provides good balance of speed and compression ratio
 */
export const DEFAULT_COMPRESSION_LEVEL = 6;

/**
 * Minimum size threshold for compression (4KB)
 * Payloads smaller than this won't benefit much from compression
 */
export const MIN_COMPRESSION_THRESHOLD = 4096;

/**
 * Compression result with metadata
 */
export interface CompressionResult {
  /** Compressed data */
  data: Buffer;

  /** Original size in bytes */
  originalSize: number;

  /** Compressed size in bytes */
  compressedSize: number;

  /** Compression ratio (original / compressed) */
  ratio: number;

  /** Whether compression was applied (false if below threshold) */
  compressed: boolean;
}

/**
 * Compress a payload object using gzip
 *
 * @param payload - Object to compress
 * @param level - Compression level (1-9, default: 6)
 * @returns Compressed buffer
 * @throws {TaskEngineError} If compression fails
 *
 * @example
 * ```typescript
 * const payload = { query: 'search term', results: [...] };
 * const compressed = compressPayload(payload);
 * console.log(`Compressed to ${compressed.length} bytes`);
 * ```
 */
export function compressPayload(
  payload: Record<string, unknown>,
  level: number = DEFAULT_COMPRESSION_LEVEL
): Buffer {
  try {
    const json = JSON.stringify(payload);
    const buffer = Buffer.from(json, 'utf-8');

    return gzipSync(buffer, {
      level: Math.min(Math.max(level, 1), 9)
    });
  } catch (error) {
    throw new TaskEngineError(
      `Failed to compress payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'COMPRESSION_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Decompress a gzip-compressed payload
 *
 * @param compressed - Compressed buffer
 * @returns Decompressed object
 * @throws {TaskEngineError} If decompression fails
 *
 * @example
 * ```typescript
 * const compressed = compressPayload({ key: 'value' });
 * const payload = decompressPayload(compressed);
 * console.log(payload.key); // 'value'
 * ```
 */
export function decompressPayload(compressed: Buffer): Record<string, unknown> {
  try {
    const decompressed = gunzipSync(compressed);
    const json = decompressed.toString('utf-8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch (error) {
    throw new TaskEngineError(
      `Failed to decompress payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'COMPRESSION_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Compress a payload with detailed result information
 *
 * @param payload - Object to compress
 * @param options - Compression options
 * @returns Compression result with metadata
 *
 * @example
 * ```typescript
 * const result = compressWithInfo({ data: '...' }, { level: 6 });
 * console.log(`Ratio: ${result.ratio.toFixed(2)}x`);
 * console.log(`Saved: ${result.originalSize - result.compressedSize} bytes`);
 * ```
 */
export function compressWithInfo(
  payload: Record<string, unknown>,
  options: {
    level?: number;
    minThreshold?: number;
  } = {}
): CompressionResult {
  const level = options.level ?? DEFAULT_COMPRESSION_LEVEL;
  const minThreshold = options.minThreshold ?? MIN_COMPRESSION_THRESHOLD;

  try {
    const json = JSON.stringify(payload);
    const originalBuffer = Buffer.from(json, 'utf-8');
    const originalSize = originalBuffer.length;

    // Skip compression for small payloads
    if (originalSize < minThreshold) {
      return {
        data: originalBuffer,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        compressed: false
      };
    }

    const compressedBuffer = gzipSync(originalBuffer, {
      level: Math.min(Math.max(level, 1), 9)
    });

    const compressedSize = compressedBuffer.length;

    // If compression didn't help, return original
    if (compressedSize >= originalSize) {
      return {
        data: originalBuffer,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        compressed: false
      };
    }

    return {
      data: compressedBuffer,
      originalSize,
      compressedSize,
      ratio: originalSize / compressedSize,
      compressed: true
    };
  } catch (error) {
    throw new TaskEngineError(
      `Failed to compress payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'COMPRESSION_ERROR',
      { originalError: error }
    );
  }
}

/**
 * Decompress a buffer that may or may not be compressed
 *
 * @param data - Data buffer (compressed or uncompressed)
 * @param isCompressed - Whether the data is compressed
 * @returns Decompressed object
 */
export function decompressWithInfo(
  data: Buffer,
  isCompressed: boolean
): Record<string, unknown> {
  if (!isCompressed) {
    try {
      return JSON.parse(data.toString('utf-8')) as Record<string, unknown>;
    } catch (error) {
      throw new TaskEngineError(
        `Failed to parse uncompressed payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'COMPRESSION_ERROR',
        { originalError: error }
      );
    }
  }

  return decompressPayload(data);
}

/**
 * Estimate the compressed size of a payload without actually compressing
 * Uses a simple heuristic based on JSON structure
 *
 * @param payload - Object to estimate
 * @returns Estimated compressed size in bytes
 */
export function estimateCompressedSize(payload: Record<string, unknown>): number {
  const json = JSON.stringify(payload);
  const originalSize = Buffer.byteLength(json, 'utf-8');

  // Heuristic: JSON typically compresses to 30-50% of original size
  // Use 40% as a conservative estimate
  const estimatedRatio = 0.4;

  return Math.ceil(originalSize * estimatedRatio);
}

/**
 * Check if a buffer is gzip compressed
 *
 * @param data - Buffer to check
 * @returns true if buffer appears to be gzip compressed
 */
export function isGzipCompressed(data: Buffer): boolean {
  // Gzip magic number: 0x1f 0x8b
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Calculate compression ratio between original and compressed sizes
 *
 * @param originalSize - Original size in bytes
 * @param compressedSize - Compressed size in bytes
 * @returns Compression ratio (original / compressed)
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  if (compressedSize === 0) {
    return originalSize > 0 ? Infinity : 1;
  }
  return originalSize / compressedSize;
}

/**
 * Get compression level from ratio preference
 *
 * @param preference - 'fast' | 'balanced' | 'best'
 * @returns Compression level (1-9)
 */
export function getCompressionLevel(
  preference: 'fast' | 'balanced' | 'best' = 'balanced'
): number {
  switch (preference) {
    case 'fast':
      return constants.Z_BEST_SPEED; // 1
    case 'best':
      return constants.Z_BEST_COMPRESSION; // 9
    case 'balanced':
    default:
      return DEFAULT_COMPRESSION_LEVEL; // 6
  }
}
