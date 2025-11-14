/* TypeScript file generated from DomainValidation.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as DomainValidationJS from './DomainValidation.bs.js';

import type {result as ErrorHandling_result} from '../../src/error/ErrorHandling.gen';

export type userId = string;

export type conversationId = string;

export type messageId = string;

export type modelId = string;

export type messageRole = "user" | "assistant" | "system" | "function";

export type messageContent = { readonly text: string; readonly isValid: boolean };

export type tokenCount = number;

export type timestamp = { readonly milliseconds: number; readonly isValid: boolean };

export type temperature = number;

export type maxTokensPreference = number;

export type validatedMessage = {
  readonly id: messageId; 
  readonly conversationId: conversationId; 
  readonly role: messageRole; 
  readonly content: messageContent; 
  readonly tokens: tokenCount; 
  readonly timestamp: timestamp; 
  readonly modelId: (undefined | modelId)
};

export type conversationMetadata = {
  readonly messageCount: number; 
  readonly totalTokens: number; 
  readonly lastUpdated: timestamp
};

export type validatedConversation = {
  readonly id: conversationId; 
  readonly userId: userId; 
  readonly messages: validatedMessage[]; 
  readonly title: (undefined | string); 
  readonly createdAt: timestamp; 
  readonly updatedAt: timestamp; 
  readonly metadata: conversationMetadata
};

export type userPreferences = {
  readonly defaultModel: modelId; 
  readonly temperature: temperature; 
  readonly maxTokens: maxTokensPreference; 
  readonly systemPrompt: (undefined | string)
};

export const makeUserId: (id:string) => ErrorHandling_result<userId,string> = DomainValidationJS.makeUserId as any;

export const makeConversationId: (id:string) => ErrorHandling_result<conversationId,string> = DomainValidationJS.makeConversationId as any;

export const makeMessageId: (id:string) => ErrorHandling_result<messageId,string> = DomainValidationJS.makeMessageId as any;

export const makeModelId: (id:string) => ErrorHandling_result<modelId,string> = DomainValidationJS.makeModelId as any;

export const parseRole: (role:string) => ErrorHandling_result<messageRole,string> = DomainValidationJS.parseRole as any;

export const makeMessageContent: (text:string) => ErrorHandling_result<messageContent,string> = DomainValidationJS.makeMessageContent as any;

export const makeTokenCount: (count:number) => ErrorHandling_result<tokenCount,string> = DomainValidationJS.makeTokenCount as any;

export const makeTimestamp: (ms:number) => ErrorHandling_result<timestamp,string> = DomainValidationJS.makeTimestamp as any;

export const makeTemperature: (value:number) => ErrorHandling_result<temperature,string> = DomainValidationJS.makeTemperature as any;

export const makeMaxTokens: (value:number) => ErrorHandling_result<maxTokensPreference,string> = DomainValidationJS.makeMaxTokens as any;

export const createMessage: (id:string, convId:string, role:string, content:string, tokens:number, timestampMs:number, model:(undefined | (undefined | string))) => ErrorHandling_result<validatedMessage,string[]> = DomainValidationJS.createMessage as any;

export const unwrapUserId: (id:userId) => string = DomainValidationJS.unwrapUserId as any;

export const unwrapConversationId: (id:conversationId) => string = DomainValidationJS.unwrapConversationId as any;

export const unwrapMessageId: (id:messageId) => string = DomainValidationJS.unwrapMessageId as any;

export const unwrapModelId: (id:modelId) => string = DomainValidationJS.unwrapModelId as any;
