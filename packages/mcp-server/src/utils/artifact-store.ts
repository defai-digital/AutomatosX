/**
 * Artifact Store Utility
 *
 * Stores large MCP results externally so they don't pollute conversation context.
 * Uses the memory domain with a dedicated 'artifacts' namespace.
 *
 * Invariants:
 * - INV-MCP-RESP-005: Large results stored as artifacts with artifactRef
 */

// In-memory artifact store for when memory domain is not available
const artifactCache = new Map<string, unknown>();

/**
 * Store an artifact and return its reference URI
 *
 * @param key - Artifact key (e.g., "bugfix:scan:12345")
 * @param data - Data to store
 * @returns Artifact reference URI (e.g., "ax://bugfix/scan:12345")
 */
export async function storeArtifact(
  key: string,
  data: unknown
): Promise<string> {
  // Store in memory cache
  artifactCache.set(key, data);

  // Generate reference URI
  const [domain, ...rest] = key.split(':');
  const id = rest.join(':') || key;
  return `ax://${domain}/${id}`;
}

/**
 * Retrieve an artifact by its reference URI
 *
 * @param ref - Artifact reference URI (e.g., "ax://bugfix/scan:12345")
 * @returns The stored data, or undefined if not found
 */
export async function retrieveArtifact(ref: string): Promise<unknown | undefined> {
  // Parse reference URI
  const match = ref.match(/^ax:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid artifact reference: ${ref}`);
  }

  const [, domain, id] = match;
  const key = `${domain}:${id}`;

  // Retrieve from memory cache
  return artifactCache.get(key);
}

/**
 * Check if an artifact exists
 */
export async function hasArtifact(ref: string): Promise<boolean> {
  const match = ref.match(/^ax:\/\/([^/]+)\/(.+)$/);
  if (!match) return false;

  const [, domain, id] = match;
  const key = `${domain}:${id}`;
  return artifactCache.has(key);
}

/**
 * Delete an artifact
 */
export async function deleteArtifact(ref: string): Promise<boolean> {
  const match = ref.match(/^ax:\/\/([^/]+)\/(.+)$/);
  if (!match) return false;

  const [, domain, id] = match;
  const key = `${domain}:${id}`;
  return artifactCache.delete(key);
}

/**
 * List artifacts by domain
 */
export async function listArtifacts(domain: string): Promise<string[]> {
  const prefix = `${domain}:`;
  const refs: string[] = [];

  for (const key of artifactCache.keys()) {
    if (key.startsWith(prefix)) {
      const id = key.slice(prefix.length);
      refs.push(`ax://${domain}/${id}`);
    }
  }

  return refs;
}

/**
 * Clear all artifacts (for testing)
 */
export function clearArtifacts(): void {
  artifactCache.clear();
}

/**
 * Get artifact cache size (for monitoring)
 */
export function getArtifactCacheSize(): number {
  return artifactCache.size;
}

/**
 * Get total artifact cache memory estimate (rough)
 */
export function getArtifactCacheMemory(): number {
  let total = 0;
  for (const value of artifactCache.values()) {
    total += JSON.stringify(value).length;
  }
  return total;
}
