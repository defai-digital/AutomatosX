/**
 * Plugin Manifest Types
 * Sprint 4 Day 31: Plugin manifest schema and validation
 */
import { z } from 'zod';
/**
 * Semantic version schema
 */
export declare const SemVerSchema: z.ZodString;
/**
 * Dependency specification
 */
export declare const DependencySpecSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    optional: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type DependencySpec = z.infer<typeof DependencySpecSchema>;
/**
 * Plugin permissions
 */
export declare const PluginPermissionsSchema: z.ZodObject<{
    filesystem: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodArray<z.ZodString>>;
        write: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    network: z.ZodOptional<z.ZodObject<{
        allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    memory: z.ZodOptional<z.ZodObject<{
        maxMB: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    runtime: z.ZodOptional<z.ZodObject<{
        canSpawnProcess: z.ZodDefault<z.ZodBoolean>;
        canAccessEnv: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PluginPermissions = z.infer<typeof PluginPermissionsSchema>;
/**
 * Plugin manifest
 */
export declare const PluginManifestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    license: z.ZodDefault<z.ZodString>;
    homepage: z.ZodOptional<z.ZodString>;
    repository: z.ZodOptional<z.ZodString>;
    main: z.ZodDefault<z.ZodString>;
    dependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.core.SomeType>>;
    optionalDependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.core.SomeType>>;
    peerDependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.core.SomeType>>;
    permissions: z.ZodDefault<z.ZodObject<{
        filesystem: z.ZodOptional<z.ZodObject<{
            read: z.ZodOptional<z.ZodArray<z.ZodString>>;
            write: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        network: z.ZodOptional<z.ZodObject<{
            allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        memory: z.ZodOptional<z.ZodObject<{
            maxMB: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        runtime: z.ZodOptional<z.ZodObject<{
            canSpawnProcess: z.ZodDefault<z.ZodBoolean>;
            canAccessEnv: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    engines: z.ZodDefault<z.ZodObject<{
        automatosx: z.ZodOptional<z.ZodString>;
        node: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
/**
 * Resolved dependency
 */
export interface ResolvedDependency {
    name: string;
    version: string;
    resolved: string;
    integrity: string;
    dependencies: Record<string, string>;
}
/**
 * Plugin metadata (registry)
 */
export declare const PluginMetadataSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    license: z.ZodDefault<z.ZodString>;
    downloads: z.ZodDefault<z.ZodNumber>;
    rating: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    verified: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;
//# sourceMappingURL=PluginManifest.d.ts.map