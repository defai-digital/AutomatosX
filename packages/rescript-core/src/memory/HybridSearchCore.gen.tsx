/* TypeScript file generated from HybridSearchCore.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as HybridSearchCoreJS from './HybridSearchCore.bs.js';

import type {message as HybridSearchTypes_message} from './HybridSearchTypes.gen';

import type {searchOptions as HybridSearchTypes_searchOptions} from './HybridSearchTypes.gen';

import type {searchResult as HybridSearchTypes_searchResult} from './HybridSearchTypes.gen';

import type {searchWeights as HybridSearchTypes_searchWeights} from './HybridSearchTypes.gen';

import type {vectorResult as HybridSearchTypes_vectorResult} from './HybridSearchTypes.gen';

export type resultStats = {
  readonly total: number; 
  readonly hybrid: number; 
  readonly ftsOnly: number; 
  readonly vectorOnly: number; 
  readonly avgScore: number
};

export const combineResults: (ftsResults:HybridSearchTypes_message[], vectorResults:HybridSearchTypes_vectorResult[], weights:HybridSearchTypes_searchWeights) => HybridSearchTypes_searchResult[] = HybridSearchCoreJS.combineResults as any;

export const filterByScore: (results:HybridSearchTypes_searchResult[], minScore:number) => HybridSearchTypes_searchResult[] = HybridSearchCoreJS.filterByScore as any;

export const sortByScore: (results:HybridSearchTypes_searchResult[]) => HybridSearchTypes_searchResult[] = HybridSearchCoreJS.sortByScore as any;

export const applyLimit: (results:HybridSearchTypes_searchResult[], limit:number) => HybridSearchTypes_searchResult[] = HybridSearchCoreJS.applyLimit as any;

export const processResults: (ftsResults:HybridSearchTypes_message[], vectorResults:HybridSearchTypes_vectorResult[], options:HybridSearchTypes_searchOptions) => HybridSearchTypes_searchResult[] = HybridSearchCoreJS.processResults as any;

export const extractMessages: (results:HybridSearchTypes_searchResult[]) => HybridSearchTypes_message[] = HybridSearchCoreJS.extractMessages as any;

export const getResultStats: (results:HybridSearchTypes_searchResult[]) => resultStats = HybridSearchCoreJS.getResultStats as any;
