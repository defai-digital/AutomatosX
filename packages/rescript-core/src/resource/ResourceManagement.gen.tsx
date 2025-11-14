/* TypeScript file generated from ResourceManagement.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as ResourceManagementJS from './ResourceManagement.bs.js';

import type {ref as PervasivesU_ref} from './PervasivesU.gen';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type resource<a> = {
  readonly value: a; 
  readonly cleanup: () => void; 
  readonly isReleased: PervasivesU_ref<boolean>; 
  readonly acquiredAt: number
};

export type resourcePool<a> = {
  readonly available: PervasivesU_ref<resource<a>[]>; 
  readonly inUse: PervasivesU_ref<resource<a>[]>; 
  readonly maxSize: number; 
  readonly factory: () => ErrorHandling_result<a,string>; 
  readonly cleanup: (_1:a) => void
};

export type poolStats = {
  readonly available: number; 
  readonly inUse: number; 
  readonly total: number; 
  readonly capacity: number; 
  readonly utilizationPercent: number
};

export type fileHandle = { readonly path: string; readonly fd: number };

export type dbConnection = { readonly connectionString: string; readonly isConnected: PervasivesU_ref<boolean> };

export type socket = {
  readonly host: string; 
  readonly port: number; 
  readonly isOpen: PervasivesU_ref<boolean>
};

export const acquireResource: <a>(acquire:(() => ErrorHandling_result<a,string>), cleanup:((_1:a) => void)) => ErrorHandling_result<resource<a>,string> = ResourceManagementJS.acquireResource as any;

export const releaseResource: <a>(resource:resource<a>) => void = ResourceManagementJS.releaseResource as any;

export const isResourceActive: <a>(resource:resource<a>) => boolean = ResourceManagementJS.isResourceActive as any;

export const getResourceAge: <a>(resource:resource<a>) => number = ResourceManagementJS.getResourceAge as any;

export const withResource: <a,b>(acquire:(() => ErrorHandling_result<a,string>), cleanup:((_1:a) => void), use:((_1:a) => ErrorHandling_result<b,string>)) => ErrorHandling_result<b,string> = ResourceManagementJS.withResource as any;

export const withResources2: <a,b,c>(acquire1:(() => ErrorHandling_result<a,string>), cleanup1:((_1:a) => void), acquire2:(() => ErrorHandling_result<b,string>), cleanup2:((_1:b) => void), use:((_1:a, _2:b) => ErrorHandling_result<c,string>)) => ErrorHandling_result<c,string> = ResourceManagementJS.withResources2 as any;

export const withResources3: <a,b,c,d>(acquire1:(() => ErrorHandling_result<a,string>), cleanup1:((_1:a) => void), acquire2:(() => ErrorHandling_result<b,string>), cleanup2:((_1:b) => void), acquire3:(() => ErrorHandling_result<c,string>), cleanup3:((_1:c) => void), use:((_1:a, _2:b, _3:c) => ErrorHandling_result<d,string>)) => ErrorHandling_result<d,string> = ResourceManagementJS.withResources3 as any;

export const createPool: <a>(maxSize:(undefined | number), factory:(() => ErrorHandling_result<a,string>), cleanup:((_1:a) => void)) => resourcePool<a> = ResourceManagementJS.createPool as any;

export const borrowFromPool: <a>(pool:resourcePool<a>) => ErrorHandling_result<resource<a>,string> = ResourceManagementJS.borrowFromPool as any;

export const returnToPool: <a>(pool:resourcePool<a>, resource:resource<a>) => void = ResourceManagementJS.returnToPool as any;

export const withPooledResource: <a,b>(pool:resourcePool<a>, use:((_1:a) => ErrorHandling_result<b,string>)) => ErrorHandling_result<b,string> = ResourceManagementJS.withPooledResource as any;

export const drainPool: <a>(pool:resourcePool<a>) => void = ResourceManagementJS.drainPool as any;

export const getPoolStats: <a>(pool:resourcePool<a>) => poolStats = ResourceManagementJS.getPoolStats as any;

export const createFileResource: (path:string) => ErrorHandling_result<fileHandle,string> = ResourceManagementJS.createFileResource as any;

export const cleanupFileResource: (file:fileHandle) => void = ResourceManagementJS.cleanupFileResource as any;

export const createDbConnection: (connString:string) => ErrorHandling_result<dbConnection,string> = ResourceManagementJS.createDbConnection as any;

export const cleanupDbConnection: (conn:dbConnection) => void = ResourceManagementJS.cleanupDbConnection as any;

export const createSocket: (host:string, port:number) => ErrorHandling_result<socket,string> = ResourceManagementJS.createSocket as any;

export const cleanupSocket: (socket:socket) => void = ResourceManagementJS.cleanupSocket as any;

export const withResourceAsync: <a,b>(acquire:(() => Promise<ErrorHandling_result<a,string>>), cleanup:((_1:a) => Promise<void>), use:((_1:a) => Promise<ErrorHandling_result<b,string>>)) => Promise<ErrorHandling_result<b,string>> = ResourceManagementJS.withResourceAsync as any;
