/* TypeScript file generated from StatsAggregation.res by genType. */

/* eslint-disable */
/* tslint:disable */

// @ts-ignore
import * as StatsAggregationJS from './StatsAggregation.bs.js';

export type conversationStats = {
  readonly conversationId: string; 
  readonly messageCount: number; 
  readonly totalTokens: number; 
  readonly avgTokensPerMessage: number; 
  readonly userMessageCount: number; 
  readonly assistantMessageCount: number; 
  readonly systemMessageCount: number
};

export type globalStats = {
  readonly totalConversations: number; 
  readonly totalMessages: number; 
  readonly totalTokens: number; 
  readonly avgMessagesPerConversation: number; 
  readonly avgTokensPerMessage: number
};

export type timeRangeStats = {
  readonly startTime: number; 
  readonly endTime: number; 
  readonly messageCount: number; 
  readonly avgTokens: number
};

export type aggregationStrategy = "DirectSQL" | "InMemory" | "Hybrid";

export const buildConversationStatsQuery: (conversationId:string) => string = StatsAggregationJS.buildConversationStatsQuery as any;

export const buildGlobalStatsQuery: () => string = StatsAggregationJS.buildGlobalStatsQuery as any;

export const buildTimeRangeStatsQuery: (startTime:number, endTime:number) => string = StatsAggregationJS.buildTimeRangeStatsQuery as any;

export const parseConversationStatsRow: (row:{
  readonly assistant_message_count: number; 
  readonly avg_tokens_per_message: number; 
  readonly conversation_id: string; 
  readonly message_count: number; 
  readonly system_message_count: number; 
  readonly total_tokens: number; 
  readonly user_message_count: number
}) => conversationStats = StatsAggregationJS.parseConversationStatsRow as any;

export const parseGlobalStatsRow: (row:{
  readonly total_conversations: number; 
  readonly total_messages: number; 
  readonly total_tokens: number
}) => globalStats = StatsAggregationJS.parseGlobalStatsRow as any;

export const parseTimeRangeStatsRow: (row:{ readonly avg_tokens: number; readonly message_count: number }, startTime:number, endTime:number) => timeRangeStats = StatsAggregationJS.parseTimeRangeStatsRow as any;

export const selectStrategy: (estimatedRows:number) => aggregationStrategy = StatsAggregationJS.selectStrategy as any;

export const explainStrategy: (strategy:aggregationStrategy) => string = StatsAggregationJS.explainStrategy as any;
