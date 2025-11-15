/* TypeScript file generated from Timestamp.res by genType. */

/* eslint-disable */
/* tslint:disable */

// @ts-ignore
import * as TimestampJS from './Timestamp.bs.js';

export abstract class milliseconds { protected opaque!: any }; /* simulate opaque types */

export abstract class seconds { protected opaque!: any }; /* simulate opaque types */

export type t<unit> = number;

export const fromMilliseconds: (ms:number) => t<milliseconds> = TimestampJS.fromMilliseconds as any;

export const fromSeconds: (sec:number) => t<seconds> = TimestampJS.fromSeconds as any;

export const nowMilliseconds: () => t<milliseconds> = TimestampJS.nowMilliseconds as any;

export const nowSeconds: () => t<seconds> = TimestampJS.nowSeconds as any;

export const millisecondsToSeconds: (ms:t<milliseconds>) => t<seconds> = TimestampJS.millisecondsToSeconds as any;

export const secondsToMilliseconds: (sec:t<seconds>) => t<milliseconds> = TimestampJS.secondsToMilliseconds as any;

export const compareSeconds: (a:t<seconds>, b:t<seconds>) => number = TimestampJS.compareSeconds as any;

export const compareMilliseconds: (a:t<milliseconds>, b:t<milliseconds>) => number = TimestampJS.compareMilliseconds as any;

export const Seconds_add: (a:t<seconds>, b:t<seconds>) => t<seconds> = TimestampJS.Seconds.add as any;

export const Seconds_subtract: (a:t<seconds>, b:t<seconds>) => t<seconds> = TimestampJS.Seconds.subtract as any;

export const Seconds_toInt: (ts:t<seconds>) => number = TimestampJS.Seconds.toInt as any;

export const Seconds_fromInt: (i:number) => t<seconds> = TimestampJS.Seconds.fromInt as any;

export const Milliseconds_add: (a:t<milliseconds>, b:t<milliseconds>) => t<milliseconds> = TimestampJS.Milliseconds.add as any;

export const Milliseconds_subtract: (a:t<milliseconds>, b:t<milliseconds>) => t<milliseconds> = TimestampJS.Milliseconds.subtract as any;

export const Milliseconds_toInt: (ts:t<milliseconds>) => number = TimestampJS.Milliseconds.toInt as any;

export const Milliseconds_fromInt: (i:number) => t<milliseconds> = TimestampJS.Milliseconds.fromInt as any;

export const toDbInt: (ts:t<seconds>) => number = TimestampJS.toDbInt as any;

export const fromDbInt: (i:number) => t<seconds> = TimestampJS.fromDbInt as any;

export const toJsDate: (ts:t<seconds>) => Date = TimestampJS.toJsDate as any;

export const fromJsDate: (date:Date) => t<seconds> = TimestampJS.fromJsDate as any;

export const isValidSeconds: (ts:t<seconds>) => boolean = TimestampJS.isValidSeconds as any;

export const isValidMilliseconds: (ts:t<milliseconds>) => boolean = TimestampJS.isValidMilliseconds as any;

export const toIsoString: (ts:t<seconds>) => string = TimestampJS.toIsoString as any;

export const Milliseconds: {
  subtract: (a:t<milliseconds>, b:t<milliseconds>) => t<milliseconds>; 
  toInt: (ts:t<milliseconds>) => number; 
  add: (a:t<milliseconds>, b:t<milliseconds>) => t<milliseconds>; 
  fromInt: (i:number) => t<milliseconds>
} = TimestampJS.Milliseconds as any;

export const Seconds: {
  subtract: (a:t<seconds>, b:t<seconds>) => t<seconds>; 
  toInt: (ts:t<seconds>) => number; 
  add: (a:t<seconds>, b:t<seconds>) => t<seconds>; 
  fromInt: (i:number) => t<seconds>
} = TimestampJS.Seconds as any;
