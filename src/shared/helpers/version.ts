import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface VersionInfo {
  version: string;
  releaseDate: string;
  codename: string;
  phase: string;
}

/**
 * Get version from package.json
 * This is the single source of truth for version info
 */
export function getVersion(): string {
  try {
    // In development: src/shared/helpers/version.ts -> ../../../package.json
    // In production: dist/index.js -> ../package.json
    // Try multiple paths to handle both scenarios
    const possiblePaths = [
      join(__dirname, '../../../package.json'),  // From src/shared/helpers
      join(__dirname, '../package.json'),        // From dist
    ];

    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
        if (pkg.version) {
          return pkg.version;
        }
      } catch {
        // Try next path
        continue;
      }
    }

    throw new Error('package.json not found in any expected location');
  } catch (error) {
    console.error('Failed to read version from package.json:', error);
    return 'unknown';
  }
}

/**
 * Get full version information
 * Note: releaseDate, codename, and phase are derived/hardcoded
 * as they're not critical for runtime
 */
export function getVersionInfo(): VersionInfo {
  const version = getVersion();
  const versionString = version || 'unknown';

  // You can optionally read these from a separate config if needed
  // For now, just return the version with sensible defaults
  const isoDate = new Date().toISOString();
  const datePart = isoDate.split('T')[0];

  return {
    version: versionString,
    releaseDate: datePart || isoDate,
    codename: 'Current',
    phase: derivePhase(versionString),
  };
}

function derivePhase(version: string): string {
  if (version.includes('beta')) return 'Beta';
  if (version.includes('rc')) return 'Release Candidate';
  if (version.includes('alpha')) return 'Alpha';
  return 'Stable';
}
