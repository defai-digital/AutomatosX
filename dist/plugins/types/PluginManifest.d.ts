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
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    optional: boolean;
}, {
    name: string;
    version: string;
    optional?: boolean | undefined;
}>;
export type DependencySpec = z.infer<typeof DependencySpecSchema>;
/**
 * Plugin permissions
 */
export declare const PluginPermissionsSchema: z.ZodObject<{
    filesystem: z.ZodOptional<z.ZodObject<{
        read: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        write: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        write?: string[] | undefined;
        read?: string[] | undefined;
    }, {
        write?: string[] | undefined;
        read?: string[] | undefined;
    }>>;
    network: z.ZodOptional<z.ZodObject<{
        allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allowedDomains?: string[] | undefined;
    }, {
        allowedDomains?: string[] | undefined;
    }>>;
    memory: z.ZodOptional<z.ZodObject<{
        maxMB: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxMB?: number | undefined;
    }, {
        maxMB?: number | undefined;
    }>>;
    runtime: z.ZodOptional<z.ZodObject<{
        canSpawnProcess: z.ZodDefault<z.ZodBoolean>;
        canAccessEnv: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        canSpawnProcess: boolean;
        canAccessEnv: boolean;
    }, {
        canSpawnProcess?: boolean | undefined;
        canAccessEnv?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    memory?: {
        maxMB?: number | undefined;
    } | undefined;
    network?: {
        allowedDomains?: string[] | undefined;
    } | undefined;
    runtime?: {
        canSpawnProcess: boolean;
        canAccessEnv: boolean;
    } | undefined;
    filesystem?: {
        write?: string[] | undefined;
        read?: string[] | undefined;
    } | undefined;
}, {
    memory?: {
        maxMB?: number | undefined;
    } | undefined;
    network?: {
        allowedDomains?: string[] | undefined;
    } | undefined;
    runtime?: {
        canSpawnProcess?: boolean | undefined;
        canAccessEnv?: boolean | undefined;
    } | undefined;
    filesystem?: {
        write?: string[] | undefined;
        read?: string[] | undefined;
    } | undefined;
}>;
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
    dependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    optionalDependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    peerDependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    permissions: z.ZodDefault<z.ZodObject<{
        filesystem: z.ZodOptional<z.ZodObject<{
            read: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            write: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            write?: string[] | undefined;
            read?: string[] | undefined;
        }, {
            write?: string[] | undefined;
            read?: string[] | undefined;
        }>>;
        network: z.ZodOptional<z.ZodObject<{
            allowedDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            allowedDomains?: string[] | undefined;
        }, {
            allowedDomains?: string[] | undefined;
        }>>;
        memory: z.ZodOptional<z.ZodObject<{
            maxMB: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            maxMB?: number | undefined;
        }, {
            maxMB?: number | undefined;
        }>>;
        runtime: z.ZodOptional<z.ZodObject<{
            canSpawnProcess: z.ZodDefault<z.ZodBoolean>;
            canAccessEnv: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            canSpawnProcess: boolean;
            canAccessEnv: boolean;
        }, {
            canSpawnProcess?: boolean | undefined;
            canAccessEnv?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        memory?: {
            maxMB?: number | undefined;
        } | undefined;
        network?: {
            allowedDomains?: string[] | undefined;
        } | undefined;
        runtime?: {
            canSpawnProcess: boolean;
            canAccessEnv: boolean;
        } | undefined;
        filesystem?: {
            write?: string[] | undefined;
            read?: string[] | undefined;
        } | undefined;
    }, {
        memory?: {
            maxMB?: number | undefined;
        } | undefined;
        network?: {
            allowedDomains?: string[] | undefined;
        } | undefined;
        runtime?: {
            canSpawnProcess?: boolean | undefined;
            canAccessEnv?: boolean | undefined;
        } | undefined;
        filesystem?: {
            write?: string[] | undefined;
            read?: string[] | undefined;
        } | undefined;
    }>>;
    engines: z.ZodDefault<z.ZodObject<{
        automatosx: z.ZodOptional<z.ZodString>;
        node: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        node?: string | undefined;
        automatosx?: string | undefined;
    }, {
        node?: string | undefined;
        automatosx?: string | undefined;
    }>>;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    keywords: string[];
    main: string;
    license: string;
    optionalDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    permissions: {
        memory?: {
            maxMB?: number | undefined;
        } | undefined;
        network?: {
            allowedDomains?: string[] | undefined;
        } | undefined;
        runtime?: {
            canSpawnProcess: boolean;
            canAccessEnv: boolean;
        } | undefined;
        filesystem?: {
            write?: string[] | undefined;
            read?: string[] | undefined;
        } | undefined;
    };
    engines: {
        node?: string | undefined;
        automatosx?: string | undefined;
    };
    description?: string | undefined;
    author?: string | undefined;
    repository?: string | undefined;
    homepage?: string | undefined;
}, {
    name: string;
    version: string;
    description?: string | undefined;
    dependencies?: Record<string, string> | undefined;
    keywords?: string[] | undefined;
    author?: string | undefined;
    repository?: string | undefined;
    main?: string | undefined;
    license?: string | undefined;
    homepage?: string | undefined;
    optionalDependencies?: Record<string, string> | undefined;
    peerDependencies?: Record<string, string> | undefined;
    permissions?: {
        memory?: {
            maxMB?: number | undefined;
        } | undefined;
        network?: {
            allowedDomains?: string[] | undefined;
        } | undefined;
        runtime?: {
            canSpawnProcess?: boolean | undefined;
            canAccessEnv?: boolean | undefined;
        } | undefined;
        filesystem?: {
            write?: string[] | undefined;
            read?: string[] | undefined;
        } | undefined;
    } | undefined;
    engines?: {
        node?: string | undefined;
        automatosx?: string | undefined;
    } | undefined;
}>;
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
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    verified: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    rating: number;
    license: string;
    downloads: number;
    verified: boolean;
    description?: string | undefined;
    author?: string | undefined;
}, {
    name: string;
    version: string;
    createdAt: string;
    updatedAt: string;
    description?: string | undefined;
    tags?: string[] | undefined;
    author?: string | undefined;
    rating?: number | undefined;
    license?: string | undefined;
    downloads?: number | undefined;
    verified?: boolean | undefined;
}>;
export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;
//# sourceMappingURL=PluginManifest.d.ts.map