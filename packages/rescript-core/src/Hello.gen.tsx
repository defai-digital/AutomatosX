/* TypeScript file generated from Hello.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as HelloJS from './Hello.bs.js';

export type person = { readonly name: string; readonly age: number };

export const greet: (name:string) => string = HelloJS.greet as any;

export const add: (a:number, b:number) => number = HelloJS.add as any;

export const getGreetingOrDefault: (name:(undefined | string)) => string = HelloJS.getGreetingOrDefault as any;

export const greetPerson: (person:person) => string = HelloJS.greetPerson as any;

export const welcomeMessage: string = HelloJS.welcomeMessage as any;
