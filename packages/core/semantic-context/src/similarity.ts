/**
 * Similarity Computation Utilities
 *
 * Provides various methods for computing vector similarity.
 *
 * Invariants:
 * - INV-SEM-003: All scores normalized to [0, 1] range
 */

import type { SimilarityMethod, SimilarityOptions } from './types.js';

/**
 * Default similarity options
 */
export const DEFAULT_SIMILARITY_OPTIONS: SimilarityOptions = {
  method: 'cosine',
  normalize: true,
};

/**
 * Compute cosine similarity between two vectors
 * Returns value in [-1, 1] (or [0, 1] if normalized)
 *
 * INV-SEM-003: Normalized to [0, 1] when normalize=true
 */
export function cosineSimilarity(a: number[], b: number[], normalize = true): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;

  // Normalize from [-1, 1] to [0, 1]
  return normalize ? (similarity + 1) / 2 : similarity;
}

/**
 * Compute dot product similarity between two vectors
 * Returns raw dot product (or normalized if requested)
 *
 * INV-SEM-003: When normalize=true, normalizes vectors first and maps to [0, 1]
 */
export function dotProductSimilarity(a: number[], b: number[], normalize = true): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  if (!normalize) {
    // Raw dot product
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
    }
    return dotProduct;
  }

  // Normalized: compute cosine similarity (dot product of unit vectors)
  // This ensures result is in [-1, 1] range, then map to [0, 1]
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;

  // Map from [-1, 1] to [0, 1]
  return (similarity + 1) / 2;
}

/**
 * Compute Euclidean distance between two vectors
 * Returns distance (or similarity if normalize=true)
 *
 * INV-SEM-003: Converted to similarity via 1/(1+distance) when normalize=true
 */
export function euclideanDistance(a: number[], b: number[], normalize = true): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!;
    sumSquares += diff * diff;
  }

  const distance = Math.sqrt(sumSquares);

  // Convert distance to similarity: smaller distance = higher similarity
  return normalize ? 1 / (1 + distance) : distance;
}

/**
 * Compute Manhattan distance between two vectors
 */
export function manhattanDistance(a: number[], b: number[], normalize = true): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) return 0;

  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    distance += Math.abs(a[i]! - b[i]!);
  }

  // Convert to similarity
  return normalize ? 1 / (1 + distance) : distance;
}

/**
 * Compute similarity using specified method
 */
export function computeSimilarity(
  a: number[],
  b: number[],
  options: Partial<SimilarityOptions> = {}
): number {
  const { method, normalize } = { ...DEFAULT_SIMILARITY_OPTIONS, ...options };

  switch (method) {
    case 'cosine':
      return cosineSimilarity(a, b, normalize);
    case 'dot':
      return dotProductSimilarity(a, b, normalize);
    case 'euclidean':
      return euclideanDistance(a, b, normalize);
    default:
      throw new Error(`Unknown similarity method: ${method}`);
  }
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

/**
 * Compute vector norm (magnitude)
 */
export function vectorNorm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Add two vectors
 */
export function addVectors(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  return a.map((x, i) => x + b[i]!);
}

/**
 * Subtract vectors: a - b
 */
export function subtractVectors(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  return a.map((x, i) => x - b[i]!);
}

/**
 * Scale a vector by a scalar
 */
export function scaleVector(v: number[], scalar: number): number[] {
  return v.map((x) => x * scalar);
}

/**
 * Compute centroid (average) of multiple vectors
 */
export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  const dim = vectors[0]!.length;
  const centroid = new Array(dim).fill(0);

  for (const v of vectors) {
    if (v.length !== dim) {
      throw new Error(`Inconsistent vector dimensions`);
    }
    for (let i = 0; i < dim; i++) {
      centroid[i] += v[i]!;
    }
  }

  return centroid.map((x) => x / vectors.length);
}

/**
 * Find k nearest neighbors from candidates
 * INV-SEM-002: Results sorted by similarity descending
 */
export function findKNearest(
  query: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  k: number,
  method: SimilarityMethod = 'cosine'
): Array<{ id: string; similarity: number }> {
  const scored = candidates.map((c) => ({
    id: c.id,
    similarity: computeSimilarity(query, c.embedding, { method, normalize: true }),
  }));

  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, k);
}

/**
 * Filter vectors by minimum similarity threshold
 * INV-SEM-003: Threshold applied after normalization
 */
export function filterByThreshold(
  query: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  minSimilarity: number,
  method: SimilarityMethod = 'cosine'
): Array<{ id: string; similarity: number }> {
  return candidates
    .map((c) => ({
      id: c.id,
      similarity: computeSimilarity(query, c.embedding, { method, normalize: true }),
    }))
    .filter((s) => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);
}
