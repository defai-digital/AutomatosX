/**
 * Semantic Version Engine
 * Sprint 4 Day 32: Semver parsing, validation, and compatibility checking
 */

import * as semver from 'semver'

/**
 * Semver compatibility result
 */
export interface CompatibilityResult {
  compatible: boolean
  reason?: string
  satisfiedVersion?: string
}

/**
 * Version range types
 */
export type VersionRange = string // e.g., "^1.2.3", "~2.0.0", ">=3.0.0"

/**
 * Semantic Version Engine
 */
export class SemverEngine {
  /**
   * Parse and validate semantic version
   */
  parse(version: string): semver.SemVer | null {
    try {
      return semver.parse(version)
    } catch (error) {
      return null
    }
  }

  /**
   * Validate if string is valid semver
   */
  isValid(version: string): boolean {
    return semver.valid(version) !== null
  }

  /**
   * Check if version satisfies range
   */
  satisfies(version: string, range: VersionRange): boolean {
    try {
      return semver.satisfies(version, range)
    } catch (error) {
      return false
    }
  }

  /**
   * Check compatibility between version and range
   */
  checkCompatibility(
    version: string,
    range: VersionRange
  ): CompatibilityResult {
    if (!this.isValid(version)) {
      return {
        compatible: false,
        reason: `Invalid version: ${version}`,
      }
    }

    if (!semver.validRange(range)) {
      return {
        compatible: false,
        reason: `Invalid version range: ${range}`,
      }
    }

    const compatible = this.satisfies(version, range)

    if (compatible) {
      return {
        compatible: true,
        satisfiedVersion: version,
      }
    }

    return {
      compatible: false,
      reason: `Version ${version} does not satisfy range ${range}`,
    }
  }

  /**
   * Get highest version that satisfies range from list
   */
  maxSatisfying(versions: string[], range: VersionRange): string | null {
    try {
      return semver.maxSatisfying(versions, range)
    } catch (error) {
      return null
    }
  }

  /**
   * Get minimum version that satisfies range from list
   */
  minSatisfying(versions: string[], range: VersionRange): string | null {
    try {
      return semver.minSatisfying(versions, range)
    } catch (error) {
      return null
    }
  }

  /**
   * Compare two versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compare(v1: string, v2: string): number {
    try {
      return semver.compare(v1, v2)
    } catch (error) {
      return 0
    }
  }

  /**
   * Check if version is greater than another
   */
  gt(v1: string, v2: string): boolean {
    try {
      return semver.gt(v1, v2)
    } catch (error) {
      return false
    }
  }

  /**
   * Check if version is less than another
   */
  lt(v1: string, v2: string): boolean {
    try {
      return semver.lt(v1, v2)
    } catch (error) {
      return false
    }
  }

  /**
   * Check if version equals another
   */
  eq(v1: string, v2: string): boolean {
    try {
      return semver.eq(v1, v2)
    } catch (error) {
      return false
    }
  }

  /**
   * Get major version
   */
  major(version: string): number | null {
    const parsed = this.parse(version)
    return parsed ? parsed.major : null
  }

  /**
   * Get minor version
   */
  minor(version: string): number | null {
    const parsed = this.parse(version)
    return parsed ? parsed.minor : null
  }

  /**
   * Get patch version
   */
  patch(version: string): number | null {
    const parsed = this.parse(version)
    return parsed ? parsed.patch : null
  }

  /**
   * Get prerelease tags
   */
  prerelease(version: string): ReadonlyArray<string | number> | null {
    try {
      return semver.prerelease(version)
    } catch (error) {
      return null
    }
  }

  /**
   * Increment version by release type
   */
  inc(version: string, release: semver.ReleaseType): string | null {
    try {
      return semver.inc(version, release)
    } catch (error) {
      return null
    }
  }

  /**
   * Clean version string (remove prefix like 'v')
   */
  clean(version: string): string | null {
    try {
      return semver.clean(version)
    } catch (error) {
      return null
    }
  }

  /**
   * Coerce version string to valid semver
   */
  coerce(version: string): semver.SemVer | null {
    try {
      return semver.coerce(version)
    } catch (error) {
      return null
    }
  }

  /**
   * Check if versions are compatible (same major version)
   */
  areCompatible(v1: string, v2: string): boolean {
    const major1 = this.major(v1)
    const major2 = this.major(v2)

    if (major1 === null || major2 === null) {
      return false
    }

    // Major version 0 is special - treat as incompatible
    if (major1 === 0 || major2 === 0) {
      return v1 === v2
    }

    return major1 === major2
  }

  /**
   * Find conflicts in dependency versions
   */
  findConflicts(
    dependencies: Map<string, string[]>
  ): Array<{ package: string; versions: string[] }> {
    const conflicts: Array<{ package: string; versions: string[] }> = []

    for (const [pkg, versions] of dependencies.entries()) {
      if (versions.length > 1) {
        // Check if all versions are compatible
        const uniqueMajors = new Set(
          versions.map((v) => this.major(v)).filter((m) => m !== null)
        )

        if (uniqueMajors.size > 1 || uniqueMajors.has(0)) {
          conflicts.push({ package: pkg, versions })
        }
      }
    }

    return conflicts
  }

  /**
   * Suggest resolution for version conflict
   */
  suggestResolution(versions: string[]): string | null {
    if (versions.length === 0) {
      return null
    }

    // Try to find a version that all ranges might satisfy
    const validVersions = versions.filter((v) => this.isValid(v))

    if (validVersions.length === 0) {
      return null
    }

    // Return highest version
    return validVersions.sort((a, b) => this.compare(b, a))[0]
  }

  /**
   * Parse caret range (^)
   * ^1.2.3 := >=1.2.3 <2.0.0
   */
  parseCaretRange(version: string): { min: string; max: string } | null {
    const parsed = this.parse(version)
    if (!parsed) {
      return null
    }

    const min = version
    const max = `${parsed.major + 1}.0.0`

    return { min, max }
  }

  /**
   * Parse tilde range (~)
   * ~1.2.3 := >=1.2.3 <1.3.0
   */
  parseTildeRange(version: string): { min: string; max: string } | null {
    const parsed = this.parse(version)
    if (!parsed) {
      return null
    }

    const min = version
    const max = `${parsed.major}.${parsed.minor + 1}.0`

    return { min, max }
  }

  /**
   * Get version diff type
   */
  diff(v1: string, v2: string): semver.ReleaseType | null {
    try {
      return semver.diff(v1, v2)
    } catch (error) {
      return null
    }
  }

  /**
   * Sort versions in ascending order
   */
  sort(versions: string[]): string[] {
    return [...versions].sort((a, b) => this.compare(a, b))
  }

  /**
   * Sort versions in descending order
   */
  rsort(versions: string[]): string[] {
    return [...versions].sort((a, b) => this.compare(b, a))
  }
}

/**
 * Create semver engine
 */
export function createSemverEngine(): SemverEngine {
  return new SemverEngine()
}
