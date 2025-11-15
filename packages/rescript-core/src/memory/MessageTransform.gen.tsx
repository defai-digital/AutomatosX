/* TypeScript file generated from MessageTransform.res by genType. */

/* eslint-disable */
/* tslint:disable */

// @ts-ignore
import * as MessageTransformJS from './MessageTransform.bs.js';

// @ts-ignore
import type {Json_t as Js_Json_t} from './Js.gen';

import type {messageRole as HybridSearchTypes_messageRole} from './HybridSearchTypes.gen';

import type {message as HybridSearchTypes_message} from './HybridSearchTypes.gen';

import type {vectorResult as HybridSearchTypes_vectorResult} from './HybridSearchTypes.gen';

export type dbMessageRow = {
  readonly id: string; 
  readonly conversationId: string; 
  readonly role: string; 
  readonly content: string; 
  readonly tokens: (null | undefined | number); 
  readonly metadata: (null | undefined | Js_Json_t); 
  readonly createdAt: number; 
  readonly updatedAt: number
};

export type dbVectorRow = { readonly messageId: string; readonly distance: number };

export const messageFromDb: (row:dbMessageRow) => (undefined | HybridSearchTypes_message) = MessageTransformJS.messageFromDb as any;

export const vectorResultFromDb: (row:dbVectorRow) => HybridSearchTypes_vectorResult = MessageTransformJS.vectorResultFromDb as any;

export const messagesFromDb: (rows:dbMessageRow[]) => HybridSearchTypes_message[] = MessageTransformJS.messagesFromDb as any;

export const vectorResultsFromDb: (rows:dbVectorRow[]) => HybridSearchTypes_vectorResult[] = MessageTransformJS.vectorResultsFromDb as any;

export const messageToDb: (msg:HybridSearchTypes_message) => dbMessageRow = MessageTransformJS.messageToDb as any;

export const parseMetadata: (jsonStr:string) => (undefined | Js_Json_t) = MessageTransformJS.parseMetadata as any;

export const stringifyMetadata: (json:Js_Json_t) => string = MessageTransformJS.stringifyMetadata as any;

export const getStringField: (json:Js_Json_t, field:string) => (undefined | string) = MessageTransformJS.getStringField as any;

export const getIntField: (json:Js_Json_t, field:string) => (undefined | number) = MessageTransformJS.getIntField as any;

export const validateMessage: (msg:HybridSearchTypes_message) => boolean = MessageTransformJS.validateMessage as any;

export const validateTimestamps: (msg:HybridSearchTypes_message) => boolean = MessageTransformJS.validateTimestamps as any;

export const isValidMessage: (msg:HybridSearchTypes_message) => boolean = MessageTransformJS.isValidMessage as any;

export const createMessage: (id:string, conversationId:string, role:HybridSearchTypes_messageRole, content:string, tokens:(undefined | (undefined | number)), metadata:(undefined | (undefined | Js_Json_t)), _7:void) => HybridSearchTypes_message = MessageTransformJS.createMessage as any;

export const updateMessage: (msg:HybridSearchTypes_message, content:(undefined | (undefined | string)), tokens:(undefined | (undefined | number)), metadata:(undefined | (undefined | Js_Json_t)), _5:void) => HybridSearchTypes_message = MessageTransformJS.updateMessage as any;
