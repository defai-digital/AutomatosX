/* TypeScript file generated from SafeMath.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as SafeMathJS from './SafeMath.bs.js';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type fixedPoint = { readonly value: number; readonly scale: number };

export const fromFloat: (value:number, scale:(undefined | number)) => fixedPoint = SafeMathJS.fromFloat as any;

export const toFloat: (fp:fixedPoint) => number = SafeMathJS.toFloat as any;

export const fromInt: (value:number, scale:(undefined | number)) => fixedPoint = SafeMathJS.fromInt as any;

export const toInt: (fp:fixedPoint) => number = SafeMathJS.toInt as any;

export const fromString: (str:string, scale:(undefined | number)) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.fromString as any;

export const toString: (fp:fixedPoint) => string = SafeMathJS.toString as any;

export const add: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.add as any;

export const subtract: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.subtract as any;

export const multiply: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.multiply as any;

export const divide: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.divide as any;

export const negate: (fp:fixedPoint) => fixedPoint = SafeMathJS.negate as any;

export const abs: (fp:fixedPoint) => fixedPoint = SafeMathJS.abs as any;

export const equal: (a:fixedPoint, b:fixedPoint) => boolean = SafeMathJS.equal as any;

export const lessThan: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<boolean,string> = SafeMathJS.lessThan as any;

export const lessThanOrEqual: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<boolean,string> = SafeMathJS.lessThanOrEqual as any;

export const greaterThan: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<boolean,string> = SafeMathJS.greaterThan as any;

export const greaterThanOrEqual: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<boolean,string> = SafeMathJS.greaterThanOrEqual as any;

export const compare: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<number,string> = SafeMathJS.compare as any;

export const min: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.min as any;

export const max: (a:fixedPoint, b:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.max as any;

export const clamp: (value:fixedPoint, min:fixedPoint, max:fixedPoint) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.clamp as any;

export const sumArray: (arr:fixedPoint[]) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.sumArray as any;

export const average: (arr:fixedPoint[]) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.average as any;

export const cosineSimilarity: (a:number[], b:number[], scale:(undefined | number)) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.cosineSimilarity as any;

export const dotProduct: (a:fixedPoint[], b:fixedPoint[]) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.dotProduct as any;

export const euclideanDistance: (a:number[], b:number[], scale:(undefined | number)) => ErrorHandling_result<fixedPoint,string> = SafeMathJS.euclideanDistance as any;

export const round: (fp:fixedPoint, decimals:number) => fixedPoint = SafeMathJS.round as any;

export const floor: (fp:fixedPoint) => fixedPoint = SafeMathJS.floor as any;

export const ceil: (fp:fixedPoint) => fixedPoint = SafeMathJS.ceil as any;

export const zero: fixedPoint = SafeMathJS.zero as any;

export const one: fixedPoint = SafeMathJS.one as any;

export const half: fixedPoint = SafeMathJS.half as any;

export const addFixed: (a:number, b:number) => number = SafeMathJS.addFixed as any;

export const subtractFixed: (a:number, b:number) => number = SafeMathJS.subtractFixed as any;

export const multiplyFixed: (a:number, b:number) => number = SafeMathJS.multiplyFixed as any;

export const divideFixed: (a:number, b:number) => ErrorHandling_result<number,string> = SafeMathJS.divideFixed as any;
