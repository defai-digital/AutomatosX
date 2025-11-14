/* TypeScript file generated from TypeSafety.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as TypeSafetyJS from './TypeSafety.bs.js';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type userId = { TAG: "UserId"; _0: string };

export type conversationId = { TAG: "ConversationId"; _0: string };

export type messageId = { TAG: "MessageId"; _0: string };

export type modelId = { TAG: "ModelId"; _0: string };

export type sessionId = { TAG: "SessionId"; _0: string };

export type tokenId = { TAG: "TokenId"; _0: string };

export type tokenCount = { TAG: "TokenCount"; _0: number };

export type timestamp = { TAG: "Timestamp"; _0: number };

export type price = { TAG: "Price"; _0: number };

export type email = { TAG: "Email"; _0: string };

export type url = { TAG: "Url"; _0: string };

export type nonEmptyArray<a> = { TAG: "NonEmptyArray"; _0: a[] };

export const makeUserId: (id:string) => ErrorHandling_result<userId,string> = TypeSafetyJS.makeUserId as any;

export const makeConversationId: (id:string) => ErrorHandling_result<conversationId,string> = TypeSafetyJS.makeConversationId as any;

export const makeMessageId: (id:string) => ErrorHandling_result<messageId,string> = TypeSafetyJS.makeMessageId as any;

export const makeModelId: (id:string) => ErrorHandling_result<modelId,string> = TypeSafetyJS.makeModelId as any;

export const makeSessionId: (id:string) => ErrorHandling_result<sessionId,string> = TypeSafetyJS.makeSessionId as any;

export const makeTokenId: (id:string) => ErrorHandling_result<tokenId,string> = TypeSafetyJS.makeTokenId as any;

export const unsafeUserId: (id:string) => userId = TypeSafetyJS.unsafeUserId as any;

export const unsafeConversationId: (id:string) => conversationId = TypeSafetyJS.unsafeConversationId as any;

export const unsafeMessageId: (id:string) => messageId = TypeSafetyJS.unsafeMessageId as any;

export const unsafeModelId: (id:string) => modelId = TypeSafetyJS.unsafeModelId as any;

export const unsafeSessionId: (id:string) => sessionId = TypeSafetyJS.unsafeSessionId as any;

export const unsafeTokenId: (id:string) => tokenId = TypeSafetyJS.unsafeTokenId as any;

export const unwrapUserId: (id:userId) => string = TypeSafetyJS.unwrapUserId as any;

export const unwrapConversationId: (id:conversationId) => string = TypeSafetyJS.unwrapConversationId as any;

export const unwrapMessageId: (id:messageId) => string = TypeSafetyJS.unwrapMessageId as any;

export const unwrapModelId: (id:modelId) => string = TypeSafetyJS.unwrapModelId as any;

export const unwrapSessionId: (id:sessionId) => string = TypeSafetyJS.unwrapSessionId as any;

export const unwrapTokenId: (id:tokenId) => string = TypeSafetyJS.unwrapTokenId as any;

export const eqUserId: (a:userId, b:userId) => boolean = TypeSafetyJS.eqUserId as any;

export const eqConversationId: (a:conversationId, b:conversationId) => boolean = TypeSafetyJS.eqConversationId as any;

export const eqMessageId: (a:messageId, b:messageId) => boolean = TypeSafetyJS.eqMessageId as any;

export const eqModelId: (a:modelId, b:modelId) => boolean = TypeSafetyJS.eqModelId as any;

export const eqSessionId: (a:sessionId, b:sessionId) => boolean = TypeSafetyJS.eqSessionId as any;

export const eqTokenId: (a:tokenId, b:tokenId) => boolean = TypeSafetyJS.eqTokenId as any;

export const makeTokenCount: (count:number) => ErrorHandling_result<tokenCount,string> = TypeSafetyJS.makeTokenCount as any;

export const unwrapTokenCount: (count:tokenCount) => number = TypeSafetyJS.unwrapTokenCount as any;

export const makeTimestamp: (ms:number) => ErrorHandling_result<timestamp,string> = TypeSafetyJS.makeTimestamp as any;

export const unwrapTimestamp: (ms:timestamp) => number = TypeSafetyJS.unwrapTimestamp as any;

export const now: () => timestamp = TypeSafetyJS.now as any;

export const makePrice: (cents:number) => ErrorHandling_result<price,string> = TypeSafetyJS.makePrice as any;

export const unwrapPrice: (cents:price) => number = TypeSafetyJS.unwrapPrice as any;

export const dollarsToPrice: (dollars:number) => price = TypeSafetyJS.dollarsToPrice as any;

export const priceToDollars: (price:price) => number = TypeSafetyJS.priceToDollars as any;

export const makeEmail: (address:string) => ErrorHandling_result<email,string> = TypeSafetyJS.makeEmail as any;

export const unwrapEmail: (address:email) => string = TypeSafetyJS.unwrapEmail as any;

export const makeUrl: (address:string) => ErrorHandling_result<url,string> = TypeSafetyJS.makeUrl as any;

export const unwrapUrl: (address:url) => string = TypeSafetyJS.unwrapUrl as any;

export const makeNonEmptyArray: <a>(arr:a[]) => ErrorHandling_result<nonEmptyArray<a>,string> = TypeSafetyJS.makeNonEmptyArray as any;

export const unwrapNonEmptyArray: <a>(arr:nonEmptyArray<a>) => a[] = TypeSafetyJS.unwrapNonEmptyArray as any;

export const headNonEmpty: <a>(arr:nonEmptyArray<a>) => a = TypeSafetyJS.headNonEmpty as any;

export const getUserConversations: (uid:userId) => conversationId[] = TypeSafetyJS.getUserConversations as any;

export const getConversationMessages: (convId:conversationId) => messageId[] = TypeSafetyJS.getConversationMessages as any;

export const userIdToString: (id:userId) => string = TypeSafetyJS.userIdToString as any;

export const conversationIdToString: (id:conversationId) => string = TypeSafetyJS.conversationIdToString as any;

export const messageIdToString: (id:messageId) => string = TypeSafetyJS.messageIdToString as any;
