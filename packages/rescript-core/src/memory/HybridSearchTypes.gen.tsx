/* TypeScript file generated from HybridSearchTypes.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as HybridSearchTypesJS from './HybridSearchTypes.bs.js';

import type {Json_t as Js_Json_t} from './Js.gen';

import type {seconds as Timestamp_seconds} from './Timestamp.gen';

import type {t as Timestamp_t} from './Timestamp.gen';

export type messageRole = "user" | "assistant" | "system";

export type message = {
  readonly id: string; 
  readonly conversationId: string; 
  readonly role: messageRole; 
  readonly content: string; 
  readonly tokens: (undefined | number); 
  readonly metadata: (undefined | Js_Json_t); 
  readonly createdAt: Timestamp_t<Timestamp_seconds>; 
  readonly updatedAt: Timestamp_t<Timestamp_seconds>
};

export type vectorResult = {
  readonly messageId: string; 
  readonly distance: number; 
  readonly score: number
};

export type searchResultSource = 
    { TAG: "FtsOnly"; _0: message }
  | { TAG: "VectorOnly"; _0: vectorResult }
  | { TAG: "Hybrid"; _0: message; _1: vectorResult };

export type searchResult = {
  readonly source: searchResultSource; 
  readonly combinedScore: number; 
  readonly message: (undefined | message); 
  readonly vectorResult: (undefined | vectorResult)
};

export type searchWeights = {
  readonly fts: number; 
  readonly vector: number; 
  readonly recency: number
};

export type searchOptions = {
  readonly conversationId: (undefined | string); 
  readonly limit: number; 
  readonly weights: searchWeights; 
  readonly minScore: number
};

export type searchQuery = {
  readonly query: string; 
  readonly conversationId: (undefined | string); 
  readonly options: searchOptions
};

export const parseMessageRole: (str:string) => (undefined | messageRole) = HybridSearchTypesJS.parseMessageRole as any;

export const messageRoleToString: (role:messageRole) => string = HybridSearchTypesJS.messageRoleToString as any;

export const getMessageFromResult: (result:searchResult) => (undefined | message) = HybridSearchTypesJS.getMessageFromResult as any;

export const getVectorFromResult: (result:searchResult) => (undefined | vectorResult) = HybridSearchTypesJS.getVectorFromResult as any;

export const isHybridResult: (result:searchResult) => boolean = HybridSearchTypesJS.isHybridResult as any;

export const defaultWeights: searchWeights = HybridSearchTypesJS.defaultWeights as any;

export const defaultSearchOptions: searchOptions = HybridSearchTypesJS.defaultSearchOptions as any;

export const makeSearchQuery: (query:string, conversationId:(undefined | (undefined | string)), options:(undefined | searchOptions), _4:void) => searchQuery = HybridSearchTypesJS.makeSearchQuery as any;

export const isValidMessage: (msg:message) => boolean = HybridSearchTypesJS.isValidMessage as any;

export const areWeightsValid: (weights:searchWeights) => boolean = HybridSearchTypesJS.areWeightsValid as any;

export const normalizeWeights: (weights:searchWeights) => searchWeights = HybridSearchTypesJS.normalizeWeights as any;

export const calculateRecencyScore: (timestamp:Timestamp_t<Timestamp_seconds>) => number = HybridSearchTypesJS.calculateRecencyScore as any;

export const combineScores: (ftsScore:(undefined | number), vectorScore:(undefined | number), recencyScore:number, weights:searchWeights) => number = HybridSearchTypesJS.combineScores as any;
