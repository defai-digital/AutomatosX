/* TypeScript file generated from ValidationRules.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as ValidationRulesJS from './ValidationRules.bs.js';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export abstract class validated { protected opaque!: any }; /* simulate opaque types */

export abstract class unvalidated { protected opaque!: any }; /* simulate opaque types */

export type nonEmptyString<state> = string;

export type positiveInt<state> = number;

export type nonNegativeInt<state> = number;

export type validEmail<state> = string;

export type validUrl<state> = string;

export type validatedEmbedding<state> = {
  readonly dimensions: number; 
  readonly vector: number[]; 
  readonly model: string
};

export type nonEmptyArray<a,state> = a[];

export type boundedArray<a,state> = {
  readonly items: a[]; 
  readonly minSize: number; 
  readonly maxSize: number
};

export type rangedValue<state> = {
  readonly value: number; 
  readonly min: number; 
  readonly max: number
};

export type percentage<state> = number;

export type validationRule<a> = (_1:a) => ErrorHandling_result<void,string>;

export type validatedUser = {
  readonly id: nonEmptyString<validated>; 
  readonly email: validEmail<validated>; 
  readonly age: positiveInt<validated>
};

export type validatedMessage = {
  readonly id: nonEmptyString<validated>; 
  readonly content: nonEmptyString<validated>; 
  readonly embedding: (undefined | validatedEmbedding<validated>); 
  readonly tokens: nonNegativeInt<validated>
};

export const nonEmptyString: (s:string) => ErrorHandling_result<nonEmptyString<validated>,string> = ValidationRulesJS.nonEmptyString as any;

export const positiveInt: (n:number) => ErrorHandling_result<positiveInt<validated>,string> = ValidationRulesJS.positiveInt as any;

export const nonNegativeInt: (n:number) => ErrorHandling_result<nonNegativeInt<validated>,string> = ValidationRulesJS.nonNegativeInt as any;

export const validEmail: (email:string) => ErrorHandling_result<validEmail<validated>,string> = ValidationRulesJS.validEmail as any;

export const validUrl: (url:string) => ErrorHandling_result<validUrl<validated>,string> = ValidationRulesJS.validUrl as any;

export const createUnvalidatedEmbedding: (dimensions:number, vector:number[], model:string) => validatedEmbedding<unvalidated> = ValidationRulesJS.createUnvalidatedEmbedding as any;

export const validateEmbedding: (embedding:validatedEmbedding<unvalidated>, expectedDimensions:number) => ErrorHandling_result<validatedEmbedding<validated>,string> = ValidationRulesJS.validateEmbedding as any;

export const getEmbeddingDimensions: (embedding:validatedEmbedding<validated>) => number = ValidationRulesJS.getEmbeddingDimensions as any;

export const getEmbeddingVector: (embedding:validatedEmbedding<validated>) => number[] = ValidationRulesJS.getEmbeddingVector as any;

export const storeEmbedding: (embedding:validatedEmbedding<validated>) => Promise<ErrorHandling_result<void,string>> = ValidationRulesJS.storeEmbedding as any;

export const nonEmptyArray: <a>(arr:a[]) => ErrorHandling_result<nonEmptyArray<a,validated>,string> = ValidationRulesJS.nonEmptyArray as any;

export const boundedArray: <a>(arr:a[], minSize:number, maxSize:number) => ErrorHandling_result<boundedArray<a,validated>,string> = ValidationRulesJS.boundedArray as any;

export const rangedValue: (value:number, min:number, max:number) => ErrorHandling_result<rangedValue<validated>,string> = ValidationRulesJS.rangedValue as any;

export const getRangedValue: (ranged:rangedValue<validated>) => number = ValidationRulesJS.getRangedValue as any;

export const percentage: (value:number) => ErrorHandling_result<percentage<validated>,string> = ValidationRulesJS.percentage as any;

export const applyRule: <a>(value:a, rule:validationRule<a>) => ErrorHandling_result<a,string> = ValidationRulesJS.applyRule as any;

export const combineRules: <a>(value:a, rules:validationRule<a>[]) => ErrorHandling_result<a,string[]> = ValidationRulesJS.combineRules as any;

export const validateUser: (id:string, email:string, age:number) => ErrorHandling_result<validatedUser,string[]> = ValidationRulesJS.validateUser as any;

export const validateMessage: (id:string, content:string, embedding:(undefined | validatedEmbedding<validated>), tokens:number) => ErrorHandling_result<validatedMessage,string[]> = ValidationRulesJS.validateMessage as any;

export const unwrapString: (s:nonEmptyString<validated>) => string = ValidationRulesJS.unwrapString as any;

export const unwrapInt: (n:positiveInt<validated>) => number = ValidationRulesJS.unwrapInt as any;

export const unwrapEmail: (email:validEmail<validated>) => string = ValidationRulesJS.unwrapEmail as any;
