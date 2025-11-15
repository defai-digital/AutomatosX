import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type userId = {
    TAG: "UserId";
    _0: string;
};
export type conversationId = {
    TAG: "ConversationId";
    _0: string;
};
export type messageId = {
    TAG: "MessageId";
    _0: string;
};
export type modelId = {
    TAG: "ModelId";
    _0: string;
};
export type sessionId = {
    TAG: "SessionId";
    _0: string;
};
export type tokenId = {
    TAG: "TokenId";
    _0: string;
};
export type tokenCount = {
    TAG: "TokenCount";
    _0: number;
};
export type timestamp = {
    TAG: "Timestamp";
    _0: number;
};
export type price = {
    TAG: "Price";
    _0: number;
};
export type email = {
    TAG: "Email";
    _0: string;
};
export type phoneNumber = {
    TAG: "PhoneNumber";
    _0: string;
};
export type url = {
    TAG: "Url";
    _0: string;
};
export type nonEmptyArray<a> = {
    TAG: "NonEmptyArray";
    _0: a[];
};
export declare const makeUserId: (id: string) => ErrorHandling_result<userId, string>;
export declare const makeConversationId: (id: string) => ErrorHandling_result<conversationId, string>;
export declare const makeMessageId: (id: string) => ErrorHandling_result<messageId, string>;
export declare const makeModelId: (id: string) => ErrorHandling_result<modelId, string>;
export declare const makeSessionId: (id: string) => ErrorHandling_result<sessionId, string>;
export declare const makeTokenId: (id: string) => ErrorHandling_result<tokenId, string>;
export declare const unsafeUserId: (id: string) => userId;
export declare const unsafeConversationId: (id: string) => conversationId;
export declare const unsafeMessageId: (id: string) => messageId;
export declare const unsafeModelId: (id: string) => modelId;
export declare const unsafeSessionId: (id: string) => sessionId;
export declare const unsafeTokenId: (id: string) => tokenId;
export declare const unwrapUserId: (id: userId) => string;
export declare const unwrapConversationId: (id: conversationId) => string;
export declare const unwrapMessageId: (id: messageId) => string;
export declare const unwrapModelId: (id: modelId) => string;
export declare const unwrapSessionId: (id: sessionId) => string;
export declare const unwrapTokenId: (id: tokenId) => string;
export declare const eqUserId: (a: userId, b: userId) => boolean;
export declare const eqConversationId: (a: conversationId, b: conversationId) => boolean;
export declare const eqMessageId: (a: messageId, b: messageId) => boolean;
export declare const eqModelId: (a: modelId, b: modelId) => boolean;
export declare const eqSessionId: (a: sessionId, b: sessionId) => boolean;
export declare const eqTokenId: (a: tokenId, b: tokenId) => boolean;
export declare const makeTokenCount: (count: number) => ErrorHandling_result<tokenCount, string>;
export declare const unwrapTokenCount: (count: tokenCount) => number;
export declare const makeTimestamp: (ms: number) => ErrorHandling_result<timestamp, string>;
export declare const unwrapTimestamp: (ms: timestamp) => number;
export declare const now: () => timestamp;
export declare const makePrice: (cents: number) => ErrorHandling_result<price, string>;
export declare const unwrapPrice: (cents: price) => number;
export declare const dollarsToPrice: (dollars: number) => price;
export declare const priceToDollars: (price: price) => number;
export declare const makeEmail: (address: string) => ErrorHandling_result<email, string>;
export declare const unwrapEmail: (address: email) => string;
export declare const makePhoneNumber: (phone: string) => ErrorHandling_result<phoneNumber, string>;
export declare const unwrapPhoneNumber: (phone: phoneNumber) => string;
export declare const makeUrl: (address: string) => ErrorHandling_result<url, string>;
export declare const unwrapUrl: (address: url) => string;
export declare const makeNonEmptyArray: <a>(arr: a[]) => ErrorHandling_result<nonEmptyArray<a>, string>;
export declare const unwrapNonEmptyArray: <a>(arr: nonEmptyArray<a>) => a[];
export declare const headNonEmpty: <a>(arr: nonEmptyArray<a>) => a;
export declare const getUserConversations: (uid: userId) => conversationId[];
export declare const getConversationMessages: (convId: conversationId) => messageId[];
export declare const userIdToString: (id: userId) => string;
export declare const conversationIdToString: (id: conversationId) => string;
export declare const messageIdToString: (id: messageId) => string;
//# sourceMappingURL=TypeSafety.gen.d.ts.map