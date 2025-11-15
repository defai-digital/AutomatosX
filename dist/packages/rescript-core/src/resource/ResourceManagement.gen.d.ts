import type { ref as PervasivesU_ref } from './PervasivesU.gen';
import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type resource<a> = {
    readonly value: a;
    readonly cleanup: () => void;
    readonly isReleased: PervasivesU_ref<boolean>;
    readonly acquiredAt: number;
};
export type resourcePool<a> = {
    readonly available: PervasivesU_ref<resource<a>[]>;
    readonly inUse: PervasivesU_ref<resource<a>[]>;
    readonly maxSize: number;
    readonly factory: () => ErrorHandling_result<a, string>;
    readonly cleanup: (_1: a) => void;
};
export type poolStats = {
    readonly available: number;
    readonly inUse: number;
    readonly total: number;
    readonly capacity: number;
    readonly utilizationPercent: number;
};
export type fileHandle = {
    readonly path: string;
    readonly fd: number;
};
export type dbConnection = {
    readonly connectionString: string;
    readonly isConnected: PervasivesU_ref<boolean>;
};
export type socket = {
    readonly host: string;
    readonly port: number;
    readonly isOpen: PervasivesU_ref<boolean>;
};
export declare const acquireResource: <a>(acquire: (() => ErrorHandling_result<a, string>), cleanup: ((_1: a) => void)) => ErrorHandling_result<resource<a>, string>;
export declare const releaseResource: <a>(resource: resource<a>) => void;
export declare const isResourceActive: <a>(resource: resource<a>) => boolean;
export declare const getResourceAge: <a>(resource: resource<a>) => number;
export declare const withResource: <a, b>(acquire: (() => ErrorHandling_result<a, string>), cleanup: ((_1: a) => void), use: ((_1: a) => ErrorHandling_result<b, string>)) => ErrorHandling_result<b, string>;
export declare const withResources2: <a, b, c>(acquire1: (() => ErrorHandling_result<a, string>), cleanup1: ((_1: a) => void), acquire2: (() => ErrorHandling_result<b, string>), cleanup2: ((_1: b) => void), use: ((_1: a, _2: b) => ErrorHandling_result<c, string>)) => ErrorHandling_result<c, string>;
export declare const withResources3: <a, b, c, d>(acquire1: (() => ErrorHandling_result<a, string>), cleanup1: ((_1: a) => void), acquire2: (() => ErrorHandling_result<b, string>), cleanup2: ((_1: b) => void), acquire3: (() => ErrorHandling_result<c, string>), cleanup3: ((_1: c) => void), use: ((_1: a, _2: b, _3: c) => ErrorHandling_result<d, string>)) => ErrorHandling_result<d, string>;
export declare const createPool: <a>(maxSize: (undefined | number), factory: (() => ErrorHandling_result<a, string>), cleanup: ((_1: a) => void)) => resourcePool<a>;
export declare const borrowFromPool: <a>(pool: resourcePool<a>) => ErrorHandling_result<resource<a>, string>;
export declare const returnToPool: <a>(pool: resourcePool<a>, resource: resource<a>) => void;
export declare const withPooledResource: <a, b>(pool: resourcePool<a>, use: ((_1: a) => ErrorHandling_result<b, string>)) => ErrorHandling_result<b, string>;
export declare const drainPool: <a>(pool: resourcePool<a>) => void;
export declare const getPoolStats: <a>(pool: resourcePool<a>) => poolStats;
export declare const createFileResource: (path: string) => ErrorHandling_result<fileHandle, string>;
export declare const cleanupFileResource: (file: fileHandle) => void;
export declare const createDbConnection: (connString: string) => ErrorHandling_result<dbConnection, string>;
export declare const cleanupDbConnection: (conn: dbConnection) => void;
export declare const createSocket: (host: string, port: number) => ErrorHandling_result<socket, string>;
export declare const cleanupSocket: (socket: socket) => void;
export declare const withResourceAsync: <a, b>(acquire: (() => Promise<ErrorHandling_result<a, string>>), cleanup: ((_1: a) => Promise<void>), use: ((_1: a) => Promise<ErrorHandling_result<b, string>>)) => Promise<ErrorHandling_result<b, string>>;
//# sourceMappingURL=ResourceManagement.gen.d.ts.map