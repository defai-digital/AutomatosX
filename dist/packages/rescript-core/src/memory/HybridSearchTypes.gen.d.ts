import type { Json_t as Js_Json_t } from './Js.gen';
import type { seconds as Timestamp_seconds } from './Timestamp.gen';
import type { t as Timestamp_t } from './Timestamp.gen';
export type messageRole = "user" | "assistant" | "system";
export type message = {
    readonly id: string;
    readonly conversationId: string;
    readonly role: messageRole;
    readonly content: string;
    readonly tokens: (undefined | number);
    readonly metadata: (undefined | Js_Json_t);
    readonly createdAt: Timestamp_t<Timestamp_seconds>;
    readonly updatedAt: Timestamp_t<Timestamp_seconds>;
};
export type vectorResult = {
    readonly messageId: string;
    readonly distance: number;
    readonly score: number;
};
export type searchResultSource = {
    TAG: "FtsOnly";
    _0: message;
} | {
    TAG: "VectorOnly";
    _0: vectorResult;
} | {
    TAG: "Hybrid";
    _0: message;
    _1: vectorResult;
};
export type searchResult = {
    readonly source: searchResultSource;
    readonly combinedScore: number;
    readonly message: (undefined | message);
    readonly vectorResult: (undefined | vectorResult);
};
export type searchWeights = {
    readonly fts: number;
    readonly vector: number;
    readonly recency: number;
};
export type searchOptions = {
    readonly conversationId: (undefined | string);
    readonly limit: number;
    readonly weights: searchWeights;
    readonly minScore: number;
};
export type searchQuery = {
    readonly query: string;
    readonly conversationId: (undefined | string);
    readonly options: searchOptions;
};
export declare const parseMessageRole: (str: string) => (undefined | messageRole);
export declare const messageRoleToString: (role: messageRole) => string;
export declare const getMessageFromResult: (result: searchResult) => (undefined | message);
export declare const getVectorFromResult: (result: searchResult) => (undefined | vectorResult);
export declare const isHybridResult: (result: searchResult) => boolean;
export declare const defaultWeights: searchWeights;
export declare const defaultSearchOptions: searchOptions;
export declare const makeSearchQuery: (query: string, conversationId: (undefined | (undefined | string)), options: (undefined | searchOptions), _4: void) => searchQuery;
export declare const isValidMessage: (msg: message) => boolean;
export declare const areWeightsValid: (weights: searchWeights) => boolean;
export declare const normalizeWeights: (weights: searchWeights) => searchWeights;
export declare const calculateRecencyScore: (timestamp: Timestamp_t<Timestamp_seconds>) => number;
export declare const combineScores: (ftsScore: (undefined | number), vectorScore: (undefined | number), recencyScore: number, weights: searchWeights) => number;
//# sourceMappingURL=HybridSearchTypes.gen.d.ts.map