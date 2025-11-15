/* TypeScript file generated from ErrorHandling.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as ErrorHandlingJS from './ErrorHandling.bs.js';

import type {Promise_error as Js_Promise_error} from './Js.gen';

export type result<ok,err> = 
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err };

export type daoError = 
    { TAG: "NotFound"; _0: string }
  | { TAG: "DatabaseError"; _0: string }
  | { TAG: "ValidationError"; _0: string }
  | { TAG: "ConnectionError"; _0: string }
  | { TAG: "TimeoutError"; _0: number }
  | { TAG: "ConstraintViolation"; _0: string };

export type networkError = 
    "Unauthorized"
  | "Forbidden"
  | { TAG: "RequestFailed"; _0: number; _1: string }
  | { TAG: "NetworkTimeout"; _0: number }
  | { TAG: "InvalidResponse"; _0: string }
  | { TAG: "RateLimited"; _0: number };

export type validationError = 
    { TAG: "MissingField"; _0: string }
  | { TAG: "InvalidFormat"; _0: string; _1: string }
  | { TAG: "OutOfRange"; _0: string; _1: number; _2: number }
  | { TAG: "TooLong"; _0: string; _1: number; _2: number }
  | { TAG: "TooShort"; _0: string; _1: number; _2: number };

export type appError = 
    { TAG: "DaoError"; _0: daoError }
  | { TAG: "NetworkError"; _0: networkError }
  | { TAG: "ValidationError"; _0: validationError }
  | { TAG: "BusinessLogicError"; _0: string }
  | { TAG: "ConfigurationError"; _0: string }
  | { TAG: "UnknownError"; _0: string };

export type recoveryStrategy<ok,err> = 
    "FailFast"
  | { TAG: "Retry"; _0: number }
  | { TAG: "Fallback"; _0: ok }
  | { TAG: "FallbackFn"; _0: () => 
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err } }
  | { TAG: "Ignore"; _0: ok };

export const isOk: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }) => boolean = ErrorHandlingJS.isOk as any;

export const isError: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }) => boolean = ErrorHandlingJS.isError as any;

export const getOr: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, defaultValue:ok) => ok = ErrorHandlingJS.getOr as any;

export const getOrElse: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, fn:(() => ok)) => ok = ErrorHandlingJS.getOrElse as any;

export const getErrorOr: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, defaultValue:err) => err = ErrorHandlingJS.getErrorOr as any;

export const map: <b,err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, fn:((_1:ok) => b)) => 
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.map as any;

export const mapError: <e,err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, fn:((_1:err) => e)) => 
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: e } = ErrorHandlingJS.mapError as any;

export const flatMap: <b,err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, fn:((_1:ok) => 
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err })) => 
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.flatMap as any;

export const chain: <T1,T2,T3>(_1:
    { TAG: "Ok"; _0: T1 }
  | { TAG: "Error"; _0: T2 }, _2:((_1:T1) => 
    { TAG: "Ok"; _0: T3 }
  | { TAG: "Error"; _0: T2 })) => 
    { TAG: "Ok"; _0: T3 }
  | { TAG: "Error"; _0: T2 } = ErrorHandlingJS.chain as any;

export const apply: <b,err,ok>(resultFn:
    { TAG: "Ok"; _0: ((_1:ok) => b) }
  | { TAG: "Error"; _0: err }, resultValue:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }) => 
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.apply as any;

export const fromOption: <err,ok>(opt:(undefined | ok), error:err) => 
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.fromOption as any;

export const toOption: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }) => (undefined | ok) = ErrorHandlingJS.toOption as any;

export const recover: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }, strategy:recoveryStrategy<ok,err>) => 
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.recover as any;

export const fromPromise: <err,ok>(promise:Promise<ok>, onError:((_1:Js_Promise_error) => err)) => Promise<
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }> = ErrorHandlingJS.fromPromise as any;

export const toPromise: <err,ok>(result:
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }) => Promise<ok> = ErrorHandlingJS.toPromise as any;

export const combine2: <a,b,err>(r1:
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: err }, r2:
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err }) => 
    { TAG: "Ok"; _0: a; _1: b }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.combine2 as any;

export const combine3: <a,b,c,err>(r1:
    { TAG: "Ok"; _0: a }
  | { TAG: "Error"; _0: err }, r2:
    { TAG: "Ok"; _0: b }
  | { TAG: "Error"; _0: err }, r3:
    { TAG: "Ok"; _0: c }
  | { TAG: "Error"; _0: err }) => 
    { TAG: "Ok"; _0: a; _1: b; _2: c }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.combine3 as any;

export const combineArray: <err,ok>(results:Array<
    { TAG: "Ok"; _0: ok }
  | { TAG: "Error"; _0: err }>) => 
    { TAG: "Ok"; _0: ok[] }
  | { TAG: "Error"; _0: err } = ErrorHandlingJS.combineArray as any;

export const daoErrorToAppError: (err:daoError) => appError = ErrorHandlingJS.daoErrorToAppError as any;

export const networkErrorToAppError: (err:networkError) => appError = ErrorHandlingJS.networkErrorToAppError as any;

export const validationErrorToAppError: (err:validationError) => appError = ErrorHandlingJS.validationErrorToAppError as any;

export const daoErrorToString: (err:daoError) => string = ErrorHandlingJS.daoErrorToString as any;

export const networkErrorToString: (err:networkError) => string = ErrorHandlingJS.networkErrorToString as any;

export const validationErrorToString: (err:validationError) => string = ErrorHandlingJS.validationErrorToString as any;

export const appErrorToString: (err:appError) => string = ErrorHandlingJS.appErrorToString as any;
