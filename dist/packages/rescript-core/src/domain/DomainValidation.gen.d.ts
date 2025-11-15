import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export type userId = string;
export type conversationId = string;
export type messageId = string;
export type modelId = string;
export type messageRole = "user" | "assistant" | "system" | "function";
export type messageContent = {
    readonly text: string;
    readonly isValid: boolean;
};
export type tokenCount = number;
export type timestamp = {
    readonly milliseconds: number;
    readonly isValid: boolean;
};
export type temperature = number;
export type maxTokensPreference = number;
export type validatedMessage = {
    readonly id: messageId;
    readonly conversationId: conversationId;
    readonly role: messageRole;
    readonly content: messageContent;
    readonly tokens: tokenCount;
    readonly timestamp: timestamp;
    readonly modelId: (undefined | modelId);
};
export type conversationMetadata = {
    readonly messageCount: number;
    readonly totalTokens: number;
    readonly lastUpdated: timestamp;
};
export type validatedConversation = {
    readonly id: conversationId;
    readonly userId: userId;
    readonly messages: validatedMessage[];
    readonly title: (undefined | string);
    readonly createdAt: timestamp;
    readonly updatedAt: timestamp;
    readonly metadata: conversationMetadata;
};
export type userPreferences = {
    readonly defaultModel: modelId;
    readonly temperature: temperature;
    readonly maxTokens: maxTokensPreference;
    readonly systemPrompt: (undefined | string);
};
export declare const makeUserId: (id: string) => ErrorHandling_result<userId, string>;
export declare const makeConversationId: (id: string) => ErrorHandling_result<conversationId, string>;
export declare const makeMessageId: (id: string) => ErrorHandling_result<messageId, string>;
export declare const makeModelId: (id: string) => ErrorHandling_result<modelId, string>;
export declare const parseRole: (role: string) => ErrorHandling_result<messageRole, string>;
export declare const makeMessageContent: (text: string) => ErrorHandling_result<messageContent, string>;
export declare const makeTokenCount: (count: number) => ErrorHandling_result<tokenCount, string>;
export declare const makeTimestamp: (ms: number) => ErrorHandling_result<timestamp, string>;
export declare const makeTemperature: (value: number) => ErrorHandling_result<temperature, string>;
export declare const makeMaxTokens: (value: number) => ErrorHandling_result<maxTokensPreference, string>;
export declare const createMessage: (id: string, convId: string, role: string, content: string, tokens: number, timestampMs: number, model: (undefined | (undefined | string))) => ErrorHandling_result<validatedMessage, string[]>;
export declare const unwrapUserId: (id: userId) => string;
export declare const unwrapConversationId: (id: conversationId) => string;
export declare const unwrapMessageId: (id: messageId) => string;
export declare const unwrapModelId: (id: modelId) => string;
//# sourceMappingURL=DomainValidation.gen.d.ts.map