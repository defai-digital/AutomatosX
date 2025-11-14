/* TypeScript file generated from EventBus.res by genType. */

/* eslint-disable */
/* tslint:disable */

import * as EventBusJS from './EventBus.bs.js';

import type {Json_t as Js_Json_t} from './Js.gen';

import type {Map_String_t as Belt_Map_String_t} from './Belt.gen';

export type eventId = string;

export type subscriberId = string;

export type eventPattern = string;

export type eventPriority = number;

export type eventData = {
  readonly id: eventId; 
  readonly eventType: string; 
  readonly payload: Js_Json_t; 
  readonly timestamp: number; 
  readonly source: (undefined | string); 
  readonly metadata: (undefined | {[id: string]: string}); 
  readonly priority: eventPriority
};

export type eventHandler = (_1:eventData) => Promise<
    { TAG: "Ok"; _0: void }
  | { TAG: "Error"; _0: string }>;

export type subscription = {
  readonly id: subscriberId; 
  readonly pattern: eventPattern; 
  readonly handler: eventHandler; 
  readonly priority: eventPriority; 
  readonly active: boolean; 
  readonly createdAt: number
};

export type eventBusConfig = {
  readonly maxHistorySize: number; 
  readonly enableHistory: boolean; 
  readonly enableFiltering: boolean; 
  readonly defaultPriority: eventPriority
};

export type eventBus = {
  readonly subscriptions: Belt_Map_String_t<subscription>; 
  readonly history: eventData[]; 
  readonly config: eventBusConfig; 
  eventCount: number; 
  errorCount: number
};

export type eventFilter = {
  readonly eventType: (undefined | string); 
  readonly source: (undefined | string); 
  readonly startTime: (undefined | number); 
  readonly endTime: (undefined | number); 
  readonly limit: (undefined | number)
};

export type eventBusStats = {
  readonly totalEvents: number; 
  readonly totalSubscribers: number; 
  readonly activeSubscribers: number; 
  readonly historySize: number; 
  readonly errorCount: number; 
  readonly averageHandlers: number
};

export const createConfig: (maxHistorySize:(undefined | number), enableHistory:(undefined | boolean), enableFiltering:(undefined | boolean), defaultPriority:(undefined | eventPriority), _5:void) => eventBusConfig = EventBusJS.createConfig as any;

export const create: (config:(undefined | eventBusConfig), param:void) => eventBus = EventBusJS.create as any;

export const subscribe: (bus:eventBus, pattern:eventPattern, handler:eventHandler, priority:(undefined | eventPriority), param:void) => 
    { TAG: "Ok"; _0: eventBus; _1: subscriberId }
  | { TAG: "Error"; _0: string } = EventBusJS.subscribe as any;

export const unsubscribe: (bus:eventBus, subscriberId:subscriberId) => 
    { TAG: "Ok"; _0: eventBus }
  | { TAG: "Error"; _0: string } = EventBusJS.unsubscribe as any;

export const pauseSubscription: (bus:eventBus, subscriberId:subscriberId) => 
    { TAG: "Ok"; _0: eventBus }
  | { TAG: "Error"; _0: string } = EventBusJS.pauseSubscription as any;

export const resumeSubscription: (bus:eventBus, subscriberId:subscriberId) => 
    { TAG: "Ok"; _0: eventBus }
  | { TAG: "Error"; _0: string } = EventBusJS.resumeSubscription as any;

export const getSubscription: (bus:eventBus, subscriberId:subscriberId) => (undefined | subscription) = EventBusJS.getSubscription as any;

export const getAllSubscriptions: (bus:eventBus) => subscription[] = EventBusJS.getAllSubscriptions as any;

export const getActiveSubscriptions: (bus:eventBus) => subscription[] = EventBusJS.getActiveSubscriptions as any;

export const createEvent: (eventType:string, payload:Js_Json_t, source:(undefined | string), metadata:(undefined | {[id: string]: string}), priority:(undefined | eventPriority), param:void) => eventData = EventBusJS.createEvent as any;

export const publish: (bus:eventBus, event:eventData) => Promise<Promise<
    { TAG: "Ok"; _0: eventBus }
  | { TAG: "Error"; _0: string }>> = EventBusJS.publish as any;

export const publishSync: (bus:eventBus, event:eventData) => 
    { TAG: "Ok"; _0: eventBus }
  | { TAG: "Error"; _0: string } = EventBusJS.publishSync as any;

export const getHistory: (bus:eventBus, filter:(undefined | eventFilter), param:void) => eventData[] = EventBusJS.getHistory as any;

export const clearHistory: (bus:eventBus) => eventBus = EventBusJS.clearHistory as any;

export const getEvent: (bus:eventBus, eventId:eventId) => (undefined | eventData) = EventBusJS.getEvent as any;

export const getEventsByType: (bus:eventBus, eventType:string, limit:(undefined | number), param:void) => eventData[] = EventBusJS.getEventsByType as any;

export const getEventsBySource: (bus:eventBus, source:string, limit:(undefined | number), param:void) => eventData[] = EventBusJS.getEventsBySource as any;

export const getRecentEvents: (bus:eventBus, count:number) => eventData[] = EventBusJS.getRecentEvents as any;

export const getStats: (bus:eventBus) => eventBusStats = EventBusJS.getStats as any;

export const hasSubscribers: (bus:eventBus, pattern:eventPattern) => boolean = EventBusJS.hasSubscribers as any;

export const getSubscriberCount: (bus:eventBus, pattern:eventPattern) => number = EventBusJS.getSubscriberCount as any;

export const reset: (bus:eventBus) => eventBus = EventBusJS.reset as any;

export const createFilter: (eventType:(undefined | string), source:(undefined | string), startTime:(undefined | number), endTime:(undefined | number), limit:(undefined | number), param:void) => eventFilter = EventBusJS.createFilter as any;
