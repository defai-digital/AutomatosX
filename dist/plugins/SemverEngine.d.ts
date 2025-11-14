/**
 * Semantic Version Engine
 * Sprint 4 Day 32: Semver parsing, validation, and compatibility checking
 */
import * as semver from 'semver';
/**
 * Semver compatibility result
 */
export interface CompatibilityResult {
    compatible: boolean;
    reason?: string;
    satisfiedVersion?: string;
}
/**
 * Version range types
 */
export type VersionRange = string;
/**
 * Semantic Version Engine
 */
export declare class SemverEngine {
    /**
     * Parse and validate semantic version
     */
    parse(version: string): semver.SemVer | null;
    /**
     * Validate if string is valid semver
     */
    isValid(version: string): boolean;
    /**
     * Check if version satisfies range
     */
    satisfies(version: string, range: VersionRange): boolean;
    /**
     * Check compatibility between version and range
     */
    checkCompatibility(version: string, range: VersionRange): CompatibilityResult;
    /**
     * Get highest version that satisfies range from list
     */
    maxSatisfying(versions: string[], range: VersionRange): string | null;
    /**
     * Get minimum version that satisfies range from list
     */
    minSatisfying(versions: string[], range: VersionRange): string | null;
    /**
     * Compare two versions
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    compare(v1: string, v2: string): number;
    /**
     * Check if version is greater than another
     */
    gt(v1: string, v2: string): boolean;
    /**
     * Check if version is less than another
     */
    lt(v1: string, v2: string): boolean;
    /**
     * Check if version equals another
     */
    eq(v1: string, v2: string): boolean;
    /**
     * Get major version
     */
    major(version: string): number | null;
    /**
     * Get minor version
     */
    minor(version: string): number | null;
    /**
     * Get patch version
     */
    patch(version: string): number | null;
    /**
     * Get prerelease tags
     */
    prerelease(version: string): ReadonlyArray<string | number> | null;
    /**
     * Increment version by release type
     */
    inc(version: string, release: semver.ReleaseType): string | null;
    /**
     * Clean version string (remove prefix like 'v')
     */
    clean(version: string): string | null;
    /**
     * Coerce version string to valid semver
     */
    coerce(version: string): semver.SemVer | null;
    /**
     * Check if versions are compatible (same major version)
     */
    areCompatible(v1: string, v2: string): boolean;
    /**
     * Find conflicts in dependency versions
     */
    findConflicts(dependencies: Map<string, string[]>): Array<{
        package: string;
        versions: string[];
    }>;
    /**
     * Suggest resolution for version conflict
     */
    suggestResolution(versions: string[]): string | null;
    /**
     * Parse caret range (^)
     * ^1.2.3 := >=1.2.3 <2.0.0
     */
    parseCaretRange(version: string): {
        min: string;
        max: string;
    } | null;
    /**
     * Parse tilde range (~)
     * ~1.2.3 := >=1.2.3 <1.3.0
     */
    parseTildeRange(version: string): {
        min: string;
        max: string;
    } | null;
    /**
     * Get version diff type
     */
    diff(v1: string, v2: string): semver.ReleaseType | null;
    /**
     * Sort versions in ascending order
     */
    sort(versions: string[]): string[];
    /**
     * Sort versions in descending order
     */
    rsort(versions: string[]): string[];
}
/**
 * Create semver engine
 */
export declare function createSemverEngine(): SemverEngine;
//# sourceMappingURL=SemverEngine.d.ts.map