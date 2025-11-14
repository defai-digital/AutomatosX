import type { Json_t as Js_Json_t } from './Js.gen';
import type { messageRole as HybridSearchTypes_messageRole } from './HybridSearchTypes.gen';
import type { message as HybridSearchTypes_message } from './HybridSearchTypes.gen';
import type { vectorResult as HybridSearchTypes_vectorResult } from './HybridSearchTypes.gen';
export type dbMessageRow = {
    readonly id: string;
    readonly conversationId: string;
    readonly role: string;
    readonly content: string;
    readonly tokens: (null | undefined | number);
    readonly metadata: (null | undefined | Js_Json_t);
    readonly createdAt: number;
    readonly updatedAt: number;
};
export type dbVectorRow = {
    readonly messageId: string;
    readonly distance: number;
};
export declare const messageFromDb: (row: dbMessageRow) => (undefined | HybridSearchTypes_message);
export declare const vectorResultFromDb: (row: dbVectorRow) => HybridSearchTypes_vectorResult;
export declare const messagesFromDb: (rows: dbMessageRow[]) => HybridSearchTypes_message[];
export declare const vectorResultsFromDb: (rows: dbVectorRow[]) => HybridSearchTypes_vectorResult[];
export declare const messageToDb: (msg: HybridSearchTypes_message) => dbMessageRow;
export declare const parseMetadata: (jsonStr: string) => (undefined | Js_Json_t);
export declare const stringifyMetadata: (json: Js_Json_t) => string;
export declare const getStringField: (json: Js_Json_t, field: string) => (undefined | string);
export declare const getIntField: (json: Js_Json_t, field: string) => (undefined | number);
export declare const validateMessage: (msg: HybridSearchTypes_message) => boolean;
export declare const validateTimestamps: (msg: HybridSearchTypes_message) => boolean;
export declare const isValidMessage: (msg: HybridSearchTypes_message) => boolean;
export declare const createMessage: (id: string, conversationId: string, role: HybridSearchTypes_messageRole, content: string, tokens: (undefined | (undefined | number)), metadata: (undefined | (undefined | Js_Json_t)), _7: void) => HybridSearchTypes_message;
export declare const updateMessage: (msg: HybridSearchTypes_message, content: (undefined | (undefined | string)), tokens: (undefined | (undefined | number)), metadata: (undefined | (undefined | Js_Json_t)), _5: void) => HybridSearchTypes_message;
//# sourceMappingURL=MessageTransform.gen.d.ts.map