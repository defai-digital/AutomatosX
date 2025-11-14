import type { message as HybridSearchTypes_message } from './HybridSearchTypes.gen';
import type { searchOptions as HybridSearchTypes_searchOptions } from './HybridSearchTypes.gen';
import type { searchResult as HybridSearchTypes_searchResult } from './HybridSearchTypes.gen';
import type { searchWeights as HybridSearchTypes_searchWeights } from './HybridSearchTypes.gen';
import type { vectorResult as HybridSearchTypes_vectorResult } from './HybridSearchTypes.gen';
export type resultStats = {
    readonly total: number;
    readonly hybrid: number;
    readonly ftsOnly: number;
    readonly vectorOnly: number;
    readonly avgScore: number;
};
export declare const combineResults: (ftsResults: HybridSearchTypes_message[], vectorResults: HybridSearchTypes_vectorResult[], weights: HybridSearchTypes_searchWeights) => HybridSearchTypes_searchResult[];
export declare const filterByScore: (results: HybridSearchTypes_searchResult[], minScore: number) => HybridSearchTypes_searchResult[];
export declare const sortByScore: (results: HybridSearchTypes_searchResult[]) => HybridSearchTypes_searchResult[];
export declare const applyLimit: (results: HybridSearchTypes_searchResult[], limit: number) => HybridSearchTypes_searchResult[];
export declare const processResults: (ftsResults: HybridSearchTypes_message[], vectorResults: HybridSearchTypes_vectorResult[], options: HybridSearchTypes_searchOptions) => HybridSearchTypes_searchResult[];
export declare const extractMessages: (results: HybridSearchTypes_searchResult[]) => HybridSearchTypes_message[];
export declare const getResultStats: (results: HybridSearchTypes_searchResult[]) => resultStats;
//# sourceMappingURL=HybridSearchCore.gen.d.ts.map